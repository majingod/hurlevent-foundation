/**
 * Dériveurs XP / PV / PS — portage 1:1 des annexes A/B/C/D du serveur.
 *
 * Fonctions PURES sur (snapshot, état local) : zéro I/O, déterministes.
 * L'appelant fournit le snapshot visiteur offline et l'état de création local.
 *
 * Sources de vérité (SQL prod 2026-07-03) :
 *  - A. recalculer_xp_valeurs   → calculerXp
 *  - B. recalculer_pv_max       → calculerPvMax
 *  - C. recalculer_ps_max       → calculerPsMax
 *  - D. personnage_inapte_magie → raceInapteMagie
 */

import type { SnapshotVisiteur, Classe, Race, Competence } from "./snapshot";

/**
 * Une compétence acquise localement par le visiteur.
 * `xpDepense` porte le coût RÉELLEMENT dépensé (0 pour une gratuité de classe),
 * miroir de `personnage_competences.xp_depense`.
 */
export interface CompetenceAcquiseLocale {
  competenceId: string;
  niveauAcquis: number;
  choixAchat: string | null;
  xpDepense: number;
  apprisViaMaitre?: boolean;
  statutMaitre?: string;
}

/**
 * État de création local d'un personnage visiteur (offline).
 */
export interface EtatCreationVisiteur {
  raceId: string | null;
  classeId: string | null;
  religionId?: string | null;
  estCroyant?: boolean;
  competencesAcquises: CompetenceAcquiseLocale[];
  /**
   * Dépenses XP hors compétences (sorts, prières, traits raciaux payants…).
   * Le visiteur P1-b ne les manipule pas encore, mais la formule XP les somme
   * quand même (recompute complet). Défaut : aucune.
   */
  autresDepensesXp?: number[];
}

export interface ValeursXp {
  xpTotal: number;
  xpDepense: number;
  xpDispo: number;
}

// ============================================================
// D. raceInapteMagie (annexe D)
// ============================================================

/**
 * La race possède-t-elle le trait ACTIF nommé exactement « Inapte à la magie » ?
 * Jointure race_traits × traits_raciaux (t.nom = 'Inapte à la magie' AND t.est_actif).
 *
 * Implémentation UNIQUE (déplacée depuis snapshot.ts).
 */
export function raceInapteMagie(
  snapshot: SnapshotVisiteur,
  raceId: string | null
): boolean {
  if (!raceId) return false;
  const raceTraits = snapshot.tables.race_traits;
  const traitsRaciaux = snapshot.tables.traits_raciaux;

  const traitsActifsDeLaRace = raceTraits
    .filter((rt) => rt.race_id === raceId)
    .map((rt) => traitsRaciaux.find((t) => t.id === rt.trait_id))
    .filter(
      (t): t is NonNullable<typeof t> => t != null && t.est_actif === true
    );

  return traitsActifsDeLaRace.some((t) => t.nom === "Inapte à la magie");
}

// ============================================================
// helpers internes
// ============================================================

function getRace(snapshot: SnapshotVisiteur, raceId: string | null): Race | undefined {
  if (!raceId) return undefined;
  return snapshot.tables.races.find((r) => r.id === raceId);
}

function getClasse(snapshot: SnapshotVisiteur, classeId: string | null): Classe | undefined {
  if (!classeId) return undefined;
  return snapshot.tables.classes.find((c) => c.id === classeId);
}

function getCompetenceById(
  snapshot: SnapshotVisiteur,
  competenceId: string
): Competence | undefined {
  return snapshot.tables.competences.find((c) => c.id === competenceId);
}

// ============================================================
// A. calculerXp (annexe A — recalculer_xp_valeurs)
// ============================================================

/**
 * Portage de recalculer_xp_valeurs pour un visiteur à la création.
 *
 * Formule canonique (annexe A) :
 *   v_dep   = races.xp_depart (COALESCE 0)
 *   v_gn    = gn_completes*15 + mini_gn_completes*15 + ouvertures_terrain*10
 *   v_gains = Σ historique_xp gain_*   ; v_dep_xp = Σ depense_* ; v_remb = Σ remboursement
 *   xp_total   = v_dep + v_gn + v_gains
 *   xp_depense = v_dep_xp - v_remb
 *
 * Pour un VISITEUR à la création : gn_completes = mini_gn_completes =
 * ouvertures_terrain = 0 et l'historique_xp est vide (v_gains = 0). Donc
 *   v_gn = 0*15 + 0*15 + 0*10 = 0  → xpTotal = xp_depart.
 * Les dépenses locales tiennent lieu de v_dep_xp ; un retrait local retire
 * simplement l'item (recompute), ce qui joue le rôle de v_remb.
 */
export function calculerXp(
  snapshot: SnapshotVisiteur,
  etat: EtatCreationVisiteur
): ValeursXp {
  const race = getRace(snapshot, etat.raceId);
  const vDep = race?.xp_depart ?? 0;

  // Compteurs de jeu à 0 pour un visiteur (formule complète, commentée ci-dessus).
  const gnCompletes = 0;
  const miniGnCompletes = 0;
  const ouverturesTerrain = 0;
  const vGn = gnCompletes * 15 + miniGnCompletes * 15 + ouverturesTerrain * 10;
  const vGains = 0; // historique_xp vide pour un visiteur

  const xpTotal = vDep + vGn + vGains;

  // xpDepense = Σ coûts des achats locaux (compétences + autres) — recompute.
  // Un retrait = item absent de la liste → naturellement non compté (≈ v_remb).
  const depenseCompetences = etat.competencesAcquises.reduce(
    (acc, c) => acc + (c.xpDepense ?? 0),
    0
  );
  const depenseAutres = (etat.autresDepensesXp ?? []).reduce(
    (acc, n) => acc + (n ?? 0),
    0
  );
  const xpDepense = depenseCompetences + depenseAutres;

  return {
    xpTotal,
    xpDepense,
    xpDispo: xpTotal - xpDepense,
  };
}

// ============================================================
// B. calculerPvMax (annexe B — recalculer_pv_max)
// ============================================================

/**
 * pv_max = COALESCE(classes.pv_depart, 4) + (1 si race inapte magie).
 */
export function calculerPvMax(
  snapshot: SnapshotVisiteur,
  etat: EtatCreationVisiteur
): number {
  const classe = getClasse(snapshot, etat.classeId);
  const pvDepart = classe?.pv_depart ?? 4;
  const bonus = raceInapteMagie(snapshot, etat.raceId) ? 1 : 0;
  return pvDepart + bonus;
}

// ============================================================
// C. calculerPsMax (annexe C — recalculer_ps_max)
// ============================================================

/**
 * ps_max = 0 si race inapte magie ; sinon
 *   COALESCE(classes.ps_depart, 5)
 *   + nb(« Développement Spirituel »)
 *   + nb(« Développement Spirituel Supérieur »)
 * comptés dans les compétences acquises (jointure par nom, annexe C).
 */
export function calculerPsMax(
  snapshot: SnapshotVisiteur,
  etat: EtatCreationVisiteur
): number {
  if (raceInapteMagie(snapshot, etat.raceId)) return 0;

  const classe = getClasse(snapshot, etat.classeId);
  const psDepart = classe?.ps_depart ?? 5;

  const nomsAcquis = etat.competencesAcquises.map(
    (c) => getCompetenceById(snapshot, c.competenceId)?.nom ?? null
  );
  const nbDevSpi = nomsAcquis.filter((n) => n === "Développement Spirituel").length;
  const nbDevSpiSup = nomsAcquis.filter(
    (n) => n === "Développement Spirituel Supérieur"
  ).length;

  return psDepart + nbDevSpi + nbDevSpiSup;
}

// ============================================================
// niveau (visiteur) = 1
// ============================================================

export function calculerNiveau(): number {
  // niveau = 1 + gn_completes + niveau_correction ; visiteur → 1 + 0 + 0.
  return 1;
}

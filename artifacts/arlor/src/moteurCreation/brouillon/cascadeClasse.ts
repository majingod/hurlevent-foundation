/**
 * Moteur PUR du changement de classe en cours de wizard (lot 4 visiteur).
 *
 * Porte fidèlement la cascade serveur de `changer_classe_personnage`
 * (migration 20260606052624, dernière définition en vigueur) — la SEULE source
 * de vérité, vérifiée sur le SQL et l'audit de parité s311 (TOP 2). Une fonction,
 * `calculerCascadeChangementClasse`, calcule TOUT sans rien écrire ; l'APERÇU
 * (dry_run) et l'APPLICATION réelle la consomment (source unique).
 *
 * Décision de scope (validée Fred s311) — porter les mécanismes qui ont du sens
 * pour un BROUILLON ; pour les 2 mécaniques « personnage vivant », porter leur
 * CONSÉQUENCE brouillon :
 *  - D2 maître : PAS de statut local — l'AVERTISSEMENT verbatim est porté +
 *    `maitre_en_attente[]` rempli pour l'affichage.
 *  - D3 dormance : offline il n'y a pas de « sommeil » réactivable → suppression
 *    RÉELLE des sorts/prières achetés, MAIS `dormants[]` au format serveur exact
 *    pour l'aperçu (même dialogue que le connecté).
 *
 * Différence de modèle avec le serveur (essentielle) : côté brouillon les
 * gratuités de classe sont DÉRIVÉES (jamais stockées) et disparaissent seules à
 * la re-dérivation. On n'a donc à retirer que les compétences ACHETÉES ; les
 * gratuités obsolètes (D5) sont uniquement LISTÉES dans l'aperçu (`gratuite_obsolete`).
 *
 * TS pur : aucun import React, aucun accès `localStorage`/`window`.
 */

import { calculerCoutXP } from "@/utils/calculsMagie";
import type { SnapshotVisiteur, Competence, Classe } from "../snapshot";
import { deriverEtat, coutAchatCompetence, type EtatDeriveVisiteur } from "./deriver";
import { cascadeParPrerequis } from "./prerequis";
import type { BrouillonVisiteur, BrouillonCompetence } from "./types";

type Deriver = (b: BrouillonVisiteur) => EtatDeriveVisiteur;

// ============================================================
// Types de sortie
// ============================================================

/** Un niveau retiré (aperçu `perdues[].niveaux[]`). */
export interface NiveauPerdu {
  niv: number;
  xp: number;
  gratuit: boolean;
}

export type RaisonPerte = "gratuite_obsolete" | "class_locked" | "over_cap" | "cascade";

export interface PerdueDonnees {
  nom: string;
  raison: RaisonPerte;
  niveaux: NiveauPerdu[];
  xp: number;
}

export interface DormantDonnees {
  type: "sort" | "priere";
  nom: string;
  niveau: number;
  xp: number;
}

export interface MaitreDonnees {
  nom: string;
  niveau: number;
}

export interface OfferteDonnees {
  nom: string;
  type: "ajout" | "d6_refund";
  xp: number;
}

export interface MultiChoixOption {
  choix_achat: string;
  label: string;
  xp: number;
}

export interface MultiChoixDonnees {
  competence_id: string;
  nom: string;
  options: MultiChoixOption[];
  defaut: string | null;
}

/** `donnees` du dry_run — format EXACT consommé par le dialogue [VIS-1] d'Etape4_V2. */
export interface CascadeDonnees {
  classe_avant: string | null;
  classe_apres: string | null;
  perdues: PerdueDonnees[];
  dormants: DormantDonnees[];
  maitre_en_attente: MaitreDonnees[];
  offertes: OfferteDonnees[];
  multi_choix: MultiChoixDonnees[];
  xp_rembourse: number;
}

export interface CascadeErreur {
  code: string;
  message: string;
  champ?: string;
}

export interface CascadeAvertissement {
  code: string;
  message: string;
}

/** Instruction D6 : retirer l'ACHAT de l'instance offerte (+ graver le choix). */
export interface D6Instruction {
  instanceId: string;
  competenceId: string;
  /** Choix à graver dans `etape4.choixParCompetence` (multiple_choix_distinct). */
  choixAGraver?: string;
}

export interface ResultatCascade {
  /** Instances ACHETÉES à retirer (class-locked / over-cap / cascade). */
  instanceIdsARetirer: string[];
  /** Suppression RÉELLE de tous les sorts achetés (D3). */
  purgeSorts: boolean;
  /** Suppression RÉELLE de toutes les prières achetées (D3). */
  purgePrieres: boolean;
  /** Instances dont l'achat est retiré car offert par la nouvelle classe (D6). */
  d6: D6Instruction[];
  /** Erreurs bloquantes en application réelle (ex. `choix_requis`). */
  erreurs: CascadeErreur[];
  /** Avertissements verbatim (D2 `maitre_requis`). */
  avertissements: CascadeAvertissement[];
  /** Aperçu complet, format serveur. */
  donnees: CascadeDonnees;
}

// ============================================================
// Helpers snapshot (lecture pure)
// ============================================================

const NORMALISATION: Record<string, string> = {
  Guerrier: "guerrier",
  Voleur: "voleur",
  Mage: "mage",
  Prêtre: "pretre",
};

function normaliserClasse(nom: string | null | undefined): string | null {
  return nom != null ? NORMALISATION[nom] ?? null : null;
}

function getClasse(snapshot: SnapshotVisiteur, id: string | null): Classe | undefined {
  if (!id) return undefined;
  return snapshot.tables.classes.find((c) => c.id === id);
}

function getCompetence(snapshot: SnapshotVisiteur, id: string): Competence | undefined {
  return snapshot.tables.competences.find((c) => c.id === id);
}

interface GratuiteDef {
  competence_id: string;
  niveau: number;
}

function gratuitesDeClasse(classe: Classe | undefined): GratuiteDef[] {
  return (classe?.competences_gratuites as GratuiteDef[] | null) ?? [];
}

/** Label d'un choix (langue ancienne / religion) → nom, sinon la valeur brute. */
function labelChoix(snapshot: SnapshotVisiteur, choix: string): string {
  const langue = (snapshot.tables.langues as Array<{ id: string; nom: string | null }>).find(
    (l) => l.id === choix,
  );
  if (langue?.nom) return langue.nom;
  const religion = (snapshot.tables.religions as Array<{ id: string; nom: string | null }>).find(
    (r) => r.id === choix,
  );
  if (religion?.nom) return religion.nom;
  return choix;
}

// ============================================================
// Le moteur
// ============================================================

/**
 * Calcule la cascade complète d'un changement de classe pour un brouillon.
 * PURE : ne mute rien, n'écrit rien. L'appelant applique les instructions.
 *
 * @param choixParCompetence  choix D6 `competence_id → choix_achat` (multiple_choix_distinct).
 * @param deriver             dérivation injectable (défaut `deriverEtat`).
 */
export function calculerCascadeChangementClasse(
  snapshot: SnapshotVisiteur,
  brouillon: BrouillonVisiteur,
  nouvelleClasseId: string,
  choixParCompetence: Record<string, string> = {},
  deriver: Deriver = deriverEtat,
): ResultatCascade {
  const ancienne = getClasse(snapshot, brouillon.etape4.classeId || null);
  const nouvelle = getClasse(snapshot, nouvelleClasseId);
  const normNew = normaliserClasse(nouvelle?.nom);

  // Brouillon « après swap » : sert à re-dériver les gratuités et donc les
  // prérequis de la NOUVELLE classe (la cascade s'évalue contre cet état).
  const brouillonNouveau: BrouillonVisiteur = {
    ...brouillon,
    etape4: { classeId: nouvelleClasseId, choixParCompetence },
  };

  const gratuitesAvant = deriver(brouillon).gratuites;
  const gratuitesApres = deriver(brouillonNouveau).gratuites;
  const idsGratApres = new Set(gratuitesApres.map((g) => g.competenceId));

  const achats = brouillon.acquisitions.competences;

  // ── Phase 1 : retraits initiaux sur les compétences ACHETÉES ──────────────
  const estClassLocked = (comp: Competence | undefined): boolean =>
    comp?.classes_requises != null && !comp.classes_requises.includes(normNew ?? "");
  const estHorsClasse = (comp: Competence | undefined): boolean =>
    comp != null && !comp.est_general && comp.categorie !== normNew && comp.classes_requises == null;

  const retireInitial = (c: BrouillonCompetence): boolean => {
    const comp = getCompetence(snapshot, c.competenceId);
    // 1a. class-locked : classes_requises défini et nouvelle classe absente.
    if (estClassLocked(comp)) return true;
    // 1c. over-cap (D1) : hors-classe et niveau acquis > 2.
    if (estHorsClasse(comp) && c.niveauAcquis > 2) return true;
    return false;
  };

  const survivantsInitiaux = achats.filter((c) => !retireInitial(c));

  // 1d. Cascade transitive (boucle prérequis partagée avec le lot 3).
  const survivants = cascadeParPrerequis(brouillonNouveau, survivantsInitiaux, deriver);
  const survivantsIds = new Set(survivants.map((c) => c.instanceId));
  const retirees = achats.filter((c) => !survivantsIds.has(c.instanceId));

  // ── Gratuités obsolètes (D5) : dérivées, disparaissent seules ; LISTÉES en aperçu.
  const obsoletes = gratuitesAvant.filter((g) => !idsGratApres.has(g.competenceId));
  const idsObsoletes = new Set(obsoletes.map((g) => g.competenceId));

  // ── Phase 4 : agrégation des perdues (achats retirés + gratuités obsolètes) ──
  interface AggPerdue {
    nom: string;
    competenceId: string;
    niveaux: NiveauPerdu[];
  }
  const aggParComp = new Map<string, AggPerdue>();
  const pousser = (competenceId: string, nom: string, niv: NiveauPerdu) => {
    const agg = aggParComp.get(competenceId) ?? { nom, competenceId, niveaux: [] };
    agg.niveaux.push(niv);
    aggParComp.set(competenceId, agg);
  };
  for (const c of retirees) {
    const comp = getCompetence(snapshot, c.competenceId);
    const xp = coutAchatCompetence(brouillon, c.competenceId, c.niveauAcquis, c.choixAchat);
    pousser(c.competenceId, comp?.nom ?? "", { niv: c.niveauAcquis, xp, gratuit: xp === 0 });
  }
  for (const g of obsoletes) {
    // Ne double-liste pas une compétence déjà présente via un achat retiré.
    if (aggParComp.has(g.competenceId)) continue;
    pousser(g.competenceId, g.competenceNom, { niv: g.niveauAcquis, xp: 0, gratuit: true });
  }

  const raisonDe = (competenceId: string, niveaux: NiveauPerdu[]): RaisonPerte => {
    const comp = getCompetence(snapshot, competenceId);
    if (idsObsoletes.has(competenceId)) return "gratuite_obsolete";
    if (estClassLocked(comp)) return "class_locked";
    const nivMax = niveaux.reduce((m, n) => Math.max(m, n.niv), 0);
    if (estHorsClasse(comp) && nivMax > 2) return "over_cap";
    return "cascade";
  };

  const perdues: PerdueDonnees[] = [...aggParComp.values()]
    .map((agg) => {
      const niveaux = [...agg.niveaux].sort((a, b) => a.niv - b.niv);
      return {
        nom: agg.nom,
        raison: raisonDe(agg.competenceId, niveaux),
        niveaux,
        xp: niveaux.reduce((s, n) => s + n.xp, 0),
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  // ── Phase D3 : dormance sorts/prières ──────────────────────────────────────
  // union serveur = achats retirés ∪ gratuités obsolètes (même compétence).
  const nomsRetires = new Set<string>([
    ...retirees.map((c) => getCompetence(snapshot, c.competenceId)?.nom ?? ""),
    ...obsoletes.map((g) => g.competenceNom),
  ]);
  const purgeSorts = nomsRetires.has("Acquisition de Sort");
  const purgePrieres = nomsRetires.has("Acquisition de Prière");

  const dormants: DormantDonnees[] = [];
  let xpSorts = 0;
  let xpPrieres = 0;
  if (purgeSorts) {
    const items = brouillon.acquisitions.sorts.map((s) => {
      const cat = (snapshot.tables.sorts as Array<{ id: string; nom: string | null; cout_xp_base: number | null }>).find(
        (x) => x.id === s.sortId,
      );
      const xp = calculerCoutXP(s.zoneChoisie, s.porteeChoisie, s.dureeChoisie, s.niveauSort, cat?.cout_xp_base ?? 0);
      xpSorts += xp;
      return { type: "sort" as const, nom: s.nomPersonnalise ?? cat?.nom ?? "", niveau: s.niveauSort, xp };
    });
    items.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    dormants.push(...items);
  }
  if (purgePrieres) {
    const items = brouillon.acquisitions.prieres.map((p) => {
      const cat = (snapshot.tables.prieres as Array<{ id: string; nom: string | null; cout_xp_base: number | null }>).find(
        (x) => x.id === p.priereId,
      );
      const xp = calculerCoutXP(p.zoneChoisie, p.porteeChoisie, p.dureeChoisie, p.niveauPriere, cat?.cout_xp_base ?? 0);
      xpPrieres += xp;
      return { type: "priere" as const, nom: p.nomPersonnalise ?? cat?.nom ?? "", niveau: p.niveauPriere, xp };
    });
    items.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    dormants.push(...items);
  }

  // ── Phase D2 : maître en attente (hors-classe niveau 2 SURVIVANT) ──────────
  const maitreEnAttente: MaitreDonnees[] = survivants
    .filter((c) => {
      const comp = getCompetence(snapshot, c.competenceId);
      return estHorsClasse(comp) && c.niveauAcquis === 2;
    })
    .map((c) => ({ nom: getCompetence(snapshot, c.competenceId)?.nom ?? "", niveau: c.niveauAcquis }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const avertissements: CascadeAvertissement[] = maitreEnAttente.map((m) => ({
    code: "maitre_requis",
    message: `« ${m.nom} » niveau ${m.niveau} passe hors-classe : approbation d'un maître désormais requise.`,
  }));

  // ── Phase D6 + ajouts : gratuités de la NOUVELLE classe ────────────────────
  const idsGratAvant = new Set(gratuitesAvant.map((g) => g.competenceId));
  const offertes: OfferteDonnees[] = [];
  const multiChoix: MultiChoixDonnees[] = [];
  const d6: D6Instruction[] = [];
  const erreurs: CascadeErreur[] = [];
  let xpD6 = 0;

  for (const g of gratuitesDeClasse(nouvelle)) {
    const comp = getCompetence(snapshot, g.competence_id);
    if (!comp) continue;
    const nom = comp.nom ?? "";
    const dejaGratuite = idsGratAvant.has(g.competence_id); // (have_free)
    // Instances payées SURVIVANTES de cette gratuité (coût effectif > 0).
    const payees = survivants.filter(
      (c) =>
        c.competenceId === g.competence_id &&
        coutAchatCompetence(brouillon, c.competenceId, c.niveauAcquis, c.choixAchat) > 0,
    );

    if (dejaGratuite) {
      // Gratuité déjà satisfaite (classe partagée) → rien.
      continue;
    }
    if (payees.length === 0) {
      // Ajout : la gratuité apparaît seule à la dérivation.
      offertes.push({ nom, type: "ajout", xp: 0 });
      continue;
    }

    // D6 : payée → offerte → rembourser UNE instance.
    if (comp.type_achat === "multiple_choix_distinct") {
      if (payees.length > 1) {
        const options: MultiChoixOption[] = payees
          .map((c) => ({
            choix_achat: c.choixAchat ?? "",
            label: labelChoix(snapshot, c.choixAchat ?? ""),
            xp: coutAchatCompetence(brouillon, c.competenceId, c.niveauAcquis, c.choixAchat),
          }))
          .sort((a, b) => a.xp - b.xp || a.choix_achat.localeCompare(b.choix_achat, "fr"));
        multiChoix.push({
          competence_id: g.competence_id,
          nom,
          options,
          defaut: options[0]?.choix_achat ?? null,
        });
      }
      const choix = choixParCompetence[g.competence_id];
      let cible: BrouillonCompetence | undefined;
      if (choix != null) {
        cible = payees.find((c) => c.choixAchat === choix);
      } else {
        // Sans choix : erreur en réel ; instance la moins chère en aperçu.
        erreurs.push({
          code: "choix_requis",
          message: `Choisissez quelle instance de « ${nom} » devient gratuite`,
          champ: g.competence_id,
        });
        cible = [...payees].sort(
          (a, b) =>
            coutAchatCompetence(brouillon, a.competenceId, a.niveauAcquis, a.choixAchat) -
              coutAchatCompetence(brouillon, b.competenceId, b.niveauAcquis, b.choixAchat) ||
            (a.choixAchat ?? "").localeCompare(b.choixAchat ?? "", "fr"),
        )[0];
      }
      if (cible) {
        const xp = coutAchatCompetence(brouillon, cible.competenceId, cible.niveauAcquis, cible.choixAchat);
        d6.push({ instanceId: cible.instanceId, competenceId: g.competence_id, choixAGraver: cible.choixAchat ?? undefined });
        offertes.push({ nom, type: "d6_refund", xp });
        xpD6 += xp;
      }
    } else {
      // single : l'instance niveau 1 payée.
      const cible = payees.find((c) => c.niveauAcquis === 1) ?? payees[0];
      if (cible) {
        const xp = coutAchatCompetence(brouillon, cible.competenceId, cible.niveauAcquis, cible.choixAchat);
        d6.push({ instanceId: cible.instanceId, competenceId: g.competence_id });
        offertes.push({ nom, type: "d6_refund", xp });
        xpD6 += xp;
      }
    }
  }

  // ── xp_rembourse global (compétences + sorts + prières + D6) ───────────────
  const xpComp = perdues.reduce((s, p) => s + p.xp, 0);
  const xpRembourse = xpComp + xpSorts + xpPrieres + xpD6;

  const donnees: CascadeDonnees = {
    classe_avant: ancienne?.nom ?? null,
    classe_apres: nouvelle?.nom ?? null,
    perdues,
    dormants,
    maitre_en_attente: maitreEnAttente,
    offertes,
    multi_choix: multiChoix,
    xp_rembourse: xpRembourse,
  };

  return {
    instanceIdsARetirer: retirees.map((c) => c.instanceId),
    purgeSorts,
    purgePrieres,
    d6,
    erreurs,
    avertissements,
    donnees,
  };
}

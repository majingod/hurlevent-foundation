/**
 * Dérivation du BROUILLON VISITEUR (lot P2-a3-i).
 *
 * `deriverEtat(b)` transforme le brouillon (choix bruts) en état DÉRIVÉ complet :
 * les contextes consommés par les gates + les scalaires (xp, pv, ps, gratuités,
 * quotas, inapte-magie). RECOMPUTE FROM SCRATCH à chaque appel : retirer un choix
 * puis re-dériver suffit, aucune valeur dérivée n'est jamais mémorisée.
 *
 * Règle d'or : on IMPORTE les calculs du moteur, on n'en réécrit AUCUN.
 *  - gratuités de classe .......... `appliquerGratuites`   (gratuites.ts)
 *  - XP total / dépensé / dispo .... `calculerXp`           (deriveurs.ts)
 *  - PV / PS max ................... `calculerPvMax` / `calculerPsMax`
 *  - inapte magie .................. `personnageInapteMagie` (INSTANCE, s370)
 *  - niveaux artisanat ............. `deriverNiveauxArtisanat`
 *  - quotas artisanat .............. `quotaPiegesNiveau` / `quotaRecettesPalier`
 *                                    / `quotaAssemblagesTotal`
 *  - coût XP magie ................. `calculerCoutXP`       (utils/calculsMagie)
 *
 * NB (candidat d'extraction, cf. PR) : le moteur n'expose PAS de fonction
 * autonome « coût effectif d'une acquisition ». Le coût d'une compétence est donc
 * lu directement sur la donnée snapshot `competences.niveaux[].cout_xp` (la MÊME
 * colonne que lit le gate à l'étape 11) ; l'arbitrage gratuité/quota de l'artisanat
 * rejoue l'ordre d'insertion en s'appuyant sur les fonctions `quota*` importées.
 * Aucune valeur de règle n'est codée en dur ici.
 */

import { calculerCoutXP } from "@/utils/calculsMagie";
import { getSnapshot } from "../snapshot";
import type { Competence } from "../snapshot";
import { appliquerGratuites } from "../gratuites";
import { coutApresRabais, SEUIL_RABAIS_PAR_NIVEAU } from "../rabais";
import {
  calculerXp,
  calculerPvMax,
  calculerPsMax,
  personnageInapteMagie,
  deriverNiveauxArtisanat,
  quotaPiegesNiveau,
  quotaRecettesPalier,
  quotaAssemblagesTotal,
  calculerNiveau,
  type EtatCreationVisiteur,
  type CompetenceAcquiseLocale,
  type NiveauxArtisanat,
  type TraitAcquis,
} from "../deriveurs";
import type {
  ContextePersonnage,
  ContexteMagie,
  ContextePiege,
  ContexteRecette,
  ContexteAssemblage,
  AcquisCompetence,
  PiegeAcquis,
  RecetteAcquise,
  AssemblageAcquis,
} from "../types";
import type { BrouillonVisiteur, BrouillonEtape3 } from "./types";

// ============================================================
// Sortie
// ============================================================

export interface QuotasArtisanat {
  /** Pièges gratuits par niveau (1→3). */
  piegesParNiveau: { 1: number; 2: number; 3: number };
  /** Recettes gratuites par palier (1→3). */
  recettesParPalier: { 1: number; 2: number; 3: number };
  /** Assemblages gratuits (total). */
  assemblagesTotal: number;
}

export interface EtatDeriveVisiteur {
  // Contextes prêts à être passés aux gates (shapes EXACTES qu'elles consomment).
  contextePersonnage: ContextePersonnage;
  contexteMagie: ContexteMagie;
  contextePiege: ContextePiege;
  contexteRecette: ContexteRecette;
  contexteAssemblage: ContexteAssemblage;

  // Scalaires dérivés.
  xpTotal: number;
  xpDepense: number;
  xpDispo: number;
  pvMax: number;
  psMax: number;
  raceInapteMagie: boolean;
  niveauxArtisanat: NiveauxArtisanat;
  quotas: QuotasArtisanat;

  /** Compétences GRATUITES de classe effectivement dérivées (provenance). */
  gratuites: AcquisCompetence[];

  /** Traits raciaux acquis (ordre de choix, provenance gratuit/payant). */
  traitsAcquis: TraitAcquis[];
}

// ============================================================
// Helpers snapshot (lecture pure de données, pas de règle)
// ============================================================

const CLASSES_CONNUES = ["Guerrier", "Voleur", "Mage", "Prêtre"] as const;
type ClasseNom = (typeof CLASSES_CONNUES)[number];

function classeNomDepuisId(classeId: string | null): ClasseNom | null {
  if (!classeId) return null;
  const classe = getSnapshot().tables.classes.find((c) => c.id === classeId);
  const nom = classe?.nom;
  return nom != null && (CLASSES_CONNUES as readonly string[]).includes(nom)
    ? (nom as ClasseNom)
    : null;
}

function getCompetence(id: string): Competence | undefined {
  return getSnapshot().tables.competences.find((c) => c.id === id);
}

/** Coût XP CATALOGUE d'une compétence à un niveau donné = `niveaux[niveau].cout_xp`. */
function coutCompetence(competenceId: string, niveau: number): number {
  const niveaux = getCompetence(competenceId)?.niveaux as
    | Array<{ niveau: number; cout_xp: number }>
    | null
    | undefined;
  const def = niveaux?.find((n) => n && n.niveau === niveau);
  return def?.cout_xp ?? 0;
}

/**
 * Niveaux des items (sorts/prières) DÉJÀ possédés dans un cercle/domaine — la
 * matière du rabais d'« Acquisition de Cercle/Domaine ». Reprend l'assiette de
 * l'aperçu (`clientVisiteur.calculerRabais`) : TOUS les items du brouillon pour
 * ce choix, comptés par le niveau d'instance choisi. Le moteur recompute
 * intégralement à chaque appel — il n'y a pas de grand livre offline —, donc
 * « items déjà acquis au moment de l'achat » = les items présents du choix ;
 * aperçu et débit consomment ainsi exactement le même comptage.
 */
function niveauxItemsRabais(
  b: BrouillonVisiteur,
  typeChoix: "cercle" | "domaine",
  choix: string
): number[] {
  if (typeChoix === "cercle") {
    return b.acquisitions.sorts
      .filter((s) => getSort(s.sortId)?.cercle === choix)
      .map((s) => s.niveauSort);
  }
  return b.acquisitions.prieres
    .filter((p) => getPriere(p.priereId)?.domaine === choix)
    .map((p) => p.niveauPriere);
}

/**
 * Coût XP EFFECTIF d'un achat de compétence par le joueur = coût catalogue,
 * MOINS le rabais « Acquisition de Cercle/Domaine » (niveaux 2/3) porté par
 * `coutApresRabais` (source unique, cf. `moteurCreation/rabais.ts`). C'est le
 * montant que le serveur débite ET stocke dans `xp_depense`.
 *
 * Exporté : le désachat et les lectures d'XP dépensée (badge « Gratuit »)
 * doivent consommer CE coût, pas le coût catalogue, sous peine de rembourser /
 * afficher plus que ce qui a été réellement débité.
 */
export function coutAchatCompetence(
  b: BrouillonVisiteur,
  competenceId: string,
  niveauAcquis: number,
  choixAchat: string | null
): number {
  const base = coutCompetence(competenceId, niveauAcquis);
  const typeChoix = getCompetence(competenceId)?.type_choix;
  if (
    choixAchat != null &&
    (niveauAcquis === 2 || niveauAcquis === 3) &&
    (typeChoix === "cercle" || typeChoix === "domaine")
  ) {
    const seuil = SEUIL_RABAIS_PAR_NIVEAU[niveauAcquis];
    const niveauxItems = niveauxItemsRabais(b, typeChoix, choixAchat);
    return coutApresRabais(base, niveauxItems, seuil);
  }
  return base;
}

interface SortRow {
  id: string;
  cout_xp_base: number | null;
  cercle: string | null;
}
interface PriereRow {
  id: string;
  cout_xp_base: number | null;
  domaine: string | null;
}
interface PiegeRow {
  id: string;
  nom: string | null;
  niveau: number | null;
  cout_xp: number | null;
}
interface RecetteRow {
  id: string;
  niveau_requis: number | null;
  cout_xp: number | null;
}
interface AssemblageRow {
  id: string;
  cout_xp: number | null;
}
interface TraitRacialRow {
  id: string;
  nom: string | null;
  cout_xp: number | null;
}

function getSort(id: string): SortRow | undefined {
  return (getSnapshot().tables.sorts as SortRow[]).find((s) => s.id === id);
}
function getPriere(id: string): PriereRow | undefined {
  return (getSnapshot().tables.prieres as PriereRow[]).find((p) => p.id === id);
}
function getPiege(id: string): PiegeRow | undefined {
  return (getSnapshot().tables.pieges as PiegeRow[]).find((p) => p.id === id);
}
function getRecette(id: string): RecetteRow | undefined {
  return (getSnapshot().tables.recettes_alchimie as RecetteRow[]).find(
    (r) => r.id === id
  );
}
function getAssemblage(id: string): AssemblageRow | undefined {
  return (getSnapshot().tables.assemblages_runes as AssemblageRow[]).find(
    (a) => a.id === id
  );
}
function getTraitRacial(id: string): TraitRacialRow | undefined {
  return (getSnapshot().tables.traits_raciaux as TraitRacialRow[]).find(
    (t) => t.id === id
  );
}

/** `p_traits_raciaux_choisis` est brut (`{ trait_id, … }`) — jamais camelCase. */
function traitId(choix: BrouillonEtape3["traitsRaciauxChoisis"][number]): string {
  return choix.trait_id ?? "";
}

/** Mappe une compétence acquise locale vers la shape `AcquisCompetence` des gates. */
function versAcquisCompetence(c: CompetenceAcquiseLocale): AcquisCompetence {
  const comp = getCompetence(c.competenceId);
  return {
    competenceId: c.competenceId,
    competenceNom: comp?.nom ?? "",
    categorie: comp?.categorie ?? null,
    niveauAcquis: c.niveauAcquis,
    choixAchat: c.choixAchat,
  };
}

// ============================================================
// Dérivation
// ============================================================

export function deriverEtat(b: BrouillonVisiteur): EtatDeriveVisiteur {
  const snapshot = getSnapshot();

  const raceId = b.etape2.raceId || null;
  const classeId = b.etape4.classeId || null;

  // 1) Coûts de la magie (sorts + prières) — via `calculerCoutXP` importée.
  const coutsMagie: number[] = [];
  for (const s of b.acquisitions.sorts) {
    const sort = getSort(s.sortId);
    coutsMagie.push(
      calculerCoutXP(
        s.zoneChoisie,
        s.porteeChoisie,
        s.dureeChoisie,
        s.niveauSort,
        sort?.cout_xp_base ?? 0
      )
    );
  }
  for (const p of b.acquisitions.prieres) {
    const priere = getPriere(p.priereId);
    coutsMagie.push(
      calculerCoutXP(
        p.zoneChoisie,
        p.porteeChoisie,
        p.dureeChoisie,
        p.niveauPriere,
        priere?.cout_xp_base ?? 0
      )
    );
  }

  // 2) État de base = achats PAYANTS de compétences. Le coût effectif inclut le
  //    rabais « Acquisition de Cercle/Domaine » (niv 2/3) — même montant que le
  //    serveur débite et stocke dans `xp_depense`.
  const competencesPayantes: CompetenceAcquiseLocale[] =
    b.acquisitions.competences.map((c) => ({
      competenceId: c.competenceId,
      niveauAcquis: c.niveauAcquis,
      choixAchat: c.choixAchat,
      xpDepense: coutAchatCompetence(
        b,
        c.competenceId,
        c.niveauAcquis,
        c.choixAchat
      ),
    }));

  const base: EtatCreationVisiteur = {
    raceId,
    classeId,
    // s370 — l'inaptitude à la magie vient du trait CHOISI (instance), plus du
    // pool de la race. Lu ICI, à la source brute, parce que `calculerPvMax` /
    // `calculerPsMax` en ont besoin bien avant que `traitsAcquis` (enrichi du
    // nom et de la provenance) ne soit construit plus bas.
    traitsChoisis: b.etape3.traitsRaciauxChoisis.map((c) => ({
      traitId: traitId(c),
    })),
    religionId: b.etape1.religionId,
    estCroyant: b.etape1.estCroyant,
    competencesAcquises: competencesPayantes,
    // Compteurs déclarés étape 1 → comptés dans `xp_total` (annexe A serveur).
    // UNE source : le brouillon ; `calculerXp` applique la formule.
    gnCompletes: b.etape1.gnCompletes,
    miniGnCompletes: b.etape1.miniGnCompletes,
    ouverturesTerrain: b.etape1.ouverturesTerrain,
  };

  // 3) Gratuités de classe : `appliquerGratuites` purge/reconstruit tout seul
  //    (recompute from scratch). Un changement de classe suit automatiquement.
  const { etat: etatAvecGratuites } = appliquerGratuites(
    snapshot,
    base,
    b.etape4.choixParCompetence ?? {}
  );

  const acquis: AcquisCompetence[] =
    etatAvecGratuites.competencesAcquises.map(versAcquisCompetence);

  // 4) Niveaux d'artisanat (dépend des compétences POST-gratuités).
  const niveauxArtisanat = deriverNiveauxArtisanat(acquis);

  // 5) Rejeu ordonné de l'artisanat → estGratuit + coût effectif (quota importé).
  const piegesAcquis: PiegeAcquis[] = [];
  const coutsPieges: number[] = [];
  const gratuitsPiegesParNiveau = new Map<number, number>();
  for (const item of b.acquisitions.pieges) {
    const piege = getPiege(item.piegeId);
    const niveau = piege?.niveau ?? 0;
    const quota = quotaPiegesNiveau(niveauxArtisanat.niveauPieges, niveau);
    const dejaGratuits = gratuitsPiegesParNiveau.get(niveau) ?? 0;
    const estGratuit = dejaGratuits < quota;
    if (estGratuit) gratuitsPiegesParNiveau.set(niveau, dejaGratuits + 1);
    coutsPieges.push(estGratuit ? 0 : piege?.cout_xp ?? 0);
    piegesAcquis.push({
      piegeNom: piege?.nom ?? "",
      niveauAcquis: niveau,
      estGratuit,
    });
  }

  const recettesAcquises: RecetteAcquise[] = [];
  const coutsRecettes: number[] = [];
  const countRecetteParPalier = new Map<number, number>();
  for (const item of b.acquisitions.recettes) {
    const recette = getRecette(item.recetteId);
    const palier = recette?.niveau_requis ?? 0;
    const quota = quotaRecettesPalier(niveauxArtisanat.niveauAlchimie, palier);
    const dejaPalier = countRecetteParPalier.get(palier) ?? 0;
    const estGratuit = dejaPalier < quota;
    countRecetteParPalier.set(palier, dejaPalier + 1);
    coutsRecettes.push(estGratuit ? 0 : recette?.cout_xp ?? 0);
    recettesAcquises.push({ recetteId: item.recetteId, estGratuit });
  }

  const assemblagesAcquis: AssemblageAcquis[] = [];
  const coutsAssemblages: number[] = [];
  const quotaAssemblages = quotaAssemblagesTotal(niveauxArtisanat.niveauRunes);
  b.acquisitions.assemblages.forEach((item, index) => {
    const assemblage = getAssemblage(item.assemblageId);
    const estGratuit = index < quotaAssemblages;
    coutsAssemblages.push(estGratuit ? 0 : assemblage?.cout_xp ?? 0);
    assemblagesAcquis.push({ assemblageId: item.assemblageId, estGratuit });
  });

  // 5bis) Traits raciaux : les N premiers choisis (ordre) sont gratuits
  //       (N = races.nb_traits_raciaux), les suivants coûtent cout_xp.
  //       Source de vérité : sauvegarder_etape_3 (serveur).
  const race = snapshot.tables.races.find((r) => r.id === raceId);
  const nbTraitsGratuits = race?.nb_traits_raciaux ?? 0;
  const traitsAcquis: TraitAcquis[] = [];
  const coutsTraits: number[] = [];
  b.etape3.traitsRaciauxChoisis.forEach((choix, index) => {
    const trait = getTraitRacial(traitId(choix));
    const estGratuit = index < nbTraitsGratuits;
    coutsTraits.push(estGratuit ? 0 : trait?.cout_xp ?? 0);
    traitsAcquis.push({ traitId: traitId(choix), nom: trait?.nom ?? "", estGratuit });
  });

  // 6) XP total / dépensé / dispo — `calculerXp` importée, avec toutes les
  //    dépenses hors compétences dans `autresDepensesXp`.
  const autresDepensesXp = [
    ...coutsMagie,
    ...coutsPieges,
    ...coutsRecettes,
    ...coutsAssemblages,
    ...coutsTraits,
  ];
  const { xpTotal, xpDepense, xpDispo } = calculerXp(snapshot, {
    ...etatAvecGratuites,
    autresDepensesXp,
  });

  // 7) PV / PS / inapte-magie.
  //    ⚠️ s370 : l'INSTANCE décide (trait choisi), pas le modèle de race.
  const pvMax = calculerPvMax(snapshot, etatAvecGratuites);
  const psMax = calculerPsMax(snapshot, etatAvecGratuites);
  const inapteMagie = personnageInapteMagie(
    snapshot,
    etatAvecGratuites.traitsChoisis
  );

  // 8) Contextes des gates (shapes exactes).
  const contextePersonnage: ContextePersonnage = {
    classeNom: classeNomDepuisId(classeId),
    inapteMagie,
    xpDispo,
    psMax,
    competencesAcquises: acquis,
  };
  const contexteMagie: ContexteMagie = {
    xpDispo,
    niveau: calculerNiveau(),
    competencesAcquises: acquis,
    religionId: etatAvecGratuites.religionId ?? null,
  };
  const contextePiege: ContextePiege = {
    xpDispo,
    competencesAcquises: acquis,
    piegesAcquis,
  };
  const contexteRecette: ContexteRecette = {
    xpDispo,
    competencesAcquises: acquis,
    recettesAcquises,
  };
  const contexteAssemblage: ContexteAssemblage = {
    xpDispo,
    competencesAcquises: acquis,
    assemblagesAcquis,
  };

  const quotas: QuotasArtisanat = {
    piegesParNiveau: {
      1: quotaPiegesNiveau(niveauxArtisanat.niveauPieges, 1),
      2: quotaPiegesNiveau(niveauxArtisanat.niveauPieges, 2),
      3: quotaPiegesNiveau(niveauxArtisanat.niveauPieges, 3),
    },
    recettesParPalier: {
      1: quotaRecettesPalier(niveauxArtisanat.niveauAlchimie, 1),
      2: quotaRecettesPalier(niveauxArtisanat.niveauAlchimie, 2),
      3: quotaRecettesPalier(niveauxArtisanat.niveauAlchimie, 3),
    },
    assemblagesTotal: quotaAssemblages,
  };

  // Gratuités = PROVENANCE (flag posé par `appliquerGratuites`), jamais coût 0 :
  // un achat payant à 0 XP (« Acquisition de Sort ») n'est PAS une gratuité.
  const gratuites: AcquisCompetence[] = etatAvecGratuites.competencesAcquises
    .filter((c) => c.estGratuiteClasse === true)
    .map(versAcquisCompetence);

  return {
    contextePersonnage,
    contexteMagie,
    contextePiege,
    contexteRecette,
    contexteAssemblage,
    xpTotal,
    xpDepense,
    xpDispo,
    pvMax,
    psMax,
    raceInapteMagie: inapteMagie,
    niveauxArtisanat,
    quotas,
    gratuites,
    traitsAcquis,
  };
}

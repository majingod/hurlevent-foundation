/**
 * Adaptateur FICHE (HL-RECAP lot 3 s313) — module PUR.
 *
 * Produit, depuis le BROUILLON local + l'état DÉRIVÉ + le SNAPSHOT, des lignes au
 * format EXACT des vues d'affichage serveur consommées par `FichePersonnageView`
 * (`vue_fiche_personnage`, `vue_competences_personnage`, `vue_sorts_personnage`,
 * `vue_prieres_personnage`, `vue_assemblages_personnage`, `vue_artisanat_etat`) +
 * les catalogues de la fiche.
 *
 * Une fonction par forme-vue, entrées EXPLICITES (snapshot / brouillon / état
 * dérivé / ids locaux). Zéro I/O, zéro import React/supabase (seuls des imports de
 * TYPES supabase, effacés au build). SOURCE UNIQUE : les valeurs dérivées (XP,
 * gratuités, niveaux d'artisanat, coûts effectifs) viennent de `deriverEtat` — jamais
 * re-dérivées ici. Les champs calculés magie (`formule_magique`,
 * `duree_incantation_calculee`) passent par les MÊMES helpers que
 * `lirePersonnageSorts`/`lirePersonnagePrieres` (`genererFormuleMagique`,
 * `calculerDureeIncantation`), donc valeurs strictement identiques.
 */

import type { Database, Json } from "@/integrations/supabase/types";
import type { SnapshotVisiteur } from "@/moteurCreation/snapshot";
import { genererFormuleMagique } from "@/moteurCreation/formuleMagique";
import { calculerCoutXP, calculerDureeIncantation } from "@/utils/calculsMagie";
import type { LigneObjetForgeFiche, LigneRecetteFiche } from "@/creation/types";
import type { BrouillonVisiteur } from "./types";
import { coutAchatCompetence, type EtatDeriveVisiteur } from "./deriver";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];
type RowT<K extends keyof Tables> = Tables[K]["Row"];
type RowV<K extends keyof Views> = Views[K]["Row"];

// ============================================================
// Tri façon `.order()` supabase (localeCompare fr / numérique).
// Divergence de collation Postgres ↔ JS sur accents = cosmétique, acceptée (§).
// ============================================================

function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "fr");
}
function trierPar<T>(rows: T[], ...cles: Array<(r: T) => unknown>): T[] {
  return [...rows].sort((x, y) => {
    for (const cle of cles) {
      const d = cmp(cle(x), cle(y));
      if (d !== 0) return d;
    }
    return 0;
  });
}

// ============================================================
// Accès catalogue typés (lecture pure du snapshot ; tables faiblement typées
// projetées sur leur `Row` généré).
// ============================================================

const sortsCat = (s: SnapshotVisiteur) =>
  s.tables.sorts as unknown as RowT<"sorts">[];
const prieresCat = (s: SnapshotVisiteur) =>
  s.tables.prieres as unknown as RowT<"prieres">[];
const assemblagesCat = (s: SnapshotVisiteur) =>
  s.tables.assemblages_runes as unknown as RowT<"assemblages_runes">[];
const recettesCat = (s: SnapshotVisiteur) =>
  s.tables.recettes_alchimie as unknown as RowT<"recettes_alchimie">[];
const piegesCat = (s: SnapshotVisiteur) =>
  s.tables.pieges as unknown as RowT<"pieges">[];
const objetsForgeCat = (s: SnapshotVisiteur) =>
  s.tables.objets_forge as unknown as RowT<"objets_forge">[];
const objetsJoaillerieCat = (s: SnapshotVisiteur) =>
  s.tables.objets_joaillerie as unknown as RowT<"objets_joaillerie">[];

function getSort(s: SnapshotVisiteur, id: string): RowT<"sorts"> | undefined {
  return sortsCat(s).find((x) => x.id === id);
}
function getPriere(s: SnapshotVisiteur, id: string): RowT<"prieres"> | undefined {
  return prieresCat(s).find((x) => x.id === id);
}
function getCompetence(
  s: SnapshotVisiteur,
  id: string,
): RowT<"competences"> | undefined {
  return s.tables.competences.find((c) => c.id === id);
}
function getRace(s: SnapshotVisiteur, id: string | null): RowT<"races"> | undefined {
  return id ? s.tables.races.find((r) => r.id === id) : undefined;
}
function getClasse(
  s: SnapshotVisiteur,
  id: string | null,
): RowT<"classes"> | undefined {
  return id ? s.tables.classes.find((c) => c.id === id) : undefined;
}
function getReligion(
  s: SnapshotVisiteur,
  id: string | null,
): RowT<"religions"> | undefined {
  return id ? s.tables.religions.find((r) => r.id === id) : undefined;
}
function getTrait(
  s: SnapshotVisiteur,
  id: string,
): RowT<"traits_raciaux"> | undefined {
  return s.tables.traits_raciaux.find((t) => t.id === id);
}

/** Entrée `competences.niveaux` (jsonb) à un niveau donné. */
type NiveauDef = {
  niveau: number;
  cout_xp: number;
  description?: string | null;
  description_courte?: string | null;
};
function niveauxDe(comp: RowT<"competences"> | undefined): NiveauDef[] {
  return (comp?.niveaux as NiveauDef[] | null) ?? [];
}

// ============================================================
// vue_fiche_personnage
// ============================================================

/**
 * `vue_fiche_personnage` (`.eq id`, `.single`).
 *  - niveau = 1 + gn_completes (miroir migration 20260706010023, correction 0 hors ligne).
 *  - xp_total/xp_depense/pv_max/ps_max : état DÉRIVÉ (jamais recalculés ici).
 *  - traits_raciaux_choisis : chaque trait acquis (provenance/coût DÉRIVÉS) enrichi
 *    du catalogue `traits_raciaux`, ORDER BY nom.
 *  - LEFT JOIN race/classe/religion : champs `*_nom`/etc. à null si absent.
 */
export function fichePersonnage(
  s: SnapshotVisiteur,
  b: BrouillonVisiteur,
  etat: EtatDeriveVisiteur,
  personnageId: string,
  joueurId: string,
): RowV<"vue_fiche_personnage"> {
  const race = getRace(s, b.etape2.raceId || null);
  const classe = getClasse(s, b.etape4.classeId || null);
  const religion = getReligion(s, b.etape1.religionId);

  const traits = etat.traitsAcquis.map((ta) => {
    const cat = getTrait(s, ta.traitId);
    const coutXp = cat?.cout_xp ?? 0;
    return {
      id: cat?.id ?? ta.traitId,
      nom: cat?.nom ?? ta.nom,
      description: cat?.description ?? null,
      cout_xp: coutXp,
      xp_depense: ta.estGratuit ? 0 : coutXp,
      est_gratuit: ta.estGratuit,
      resume_condense: cat?.resume_condense ?? null,
      texte_manuel: cat?.texte_manuel ?? null,
    };
  });
  const traitsTries = trierPar(traits, (t) => t.nom);

  return {
    id: personnageId,
    nom: b.etape1.nom,
    niveau: 1 + b.etape1.gnCompletes,
    xp_total: etat.xpTotal,
    xp_depense: etat.xpDepense,
    pv_max: etat.pvMax,
    ps_max: etat.psMax,
    historique: b.etape1.historique ?? null,
    ame_personnage: b.etape1.amePersonnage ?? null,
    joueur_id: joueurId,
    race_id: b.etape2.raceId || null,
    classe_id: b.etape4.classeId || null,
    religion_id: b.etape1.religionId,
    gn_completes: b.etape1.gnCompletes,
    mini_gn_completes: b.etape1.miniGnCompletes,
    ouvertures_terrain: b.etape1.ouverturesTerrain,
    traits_raciaux_choisis: traitsTries as unknown as Json,
    est_actif: true,
    est_mort: false,
    race_nom: race?.nom ?? null,
    race_nom_latin: race?.nom_latin ?? null,
    classe_nom: classe?.nom ?? null,
    religion_nom: religion?.nom ?? null,
    race_emoji: race?.emoji ?? null,
    race_description: race?.description ?? null,
    race_esperance_vie: race?.esperance_vie ?? null,
    race_exigences_costume: race?.exigences_costume ?? null,
    race_image_url: race?.image_url ?? null,
    classe_emoji: classe?.emoji ?? null,
    classe_description: classe?.description ?? null,
    classe_role_combat: classe?.role_combat ?? null,
    race_resume_condense: race?.resume_condense ?? null,
    classe_resume_condense: classe?.resume_condense ?? null,
  };
}

// ============================================================
// vue_competences_personnage
// ============================================================

/**
 * `vue_competences_personnage` (`.order categorie/nom`).
 * Deux sources d'identité comme `lirePersonnageCompetences` : achats PAYANTS du
 * brouillon (id = instanceId, `xp_depense` EFFECTIF via `coutAchatCompetence`)
 * puis GRATUITÉS de classe dérivées (id synthétique, `xp_depense` = 0).
 * `statut_maitre` = COALESCE(…, 'non_requis') — le brouillon ne stocke rien.
 * `description_niveau_acquis`/`_courte` extraits de `competences.niveaux` au bon
 * palier ; `niveau_max` = max des niveaux du jsonb.
 */
export function ficheCompetences(
  s: SnapshotVisiteur,
  b: BrouillonVisiteur,
  etat: EtatDeriveVisiteur,
  personnageId: string,
  idGratuite: (competenceId: string, niveau: number, choix: string | null) => string,
): RowV<"vue_competences_personnage">[] {
  const ligne = (
    id: string,
    competenceId: string,
    niveauAcquis: number,
    choixAchat: string | null,
    xpDepense: number,
  ): RowV<"vue_competences_personnage"> => {
    const comp = getCompetence(s, competenceId);
    const niveaux = niveauxDe(comp);
    const def = niveaux.find((n) => n.niveau === niveauAcquis);
    const niveauMax = niveaux.length
      ? Math.max(...niveaux.map((n) => n.niveau))
      : null;
    return {
      id,
      personnage_id: personnageId,
      competence_id: competenceId,
      niveau_acquis: niveauAcquis,
      choix_achat: choixAchat,
      xp_depense: xpDepense,
      appris_via_maitre: false,
      nom_maitre: null,
      statut_maitre: "non_requis",
      nom: comp?.nom ?? null,
      categorie: comp?.categorie ?? null,
      competence_description: comp?.description ?? null,
      competence_resume_condense: comp?.resume_condense ?? null,
      type_achat: comp?.type_achat ?? null,
      niveau_max: niveauMax,
      description_niveau_acquis: def?.description ?? null,
      description_courte_niveau_acquis: def?.description_courte ?? null,
    };
  };

  const payantes = b.acquisitions.competences.map((c) =>
    ligne(
      c.instanceId,
      c.competenceId,
      c.niveauAcquis,
      c.choixAchat,
      coutAchatCompetence(b, c.competenceId, c.niveauAcquis, c.choixAchat),
    ),
  );
  const gratuites = etat.gratuites.map((c) =>
    ligne(
      idGratuite(c.competenceId, c.niveauAcquis, c.choixAchat),
      c.competenceId,
      c.niveauAcquis,
      c.choixAchat,
      0,
    ),
  );
  return trierPar(
    [...payantes, ...gratuites],
    (r) => r.categorie,
    (r) => r.nom,
  );
}

// ============================================================
// vue_sorts_personnage
// ============================================================

/**
 * `vue_sorts_personnage` (`.order cercle/nom_personnalise`). Hors ligne tout acquis
 * est acheté (statut 'achete') → aucun filtre. `formule_magique` via le MÊME
 * `genererFormuleMagique` que `lirePersonnageSorts` (valeurs strictement égales).
 */
export function ficheSorts(
  s: SnapshotVisiteur,
  b: BrouillonVisiteur,
  personnageId: string,
): RowV<"vue_sorts_personnage">[] {
  const rows: RowV<"vue_sorts_personnage">[] = b.acquisitions.sorts.map((sort) => {
    const cat = getSort(s, sort.sortId);
    return {
      id: sort.instanceId,
      personnage_id: personnageId,
      nom_personnalise: sort.nomPersonnalise ?? null,
      formule_magique: genererFormuleMagique(
        cat?.cercle ?? null,
        sort.zoneChoisie,
        sort.porteeChoisie,
        sort.dureeChoisie,
        sort.niveauSort,
      ),
      niveau_sort: sort.niveauSort,
      zone_choisie: sort.zoneChoisie,
      portee_choisie: sort.porteeChoisie,
      duree_choisie: sort.dureeChoisie,
      cercle: cat?.cercle ?? null,
      cout_xp_base: cat?.cout_xp_base ?? null,
      sort_nom_base: cat?.nom ?? null,
      sort_description: cat?.description ?? null,
      paliers: cat?.paliers ?? null,
      description_tronc: cat?.description_tronc ?? null,
      bonus_niveau: cat?.bonus_niveau ?? null,
      effet_instance: cat?.effet_instance ?? null,
      type_sort: cat?.type_sort ?? null,
      sort_resume_condense: cat?.resume_condense ?? null,
    };
  });
  return trierPar(rows, (r) => r.cercle, (r) => r.nom_personnalise);
}

// ============================================================
// vue_prieres_personnage
// ============================================================

/**
 * `vue_prieres_personnage` (`.order domaine/nom_personnalise`).
 * `duree_incantation_calculee` via le MÊME `calculerDureeIncantation` que
 * `lirePersonnagePrieres` (valeurs strictement égales) ; `duree_incantation` =
 * chaîne catalogue.
 */
export function fichePrieres(
  s: SnapshotVisiteur,
  b: BrouillonVisiteur,
  personnageId: string,
): RowV<"vue_prieres_personnage">[] {
  const rows: RowV<"vue_prieres_personnage">[] = b.acquisitions.prieres.map((p) => {
    const cat = getPriere(s, p.priereId);
    return {
      id: p.instanceId,
      personnage_id: personnageId,
      nom_personnalise: p.nomPersonnalise ?? null,
      niveau_priere: p.niveauPriere,
      zone_choisie: p.zoneChoisie,
      portee_choisie: p.porteeChoisie,
      duree_choisie: p.dureeChoisie,
      duree_incantation_calculee: calculerDureeIncantation(
        p.porteeChoisie,
        p.zoneChoisie,
        p.dureeChoisie,
        p.niveauPriere,
      ),
      domaine: cat?.domaine ?? null,
      priere_description: cat?.description ?? null,
      duree_incantation: cat?.duree_incantation ?? null,
      cout_xp_base: cat?.cout_xp_base ?? null,
      paliers: cat?.paliers ?? null,
      description_tronc: cat?.description_tronc ?? null,
      bonus_niveau: cat?.bonus_niveau ?? null,
      effet_instance: cat?.effet_instance ?? null,
      type_priere: cat?.type_priere ?? null,
      priere_resume_condense: cat?.resume_condense ?? null,
    };
  });
  return trierPar(rows, (r) => r.domaine, (r) => r.nom_personnalise);
}

// ============================================================
// vue_assemblages_personnage
// ============================================================

/**
 * `vue_assemblages_personnage` (`.order nom`). `xp_depense` = coût EFFECTIF débité
 * (0 si gratuit) tel que dérivé par le moteur (`contexteAssemblage`).
 */
export function ficheAssemblages(
  s: SnapshotVisiteur,
  b: BrouillonVisiteur,
  etat: EtatDeriveVisiteur,
  personnageId: string,
): RowV<"vue_assemblages_personnage">[] {
  const rows: RowV<"vue_assemblages_personnage">[] =
    etat.contexteAssemblage.assemblagesAcquis.map((a, i) => {
      const cat = assemblagesCat(s).find((x) => x.id === a.assemblageId);
      return {
        id: b.acquisitions.assemblages[i]?.instanceId ?? "",
        personnage_id: personnageId,
        xp_depense: a.estGratuit ? 0 : cat?.cout_xp ?? 0,
        nom: cat?.nom ?? null,
        cible: cat?.cible ?? null,
        cout_ps: cat?.cout_ps ?? null,
        description: cat?.description ?? null,
        effet: cat?.effet ?? null,
        runes_requises: cat?.runes_requises ?? null,
        texte_manuel: cat?.texte_manuel ?? null,
        duree: cat?.duree ?? null,
        effet_maitrise: cat?.effet_maitrise ?? null,
        cout_ps_maitrise: cat?.cout_ps_maitrise ?? null,
        resume_condense: cat?.resume_condense ?? null,
      };
    });
  return trierPar(rows, (r) => r.nom);
}

// ============================================================
// personnage_recettes (fiche) — LigneRecetteFiche brutes, PAS de tri (le composant trie)
// ============================================================

/**
 * `personnage_recettes` + jointure `recettes_alchimie` (Pick 9 colonnes), `.eq
 * personnage_id`. `xp_depense` = coût effectif débité (0 si gratuit).
 * `recettes_alchimie` = null si le catalogue ne contient pas la recette.
 */
export function ficheRecettes(
  s: SnapshotVisiteur,
  b: BrouillonVisiteur,
  etat: EtatDeriveVisiteur,
  personnageId: string,
): LigneRecetteFiche[] {
  return etat.contexteRecette.recettesAcquises.map((r, i) => {
    const cat = recettesCat(s).find((x) => x.id === r.recetteId);
    return {
      id: b.acquisitions.recettes[i]?.instanceId ?? "",
      personnage_id: personnageId,
      xp_depense: r.estGratuit ? 0 : cat?.cout_xp ?? 0,
      recettes_alchimie: cat
        ? {
            nom: cat.nom,
            type: cat.type,
            niveau_requis: cat.niveau_requis,
            description: cat.description,
            effet: cat.effet,
            formule: cat.formule,
            ingredients: cat.ingredients,
            description_verbatim: cat.description_verbatim,
            resume_condense: cat.resume_condense,
          }
        : null,
    };
  });
}

// ============================================================
// vue_artisanat_etat — TOUJOURS l'objet (des 0 si rien), jamais null pour un brouillon
// ============================================================

/**
 * `vue_artisanat_etat` (`.maybeSingle`). Côté serveur le LEFT JOIN produit une
 * ligne de zéros que `maybeSingle` retourne : on renvoie donc toujours l'objet
 * complet (jamais null) pour un brouillon existant.
 */
export function ficheArtisanatEtat(
  etat: EtatDeriveVisiteur,
): Pick<
  RowV<"vue_artisanat_etat">,
  | "niveau_alchimie"
  | "niveau_forge"
  | "niveau_joaillerie"
  | "niveau_pieges"
  | "niveau_runes"
> {
  const na = etat.niveauxArtisanat;
  return {
    niveau_alchimie: na.niveauAlchimie,
    niveau_forge: na.niveauForge,
    niveau_joaillerie: na.niveauJoaillerie,
    niveau_pieges: na.niveauPieges,
    niveau_runes: na.niveauRunes,
  };
}

// ============================================================
// personnage_pieges (fiche) — même contenu que `lirePersonnagePieges`
// ============================================================

/** `personnage_pieges` (`.eq personnage_id`) — parité stricte avec `lirePersonnagePieges`. */
export function fichePieges(
  s: SnapshotVisiteur,
  b: BrouillonVisiteur,
  etat: EtatDeriveVisiteur,
  personnageId: string,
): RowT<"personnage_pieges">[] {
  return etat.contextePiege.piegesAcquis.map((p, i) => {
    const item = b.acquisitions.pieges[i];
    const cat = item ? piegesCat(s).find((x) => x.id === item.piegeId) : undefined;
    return {
      id: item?.instanceId ?? "",
      personnage_id: personnageId,
      piege_id: item?.piegeId ?? "",
      piege_nom: p.piegeNom,
      niveau_acquis: p.niveauAcquis,
      est_gratuit: p.estGratuit,
      xp_depense: p.estGratuit ? 0 : cat?.cout_xp ?? 0,
      date_acquisition: b.meta.creeLe,
      created_at: b.meta.creeLe,
      updated_at: b.meta.modifieLe,
    };
  });
}

// ============================================================
// Catalogues de la fiche (snapshot pur)
// ============================================================

/** `ingredients_alchimiques` (`.lte niveau`, `.order niveau/nom`). */
export function ficheManipulations(
  s: SnapshotVisiteur,
  niveauMax: number,
): Pick<RowT<"ingredients_alchimiques">, "id" | "nom" | "niveau" | "manipulations">[] {
  const rows = (s.tables.ingredients_alchimiques ?? [])
    .filter((ing) => (ing.niveau ?? 0) <= niveauMax)
    .map((ing) => ({
      id: ing.id,
      nom: ing.nom,
      niveau: ing.niveau,
      manipulations: ing.manipulations,
    }));
  return trierPar(rows, (r) => r.niveau, (r) => r.nom);
}

/** `objets_forge` (`.eq est_actif`, jointure `reparations_forge`, `.order temps/nom`). */
export function ficheObjetsForge(s: SnapshotVisiteur): LigneObjetForgeFiche[] {
  const reparations = s.tables.reparations_forge ?? [];
  const rows: LigneObjetForgeFiche[] = objetsForgeCat(s)
    .filter((o) => o.est_actif === true)
    .map((o) => {
      const rep = o.reparation_id
        ? reparations.find((r) => r.id === o.reparation_id)
        : undefined;
      return {
        id: o.id,
        nom: o.nom,
        description: o.description,
        resume_condense: o.resume_condense,
        type: o.type,
        cout_xp: o.cout_xp,
        temps_fabrication_minutes: o.temps_fabrication_minutes,
        materiaux_communs: o.materiaux_communs,
        materiaux_rares: o.materiaux_rares,
        non_reparable: o.non_reparable,
        reparation: rep
          ? {
              nom_affichage: rep.nom_affichage,
              temps_minutes: rep.temps_minutes,
              materiaux: rep.materiaux,
            }
          : null,
      };
    });
  return trierPar(rows, (r) => r.temps_fabrication_minutes, (r) => r.nom);
}

/** `objets_joaillerie` (`.eq est_actif`, `.order temps/nom`). */
export function ficheObjetsJoaillerie(
  s: SnapshotVisiteur,
): Pick<
  RowT<"objets_joaillerie">,
  | "id"
  | "nom"
  | "description"
  | "resume_condense"
  | "effet"
  | "cout_xp"
  | "temps_fabrication_minutes"
  | "temps_rare_minutes"
  | "materiaux_communs"
  | "materiaux_rares"
>[] {
  const rows = objetsJoaillerieCat(s)
    .filter((o) => o.est_actif === true)
    .map((o) => ({
      id: o.id,
      nom: o.nom,
      description: o.description,
      resume_condense: o.resume_condense,
      effet: o.effet,
      cout_xp: o.cout_xp,
      temps_fabrication_minutes: o.temps_fabrication_minutes,
      temps_rare_minutes: o.temps_rare_minutes,
      materiaux_communs: o.materiaux_communs,
      materiaux_rares: o.materiaux_rares,
    }));
  return trierPar(rows, (r) => r.temps_fabrication_minutes, (r) => r.nom);
}

/** `pieges` (`.eq est_actif`, `.lte niveau`, `.order nom/niveau`) — lignes complètes. */
export function fichePiegesCatalogue(
  s: SnapshotVisiteur,
  niveauMax: number,
): RowT<"pieges">[] {
  const rows = piegesCat(s).filter(
    (p) => p.est_actif === true && (p.niveau ?? 0) <= niveauMax,
  );
  return trierPar(rows, (r) => r.nom, (r) => r.niveau);
}

/** `langues` (id/nom, sans filtre). */
export function ficheLangues(
  s: SnapshotVisiteur,
): Pick<RowT<"langues">, "id" | "nom">[] {
  return s.tables.langues.map((l) => ({ id: l.id, nom: l.nom }));
}

/** `religions` (12 colonnes fiche, sans filtre). */
export function ficheReligions(
  s: SnapshotVisiteur,
): Pick<
  RowT<"religions">,
  | "id"
  | "nom"
  | "dirigeant"
  | "fondateur"
  | "symbole_sacre"
  | "pouvoir_symbole"
  | "domaines_principaux"
  | "domaines_proscrits"
  | "lore_fiche"
  | "rituels_fiche"
  | "lore_manuel"
  | "rituels_manuel"
>[] {
  return s.tables.religions.map((r) => ({
    id: r.id,
    nom: r.nom,
    dirigeant: r.dirigeant,
    fondateur: r.fondateur,
    symbole_sacre: r.symbole_sacre,
    pouvoir_symbole: r.pouvoir_symbole,
    domaines_principaux: r.domaines_principaux,
    domaines_proscrits: r.domaines_proscrits,
    lore_fiche: r.lore_fiche,
    rituels_fiche: r.rituels_fiche,
    lore_manuel: r.lore_manuel,
    rituels_manuel: r.rituels_manuel,
  }));
}

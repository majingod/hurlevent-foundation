/**
 * Loader typé du snapshot visiteur + helpers pour gatesCompetences
 */

import snapshotJsonImporte from "@/data/snapshotVisiteur.json";
import type {
  Database,
} from "@/integrations/supabase/types";

export type Competence = Database["public"]["Tables"]["competences"]["Row"];
export type Classe = Database["public"]["Tables"]["classes"]["Row"];
export type Race = Database["public"]["Tables"]["races"]["Row"];
export type RaceTrait = Database["public"]["Tables"]["race_traits"]["Row"];
export type TraitRacial = Database["public"]["Tables"]["traits_raciaux"]["Row"];
export type Religion = Database["public"]["Tables"]["religions"]["Row"];
export type Langue = Database["public"]["Tables"]["langues"]["Row"];
export type FamilleCriminelle = Database["public"]["Tables"]["familles_criminelles"]["Row"];
export type ReparationForge = Database["public"]["Tables"]["reparations_forge"]["Row"];
export type IngredientAlchimique = Database["public"]["Tables"]["ingredients_alchimiques"]["Row"];
export type ObjetGenerateur = Database["public"]["Tables"]["objets_generateur"]["Row"];
export type ObjetRequis = Database["public"]["Tables"]["objets_requis"]["Row"];
export type SectionRegle = Database["public"]["Tables"]["sections_regles"]["Row"];
export type EffetCombat = Database["public"]["Tables"]["effets_combat"]["Row"];
export type Creature = Database["public"]["Tables"]["bestiaire"]["Row"];
export type Lore = Database["public"]["Tables"]["lore"]["Row"];
export type FicheSchema = Database["public"]["Tables"]["fiches_schemas"]["Row"];
export type FicheListe = Database["public"]["Tables"]["fiches_listes"]["Row"];
export type CompetenceEncyclopedie = Database["public"]["Views"]["vue_competences_encyclopedie"]["Row"];

/**
 * Forme structurelle du snapshot visiteur offline chargé depuis
 * `@/data/snapshotVisiteur.json`. Seules les tables réellement consommées par
 * le moteur de création sont typées fortement ; le reste reste ouvert.
 */
export interface SnapshotVisiteur {
  manifest: {
    genere_le: string;
    comptes: Record<string, number>;
  };
  tables: {
    races: Race[];
    race_traits: RaceTrait[];
    traits_raciaux: TraitRacial[];
    classes: Classe[];
    competences: Competence[];
    religions: Religion[];
    langues: Langue[];
    // [s366] Choix tirés des achats du générateur (versBrouillon) —
    // optionnelle : le convertisseur lève bruyamment si absente.
    familles_criminelles?: FamilleCriminelle[];
    reparations_forge: ReparationForge[];
    ingredients_alchimiques: IngredientAlchimique[];
    // Lot 0 générateur (s347) : carte équipement ↔ compétences/races —
    // optionnelles tant que le JSON committé n'a pas été régénéré.
    objets_generateur?: ObjetGenerateur[];
    objets_requis?: ObjetRequis[];
    // Extension hors-ligne (lot A0, s312) : optionnelles tant que le JSON
    // committé reste en 18 clés — présentes dès qu'un prebuild/refresh
    // régénère le snapshot à 25 clés.
    sections_regles?: SectionRegle[];
    effets_combat?: EffetCombat[];
    bestiaire?: Creature[];
    lore?: Lore[];
    fiches_schemas?: FicheSchema[];
    fiches_listes?: FicheListe[];
    vue_competences_encyclopedie?: CompetenceEncyclopedie[];
    [table: string]: unknown[] | undefined;
  };
}

/**
 * Source active du snapshot visiteur, résolue à CHAQUE accès.
 *
 * Par défaut : le JSON bundlé au build (prebuild A0 — `snapshotJsonImporte`).
 * En cible hors-ligne, le lot A5 injectera des « données fraîches » au moment
 * du téléchargement en remplaçant un marqueur du HTML par
 * `window.__SNAPSHOT_HORS_LIGNE__ = {…}` (script exécuté AVANT le point
 * d'entrée). Sans marqueur rempli, `__SNAPSHOT_HORS_LIGNE__` est absent et le
 * snapshot bundlé sert tel quel.
 *
 * Résolu à l'appel (et non capturé au chargement du module) pour que l'override
 * soit honoré quel que soit l'ordre d'exécution — et testable (poser puis
 * retirer le global entre deux appels).
 */
function snapshotActif(): typeof snapshotJsonImporte {
  return (
    (globalThis as { __SNAPSHOT_HORS_LIGNE__?: typeof snapshotJsonImporte })
      .__SNAPSHOT_HORS_LIGNE__ ?? snapshotJsonImporte
  );
}

export function getCompetence(id: string): Competence | undefined {
  // ⚠️ DOUBLE ASSERTION VOULUE ([SNAPSHOT-COMMIT-STUB], élargi s370).
  // Le JSON COMMITTÉ est un instantané DATÉ : il a été capturé avant la
  // colonne `competences.exige_ps` (s369) et ne la porte donc pas, alors que
  // le type généré l'exige. Le snapshot SERVI est régénéré au build par
  // `scripts/snapshot-visiteur.mjs` (RPC `snapshot_visiteur`, qui fait
  // `to_jsonb(x)` sur la ligne entière) — mesuré le 2026-07-30 : 91/91 lignes
  // portent la clé, 14 à `true`. La forme du build fait donc autorité.
  //
  // CONSÉQUENCE À CONNAÎTRE, pas un détail : tant que le JSON committé n'est
  // pas recapturé, `exige_ps` vaut `undefined` en DEV et dans tout test qui
  // lit le singleton — la garde d'inaptitude y est donc INERTE (elle échoue
  // « ouvert », comme avant s369, jamais en erreur). Les tests de garde
  // injectent pour cette raison un snapshot via `__SNAPSHOT_HORS_LIGNE__`.
  const competences = snapshotActif().tables
    .competences as unknown as Competence[];
  return competences.find((c) => c.id === id);
}

export function getLangueNom(id: string): string | undefined {
  const langues = snapshotActif().tables.langues as Langue[];
  const langue = langues.find((l) => l.id === id);
  return langue?.nom ?? undefined;
}

export function getReligionNom(id: string): string | undefined {
  const religions = snapshotActif().tables.religions as Religion[];
  const religion = religions.find((r) => r.id === id);
  return religion?.nom ?? undefined;
}

/**
 * Getter du snapshot complet pour les tests et usage interne.
 *
 * NB : le JSON importé a un type littéral inféré ; on le projette sur
 * `SnapshotVisiteur` (le contenu correspond à cette forme à l'exécution).
 */
export function getSnapshot(): SnapshotVisiteur {
  return snapshotActif() as unknown as SnapshotVisiteur;
}

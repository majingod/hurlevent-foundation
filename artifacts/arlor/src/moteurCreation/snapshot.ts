/**
 * Loader typé du snapshot visiteur + helpers pour gatesCompetences
 */

import snapshot from "@/data/snapshotVisiteur.json";
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
export type ReparationForge = Database["public"]["Tables"]["reparations_forge"]["Row"];
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
    reparations_forge: ReparationForge[];
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

export function getCompetence(id: string): Competence | undefined {
  const competences = snapshot.tables.competences as Competence[];
  return competences.find((c) => c.id === id);
}

export function getLangueNom(id: string): string | undefined {
  const langues = snapshot.tables.langues as Langue[];
  const langue = langues.find((l) => l.id === id);
  return langue?.nom ?? undefined;
}

export function getReligionNom(id: string): string | undefined {
  const religions = snapshot.tables.religions as Religion[];
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
  return snapshot as unknown as SnapshotVisiteur;
}

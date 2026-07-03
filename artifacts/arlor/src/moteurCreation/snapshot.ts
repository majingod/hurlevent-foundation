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
 * Détermine si une race possède le trait « Inapte à la magie »
 * Jointure race_traits × traits_raciaux : nom === "Inapte à la magie" ET est_actif
 */
export function raceEstInapteMagie(raceId: string): boolean {
  const raceTraits = snapshot.tables.race_traits as RaceTrait[];
  const traitsRaciaux = snapshot.tables.traits_raciaux as TraitRacial[];

  // Récupérer tous les traits actifs de cette race
  const traitsActifs = raceTraits
    .filter((rt) => rt.race_id === raceId)
    .map((rt) => {
      const traitRacial = traitsRaciaux.find((t) => t.id === rt.trait_id);
      return traitRacial;
    })
    .filter((t): t is TraitRacial => t != null && t.est_actif === true);

  // Vérifier s'il existe un trait nommé « Inapte à la magie »
  return traitsActifs.some((t) => t.nom === "Inapte à la magie");
}

/**
 * Getter du snapshot complet pour les tests et usage interne
 */
export function getSnapshot() {
  return snapshot;
}

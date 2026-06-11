import type { Database, Json } from "@/integrations/supabase/types";
import type { PalierSort, EffetInstance, BonusNiveau } from "@/utils/calculsMagie";

// ── Interfaces alignées sur les vues SQL ──────────────────────
// Partagées entre FichePersonnageView (parent) et les briques sections/*.
// Extraites du parent en s80 (PR-1 fiche briques) — aucune modification de forme.

export interface FichePersonnage {
  id: string;
  nom: string;
  niveau: number;
  xp_total: number;
  xp_depense: number;
  pv_max: number;
  ps_max: number;
  historique: string | null;
  ame_personnage: string | null;
  joueur_id: string;
  race_id: string;
  classe_id: string;
  religion_id: string | null;
  gn_completes: number;
  mini_gn_completes: number;
  ouvertures_terrain: number;
  traits_raciaux_choisis: Json | null;
  race_nom: string | null;
  race_nom_latin: string | null;
  race_emoji: string | null;
  race_description: string | null;
  race_description_courte: string | null;
  race_esperance_vie: string | null;
  race_exigences_costume: string | null;
  race_image_url: string | null;
  classe_nom: string | null;
  classe_emoji: string | null;
  classe_description: string | null;
  classe_description_courte: string | null;
  classe_role_combat: string | null;
  religion_nom: string | null;
}

export interface Trait {
  id: string;
  nom: string;
  description: string | null;
}

export interface Competence {
  id: string;
  personnage_id: string;
  competence_id: string;
  nom: string;
  niveau_acquis: number;
  niveau_max: number;
  xp_depense: number;
  choix_achat: string | null;
  appris_via_maitre: boolean;
  nom_maitre: string | null;
  statut_maitre: string;
  categorie: string;
  type_achat: string;
  competence_description: string | null;
  description_niveau_acquis: string | null;
}

// Regroupement des rows d'une compétence par competence_id (cf. useMemo
// competencesGroupees du parent). Partagé avec CompetencesSection.
export interface CompetenceGroupee {
  competence_id: string;
  nom: string;
  categorie: string;
  type_achat: string;
  niveau_max_competence: number;
  competence_description: string | null;
  statut_maitre: string;
  xp_total: number;
  rows: Competence[];
}

export interface Sort {
  id: string;
  personnage_id: string;
  nom_personnalise: string;
  formule_magique: string | null;
  niveau_sort: number;
  zone_choisie: string | null;
  portee_choisie: string | null;
  duree_choisie: string | null;
  cercle: string;
  cout_xp_base: number;
  sort_nom_base: string | null;
  sort_description: string | null;
  sort_description_courte: string | null;
  paliers?: PalierSort[] | null;
  effet_instance?: EffetInstance | null;
  type_sort?: string | null;
  bonus_niveau?: BonusNiveau | null;
}

export interface Priere {
  id: string;
  personnage_id: string;
  nom_personnalise: string;
  niveau_priere: number;
  zone_choisie: string | null;
  portee_choisie: string | null;
  duree_choisie: string | null;
  domaine: string;
  priere_description: string | null;
  priere_description_courte: string | null;
  duree_incantation: string | null;
  duree_incantation_calculee: number | null;
  cout_xp_base: number | null;
  paliers?: PalierSort[] | null;
  effet_instance?: EffetInstance | null;
  type_priere?: string | null;
  bonus_niveau?: BonusNiveau | null;
}

export interface Assemblage {
  id: string;
  personnage_id: string;
  nom: string;
  cible: string | null;
  cout_ps: number | null;
  xp_depense: number;
  description: string | null;
  effet: string | null;
  runes_requises: string[] | null;
  texte_manuel: string | null;
}

export interface Recette {
  id: string;
  personnage_id: string;
  nom: string;
  type: string;
  niveau_requis: number;
  xp_depense: number;
  description: string | null;
  effet: string | null;
  formule: string | null;
  ingredients: Json | null;
  description_verbatim: string | null;
}

export interface ArtisanatEtat {
  niveau_alchimie: number | null;
  niveau_forge: number | null;
  niveau_joaillerie: number | null;
  niveau_pieges: number | null;
}

export interface ManipulationAlchimique {
  id: string;
  nom: string | null;
  niveau: number | null;
  manipulations: string | null;
}

export interface ObjetForge {
  id: string;
  nom: string | null;
  description: string | null;
  type: string | null;
  cout_xp: number | null;
  temps_fabrication_minutes: number | null;
  materiaux_communs: string | null;
  materiaux_rares: string | null;
}

export interface ReparationForge {
  id: string;
  nom_affichage: string;
  categorie: string;
  materiaux: string;
  materiaux_rares: string;
  temps_minutes: number;
  temps_rare_minutes: number;
  notes: string | null;
}

export interface ObjetJoaillerie {
  id: string;
  nom: string | null;
  description: string | null;
  effet: string | null;
  cout_xp: number | null;
  temps_fabrication_minutes: number | null;
  temps_rare_minutes: number | null;
  materiaux_communs: string | null;
  materiaux_rares: string | null;
}

// Lignes brutes des tables pièges (lecture seule, miroir wizard étape 9).
// Partagées entre le parent (queries) et PiegesSection.
export type PiegeRow = Database["public"]["Tables"]["pieges"]["Row"];
export type PersonnagePiegeRow = Database["public"]["Tables"]["personnage_pieges"]["Row"];

// ============================================================
// MAPPINGS LABELS — Hurlevent
// Valeurs brutes DB → labels affichés dans l'interface
// Utilisé par : A2, A3, 08, 09, 10, 11a, 11b
// ============================================================

// --- Événements ---

export const TYPE_EVENEMENT_LABELS: Record<string, string> = {
  mini_gn:           "Mini GN",
  gn_regulier:       "GN Régulier",
  entretien_terrain: "Entretien du Terrain",
};

// --- Inscriptions événements ---

export const STATUT_INSCRIPTION_LABELS: Record<string, string> = {
  en_attente: "En attente",
  present:    "Présence confirmée",
  absent:     "Absent",
  annule:     "Annulée",
};

// --- Alchimie ---

export const NIVEAU_ALCHIMIE_LABELS: Record<number, string> = {
  1: "Mineur",
  2: "Intermédiaire",
  3: "Majeur",
};

export const TYPE_RECETTE_LABELS: Record<string, string> = {
  potion: "Potion",
  poison: "Poison",
  autre:  "Autre",
};

// --- Compétences (statut maître) ---

export const STATUT_MAITRE_LABELS: Record<string, string> = {
  non_requis: "Aucun maître requis",
  en_attente: "En attente d'approbation",
  approuve:   "Approuvé",
  refuse:     "Refusé — contacter l'organisation",
};

// --- Bestiaire ---

export const CATEGORIE_BESTIAIRE_LABELS: Record<string, string> = {
  mort_vivant: "Mort-Vivant",
};

// --- Sections règles ---

export const CATEGORIE_SECTIONS_REGLES_LABELS: Record<string, string> = {
  generaux:      "Règles générales",
  objets_enjeu:  "Règles en jeu",
  combat:        "Combat & Équipement",
  magie:         "Règles de magie",
  creation_sorts:"Construction des sorts",
  artisanat:     "Artisanat & Créations",
};

// --- Pièges ---

export const TYPE_PIEGE_LABELS: Record<string, string> = {
  physique: "Physique",
  magique:  "Magique",
};

// --- Réparations forge ---

export const CATEGORIE_REPARATION_LABELS: Record<string, string> = {
  arme:    "Armes",
  armure:  "Armures",
  bouclier:"Boucliers",
};

// --- Statut personnage ---

export const STATUT_PERSONNAGE_LABELS = {
  actif:   "Actif",
  inactif: "Inactif",
  decede:  "Décédé",
} as const;

// ============================================================
// AJOUTS 2026-04-17
// ============================================================

// ------------------------------------------------------------
// STATUT MAÎTRE — personnage_competences.statut_maitre
// ------------------------------------------------------------

export const STATUT_MAITRE_LABELS: Record<string, string> = {
  non_requis:  "Sans maître",
  en_attente:  "En attente d'approbation",
  approuve:    "Approuvé",
  refuse:      "Refusé",
};

// ------------------------------------------------------------
// STATUT INSCRIPTION — inscriptions_evenements.statut
// ------------------------------------------------------------

export const STATUT_INSCRIPTION_LABELS: Record<string, string> = {
  en_attente:  "En attente",
  present:     "Présence confirmée",
  absent:      "Absent",
  annule:      "Annulée",
};

// ------------------------------------------------------------
// CATÉGORIE RÉPARATION — reparations_forge.categorie
// ------------------------------------------------------------

export const CATEGORIE_REPARATION_LABELS: Record<string, string> = {
  arme:     "Armes",
  armure:   "Armures",
  bouclier: "Boucliers",
};

// ------------------------------------------------------------
// CATÉGORIE BESTIAIRE — bestiaire.categorie
// ------------------------------------------------------------

export const CATEGORIE_BESTIAIRE_LABELS: Record<string, string> = {
  mort_vivant: "Mort-Vivant",
};

// ------------------------------------------------------------
// CATÉGORIE LORE — lore.categorie
// ------------------------------------------------------------

export const CATEGORIE_LORE_LABELS: Record<string, string> = {
  region:   "Région",
  cite:     "Cité",
  histoire: "Histoire",
};

// ------------------------------------------------------------
// NIVEAU PIÈGE — pieges.niveau
// ------------------------------------------------------------

export const NIVEAU_PIEGE_LABELS: Record<number, string> = {
  1: "Niveau 1",
  2: "Niveau 2",
  3: "Niveau 3",
};

// ------------------------------------------------------------
// TYPE PIÈGE — pieges.type_piege
// ------------------------------------------------------------

export const TYPE_PIEGE_LABELS: Record<string, string> = {
  physique: "Physique",
  magique:  "Magique",
};

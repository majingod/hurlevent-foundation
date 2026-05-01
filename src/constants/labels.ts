// ============================================================
// MAPPINGS LABELS — Hurlevent
// Valeurs brutes DB → labels affichés dans l'interface
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
  non_requis: "Sans maître",
  en_attente: "En attente d'approbation",
  approuve:   "Approuvé",
  refuse:     "Refusé",
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

export const NIVEAU_PIEGE_LABELS: Record<number, string> = {
  1: "Niveau 1",
  2: "Niveau 2",
  3: "Niveau 3",
};

// --- Réparations forge ---

export const CATEGORIE_REPARATION_LABELS: Record<string, string> = {
  arme:     "Armes",
  armure:   "Armures",
  bouclier: "Boucliers",
};

// --- Lore ---

export const CATEGORIE_LORE_LABELS: Record<string, string> = {
  region:   "Région",
  cite:     "Cité",
  histoire: "Histoire",
};

// --- Statut personnage ---

export const STATUT_PERSONNAGE_LABELS = {
  actif:   "Actif",
  inactif: "Inactif",
  decede:  "Décédé",
} as const;

// --- Race Icons & Emojis ---

export const RACE_ICONS = {
  COSTUME_REQUIS: '🎭',
  ESPERANCE_VIE: '⏳',
  XP_DEPART: '⭐',
} as const;

/**
 * Mapping des Emojis par UUID de Race
 * Utilise les UUIDs officiels de la base de données Supabase
 */
export const RACE_EMOJI_MAP: Record<string, string> = {
  '926b6948-e192-4d41-9909-efabaa3059b5': '🐾', // Chiméride
  'f6fb2d30-23d9-4c80-b7f5-ad495c1b222f': '⚔️', // Demi-Elfe
  '824bd609-1ae4-436a-88b2-d74883377bae': '💪', // Demi-Orc
  '963cc1f8-0b27-4a88-aa68-74d4af4ec153': '🌙', // Drow
  'fd1f6125-d2bc-4be8-ac0c-426196a1eb43': '✨', // Fée
  'e6fa1198-4acf-4854-bdc1-2174ecd3d6d4': '🎭', // Gobelin
  'd9cfea0e-acbb-4f02-9eaa-12efa6fbf9b9': '👑', // Haut-Elfe
  '561534b1-0375-41ce-b318-7a0e29a9d2b3': '👤', // Humain
  '491495ec-e48f-48a5-b8ca-3798015bc336': '⛏️', // Myrvalk
  '91181212-4a6d-4d59-b668-808f32dc46be': '🗡️', // Orc
  '4d7e2226-76cb-4b94-9df4-b8f12ff486e1': '❓', // Les Non-Races
} as const;

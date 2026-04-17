// ============================================================
// HURLEVENT — Constantes d'artisanat
// Importé dans : étapes 7-8 du créateur, fiche personnage,
//                encyclopédie (forge/joaillerie/pièges)
// ============================================================

// ------------------------------------------------------------
// QUOTAS GRATUITS CUMULATIFS
// ------------------------------------------------------------

/** Total de recettes gratuites selon le niveau d'alchimie */
export const QUOTA_RECETTES_TOTAL: Record<number, number> = {
  0: 0,
  1: 5,
  2: 9,
  3: 12,
};

/** Total d'assemblages gratuits selon le niveau de runes */
export const QUOTA_ASSEMBLAGES_TOTAL: Record<number, number> = {
  0: 0,
  1: 2,
  2: 4,
  3: 5,
};

/** Coût XP d'une recette supplémentaire */
export const COUT_RECETTE_SUPPLEMENTAIRE = 3;

/** Coût XP d'un assemblage supplémentaire */
export const COUT_ASSEMBLAGE_SUPPLEMENTAIRE = 4;

// ------------------------------------------------------------
// NOTES D'ACCÈS PAR NIVEAU — FORGE
// ------------------------------------------------------------

export const NOTE_FORGE: Record<number, string> = {
  1: "Vous pouvez fabriquer ces objets avec des métaux communs.",
  2: "Vous pouvez fabriquer ces objets avec des métaux communs et rares.",
  3: "Vous pouvez fabriquer ces objets avec des métaux communs et rares.",
};

// ------------------------------------------------------------
// NOTES D'ACCÈS PAR NIVEAU — JOAILLERIE
// ------------------------------------------------------------

export const NOTE_JOAILLERIE: Record<number, string> = {
  1: "Vous pouvez créer ces pièces avec des matériaux communs.",
  2: "Vous pouvez créer ces pièces avec des matériaux communs et rares.",
  3: "Vous pouvez créer ces pièces avec des matériaux communs et rares.",
};

// ------------------------------------------------------------
// DROITS LÉGENDAIRES
// ------------------------------------------------------------

export const LEGENDE_FORGE_DISPO =
  "⚜ Droit légendaire disponible — Vous pouvez forger UN objet légendaire (artefact) dans la vie de votre personnage, avec des métaux légendaires.";

export const LEGENDE_FORGE_UTILISE = "⚜ Droit légendaire utilisé";

export const LEGENDE_JOAILLERIE_DISPO =
  "⚜ Droit légendaire disponible — Vous pouvez créer UNE pièce légendaire (artefact) dans la vie de votre personnage, avec des matériaux légendaires.";

export const LEGENDE_JOAILLERIE_UTILISE = "⚜ Droit légendaire utilisé";

export const CONFIRM_LEGENDE_FORGE =
  "Cette action est irréversible. Êtes-vous certain de vouloir utiliser votre unique droit à l'objet légendaire ?";

export const CONFIRM_LEGENDE_JOAILLERIE =
  "Cette action est irréversible. Êtes-vous certain de vouloir utiliser votre unique droit à la pièce légendaire ?";

// ------------------------------------------------------------
// DESCRIPTIONS DES TYPES D'OBJETS FORGE (Correction 6)
// Clé = valeur exacte de objets_forge.type
// ------------------------------------------------------------

export const TYPE_OBJET_FORGE_LABELS: Record<string, string> = {
  "Arme de jet":            "Projectile 30 cm ou moins",
  "Arme légère":            "45 cm ou moins",
  "Arme moyenne":           "45 à 80 cm",
  "Arme longue / bâtarde":  "80 à 110 cm",
  "Arme à deux mains":      "110 à 160 cm — Guerrier seulement",
  "Arme d'hast et bâton":   "200 cm ou moins",
  "Petit bouclier":         "Bouclier 40 cm ou moins",
  "Bouclier moyen":         "Bouclier 40 à 60 cm",
  "Grand bouclier":         "Bouclier plus de 60 cm",
};

// ------------------------------------------------------------
// LABELS DES STATS JSONB — FORGE (Correction 6)
// Clé = nom de la propriété dans objets_forge.stats
// ------------------------------------------------------------

export const STATS_FORGE_LABELS: Record<string, string> = {
  degats:      "Dégâts",
  taille_max:  "Taille maximale",
  taille_min:  "Taille minimale",
  protection:  "Protection",
};

// ------------------------------------------------------------
// LÉGENDE DES SYMBOLES DE CONSTRUCTION — PIÈGES (Correction 8)
// ------------------------------------------------------------

export const LEGENDE_CONSTRUCTION_PIEGES =
  "(---) = ingrédient réutilisable   |   (===) = ingrédient consommé après usage";

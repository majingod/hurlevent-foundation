/**
 * Encyclopédie — mapping catégorie → table source (source unique de vérité).
 *
 * Utilisé par le contrat `ClientCreation` (lireCatalogueEncyclopedie) côté
 * serveur ET visiteur. `Encyclopedie.tsx` porte encore sa copie locale
 * jusqu'au Lot 2 (reroutage clientActif), qui la supprimera.
 */

export const TABLE_SOURCE_ENCYCLOPEDIE = {
  race: "races",
  trait_racial: "traits_raciaux",
  classe: "classes",
  competences: "vue_competences_encyclopedie",
  assemblages: "assemblages_runes",
  alchimie: "recettes_alchimie",
  sorts: "sorts",
  prieres: "prieres",
  religions: "religions",
  bestiaire: "bestiaire",
  lore: "lore",
  forge: "objets_forge",
  joaillerie: "objets_joaillerie",
  pieges: "pieges",
} as const;

export type CategorieEncyclopedie = keyof typeof TABLE_SOURCE_ENCYCLOPEDIE;

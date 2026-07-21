/**
 * [VIS-8 lot 1] Interrupteur du générateur de personnage.
 *
 * ÉTEINT tant que le résolveur (lot suivant) n'est pas livré : l'accueil des
 * portes et les écrans de constats sont mergés et testés, mais jamais rendus
 * — décision Fred s348 (« on n'expose rien tant que 🧭/🎲 ne mènent pas au
 * bout », à 10 jours du GN). L'allumage = passer ce booléen à `true`, rien
 * d'autre ; il se fera avec le lot résolveur, accompagné d'un jalon
 * « Nouveautés ».
 */
export const GENERATEUR_ACTIF = false;

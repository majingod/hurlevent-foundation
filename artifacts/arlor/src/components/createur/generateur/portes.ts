/**
 * [VIS-8 lot 1] Métadonnées des portes d'entrée du générateur.
 *
 * Vocabulaire = CONTRAT de la maquette validée par Fred (s346) — ne pas
 * reformuler sans re-valider (Workflow v38).
 *
 * 🃏 « Pige ta main » est volontairement ABSENTE (décision Fred s348 :
 * masquée, pas « bientôt » — elle arrive après le GN et sa sortie fera une
 * annonce Nouveautés). L'ajouter le moment venu = une entrée ici + son
 * branchement dans `Generateur`.
 *
 * 🎲 tire DIRECT (contrat s346, re-confirmé Fred s348) : pas d'écran de
 * constats avant le tirage — il lit l'équipement déjà coché via « 🎒 Mon
 * équipement », mains nues sinon.
 */

export type PorteId = "batir" | "guide" | "tirage";

export interface PorteGenerateur {
  id: PorteId;
  emoji: string;
  titre: string;
  description: string;
}

export const PORTES: readonly PorteGenerateur[] = [
  {
    id: "batir",
    emoji: "🛠️",
    titre: "Je bâtis moi-même",
    description: "Le créateur complet, étape par étape. Tu contrôles tout.",
  },
  {
    id: "guide",
    emoji: "🧭",
    titre: "Guide-moi",
    description:
      "Quelques questions sur toi, ton équipement, ta place au village — et un personnage qui te ressemble.",
  },
  {
    id: "tirage",
    emoji: "🎲",
    titre: "Surprends-moi",
    description: "Un clic, un personnage jouable. Relance tant que tu veux.",
  },
] as const;

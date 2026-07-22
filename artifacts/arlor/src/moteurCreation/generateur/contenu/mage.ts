import type { ConfigMagie } from "../types";
import {
  comp,
  FILET_CASTER,
  rachat,
  sort,
  type ContenuClasse,
  type EntreePool,
  type RoleClasse,
} from "./commun";

/**
 * [VIS-8 lot 2b] Contenu MAGE (§4.4, §4.5). La question du 🔥 est
 * « ton élément ? » (§2.13) : elle résout les DEUX créneaux du noyau
 * (le sort de dégâts + le bouclier du même cercle). Politique s349 :
 * dégâts à 10 pieds (pendant le combat), bouclier AU TOUCHER (posé avant).
 */

export const CLASSE_MAGE = "mage" as const;

export const GRATUITES_MAGE = [
  "Linguistique et Mathématique",
  "Décryptage",
] as const;

/** Les 7 paires (mesurées s349, intégrité attestée contre la fixture). */
export const PAIRES_ELEMENTS: Record<
  string,
  { degats: string; bouclier: string }
> = {
  Air: { degats: "Rayon Électrique", bouclier: "Bouclier de Vent" },
  Eau: { degats: "Projectile de glace", bouclier: "Bouclier de Glace" },
  Feu: { degats: "Jet de flammes", bouclier: "Bouclier de Feu" },
  "Magie Noire": {
    degats: "Rayon d'Énergie Négative",
    bouclier: "Bouclier contre l'Énergie négative",
  },
  "Magie Pure": { degats: "Projectile Magique", bouclier: "Bouclier Magique" },
  Nécromancie: {
    degats: "Destruction des Morts-Vivants",
    bouclier: "Bouclier Contre la Mort",
  },
  Terre: { degats: "Rayon d'Acide", bouclier: "Bouclier de Terre" },
};

export const ELEMENTS = Object.keys(PAIRES_ELEMENTS);

/** Durée voulue des boucliers : 30 minutes — plafonnée par le modèle pour
 *  Magie Pure (max 10 Minutes en base ; dérivation attestée par test). */
export const dureeBouclier = (element: string): string =>
  element === "Magie Pure" ? "10 Minutes" : "30 Minutes";

const DEGATS_N6: Omit<ConfigMagie, "niveau"> = {
  zone: "1 Cible",
  portee: "10 Pieds",
  duree: "Instantanée",
};

/** Le 2ᵉ élément d'un ③/④ : le premier de la liste qui n'est pas déjà le sien. */
export const autreElement = (element: string | undefined): string =>
  ELEMENTS.find((e) => e !== element) ?? "Feu";

const ROLES_MAGE: readonly RoleClasse[] = [
  {
    id: "mBrule",
    emoji: "🔥",
    titre: "Celui qui brûle",
    phrase: "Ton élément frappe à distance et protège les tiens.",
    requiert: (_inv, o) =>
      o.element && PAIRES_ELEMENTS[o.element]
        ? null
        : "Choisis d'abord ton élément — c'est LA question du rôle : Feu, Eau, Air, Terre, Magie Pure, Magie Noire ou Nécromancie.",
    noyau: (_inv, o) => {
      const paire = PAIRES_ELEMENTS[o.element!];
      return [
        sort(paire.degats, { niveau: 6, ...DEGATS_N6 }),
        sort(paire.bouclier, {
          niveau: 10,
          zone: "3 Cibles",
          portee: "Toucher",
          duree: dureeBouclier(o.element!),
        }),
      ];
    },
  },
  {
    id: "mAlchimiste",
    emoji: "⚗️",
    titre: "L'alchimiste",
    phrase: "Tes fioles font le travail.",
    requiert: (inv) =>
      inv.has("fioles")
        ? null
        : "Il te faut des fioles apportées pour jouer l'alchimiste. Coche-les dans « Qu'as-tu apporté ? ».",
    noyau: () => [comp("Alchimie", 1)],
  },
  {
    id: "mRuniste",
    emoji: "ᚱ",
    titre: "Le runiste",
    phrase: "Tu graves la magie pour qu'elle dure.",
    requiert: (inv) =>
      inv.has("feuille_crayon")
        ? null
        : "Il te faut de quoi écrire — feuille et crayon — pour graver tes runes. Coche-les dans « Qu'as-tu apporté ? ».",
    noyau: () => [comp("Assemblage de Runes", 1)],
  },
];

const POOL3_MAGE: Record<string, EntreePool[]> = {
  "Arcaniste+": [
    {
      label: "Un deuxième élément — un cercle + un sort dedans",
      note: "Jamais un accès sec (décision 16) : le cercle ET un premier sort.",
      achats: (_inv, o) => [
        rachat("Acquisition de Cercle"),
        sort(PAIRES_ELEMENTS[autreElement(o.element)].degats, {
          niveau: 1,
          ...DEGATS_N6,
        }),
      ],
      condition: (_inv, o) => !!o.element,
      teteDeListe: true,
    },
    {
      label: "Canalisation",
      note: "Le souffle du lanceur — et le prérequis des runes.",
      achats: () => [comp("Canalisation", 1)],
    },
    {
      label: "Bâton de Sorcier",
      note: "Ton bâton devient un outil de mage.",
      achats: () => [comp("Bâton de Sorcier", 1)],
      condition: (inv) => inv.has("baton_sceptre_baguette"),
    },
    {
      label: "Frénésie magique",
      note: "Enchaîner les lancers.",
      achats: () => [comp("Frénésie magique", 1)],
    },
    {
      label: "Méditation",
      note: "Regagner des PS en jeu.",
      achats: () => [comp("Méditation", 1)],
    },
  ],
  Savant: [
    {
      label: "Identification d'objet",
      note: "Reconnaître ce qui est magique.",
      achats: () => [comp("Identification d'objet", 1)],
    },
    {
      label: "Identification des Potions",
      note: "Reconnaître ce qui se boit (ta chaîne d'alchimie sert de base).",
      achats: () => [comp("Identification des Potions", 1)],
    },
    {
      label: "Décryptage (une langue de plus)",
      note: "Une écriture ancienne de plus.",
      achats: () => [rachat("Décryptage")],
    },
  ],
  "Artisan magique": [
    {
      label: "Alchimie",
      note: "La chaîne des fioles (herbes incluses).",
      achats: () => [comp("Alchimie", 1)],
      condition: (inv) => inv.has("fioles"),
    },
    {
      label: "Assemblage de Runes",
      note: "La chaîne des runes (savoir + canalisation inclus).",
      achats: () => [comp("Assemblage de Runes", 1)],
      condition: (inv) => inv.has("feuille_crayon"),
    },
    // « Piège Magique » est un PROJET d'après-création (spec §4.5) — pas un
    // achat proposé à la création.
  ],
};

const POND4_MAGE: ContenuClasse["pond4"] = {
  mBrule: [
    { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
    {
      type: "achats",
      label: "Canalisation",
      achats: () => [comp("Canalisation", 1)],
    },
    {
      type: "achats",
      label: "Méditation",
      achats: () => [comp("Méditation", 1)],
    },
  ],
  mAlchimiste: [
    {
      type: "achats",
      label: "Alchimie 2",
      achats: () => [comp("Alchimie", 2)],
    },
    {
      type: "achats",
      label: "Identification des Potions",
      achats: () => [comp("Identification des Potions", 1)],
    },
    { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
  ],
  mRuniste: [
    {
      type: "achats",
      label: "Assemblage de Runes 2",
      achats: () => [comp("Assemblage de Runes", 2)],
    },
    { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
    {
      type: "achats",
      label: "Décryptage (une langue de plus)",
      achats: () => [rachat("Décryptage")],
    },
  ],
};

export const CONTENU_MAGE: ContenuClasse = {
  classe: CLASSE_MAGE,
  gratuites: GRATUITES_MAGE,
  roles: ROLES_MAGE,
  pool3: POOL3_MAGE,
  pond4: POND4_MAGE,
  filet: FILET_CASTER,
};

import {
  comp,
  FILET_CASTER,
  rachat,
  sortAuChoix,
  type ContenuClasse,
  type EntreePool,
  type RoleClasse,
} from "./commun";

/**
 * [VIS-8 lot A2-Mage, s358] Contenu MAGE — les 5 archétypes MESURÉS sur les
 * mages de la prod (CONCEPTION §4.0.3), et non plus les rôles conçus.
 *
 * ⚠️ 🔥 « Celui qui brûle » est SUPPRIMÉ : la mesure s350 n'a trouvé AUCUN
 * groupe élémentaire chez les joueurs (§4.0.4 ①). Avec lui disparaissent
 * `PAIRES_ELEMENTS`, `ELEMENTS`, `autreElement` et `dureeBouclier` — plus
 * aucun rôle ne fait « dégâts + bouclier du même cercle ».
 *
 * ⭐ TROIS RÈGLES ARBITRÉES QUI SURPLOMBENT CE FICHIER (référence §5.1) :
 *  1. Le cercle est LIBRE pour les 5 rôles — aucun `Cercle:X` imposé, même
 *     quand la mesure en dégage un. Le contenu ne NOMME donc aucun sort : il
 *     demande `sortAuChoix(rang)` et le catalogue résout.
 *  2. Nécromancie et Magie Noire sont PROPOSABLES (🧭, 13 cercles) mais
 *     JAMAIS TIRÉES (🎲, 11) — magies interdites dans Destéa (lois de
 *     Torekh). Cette garde vit dans la couche qui choisit le cercle.
 *  3. ⚗️ L'alchimiste n'a PAS de magie par défaut (4 des 7 mesurés n'ont ni
 *     cercle ni sort) : le cercle est une ENTRÉE ③ conditionnée à `o.element`,
 *     donc absente du 🎲 qui ne lui tire pas de cercle.
 *
 * ⚠️ REPORTÉ — « un DEUXIÈME cercle » n'est pas exprimable ici : le contenu
 * n'a qu'un `o.element`. L'ancienne entrée « un deuxième élément » reposait
 * sur `PAIRES_ELEMENTS`, qui n'existe plus. À rouvrir au lot résolveur, quand
 * le joueur pourra nommer un second cercle.
 *
 * 💰 Aucun prix n'est écrit ici (décision 20) : tout est dérivé du catalogue.
 * Les coûts attendus vivent dans `VIS8_archetypes_REFERENCE` §5.
 */

export const CLASSE_MAGE = "mage" as const;

export const GRATUITES_MAGE = [
  "Linguistique et Mathématique",
  "Décryptage",
] as const;

const ROLES_MAGE: readonly RoleClasse[] = [
  {
    id: "mAlchimiste",
    emoji: "⚗️",
    titre: "L'alchimiste",
    phrase: "Tes fioles font le travail.",
    requiert: (inv) =>
      inv.has("fioles")
        ? null
        : "Il te faut des fioles apportées pour jouer l'alchimiste. Coche-les dans « Qu'as-tu apporté ? ».",
    // n = 7, le profil mage n°1 de la plateforme. Noyau ≥ 80 % : la chaîne
    // des herbes. Les recettes viennent avec le quota gratuit d'Alchimie.
    // AUCUNE magie ici — décision Fred s357 : c'est un ARTISAN.
    noyau: () => [
      comp("Alchimie", 1),
      comp("Connaissances des Herbes Rares", 1),
      comp("Connaissances des Herbes Communes", 1),
    ],
  },
  {
    id: "mGuilde",
    emoji: "🎭",
    titre: "Le mage de guilde",
    phrase: "Ta magie est un métier, et la guilde est ta famille.",
    requiert: (_inv, o) =>
      o.element
        ? null
        : "Choisis d'abord ton cercle de magie — le mage de guilde en vit.",
    // n = 5, cohésion 0.72. Le liant est SOCIAL, pas élémentaire : ses 5
    // membres portent 5 cercles DIFFÉRENTS. D'où « ≥ 3 sorts », sans cercle
    // imposé.
    noyau: () => [
      comp("Méditation", 1),
      comp("Développement Spirituel", 1),
      comp("Connaissances Criminelles", 1),
      sortAuChoix(1),
      sortAuChoix(2),
      sortAuChoix(3),
    ],
  },
  {
    id: "mCanalisateur",
    emoji: "🔮",
    titre: "Le canalisateur",
    phrase: "Tu tires la puissance brute, et tu la tiens.",
    requiert: (_inv, o) =>
      o.element
        ? null
        : "Choisis d'abord ton cercle de magie — c'est lui que tu canalises.",
    // n = 5, cohésion 0.7. Magie Pure chez 4/5, mais le cercle reste LIBRE.
    noyau: () => [
      comp("Canalisation", 1),
      comp("Développement Spirituel", 1),
      comp("Connaissances des Runes", 1),
      comp("Herbalisme", 1),
      comp("Connaissances des Herbes Communes", 1),
      sortAuChoix(1),
    ],
  },
  {
    id: "mEnchanteur",
    emoji: "✨",
    titre: "L'enchanteur",
    phrase: "Tu ne frappes pas : tu convaincs, tu trompes, tu charmes.",
    requiert: (inv, o) => {
      if (!o.element) {
        return "Choisis d'abord ton cercle de magie — l'enchanteur en vit.";
      }
      return inv.has("baton_sceptre_baguette")
        ? null
        : "Il te faut un bâton, un sceptre ou une baguette pour jouer l'enchanteur. Coche-le dans « Qu'as-tu apporté ? ».";
    },
    // n = 2, cohésion 0.73. Gros volume de sorts + le Bâton de Sorcier en
    // main. Aucune montée signature mesurée.
    noyau: () => [
      comp("Bâton de Sorcier", 1),
      sortAuChoix(1),
      sortAuChoix(2),
      sortAuChoix(3),
    ],
  },
  {
    id: "mRuniste",
    emoji: "ᚱ",
    titre: "Le runiste",
    phrase: "Tu graves la magie pour qu'elle dure.",
    requiert: (inv, o) => {
      if (!inv.has("feuille_crayon")) {
        return "Il te faut de quoi écrire — feuille et crayon — pour graver tes runes. Coche-les dans « Qu'as-tu apporté ? ».";
      }
      return o.element
        ? null
        : "Choisis d'abord ton cercle de magie — c'est lui que tu graves.";
    },
    // n = 2, cohésion 0.67. Les DEUX runistes mesurés portent la Nécromancie,
    // magie INTERDITE dans Destéa : des hors-la-loi assumés, pas une
    // recommandation (référence §5.1 ②). Le cercle reste donc libre.
    noyau: () => [
      comp("Canalisation", 1),
      comp("Connaissances des Runes", 1),
      comp("Méditation", 1),
      comp("Assemblage de Runes", 1),
      sortAuChoix(1),
    ],
  },
];

/** ③a — les montées SIGNATURE mesurées (référence §4), posées avant tout
 *  tirage. ✨ et ᚱ n'en ont aucune : leur ③ est entièrement tiré. */
const SIGNATURE3_MAGE: Record<string, EntreePool[]> = {
  mAlchimiste: [
    {
      label: "Alchimie 2",
      note: "La montée qui fait l'alchimiste : 7 membres sur 7 l'ont.",
      achats: () => [comp("Alchimie", 2)],
    },
  ],
  mGuilde: [
    {
      label: "Accès aux cercles 2",
      note: "Les 5 mages de guilde mesurés ont tous poussé leur accès à 2.",
      achats: () => [rachat("Acquisition de Cercle")],
    },
  ],
  mCanalisateur: [
    {
      label: "Canalisation 2",
      note: "La montée qui fait le canalisateur : 5 membres sur 5 l'ont.",
      achats: () => [comp("Canalisation", 2)],
    },
  ],
};

/** ③b — le pool PARTAGÉ de la classe, indexé par thème. Union des ③
 *  ESSENTIEL mesurés des 5 rôles (§4.0.3). */
const POOL3_MAGE: Record<string, EntreePool[]> = {
  "Arcaniste+": [
    {
      label: "Deux sorts de plus dans ton cercle",
      note: "Le volume qui distingue un vrai lanceur (« ≥ 3 sorts » mesuré).",
      achats: () => [sortAuChoix(2), sortAuChoix(3)],
      condition: (_inv, o) => !!o.element,
    },
    {
      label: "Un cercle de magie — et un premier sort dedans",
      note: "Jamais un accès sec (décision 16) : le cercle ET son sort.",
      achats: () => [sortAuChoix(1)],
      condition: (_inv, o) => !!o.element,
    },
    {
      label: "Canalisation",
      note: "Le souffle du lanceur — et le prérequis des runes.",
      achats: () => [comp("Canalisation", 1)],
    },
    {
      label: "Méditation",
      note: "Regagner des points de spiritualité en jeu.",
      achats: () => [comp("Méditation", 1)],
    },
    {
      label: "Développement Spirituel",
      note: "Le réservoir dans lequel tu puises pour lancer.",
      achats: () => [comp("Développement Spirituel", 1)],
    },
    {
      label: "Bâton de Sorcier",
      note: "Ton bâton devient un outil de mage.",
      achats: () => [comp("Bâton de Sorcier", 1)],
      condition: (inv) => inv.has("baton_sceptre_baguette"),
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
    {
      label: "Estimation",
      note: "Savoir ce que vaut ce que tu trouves.",
      achats: () => [comp("Estimation", 1)],
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
    {
      label: "Herbalisme",
      note: "Reconnaître et récolter sur le terrain.",
      achats: () => [comp("Herbalisme", 1)],
    },
    {
      label: "Mineur",
      note: "Descendre chercher la matière première.",
      achats: () => [comp("Mineur", 1)],
    },
    {
      label: "Connaissances des Métaux Communs",
      note: "Nommer ce que tu extrais.",
      achats: () => [comp("Connaissances des Métaux Communs", 1)],
    },
    // « Piège Magique » est un PROJET d'après-création (spec §4.5) — pas un
    // achat proposé à la création.
  ],
  Terrain: [
    {
      label: "Revenu",
      note: "De quoi entretenir ton matériel entre les GN.",
      achats: () => [comp("Revenu", 1)],
    },
    {
      label: "Premiers Soins",
      note: "Relever quelqu'un qui tombe à côté de toi.",
      achats: () => [comp("Premiers Soins", 1)],
    },
    {
      label: "Diagnostic",
      note: "Savoir ce dont souffre quelqu'un avant d'agir.",
      achats: () => [comp("Diagnostic", 1)],
    },
    {
      label: "Résistance à la magie",
      note: "Encaisser ce que les autres lancent.",
      achats: () => [comp("Résistance à la magie", 1)],
    },
    {
      label: "Résistance à la torture",
      note: "Tenir quand on cherche à te faire parler.",
      achats: () => [comp("Résistance à la torture", 1)],
    },
    {
      label: "Consécration",
      note: "Sanctifier un lieu ou un objet.",
      achats: () => [comp("Consécration", 1)],
    },
  ],
};

/** ④ — le REMPLISSAGE mesuré (25-49 %) rôle par rôle. Les jauges de points
 *  de spiritualité sont laissées au FILET_CASTER, qui les plafonne déjà à 10
 *  — le maximum observé sur les 33 mages vivants (9 y sont exactement, c'est
 *  le plafond du jeu, pas une cible). */
const POND4_MAGE: ContenuClasse["pond4"] = {
  mAlchimiste: [
    {
      type: "achats",
      label: "Identification des Potions",
      achats: () => [comp("Identification des Potions", 1)],
    },
    {
      type: "achats",
      label: "Estimation",
      achats: () => [comp("Estimation", 1)],
    },
    {
      type: "achats",
      label: "Connaissances des Religions",
      achats: () => [comp("Connaissances des Religions", 1)],
    },
    {
      type: "achats",
      label: "Langue supplémentaire",
      achats: () => [comp("Langue supplémentaire", 1)],
    },
  ],
  mGuilde: [
    {
      type: "achats",
      label: "Canalisation",
      achats: () => [comp("Canalisation", 1)],
    },
    { type: "achats", label: "Rumeur", achats: () => [comp("Rumeur", 1)] },
  ],
  mCanalisateur: [
    {
      type: "achats",
      label: "Assemblage de Runes",
      achats: () => [comp("Assemblage de Runes", 1)],
    },
    {
      type: "achats",
      label: "Bâton de Sorcier",
      achats: () => [comp("Bâton de Sorcier", 1)],
    },
    {
      type: "achats",
      label: "Connaissances des Gemmes Communes",
      achats: () => [comp("Connaissances des Gemmes Communes", 1)],
    },
    {
      type: "achats",
      label: "Estimation",
      achats: () => [comp("Estimation", 1)],
    },
    {
      type: "achats",
      label: "Langue supplémentaire",
      achats: () => [comp("Langue supplémentaire", 1)],
    },
  ],
  // ✨ et ᚱ n'ont AUCUN ④ mesuré (n = 2, noyaux minces par construction —
  // référence §6.3). Leur remplissage est celui du filet, dérivé et non
  // inventé : écrire un ④ pour eux serait du game-design sans mesure.
  mEnchanteur: [],
  mRuniste: [
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
  signature3: SIGNATURE3_MAGE,
  pool3: POOL3_MAGE,
  pond4: POND4_MAGE,
  filet: FILET_CASTER,
};

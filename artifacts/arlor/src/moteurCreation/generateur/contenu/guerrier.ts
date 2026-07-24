import {
  FILET_GUERRIER,
  comp,
  et,
  si,
  type Achat,
  type ContenuClasse,
  type EntreePool,
  type EtapePond,
  type RoleClasse,
} from "./commun";

/**
 * [VIS-8 lot A2] Contenu GUERRIER — les 3 archétypes MESURÉS sur les joueurs
 * réels (conception §4.0.3, arrêtés Fred s350 ; ids arrêtés s352).
 *
 * ⚠️ Remplace le contenu pilote du lot 2a. `gArtisan` (🔨 L'artisan, conçu)
 * devient `gForgeron` (🔨 Le forgeron, mesuré) — id neuf parce que le CONTENU
 * est différent : l'artisan conçu partait de Forge + Renforcement défensif ;
 * le forgeron réel part de la chaîne des Métaux et de Mineur, la Forge n'étant
 * que chez 4 membres sur 6 (donc en ③, pas en ②).
 *
 * ② NOYAU = la liste « ≥ 80 % des membres » du groupe mesuré, au plancher
 * niveau 1, plus les paliers FORCÉS par un prérequis. Les PRIX ne sont jamais
 * écrits ici (décision 20) : ils sont dérivés du catalogue par `cheminComplet`,
 * et les tests attestent qu'ils retombent sur la table §5 de la référence v2.
 *
 * ⚠️ Décision 27 — les « Connaissances » ne sont JAMAIS une entrée autonome
 * (ni ③ ni ④) : uniquement maillon d'un chemin de prérequis (Métaux Communs →
 * Métaux Rares → Mineur/Forge). Les `Connaissances des Gemmes` et
 * `des Religions` des listes mesurées sortent donc du pool ; les Religions
 * restent la première jauge du FILET, qui est un autre mécanisme.
 * ⚠️ Jamais de niveau 3 (référence v2 §2.1).
 */

export const CLASSE_GUERRIER = "guerrier" as const;

export const GRATUITES_GUERRIER = [
  "Bravoure",
  "Compétence d'arme à deux mains",
] as const;

/** Cases `objets_generateur` — mêmes ids que `objets_requis` (PR #712). */
const LAMES = ["lame_courte", "lame_moyenne", "lame_longue", "lame_deux_mains"];
const MELEE = [
  ...LAMES,
  "hache",
  "contondante_courte",
  "contondante_moyenne",
  "contondante_longue",
  "baton_hast",
];
const BOUCLIERS = ["targe", "ecu", "pavois"];

/** Créneau d'armure — du plus lourd au plus léger. Le 🛡️ mesuré porte des
 *  plaques (4/5) ; on descend au mieux de ce qui a été apporté. */
const CRENEAU_ARMURE: readonly { caseId: string; competence: string }[] = [
  { caseId: "armure_plaques", competence: "Port d'armure lourde" },
  { caseId: "armure_maille", competence: "Port d'armure intermédiaire" },
  { caseId: "armure_cuir", competence: "Port d'armure légère" },
];

const uneDe = (inv: ReadonlySet<string>, cases: readonly string[]) =>
  cases.some((c) => inv.has(c));

const ROLES_GUERRIER: readonly RoleClasse[] = [
  {
    id: "gForgeron",
    emoji: "🔨",
    titre: "Le forgeron",
    phrase:
      "Il creuse, il fond, il forge. Jouable sans rien apporter — l'atelier vient avec lui.",
    requiert: () => null, // aucun créneau : le rôle le plus stable des trois
    // Mesuré : Métaux Rares 6/6 · Mineur 6/6 · Métaux Communs 6/6 ·
    // Linguistique 5/6. Les Métaux Communs sont à la fois mesurés ET maillon
    // du chemin vers les deux autres — la dédup de `cheminComplet` s'en charge.
    noyau: () => [
      comp("Connaissances des Métaux Rares", 1),
      comp("Mineur", 1),
      comp("Connaissances des Métaux Communs", 1),
      comp("Linguistique et Mathématique", 1),
    ],
  },
  {
    id: "gTient",
    emoji: "🛡️",
    titre: "Celui qui tient",
    phrase: "On ne le déplace pas et on ne passe pas.",
    requiert: (inv) =>
      CRENEAU_ARMURE.some((a) => inv.has(a.caseId))
        ? null
        : "Il te faut une armure — cuir, mailles ou plaques. C'est elle qui fait tenir la ligne.",
    // Mesuré : Botte Secrète 5/5 · Revenu 5/5 · Compétence d'arme à la lame
    // 4/5 · Port d'armure lourde 4/5. Arme et armure sont des CRÉNEAUX
    // (grammaire §2.11) : on n'achète jamais une compétence injouable.
    noyau: (inv) => {
      const armure = CRENEAU_ARMURE.find((a) => inv.has(a.caseId));
      return [
        ...(armure ? [comp(armure.competence, 1)] : []),
        ...(uneDe(inv, MELEE) ? [comp("Botte Secrète", 1)] : []),
        ...(uneDe(inv, LAMES) ? [comp("Compétence d'arme à la lame", 1)] : []),
        comp("Revenu", 1),
      ];
    },
  },
  {
    id: "gFrappe",
    emoji: "⚔️",
    titre: "Celui qui frappe",
    phrase: "La fureur assumée : il gagne les échanges.",
    // ⭐ PORTE LARGE (arbitrage Fred s353) : n'importe quelle arme de mêlée
    // ouvre le rôle. Les 2 membres mesurés jouent deux armes identiques, mais
    // fermer la porte à tous les autres coûtait plus qu'elle ne rapportait.
    requiert: (inv) => {
      // « deux armes identiques » est une case à part dans `objets_generateur` :
      // elle vaut arme de mêlée pour l'ouverture du rôle.
      if (uneDe(inv, MELEE) || inv.has("deux_armes_identiques")) return null;
      return inv.has("arme_distance")
        ? "Un arc seul ne suffit pas : la Compétence d'arme à distance est de catégorie voleur — un Guerrier y plafonne au niveau 1, sans jamais l'effet offensif. Il te faut une arme de mêlée."
        : "Il te faut une arme de mêlée (lame, hache, masse, bâton…).";
    },
    // Mesuré 2/2 : Berserk · Combat à deux armes. Le second est un CRÉNEAU :
    // il exige deux armes identiques (`objets_requis`). Sans elles, la Botte
    // Secrète tient le geste offensif — mesurée 1/2 en ③ chez ce groupe.
    noyau: (inv) => [
      comp("Berserk", 1),
      inv.has("deux_armes_identiques")
        ? comp("Combat à deux armes", 1)
        : comp("Botte Secrète", 1),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* ③a — LES MONTÉES SIGNATURE (référence v2 §4, porteurs mesurés).      */

const SIGNATURE3_GUERRIER: Record<string, EntreePool[]> = {
  gForgeron: [
    {
      label: "Mineur 2",
      note: "Trois cartes par événement et l'accès aux expéditions de métaux rares — 6 forgerons sur 6 l'ont.",
      achats: () => [comp("Mineur", 2)],
    },
  ],
  gTient: [
    {
      label: "Botte Secrète 2",
      note: "« Brise-bouclier » : après deux coups sur le bouclier adverse — 5 sur 5 l'ont.",
      achats: () => [comp("Botte Secrète", 2)],
      condition: (inv) => uneDe(inv, MELEE),
    },
  ],
  gFrappe: [
    {
      label: "Berserk 2",
      note: "La fureur montée d'un cran — 2 sur 2 l'ont.",
      achats: () => [comp("Berserk", 2)],
    },
    {
      label: "Combat à deux armes 2",
      note: "Deux armes moyennes, plus seulement courtes — 2 sur 2 l'ont.",
      achats: () => [comp("Combat à deux armes", 2)],
      condition: (inv) => inv.has("deux_armes_identiques"),
    },
    {
      label: "Botte Secrète 2",
      note: "Sans deux armes identiques, c'est le brise-bouclier qui porte la montée offensive.",
      achats: () => [comp("Botte Secrète", 2)],
      condition: (inv) => !inv.has("deux_armes_identiques") && uneDe(inv, MELEE),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* ③b — LE POOL (listes « ESSENTIEL » 50-79 % mesurées, réunies par style). */

const POOL3_GUERRIER: Record<string, EntreePool[]> = {
  Offensif: [
    {
      label: "Botte Secrète 1",
      note: "Désarmer : après deux coups sur l'arme adverse.",
      achats: () => [comp("Botte Secrète", 1)],
      condition: (inv) => uneDe(inv, MELEE),
    },
    {
      label: "Charge",
      note: "Prix chemin : Botte Secrète incluse si tu ne l'as pas encore.",
      achats: () => [comp("Charge", 1)],
      condition: (inv) => uneDe(inv, MELEE),
    },
    {
      label: "Compétence d'arme à la lame 1",
      note: "Résister à un désarmement par cycle.",
      achats: () => [comp("Compétence d'arme à la lame", 1)],
      condition: (inv) => uneDe(inv, LAMES),
    },
    {
      label: "Assommer 1",
      note: "Mettre à terre sans tuer. ⚠️ hors classe, plafonné niveau 1 à la création.",
      achats: () => [comp("Assommer", 1)],
      condition: (inv) => inv.has("contondante_longue") || inv.has("baton_hast"),
    },
    {
      label: "Résolution Guerrière 1",
      note: "Agir normalement à 1 point de vie.",
      achats: () => [comp("Résolution Guerrière", 1)],
    },
  ],
  Défensif: [
    {
      label: "Défense Inflexible 1",
      note: "Encaisser un sort, une fois par combat.",
      achats: () => [comp("Défense Inflexible", 1)],
      condition: (inv) => uneDe(inv, BOUCLIERS),
    },
    {
      label: "Résistance à la magie 1",
      note: "Résister à un sort à effet, une fois par événement.",
      achats: () => [comp("Résistance à la magie", 1)],
    },
    {
      label: "Poids Lourd",
      note: "Ignorer le premier repoussement de chaque combat.",
      achats: () => [comp("Poids Lourd", 1)],
    },
    {
      label: "Port d'armure légère",
      note: "Porter le cuir.",
      achats: () => [comp("Port d'armure légère", 1)],
      condition: (inv) => inv.has("armure_cuir"),
    },
  ],
  Atelier: [
    {
      label: "Forge 1",
      note: "Fondre, fabriquer, réparer les alliages communs — prix chemin : Métaux Communs inclus.",
      achats: () => [comp("Forge", 1)],
    },
    {
      label: "Estimation 1",
      note: "Savoir ce que vaut ce qu'on te propose.",
      achats: () => [comp("Estimation", 1)],
    },
    {
      label: "Revenu",
      note: "10 écus au début de chaque événement — de quoi entretenir l'équipement.",
      achats: () => [comp("Revenu", 1)],
    },
    {
      label: "Premiers Soins 1",
      note: "Stabiliser un blessé. ⚠️ hors classe, plafonné niveau 1.",
      achats: () => [comp("Premiers Soins", 1)],
      condition: (inv) => inv.has("bandages"),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* ④ — PONDÉRATIONS (listes « REMPLISSAGE » 25-49 %), puis le FILET.    */

/* `si` / `et` viennent de `commun.ts` (remontés s355 — ils vivaient en
   double ici et dans l'autre contenu martial). */

/**
 * ⭐ ④ RALLONGÉE SUR LES DONNÉES (s353). Avant, la liste était courte et le
 * FILET absorbait le reste en rafale. Elle reprend maintenant tout ce que les
 * joueurs de l'archétype achètent réellement (listes ESSENTIEL + REMPLISSAGE
 * du §4.0.3), pour que le filet n'ait presque plus rien à faire.
 * Repères prod (21 guerriers vivants) : Résistance à la magie 9/21 ·
 * Port d'armure légère 8/21 · Bonne santé 7/21 · Défense Inflexible 6/21 ·
 * Poids Lourd 5/21 · Maniement du bouclier moyen 5/21.
 */
const POND4_GUERRIER: Record<string, EtapePond[]> = {
  gForgeron: [
    et("Forge 2", () => [comp("Forge", 2)]),
    et("Estimation 1", () => [comp("Estimation", 1)]),
    et("Revenu", () => [comp("Revenu", 1)]),
    et("Résistance à la magie 1", () => [comp("Résistance à la magie", 1)]),
    et("Résolution Guerrière 1", () => [comp("Résolution Guerrière", 1)]),
    et("Bonne santé", () => [comp("Bonne santé", 1)]),
    si("Maniement du bouclier moyen", ["ecu"], () => [
      comp("Maniement du bouclier moyen", 1),
    ]),
    si("Compétence d'arme à la lame 1", LAMES, () => [
      comp("Compétence d'arme à la lame", 1),
    ]),
  ],
  gTient: [
    et("Désengagement", () => [comp("Désengagement", 1)]),
    et("Résistance à la magie 1", () => [comp("Résistance à la magie", 1)]),
    et("Poids Lourd", () => [comp("Poids Lourd", 1)]),
    et("Bonne santé", () => [comp("Bonne santé", 1)]),
    si("Défense Inflexible 1", BOUCLIERS, () => [comp("Défense Inflexible", 1)]),
    si("Maniement du grand bouclier", ["pavois"], () => [
      comp("Maniement du grand bouclier", 1),
    ]),
    et("Méditation 1", () => [comp("Méditation", 1)]),
  ],
  gFrappe: [
    et("Corps Sain 1", () => [comp("Corps Sain", 1)]),
    et("Résistance à la magie 1", () => [comp("Résistance à la magie", 1)]),
    et("Résolution Guerrière 1", () => [comp("Résolution Guerrière", 1)]),
    si("Port d'armure légère", ["armure_cuir"], () => [
      comp("Port d'armure légère", 1),
    ]),
    si("Premiers Soins 1", ["bandages"], () => [comp("Premiers Soins", 1)]),
    si("Botte Secrète 1", MELEE, () => [comp("Botte Secrète", 1)]),
  ],
};

export const CONTENU_GUERRIER: ContenuClasse = {
  classe: CLASSE_GUERRIER,
  gratuites: GRATUITES_GUERRIER,
  alertesGratuites: (inv) =>
    inv.has("lame_deux_mains")
      ? []
      : [
          "La Compétence d'arme à deux mains est offerte, mais sans arme à deux mains apportée elle reste inutilisable pour l'instant.",
        ],
  roles: ROLES_GUERRIER,
  signature3: SIGNATURE3_GUERRIER,
  pool3: POOL3_GUERRIER,
  pond4: POND4_GUERRIER,
  filet: FILET_GUERRIER,
};

export { POND4_GUERRIER, POOL3_GUERRIER, ROLES_GUERRIER, SIGNATURE3_GUERRIER };

import {
  comp,
  FILET_VOLEUR,
  type Achat,
  type ContenuClasse,
  type EntreePool,
  type EtapePond,
  type RoleClasse,
} from "./commun";

/**
 * [VIS-8 lot A2] Contenu VOLEUR — les 3 archétypes MESURÉS sur les joueurs
 * réels (conception §4.0.3, arrêtés Fred s350 ; ids arrêtés s352).
 *
 * ⚠️ Remplace les 3 rôles théoriques du lot 2b. `vTire` (🎯 L'œil à distance)
 * est SUPPRIMÉ : zéro joueur mesuré. `vPremier ⟵ vSurprise` (même titre,
 * même emoji) · `vEclaireur ⟵ vPiege`.
 *
 * ② NOYAU = la liste « ≥ 80 % des membres » du groupe mesuré, au plancher
 * niveau 1, plus les paliers FORCÉS par un prérequis. Les PRIX ne sont jamais
 * écrits ici (décision 20) : ils sont dérivés du catalogue par `cheminComplet`,
 * et les tests attestent qu'ils retombent sur la table §5 de la référence v2.
 *
 * ⚠️ Décision 27 — les « Connaissances » ne sont JAMAIS une entrée autonome
 * (ni ③ ni ④) : uniquement maillon d'un chemin de prérequis (Criminelles →
 * Rumeur · Métaux → Mineur/Forge · Herbes → Herbalisme). Les entrées
 * « Connaissances » des listes mesurées sont donc absorbées par leur cible.
 * ⚠️ Jamais de niveau 3 : 19/19 acquisitions de niveau 3 en prod sont passées
 * par un maître (référence v2 §2.1). L'entrée « Compétence d'arme à distance
 * 3 » du pool livré en 2b, documentée inatteignable, disparaît ici.
 */

export const CLASSE_VOLEUR = "voleur" as const;

export const GRATUITES_VOLEUR = ["Crochetage de serrure", "Estimation"] as const;

/** Cases `objets_generateur` — mêmes ids que `objets_requis` (PR #712). */
const MELEE = [
  "lame_courte",
  "lame_moyenne",
  "lame_longue",
  "lame_deux_mains",
  "hache",
  "contondante_courte",
  "contondante_moyenne",
  "contondante_longue",
  "baton_hast",
];

const ROLES_VOLEUR: readonly RoleClasse[] = [
  {
    id: "vOrfevre",
    emoji: "💎",
    titre: "L'orfèvre",
    phrase:
      "Il sait ce que vaut ce qu'il touche — et où le ranger. Le voleur le plus joué de la plateforme.",
    requiert: (inv) =>
      inv.has("bourse")
        ? null
        : "Il te faut une bourse, pas plus grosse qu'un poing : c'est elle qui rend la Cachette secrète jouable.",
    // Mesuré : Linguistique 6/6 · Joaillerie 5/6 · Métaux Communs 5/6 ·
    // Cachette secrète 5/6.
    noyau: () => [
      comp("Linguistique et Mathématique", 1),
      comp("Joaillerie", 1),
      comp("Connaissances des Métaux Communs", 1),
      comp("Cachette secrète", 1),
    ],
  },
  {
    id: "vPremier",
    emoji: "🗡️",
    titre: "Celui qui frappe le premier",
    phrase: "Le bras armé de la guilde : il sait qui, où, et quand.",
    requiert: () => null, // jouable sans rien apporter
    // Mesuré 3/3 : Connaissances Criminelles · Rumeur. La montée
    // `Connaissances Criminelles 2` n'est PAS un choix : elle est FORCÉE par
    // le prérequis de `Rumeur` — seul emploi autorisé des Connaissances
    // (décision 27). D'où une signature ③ vide : elle est déjà au noyau.
    noyau: () => [comp("Rumeur", 1)],
  },
  {
    id: "vEclaireur",
    emoji: "🌲",
    titre: "L'éclaireur",
    phrase: "Le voleur des bois plus que des ruelles : il soigne et il piège.",
    requiert: (inv) =>
      inv.has("bandages")
        ? null
        : "Il te faut des bandages : sans eux, les Premiers Soins qui définissent l'éclaireur ne sont pas jouables.",
    // Mesuré 3/3 : Premiers Soins · Cachette secrète · Revenu · Linguistique.
    // La bourse conditionne la Cachette secrète — sans elle le noyau est plus
    // court et son XP repart dans ③ (jamais un achat injouable).
    noyau: (inv) => [
      comp("Premiers Soins", 1),
      ...(inv.has("bourse") ? [comp("Cachette secrète", 1)] : []),
      comp("Revenu", 1),
      comp("Linguistique et Mathématique", 1),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* ③a — LES MONTÉES SIGNATURE (référence v2 §4, porteurs mesurés).      */

const SIGNATURE3_VOLEUR: Record<string, EntreePool[]> = {
  vOrfevre: [
    {
      label: "Joaillerie 2",
      note: "Les gemmes rares, pas seulement les communes — 5 orfèvres sur 6 l'ont.",
      achats: () => [comp("Joaillerie", 2)],
    },
    {
      label: "Estimation 2",
      note: "Il ne se trompe plus sur un prix — 6 orfèvres sur 6 l'ont.",
      achats: () => [comp("Estimation", 2)],
    },
  ],
  // 🗡️ vPremier : aucune — `Connaissances Criminelles 2` est déjà au noyau.
  // 🌲 vEclaireur : aucune montée signature mesurée.
};

/* ------------------------------------------------------------------ */
/* ③b — LE POOL (listes « ESSENTIEL » 50-79 % mesurées).                */

const POOL3_VOLEUR: Record<string, EntreePool[]> = {
  Négoce: [
    {
      label: "Mineur 1",
      note: "Récolter des métaux communs à chaque événement.",
      achats: () => [comp("Mineur", 1)],
    },
    {
      label: "Forge 1",
      note: "Travailler les métaux communs — prix chemin : Métaux Communs inclus. ⚠️ hors classe, plafonné niveau 1 à la création.",
      achats: () => [comp("Forge", 1)],
    },
    {
      label: "Falsification",
      note: "Imiter un sceau, un document, une signature.",
      achats: () => [comp("Falsification", 1)],
      condition: (inv) => inv.has("feuille_crayon"),
    },
    {
      label: "Décryptage",
      note: "Une langue ancienne de plus. ⚠️ hors classe, plafonné niveau 1.",
      achats: () => [comp("Décryptage", 1)],
    },
  ],
  Rue: [
    {
      label: "Attaque sournoise 1",
      note: "Frapper dans le dos, avec une lame courte.",
      achats: () => [comp("Attaque sournoise", 1)],
      condition: (inv) => inv.has("lame_courte"),
    },
    {
      label: "Langue supplémentaire",
      note: "Une langue moderne de plus — on parle à plus de monde.",
      achats: () => [comp("Langue supplémentaire", 1)],
    },
    {
      label: "Fouille rapide",
      note: "Fouiller un corps ou une pièce en quelques secondes.",
      achats: () => [comp("Fouille rapide", 1)],
    },
  ],
  Bois: [
    {
      label: "Diagnostic 1",
      note: "Lire l'état réel d'un blessé. ⚠️ hors classe, plafonné niveau 1.",
      achats: () => [comp("Diagnostic", 1)],
    },
    {
      label: "Création et désarmement de piège 1",
      note: "Poser un piège, et défaire celui des autres.",
      achats: () => [comp("Création et désarmement de piège", 1)],
    },
    {
      label: "Piège sécurisé",
      note: "Un piège qui ne se retourne pas contre les tiens — prix chemin : Création de piège incluse.",
      achats: () => [comp("Piège sécurisé", 1)],
    },
    {
      label: "Pistage",
      note: "Suivre une trace en forêt.",
      achats: () => [comp("Pistage", 1)],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* ④ — PONDÉRATIONS (listes « REMPLISSAGE » 25-49 %), puis le FILET.    */

/** Étape ④ conditionnée par l'inventaire : hors condition, liste vide. */
const si = (
  label: string,
  cases: readonly string[],
  achats: () => Achat[]
): EtapePond => ({
  type: "achats",
  label,
  achats: (inv) => (cases.some((c) => inv.has(c)) ? achats() : []),
});
const et = (label: string, achats: () => Achat[]): EtapePond => ({
  type: "achats",
  label,
  achats,
});

/**
 * ⭐ ④ RALLONGÉE SUR LES DONNÉES (s353). Repères prod (16 voleurs vivants) :
 * Attaque sournoise 6/16 · Premiers Soins 6/16 · Revenu 6/16 ·
 * Création de piège 4/16 · Falsification 4/16 · Herbalisme 4/16 · Mineur 4/16.
 * Le FILET n'intervient qu'après cette liste — plus en rafale.
 */
const POND4_VOLEUR: Record<string, EtapePond[]> = {
  vOrfevre: [
    et("Revenu", () => [comp("Revenu", 1)]),
    et("Mineur 1", () => [comp("Mineur", 1)]),
    si("Falsification", ["feuille_crayon"], () => [comp("Falsification", 1)]),
    et("Création et désarmement de piège 1", () => [
      comp("Création et désarmement de piège", 1),
    ]),
    si("Botte Secrète 1", MELEE, () => [comp("Botte Secrète", 1)]),
    si("Herbalisme 1", ["fioles"], () => [comp("Herbalisme", 1)]),
    si("Attaque sournoise 1", ["lame_courte"], () => [
      comp("Attaque sournoise", 1),
    ]),
  ],
  vPremier: [
    si("Attaque sournoise 1", ["lame_courte"], () => [
      comp("Attaque sournoise", 1),
    ]),
    si("Assommer 1", ["contondante_longue", "baton_hast"], () => [
      comp("Assommer", 1),
    ]),
    et("Fouille rapide", () => [comp("Fouille rapide", 1)]),
    si("Botte Secrète 1", MELEE, () => [comp("Botte Secrète", 1)]),
    si("Premiers Soins 1", ["bandages"], () => [comp("Premiers Soins", 1)]),
    et("Revenu", () => [comp("Revenu", 1)]),
  ],
  vEclaireur: [
    et("Diagnostic 1", () => [comp("Diagnostic", 1)]),
    et("Création et désarmement de piège 1", () => [
      comp("Création et désarmement de piège", 1),
    ]),
    et("Pistage", () => [comp("Pistage", 1)]),
    si("Compétence d'arme à distance 1", ["arme_distance"], () => [
      comp("Compétence d'arme à distance", 1),
    ]),
    si("Attaque sournoise 1", ["lame_courte"], () => [
      comp("Attaque sournoise", 1),
    ]),
    si("Herbalisme 1", ["fioles"], () => [comp("Herbalisme", 1)]),
  ],
};

export const CONTENU_VOLEUR: ContenuClasse = {
  classe: CLASSE_VOLEUR,
  gratuites: GRATUITES_VOLEUR,
  alertesGratuites: (inv) =>
    MELEE.some((c) => inv.has(c))
      ? []
      : [
          "L'Estimation et le Crochetage de serrure sont offerts, mais sans arme de mêlée apportée ton voleur ne pourra rien défendre.",
        ],
  roles: ROLES_VOLEUR,
  signature3: SIGNATURE3_VOLEUR,
  pool3: POOL3_VOLEUR,
  pond4: POND4_VOLEUR,
  filet: FILET_VOLEUR,
};

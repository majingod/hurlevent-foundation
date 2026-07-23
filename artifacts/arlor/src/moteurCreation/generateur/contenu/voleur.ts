import {
  comp,
  FILET_MARTIAL_COMMUN,
  rachat,
  type ContenuClasse,
  type EntreePool,
  type RoleClasse,
} from "./commun";

/**
 * [VIS-8 lot 2b] Contenu VOLEUR (§4.3, §4.5). Le geste d'élimination du 🗡️
 * est RÉSOLU PAR L'ARME apportée (mesuré s349, mêmes cas que la base
 * `objets_requis`) : contondante longue ou bâton → Assommer 1 · lame
 * courte → Attaque sournoise 1 · contondante courte → Assommer 2 ·
 * mains vides → Attaque sournoise 2 (« Brise-cou »).
 */

export const CLASSE_VOLEUR = "voleur" as const;

export const GRATUITES_VOLEUR = [
  "Crochetage de serrure",
  "Estimation",
] as const;

const ROLES_VOLEUR: readonly RoleClasse[] = [
  {
    id: "vSurprise",
    emoji: "🗡️",
    titre: "Celui qui frappe le premier",
    phrase: "Ta cible ne te voit pas venir.",
    requiert: () => null,
    noyau: (inv) => {
      const geste =
        inv.has("contondante_longue") || inv.has("baton_hast")
          ? comp("Assommer", 1)
          : inv.has("lame_courte")
            ? comp("Attaque sournoise", 1)
            : inv.has("contondante_courte")
              ? comp("Assommer", 2)
              : comp("Attaque sournoise", 2); // mains vides : « Brise-cou »
      return inv.has("bourse")
        ? [geste, comp("Cachette secrète", 1)]
        : [geste];
    },
  },
  {
    id: "vTire",
    emoji: "🎯",
    titre: "L'œil à distance",
    phrase: "Tu touches avant qu'on t'approche.",
    requiert: (inv) =>
      inv.has("arme_distance")
        ? null
        : "Il te faut une arme à distance apportée — un arc, une arbalète ou des armes de jet. Coche-la dans « Qu'as-tu apporté ? ».",
    noyau: () => [comp("Compétence d'arme à distance", 2), comp("Pistage", 1)],
  },
  {
    id: "vPiege",
    emoji: "🪤",
    titre: "Le poseur de pièges",
    phrase: "Le terrain travaille pour toi.",
    requiert: () => null,
    noyau: () => [
      comp("Création et désarmement de piège", 1),
      comp("Piège sécurisé", 1),
    ],
  },
];

const POOL3_VOLEUR: Record<string, EntreePool[]> = {
  "Monte-en-l'air": [
    {
      label: "Crochetage de serrure 2",
      note: "Les serrures sérieuses.",
      achats: () => [comp("Crochetage de serrure", 2)],
    },
    {
      label: "Fouille rapide",
      note: "Fouiller un corps ou une pièce en quelques secondes.",
      achats: () => [comp("Fouille rapide", 1)],
    },
    {
      label: "Cachette secrète",
      note: "Ta bourse échappe aux fouilles.",
      achats: () => [comp("Cachette secrète", 1)],
      condition: (inv) => inv.has("bourse"),
    },
    {
      label: "Falsification",
      note: "Faux papiers, faux sceaux (ton Estimation offerte sert de base).",
      achats: () => [comp("Falsification", 1)],
    },
  ],
  Contrôle: [
    {
      label: "Torture",
      note: "Faire parler.",
      achats: () => [comp("Torture", 1)],
    },
    {
      label: "L'empoisonneur",
      note: "Herbes → Alchimie → Toxicologie : la chaîne complète du poison.",
      achats: () => [comp("Expertise en toxicologie", 1)],
      condition: (inv) => inv.has("fioles"),
    },
    {
      label: "Empoisonnement de projectile",
      note: "Tes flèches portent tes poisons.",
      achats: () => [comp("Empoisonnement de projectile", 1)],
      condition: (inv) => inv.has("arme_distance") && inv.has("fioles"),
    },
  ],
  "Truand savant": [
    {
      label: "Connaissances Criminelles (un nouveau savoir)",
      note: "Un milieu de plus dont tu connais les codes.",
      achats: () => [rachat("Connaissances Criminelles")],
    },
    {
      label: "Rumeur",
      note: "Lancer et suivre les bruits qui courent (exige de connaître le milieu).",
      achats: () => [comp("Rumeur", 1)],
    },
    {
      label: "Pistage",
      note: "Suivre une trace.",
      achats: () => [comp("Pistage", 1)],
    },
    {
      label: "Estimation 2",
      note: "Évaluer vite et juste.",
      achats: () => [comp("Estimation", 2)],
    },
  ],
};

const POND4_VOLEUR: ContenuClasse["pond4"] = {
  vSurprise: [
    {
      type: "achats",
      label: "Connaissances Criminelles (un nouveau savoir)",
      achats: () => [rachat("Connaissances Criminelles")],
    },
    {
      type: "achats",
      label: "Fouille rapide",
      achats: () => [comp("Fouille rapide", 1)],
    },
  ],
  vTire: [
    // Spec §4.5 : « arc niv 3 (+14) » — INATTEIGNABLE à la création (plafond
    // §2.5 : sa classe = 2 sans maître). L'entrée reste, le composeur la
    // saute ; elle s'activerait si la règle changeait. Attesté par test.
    {
      type: "achats",
      label: "Compétence d'arme à distance 3",
      achats: () => [comp("Compétence d'arme à distance", 3)],
    },
    {
      type: "achats",
      label: "Connaissances des Créatures (un savoir)",
      achats: () => [rachat("Connaissances des Créatures")],
    },
    {
      type: "achats",
      label: "Dépeçage",
      achats: () => [comp("Dépeçage", 1)],
    },
  ],
  vPiege: [
    {
      type: "achats",
      label: "Création et désarmement de piège 2",
      achats: () => [comp("Création et désarmement de piège", 2)],
    },
    {
      type: "achats",
      label: "Crochetage de serrure 2",
      achats: () => [comp("Crochetage de serrure", 2)],
    },
    {
      type: "achats",
      label: "Connaissances Criminelles (un nouveau savoir)",
      achats: () => [rachat("Connaissances Criminelles")],
    },
  ],
};

export const CONTENU_VOLEUR: ContenuClasse = {
  classe: CLASSE_VOLEUR,
  gratuites: GRATUITES_VOLEUR,
  roles: ROLES_VOLEUR,
  pool3: POOL3_VOLEUR,
  pond4: POND4_VOLEUR,
  filet: FILET_MARTIAL_COMMUN,
};

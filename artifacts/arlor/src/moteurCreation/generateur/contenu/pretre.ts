import type { ConfigMagie } from "../types";
import {
  comp,
  FILET_CASTER,
  priere,
  type ContenuClasse,
  type EntreePool,
  type RoleClasse,
} from "./commun";

/**
 * [VIS-8 lot 2b] Contenu PRÊTRE (§4.2, §4.5) — cibles et conditions
 * SEULEMENT : les prix sont dérivés (catalogue + miroir magie) et attestés
 * par les tests (décision 20). Politique de portée « par usage » (s349) :
 * les soins se lancent PENDANT le combat → à distance (5 pieds) ; le
 * contact est le choix du rôle de front, pas un défaut.
 */

export const CLASSE_PRETRE = "pretre" as const;

export const GRATUITES_PRETRE = [
  "Bénédiction",
  "Connaissances des Religions",
  "Linguistique et Mathématique",
] as const;

/** Les 4 protections OUVERTES au prêtre (pavois et plaques restent guerrier). */
const PROTECTIONS_PRETRE: readonly { caseId: string; nom: string }[] = [
  { caseId: "armure_cuir", nom: "Port d'armure légère" },
  { caseId: "armure_maille", nom: "Port d'armure intermédiaire" },
  { caseId: "targe", nom: "Maniement du petit bouclier" },
  { caseId: "ecu", nom: "Maniement du bouclier moyen" },
];

/** La prière de soin par défaut (décision 9) : 2 personnes, à 5 pieds. */
const SOIN_BASE: ConfigMagie = {
  niveau: 1,
  zone: "2 Cibles",
  portee: "5 Pieds",
  duree: "Instantanée",
};
/** Le soin du front : au toucher, une cible, niveau 3 (2 PV). */
const SOIN_CONTACT: ConfigMagie = {
  niveau: 3,
  zone: "1 Cible",
  portee: "Toucher",
  duree: "Instantanée",
};
/** ④ Soigneur : la même prière, montée au niveau 3 (surclassement, delta dérivé). */
const SOIN_BASE_N3: ConfigMagie = { ...SOIN_BASE, niveau: 3 };

const ROLES_PRETRE: readonly RoleClasse[] = [
  {
    id: "pSoigne",
    emoji: "✝️",
    titre: "Le Soigneur",
    phrase: "Tu remets les tiens debout.",
    requiert: () => null,
    noyau: () => [comp("Réveil Expéditif", 1), priere("Soins", SOIN_BASE)],
  },
  {
    id: "pFront",
    emoji: "🛡️",
    titre: "Le Prêtre de front",
    phrase: "Tu pries sous les coups, au contact.",
    requiert: (inv) =>
      PROTECTIONS_PRETRE.some((p) => inv.has(p.caseId))
        ? null
        : "Il te faut au moins une protection apportée — une armure (cuir ou maille) ou un bouclier (targe ou écu). Coche ce que tu as dans « Qu'as-tu apporté ? ».",
    noyau: (inv) => [
      ...PROTECTIONS_PRETRE.filter((p) => inv.has(p.caseId)).map((p) =>
        comp(p.nom, 1)
      ),
      priere("Soins", SOIN_CONTACT),
    ],
  },
  {
    id: "pRite",
    emoji: "⛪",
    titre: "Le Prêtre de rite",
    phrase: "Tu bénis, tu consacres, tu célèbres.",
    requiert: () => null,
    noyau: () => [
      comp("Consécration", 1),
      comp("Bénédiction", 2),
      comp("Grande Messe", 1),
    ],
  },
];

const POOL3_PRETRE: Record<string, EntreePool[]> = {
  Soutien: [
    {
      label: "Diagnostic",
      note: "Lire l'état d'un blessé avant d'agir.",
      achats: () => [comp("Diagnostic", 1)],
    },
    {
      label: "Réveil Expéditif",
      note: "Relever un inconscient en quelques secondes.",
      achats: () => [comp("Réveil Expéditif", 1)],
    },
    {
      label: "Bénédiction 2",
      note: "Ta bénédiction gagne un palier.",
      achats: () => [comp("Bénédiction", 2)],
    },
    {
      label: "Grande Messe",
      note: "Célébrer pour tout un groupe.",
      achats: () => [comp("Grande Messe", 1)],
    },
    {
      label: "Méditation",
      note: "Regagner des PS en jeu.",
      achats: () => [comp("Méditation", 1)],
    },
  ],
  Défensif: [
    ...PROTECTIONS_PRETRE.map<EntreePool>((p) => ({
      label: p.nom,
      note: "Utiliser ce que tu as apporté.",
      achats: () => [comp(p.nom, 1)],
      condition: (inv) => inv.has(p.caseId),
    })),
    {
      label: "Résistance à la magie",
      note: "Encaisser les sorts adverses (plafonnée niveau 1 hors-classe).",
      achats: () => [comp("Résistance à la magie", 1)],
    },
  ],
  Rituel: [
    {
      label: "Consécration",
      note: "Consacrer un lieu, un objet.",
      achats: () => [comp("Consécration", 1)],
    },
    {
      label: "Formation Théologique",
      note: "Le savoir du clergé.",
      achats: () => [comp("Formation Théologique", 1)],
    },
    {
      label: "Rêves",
      note: "Recevoir des songes de ta divinité.",
      achats: () => [comp("Rêves", 1)],
    },
  ],
};

const POND4_PRETRE: ContenuClasse["pond4"] = {
  pSoigne: [
    {
      type: "achats",
      label: "monter Soins au niveau 3",
      achats: () => [priere("Soins", SOIN_BASE_N3)],
    },
    { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
    { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 15 },
  ],
  pFront: [
    { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
    {
      type: "achats",
      label: "Premiers Soins 2",
      achats: () => [comp("Premiers Soins", 2)],
    },
    { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 15 },
  ],
  pRite: [
    { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 15 },
    {
      type: "achats",
      label: "Grande Messe 2",
      achats: () => [comp("Grande Messe", 2)],
    },
    { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
  ],
};

export const CONTENU_PRETRE: ContenuClasse = {
  classe: CLASSE_PRETRE,
  gratuites: GRATUITES_PRETRE,
  roles: ROLES_PRETRE,
  pool3: POOL3_PRETRE,
  pond4: POND4_PRETRE,
  filet: FILET_CASTER,
};

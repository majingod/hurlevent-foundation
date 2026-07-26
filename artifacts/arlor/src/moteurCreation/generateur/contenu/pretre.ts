import {
  comp,
  FILET_CASTER,
  priereAuChoix,
  type ContenuClasse,
  type EntreePool,
  type RoleClasse,
} from "./commun";

/**
 * [VIS-8 lot A2-Prêtre, s360] Contenu PRÊTRE — les 4 archétypes MESURÉS sur
 * les prêtres de la prod (CONCEPTION §4.0.3), et non plus les rôles conçus.
 *
 * 🛡️ `pFront` (« Le Prêtre de front ») est SUPPRIMÉ et son id devient
 * `pMissionnaire` (table des ids, référence §1). Ce n'est PAS un renommage :
 * le groupe mesuré porte la foi au front « par la prière, pas par l'armure »
 * — Canalisation et trois prières de Guerre, zéro protection au noyau.
 *
 * ⭐ QUATRE RÈGLES ARBITRÉES QUI SURPLOMBENT CE FICHIER (référence §5.2) :
 *
 *  1. LE DOMAINE N'EST PAS LE CERCLE. Le cercle du mage est libre ; le
 *     domaine est BORNÉ PAR LA RELIGION (15 religions × 2 domaines proscrits,
 *     trigger `tg_refuser_domaine_proscrit` en base). Le contenu ne NOMME donc
 *     aucune prière : il demande `priereAuChoix(rang)` et le catalogue résout.
 *
 *  2. ARCHÉTYPE D'ABORD, RELIGION ENSUITE (§5.2 ③). 🕊️ et 📿 IMPOSENT leur
 *     domaine (`magieImposee`, mesuré 2/2 au noyau) ; ⛪ et ✝️ le laissent au
 *     joueur. Tirer la foi en premier rendrait les deux premiers
 *     inaccessibles au hasard — 4 religions proscrivent la Guerre, 1 la
 *     Bénédiction. Le refus motivé en 🧭 vit dans le RÉSOLVEUR, pas ici.
 *
 *  3. LA PRIÈRE REPRÉSENTATIVE EST LA PLUS PORTÉE, jamais la moins chère
 *     (`ordonnerPrieresRepresentatives`). La règle du mage (« le sort de
 *     dégâts sinon le moins cher ») NE SE TRANSPOSE PAS : 4 prières de dégâts
 *     sur 64, et aucune des 8 plus portées de son domaine n'en fait.
 *
 *  4. UNE PRIÈRE NE SORT JAMAIS EN « PERSONNELLE » quand son modèle permet de
 *     viser autrui (garde dans `configGenerateur`). Sans elle, ✝️ le soigneur
 *     sortait en soignant UNIQUEMENT LUI-MÊME.
 *
 * ⚠️ REPORTÉ AU RÉSOLVEUR — « un DEUXIÈME domaine » n'est pas exprimable ici :
 * le contenu n'a qu'un `o.element`. Or la mesure en trouve dans le ③ de trois
 * rôles (Éléments, Bénédiction, Nécromancie, Chaos, Ordre, Nature). Même
 * limite que « un deuxième cercle » côté mage (s358) — à rouvrir ensemble.
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

/** Le refus quand le domaine manque — même patron que « choisis ton cercle ». */
const SANS_DOMAINE =
  "Choisis d'abord ton domaine de prière — et ta religion, qui en proscrit deux.";

const ROLES_PRETRE: readonly RoleClasse[] = [
  {
    // n = 4, cohésion 0.72 · Dahlia, Simon De Foix, Valérie Montgomery, Éléonore.
    // ② mesuré ≥ 80 % : Méditation 4/4 · Développement Spirituel 4/4 · Revenu 4/4.
    // ⚠️ « des domaines variés et zéro soin » : son domaine reste au joueur.
    id: "pRite",
    emoji: "⛪",
    titre: "Le prêtre de rite",
    phrase: "Tu vis de l'étude et de la cérémonie.",
    requiert: (_inv, o) => (o.element ? null : SANS_DOMAINE),
    noyau: () => [
      comp("Méditation", 1),
      comp("Développement Spirituel", 1),
      comp("Revenu", 1),
      priereAuChoix(1),
    ],
  },
  {
    // n = 4, cohésion 0.65 · Muir-Natha Dagon, Zoé, Bas-Blanc Tamalou,
    // Nathanaël di Vitae. ② mesuré : Réveil Expéditif 4/4 · Premiers Soins 4/4.
    // ⚠️ `Domaine:Bénédiction` est à 3/4 — donc ③, PAS ② : on ne l'impose pas.
    id: "pSoigne",
    emoji: "✝️",
    titre: "Le soigneur",
    phrase: "Tu remets les tiens debout.",
    requiert: (_inv, o) => (o.element ? null : SANS_DOMAINE),
    noyau: () => [
      comp("Réveil Expéditif", 1),
      comp("Premiers Soins", 1),
      priereAuChoix(1),
    ],
  },
  {
    // n = 2, cohésion 0.78 · Virgile Azmir Saren, Aymon Le missionnaire.
    // ② mesuré 2/2 : Canalisation · Développement Spirituel · Domaine:Guerre
    //                · « ≥ 3 prières ».
    id: "pMissionnaire",
    emoji: "🕊️",
    titre: "Le missionnaire",
    phrase: "Tu portes la foi au front — par la prière, pas par l'armure.",
    magieImposee: "Guerre",
    requiert: () => null,
    noyau: () => [
      comp("Canalisation", 1),
      comp("Développement Spirituel", 1),
      priereAuChoix(1),
      priereAuChoix(2),
      priereAuChoix(3),
    ],
  },
  {
    // n = 2, cohésion 0.67 · Kaelen Fordrénus, Orion Valombre.
    // ② mesuré 2/2 : Consécration · Domaine:Bénédiction.
    // « presque rien d'autre : tout en prières, budget compétences minimal ».
    id: "pConsecrateur",
    emoji: "📿",
    titre: "Le consécrateur",
    phrase: "Tu consacres. Le reste attendra.",
    magieImposee: "Bénédiction",
    requiert: () => null,
    noyau: () => [comp("Consécration", 1), priereAuChoix(1)],
  },
];

/**
 * ⭐ s352 — MONTÉES SIGNATURE, prises EN TÊTE de ③, jamais tirées.
 * Les 4 sont MESURÉES (référence §4) et toutes légales à la création.
 * ⚠️ 📿 `Consécration@2` est PLAFONNÉE : les deux vrais sont à 3, via un
 * maître en jeu — impossible à la création (verrou §2.5).
 */
const SIGNATURE3_PRETRE: Record<string, EntreePool[]> = {
  pRite: [
    {
      label: "Acquisition de Domaine 2",
      note: "Ton domaine s'ouvre aux prières plus hautes.",
      achats: () => [comp("Acquisition de Domaine", 2)],
    },
    {
      label: "Bénédiction 2",
      note: "Ta bénédiction gagne un palier.",
      achats: () => [comp("Bénédiction", 2)],
    },
  ],
  pSoigne: [
    {
      label: "Premiers Soins 2",
      note: "Tu soignes plus vite et plus fort.",
      achats: () => [comp("Premiers Soins", 2)],
    },
  ],
  pMissionnaire: [
    {
      label: "Acquisition de Domaine 2",
      note: "La Guerre s'ouvre aux prières plus hautes.",
      achats: () => [comp("Acquisition de Domaine", 2)],
    },
  ],
  pConsecrateur: [
    {
      label: "Consécration 2",
      note: "Tu consacres plus grand, plus longtemps.",
      achats: () => [comp("Consécration", 2)],
    },
  ],
};

/**
 * ③b POOL — PARTAGÉ entre les 4 rôles, indexé par thème (patron s355).
 * Contenu = l'UNION des ③ ESSENTIELS mesurés (§4.0.3), moins les entrées
 * « Domaine:X » qui demandent un SECOND domaine, non exprimable ici.
 *
 * ⚠️ « Défensif » est la seule famille HORS MESURE : aucun des 4 groupes ne
 * porte de protection en ③. Elle est conservée par UTILITÉ D'INVENTAIRE —
 * un joueur qui a coché une maille doit pouvoir la porter — et reste
 * conditionnée à ce qu'il a réellement apporté, donc invisible sinon.
 */
const POOL3_PRETRE: Record<string, EntreePool[]> = {
  Soin: [
    {
      label: "Diagnostic",
      note: "Lire l'état d'un blessé avant d'agir.",
      achats: () => [comp("Diagnostic", 1)],
    },
    {
      label: "Chirurgien",
      note: "Opérer, pas seulement recoudre.",
      achats: () => [comp("Chirurgien", 1)],
    },
    {
      label: "Premiers Soins",
      note: "Le geste de base, sur le terrain.",
      achats: () => [comp("Premiers Soins", 1)],
    },
    {
      label: "Connaissances des Herbes Communes",
      note: "Reconnaître ce qui pousse et ce qui soigne.",
      achats: () => [comp("Connaissances des Herbes Communes", 1)],
    },
    {
      label: "Herbalisme",
      note: "Préparer les remèdes toi-même.",
      achats: () => [comp("Herbalisme", 1)],
    },
  ],
  Clergé: [
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
    {
      label: "Une prière de plus",
      note: "Élargir ton répertoire dans ton domaine.",
      achats: () => [priereAuChoix(2)],
    },
    {
      label: "Méditation",
      note: "Regagner des points de spiritualité en jeu.",
      achats: () => [comp("Méditation", 1)],
    },
  ],
  Savoir: [
    {
      label: "Estimation",
      note: "Mettre un prix sur une relique, une offrande.",
      achats: () => [comp("Estimation", 1)],
    },
    {
      label: "Langue supplémentaire",
      note: "Prêcher hors de ta langue.",
      achats: () => [comp("Langue supplémentaire", 1)],
    },
    {
      label: "Développement Spirituel",
      note: "Plus de points de spiritualité.",
      achats: () => [comp("Développement Spirituel", 1)],
    },
  ],
  Défensif: PROTECTIONS_PRETRE.map<EntreePool>((p) => ({
    label: p.nom,
    note: "Utiliser ce que tu as apporté.",
    achats: () => [comp(p.nom, 1)],
    condition: (inv) => inv.has(p.caseId),
  })),
};

/**
 * ④ PONDÉRATION — l'ordre où part le budget restant, propre à chaque rôle.
 *
 * ⚠️⚠️ `Connaissances des Religions` A ÉTÉ RETIRÉE (mesuré s360). L'ancienne
 * version l'ouvrait à `plafondRachats: 15` — le même chiffre de conception,
 * jamais mesuré, qui avait déjà été corrigé chez les martiaux en s353. Or
 * c'est une GRATUITÉ de classe, et les **17 prêtres vivants sur 17** la
 * portent à exactement **1** : aucun n'en a jamais racheté une seule. Le
 * générateur pouvait y brûler jusqu'à 60 XP.
 *
 * Les plafonds conservés sont MESURÉS sur les 17 prêtres vivants (2026-07-25) :
 *  · `Développement Spirituel`  max 10, et 8 porteurs sur 12 sont PILE à 10 —
 *    plateau net, c'est le plafond du jeu (ps_depart 10), pas un maximum
 *    d'échantillon.
 *  · `Langue supplémentaire`    max 4 (un seul prêtre ; les 5 autres à 1-2).
 */
const POND4_PRETRE: ContenuClasse["pond4"] = {
  pRite: [
    { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
    {
      type: "achats",
      label: "Estimation",
      achats: () => [comp("Estimation", 1)],
    },
    { type: "jauge", nom: "Langue supplémentaire", plafondRachats: 4 },
  ],
  pSoigne: [
    {
      type: "achats",
      label: "Diagnostic",
      achats: () => [comp("Diagnostic", 1)],
    },
    { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
    { type: "jauge", nom: "Langue supplémentaire", plafondRachats: 4 },
  ],
  pMissionnaire: [
    { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
    {
      type: "achats",
      label: "Premiers Soins",
      achats: () => [comp("Premiers Soins", 1)],
    },
    { type: "jauge", nom: "Langue supplémentaire", plafondRachats: 4 },
  ],
  pConsecrateur: [
    {
      type: "achats",
      label: "Formation Théologique",
      achats: () => [comp("Formation Théologique", 1)],
    },
    { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
    { type: "jauge", nom: "Langue supplémentaire", plafondRachats: 4 },
  ],
};

export const CONTENU_PRETRE: ContenuClasse = {
  classe: CLASSE_PRETRE,
  gratuites: GRATUITES_PRETRE,
  roles: ROLES_PRETRE,
  signature3: SIGNATURE3_PRETRE,
  pool3: POOL3_PRETRE,
  pond4: POND4_PRETRE,
  filet: FILET_CASTER,
};

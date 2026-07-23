import type { EtatPossession } from "../couts";

/**
 * [VIS-8 lot 2a] CONTENU du Guerrier — porté depuis la conception arrêtée
 * (§4.1 s341, pools/pondérations §4.5 s346). C'est du CONTENU versionné
 * (décision Fred s348) : Fred l'ajuste par PR ; le test d'intégrité casse si
 * un nom référencé quitte le catalogue.
 *
 * Les entrées sont des CIBLES { nom, niveauCible } + conditions d'inventaire ;
 * les PRIX ne sont jamais écrits ici — ils sont dérivés du catalogue par
 * `cheminComplet` (R3), et les tests attestent qu'ils retombent sur les
 * chiffres mesurés de la spec.
 */

export const CLASSE = "guerrier" as const;

export const GRATUITES_GUERRIER = [
  "Bravoure",
  "Compétence d'arme à deux mains",
] as const;

export interface Cible {
  nom: string;
  niveauCible: number;
}

/* ------------------------------------------------------------------ */
/* Cases d'inventaire → genres d'armes / protections (ids réels
   `objets_generateur`, PR #712).                                      */

export const CASES_ARMES_PAR_GENRE = {
  deuxMains: ["lame_deux_mains"],
  impact: ["contondante_courte", "contondante_moyenne", "contondante_longue"],
  hache: ["hache"],
  hast: ["baton_hast"],
  lame: ["lame_courte", "lame_moyenne", "lame_longue"],
  /** ⚠️ jamais un créneau ⚔️ : catégorie voleur, cul-de-sac (Gotcha A43). */
  distance: ["arme_distance"],
} as const;

export const CASES_PROTECTIONS: readonly {
  caseId: string;
  competence: string;
}[] = [
  { caseId: "targe", competence: "Maniement du petit bouclier" },
  { caseId: "ecu", competence: "Maniement du bouclier moyen" },
  { caseId: "pavois", competence: "Maniement du grand bouclier" },
  { caseId: "armure_cuir", competence: "Port d'armure légère" },
  { caseId: "armure_maille", competence: "Port d'armure intermédiaire" },
  { caseId: "armure_plaques", competence: "Port d'armure lourde" },
];

const auMoinsUne = (inv: ReadonlySet<string>, cases: readonly string[]) =>
  cases.some((c) => inv.has(c));

/* ------------------------------------------------------------------ */
/* Les 3 rôles (noyaux ②). Le créneau ⚔️ vise l'effet OFFENSIF de chaque
   genre (carte équipement v3 §0) : deux mains (offerte) > impact niv 1 >
   hache niv 1 (Botte en prérequis) > hast niv 2 > lame niv 2.            */

export interface RoleGuerrier {
  id: "gFrappe" | "gTient" | "gArtisan";
  emoji: string;
  titre: string;
  phrase: string;
  /** null = jouable ; sinon la raison du refus (avec quoi rattraper). */
  requiert: (inv: ReadonlySet<string>) => string | null;
  /** Cibles du noyau (hors gratuités). */
  noyau: (inv: ReadonlySet<string>) => Cible[];
}

const CRENEAU_FRAPPE: readonly {
  genre: keyof typeof CASES_ARMES_PAR_GENRE;
  cibles: Cible[];
}[] = [
  { genre: "deuxMains", cibles: [] }, // compétence offerte (couche ①)
  { genre: "impact", cibles: [{ nom: "Compétence d'arme d'impact", niveauCible: 1 }] },
  { genre: "hache", cibles: [{ nom: "Compétence d'arme à la hache", niveauCible: 1 }] },
  { genre: "hast", cibles: [{ nom: "Compétence d'arme d'hast", niveauCible: 2 }] },
  { genre: "lame", cibles: [{ nom: "Compétence d'arme à la lame", niveauCible: 2 }] },
];

export const ROLES_GUERRIER: readonly RoleGuerrier[] = [
  {
    id: "gFrappe",
    emoji: "⚔️",
    titre: "Celui qui frappe",
    phrase: "Il gagne les échanges : il désarme, puis brise le bouclier.",
    requiert: (inv) => {
      const uneArme = CRENEAU_FRAPPE.some((c) =>
        auMoinsUne(inv, CASES_ARMES_PAR_GENRE[c.genre])
      );
      if (uneArme) return null;
      return auMoinsUne(inv, CASES_ARMES_PAR_GENRE.distance)
        ? "Un arc seul ne suffit pas : la Compétence d'arme à distance est de catégorie voleur — un Guerrier y plafonne au niveau 1, sans jamais l'effet offensif. Il te faut une arme de mêlée."
        : "Il te faut une arme de mêlée (lame, hache, masse, bâton…).";
    },
    noyau: (inv) => {
      const creneau =
        CRENEAU_FRAPPE.find((c) =>
          auMoinsUne(inv, CASES_ARMES_PAR_GENRE[c.genre])
        )?.cibles ?? [];
      return [...creneau, { nom: "Botte Secrète", niveauCible: 1 }];
    },
  },
  {
    id: "gTient",
    emoji: "🛡️",
    titre: "Celui qui tient",
    phrase: "On ne le déplace pas et on ne passe pas.",
    // ⚠️ UN SEUL créneau obligatoire (décision s341) : bouclier OU armure.
    requiert: (inv) =>
      CASES_PROTECTIONS.some((p) => inv.has(p.caseId))
        ? null
        : "Il te faut un bouclier ou une armure.",
    noyau: (inv) => [
      { nom: "Désengagement", niveauCible: 1 },
      ...CASES_PROTECTIONS.filter((p) => inv.has(p.caseId)).map((p) => ({
        nom: p.competence,
        niveauCible: 1,
      })),
    ],
  },
  {
    id: "gArtisan",
    emoji: "🔨",
    titre: "L'artisan",
    phrase: "Il transforme le métal. Jouable sans rien apporter.",
    requiert: () => null, // aucun créneau — le rôle le plus stable des trois
    noyau: () => [
      { nom: "Forge", niveauCible: 1 },
      { nom: "Mineur", niveauCible: 1 },
      { nom: "Renforcement défensif", niveauCible: 1 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Couche ③ — pool du Guerrier par style (§4.5). `condition` = case(s)
   d'inventaire requise(s)   */

export interface ItemPool {
  nom: string;
  niveauCible: number;
  note: string;
  condition?: (inv: ReadonlySet<string>) => boolean;
}

export const POOL3_GUERRIER: Record<
  "Offensif" | "Défensif" | "Spécialisé",
  ItemPool[]
> = {
  Offensif: [
    {
      nom: "Charge",
      niveauCible: 1,
      note: "si arme à deux mains — Botte Secrète déjà au noyau",
      condition: (inv) => inv.has("lame_deux_mains"),
    },
    {
      nom: "Combat à deux armes",
      niveauCible: 1,
      note: "si deux armes identiques",
      condition: (inv) => inv.has("deux_armes_identiques"),
    },
    { nom: "Berserk", niveauCible: 1, note: "2 PV temporaires, +2 en résistance aux sorts à effet" },
    { nom: "Résolution Guerrière", niveauCible: 1, note: "agir normalement à 1 PV" },
  ],
  Défensif: [
    {
      nom: "Défense Inflexible",
      niveauCible: 1,
      note: "encaisse un sort, 1×/combat — tête de liste (décision s341)",
    },
    { nom: "Poids Lourd", niveauCible: 1, note: "ignore le premier repoussement de chaque combat" },
    { nom: "Bonne santé", niveauCible: 1, note: "+1 PV à chaque soin reçu" },
    { nom: "Corps Sain", niveauCible: 1, note: "1 potion de plus par cycle" },
    { nom: "Résistance à la magie", niveauCible: 1, note: "résister à un sort à effet, 1×/événement" },
  ],
  Spécialisé: [
    { nom: "Forge", niveauCible: 1, note: "prix chemin : Métaux Communs inclus" },
    { nom: "Discours du Commandement", niveauCible: 1, note: "2 à 6 alliés ignorent une attaque" },
    {
      nom: "Dépeçage",
      niveauCible: 1,
      note: "prix chemin : Créatures + Premiers Soins inclus ⚠️ Premiers Soins plafonné (hors classe)",
    },
  ],
};

/** R1 pilote — protections orphelines : cases cochées non couvertes. */
export function orphelinsProtection(
  inv: ReadonlySet<string>,
  possede: EtatPossession
): Cible[] {
  return CASES_PROTECTIONS.filter(
    (p) => inv.has(p.caseId) && !(possede.niveaux.get(p.competence) ?? 0)
  ).map((p) => ({ nom: p.competence, niveauCible: 1 }));
}

/* ------------------------------------------------------------------ */
/* Couche ④ — pondérations par rôle (§4.5) + FILET (règle gravée s346 :
   toute pondération se TERMINE sur les jauges de classe ; martial =
   Religions 4 XP puis Langues 5 XP, un reste de 1-3 XP est assumé).      */

export type Etape4 =
  | { type: "achat"; nom: string; niveauCible: number }
  | { type: "jauge"; nom: string; plafondRachats: number };

export const POND4_GUERRIER: Record<
  "gFrappe" | "gTient" | "gArtisan",
  Etape4[]
> = {
  gFrappe: [
    { type: "achat", nom: "Berserk", niveauCible: 1 },
    { type: "achat", nom: "Corps Sain", niveauCible: 1 },
    { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 15 },
  ],
  gTient: [
    { type: "achat", nom: "Bonne santé", niveauCible: 1 },
    { type: "achat", nom: "Corps Sain", niveauCible: 1 },
    { type: "achat", nom: "Résistance à la magie", niveauCible: 1 },
    { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 15 },
  ],
  gArtisan: [
    { type: "achat", nom: "Forge", niveauCible: 2 },
    { type: "achat", nom: "Connaissances des Métaux Rares", niveauCible: 1 },
    { type: "achat", nom: "Estimation", niveauCible: 1 },
    { type: "jauge", nom: "Langue supplémentaire", plafondRachats: 6 },
  ],
};

export const FILET_MARTIAL: Etape4[] = [
  { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 15 },
  { type: "jauge", nom: "Langue supplémentaire", plafondRachats: 6 },
];

/* ------------------------------------------------------------------ */
/* [lot 2b] Adaptateur vers le contrat GÉNÉRIQUE (contenu/commun.ts) —
   les structures pilotes ci-dessus restent la source ; on les adapte,
   on ne les duplique pas.                                              */

import {
  comp,
  FILET_MARTIAL_COMMUN,
  type ContenuClasse,
  type EntreePool,
  type EtapePond,
  type RoleClasse,
} from "./commun";

const adaptePool = (items: readonly ItemPool[]): EntreePool[] =>
  items.map((i) => ({
    label: i.nom,
    note: i.note,
    achats: () => [comp(i.nom, i.niveauCible)],
    condition: i.condition ? (inv) => i.condition!(inv) : undefined,
  }));

const adaptePond = (etapes: readonly Etape4[]): EtapePond[] =>
  etapes.map((e) =>
    e.type === "achat"
      ? {
          type: "achats" as const,
          label: `${e.nom} ${e.niveauCible}`,
          achats: () => [comp(e.nom, e.niveauCible)],
        }
      : { type: "jauge" as const, nom: e.nom, plafondRachats: e.plafondRachats }
  );

export const CONTENU_GUERRIER: ContenuClasse = {
  classe: CLASSE,
  gratuites: GRATUITES_GUERRIER,
  alertesGratuites: (inv) =>
    inv.has("lame_deux_mains")
      ? []
      : [
          "La Compétence d'arme à deux mains est offerte, mais sans arme à deux mains apportée elle reste inutilisable pour l'instant.",
        ],
  roles: ROLES_GUERRIER.map<RoleClasse>((r) => ({
    id: r.id,
    emoji: r.emoji,
    titre: r.titre,
    phrase: r.phrase,
    requiert: (inv) => r.requiert(inv),
    noyau: (inv) => r.noyau(inv).map((c) => comp(c.nom, c.niveauCible)),
  })),
  pool3: {
    Offensif: adaptePool(POOL3_GUERRIER.Offensif),
    Défensif: adaptePool(POOL3_GUERRIER["Défensif"]),
    Spécialisé: adaptePool(POOL3_GUERRIER["Spécialisé"]),
  },
  pond4: {
    gFrappe: adaptePond(POND4_GUERRIER.gFrappe),
    gTient: adaptePond(POND4_GUERRIER.gTient),
    gArtisan: adaptePond(POND4_GUERRIER.gArtisan),
  },
  filet: FILET_MARTIAL_COMMUN,
};

/**
 * [VIS-8 lot R1b, s362] LE RÉSOLVEUR — la couche entre le joueur et le moteur.
 *
 * Le composeur (`composerClasse`) attend un `ContexteComposition` complet et
 * ne connaît NI la race, NI la religion, NI le trait racial. Ce module produit
 * ce contexte, dans les deux modes :
 *
 *  - 🎲 `tirerPersonnage`   : tout est tiré au sort — race, classe, rôle,
 *    cercle/domaine, religion (EN SORTIE), second élément quand la politique
 *    l'accorde. Chaque tirage pioche dans un pool PRÉ-FILTRÉ à la source
 *    (patron #720) : jamais de rejet après coup, jamais d'interdit tiré.
 *  - 🧭 `resoudreChoix`     : le joueur a choisi ; le résolveur VALIDE et
 *    refuse AVEC SA PHRASE (patron « l'arc seul »), jamais en silence.
 *
 * Règles codées TELLES QUELLES depuis `VIS8_archetypes_REFERENCE_v10.md` :
 *  - §5.1 ② : Nécromancie et Magie Noire (cercles) — proposables en 🧭 (13),
 *    JAMAIS tirées en 🎲 (11). Motif : magies interdites dans Destéa, un
 *    hors-la-loi doit être un choix conscient, jamais un hasard.
 *  - §5.2 ② : le domaine de Nécromancie — proposable en 🧭 (8), jamais tiré
 *    en 🎲 (7). ⚠️ MOTIF DIFFÉRENT du cercle : proscrit par 6 religions et
 *    LÉGITIME dans 9 — affaire de foi, pas de loi. Ne pas fusionner les deux.
 *  - §5.2 ③ : ARCHÉTYPE D'ABORD, RELIGION ENSUITE. 🎲 apparie la religion
 *    d'abord parmi celles dont le domaine est PRINCIPAL (arbitrage s360) ;
 *    garde-fou conservé : jamais une religion qui le proscrit.
 *  - §2.2 conduite 1 : AVANT le fix [INAPTE-MAGIE-MODELE-INSTANCE], l'appelant
 *    met `inapteMagie` à vrai pour tout porteur POTENTIEL — c'est exactement
 *    `raceInapteMagie` (pool de la race), le dériveur partagé du moteur
 *    hors-ligne. Quand le fix passera l'inaptitude du modèle à l'instance,
 *    cette seule dérivation changera ; le résolveur suivra sans bouger.
 *    `resoudreChoix` accepte déjà `traitsChoisis` : si l'appelant connaît les
 *    traits (monde post-fix), l'INSTANCE prime sur le modèle.
 *  - §2.2 conduite 3 : le trait s'adapte à l'archétype, pas l'inverse — la
 *    sortie `traitsIncompatibles` liste ce que le préfill du wizard devra
 *    écarter du pool de traits (règle de jeu s351 : le porteur d'« Inapte à
 *    la magie » ne peut avoir AUCUNE compétence à PS — appliquée à la FICHE
 *    produite, couche ④ comprise).
 *  - Politique `element2` (arbitrage Fred s361) : 🎲 ne le pose que pour
 *    ✨ ᚱ 🕊️ 📿 ; 🧭 le laisse partout.
 *  - Second domaine de 🕊️/📿 (arbitrage Fred s362, C3) : tiré parmi les
 *    domaines tirables ∖ {imposé}, et la religion doit porter l'imposé en
 *    PRINCIPAL sans proscrire le second — un missionnaire tiré n'est jamais
 *    en tension avec sa propre foi, même sur son domaine d'appoint.
 *
 * Module PUR : données injectées (fixture dans les tests, snapshot en prod),
 * aléa injectable (`() => number` dans [0,1), même contrat que
 * `tirerEssentielsClasse`). Aucun import de JSON, aucun singleton.
 */

import { raceInapteMagie } from "../deriveurs";
import { construireIndex, raceAccessible } from "../exigences";
import type { ObjetRequis } from "../snapshot";
import {
  composerClasse,
  raisonRoleInapte,
  tirerEssentielsClasse,
  type Catalogues,
} from "./composer";
import {
  archetypeDemandeDesPS,
  estCompetenceAPS,
  type ContenuClasse,
  type RoleClasse,
} from "./contenu/commun";
import {
  POIDS_SOUS_TYPE_CHIMERIDE,
  POIDS_TRAITS,
  cleRaceTraits,
  poidsDe,
  tirerSansRemisePondere,
} from "./contenu/traits";
import type {
  Composition,
  CompositionOk,
  ContexteComposition,
} from "./types";

type ClasseId = ContexteComposition["classe"];

/* ------------------------------------------------------------------ */
/* Constantes de game-design (les EXCLUSIONS seules — les listes       */
/* complètes viennent du catalogue, jamais d'ici).                     */
/* ------------------------------------------------------------------ */

/** Référence §5.1 ② — cercles jamais tirés en 🎲 (13 → 11). */
export const CERCLES_JAMAIS_TIRES: readonly string[] = [
  "Magie Noire",
  "Nécromancie",
];

/** Référence §5.2 ② — domaine jamais tiré en 🎲 (8 → 7). Une seule
 *  exclusion : les 8 domaines n'incluent pas Magie Noire (mesuré s361). */
export const DOMAINES_JAMAIS_TIRES: readonly string[] = ["Nécromancie"];

/** Arbitrage Fred s361 — les seuls rôles pour lesquels 🎲 pose `element2`
 *  (les 2/2 mesurés). En 🧭 le joueur peut le poser partout. */
export const ROLES_ELEMENT2: readonly string[] = [
  "mEnchanteur",
  "mRuniste",
  "pMissionnaire",
  "pConsecrateur",
];

export const TRAIT_INAPTE = "Inapte à la magie";

/** Ordre FIXE du tirage de classe — chaque grande famille a la même chance
 *  (¼), quel que soit son nombre d'archétypes (choix C1, s362). */
const CLASSES: readonly ClasseId[] = ["guerrier", "mage", "pretre", "voleur"];

/** ⭐ [s367, lot 🧭] Ordre d'AFFICHAGE des voies — du moins au plus
 *  contraint (maquette validée Fred s366). Distinct de `CLASSES`, qui est
 *  l'ordre de TIRAGE et dont le motif est l'équiprobabilité (choix C1) :
 *  deux maisons parce que deux motifs. */
const ORDRE_VOIES: readonly ClasseId[] = ["guerrier", "voleur", "mage", "pretre"];

/* ------------------------------------------------------------------ */
/* Types d'entrée / sortie                                             */
/* ------------------------------------------------------------------ */

export interface RaceMonde {
  id: string;
  nom: string;
  xp_depart: number;
  est_actif: boolean;
  est_jouable: boolean;
}

export interface ReligionMonde {
  id: string;
  nom: string;
  domaines_principaux: readonly string[];
  domaines_proscrits: readonly string[];
  est_actif: boolean;
}

/** Les tables « monde » que le résolveur consomme. En prod : les mêmes
 *  lignes que le snapshot visiteur ; dans les tests : la fixture
 *  `monde_resolveur.fixture.json` (capture MCP prod, s362). */
export interface MondeResolveur {
  races: readonly RaceMonde[];
  /**
   * ⚠️ [C99, s380] `sous_type` FAIT PARTIE DU CONTRAT. La colonne existe en
   * base et le snapshot la porte (`snapshot.ts` : `RaceTrait = Row` complet) ;
   * tant que ce type local l'ignorait, le filtrage par sous-type était
   * invisible à la compilation et un Chiméride carnivore pouvait recevoir
   * « Instinct de survie » (herbivore). `null` = trait de toute la race.
   */
  race_traits: readonly {
    race_id: string;
    trait_id: string;
    sous_type: string | null;
  }[];
  /**
   * ⚠️ [D53, s381] `description` FAIT PARTIE DU CONTRAT, au même titre que
   * `sous_type` (C99) : la colonne existe en base (`traits_raciaux.description`,
   * non nullable) et le snapshot la porte déjà (cast `as unknown as
   * MondeResolveur` dans `pontSnapshot.ts` — la vraie ligne passe intacte).
   * Sans elle dans le type, le barreau « Ton héritage » ne pouvait pas
   * afficher le texte du manuel sans un second accès au snapshot.
   */
  traits_raciaux: readonly {
    id: string;
    nom: string;
    est_actif: boolean;
    description: string;
  }[];
  religions: readonly ReligionMonde[];
  objets_requis: readonly ObjetRequis[];
}

export interface DepsResolveur {
  parClasse: Readonly<
    Record<ClasseId, { cats: Catalogues; contenu: ContenuClasse }>
  >;
  monde: MondeResolveur;
}

/** Aléa injectable — [0, 1), même contrat que `tirerEssentielsClasse`. */
export type Alea = () => number;

export interface TiragePersonnage {
  raceId: string;
  raceNom: string;
  budget: number;
  classe: ClasseId;
  roleId: string;
  /** Cercle (mage) / domaine (prêtre) EFFECTIF — imposé ou tiré. */
  element?: string;
  element2?: string;
  religionId?: string;
  religionNom?: string;
  inapteMagie: boolean;
  /** Conduite 3 (§2.2) : traits que le préfill devra écarter du pool. */
  traitsIncompatibles: string[];
  /**
   * ⭐ [D52, s380] Le SOUS-TYPE tiré, quand la race en exige un (le Chiméride,
   * seul concerné aujourd'hui). Absent pour les 10 autres races. Sans lui, la
   * fiche du 🎲 était bloquée à l'étape 2 (`sous_type_chimeride_manquant`) :
   * le générateur ne posait rien et le joueur ne savait pas où aller.
   * Tiré AVANT le trait — le pool de traits en dépend.
   */
  sousTypeChimeride?: string;
  /**
   * ⭐ [D52, s380] LE TRAIT RACIAL GRATUIT, NOMMÉ (patron `ItemTire` de
   * l'artisanat, D34 : tiré = affiché = acheté). Le nom sort du moteur parce
   * que la FICHE en a besoin AVANT la conversion ; l'id parce que
   * `versBrouillon` écrit `{ trait_id, est_gratuit, xp_depense }` (C79).
   *
   * Posé par 🎲 seulement — 🧭 laisse le joueur choisir au wizard. Quand
   * `inapteMagie` est vrai (Demi-Orc martial, D42), c'est « Inapte à la magie »
   * qui est nommé ici : le trait était déjà posé par la conversion, il est
   * désormais ANNONCÉ (C84 : un champ que rien n'affiche est un champ perdu —
   * et son inverse, un trait posé que rien n'annonce).
   */
  traitRacialTire?: { id: string; nom: string };
}

export type ResultatTirage =
  | { ok: true; tirage: TiragePersonnage; composition: CompositionOk }
  | { ok: false; raison: string };

/* ------------------------------------------------------------------ */
/* Ce que la porte 🧭 AFFICHE — l'ouvert ET le fermé, avec sa raison.  */
/* (Décision 6 : griser, jamais cacher.)                              */
/* ------------------------------------------------------------------ */

export interface RoleProposable {
  role: RoleClasse;
  ouvert: boolean;
  /** Phrase joueur — présente si et seulement si `ouvert` est faux. */
  raison?: string;
}

export interface ClasseProposable {
  classe: ClasseId;
  ouverte: boolean;
  raison?: string;
}

export type StatutFoi = "predilection" | "toleree" | "proscrite";

export interface FoiProposable {
  religion: ReligionMonde;
  statut: StatutFoi;
  /** Phrase joueur — présente si et seulement si `statut` vaut proscrite. */
  raison?: string;
  /** [s368 #5] Le ou les domaines CHOISIS que cette religion proscrit —
   *  pour que le résumé impute chaque compte à SA cause, jamais tout au
   *  premier domaine. Présent si et seulement si `statut` vaut proscrite. */
  proscrits?: readonly string[];
}

export interface ChoixJoueur {
  classe: ClasseId;
  roleId: string;
  raceId: string;
  inventaire: ReadonlySet<string>;
  element?: string;
  element2?: string;
  religionId?: string | null;
  /** Monde post-fix [INAPTE-MAGIE-MODELE-INSTANCE] : si l'appelant connaît
   *  les traits CHOISIS, l'instance prime sur le modèle (la race). */
  traitsChoisis?: readonly string[];
  /**
   * ⭐ [D53, s381] Le SOUS-TYPE choisi au barreau « Ton héritage » — absent
   * pour les races qui n'en ont pas. Même valeur littérale que
   * `race_traits.sous_type` (`p_sous_type_chimeride` côté serveur).
   */
  sousTypeChimeride?: string;
  essentiels?: ContexteComposition["essentiels"];
}

/* ------------------------------------------------------------------ */
/* Pools — exportés pour que la simulation énumère EXACTEMENT           */
/* l'espace atteignable (jumeau positif, règle s346).                  */
/* ------------------------------------------------------------------ */

const VIDE: ReadonlySet<string> = new Set();

const piocher = <T,>(liste: readonly T[], alea: Alea): T =>
  liste[Math.min(Math.floor(alea() * liste.length), liste.length - 1)];

/** Races proposables : jouables, actives, costume couvert par l'inventaire
 *  (carte `objets_requis`, lecteur partagé `exigences.ts`). À inventaire
 *  vide, seule race sans exigence : l'Humain (mesuré s362). */
export function racesTirables(
  monde: MondeResolveur,
  inventaire: ReadonlySet<string>
): RaceMonde[] {
  const index = construireIndex(monde.objets_requis, "race_id");
  return monde.races.filter(
    (r) =>
      r.est_actif && r.est_jouable && raceAccessible(r.id, inventaire, index)
  );
}

/** 13 → 11 : les cercles du catalogue moins les jamais-tirés (§5.1 ②). */
export function cerclesTirables(cats: Catalogues): string[] {
  return cats.magie.cercles().filter((c) => !CERCLES_JAMAIS_TIRES.includes(c));
}

/** 8 → 7 : les domaines du catalogue moins Nécromancie (§5.2 ②). */
export function domainesTirables(cats: Catalogues): string[] {
  return cats.magie
    .domaines()
    .filter((d) => !DOMAINES_JAMAIS_TIRES.includes(d));
}

/* ------------------------------------------------------------------ */
/* ⭐ [D52, s380] LE SOUS-TYPE ET LE TRAIT RACIAL — pools et tirage.    */
/* ------------------------------------------------------------------ */

/**
 * Les SOUS-TYPES d'une race, lus dans `race_traits` — pas une liste en dur :
 * la base est la seule autorité. Vide pour les 10 races qui n'en ont pas ;
 * `["carnivore", "herbivore"]` pour le Chiméride (mesuré : 5 traits chacun).
 * Trié — l'ordre du snapshot n'est pas contractuel, un aléa seedé doit rendre
 * le même sous-type quelle que soit la régénération.
 */
export function sousTypesTirables(
  monde: MondeResolveur,
  raceId: string
): string[] {
  const vus = new Set<string>();
  for (const rt of monde.race_traits) {
    if (rt.race_id === raceId && rt.sous_type != null) vus.add(rt.sous_type);
  }
  return [...vus].sort((a, b) => a.localeCompare(b));
}

/**
 * ⭐ [D53, s381] LE POOL EXHAUSTIF : les traits ACTIFS de la race, filtrés par
 * le sous-type — « Inapte à la magie » COMPRIS. C'est le pool que le barreau
 * 🧭 « Ton héritage » affiche (loi `religionsProposables`, C75 : l'ouvert ET
 * le fermé, jamais un tri qui cache). `traitsTirables`, plus bas, en retire
 * « Inapte » pour le 🎲 — deux verbes, une seule matière première.
 *
 * ⚠️ [C99] Le filtre `sous_type == null || sous_type === sousType` est
 * EXACTEMENT la condition qu'applique `valider_etape_3` côté serveur (et
 * `gatesTraits.peutAcheterTraitRacial` côté miroir) : un trait sans sous-type
 * appartient à toute la race, un trait sous-typé au seul sous-type nommé.
 *
 * Trié par nom AVANT tirage (même discipline de déterminisme que
 * `poolArtisanat` et `langueAncienneAuHasard`).
 */
export function traitsRaciauxProposables(
  monde: MondeResolveur,
  raceId: string,
  sousType?: string
): { id: string; nom: string }[] {
  const actifs = new Map(
    monde.traits_raciaux.filter((t) => t.est_actif).map((t) => [t.id, t])
  );
  const vus = new Set<string>();
  const pool: { id: string; nom: string }[] = [];
  for (const rt of monde.race_traits) {
    if (rt.race_id !== raceId || vus.has(rt.trait_id)) continue;
    if (rt.sous_type != null && rt.sous_type !== sousType) continue;
    const trait = actifs.get(rt.trait_id);
    if (!trait) continue;
    vus.add(rt.trait_id);
    pool.push({ id: trait.id, nom: trait.nom });
  }
  return pool.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/**
 * ⭐ LE POOL DU TIRAGE 🎲 : `traitsRaciauxProposables`, MOINS « Inapte à la
 * magie ».
 *
 * ⛔ L'EXCLUSION D'« Inapte à la magie » EST STRUCTURELLE, par le NOM
 * (`TRAIT_INAPTE`, jamais un id en dur — même résolution que `versBrouillon`).
 * Sorti pour un Demi-Orc MAGE ou PRÊTRE, ce trait détruirait une fiche magique
 * et `valider_etape_3` la refuserait : on recréerait, en pire, le bug que ce
 * lot répare. D42 reste seule à le poser, et seulement aux martiaux — le 🧭,
 * lui, le PROPOSE (grisé si besoin) via `traitsRaciauxProposables`.
 */
export function traitsTirables(
  monde: MondeResolveur,
  raceId: string,
  sousType?: string
): { id: string; nom: string }[] {
  return traitsRaciauxProposables(monde, raceId, sousType).filter(
    (t) => t.nom !== TRAIT_INAPTE
  );
}

/**
 * ⭐ [D52] Le trait racial gratuit, tiré dans le pool de la race (et du
 * sous-type), PONDÉRÉ par le terrain (`contenu/traits.ts` — poids mesurés sur
 * les personnages FINALISÉS ; tout trait non mesuré pèse `POIDS_DEFAUT`).
 *
 * `undefined` si le pool est vide — un pool vide ne casse rien, la conversion
 * laisse simplement la liste vide comme avant le lot.
 */
export function tirerTraitRacial(
  monde: MondeResolveur,
  race: Pick<RaceMonde, "id" | "nom">,
  sousType: string | undefined,
  alea: Alea
): { id: string; nom: string } | undefined {
  const pool = traitsTirables(monde, race.id, sousType);
  const table = POIDS_TRAITS[cleRaceTraits(race.nom, sousType)] ?? {};
  return tirerSansRemisePondere(pool, (t) => poidsDe(t.nom, table), 1, alea)[0];
}

/** Sonde d'élément du pré-filtre de rôles (piège C71, mesuré s362) : les
 *  portes des casters à choix libre (🎭🔮✨ᚱ⛪✝️) répondent « choisis d'abord
 *  ton cercle/domaine » quand `o.element` manque — une porte 🧭, pas une
 *  porte d'inventaire. On sonde donc avec un élément du pool ; les 6 portes
 *  testent sa PRÉSENCE, jamais son identité, et le composeur re-vérifie de
 *  toute façon avec le vrai. [D40 s372] Exportée : la boussole en a besoin
 *  pour dériver « élément optionnel » — une seule maison de la sonde. */
export const sondeElement = (
  contenu: ContenuClasse,
  cats: Catalogues
): string | undefined =>
  contenu.classe === "pretre"
    ? domainesTirables(cats)[0]
    : contenu.classe === "mage"
      ? cerclesTirables(cats)[0]
      : undefined;

/** ⭐ [s367, lot 🧭] TOUS les rôles de la classe, ouverts ET fermés, chacun
 *  avec SA RAISON — « griser, jamais cacher » (décision 6). C'est la liste
 *  que la porte 🧭 affiche ; `rolesTirables` n'en est que la projection
 *  sèche, pour que les deux portes ne puissent pas diverger.
 *
 *  Les raisons ne sont jamais rédigées ici : celle de l'équipement vient du
 *  CONTENU (`role.requiert`, une seule maison), celle de l'inaptitude du
 *  COMPOSEUR (`raisonRoleInapte`, la même phrase qu'un refus après coup). */
export function rolesProposables(
  contenu: ContenuClasse,
  cats: Catalogues,
  inventaire: ReadonlySet<string>,
  inapte: boolean
): RoleProposable[] {
  const o = { element: sondeElement(contenu, cats) };
  // ⭐ [D40 s372] DEUX QUESTIONS, DEUX SONDES (leçon C75 : « pour quel verbe
  // la sonde a-t-elle été écrite ? »).
  //  · `requiert` se sonde AVEC un élément (piège C71) : c'est une porte
  //    d'ÉQUIPEMENT, pas une porte 🧭.
  //  · le verdict d'INAPTITUDE se sonde À NU : il mesure la NÉCESSITÉ de
  //    magie, pas sa possibilité. Depuis la décision 40, ✝️ n'exige plus de
  //    domaine — sondé avec un élément il « demanderait » des PS et se
  //    fermerait à un inapte qui peut parfaitement le jouer sans domaine
  //    (mesuré s372 : 60 XP, reliquat 0, zéro PS). Les rôles dont le noyau
  //    déclare sa magie sans condition (⛪🎭🔮✨ᚱ🕊️📿) répondent pareil aux
  //    deux sondes : seul ✝️ les sépare.
  const oNu = {};
  return contenu.roles.map((role) => {
    const refus = role.requiert(inventaire, o);
    if (refus !== null) return { role, ouvert: false, raison: refus };
    if (inapte && archetypeDemandeDesPS(contenu, role.id, inventaire, oNu)) {
      return { role, ouvert: false, raison: raisonRoleInapte(role) };
    }
    return { role, ouvert: true };
  });
}

/** Rôles qu'un 🎲 peut proposer — la projection sèche de `rolesProposables`.
 *  Une seule maison du pré-filtre : ce que 🧭 grise, 🎲 l'écarte. */
export function rolesTirables(
  contenu: ContenuClasse,
  cats: Catalogues,
  inventaire: ReadonlySet<string>,
  inapte: boolean
): RoleClasse[] {
  return rolesProposables(contenu, cats, inventaire, inapte)
    .filter((r) => r.ouvert)
    .map((r) => r.role);
}

/** ⭐ [s367, lot 🧭] Les 4 voies, ouvertes ET fermées, avec leur raison.
 *  Une voie est ouverte dès qu'UN de ses rôles l'est — jamais un cul-de-sac
 *  au barreau suivant (motif de l'ordre α, décision 36).
 *
 *  ⚠️ ARBITRAGE FRED s367 — LE MODÈLE FERME, PAS L'INSTANCE. Une race dont
 *  le POOL de traits porte « Inapte à la magie » voit les voies à PS se
 *  fermer, même si le joueur n'a pas encore choisi ce trait (il en prend 1
 *  sur 6). C'est une DIVERGENCE DÉLIBÉRÉE avec la décision 33 (« archétype
 *  d'abord, trait ensuite ») et avec le manuel : elle vit dans
 *  `divergences_deliberees.md`. L'échappatoire est nommée au joueur —
 *  « Je bâtis moi-même » reste ouvert. Passer `traitsChoisis` bascule sur
 *  l'instance sans toucher à ce code.
 *
 *  Le MOTIF de la fermeture est MESURÉ, jamais deviné : on re-déroule le
 *  pool en supposant le personnage apte ; s'il s'ouvre, la cause est
 *  l'inaptitude, sinon c'est l'équipement. */
export function classesProposables(
  deps: DepsResolveur,
  raceId: string,
  inventaire: ReadonlySet<string>,
  traitsChoisis?: readonly string[]
): ClasseProposable[] {
  const { monde } = deps;
  const race = monde.races.find((r) => r.id === raceId);
  // ⭐ [Décisions 41+42, s372] Le MODÈLE ne grise plus : sans traits connus,
  // le visiteur est APTE et voit tout ouvert. L'INSTANCE (traits choisis)
  // reste la seule à fermer — c'est la bascule annoncée par la décision 41.
  const inapte = traitsChoisis ? traitsChoisis.includes(TRAIT_INAPTE) : false;

  return ORDRE_VOIES.map((classe): ClasseProposable => {
    const { cats, contenu } = deps.parClasse[classe];
    const ouverts = rolesProposables(contenu, cats, inventaire, inapte).filter(
      (r) => r.ouvert
    ).length;
    if (ouverts > 0) return { classe, ouverte: true };

    // [s368 #4] Voie fermée : DÉCOMPOSER les causes avant de rédiger — un
    // compte à deux causes ne s'impute jamais à une seule (jumeau du résumé
    // des foi, même leçon). La passe « apte » sépare ce que l'inaptitude
    // ferme de ce que l'équipement fermerait de toute façon.
    const siApte = inapte
      ? rolesProposables(contenu, cats, inventaire, false)
      : null;
    const parInaptitude = siApte ? siApte.filter((r) => r.ouvert).length : 0;
    const nom = race?.nom ?? "Ton peuple";
    if (parInaptitude === 0) {
      return {
        classe,
        ouverte: false,
        raison: `Aucun rôle de cette voie n'est ouvert avec ton équipement — ajoute de quoi dans ton 🎒.`,
      };
    }
    const parEquipement = siApte!
      .filter((r) => !r.ouvert)
      .map((r) => `${r.role.emoji} ${r.role.titre}`);
    const total = contenu.roles.length;
    if (parEquipement.length === 0) {
      return {
        classe,
        ouverte: false,
        raison: `Les ${total} rôles de cette voie vivent de points de spiritualité, et ${nom} peut naître inapte à la magie. « Je bâtis moi-même » reste ouvert.`,
      };
    }
    return {
      classe,
      ouverte: false,
      raison: `${parInaptitude} des ${total} rôles de cette voie vivent de points de spiritualité — et ${nom} peut naître inapte à la magie. ${parEquipement.join(" · ")} attend${parEquipement.length > 1 ? "ent" : ""} encore ton 🎒. « Je bâtis moi-même » reste ouvert.`,
    };
  });
}

/** ⭐ [s367, lot 🧭, arbitrage Fred] LES 15 FOI, JAMAIS 8. Le tri de 🎲
 *  (`religionsCandidates`, priorité aux domaines PRINCIPAUX — arbitrage
 *  s360) est un tri de TIRAGE : l'appliquer à un CHOIX cacherait des foi
 *  parfaitement légitimes. Mesuré s367 : un nécromancien n'en verrait que
 *  3 sur les 9 qui l'acceptent, et les 6 qui le refusent disparaîtraient
 *  avec leur raison.
 *
 *  Conduite : tout est rendu, trié prédilection → tolérée → proscrite ; les
 *  proscrites portent leur phrase et l'écran les grise (décision 6).
 *  ⚠️ `religionsCandidates` reste la maison du 🎲 : ne pas fusionner. */
export function religionsProposables(
  monde: MondeResolveur,
  domaine?: string,
  domaine2?: string
): FoiProposable[] {
  const rang: Record<StatutFoi, number> = {
    predilection: 0,
    toleree: 1,
    proscrite: 2,
  };
  return monde.religions
    .filter((r) => r.est_actif)
    .map((religion): FoiProposable => {
      const proscrits = [domaine, domaine2].filter(
        (d): d is string => !!d && religion.domaines_proscrits.includes(d)
      );
      if (proscrits.length > 0) {
        return {
          religion,
          statut: "proscrite",
          proscrits,
          raison:
            proscrits.length === 2
              ? `${religion.nom} proscrit les domaines ${proscrits[0]} et ${proscrits[1]}.`
              : `${religion.nom} proscrit le domaine ${proscrits[0]}.`,
        };
      }
      return {
        religion,
        statut:
          domaine && religion.domaines_principaux.includes(domaine)
            ? "predilection"
            : "toleree",
      };
    })
    .sort(
      (a, b) =>
        rang[a.statut] - rang[b.statut] ||
        a.religion.nom.localeCompare(b.religion.nom, "fr")
    );
}

/** Religions candidates pour un prêtre tiré : le domaine (imposé ou tiré)
 *  est un domaine PRINCIPAL (arbitrage s360), et le second domaine — s'il
 *  y en a un — n'est pas proscrit (arbitrage C3, s362). Le garde-fou
 *  « jamais une proscrite » est structurel : une religion ne proscrit
 *  jamais un de ses propres principaux (15/15 en prod). */
export function religionsCandidates(
  monde: MondeResolveur,
  domainePrincipal: string,
  domaine2?: string
): ReligionMonde[] {
  return monde.religions.filter(
    (r) =>
      r.est_actif &&
      r.domaines_principaux.includes(domainePrincipal) &&
      (!domaine2 || !r.domaines_proscrits.includes(domaine2))
  );
}

/** Seconds domaines tirables pour 🕊️/📿 : tirables ∖ {imposé}, et il doit
 *  RESTER au moins une religion candidate (pré-filtre : aucun cul-de-sac). */
export function domaines2Candidats(
  cats: Catalogues,
  monde: MondeResolveur,
  domaineImpose: string
): string[] {
  return domainesTirables(cats).filter(
    (d) =>
      d !== domaineImpose &&
      religionsCandidates(monde, domaineImpose, d).length > 0
  );
}

/* ------------------------------------------------------------------ */
/* Helpers internes                                                    */
/* ------------------------------------------------------------------ */

const coutCouche2 = (c: CompositionOk): number =>
  c.achats.filter((a) => a.couche === 2).reduce((s, a) => s + a.coutXp, 0) +
  c.achatsMagie.filter((m) => m.couche === 2).reduce((s, m) => s + m.coutXp, 0);

/** Conduite 3 (§2.2), appliquée à la FICHE produite : si la composition
 *  contient la moindre compétence/magie à PS (couche ④ comprise — le filet
 *  Guerrier/Voleur émet du Développement Spirituel), le trait « Inapte à la
 *  magie » devient incompatible et sort du pool du préfill.
 *
 *  ⭐ [B2, s385] ENCORE FAUT-IL QUE LE TRAIT SOIT DANS LE POOL DE CETTE RACE
 *  (et de son sous-type) — « Inapte à la magie » n'est proposé qu'au
 *  Demi-Orc (`traitsRaciauxProposables`, C75 : l'ouvert ET le fermé, jamais
 *  une liste de races dupliquée en dur). Un Drow caster ne l'a jamais eu dans
 *  son pool : lui annoncer « trait incompatible : Inapte à la magie » lui
 *  ferait croire à un choix qu'il n'a jamais pu faire. */
const traitsIncompatiblesDe = (
  c: CompositionOk,
  monde: MondeResolveur,
  raceId: string,
  sousType?: string
): string[] => {
  const exigeDeLaMagie =
    c.achatsMagie.length > 0 || c.achats.some((a) => estCompetenceAPS(a.nom));
  if (!exigeDeLaMagie) return [];
  const dansLePool = traitsRaciauxProposables(monde, raceId, sousType).some(
    (t) => t.nom === TRAIT_INAPTE
  );
  return dansLePool ? [TRAIT_INAPTE] : [];
};

const mondeInapte = (monde: MondeResolveur) => ({
  tables: {
    race_traits: monde.race_traits,
    traits_raciaux: monde.traits_raciaux,
  },
});

/* ------------------------------------------------------------------ */
/* 🎲 — le tirage complet                                              */
/* ------------------------------------------------------------------ */

export function tirerPersonnage(
  deps: DepsResolveur,
  alea: Alea,
  inventaire: ReadonlySet<string> = VIDE
): ResultatTirage {
  const { monde } = deps;

  // ① La race — parmi les accessibles avec CET équipement.
  const races = racesTirables(monde, inventaire);
  if (races.length === 0) {
    return {
      ok: false,
      raison:
        "Aucun peuple n'est accessible avec cet équipement — coche ton costume, ou pars Humain.",
    };
  }
  const race = piocher(races, alea);
  const budget = race.xp_depart;

  // ⭐⭐⭐ [DÉCISION 42, s372 — arbitrage Fred, remplace la « Conduite 1 »]
  // LE MODÈLE NE FILTRE PLUS LE POOL. Un Demi-Orc tiré accède aux 15 rôles :
  // tiré MAGIQUE, il naît APTE (sorts/prières composés, PS normaux — le
  // manuel : « les demi-orcs, ayant du sang humain, ont accès à la magie ») ;
  // tiré MARTIAL (guerrier/voleur, la lettre de l'arbitrage s369), il reçoit
  // « Inapte à la magie » D'OFFICE (+1 PV, jamais de PS) — `inapteMagie` sur
  // le tirage SIGNIFIE « le trait est posé », et `versBrouillon` le traduit
  // en trait racial gratuit à l'étape 3. La composition martiale se fait
  // inapte (zéro achat à PS — 🛡️ perd sa Méditation, entre autres).
  // 🧭, lui, ne pose JAMAIS de trait : le joueur choisit à l'étape 3, et
  // `traitsIncompatibles` guide le wizard (Inapte grisé si magie composée).
  const racePeutInapte = raceInapteMagie(mondeInapte(monde), race.id);

  // ② La classe (¼ parmi celles à pool non vide) puis le rôle — pools APTES
  // (décision 42) ; pour guerrier/voleur, pool apte ≡ pool inapte (mesuré
  // s369 : 0 rôle perdu), le tirage martial-inapte reste donc dans son pool.
  const classes = CLASSES.filter(
    (c) =>
      rolesTirables(
        deps.parClasse[c].contenu,
        deps.parClasse[c].cats,
        inventaire,
        false
      ).length > 0
  );
  if (classes.length === 0) {
    return {
      ok: false,
      raison: "Aucun rôle n'est jouable avec cet équipement.",
    };
  }
  const classe = piocher(classes, alea);
  const { cats, contenu } = deps.parClasse[classe];
  // ⭐ [Décision 42] L'inaptitude SE DÉRIVE de la classe tirée : martial →
  // le trait sera posé, composition inapte ; magique → apte complet.
  const inapte =
    racePeutInapte && (classe === "guerrier" || classe === "voleur");
  const role = piocher(rolesTirables(contenu, cats, inventaire, false), alea);

  // ③ Le cercle / domaine — imposé par l'archétype, sinon tiré dans le pool
  // légitime (jamais un interdit : §5.1 ② / §5.2 ②).
  // ⭐ [D40 s372] La sonde répond « ce rôle UTILISERAIT-IL la magie si on lui
  // en donne ? » — sondée AVEC un élément, comme `rolesProposables` pour le
  // requiert (C71). Sondée à nu, ✝️ répondrait non depuis que sa prière a
  // quitté le noyau, et 🎲 cesserait de lui tirer un domaine — contraire à la
  // décision 40 (« proposition ≠ tirage » : 🧭 propose le sans-domaine, 🎲 ne
  // le tire jamais). Un INAPTE, lui, ne reçoit JAMAIS d'élément : il tire le
  // seul ✝️ que `rolesTirables` lui laisse, et le compose sans domaine.
  const besoinMagie =
    !inapte &&
    archetypeDemandeDesPS(contenu, role.id, inventaire, {
      element: sondeElement(contenu, cats),
    });
  let elementTire: string | undefined;
  if (!role.magieImposee && besoinMagie) {
    elementTire =
      classe === "pretre"
        ? piocher(domainesTirables(cats), alea)
        : piocher(cerclesTirables(cats), alea);
  }
  const elementEffectif = role.magieImposee ?? elementTire;

  // ④ Le second élément — seulement pour ✨ ᚱ 🕊️ 📿 (arbitrage s361).
  let element2: string | undefined;
  if (ROLES_ELEMENT2.includes(role.id) && elementEffectif) {
    if (classe === "mage") {
      element2 = piocher(
        cerclesTirables(cats).filter((c) => c !== elementEffectif),
        alea
      );
    } else {
      const candidats = domaines2Candidats(cats, monde, elementEffectif);
      if (candidats.length === 0) {
        return {
          ok: false,
          raison: `Aucun second domaine compatible avec ${elementEffectif}.`,
        };
      }
      element2 = piocher(candidats, alea);
    }
  }

  // ⑤ Composer — décision 17 : 🎲 déroule les QUATRE couches (③ tirée).
  const ctxBase: ContexteComposition = {
    classe,
    roleId: role.id,
    inventaire,
    budget,
    element: elementTire,
    element2,
    inapteMagie: inapte,
  };
  const c0 = composerClasse(cats, contenu, ctxBase);
  if (!c0.ok) return { ok: false, raison: c0.raison };
  const essentiels = tirerEssentielsClasse(
    cats,
    contenu,
    ctxBase,
    budget - coutCouche2(c0),
    alea
  );
  const composition = composerClasse(cats, contenu, { ...ctxBase, essentiels });
  if (!composition.ok) return { ok: false, raison: composition.raison };

  // ⑥ [s366, option A Fred] LA FICHE DIT VRAI : `element2` n'est un CANDIDAT
  // que jusqu'ici — l'entrée « Un SECOND cercle/domaine » est une entrée de
  // couche ③ parmi d'autres, son tirage n'est pas garanti. Mesuré s366 :
  // 680 candidats sur 779 n'étaient pas achetés, et la fiche les affichait.
  // L'EFFECTIF est ce que la composition a réellement acheté — rien d'autre
  // ne sort du tirage.
  const element2Effectif = element2Achete(composition, element2);

  // ⑦ La religion — EN SORTIE, prêtre seulement : « archétype d'abord,
  // religion ensuite » (§5.2 ③), principales d'abord (s360), et le second
  // domaine — s'il est EFFECTIF — jamais proscrit (C3, s362). Tirée APRÈS la
  // composition (s366) : un candidat mangé ne restreint plus les fois pour
  // un domaine que le personnage n'a pas.
  let religion: ReligionMonde | undefined;
  if (classe === "pretre" && elementEffectif) {
    const candidates = religionsCandidates(
      monde,
      elementEffectif,
      element2Effectif
    );
    if (candidates.length === 0) {
      return {
        ok: false,
        raison: `Aucune foi ne porte le domaine ${elementEffectif} en principal.`,
      };
    }
    religion = piocher(candidates, alea);
  }

  // ⑧ ⭐⭐ [D52, s380] LE SOUS-TYPE PUIS LE TRAIT RACIAL — la fiche du 🎲
  // devient VRAIMENT finalisable. Avant ce lot, le joueur nommait son
  // personnage, cliquait « Finaliser », et le serveur refusait : « Vous devez
  // choisir exactement 1 trait(s) gratuit(s), pas 0 » — sans rien lui dire du
  // chemin. Un Chiméride, lui, restait bloqué dès l'étape 2.
  //
  // ⚠️ L'ORDRE COMPTE DEUX FOIS :
  //  · le sous-type AVANT le trait — le pool de traits en dépend (C99) ;
  //  · ces deux tirages EN DERNIER, après la composition et la religion. Ce
  //    n'est pas cosmétique : `alea` est un flux, et les comptes MACHINE
  //    gravés des sweeps seedés (s366/s374 : `rolesE2Vus`, `e2Poses`, la liste
  //    exacte des reliquats > 3) décrivent le flux TEL QU'IL ÉTAIT. Tirer plus
  //    tôt les décalerait tous, et on ne saurait plus si un compte qui bouge
  //    est un décalage de graine ou une vraie régression.
  const sousTypeChimeride = piocherSousType(monde, race.id, alea);

  // ⛔ [D42, s372 — NON-RÉGRESSION ABSOLUE] Un Demi-Orc tiré guerrier ou
  // voleur reçoit « Inapte à la magie » d'office : le NOUVEAU tirage ne joue
  // QUE si `inapte` est faux. Le trait de D42 est simplement NOMMÉ ici (il
  // était déjà posé par `versBrouillon`), pour que la fiche l'annonce comme
  // les autres — la conversion, elle, ne change pas d'un octet.
  const traitRacialTire = inapte
    ? monde.traits_raciaux.find((t) => t.est_actif && t.nom === TRAIT_INAPTE)
    : tirerTraitRacial(monde, race, sousTypeChimeride, alea);

  return {
    ok: true,
    tirage: {
      raceId: race.id,
      raceNom: race.nom,
      budget,
      classe,
      roleId: role.id,
      element: elementEffectif,
      element2: element2Effectif,
      religionId: religion?.id,
      religionNom: religion?.nom,
      inapteMagie: inapte,
      traitsIncompatibles: traitsIncompatiblesDe(
        composition,
        monde,
        race.id,
        sousTypeChimeride
      ),
      sousTypeChimeride,
      traitRacialTire: traitRacialTire
        ? { id: traitRacialTire.id, nom: traitRacialTire.nom }
        : undefined,
    },
    composition,
  };
}

/** [D52] Le sous-type tiré, pondéré (carnivore 3 · herbivore 2, mesurés) —
 *  `undefined` pour les races qui n'en ont pas : le champ reste absent plutôt
 *  que faussement rempli (`valider_etape_2` refuse un sous-type sur une race
 *  qui n'en attend pas : `sous_type_chimeride_invalide_pour_race`). */
function piocherSousType(
  monde: MondeResolveur,
  raceId: string,
  alea: Alea
): string | undefined {
  const sousTypes = sousTypesTirables(monde, raceId);
  if (sousTypes.length === 0) return undefined;
  return tirerSansRemisePondere(
    sousTypes,
    (st) => poidsDe(st, POIDS_SOUS_TYPE_CHIMERIDE),
    1,
    alea
  )[0];
}

/* ------------------------------------------------------------------ */
/* 🧭 — la validation des choix du joueur                              */
/** [s366] L'element2 EFFECTIF : le candidat n'entre dans la sortie que si
 *  la composition l'a RÉELLEMENT acheté — la fiche dit vrai (option A,
 *  Fred s366). Une seule maison du critère, pour 🎲 ET 🧭. */
function element2Achete(
  composition: CompositionOk,
  candidat: string | undefined
): string | undefined {
  if (!candidat) return undefined;
  const achete = composition.achats.some(
    (a) =>
      (a.nom === "Acquisition de Cercle" ||
        a.nom === "Acquisition de Domaine") &&
      a.choix === candidat
  );
  return achete ? candidat : undefined;
}

/* ------------------------------------------------------------------ */

export function resoudreChoix(
  deps: DepsResolveur,
  choix: ChoixJoueur
): ResultatTirage {
  const { monde } = deps;
  const { cats, contenu } = deps.parClasse[choix.classe];

  const race = monde.races.find((r) => r.id === choix.raceId);
  if (!race) {
    return { ok: false, raison: "Ce peuple n'existe pas — choisis ta race." };
  }

  // ⭐ [Décisions 41+42, s372] L'INSTANCE seule ferme : si l'appelant connaît
  // les traits CHOISIS, ils font foi ; sinon le personnage est APTE — le
  // modèle (pool de la race) ne présume plus rien en 🧭. Un Demi-Orc visiteur
  // compose donc en caster complet ; s'il prend « Inapte » ensuite au wizard,
  // la gate serveur `valider_etape_3` refuse le trait à qui porte de la magie.
  const inapte = choix.traitsChoisis
    ? choix.traitsChoisis.includes(TRAIT_INAPTE)
    : false;

  let religion: ReligionMonde | undefined;
  if (choix.religionId) {
    religion = monde.religions.find((r) => r.id === choix.religionId);
    if (!religion) {
      return { ok: false, raison: "Cette religion n'existe pas." };
    }
  }

  // §5.2 ③, 🧭 : un rôle incompatible avec la foi POSÉE est refusé AVEC SA
  // PHRASE — jamais silencieusement écarté. En 🧭 tout reste proposable
  // (13 cercles, 8 domaines) : la seule contrainte est la religion du joueur.
  const role = contenu.roles.find((r) => r.id === choix.roleId);
  if (role && religion) {
    const impose = role.magieImposee;
    if (impose && religion.domaines_proscrits.includes(impose)) {
      return {
        ok: false,
        raison: `${role.emoji} ${role.titre} porte le domaine ${impose}, que ${religion.nom} proscrit — choisis une autre foi, ou un autre rôle.`,
      };
    }
    if (choix.classe === "pretre") {
      for (const domaine of [choix.element, choix.element2]) {
        if (domaine && religion.domaines_proscrits.includes(domaine)) {
          return {
            ok: false,
            raison: `Ta foi — ${religion.nom} — proscrit le domaine ${domaine} : choisis un autre domaine, ou une autre religion.`,
          };
        }
      }
    }
  }

  // ⭐ [s366, lot 🧭] ELEMENT2 DEMANDÉ ⇒ ACHETÉ OU REFUS — un invariant
  // MOTEUR, pas une convention d'écran : quand le joueur pose un second
  // cercle/domaine, l'entrée du pool ③ correspondante (label déclaré par le
  // CONTENU dans `essentielSecond` — une seule maison) est jointe à ses
  // essentiels. L'écran ne connaît aucun label.
  let essentiels = choix.essentiels;
  if (choix.element2 && contenu.essentielSecond) {
    const label = contenu.essentielSecond;
    if (!essentiels?.some((e) => "label" in e && e.label === label)) {
      essentiels = [...(essentiels ?? []), { label }];
    }
  }

  const contexte: ContexteComposition = {
    classe: choix.classe,
    roleId: choix.roleId,
    inventaire: choix.inventaire,
    budget: race.xp_depart,
    element: choix.element,
    element2: choix.element2,
    essentiels,
    inapteMagie: inapte,
  };
  const composition: Composition = composerClasse(cats, contenu, contexte);
  if (!composition.ok) return { ok: false, raison: composition.raison };

  // Même forme de sortie que 🎲 (ResultatTirage) : la fiche, la conversion
  // et l'application se réutilisent TELLES QUELLES (décision 33).
  const element2Effectif = element2Achete(composition, choix.element2);

  // ⭐ [D53, s381] LE RÉSOLVEUR SAIT. Jusqu'ici `resoudreChoix` ignorait le
  // sous-type et ne posait jamais `traitRacialTire` : `versBrouillon` recevait
  // donc toujours `sousTypeChimeride: undefined` et `traitsRaciauxChoisis: []`
  // pour une fiche 🧭 — exactement le trou que ce lot ferme. Le trait CHOISI
  // (`choix.traitsChoisis[0]`, posé par `construireChoix`) est nommé ici, par
  // le même NOM que sert `traitsIncompatiblesDe`/D42 : une seule maison de
  // résolution nom→id, jamais un id en dur.
  const nomTraitChoisi = choix.traitsChoisis?.[0];
  const traitChoisi = nomTraitChoisi
    ? monde.traits_raciaux.find(
        (t) => t.est_actif && t.nom === nomTraitChoisi
      )
    : undefined;

  return {
    ok: true,
    tirage: {
      raceId: race.id,
      raceNom: race.nom,
      budget: race.xp_depart,
      classe: choix.classe,
      roleId: choix.roleId,
      element: choix.element ?? role?.magieImposee,
      element2: element2Effectif,
      religionId: religion?.id,
      religionNom: religion?.nom,
      inapteMagie: inapte,
      traitsIncompatibles: traitsIncompatiblesDe(
        composition,
        monde,
        race.id,
        choix.sousTypeChimeride
      ),
      sousTypeChimeride: choix.sousTypeChimeride,
      traitRacialTire: traitChoisi
        ? { id: traitChoisi.id, nom: traitChoisi.nom }
        : undefined,
    },
    composition,
  };
}

/**
 * ⭐ [D53, s381] APERÇU des compétences que la composition tiendrait, AVANT
 * que le joueur ait choisi son trait racial — le barreau « Ton héritage » en
 * a besoin pour dire à quoi chaque trait SERT à CE personnage (§3, carte
 * d'usage validée Fred s380). `classe`/`role`/`element`/`religion` sont déjà
 * posés à ce stade de l'escalier (D53 : le barreau vit APRÈS la foi) — seul
 * le trait manque, et un trait racial n'entre jamais dans `ContexteComposition`.
 *
 * ⛔ JAMAIS UNE GATE : une composition en refus (rôle bloqué, XP insuffisant)
 * rend une liste VIDE, pas une erreur — cette fonction n'est consultée que
 * pour de la PHRASE (« Saveur » de repli), jamais pour refuser une étape.
 * `resoudreChoix` reste la seule porte qui peut dire non.
 */
export function nomsAcquisPrevisionnels(
  deps: DepsResolveur,
  choix: Pick<
    ChoixJoueur,
    "classe" | "roleId" | "raceId" | "inventaire" | "element" | "element2"
  >
): string[] {
  const { monde } = deps;
  const { cats, contenu } = deps.parClasse[choix.classe];
  const race = monde.races.find((r) => r.id === choix.raceId);
  if (!race) return [];

  let essentiels: ContexteComposition["essentiels"];
  if (choix.element2 && contenu.essentielSecond) {
    essentiels = [{ label: contenu.essentielSecond }];
  }

  const composition = composerClasse(cats, contenu, {
    classe: choix.classe,
    roleId: choix.roleId,
    inventaire: choix.inventaire,
    budget: race.xp_depart,
    element: choix.element,
    element2: choix.element2,
    essentiels,
    inapteMagie: false,
  });
  if (!composition.ok) return [];
  return [
    ...composition.gratuites.map((g) => g.nom),
    ...composition.achats.map((a) => a.nom),
  ];
}

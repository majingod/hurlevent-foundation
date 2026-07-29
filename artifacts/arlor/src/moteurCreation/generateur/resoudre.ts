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
  tirerEssentielsClasse,
  type Catalogues,
} from "./composer";
import {
  archetypeDemandeDesPS,
  estCompetenceAPS,
  type ContenuClasse,
  type RoleClasse,
} from "./contenu/commun";
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

const TRAIT_INAPTE = "Inapte à la magie";

/** Ordre FIXE du tirage de classe — chaque grande famille a la même chance
 *  (¼), quel que soit son nombre d'archétypes (choix C1, s362). */
const CLASSES: readonly ClasseId[] = ["guerrier", "mage", "pretre", "voleur"];

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
  race_traits: readonly { race_id: string; trait_id: string }[];
  traits_raciaux: readonly { id: string; nom: string; est_actif: boolean }[];
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
}

export type ResultatTirage =
  | { ok: true; tirage: TiragePersonnage; composition: CompositionOk }
  | { ok: false; raison: string };

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

/** Rôles qu'un 🎲 peut proposer : porte ouverte (`requiert === null`) ET,
 *  si le personnage est inapte, pas de PS au noyau/signature (conduite 2 —
 *  le pré-filtre évite de tirer un rôle que le composeur refuserait).
 *
 *  ⚠️ SONDE D'ÉLÉMENT (mesuré s362) : les portes des casters à choix libre
 *  (🎭🔮✨ᚱ⛪✝️) répondent « choisis d'abord ton cercle/domaine » quand
 *  `o.element` manque — une porte 🧭, pas une porte d'inventaire. En 🎲 le
 *  résolveur TIRE l'élément APRÈS le rôle : on sonde donc avec un élément
 *  du pool. Les 6 portes testent sa PRÉSENCE, jamais son identité (mesuré
 *  sur le contenu) ; le composeur re-vérifie de toute façon avec le vrai. */
export function rolesTirables(
  contenu: ContenuClasse,
  cats: Catalogues,
  inventaire: ReadonlySet<string>,
  inapte: boolean
): RoleClasse[] {
  const sonde =
    contenu.classe === "pretre"
      ? domainesTirables(cats)[0]
      : contenu.classe === "mage"
        ? cerclesTirables(cats)[0]
        : undefined;
  const o = { element: sonde };
  return contenu.roles.filter((r) => {
    if (r.requiert(inventaire, o) !== null) return false;
    if (inapte && archetypeDemandeDesPS(contenu, r.id, inventaire, o))
      return false;
    return true;
  });
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
 *  magie » devient incompatible et sort du pool du préfill. */
const traitsIncompatiblesDe = (c: CompositionOk): string[] =>
  c.achatsMagie.length > 0 || c.achats.some((a) => estCompetenceAPS(a.nom))
    ? [TRAIT_INAPTE]
    : [];

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

  // Conduite 1 (§2.2) : avant le fix, l'inaptitude se lit sur le POOL de la
  // race — le dériveur partagé du moteur hors-ligne, une seule maison.
  const inapte = raceInapteMagie(mondeInapte(monde), race.id);

  // ② La classe (¼ chacune) puis le rôle — pools pré-filtrés à la source.
  const classes = CLASSES.filter(
    (c) =>
      rolesTirables(
        deps.parClasse[c].contenu,
        deps.parClasse[c].cats,
        inventaire,
        inapte
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
  const role = piocher(rolesTirables(contenu, cats, inventaire, inapte), alea);

  // ③ Le cercle / domaine — imposé par l'archétype, sinon tiré dans le pool
  // légitime (jamais un interdit : §5.1 ② / §5.2 ②).
  const besoinMagie = archetypeDemandeDesPS(contenu, role.id, inventaire, {});
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
      traitsIncompatibles: traitsIncompatiblesDe(composition),
    },
    composition,
  };
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

  // Conduite 1 : le modèle (pool de race) fait foi… sauf si l'appelant
  // connaît les traits CHOISIS — l'instance prime (monde post-fix).
  const inapte = choix.traitsChoisis
    ? choix.traitsChoisis.includes(TRAIT_INAPTE)
    : raceInapteMagie(mondeInapte(monde), race.id);

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
      traitsIncompatibles: traitsIncompatiblesDe(composition),
    },
    composition,
  };
}

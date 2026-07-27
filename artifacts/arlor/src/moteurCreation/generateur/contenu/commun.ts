import type { ClasseId, ConfigMagie } from "../types";

/**
 * [VIS-8 lot 2b] Contrat GÉNÉRIQUE d'un contenu de classe — le composeur
 * déroule ce contrat pour les 4 classes ; seul le contenu change (patron
 * annoncé au lot 2a). Les prix ne sont JAMAIS écrits ici (décision 20).
 */

export interface OptionsRole {
  /**
   * Le CHOIX DE MAGIE du personnage : 🔥 le cercle du Mage (« ton élément ? »)
   * ou ⛪ le domaine du Prêtre. Un seul champ, deux lectures selon la classe.
   * ⚠️ Quand l'archétype impose le sien (`RoleClasse.magieImposee`), c'est
   * celui-là qui arrive ici — le composeur a déjà tranché.
   */
  element?: string;
  /**
   * ⭐ [R1a s361] Le SECOND cercle / SECOND domaine.
   *
   * Mesuré 2/2 chez ✨ et ᚱ (cercles) et chez 🕊️ et 📿 (domaines) ; 1/4
   * chez ⛪ et 0/4 chez ✝️.
   *
   * ⚠️⚠️ C'EST CE CHAMP QUI PORTE LA DÉCISION « PROPOSABLE 🧭, JAMAIS
   * TIRÉE 🎲 » (arbitrage Fred s361) — pas un drapeau sur l'entrée de pool.
   * Les pools ③ sont partagés par THÈME, pas par rôle : une entrée ne peut
   * pas se restreindre elle-même à ✨ et ᚱ. C'est donc le RÉSOLVEUR qui
   * tranche, et le contenu ne fait que déclarer l'entrée :
   *   · 🎲 → le résolveur ne pose `element2` que pour ✨ ᚱ 🕊️ 📿
   *   · 🧭 → le joueur peut le poser pour n'importe quel rôle, ⛪ et ✝️
   *     compris. Il a le droit de vouloir ce que personne n'a encore fait.
   */
  element2?: string;
}

export type Achat =
  | { t: "comp"; nom: string; niveauCible: number; choix?: string }
  /** +1 rachat au prix du niveau 1 (jauges à choix : cercle, langue, savoir…). */
  | { t: "rachat"; nom: string; choix?: string }
  | { t: "sort"; nom: string; config: ConfigMagie }
  | { t: "priere"; nom: string; config: ConfigMagie }
  /**
   * ⭐ [A2-Mage s358] « le n-ième sort représentatif du CERCLE CHOISI ».
   * Le cercle est LIBRE pour les 5 rôles Mage (référence §5.1) : le contenu
   * ne peut donc plus NOMMER un sort. Il déclare un rang, le composeur
   * résout via le catalogue (dégâts en tête, puis les moins chers) et pose
   * la config lui-même. Aucun prix, aucun nom de sort dans le contenu.
   */
  | { t: "sortAuChoix"; rang: number; slot?: 1 | 2 }
  /**
   * ⭐ [A2-Prêtre s360] « la n-ième prière représentative du DOMAINE ».
   * Jumeau de `sortAuChoix`, MAIS le domaine n'est pas libre comme le cercle :
   * 🕊️ et 📿 l'imposent (`magieImposee`), et la religion en proscrit 2 sur 8
   * (référence §5.2). L'ordre de représentativité est propre au prêtre —
   * la plus PORTÉE en prod, jamais la moins chère (référence §5.2 ⑤).
   */
  | { t: "priereAuChoix"; rang: number; slot?: 1 | 2 };

export interface RoleClasse {
  id: string;
  emoji: string;
  titre: string;
  phrase: string;
  /** null = jouable ; sinon la raison du refus (avec quoi rattraper). */
  requiert: (inv: ReadonlySet<string>, o: OptionsRole) => string | null;
  noyau: (inv: ReadonlySet<string>, o: OptionsRole) => Achat[];
  /**
   * ⭐ [A2-Prêtre s360] Le cercle/domaine que l'ARCHÉTYPE impose, quand la
   * mesure en dégage un au noyau : 🕊️ `Domaine:Guerre` (2/2) et 📿
   * `Domaine:Bénédiction` (2/2). Absent = le joueur choisit (`ctx.element`),
   * comme les 5 rôles Mage dont le cercle est libre (référence §5.1 ①).
   *
   * ⚠️ C'est ce qui rend possible le patron « ARCHÉTYPE D'ABORD, RELIGION
   * ENSUITE » (référence §5.2 ③) : tirer la foi en premier rendrait ces deux
   * rôles inaccessibles au hasard, puisque 4 religions proscrivent la Guerre
   * et 1 la Bénédiction. Le filtrage par religion vit dans le RÉSOLVEUR.
   */
  magieImposee?: string;
}

export interface EntreePool {
  /** Identité de l'entrée (affichage, dédup, essentiels retenus ③). */
  label: string;
  note: string;
  achats: (inv: ReadonlySet<string>, o: OptionsRole) => Achat[];
  condition?: (inv: ReadonlySet<string>, o: OptionsRole) => boolean;
}

export type EtapePond =
  | {
      type: "achats";
      label: string;
      achats: (inv: ReadonlySet<string>, o: OptionsRole) => Achat[];
    }
  | { type: "jauge"; nom: string; plafondRachats: number };

export interface ContenuClasse {
  classe: ClasseId;
  gratuites: readonly string[];
  alertesGratuites?: (inv: ReadonlySet<string>) => string[];
  roles: readonly RoleClasse[];
  /** ⭐ s352 — MONTÉES SIGNATURE, indexées par rôle comme `pond4`.
   *  Prises EN TÊTE de ③, dans l'ordre déclaré, AVANT tout tirage : c'est
   *  ce qui rend l'archétype reconnaissable. Jamais laissé au hasard. */
  signature3?: Record<string, EntreePool[]>;
  pool3: Record<string, EntreePool[]>;
  pond4: Record<string, EtapePond[]>;
  filet: EtapePond[];
}

export const comp = (
  nom: string,
  niveauCible = 1,
  choix?: string
): Achat => ({
  t: "comp",
  nom,
  niveauCible,
  choix,
});
/**
 * ⭐ [R1a s361] `choix` = le `choix_achat` de la base, OBLIGATOIRE pour les
 * compétences `multiple_avec_choix_par_niveau` (Acquisition de Cercle et de
 * Domaine). Mesure prod : 122 + 56 lignes, **zéro** sans choix. Un rachat
 * sans nom produirait une ligne comme il n'en existe aucune.
 */
export const rachat = (nom: string, choix?: string): Achat => ({
  t: "rachat",
  nom,
  choix,
});
/** Le n-ième sort représentatif du cercle choisi (rang 1 = le plus signifiant). */
/** `slot: 2` = le sort va dans le SECOND cercle (`o.element2`). */
export const sortAuChoix = (rang: number, slot?: 1 | 2): Achat => ({
  t: "sortAuChoix",
  rang,
  slot,
});
/** La n-ième prière représentative du domaine (rang 1 = la plus portée). */
/** `slot: 2` = la prière va dans le SECOND domaine (`o.element2`). */
export const priereAuChoix = (rang: number, slot?: 1 | 2): Achat => ({
  t: "priereAuChoix",
  rang,
  slot,
});
export const sort = (nom: string, config: ConfigMagie): Achat => ({
  t: "sort",
  nom,
  config,
});
export const priere = (nom: string, config: ConfigMagie): Achat => ({
  t: "priere",
  nom,
  config,
});

/* ------------------------------------------------------------------ */
/* HELPERS D'ÉTAPE ④ — une seule maison (remontés ici en s355).        */
/*                                                                     */
/* Ils vivaient en DOUBLE, copiés à l'identique dans `guerrier.ts` et  */
/* `voleur.ts`. Le contenu Mage aurait fait une 3ᵉ copie.              */

/** Étape ④ conditionnée par l'inventaire : hors condition elle rend une
 *  liste vide — le composeur passe au suivant sans rien acheter. */
export const si = (
  label: string,
  cases: readonly string[],
  achats: () => Achat[]
): EtapePond => ({
  type: "achats",
  label,
  achats: (inv) => (cases.some((c) => inv.has(c)) ? achats() : []),
});

/** Étape ④ inconditionnelle. */
export const et = (label: string, achats: () => Achat[]): EtapePond => ({
  type: "achats",
  label,
  achats,
});

/* ------------------------------------------------------------------ */
/* ⭐ GARDE « INAPTE À LA MAGIE » (référence v4 §2.2).                  */

/**
 * Les compétences qui coûtent ou donnent des POINTS DE SPIRITUALITÉ.
 *
 * La référence en compte « cinq » en comptant `Développement Spirituel` et
 * sa version Supérieure comme UNE famille ; le code doit nommer les deux,
 * ce sont deux lignes distinctes du catalogue (mesuré : la base refuse
 * bien les deux).
 */
export const COMPETENCES_A_PS: readonly string[] = [
  "Acquisition de Cercle",
  "Acquisition de Domaine",
  "Développement Spirituel",
  "Développement Spirituel Supérieur",
  "Canalisation",
  "Assemblage de Runes",
];

export const estCompetenceAPS = (nom: string): boolean =>
  COMPETENCES_A_PS.includes(nom);

/**
 * ⭐ Un archétype DEMANDE-T-IL des PS ? — DÉRIVÉ du noyau, jamais déclaré.
 *
 * Un drapeau écrit à la main sur chaque rôle serait un chiffre de
 * conception de plus (règle s353) et se désynchroniserait du contenu au
 * premier remaniement. On lit donc ce que le rôle ÉMET réellement en ② :
 * une compétence à PS, un sort ou une prière ⇒ il demande des PS.
 *
 * ⭐ s355 — PORTE SUR ② NOYAU **ET** ③a SIGNATURE (arbitrage Fred).
 * Les deux sont DÉTERMINISTES : le noyau définit le rôle, la signature est
 * prise en tête de ③ avant tout tirage, c'est elle qui rend l'archétype
 * reconnaissable. Un rôle dont la signature exige des PS ne peut donc pas
 * être joué sans PS — le refuser est plus honnête que le livrer amputé.
 *
 * ⚠️ Le pool ③b, lui, n'entre PAS dans ce verdict, et ce n'est pas un oubli :
 * il est indexé par THÈME (« Arcaniste+ », « Offensif »…) et PARTAGÉ entre
 * les rôles d'une classe, pas attaché à un rôle. Une entrée à PS y est
 * TIRÉE ou CHOISIE, donc facultative : on l'ÉCARTE du tirage plutôt que de
 * refuser tout le rôle. Refuser sur le pool reviendrait à interdire un rôle
 * à cause d'une option que le générateur n'aurait de toute façon pas prise.
 *
 * Consommé ici pour REFUSER le rôle à un personnage inapte, et par le lot
 * 🎲 pour tirer l'archétype D'ABORD et le trait racial ENSUITE — un
 * Demi-Orc garde ainsi l'accès aux 15.
 */
export const archetypeDemandeDesPS = (
  contenu: ContenuClasse,
  roleId: string,
  inv: ReadonlySet<string> = new Set(),
  o: OptionsRole = {}
): boolean => {
  const role = contenu.roles.find((r) => r.id === roleId);
  if (!role) return false;

  const lots: Achat[][] = [];
  try {
    lots.push(role.noyau(inv, o));
  } catch {
    /* un noyau qui refuse ne dit rien sur les PS */
  }
  for (const entree of contenu.signature3?.[roleId] ?? []) {
    try {
      if (entree.condition && !entree.condition(inv, o)) continue;
      lots.push(entree.achats(inv, o));
    } catch {
      /* idem */
    }
  }
  return lots.some(exigeDesPS);
};

/** Un lot d'achats touche-t-il aux points de spiritualité ?
 *  ⚠️ [R1b s362] `sortAuChoix`/`priereAuChoix` SONT des sorts/prières : le
 *  prédicat de s355 les ratait — nés en s358 avec « le contenu ne nomme plus
 *  ses sorts », ils avaient désarmé la garde pour tout noyau caster sans
 *  compétence à PS explicite (📿 Consécration + priereAuChoix passait pour
 *  « sans PS », un inapte recevait une prière). Patron Gotcha C68. */
export const exigeDesPS = (achats: readonly Achat[]): boolean =>
  achats.some(
    (a) =>
      a.t === "sort" ||
      a.t === "priere" ||
      a.t === "sortAuChoix" ||
      a.t === "priereAuChoix" ||
      ((a.t === "comp" || a.t === "rachat") && estCompetenceAPS(a.nom))
  );

/** Une entrée de pool ③b touche-t-elle aux PS ? (évaluation défensive) */
export const entreeExigeDesPS = (
  entree: EntreePool,
  inv: ReadonlySet<string>,
  o: OptionsRole
): boolean => {
  try {
    return exigeDesPS(entree.achats(inv, o));
  } catch {
    return false;
  }
};

/**
 * ⭐ FILETS MARTIAUX — PLAFONDS MESURÉS EN PROD (s353, arbitrage Fred).
 *
 * L'ancien `FILET_MARTIAL_COMMUN` ouvrait `Connaissances des Religions` à
 * **15 rachats** : un chiffre de conception, jamais mesuré. Le générateur
 * pouvait en poser **7 d'affilée** sur une fiche. Or sur les 99 personnages
 * vivants, `Connaissances des Religions` est portée par **3 guerriers sur 21**
 * (moins de 3 voleurs sur 16) et **jamais plus d'une fois**. Une fiche à sept
 * religions ne ressemble à aucun joueur réel.
 *
 * Les plafonds ci-dessous sont les MAXIMA OBSERVÉS chez les vivants de la
 * classe, pas des estimations :
 *   guerrier · `Développement Spirituel` 4 porteurs/21, jusqu'à **5** rachats
 *              (2 XP l'unité — la vraie petite monnaie du guerrier)
 *            · `Connaissances des Religions` 3/21, **1** rachat, jamais deux
 *   voleur   · `Langue supplémentaire` 4 porteurs/16, jusqu'à **6** rachats
 *            · `Connaissances des Religions` 2/16, **1** rachat
 *            · `Développement Spirituel` 1/16, **1** rachat (2 XP — le grain
 *              qui termine la cascade, règle s346)
 *
 * ⚠️ Chaque plafond est le MAXIMUM OBSERVÉ, pas une cible : le générateur ne
 * remplit une jauge que faute de mieux, après la couche ④ de l'archétype.
 */
export const FILET_GUERRIER: EtapePond[] = [
  { type: "jauge", nom: "Développement Spirituel", plafondRachats: 5 },
  { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 1 },
];

export const FILET_VOLEUR: EtapePond[] = [
  { type: "jauge", nom: "Langue supplémentaire", plafondRachats: 6 },
  { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 1 },
  { type: "jauge", nom: "Développement Spirituel", plafondRachats: 1 },
];

/**
 * Filet caster : chaque PS = un lancer de plus — DS 2 XP puis DSS 4 XP.
 * Reliquat borné à 3 (une unité DSS ne rentre plus, DS au plafond).
 *
 * ⭐ D'OÙ VIENNENT CES DEUX « 10 » (mesuré s355, règle s353).
 * Ce ne sont PAS des maxima observés, contrairement aux filets martiaux :
 * c'est le PLAFOND DU JEU lui-même. Le manuel borne `Développement
 * Spirituel` à 20 PS et sa version Supérieure à 30 ; `recalculer_ps_max`
 * fait `ps_max = ps_depart + nb_DS + nb_DSS`, et `classes.ps_depart` vaut
 * **10** pour le Mage comme pour le Prêtre. Donc 10 rachats de DS mènent
 * pile à 20, et 10 de DSS pile à 30. Un plafond plus haut produirait une
 * fiche illégale ; plus bas, de l'XP non dépensée.
 *
 * Concordance prod : sur 33 mages vivants, 9 des 22 porteurs sont
 * exactement à 10 rachats ; sur 17 prêtres, 8 des 12. Ils sont au plafond,
 * ils ne s'y sont pas arrêtés par goût.
 * (Comparaison utile : Guerrier et Voleur ont `ps_depart` = 5, donc leur
 * plafond de JEU serait 15 — `FILET_GUERRIER` s'arrête à 5 parce que 5 est
 * le maximum RÉELLEMENT observé. Les deux filets ne se justifient pas de
 * la même façon.)
 */
export const FILET_CASTER: EtapePond[] = [
  { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
  { type: "jauge", nom: "Développement Spirituel Supérieur", plafondRachats: 10 },
];

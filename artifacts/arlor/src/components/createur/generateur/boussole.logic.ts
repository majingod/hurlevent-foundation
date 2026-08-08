import {
  archetypeDemandeDesPS,
  type ContenuClasse,
  type RoleClasse,
} from "@/moteurCreation/generateur/contenu/commun";
import type { Catalogues } from "@/moteurCreation/generateur/composer";
import {
  POIDS_SOUS_TYPE_CHIMERIDE,
  POIDS_TRAITS,
  cleRaceTraits,
  poidsDe,
} from "@/moteurCreation/generateur/contenu/traits";
import {
  CERCLES_JAMAIS_TIRES,
  DOMAINES_JAMAIS_TIRES,
  TRAIT_INAPTE,
  nomsAcquisPrevisionnels,
  sondeElement,
  sousTypesTirables,
  traitsRaciauxProposables,
  type ChoixJoueur,
  type DepsResolveur,
  type FoiProposable,
  type MondeResolveur,
} from "@/moteurCreation/generateur/resoudre";
import type { ContexteComposition } from "@/moteurCreation/generateur/types";

/**
 * [VIS-8 lot 🧭 PR-β2, s367] Logique PURE de l'escalier « Je choisis mes
 * grandes lignes » — tout ce qui se teste sans DOM. L'écran (`EcranBoussole`)
 * ne fait que rendre ce que ce module dérive.
 *
 * ⭐ AUCUNE RÈGLE DE JEU ICI : les pools viennent du résolveur
 * (`classesProposables`, `rolesProposables`, `religionsProposables`), les
 * exclusions des constantes du moteur (`CERCLES_JAMAIS_TIRES`…), les prix de
 * la grille mesurée. Ce module ne porte que la MISE EN PHRASES.
 */

type ClasseId = ContexteComposition["classe"];

/** Émoji des 4 voies — éditorial de la maquette validée s366 (n'existe pas
 *  en base ; les libellés vivent dans `LABELS_CLASSES`, ficheTirage.logic). */
export const EMOJIS_CLASSES: Record<ClasseId, string> = {
  guerrier: "⚔️",
  voleur: "🗡️",
  mage: "🔮",
  pretre: "🙏",
};

/** Le rôle EXIGE-t-il un cercle/domaine choisi par le joueur ?
 *  Vrai pour les casters dont le noyau DÉCLARE sa magie même sans élément
 *  (🎭🔮✨ᚱ⛪ — `sortAuChoix`/`priereAuChoix` sont des déclarations, leur
 *  résolution vient après) ; faux pour la magie imposée (🕊️📿) et pour tout
 *  rôle sans spirituel. ⭐ [D40 s372] Sondé À NU : c'est la NÉCESSITÉ qu'on
 *  mesure — ✝️, dont la prière est désormais conditionnée au domaine, répond
 *  non ici et oui à `roleElementOptionnel`. (Le piège C71 concernait
 *  `requiert`, une porte d'équipement qui se sonde AVEC élément — deux
 *  verbes, deux sondes, comme au résolveur.) */
export function roleAttendElement(
  contenu: ContenuClasse,
  cats: Catalogues,
  role: RoleClasse,
  inventaire: ReadonlySet<string>
): boolean {
  if (role.magieImposee) return false;
  if (contenu.classe !== "mage" && contenu.classe !== "pretre") return false;
  return archetypeDemandeDesPS(contenu, role.id, inventaire, {});
}

/** ⭐ [DÉCISION 40, s372] Le rôle PEUT-il porter un élément sans l'exiger ?
 *  Dérivé, jamais une liste en dur : il n'en demande pas à nu, mais en
 *  utiliserait un si on lui en donne (sonde du résolveur — même élément que
 *  `rolesProposables`). Aujourd'hui : ✝️ seul. L'étape « Ton domaine »
 *  s'affiche alors sans jamais bloquer la fiche. */
export function roleElementOptionnel(
  contenu: ContenuClasse,
  cats: Catalogues,
  role: RoleClasse,
  inventaire: ReadonlySet<string>
): boolean {
  if (role.magieImposee) return false;
  if (contenu.classe !== "mage" && contenu.classe !== "pretre") return false;
  if (archetypeDemandeDesPS(contenu, role.id, inventaire, {})) return false;
  return archetypeDemandeDesPS(contenu, role.id, inventaire, {
    element: sondeElement(contenu, cats),
  });
}

/** Un rôle est « caster » s'il PEUT porter un élément — imposé, exigé ou
 *  optionnel (D40). C'est la visibilité de l'étape cercle/domaine ; la case
 *  « un second ? » suit l'ÉLÉMENT POSÉ, pas ce prédicat (pas de second sans
 *  premier). */
export const roleEstCaster = (
  contenu: ContenuClasse,
  cats: Catalogues,
  role: RoleClasse,
  inventaire: ReadonlySet<string>
): boolean =>
  !!role.magieImposee ||
  roleAttendElement(contenu, cats, role, inventaire) ||
  roleElementOptionnel(contenu, cats, role, inventaire);

/** L'avertissement d'un cercle/domaine du catalogue complet, ou `null`.
 *
 *  ⚠️ DEUX MOTIFS DISTINCTS, jamais fusionnés (référence §5.1 ② / §5.2 ②) :
 *  - CERCLE des jamais-tirés → interdit par le MONDE (lois de Torekh) : le
 *    porter fait un hors-la-loi. Texte de la maquette validée s366.
 *  - DOMAINE des jamais-tirés → affaire de FOI : proscrit par certaines
 *    religions, légitime dans les autres. Les comptes sont DÉRIVÉS du monde
 *    injecté, jamais écrits en dur. */
export function avertissementElement(
  genre: "cercle" | "domaine",
  nom: string,
  monde: MondeResolveur
): string | null {
  if (genre === "cercle") {
    return CERCLES_JAMAIS_TIRES.includes(nom)
      ? "⚖️ Hors-la-loi à Destéa — choisis en connaissance."
      : null;
  }
  if (!DOMAINES_JAMAIS_TIRES.includes(nom)) return null;
  const actives = monde.religions.filter((r) => r.est_actif);
  const proscrivent = actives.filter((r) =>
    r.domaines_proscrits.includes(nom)
  ).length;
  return `⚖️ Selon ta foi — ${proscrivent} religions la proscrivent, ${
    actives.length - proscrivent
  } l'honorent.`;
}

/** La phrase d'intro de l'étape Foi — les trois comptes, dérivés de la liste
 *  que `religionsProposables` a déjà triée. */
export function resumeFois(
  fois: readonly FoiProposable[],
  domaine: string,
  domaine2?: string | null
): string {
  const n = (s: FoiProposable["statut"]) =>
    fois.filter((f) => f.statut === s).length;
  const tete =
    `${n("predilection")} fois portent ${domaine} en prédilection · ` +
    `${n("toleree")} le tolèrent · `;
  // [s368 #5] Avec un SECOND domaine, chaque compte porte SA cause — un
  // total à deux causes ne s'impute jamais au premier domaine (mesuré en
  // prod : « 9 le proscrivent » imputait à Guerre 5 refus dus au second).
  const proscrites = fois.filter((f) => f.statut === "proscrite");
  if (!domaine2 || proscrites.length === 0) {
    return tete + `${n("proscrite")} le proscrivent (grisées).`;
  }
  const compte = (garde: (p: readonly string[]) => boolean) =>
    proscrites.filter((f) => garde(f.proscrits ?? [])).length;
  const brutes: Array<[number, string]> = [
    [compte((p) => p.includes(domaine) && !p.includes(domaine2)), domaine],
    [compte((p) => !p.includes(domaine) && p.includes(domaine2)), domaine2],
    [compte((p) => p.includes(domaine) && p.includes(domaine2)), "les deux"],
  ];
  const pleines = brutes.filter(([c]) => c > 0);
  const parts = pleines.map(([c, l], i) =>
    i === 0 ? `${c} proscri${c > 1 ? "vent" : "t"} ${l}` : `${c} ${l}`
  );
  return tete + `${proscrites.length} grisées — ${parts.join(" · ")}.`;
}

/** Étiquette de la case « second » — le 5 XP est la GRILLE d'accès niveau 1
 *  (`Acquisition de Cercle/Domaine`, mesurée s361 et présente telle quelle
 *  dans les fixtures : 5/10/15), jamais un chiffre de tête. La magie/prière
 *  incluse vient de la décision 16 (« jamais un accès sec »). */
export const etiquetteSecond = (genre: "cercle" | "domaine"): string =>
  genre === "cercle"
    ? "+5 XP d'accès et une magie dedans — pris sur le reste."
    : "+5 XP d'accès et une prière dedans — pris sur le reste.";

/** L'état courant du parcours — ce que le joueur a posé. */
export interface ParcoursBoussole {
  classe: ClasseId | null;
  roleId: string | null;
  element: string | null;
  second: boolean;
  element2: string | null;
  religionId: string | null;
  /** ⭐ [D53, s381] Barreau 5 « Ton héritage » — sous-type (Chiméride
   *  seulement) et trait racial gratuit. `null` = pas encore posé
   *  EXPLICITEMENT : `heritageEffectif` retombe alors sur le suggéré
   *  (le plus porté), jamais sur un cul-de-sac. */
  sousTypeChimeride: string | null;
  traitRacialChoisi: string | null;
}

export const PARCOURS_VIDE: ParcoursBoussole = {
  classe: null,
  roleId: null,
  element: null,
  second: false,
  element2: null,
  religionId: null,
  sousTypeChimeride: null,
  traitRacialChoisi: null,
};

/** ⭐ [D53, s381] Motif verbatim de la maquette — griser « Inapte à la
 *  magie » pour un rôle CASTER (`roleEstCaster`, connu dès qu'un rôle est
 *  choisi, bien avant que la composition existe). */
export const MOTIF_INAPTE_GRISE =
  "Ta fiche lance des sorts — ce trait t'enlève tes points de spiritualité pour toujours.";

export interface SousTypeAffiche {
  valeur: string;
  suggere: boolean;
  /** « 3 Chimérides sur 5 au terrain. » — dérivé de `POIDS_SOUS_TYPE_CHIMERIDE`. */
  justification: string;
}

/** [D53] Les sous-types d'une race, ordre = poids DÉCROISSANT (le plus
 *  porté au terrain en tête), avec sa justification chiffrée. Vide pour les
 *  10 races sans sous-type — le barreau cache alors cette carte. */
export function sousTypesAffiches(
  monde: MondeResolveur,
  race: { id: string; nom: string }
): SousTypeAffiche[] {
  const valeurs = sousTypesTirables(monde, race.id);
  const poids = (v: string) => poidsDe(v, POIDS_SOUS_TYPE_CHIMERIDE);
  const total = valeurs.reduce((s, v) => s + poids(v), 0);
  return [...valeurs]
    .sort((a, b) => poids(b) - poids(a) || a.localeCompare(b, "fr"))
    .map((valeur, i) => ({
      valeur,
      suggere: i === 0,
      justification: `${poids(valeur)} ${race.nom}s sur ${total} au terrain.`,
    }));
}

export interface TraitRacialAffiche {
  id: string;
  nom: string;
  description: string;
  suggere: boolean;
  grise: boolean;
  motif?: string;
}

/** [D53] Le pool EXHAUSTIF (`traitsRaciauxProposables`, C75 : l'ouvert et le
 *  fermé), ordonné poids DÉCROISSANT puis alphabétique FR (§3 — JAMAIS un
 *  tri alphabétique seul), avec le suggéré (le poids max, jamais un trait
 *  grisé) et le grisage déterministe d'« Inapte à la magie » pour un rôle
 *  caster. `description` vient de `monde.traits_raciaux` (verbatim manuel). */
export function traitsRaciauxAffiches(
  monde: MondeResolveur,
  race: { id: string; nom: string },
  sousType: string | undefined,
  estCaster: boolean
): TraitRacialAffiche[] {
  const pool = traitsRaciauxProposables(monde, race.id, sousType);
  const descriptions = new Map(
    monde.traits_raciaux.map((t) => [t.id, t.description])
  );
  const table = POIDS_TRAITS[cleRaceTraits(race.nom, sousType)] ?? {};
  const tries = [...pool].sort((a, b) => {
    const diff = poidsDe(b.nom, table) - poidsDe(a.nom, table);
    return diff !== 0 ? diff : a.nom.localeCompare(b.nom, "fr");
  });
  const idDefaut = tries.find(
    (t) => !(t.nom === TRAIT_INAPTE && estCaster)
  )?.id;
  return tries.map((t) => {
    const grise = t.nom === TRAIT_INAPTE && estCaster;
    return {
      id: t.id,
      nom: t.nom,
      description: descriptions.get(t.id) ?? "",
      suggere: t.id === idDefaut,
      grise,
      motif: grise ? MOTIF_INAPTE_GRISE : undefined,
    };
  });
}

/** [D53] La 2ᵉ ligne « à quoi ça te sert » (§3, carte validée Fred s380) —
 *  conditionnée à ce que la composition EN COURS achète déjà (avant même le
 *  trait racial, cf. `nomsAcquisPrevisionnels`). Les traits absents de la
 *  table servent toujours de SAVEUR — repli honnête, jamais un mensonge. */
export interface ContexteUsageTraits {
  alchimie: boolean;
  forge: boolean;
  empoisonne: boolean;
  /** Points de spiritualité — `roleEstCaster`, connu dès le rôle posé. */
  ps: boolean;
}

const COMPETENCES_POISON = ["Expertise en toxicologie", "Empoisonnement de projectile"];

export function contexteUsageTraits(
  nomsAcquis: readonly string[],
  estCaster: boolean
): ContexteUsageTraits {
  return {
    alchimie: nomsAcquis.includes("Alchimie"),
    forge: nomsAcquis.includes("Forge"),
    empoisonne: nomsAcquis.some((n) => COMPETENCES_POISON.includes(n)),
    ps: estCaster,
  };
}

const TEXTE_SANS_LIEN = "Aucun lien avec tes compétences — il joue pareil pour tous.";

/** Table éditoriale — 1 phrase par trait ACTIF (§3). Un trait absent d'ici
 *  (ou dont la condition ne tient pas) affiche `TEXTE_SANS_LIEN`. */
const USAGE_TRAITS: Record<
  string,
  (c: ContexteUsageTraits) => string | null
> = {
  "Coup du destin": (c) =>
    c.alchimie
      ? "Tu as Alchimie : tu récoltes des plantes à chaque événement."
      : c.forge
        ? "Tu as Forge : tu récoltes du minerai à chaque événement."
        : null,
  "Poigne ardente": (c) =>
    c.ps ? "Tu lances des sorts : le point de spiritualité rendu te sert." : null,
  Infusé: (c) =>
    c.alchimie
      ? "Tu as Alchimie : ce trait remplace une dose mineure par ta salive."
      : null,
  "Poussière des profondeurs": (c) =>
    c.forge ? "Tu as Forge : tu récoltes du minerai à chaque événement." : null,
  "Sang toxique": (c) =>
    c.empoisonne ? "Tu empoisonnes : ce trait transforme ton sang en poison." : null,
  "Estomac d'acier": (c) =>
    c.alchimie
      ? "Tu as Alchimie : ce trait double le nombre de potions que tu ingères."
      : null,
  "Inapte à la magie": (c) =>
    !c.ps
      ? "Tu n'auras jamais de points de spiritualité — en échange, +1 PV permanent."
      : null,
};

export function texteUsageTrait(
  nomTrait: string,
  ctx: ContexteUsageTraits
): { sert: boolean; texte: string } {
  const texte = USAGE_TRAITS[nomTrait]?.(ctx) ?? null;
  return texte ? { sert: true, texte } : { sert: false, texte: TEXTE_SANS_LIEN };
}

export interface HeritageEffectif {
  sousType?: string;
  traitId?: string;
  traitNom?: string;
}

/** [D53] LA RÉSOLUTION UNIQUE du barreau — une seule maison pour
 *  `pretPourFiche`, `construireChoix` ET l'écran (le rendu du « suggéré »).
 *  Retombe sur le suggéré quand le joueur n'a rien posé, OU quand son choix
 *  ne tient plus dans le pool COURANT (sous-type changé, trait devenu
 *  hors-pool ou grisé) — c'est le garde-fou DÉFENSIF de cette lecture pure.
 *
 *  Répond ⑧ : « le trait coché doit-il se réinitialiser au changement de
 *  sous-type ? » — la maquette code « oui » sans condition
 *  (`traitCourant=null` au clic), et l'écran REPRODUIT ce « oui » exactement
 *  (`EcranBoussole` réinitialise `traitRacialChoisi` au clic sous-type,
 *  avant même d'atteindre cette fonction). Le garde-fou ci-dessus ne sert
 *  donc jamais à CE chemin : il protège les appelants directs (tests,
 *  futurs consommateurs) qui construiraient un `ParcoursBoussole` avec une
 *  combinaison sous-type/trait déjà incohérente. Jamais d'écriture d'état
 *  ici : une lecture pure. */
export function heritageEffectif(
  monde: MondeResolveur,
  raceId: string,
  estCaster: boolean,
  p: Pick<ParcoursBoussole, "sousTypeChimeride" | "traitRacialChoisi">
): HeritageEffectif {
  const race = monde.races.find((r) => r.id === raceId);
  if (!race) return {};
  const sousTypes = sousTypesAffiches(monde, race);
  const sousType =
    (p.sousTypeChimeride &&
    sousTypes.some((s) => s.valeur === p.sousTypeChimeride)
      ? p.sousTypeChimeride
      : sousTypes.find((s) => s.suggere)?.valeur) ?? undefined;
  const traits = traitsRaciauxAffiches(monde, race, sousType, estCaster);
  const choisi = p.traitRacialChoisi
    ? traits.find((t) => t.id === p.traitRacialChoisi && !t.grise)
    : undefined;
  const effectif = choisi ?? traits.find((t) => t.suggere);
  return { sousType, traitId: effectif?.id, traitNom: effectif?.nom };
}

/** Le bouton « Voir ma fiche » ne s'allume que quand chaque étape ATTENDUE
 *  est remplie — jamais un envoi au moteur qu'on sait incomplet. (Le moteur
 *  re-vérifie de toute façon et refuse avec sa phrase : ceinture ET
 *  bretelles, deux maisons parce que deux moments.)
 *
 *  ⭐ [D53, C84] Le barreau « Ton héritage » entre ici : sans trait
 *  résoluble (pool vide, cas défensif), le bouton reste éteint — jamais un
 *  envoi au moteur avec `traitsRaciauxChoisis` vide. */
export function pretPourFiche(
  p: ParcoursBoussole,
  contenu: ContenuClasse | null,
  cats: Catalogues | null,
  inventaire: ReadonlySet<string>,
  monde: MondeResolveur,
  raceId: string | null
): boolean {
  if (!p.classe || !p.roleId || !contenu || !cats || !raceId) return false;
  const role = contenu.roles.find((r) => r.id === p.roleId);
  if (!role) return false;
  if (roleAttendElement(contenu, cats, role, inventaire) && !p.element)
    return false;
  if (p.second && !p.element2) return false;
  if (p.classe === "pretre" && !p.religionId) return false;
  const estCaster = roleEstCaster(contenu, cats, role, inventaire);
  if (!heritageEffectif(monde, raceId, estCaster, p).traitId) return false;
  return true;
}

/** Le `ChoixJoueur` que le conteneur enverra à `resoudreChoix`.
 *
 *  ⭐ [D53, s381 — remplace l'arbitrage s367/s372] `traitsChoisis` est
 *  DÉSORMAIS alimenté : le trait posé au barreau « Ton héritage »
 *  (`heritageEffectif`, explicite ou suggéré) entre dans le `ChoixJoueur`.
 *  Le résolveur en dérive l'aptitude ET compose en le sachant (D53) — «
 *  Inapte à la magie » choisi produit une fiche sans magie et sans
 *  Développement Spirituel, plus jamais une fiche à corriger après coup. */
export function construireChoix(
  p: ParcoursBoussole,
  raceId: string,
  inventaire: ReadonlySet<string>,
  monde: MondeResolveur,
  estCaster: boolean
): ChoixJoueur {
  if (!p.classe || !p.roleId) {
    throw new Error("[boussole] parcours incomplet — le bouton devait être éteint.");
  }
  const heritage = heritageEffectif(monde, raceId, estCaster, p);
  return {
    classe: p.classe,
    roleId: p.roleId,
    raceId,
    inventaire,
    element: p.element ?? undefined,
    element2: p.second ? (p.element2 ?? undefined) : undefined,
    religionId: p.religionId,
    ...(heritage.sousType ? { sousTypeChimeride: heritage.sousType } : {}),
    ...(heritage.traitNom ? { traitsChoisis: [heritage.traitNom] } : {}),
  };
}

/** [D53] Aperçu des noms déjà acquis (gratuités + achats), AVANT le trait —
 *  fine couche autour de `nomsAcquisPrevisionnels` : le barreau connaît déjà
 *  `deps`/`raceId`/`inventaire`, seule la classe/rôle/élément du parcours
 *  varie. `null` si le parcours n'a pas encore de rôle (écran pas atteint). */
export function nomsAcquisDuParcours(
  deps: DepsResolveur,
  raceId: string,
  inventaire: ReadonlySet<string>,
  p: ParcoursBoussole
): string[] {
  if (!p.classe || !p.roleId) return [];
  return nomsAcquisPrevisionnels(deps, {
    classe: p.classe,
    roleId: p.roleId,
    raceId,
    inventaire,
    element: p.element ?? undefined,
    element2: p.second ? (p.element2 ?? undefined) : undefined,
  });
}

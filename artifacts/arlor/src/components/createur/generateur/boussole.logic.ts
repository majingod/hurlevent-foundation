import {
  archetypeDemandeDesPS,
  type ContenuClasse,
  type RoleClasse,
} from "@/moteurCreation/generateur/contenu/commun";
import type { Catalogues } from "@/moteurCreation/generateur/composer";
import {
  CERCLES_JAMAIS_TIRES,
  DOMAINES_JAMAIS_TIRES,
  cerclesTirables,
  domainesTirables,
  type ChoixJoueur,
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

/** Le rôle attend-il un cercle/domaine CHOISI par le joueur ?
 *  Vrai pour les casters à choix libre (🎭🔮✨ᚱ⛪✝️), faux pour les rôles à
 *  magie imposée (🕊️📿 — l'élément est déjà connu) et pour tout rôle sans
 *  spirituel. Le critère est celui du MOTEUR (`archetypeDemandeDesPS`, sondé
 *  avec un élément du pool — piège C71), jamais une liste de rôles en dur. */
export function roleAttendElement(
  contenu: ContenuClasse,
  cats: Catalogues,
  role: RoleClasse,
  inventaire: ReadonlySet<string>
): boolean {
  if (role.magieImposee) return false;
  if (contenu.classe !== "mage" && contenu.classe !== "pretre") return false;
  const sonde =
    contenu.classe === "pretre"
      ? domainesTirables(cats)[0]
      : cerclesTirables(cats)[0];
  return archetypeDemandeDesPS(contenu, role.id, inventaire, {
    element: sonde,
  });
}

/** Un rôle est « caster » s'il porte un élément — choisi OU imposé. C'est la
 *  condition de la case « un second cercle/domaine ? » (en 🧭 elle est
 *  offerte à TOUS les casters — politique s361, le résolveur fait foi). */
export const roleEstCaster = (
  contenu: ContenuClasse,
  cats: Catalogues,
  role: RoleClasse,
  inventaire: ReadonlySet<string>
): boolean =>
  !!role.magieImposee || roleAttendElement(contenu, cats, role, inventaire);

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
}

export const PARCOURS_VIDE: ParcoursBoussole = {
  classe: null,
  roleId: null,
  element: null,
  second: false,
  element2: null,
  religionId: null,
};

/** Le bouton « Voir ma fiche » ne s'allume que quand chaque étape ATTENDUE
 *  est remplie — jamais un envoi au moteur qu'on sait incomplet. (Le moteur
 *  re-vérifie de toute façon et refuse avec sa phrase : ceinture ET
 *  bretelles, deux maisons parce que deux moments.) */
export function pretPourFiche(
  p: ParcoursBoussole,
  contenu: ContenuClasse | null,
  cats: Catalogues | null,
  inventaire: ReadonlySet<string>
): boolean {
  if (!p.classe || !p.roleId || !contenu || !cats) return false;
  const role = contenu.roles.find((r) => r.id === p.roleId);
  if (!role) return false;
  if (roleAttendElement(contenu, cats, role, inventaire) && !p.element)
    return false;
  if (p.second && !p.element2) return false;
  if (p.classe === "pretre" && !p.religionId) return false;
  return true;
}

/** Le `ChoixJoueur` que le conteneur enverra à `resoudreChoix`.
 *
 *  ⚠️ ARBITRAGE FRED s367 : `traitsChoisis` n'est PAS posé — le résolveur
 *  dérive l'inaptitude du MODÈLE (le pool de la race), et c'est voulu : une
 *  race qui PEUT être inapte voit ses voies à PS grisées en amont
 *  (divergence délibérée avec la décision 33, documentée). */
export function construireChoix(
  p: ParcoursBoussole,
  raceId: string,
  inventaire: ReadonlySet<string>
): ChoixJoueur {
  if (!p.classe || !p.roleId) {
    throw new Error("[boussole] parcours incomplet — le bouton devait être éteint.");
  }
  return {
    classe: p.classe,
    roleId: p.roleId,
    raceId,
    inventaire,
    element: p.element ?? undefined,
    element2: p.second ? (p.element2 ?? undefined) : undefined,
    religionId: p.religionId,
  };
}

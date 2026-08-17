import type { ContexteComposition } from "@/moteurCreation/generateur/types";
import {
  classesProposables,
  religionsProposables,
  rolesProposables,
  type DepsResolveur,
} from "@/moteurCreation/generateur/resoudre";

import {
  PARCOURS_VIDE,
  roleAttendElement,
  roleElementOptionnel,
  roleEstCaster,
  sousTypesAffiches,
  traitsRaciauxAffiches,
  type ParcoursBoussole,
} from "./boussole.logic";

/**
 * ⭐ [D62, s407] `[BOUSSOLE-PARCOURS-PERDU-EN-QUITTANT]` — les réponses de
 * la boussole (inventaire coché, race retenue, parcours de l'escalier)
 * vivaient en `useState` dans `Generateur.tsx` : démonter le composant
 * (retour aux trois chemins, navigation, rechargement) les perdait toutes.
 * s368 #2 les avait fait survivre à « ← Ajuster » ; ce module les fait
 * survivre au démontage du générateur entier.
 *
 * Elles vivent dans `sessionStorage` — sur l'appareil du joueur SEULEMENT,
 * rien ne part au serveur (Loi 25), et l'onglet fermé emporte tout
 * (éphémère assumé : on répare la navigation, pas la fin de session).
 *
 * ⛔ La restauration est FAIL-CLOSED, champ par champ, dans l'ordre des
 * dépendances (inventaire → race → voie → rôle → élément(s) → foi →
 * héritage) : une valeur n'est gardée que si LES MÊMES gardes que l'escalier
 * l'acceptent encore (`classesProposables`, `rolesProposables`,
 * `religionsProposables`, `sousTypesAffiches`, `traitsRaciauxAffiches` —
 * une seule maison, jamais une 2ᵉ liste de règles). Un champ invalide se
 * jette AVEC tout ce qui dépend de lui : un Chiméride 🌿 restauré ne
 * redevient jamais 🥩 par défaut (leçon s406 : un état qui voyage voyage
 * ENTIER, dans les DEUX directions).
 *
 * ⛔ D58 intact : l'écran courant ne se persiste JAMAIS — les trois chemins
 * se remontrent toujours ; les réponses réapparaissent en re-marchant le
 * fil (équipement pré-coché, race pré-retenue, escalier pré-rempli).
 */

type ClasseId = ContexteComposition["classe"];

export const VERSION_ETAT_BOUSSOLE = 1;

/** La clé du navigateur — par personnage (un parcours ne fuit jamais d'une
 *  fiche à l'autre), `visiteur` quand il n'y a pas de personnage. */
export const cleEtatBoussole = (personnageId: string | null): string =>
  `hv.boussole.v${VERSION_ETAT_BOUSSOLE}.${personnageId ?? "visiteur"}`;

/** Ce que le générateur restaure — l'état « réponses » et rien d'autre. */
export interface EtatBoussole {
  inventaire: ReadonlySet<string>;
  raceId: string | null;
  parcours: ParcoursBoussole;
}

export const ETAT_BOUSSOLE_VIDE: EtatBoussole = {
  inventaire: new Set<string>(),
  raceId: null,
  parcours: PARCOURS_VIDE,
};

/** La forme SUR LE DISQUE — versionnée : toute autre version se jette. */
interface EtatSauve {
  v: number;
  inventaire: string[];
  raceId: string | null;
  parcours: ParcoursBoussole;
}

export function serialiserEtatBoussole(etat: EtatBoussole): string {
  const sauve: EtatSauve = {
    v: VERSION_ETAT_BOUSSOLE,
    inventaire: [...etat.inventaire],
    raceId: etat.raceId,
    parcours: etat.parcours,
  };
  return JSON.stringify(sauve);
}

const estObjet = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null;

/**
 * Restauration PURE et fail-closed. `objetsConnus` = les ids
 * d'`objetsGenerateur()` (le module ne lit jamais le snapshot lui-même :
 * testable à sec, mêmes fixtures que `boussole.logic.test.ts`).
 */
export function restaurerEtatBoussole(
  brut: string | null | undefined,
  deps: DepsResolveur,
  objetsConnus: ReadonlySet<string>
): EtatBoussole {
  if (!brut) return ETAT_BOUSSOLE_VIDE;
  let lu: unknown;
  try {
    lu = JSON.parse(brut);
  } catch {
    return ETAT_BOUSSOLE_VIDE;
  }
  if (!estObjet(lu) || lu.v !== VERSION_ETAT_BOUSSOLE) return ETAT_BOUSSOLE_VIDE;

  // ① L'inventaire — intersection avec les objets que le snapshot connaît.
  const inventaire: ReadonlySet<string> = new Set(
    (Array.isArray(lu.inventaire) ? lu.inventaire : []).filter(
      (id): id is string => typeof id === "string" && objetsConnus.has(id)
    )
  );

  // ② La race — le critère d'EcranRace (jouable ET active). Sans race
  //    valide, rien d'autre ne se restaure : tout l'escalier en dépend.
  const raceId = typeof lu.raceId === "string" ? lu.raceId : null;
  const race = raceId
    ? deps.monde.races.find(
        (r) => r.id === raceId && r.est_jouable && r.est_actif
      )
    : undefined;
  if (!race) return { inventaire, raceId: null, parcours: PARCOURS_VIDE };

  const p = estObjet(lu.parcours)
    ? (lu.parcours as Partial<ParcoursBoussole>)
    : null;
  const parcours: ParcoursBoussole = { ...PARCOURS_VIDE };
  if (!p) return { inventaire, raceId: race.id, parcours };

  // ③ La voie — gardée ssi OUVERTE pour cette race et cet inventaire.
  const classe =
    typeof p.classe === "string" &&
    p.classe in deps.parClasse &&
    classesProposables(deps, race.id, inventaire).some(
      (v) => v.classe === p.classe && v.ouverte
    )
      ? (p.classe as ClasseId)
      : null;
  if (!classe) return { inventaire, raceId: race.id, parcours };
  parcours.classe = classe;
  const { contenu, cats } = deps.parClasse[classe];

  // ④ Le rôle — ouvert avec cet inventaire (visiteur APTE, décisions 41+42 :
  //    l'inaptitude est un trait d'INSTANCE, l'écran passe `false` aux pools).
  const role =
    typeof p.roleId === "string"
      ? (rolesProposables(contenu, cats, inventaire, false).find(
          (r) => r.ouvert && r.role.id === p.roleId
        )?.role ?? null)
      : null;
  if (!role) return { inventaire, raceId: race.id, parcours };
  parcours.roleId = role.id;

  // ⑤ L'élément — le catalogue de l'escalier, même genre ; une magie
  //    IMPOSÉE par l'archétype rend l'élément stocké caduc (elle gagne).
  const catalogue =
    classe === "pretre" ? cats.magie.domaines() : cats.magie.cercles();
  const attend = roleAttendElement(contenu, cats, role, inventaire);
  const optionnel = roleElementOptionnel(contenu, cats, role, inventaire);
  const imposee = role.magieImposee ?? null;
  if (
    !imposee &&
    (attend || optionnel) &&
    typeof p.element === "string" &&
    catalogue.includes(p.element)
  ) {
    parcours.element = p.element;
  }
  const elementEffectif = imposee ?? parcours.element;
  if (
    p.second === true &&
    typeof p.element2 === "string" &&
    elementEffectif !== null &&
    p.element2 !== elementEffectif &&
    catalogue.includes(p.element2)
  ) {
    parcours.second = true;
    parcours.element2 = p.element2;
  }

  // ⑥ La foi — prêtre seulement, jamais une proscrite (même liste,
  //    mêmes domaines, que le barreau de l'écran).
  if (
    classe === "pretre" &&
    typeof p.religionId === "string" &&
    (elementEffectif !== null || optionnel)
  ) {
    const foi = religionsProposables(
      deps.monde,
      elementEffectif ?? undefined,
      parcours.second ? (parcours.element2 ?? undefined) : undefined
    ).find((f) => f.religion.id === p.religionId && f.statut !== "proscrite");
    if (foi) parcours.religionId = foi.religion.id;
  }

  // ⑦ L'héritage — sous-type dans les affichés ; trait dans le pool NON
  //    grisé (le même pool que le barreau : un trait devenu incompatible
  //    avec la magie du parcours ne revient pas).
  if (
    typeof p.sousTypeChimeride === "string" &&
    sousTypesAffiches(deps.monde, race).some(
      (s) => s.valeur === p.sousTypeChimeride
    )
  ) {
    parcours.sousTypeChimeride = p.sousTypeChimeride;
  }
  if (typeof p.traitRacialChoisi === "string") {
    const estCaster = roleEstCaster(contenu, cats, role, inventaire);
    const garde = traitsRaciauxAffiches(
      deps.monde,
      race,
      parcours.sousTypeChimeride ?? undefined,
      estCaster
    ).some((t) => t.id === p.traitRacialChoisi && !t.grise);
    if (garde) parcours.traitRacialChoisi = p.traitRacialChoisi;
  }

  return { inventaire, raceId: race.id, parcours };
}

/* ------------------------------------------------------------------ *
 * Le navigateur — chaque accès sous try/catch : la persistance est un
 * CONFORT, jamais un bloqueur (Safari privé, quota, environnement sans
 * sessionStorage → le générateur se comporte comme avant D62).
 * ------------------------------------------------------------------ */

export function lireEtatBoussoleBrut(cle: string): string | null {
  try {
    return window.sessionStorage.getItem(cle);
  } catch {
    return null;
  }
}

export function sauverEtatBoussole(cle: string, etat: EtatBoussole): void {
  try {
    window.sessionStorage.setItem(cle, serialiserEtatBoussole(etat));
  } catch {
    /* silencieux — voir l'en-tête du bloc */
  }
}

export function purgerEtatBoussole(cle: string): void {
  try {
    window.sessionStorage.removeItem(cle);
  } catch {
    /* silencieux — voir l'en-tête du bloc */
  }
}

/** Le geste UNIQUE du montage de `Generateur` : lit, construit les deps,
 *  restaure fail-closed. Si le pont snapshot lève (`ErreurPontSnapshot`),
 *  tout vide — exactement l'écran d'avant D62. */
export function restaurerDepuisNavigateur(
  cle: string | undefined,
  construireDeps: () => DepsResolveur,
  objetsConnus: () => ReadonlySet<string>
): EtatBoussole {
  if (!cle) return ETAT_BOUSSOLE_VIDE;
  const brut = lireEtatBoussoleBrut(cle);
  if (brut === null) return ETAT_BOUSSOLE_VIDE;
  try {
    return restaurerEtatBoussole(brut, construireDeps(), objetsConnus());
  } catch {
    return ETAT_BOUSSOLE_VIDE;
  }
}

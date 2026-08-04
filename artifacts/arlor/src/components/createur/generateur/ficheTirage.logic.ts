/**
 * [VIS-8 lot 🎲, s364] Logique PURE de la fiche du tirage — extraite du
 * composant pour être testée sans DOM (le repo n'a pas d'infra de test de
 * composants, choix assumé : le .tsx reste mince).
 * Maquette validée par Fred en s364 (maquette_fiche_tirage_s364.jsx).
 */
import { CONTENU_GUERRIER } from "@/moteurCreation/generateur/contenu/guerrier";
import { CONTENU_MAGE } from "@/moteurCreation/generateur/contenu/mage";
import { CONTENU_PRETRE } from "@/moteurCreation/generateur/contenu/pretre";
import { CONTENU_VOLEUR } from "@/moteurCreation/generateur/contenu/voleur";
import type {
  AchatMagiePlanifie,
  AchatPlanifie,
  ClasseId,
  CompositionOk,
} from "@/moteurCreation/generateur/types";

export const NOMS_COUCHES: Record<2 | 3 | 4, string> = {
  2: "② Ton noyau",
  3: "③ Tiré pour toi",
  4: "④ Le reste, dans l'esprit du rôle",
};

export const LABELS_CLASSES: Record<ClasseId, string> = {
  guerrier: "Guerrier",
  mage: "Mage",
  pretre: "Prêtre",
  voleur: "Voleur",
};

export interface MetaRole {
  emoji: string;
  titre: string;
  phrase: string;
}

const CONTENUS = {
  guerrier: CONTENU_GUERRIER,
  mage: CONTENU_MAGE,
  pretre: CONTENU_PRETRE,
  voleur: CONTENU_VOLEUR,
} as const;

/** Emoji/titre/phrase du rôle tiré — repli neutre si l'id est inconnu. */
export function metaRole(classe: ClasseId, roleId: string): MetaRole {
  const role = CONTENUS[classe].roles.find((r) => r.id === roleId);
  return role
    ? { emoji: role.emoji, titre: role.titre, phrase: role.phrase }
    : { emoji: "🎲", titre: roleId, phrase: "" };
}

/** Une ligne regroupée : n achats identiques + la liste des choix tirés. */
export interface GroupeAchat extends AchatPlanifie {
  n: number;
  coutTotal: number;
  choixTires: string[];
}

/**
 * Regroupe les lignes identiques (nom, niveau, coût, couche, motif) en
 * « ×n », en conservant la liste des choix tirés (langues, religions…).
 * L'ORDRE d'apparition est conservé (le composeur place les prérequis
 * avant leurs dépendants depuis le fix s364).
 */
export function grouperAchats(achats: readonly AchatPlanifie[]): GroupeAchat[] {
  const groupes: GroupeAchat[] = [];
  const index = new Map<string, GroupeAchat>();
  for (const a of achats) {
    const cle = `${a.nom}@${a.niveau}|${a.coutXp}|${a.couche}|${a.motif}`;
    const g = index.get(cle);
    if (g) {
      g.n += 1;
      g.coutTotal += a.coutXp;
      if (a.choix) g.choixTires.push(a.choix);
    } else {
      const neuf: GroupeAchat = {
        ...a,
        n: 1,
        coutTotal: a.coutXp,
        choixTires: a.choix ? [a.choix] : [],
      };
      index.set(cle, neuf);
      groupes.push(neuf);
    }
  }
  return groupes;
}

/** Coût XP d'une couche = compétences + magie de cette couche. */
export function coutCouche(
  composition: Pick<CompositionOk, "achats" | "achatsMagie">,
  couche: 2 | 3 | 4
): number {
  return (
    composition.achats
      .filter((a) => a.couche === couche)
      .reduce((s, a) => s + a.coutXp, 0) +
    composition.achatsMagie
      .filter((m) => m.couche === couche)
      .reduce((s, m) => s + m.coutXp, 0)
  );
}

/** ⭐ [C1 s375] Coût XP des enveloppes d'artisanat — les gratuites pèsent 0,
 *  seules les recettes payantes (3 XP, D-C) chargent le total. */
export function coutArtisanat(
  composition: Pick<CompositionOk, "artisanat">
): number {
  return composition.artisanat.reduce(
    (s, p) => s + p.nb * p.coutUnitaire,
    0
  );
}

export const magieDeCouche = (
  composition: Pick<CompositionOk, "achatsMagie">,
  couche: 2 | 3 | 4
): AchatMagiePlanifie[] =>
  composition.achatsMagie.filter((m) => m.couche === couche);

/**
 * Note joueur des traits devenus impossibles (conduite 3, §2.2).
 * Formulation validée par Fred en s364. `null` si rien à dire.
 */
export function texteTraitsIncompatibles(traits: readonly string[]): string | null {
  if (traits.length === 0) return null;
  const liste = traits.map((t) => `« ${t} »`).join(" et ");
  return traits.length === 1
    ? `Ce personnage a acheté du spirituel : le trait ${liste} ne sera pas proposé à l'étape des traits.`
    : `Ce personnage a acheté du spirituel : les traits ${liste} ne seront pas proposés à l'étape des traits.`;
}

/** Indice « sac vide » (cas de premier ordre, décision 31) — validé s364. */
export const TEXTE_SAC_VIDE =
  "Ton sac est vide : seul l'Humain part sans costume — les 7 autres races " +
  "en exigent un. Coche ton équipement puis Relance pour ouvrir le reste.";

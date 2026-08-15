/**
 * Un nom de personnage est un PLACEHOLDER quand il ne porte AUCUNE lettre ni
 * chiffre : `null`, `""`, `"   "`, `"..."`, `"---"`, `"?"`. Le verbe est
 * « peut-on imprimer une fiche avec ce nom ? » — le même que l'instrument
 * SQL de la sanity d'ouverture (`nom IS NULL OR nom !~ '[[:alnum:]]'`, s403).
 *
 * ⛔ Pas de plancher de longueur : le CHECK `personnages_nom_longueur` accepte
 * ≥ 2 caractères et des joueurs réels portent 3 lettres (mesuré s403 : 0 nom
 * réel de 2 caractères, 5 de 3 dont 2 placeholders « ... »). Ajouter un
 * plancher fabriquerait des faux positifs sur des vrais noms (C101).
 *
 * ⛔ Le CHECK lui-même n'est PAS durci : il frapperait des fiches déjà créées.
 *
 * Consommateurs (s403) : la modale d'inscription à un événement (côté joueur,
 * `ModalesInscription.tsx`) et la liste des inscrits d'un événement (côté
 * orga, `AdminEvenements.tsx`). Les autres `?? "Sans nom"` du dépôt ne voient
 * que `null` — voir la dette `[NOMS-PLACEHOLDER-DEVERROUILLAGE]`.
 */
export const estNomPlaceholder = (nom: string | null | undefined): boolean =>
  nom == null || !/[\p{L}\p{N}]/u.test(nom);

/** Ligne dorée sous la liste des personnages, quand celui qui est choisi n'a pas de nom. */
export const TEXTE_INSCRIPTION_SANS_NOM =
  "Ce personnage n'a pas encore de nom. Sur le terrain, l'orga imprime les fiches — donne-lui un nom dans le créateur avant le jeu.";

/** Libellé du lien qui mène au créateur, à côté de la ligne dorée. */
export const LIBELLE_LIEN_NOMMER = "Nommer ce personnage";

/** Badge orga sur la liste des inscrits — le mot déjà employé partout côté admin. */
export const BADGE_SANS_NOM = "Sans nom";

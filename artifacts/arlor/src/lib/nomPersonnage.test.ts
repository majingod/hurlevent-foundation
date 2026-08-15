import { describe, it, expect } from "vitest";
import {
  estNomPlaceholder,
  TEXTE_INSCRIPTION_SANS_NOM,
  LIBELLE_LIEN_NOMMER,
  BADGE_SANS_NOM,
} from "./nomPersonnage";

/**
 * Le prédicat est le jumeau JS de l'instrument SQL de sanity
 * (`nom IS NULL OR nom !~ '[[:alnum:]]'`). Les deux faces sont attestées sur
 * un corpus SYNTHÉTIQUE : aucun nom réel de joueur n'entre au dépôt (C106).
 */
describe("estNomPlaceholder — JUMEAU A (placeholders / vrais noms)", () => {
  it("① positif : tout ce qui ne porte aucune lettre ni chiffre est un placeholder", () => {
    const placeholders: Array<string | null | undefined> = [
      null,
      undefined,
      "",
      "   ",
      "...",
      "…",
      "---",
      "?",
      "***",
      "- - -",
    ];
    for (const nom of placeholders) {
      expect(estNomPlaceholder(nom), `attendu placeholder : ${JSON.stringify(nom)}`).toBe(true);
    }
    expect(placeholders).toHaveLength(10);
  });

  it("② négatif : une seule lettre ou un seul chiffre suffit à faire un nom", () => {
    const noms = [
      "Zoé", // 3 lettres, accent — la forme réelle la plus courte du jeu
      "M.H", // ponctuation + lettres
      "Tya",
      "Ka'el", // apostrophe
      "Ægir", // ligature
      "北", // hors latin — \p{L} le voit, [[:alnum:]] aussi en UTF-8
      "R2",
      "1",
      "a",
      " x ", // espaces autour d'une lettre
      "Kuro Veine-d'Argent",
    ];
    for (const nom of noms) {
      expect(estNomPlaceholder(nom), `attendu vrai nom : ${JSON.stringify(nom)}`).toBe(false);
    }
    expect(noms).toHaveLength(11);
  });
});

describe("estNomPlaceholder — JUMEAU B (pas de plancher de longueur)", () => {
  it("① un nom de 2 caractères alphabétiques N'EST PAS un placeholder (le CHECK accepte ≥ 2)", () => {
    expect(estNomPlaceholder("Io")).toBe(false);
  });

  it("② deux caractères non alphanumériques restent un placeholder", () => {
    expect(estNomPlaceholder("..")).toBe(true);
  });
});

describe("Textes joueur / orga — VERBATIM littéral (C101 : jamais contre la constante)", () => {
  it("① la ligne dorée décrit un lien (l'orga imprime), n'affirme pas un effet", () => {
    expect(TEXTE_INSCRIPTION_SANS_NOM).toBe(
      "Ce personnage n'a pas encore de nom. Sur le terrain, l'orga imprime les fiches — donne-lui un nom dans le créateur avant le jeu.",
    );
  });

  it("② le lien nomme le geste", () => {
    expect(LIBELLE_LIEN_NOMMER).toBe("Nommer ce personnage");
  });

  it("③ le badge orga reprend le mot déjà employé côté admin", () => {
    expect(BADGE_SANS_NOM).toBe("Sans nom");
  });
});

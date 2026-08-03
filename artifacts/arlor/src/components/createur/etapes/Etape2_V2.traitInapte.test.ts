/**
 * [WIZARD-TRAIT-INCOMPATIBLE-NON-GRISE, s373] La RAISON du grisage du trait
 * « Inapte à la magie » — miroir MOT POUR MOT du refus serveur
 * (`valider_etape_3`, volet 3 s370, code `trait_inapte_magie_incoherent`).
 *
 * Un test sur un texte destiné au joueur asserte la CHAÎNE ENTIÈRE (`toBe`),
 * jamais un `toContain` (Gotcha C78 : une raison PRÉSENTE n'est pas une
 * raison JUSTE). Les trois décompositions du serveur sont couvertes : sorts
 * seuls, prières seules, les deux.
 *
 * PREUVE PAR LE CONTRAIRE : sans magie (0/0), la fonction rend `null` — le
 * trait n'est PAS grisé (un Demi-Orc frais doit pouvoir le choisir).
 */

import { describe, expect, it } from "vitest";

import { raisonTraitInapteBloque } from "./Etape2_V2.calc";

describe("raisonTraitInapteBloque — miroir de valider_etape_3 (volet 3)", () => {
  it("sorts seuls : phrase serveur exacte, décomposée (C78)", () => {
    expect(raisonTraitInapteBloque(3, 0)).toBe(
      "Ce personnage possède déjà 3 sort(s) : le trait « Inapte à la magie » " +
        "lui retirerait définitivement tous ses points de spiritualité. " +
        "Retirez sa magie avant de choisir ce trait.",
    );
  });

  it("prières seules : phrase serveur exacte, décomposée (C78)", () => {
    expect(raisonTraitInapteBloque(0, 2)).toBe(
      "Ce personnage possède déjà 2 prière(s) : le trait « Inapte à la magie » " +
        "lui retirerait définitivement tous ses points de spiritualité. " +
        "Retirez sa magie avant de choisir ce trait.",
    );
  });

  it("les deux : les DEUX causes sont nommées, jamais un total agrégé (C78)", () => {
    expect(raisonTraitInapteBloque(1, 4)).toBe(
      "Ce personnage possède déjà 1 sort(s) et 4 prière(s) : le trait " +
        "« Inapte à la magie » lui retirerait définitivement tous ses points " +
        "de spiritualité. Retirez sa magie avant de choisir ce trait.",
    );
  });

  it("preuve par le contraire : sans magie (0/0), rien à griser (null)", () => {
    expect(raisonTraitInapteBloque(0, 0)).toBeNull();
  });
});

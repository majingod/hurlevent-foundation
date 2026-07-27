/** [VIS-8 lot 🎲, s364] Logique de la fiche du tirage — tests purs. */
import { describe, expect, it } from "vitest";

import type { AchatPlanifie } from "@/moteurCreation/generateur/types";

import {
  coutCouche,
  grouperAchats,
  metaRole,
  texteTraitsIncompatibles,
} from "./ficheTirage.logic";

const achat = (
  nom: string,
  couche: 2 | 3 | 4,
  coutXp: number,
  extras: Partial<AchatPlanifie> = {}
): AchatPlanifie => ({
  competenceId: `id-${nom}`,
  nom,
  niveau: 1,
  coutXp,
  couche,
  motif: "jauge d'étendue",
  ...extras,
});

describe("grouperAchats", () => {
  it("fusionne les lignes identiques en ×n et additionne le coût", () => {
    const g = grouperAchats([
      achat("Développement Spirituel", 4, 2),
      achat("Développement Spirituel", 4, 2),
      achat("Développement Spirituel", 4, 2),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].n).toBe(3);
    expect(g[0].coutTotal).toBe(6);
  });

  it("conserve la liste des choix tirés dans l'ordre", () => {
    const g = grouperAchats([
      achat("Connaissances des Religions", 4, 4, { choix: "Les Justicares de Sorelf" }),
      achat("Connaissances des Religions", 4, 4, { choix: "La Compagnie de Zenlia" }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].choixTires).toEqual([
      "Les Justicares de Sorelf",
      "La Compagnie de Zenlia",
    ]);
  });

  it("CONTRAIRE : un niveau, un coût ou un motif différent ne fusionne pas", () => {
    const g = grouperAchats([
      achat("Consécration", 2, 7, { motif: "📿 noyau" }),
      achat("Consécration", 3, 10, { niveau: 2, motif: "📿 signature" }),
    ]);
    expect(g).toHaveLength(2);
  });
});

describe("coutCouche", () => {
  it("additionne compétences ET magie de la couche, sans déborder", () => {
    const composition = {
      achats: [achat("A", 2, 5), achat("B", 3, 7)],
      achatsMagie: [
        {
          type: "sort" as const,
          modeleId: "m1",
          nom: "Jet de flammes",
          config: { niveau: 1, zone: "1 Cible", portee: "10 Pieds", duree: "Instantanée" },
          coutXp: 6,
          coutPS: 2,
          couche: 2 as const,
          motif: "noyau",
        },
      ],
    };
    expect(coutCouche(composition as never, 2)).toBe(11);
    expect(coutCouche(composition as never, 3)).toBe(7);
    expect(coutCouche(composition as never, 4)).toBe(0);
  });
});

describe("metaRole", () => {
  it("retrouve emoji/titre/phrase d'un rôle réel", () => {
    const m = metaRole("pretre", "pConsecrateur");
    expect(m.emoji).toBe("📿");
    expect(m.titre).toBe("Le consécrateur");
    expect(m.phrase.length).toBeGreaterThan(0);
  });

  it("repli neutre sur un id inconnu (jamais d'écran cassé)", () => {
    const m = metaRole("mage", "roleDisparu");
    expect(m).toEqual({ emoji: "🎲", titre: "roleDisparu", phrase: "" });
  });
});

describe("texteTraitsIncompatibles", () => {
  it("null quand rien à dire (pas d'encart vide)", () => {
    expect(texteTraitsIncompatibles([])).toBeNull();
  });

  it("formulation validée s364 pour un trait", () => {
    const t = texteTraitsIncompatibles(["Inapte à la magie"]);
    expect(t).toContain("« Inapte à la magie »");
    expect(t).toContain("ne sera pas proposé");
  });

  it("accord pluriel pour plusieurs traits", () => {
    const t = texteTraitsIncompatibles(["A", "B"]);
    expect(t).toContain("« A » et « B »");
    expect(t).toContain("ne seront pas proposés");
  });
});

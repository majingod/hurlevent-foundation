/** [VIS-8 lot 🎲, s364] Logique de la fiche du tirage — tests purs. */
import { describe, expect, it } from "vitest";

import type {
  AchatPlanifie,
  ArtisanatTire,
} from "@/moteurCreation/generateur/types";

import {
  coutCouche,
  grouperAchats,
  itemsDuPlan,
  ligneTraitRacial,
  metaRole,
  TEXTE_TRAIT_INAPTE,
  TEXTE_TRAIT_OFFERT,
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

/* ------------------------------------------------------------------ */
/* ⭐ [D52 s380] LA FICHE ANNONCE LE TRAIT — ou ne dit rien             */
/* ------------------------------------------------------------------ */

describe("ligneTraitRacial", () => {
  it("null quand le tirage n'en porte pas (fiche rendue sans tirage de trait)", () => {
    // Cas de PREMIER ORDRE, pas un oubli : 🧭 laisse le joueur choisir son
    // trait au wizard, et les appelants v1 ne connaissent pas le champ. La
    // carte identité ne doit alors afficher NI ligne vide, NI « — ».
    expect(ligneTraitRacial({ inapteMagie: false })).toBeNull();
    expect(
      ligneTraitRacial({
        inapteMagie: false,
        traitRacialTire: undefined,
        sousTypeChimeride: undefined,
      })
    ).toBeNull();
  });

  it("rend le trait tiré quand il existe, avec la note « offert »", () => {
    expect(
      ligneTraitRacial({
        inapteMagie: false,
        traitRacialTire: { id: "t1", nom: "Fortuné" },
      })
    ).toEqual({ sousType: null, trait: "Fortuné", note: TEXTE_TRAIT_OFFERT });
  });

  it("le sous-type voyage avec — il qualifie le PEUPLE, pas le trait", () => {
    expect(
      ligneTraitRacial({
        inapteMagie: false,
        sousTypeChimeride: "carnivore",
        traitRacialTire: { id: "t2", nom: "Charognard" },
      })
    ).toEqual({
      sousType: "carnivore",
      trait: "Charognard",
      note: TEXTE_TRAIT_OFFERT,
    });
    // Un sous-type SEUL suffit à rendre la ligne (la carte affiche alors
    // « Chiméride carnivore » sans ligne 🧬) — l'inverse aussi. Pas de trait
    // ⇒ pas de note à donner (rien ne sera rendu par le composant).
    expect(
      ligneTraitRacial({ inapteMagie: false, sousTypeChimeride: "herbivore" })
    ).toEqual({ sousType: "herbivore", trait: null, note: null });
  });

  /* ---------------------------------------------------------------- */
  /* ⭐⭐ [D52-bis, s380] LA NOTE MENT SUR LE DEMI-ORC INAPTE — corrigée */
  /* ---------------------------------------------------------------- */

  it("verbatim validé par Fred — la note par défaut ne bouge pas", () => {
    expect(TEXTE_TRAIT_OFFERT).toBe("offert, tiré pour toi");
  });

  it("verbatim validé par Fred — la note du cas inapte (manuel l.1353, 1491)", () => {
    expect(TEXTE_TRAIT_INAPTE).toBe(
      "ta race et ta voie le posent : pas d'accès à la magie, et +1 PV"
    );
  });

  it("[cas inapte] inapteMagie vrai + « Inapte à la magie » ⇒ la note inapte, verbatim", () => {
    const l = ligneTraitRacial({
      inapteMagie: true,
      traitRacialTire: { id: "inapte", nom: "Inapte à la magie" },
    });
    expect(l?.note).toBe(
      "ta race et ta voie le posent : pas d'accès à la magie, et +1 PV"
    );
  });

  it("[cas normal] inapteMagie faux + n'importe quel autre trait ⇒ « offert », non-régression", () => {
    const l = ligneTraitRacial({
      inapteMagie: false,
      traitRacialTire: { id: "t3", nom: "Increvable" },
    });
    expect(l?.note).toBe("offert, tiré pour toi");
  });

  it("[Chiméride] le sous-type suffixe toujours le peuple, la note reste celle du cas normal", () => {
    const l = ligneTraitRacial({
      inapteMagie: false,
      sousTypeChimeride: "carnivore",
      traitRacialTire: { id: "t2", nom: "Charognard" },
    });
    expect(l).toEqual({
      sousType: "carnivore",
      trait: "Charognard",
      note: "offert, tiré pour toi",
    });
  });
});

/* ------------------------------------------------------------------ */
/* ⭐ [C2 s375-v2] Les items nommés, sous LEUR enveloppe                */
/* ------------------------------------------------------------------ */

describe("itemsDuPlan", () => {
  // ⚗️ Alchimie 2 : DEUX enveloppes `recette` gratuites (index 0 = 5
  // mineures, index 1 = 4 intermédiaires) + une payante (index 2). C'est le
  // cas qu'un filtre (famille, gratuité) confondrait.
  const TIRE: ArtisanatTire = {
    recettes: [
      { id: "r1", nom: "Potion de soins", estGratuit: true, plan: 0 },
      { id: "r2", nom: "Poison de sommeil", estGratuit: true, plan: 0 },
      { id: "r3", nom: "Antidote universel", estGratuit: true, plan: 1 },
      { id: "r4", nom: "Remède curatif", estGratuit: false, plan: 2 },
    ],
    assemblages: [
      { id: "a1", nom: "Rune de force", estGratuit: true, plan: 3 },
    ],
    pieges: [],
  };

  it("chaque enveloppe ne reçoit QUE ses items (jamais ceux de sa jumelle)", () => {
    expect(itemsDuPlan(TIRE, "recette", 0).map((i) => i.id)).toEqual(["r1", "r2"]);
    expect(itemsDuPlan(TIRE, "recette", 1).map((i) => i.id)).toEqual(["r3"]);
    expect(itemsDuPlan(TIRE, "recette", 2).map((i) => i.id)).toEqual(["r4"]);
    // Preuve par le contraire : un filtre par famille seule en rendrait 4
    // sous CHACUNE des trois enveloppes, soit 12 lignes pour 4 acquisitions.
    expect(TIRE.recettes).toHaveLength(4);
  });

  it("la famille compte : une enveloppe d'assemblage ne pioche pas dans les recettes", () => {
    expect(itemsDuPlan(TIRE, "assemblage", 3).map((i) => i.id)).toEqual(["a1"]);
    expect(itemsDuPlan(TIRE, "assemblage", 0)).toEqual([]);
    expect(itemsDuPlan(TIRE, "piege", 0)).toEqual([]);
  });

  it("sans tirage fourni : liste vide — la fiche retombe sur l'enveloppe seule", () => {
    expect(itemsDuPlan(undefined, "recette", 0)).toEqual([]);
  });
});

/**
 * GATE DES FIXTURES PRÊTRE (lot P0, s359).
 *
 * Ce fichier existe parce qu'une recapture de fixture est INVISIBLE pour la CI :
 * élargir un jeu de données ne casse aucun test, donc une suite verte ne prouve
 * pas que les bons fichiers sont arrivés. Ces trois tests échouent si l'une des
 * deux fixtures est restée dans sa version d'avant s359.
 *
 * ⚠️ Portée exacte, mesurée (s359) : les tests 1 et 3 rougissent sur les fixtures
 * d'avant s359 — ce sont eux les gates d'arrivée. Le test 2 (homonymes) passe des
 * deux côtés : l'ancienne fixture en portait déjà 2 (Insensibilité à la douleur,
 * Présence intimidante), la nouvelle en porte 31. Il ne prouve donc PAS l'arrivée
 * des fichiers ; il verrouille la séparation des deux catalogues, sur une matière
 * qui passe de 2 à 31 cas réels. Il n'est pas vert à vide — son assertion
 * `homonymes.length > 0` le garantit — mais il ne remplace pas les deux autres.
 */
import { describe, expect, it } from "vitest";

import { CatalogueMagie, type PriereModele, type SortModele } from "./catalogueMagie";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import fxPretre from "./fixtures/competences_pretre.fixture.json";

const magie = fxMagie as unknown as { sorts: SortModele[]; prieres: PriereModele[] };
const competences = (fxPretre as { competences: { nom: string; categorie: string }[] })
  .competences;

describe("fixtures Prêtre — capture s359", () => {
  it("porte TOUTES les prières de niveau 1 des 8 domaines, pas seulement celles des rôles", () => {
    // Motif : le domaine d'un prêtre dépend de sa RELIGION (15 religions × 2 domaines
    // proscrits). Une fixture partielle rendrait la moitié des combinaisons intestable.
    expect(magie.prieres).toHaveLength(64);
    expect([...new Set(magie.prieres.map((p) => p.domaine))].sort()).toEqual([
      "Bénédiction",
      "Chaos",
      "Connaissance",
      "Guerre",
      "Nature",
      "Nécromancie",
      "Ordre",
      "Éléments",
    ]);
    expect(magie.prieres.every((p) => p.niveau === 1)).toBe(true);
  });

  it("sépare un sort d'une prière qui portent le MÊME nom", () => {
    const cat = new CatalogueMagie(magie);
    const homonymes = magie.sorts
      .map((s) => s.nom)
      .filter((n) => magie.prieres.some((p) => p.nom === n));

    // Sans homonymes dans la fixture, l'assertion suivante ne prouverait rien.
    expect(homonymes.length).toBeGreaterThan(0);
    for (const nom of homonymes) {
      expect(cat.exigerSort(nom)).toBe(magie.sorts.find((s) => s.nom === nom));
      expect(cat.exigerPriere(nom)).toBe(magie.prieres.find((p) => p.nom === nom));
    }
  });

  it("porte les compétences des 4 archétypes mesurés, pas seulement celles du contenu actuel", () => {
    // `Revenu` est au noyau de ⛪ le prêtre de rite, `Canalisation` (version prêtre,
    // homonyme du mage) au noyau de 🕊️ le missionnaire — les deux manquaient.
    expect(competences).toHaveLength(28);
    const parNom = new Map(competences.map((c) => [c.nom, c]));
    expect(parNom.get("Revenu")?.categorie).toBe("generale");
    expect(parNom.get("Canalisation")?.categorie).toBe("pretre");
    for (const nom of ["Chirurgien", "Estimation", "Herbalisme", "Langue supplémentaire"]) {
      expect(parNom.has(nom)).toBe(true);
    }
  });
});

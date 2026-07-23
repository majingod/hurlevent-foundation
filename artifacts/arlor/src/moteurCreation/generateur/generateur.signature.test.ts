/**
 * [VIS-8 s352] LA MONTÉE SIGNATURE (couche ③a).
 *
 * Ce que ça garantit AU JOUEUR : quand le 🎲 lui donne un archétype, il repart
 * TOUJOURS avec la montée qui le rend reconnaissable — jamais « si les dés la
 * sortent ». Avant s352, `teteDeListe` était déclaré, posé dans les 4 classes,
 * et lu NULLE PART : un tirage à 80 XP pouvait rendre l'archétype méconnaissable.
 *
 * Le contenu réel des 15 archétypes arrive au lot suivant : ces tests exercent
 * le MÉCANISME sur un contenu synthétique, pour qu'il ne dépende d'aucun
 * arbitrage de contenu encore ouvert.
 */
import { describe, expect, it } from "vitest";

import { CatalogueCompetences } from "./catalogue";
import { CatalogueMagie, type PriereModele, type SortModele } from "./catalogueMagie";
import {
  composerClasse,
  tirerEssentielsClasse,
  type Catalogues,
} from "./composer";
import { comp, type ContenuClasse, type EntreePool } from "./contenu/commun";
import fxGuerrier from "./fixtures/competences_guerrier.fixture.json";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import type { CompetenceCatalogue } from "./types";

const cats: Catalogues = {
  competences: new CatalogueCompetences(
    (fxGuerrier as { competences: unknown[] })
      .competences as CompetenceCatalogue[]
  ),
  magie: new CatalogueMagie(
    fxMagie as unknown as { sorts: SortModele[]; prieres: PriereModele[] }
  ),
};

/** Montée signature : Botte Secrète niveau 2 — générale, donc légale à la
 *  création (plafond 2). Le prix n'est PAS écrit ici (décision 20). */
const SIGNATURE: EntreePool = {
  label: "Botte Secrète 2",
  note: "Ce qui le rend reconnaissable.",
  achats: () => [comp("Botte Secrète", 2)],
};

const contenu = (signature3?: ContenuClasse["signature3"]): ContenuClasse => ({
  classe: "guerrier",
  gratuites: [],
  roles: [
    {
      id: "rTest",
      emoji: "🧪",
      titre: "Le témoin",
      phrase: "Rôle de test.",
      requiert: () => null,
      noyau: () => [comp("Désengagement", 1)],
    },
  ],
  signature3,
  pool3: {
    Divers: [
      {
        label: "Botte Secrète 2",
        note: "Le même palier, proposé aussi au tirage.",
        achats: () => [comp("Botte Secrète", 2)],
      },
      {
        label: "Résolution Guerrière",
        note: "Une autre entrée, pour que le tirage ait le choix.",
        achats: () => [comp("Résolution Guerrière", 1)],
      },
    ],
  },
  pond4: {},
  filet: [],
});

const ctx = (budget: number) => ({
  roleId: "rTest",
  inventaire: new Set<string>(),
  budget,
});

const paliers = (c: { ok: true; achats: { nom: string; niveau: number }[] }) =>
  c.achats.filter((a) => a.nom === "Botte Secrète").map((a) => a.niveau);

describe("③a — la montée signature", () => {
  it("est prise même quand le joueur n'a retenu aucun essentiel", () => {
    const c = composerClasse(cats, contenu({ rTest: [SIGNATURE] }), ctx(60));
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(paliers(c)).toContain(2);
    expect(c.achats.some((a) => a.nom === "Botte Secrète" && a.couche === 3)).toBe(
      true
    );
  });

  it("n'est PAS prise si le rôle n'en déclare pas — le drapeau mort ne revient pas", () => {
    const c = composerClasse(cats, contenu(), ctx(60));
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(paliers(c)).not.toContain(2);
  });

  it("est facturée à la couche ③, sous le motif du rôle", () => {
    const c = composerClasse(cats, contenu({ rTest: [SIGNATURE] }), ctx(60));
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const a = c.achats.find((x) => x.nom === "Botte Secrète" && x.niveau === 2)!;
    expect(a.couche).toBe(3);
    expect(a.motif).toContain("signature");
  });

  it("est SAUTÉE sans planter quand elle ne rentre pas dans le budget", () => {
    // Prix MESURÉS dans la fixture : noyau (Désengagement 1) = 10 XP,
    // signature (Botte Secrète 1+2) = 21 XP. À 20 le noyau passe, pas elle.
    const c = composerClasse(cats, contenu({ rTest: [SIGNATURE] }), ctx(20));
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(paliers(c)).not.toContain(2);
    expect(c.reliquat).toBeGreaterThanOrEqual(0);
  });

  it("ne coûte jamais deux fois : le tirage ③ ne la repropose pas", () => {
    const tires = tirerEssentielsClasse(
      cats,
      contenu({ rTest: [SIGNATURE] }),
      ctx(60),
      60,
      () => 0
    );
    expect(tires.map((t) => t.label)).not.toContain("Botte Secrète 2");
  });

  it("sans signature déclarée, la même entrée redevient tirable", () => {
    const tires = tirerEssentielsClasse(cats, contenu(), ctx(60), 60, () => 0);
    expect(tires.map((t) => t.label)).toContain("Botte Secrète 2");
  });

  it("est déterministe : même résultat quel que soit l'aléa", () => {
    const a = composerClasse(cats, contenu({ rTest: [SIGNATURE] }), ctx(80));
    const b = composerClasse(cats, contenu({ rTest: [SIGNATURE] }), ctx(80));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.totalDepense).toBe(b.totalDepense);
    expect(paliers(a)).toEqual(paliers(b));
  });

  it("conserve l'XP : dépensé + reliquat = budget", () => {
    for (const budget of [60, 80]) {
      const c = composerClasse(
        cats,
        contenu({ rTest: [SIGNATURE] }),
        ctx(budget)
      );
      expect(c.ok).toBe(true);
      if (!c.ok) return;
      expect(c.totalDepense + c.reliquat).toBe(budget);
    }
  });
});

/**
 * [VIS-8 C1+C2, s375] L'ARTISANAT DU GÉNÉRÉ — « il ne repart pas les mains
 * vides ».
 *
 * Le défaut mesuré : le générateur donnait `Alchimie`, `Assemblage de Runes`,
 * `Création et désarmement de piège` mais AUCUNE des acquisitions que le
 * manuel y attache gratuitement (Alchimie 1 → 5 recettes mineures · Alchimie 2
 * → +4 intermédiaires · Runes 1 → 2 assemblages · Pièges 1 → 3 pièges niv 1).
 * En prod, 24 des 26 artisans vivants ont épuisé leur quota gratuit.
 *
 * Ce que ce fichier tient, dans l'ordre :
 *  1. INTÉGRITÉ des poids mesurés (une faute de frappe = un poids orphelin) ;
 *  2. les GRATUITES sont planifiées — avec sa preuve par le contraire,
 *     EXÉCUTÉE, dont l'échec observé est retranscrit verbatim ;
 *  3. le GRAIN D-C (recettes payantes sur le reliquat) + son jumeau sans
 *     catalogue ;
 *  4. la CONVERSION — les enveloppes deviennent des items, sans doublon ;
 *  5. le tirage SANS REMISE pondéré, sur un pool jouet ;
 *  6. les COMPTES MACHINE (pont + reliquats), re-mesurés et gravés.
 */
import { describe, expect, it } from "vitest";

import snapshotJson from "../../data/snapshotVisiteur.json";
import type { SnapshotVisiteur } from "../snapshot";
import { CatalogueCompetences } from "./catalogue";
import {
  CatalogueMagie,
  type PriereModele,
  type SortModele,
} from "./catalogueMagie";
import { composerClasse, type Catalogues } from "./composer";
import {
  POIDS_ASSEMBLAGES,
  POIDS_DEFAUT,
  POIDS_PIEGES,
  POIDS_RECETTES,
  poidsDe,
  tirerSansRemisePondere,
} from "./contenu/artisanat";
import { CONTENU_MAGE } from "./contenu/mage";
import { CONTENU_VOLEUR } from "./contenu/voleur";
import fxMage from "./fixtures/competences_mage.fixture.json";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import fxMonde from "./fixtures/monde_resolveur.fixture.json";
import fxVoleur from "./fixtures/competences_voleur.fixture.json";
import { depsDepuisSnapshot, taillesArtisanat } from "./pontSnapshot";
import type { Alea, TiragePersonnage } from "./resoudre";
import type { Composition, CompositionOk } from "./types";
import { convertirTirageEnBrouillon, tirerArtisanat } from "./versBrouillon";

/* ------------------------------------------------------------------ */
/* Montage — mêmes fixtures que les autres tests du composeur.         */
/* ------------------------------------------------------------------ */

const snap = snapshotJson as unknown as SnapshotVisiteur;

const magie = new CatalogueMagie(
  fxMagie as unknown as { sorts: SortModele[]; prieres: PriereModele[] }
);
const magieVide = new CatalogueMagie({ sorts: [], prieres: [] });
const catalogue = (fx: unknown): CatalogueCompetences =>
  new CatalogueCompetences(
    (fx as { competences: unknown[] }).competences as never
  );

const catsMage: Catalogues = { competences: catalogue(fxMage), magie };
const catsVoleur: Catalogues = {
  competences: catalogue(fxVoleur),
  magie: magieVide,
};

/** Le sac riche des sweeps s374 — mêmes cases que le résolveur. */
const RICHE: ReadonlySet<string> = new Set([
  "lame_deux_mains", "contondante_courte", "armure_cuir", "ecu", "masque",
  "fioles", "feuille_crayon", "baton_sceptre_baguette", "oreilles_pointues",
  "bourse", "maquillage_vert", "capuchon_cape", "dague", "arc_fleches",
  "instrument_musique",
]);
/** L'éclaireur exige des bandages (sa porte de rôle) — d'où ce sac élargi. */
const RICHE_ECLAIREUR: ReadonlySet<string> = new Set([
  ...RICHE, "lame_courte", "bandages", "arme_distance",
]);

const ok = (c: Composition): CompositionOk => {
  if (!c.ok) throw new Error(`refus inattendu : ${c.raison}`);
  return c;
};

/** ⚗️ le pire cas du sweep s374 : Humain (80 XP), sac riche, mAlchimiste. */
const alchimiste = (cats: Catalogues = catsMage) =>
  ok(
    composerClasse(cats, CONTENU_MAGE, {
      roleId: "mAlchimiste",
      inventaire: RICHE,
      budget: 80,
    })
  );

/** LCG seedé — le même que les autres tests du générateur. */
const lcg = (seed: number): Alea => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
};

/* ------------------------------------------------------------------ */
/* 1. Intégrité des poids                                              */
/* ------------------------------------------------------------------ */

describe("artisanat — intégrité des poids mesurés", () => {
  const noms = (table: string): Set<string> =>
    new Set(
      ((snap.tables[table] ?? []) as { nom?: string | null }[]).flatMap((l) =>
        l.nom ? [l.nom] : []
      )
    );

  it.each([
    ["recettes_alchimie", POIDS_RECETTES],
    ["assemblages_runes", POIDS_ASSEMBLAGES],
    ["pieges", POIDS_PIEGES],
  ])(
    "chaque clé de poids existe au snapshot committé (%s)",
    (table, poids) => {
      const catalogue = noms(table as string);
      const orphelins = Object.keys(poids as Record<string, number>).filter(
        (nom) => !catalogue.has(nom)
      );
      // Un poids orphelin ne CASSE rien : l'item pèserait `POIDS_DEFAUT` et
      // le tirage resterait vert — c'est exactement pourquoi il lui faut ce
      // test-ci. Le nom fautif est cité, pas seulement compté.
      expect(orphelins, `poids orphelins dans ${table}`).toEqual([]);
    }
  );

  it("un nom absent du catalogue retombe sur POIDS_DEFAUT (jumeau de `poidsDe`)", () => {
    expect(poidsDe("Potion de soins", POIDS_RECETTES)).toBe(11);
    expect(poidsDe("Potion qui n'existe pas", POIDS_RECETTES)).toBe(
      POIDS_DEFAUT
    );
  });
});

/* ------------------------------------------------------------------ */
/* 2. Les gratuites sont PLANIFIÉES (+ preuve par le contraire)        */
/* ------------------------------------------------------------------ */

describe("artisanat — les acquisitions gratuites du manuel sont planifiées", () => {
  /**
   * ⭐ LE TEST QUI ROUGIT SUR LA VERSION D'AVANT.
   *
   * PREUVE PAR LE CONTRAIRE EXÉCUTÉE (s375) : les deux blocs « ⭐ [C1 s375] »
   * et « ⭐ [D-C s375] » de `composerClasse` retirés, `artisanat` laissé à
   * `[]`. 10 des 26 tests de ce fichier ont rougi. Ce que la machine a dit
   * sur celui-ci, verbatim :
   *
   *   AssertionError: expected [] to have a length of 2 but got +0
   *   - Expected
   *   + Received
   *   - 2
   *   + 0
   *    ❯ generateur.artisanat.test.ts:176:25
   *        expect(c.artisanat).toHaveLength(2);
   *
   * Et sur ses voisins, la même absence sous un autre angle :
   *   « 🔮 le Runiste » → expected [] to deeply equal
   *     [ { famille: 'assemblage', … } ]
   *   « 🗡️ l'Éclaireur » → expected [] to deeply equal
   *     [ { famille: 'piege', … } ]
   *
   * C'est bien LE DÉFAUT que ces tests attrapent — un ⚗️ arrivait au wizard
   * avec 0 recette sur 9 dues — et pas une enveloppe mal chiffrée. Noter
   * que la ligne 174 (`Alchimie` niveaux [1, 2]) reste VERTE sans le lot :
   * la compétence était bien donnée, c'est ce qu'elle ouvre qui manquait.
   */
  it("⚗️ l'Alchimiste part avec ses 5 mineures ET ses 4 intermédiaires", () => {
    const c = alchimiste();
    // La compétence est bien montée au palier 2 (le déclencheur est LE
    // NIVEAU ATTEINT, pas le rôle) — sans quoi le test serait vert à vide.
    expect(c.achats.filter((a) => a.nom === "Alchimie").map((a) => a.niveau))
      .toEqual([1, 2]);

    expect(c.artisanat).toHaveLength(2);
    const plan1 = c.artisanat.find((p) => p.palier === 1);
    expect(plan1).toBeDefined();
    expect(plan1).toMatchObject({
      famille: "recette",
      palier: 1,
      nb: 5,
      coutUnitaire: 0,
    });
    expect(c.artisanat.find((p) => p.palier === 2)).toMatchObject({
      famille: "recette",
      palier: 2,
      nb: 4,
      coutUnitaire: 0,
    });
    // Coût 0 : le serveur donne le gratuit sous quota, le client n'envoie
    // aucun prix — le budget de la fiche ne doit pas bouger d'un XP.
    expect(c.totalDepense + c.reliquat).toBe(80);
  });

  it("🔮 le Runiste part avec ses 2 assemblages", () => {
    const c = ok(
      composerClasse(catsMage, CONTENU_MAGE, {
        roleId: "mRuniste",
        inventaire: RICHE,
        budget: 80,
        element: "Feu",
      })
    );
    expect(c.achats.map((a) => a.nom)).toContain("Assemblage de Runes");
    expect(c.artisanat).toEqual([
      {
        famille: "assemblage",
        palier: 1,
        nb: 2,
        coutUnitaire: 0,
        motif: "2 assemblages offerts par Assemblage de Runes 1",
      },
    ]);
  });

  it("🗡️ l'Éclaireur part avec ses 3 pièges de niveau 1", () => {
    const c = ok(
      composerClasse(catsVoleur, CONTENU_VOLEUR, {
        roleId: "vEclaireur",
        inventaire: RICHE_ECLAIREUR,
        budget: 80,
      })
    );
    expect(c.achats.map((a) => a.nom)).toContain(
      "Création et désarmement de piège"
    );
    expect(c.artisanat).toEqual([
      {
        famille: "piege",
        palier: 1,
        nb: 3,
        coutUnitaire: 0,
        motif: "3 pièges offerts par Création et désarmement de piège 1",
      },
    ]);
  });

  it("sans compétence d'artisanat, AUCUNE enveloppe (le test d'absence a sa matière)", () => {
    const c = ok(
      composerClasse(catsVoleur, CONTENU_VOLEUR, {
        roleId: "vPremier",
        inventaire: RICHE,
        budget: 80,
      })
    );
    expect(c.achats.map((a) => a.nom)).not.toContain("Alchimie");
    expect(c.artisanat).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Le grain D-C — recettes payantes sur le reliquat                 */
/* ------------------------------------------------------------------ */

describe("artisanat — D-C : le reliquat s'absorbe en recettes payantes", () => {
  /** Les tailles RÉELLES du catalogue committé (cf. l'attestation du pont). */
  const TAILLES = { recettesNiv1: 14, recettesNiv2: 16 };

  it("⚗️ le reliquat mesuré à 20 devient 6 recettes de plus + 2 XP", () => {
    // AVANT le lot, ce même cas était le pire du sweep s374 : 20 XP morts,
    // rendus au joueur avec l'alerte « Il reste 20 XP » (dette
    // [GENERATEUR-GRAIN-RECETTES], levée ici).
    expect(alchimiste().reliquat).toBe(20);

    const c = alchimiste({ ...catsMage, artisanat: TAILLES });
    const payantes = c.artisanat.filter((p) => p.coutUnitaire > 0);
    expect(payantes).toHaveLength(1);
    expect(payantes[0]).toMatchObject({
      famille: "recette",
      palier: 2, // palier MAX débloqué : le tirage pioche dans 1..2
      nb: 6,
      coutUnitaire: 3,
    });
    expect(c.reliquat).toBe(2); // 20 − 6×3
    // ⚠️ Le point qui compte pour D34 : `totalDepense` LES COMPTE. Une
    // insertion faite APRÈS `ctx.budget - reste` laisserait 60 ici.
    expect(c.totalDepense).toBe(78);
    expect(c.totalDepense + c.reliquat).toBe(80);
    // Les gratuites ne bougent pas d'un poil : le grain vient EN PLUS.
    expect(c.artisanat.filter((p) => p.coutUnitaire === 0)).toHaveLength(2);
  });

  it("JUMEAU : `cats.artisanat` absent ⇒ 0 payante, gratuites intactes", () => {
    const c = alchimiste(); // pas de champ `artisanat` dans les catalogues
    expect(c.artisanat.filter((p) => p.coutUnitaire > 0)).toEqual([]);
    expect(c.artisanat.filter((p) => p.coutUnitaire === 0)).toHaveLength(2);
    expect(c.reliquat).toBe(20);
  });

  it("le grain est BORNÉ par le catalogue, pas seulement par le budget", () => {
    // Catalogue famélique : 6 recettes niv 1, 4 niv 2 ⇒ capacité
    // max(0, 6−5) + max(0, 4−4) = 1, alors que 20 XP en paieraient 6.
    const c = alchimiste({
      ...catsMage,
      artisanat: { recettesNiv1: 6, recettesNiv2: 4 },
    });
    const payantes = c.artisanat.filter((p) => p.coutUnitaire > 0);
    expect(payantes).toHaveLength(1);
    expect(payantes[0].nb).toBe(1);
    expect(c.reliquat).toBe(17);
  });

  it("JAMAIS de payante en runes ni en pièges (C66 : prix variables)", () => {
    const c = ok(
      composerClasse(
        { ...catsVoleur, artisanat: TAILLES },
        CONTENU_VOLEUR,
        { roleId: "vEclaireur", inventaire: RICHE_ECLAIREUR, budget: 80 }
      )
    );
    // Le piégeur a du reliquat ET un catalogue câblé : s'il sortait une
    // payante, elle serait forcément hors-recette — ce test l'interdit.
    expect(c.reliquat).toBeGreaterThan(0);
    expect(c.artisanat.filter((p) => p.coutUnitaire > 0)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 4. La conversion — les enveloppes deviennent des items              */
/* ------------------------------------------------------------------ */

/** Un tirage minimal cohérent avec le snapshot committé. */
const tirageMage = (): TiragePersonnage => {
  const race = snap.tables.races[0];
  return {
    raceId: race.id,
    raceNom: race.nom ?? "Race",
    classe: "mage",
    roleId: "mAlchimiste",
    budget: 80,
    inapteMagie: false,
    traitsIncompatibles: [],
  } as TiragePersonnage;
};

const recetteParId = new Map(
  (snap.tables.recettes_alchimie as { id: string; niveau_requis: number }[]).map(
    (r) => [r.id, r]
  )
);
const piegeParId = new Map(
  (snap.tables.pieges as { id: string; niveau: number }[]).map((p) => [p.id, p])
);

describe("artisanat — conversion : les items précis se tirent ici", () => {
  it("⚗️ 15 recettes (9 gratuites + 6 payantes), ids tous distincts", () => {
    const composition = alchimiste({
      ...catsMage,
      artisanat: { recettesNiv1: 14, recettesNiv2: 16 },
    });
    const b = convertirTirageEnBrouillon(
      snap,
      { tirage: tirageMage(), composition },
      lcg(4242)
    );
    // ⚠️ COMPTE MACHINE, re-mesuré : 15 et non 11. Le prompt du lot annonçait
    // « 11 (5+6) » en supposant l'Alchimie au palier 1 ; le ⚗️ mesuré monte
    // au palier 2 (`Alchimie` niveaux [1, 2] — asserté plus haut), donc
    // 5 mineures + 4 intermédiaires + 6 payantes = 15. Chiffre LU, pas déduit.
    expect(b.acquisitions.recettes).toHaveLength(15);
    const ids = b.acquisitions.recettes.map((r) => r.recetteId);
    expect(new Set(ids).size).toBe(15); // sans remise, y compris entre plans
    // Chaque id existe vraiment au catalogue, et chaque ligne a son instanceId.
    expect(ids.every((id) => recetteParId.has(id))).toBe(true);
    expect(new Set(b.acquisitions.recettes.map((r) => r.instanceId)).size).toBe(
      15
    );

    // Les 5 PREMIÈRES sont le plan « palier 1 » (l'ordre des plans est
    // contractuel : gratuites d'abord) — toutes `niveau_requis === 1`.
    const paliers = ids.map((id) => recetteParId.get(id)!.niveau_requis);
    expect(paliers.slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
    // Les 4 suivantes sont les intermédiaires : `niveau_requis === 2` exact
    // (le quota serveur est PAR PALIER — une mineure ici serait refusée).
    expect(paliers.slice(5, 9)).toEqual([2, 2, 2, 2]);
    // Les payantes piochent dans 1..2 — jamais au-delà du palier débloqué.
    expect(paliers.slice(9).every((n) => n === 1 || n === 2)).toBe(true);
  });

  it("🔮 2 assemblages distincts · 🗡️ 3 pièges de niveau 1 distincts", () => {
    const runiste = ok(
      composerClasse(catsMage, CONTENU_MAGE, {
        roleId: "mRuniste",
        inventaire: RICHE,
        budget: 80,
        element: "Feu",
      })
    );
    const bR = convertirTirageEnBrouillon(
      snap,
      {
        tirage: { ...tirageMage(), roleId: "mRuniste" },
        composition: runiste,
      },
      lcg(7)
    );
    expect(bR.acquisitions.assemblages).toHaveLength(2);
    expect(
      new Set(bR.acquisitions.assemblages.map((a) => a.assemblageId)).size
    ).toBe(2);
    expect(bR.acquisitions.recettes).toEqual([]);
    expect(bR.acquisitions.pieges).toEqual([]);

    const eclaireur = ok(
      composerClasse(catsVoleur, CONTENU_VOLEUR, {
        roleId: "vEclaireur",
        inventaire: RICHE_ECLAIREUR,
        budget: 80,
      })
    );
    const bV = convertirTirageEnBrouillon(
      snap,
      {
        tirage: {
          ...tirageMage(),
          classe: "voleur",
          roleId: "vEclaireur",
        } as TiragePersonnage,
        composition: eclaireur,
      },
      lcg(11)
    );
    const pieges = bV.acquisitions.pieges.map((p) => p.piegeId);
    expect(pieges).toHaveLength(3);
    expect(new Set(pieges).size).toBe(3);
    // Le palier compte : le catalogue porte 9 pièges par niveau (1, 2, 3) et
    // « Piège brise-doigts » existe AUX TROIS. Un filtre absent tirerait des
    // niveaux 2-3 que la gate refuserait.
    expect(pieges.map((id) => piegeParId.get(id)!.niveau)).toEqual([1, 1, 1]);
  });

  it("un snapshot SANS les tables d'artisanat rend un tirage vide, jamais une exception", () => {
    const ampute = {
      ...snap,
      tables: {
        ...snap.tables,
        recettes_alchimie: undefined,
        assemblages_runes: undefined,
        pieges: undefined,
      },
    } as SnapshotVisiteur;
    const composition = alchimiste({
      ...catsMage,
      artisanat: { recettesNiv1: 14, recettesNiv2: 16 },
    });
    const b = convertirTirageEnBrouillon(
      ampute,
      { tirage: tirageMage(), composition },
      lcg(1)
    );
    expect(b.acquisitions.recettes).toEqual([]);
    expect(b.acquisitions.assemblages).toEqual([]);
    expect(b.acquisitions.pieges).toEqual([]);
  });

  it("`tirerArtisanat` est DÉTERMINISTE à aléa fixé (rejeu, code de reprise)", () => {
    const plans = alchimiste({
      ...catsMage,
      artisanat: { recettesNiv1: 14, recettesNiv2: 16 },
    }).artisanat;
    const a = tirerArtisanat(snap, plans, new Set(), lcg(99));
    const b = tirerArtisanat(snap, plans, new Set(), lcg(99));
    expect(a.recettes.map((r) => r.recetteId)).toEqual(
      b.recettes.map((r) => r.recetteId)
    );
    // Aléa différent ⇒ tirage différent (sinon le « pondéré » serait mort).
    const c = tirerArtisanat(snap, plans, new Set(), lcg(12345));
    expect(c.recettes.map((r) => r.recetteId)).not.toEqual(
      a.recettes.map((r) => r.recetteId)
    );
  });
});

/* ------------------------------------------------------------------ */
/* 5. Le tirage sans remise pondéré, sur un pool jouet                 */
/* ------------------------------------------------------------------ */

describe("artisanat — `tirerSansRemisePondere` (pur, aléa injecté)", () => {
  const POOL = [
    { nom: "lourd", p: 100 },
    { nom: "moyen", p: 10 },
    { nom: "léger", p: 1 },
    { nom: "jamais", p: 0 },
  ];
  const poids = (it: { p: number }) => it.p;

  it("n items DISTINCTS, et un poids 0 n'est JAMAIS tiré", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const pris = tirerSansRemisePondere(POOL, poids, 3, lcg(seed));
      expect(pris).toHaveLength(3);
      expect(new Set(pris.map((x) => x.nom)).size).toBe(3);
      expect(pris.map((x) => x.nom)).not.toContain("jamais");
    }
  });

  it("un pool plus petit que `n` rend le pool entier, sans lever", () => {
    const pris = tirerSansRemisePondere(POOL.slice(0, 2), poids, 5, lcg(3));
    expect(pris).toHaveLength(2);
  });

  it("le poids PÈSE : la distribution suit les poids, elle ne les ignore pas", () => {
    // ⚠️ UN SEUL FLUX seedé, jamais 200 `lcg(seed)` : la première valeur d'un
    // LCG fraîchement seedé est fortement corrélée à la graine (mesuré : la
    // version re-seedée rendait 200/200 pour « lourd » — un test vert qui
    // n'aurait rien mesuré du tout).
    const alea = lcg(20250804);
    const compte: Record<string, number> = { lourd: 0, moyen: 0, léger: 0 };
    for (let i = 0; i < 1000; i++) {
      compte[tirerSansRemisePondere(POOL, poids, 1, alea)[0].nom] += 1;
    }
    // Comptes MACHINE, lus puis gravés (règle s361 : égalité exacte, jamais
    // un encadrement). Espérances pondérées sur 1000 : 100/111 ≈ 901 ·
    // 10/111 ≈ 90 · 1/111 ≈ 9. Espérance UNIFORME : 250 chacun — c'est ce
    // que ce test exclut.
    expect(compte).toEqual({ lourd: 894, moyen: 92, léger: 14 });
  });

  it("un pool ENTIÈREMENT à poids 0 rend [] au lieu de boucler", () => {
    expect(
      tirerSansRemisePondere([{ p: 0 }, { p: 0 }], poids, 2, lcg(5))
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 6. Comptes machine — le pont câble bien les tailles                 */
/* ------------------------------------------------------------------ */

describe("artisanat — attestation du pont (snapshot committé)", () => {
  it("les tailles LUES du snapshot : 14 recettes niv 1, 16 niv 2", () => {
    expect(taillesArtisanat(snap)).toEqual({
      recettesNiv1: 14,
      recettesNiv2: 16,
    });
    // Matière première citée (règle s359 : « un lot de données est arrivé »
    // doit rougir ici, pas passer inaperçu) : 40 recettes au total, dont 10
    // de palier 3 que le générateur ne touche pas (Alchimie 3 est hors
    // création). 15 assemblages, 27 pièges dont 9 de niveau 1.
    expect(snap.tables.recettes_alchimie).toHaveLength(40);
    expect(snap.tables.assemblages_runes).toHaveLength(15);
    expect(snap.tables.pieges).toHaveLength(27);
  });

  it("⭐ LE CÂBLAGE : `depsDepuisSnapshot` passe les tailles aux 4 classes", () => {
    // Sans cette attestation, `cats.artisanat` pourrait rester `undefined` en
    // prod et le grain D-C serait mort EN SILENCE (les tests du composeur, eux,
    // fournissent les tailles à la main : ils resteraient verts).
    const avecCarte: SnapshotVisiteur = {
      ...snap,
      tables: {
        ...snap.tables,
        objets_requis: (fxMonde as { objets_requis: unknown[] }).objets_requis,
      },
    };
    const deps = depsDepuisSnapshot(avecCarte);
    for (const classe of ["guerrier", "mage", "pretre", "voleur"] as const) {
      // L'Alchimie n'est pas réservée au mage : un guerrier qui la prend a
      // droit à ses recettes aussi.
      expect(deps.parClasse[classe].cats.artisanat, classe).toEqual({
        recettesNiv1: 14,
        recettesNiv2: 16,
      });
    }
  });

  it("un snapshot sans `recettes_alchimie` rend 0/0 — le pont ne REFUSE pas", () => {
    // Choix assumé : sans le compte, seul le GRAIN meurt (capacité 0) ; les
    // gratuites restent dues. Refuser fermerait le générateur entier.
    const ampute = {
      ...snap,
      tables: { ...snap.tables, recettes_alchimie: undefined },
    } as SnapshotVisiteur;
    expect(taillesArtisanat(ampute)).toEqual({
      recettesNiv1: 0,
      recettesNiv2: 0,
    });
  });
});

/* ------------------------------------------------------------------ */
/* 6 bis. Les reliquats gravés en s374 — RE-MESURÉS après le lot       */
/* ------------------------------------------------------------------ */

describe("artisanat — ce que le lot change (et ne change PAS) aux reliquats", () => {
  /**
   * ⚠️ RAPPORT DE MESURE, à lire avant de toucher aux comptes s374.
   *
   * Le prompt du lot annonçait que les comptes gravés en s374 (reliquat ⚗️ 20,
   * liste exacte des reliquats > 3) allaient ROUGIR. RE-MESURÉ : ils ne
   * rougissent pas, et c'est CORRECT — pas un oubli de câblage.
   *
   * Raison, lue dans le code : le grain D-C ne se déclenche que si
   * `cats.artisanat` est fourni (décision d'architecture du lot lui-même). Les
   * sweeps s374 montent leurs catalogues sur les FIXTURES, qui ne portent pas
   * ce champ — leur domaine est donc inchangé, à l'XP près. Le champ arrive
   * par le PONT, attesté juste au-dessus.
   *
   * Conséquence à connaître : depuis ce lot, le domaine mesuré par les sweeps
   * s374 n'est plus celui de la PROD. Les deux faces sont donc gravées ici,
   * côte à côte, plutôt que laissées implicites.
   */
  it("domaine FIXTURES (sweeps s374) : ⚗️ reste à 20 — inchangé", () => {
    expect(alchimiste().reliquat).toBe(20);
  });

  it("domaine PROD (tailles du pont) : ⚗️ tombe à 2", () => {
    expect(alchimiste({ ...catsMage, artisanat: taillesArtisanat(snap) })
      .reliquat).toBe(2);
  });

  it("aucun reliquat ne devient NÉGATIF, et le budget reste bouclé", () => {
    for (const budget of [60, 80]) {
      for (const roleId of CONTENU_MAGE.roles.map((r) => r.id)) {
        const c = composerClasse(
          { ...catsMage, artisanat: taillesArtisanat(snap) },
          CONTENU_MAGE,
          { roleId, inventaire: RICHE, budget, element: "Feu" }
        );
        if (!c.ok) continue;
        const desc = `${roleId}@${budget}`;
        expect(c.reliquat, desc).toBeGreaterThanOrEqual(0);
        expect(c.totalDepense + c.reliquat, desc).toBe(budget);
      }
    }
  });
});

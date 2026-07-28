/**
 * [VIS-8 lot R1b, s362] LE RÉSOLVEUR — gardes et jumeaux.
 *
 * Chaque garde « X n'apparaît jamais » a sa PREUVE PAR LE CONTRAIRE dans le
 * même bloc (règle s355) : la matière première CONTIENT X, le pool gardé ne
 * le contient plus — sans quoi un test d'absence est vert à vide.
 *
 * La promesse globale (« tout l'espace atteignable du 🎲 compose, reliquat
 * ≤ 3, jamais un interdit ») est DÉROULÉE sur tout son domaine (règle s346) :
 * énumération exhaustive par classes d'équivalence de race, compte EXACT
 * asserté, pire cas cité en clair dans le message d'échec.
 */
import { describe, expect, it } from "vitest";

import { CatalogueCompetences } from "./catalogue";
import {
  CatalogueMagie,
  type PriereModele,
  type SortModele,
} from "./catalogueMagie";
import { type Catalogues } from "./composer";
import { exigeDesPS, type ContenuClasse } from "./contenu/commun";
import { CONTENU_GUERRIER } from "./contenu/guerrier";
import { CONTENU_MAGE } from "./contenu/mage";
import { CONTENU_PRETRE } from "./contenu/pretre";
import { CONTENU_VOLEUR } from "./contenu/voleur";
import fxGuerrier from "./fixtures/competences_guerrier.fixture.json";
import fxMage from "./fixtures/competences_mage.fixture.json";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import fxMonde from "./fixtures/monde_resolveur.fixture.json";
import fxPretre from "./fixtures/competences_pretre.fixture.json";
import fxVoleur from "./fixtures/competences_voleur.fixture.json";
import {
  CERCLES_JAMAIS_TIRES,
  DOMAINES_JAMAIS_TIRES,
  ROLES_ELEMENT2,
  cerclesTirables,
  domaines2Candidats,
  domainesTirables,
  racesTirables,
  religionsCandidates,
  resoudreChoix,
  rolesTirables,
  tirerPersonnage,
  type ChoixJoueur,
  type DepsResolveur,
  type MondeResolveur,
} from "./resoudre";
import type { CompetenceCatalogue, ContexteComposition } from "./types";

/* ------------------------------------------------------------------ */
/* Montage — mêmes fixtures que la simulation du composeur.            */
/* ------------------------------------------------------------------ */

const magie = new CatalogueMagie(
  fxMagie as unknown as { sorts: SortModele[]; prieres: PriereModele[] }
);
const magieVide = new CatalogueMagie({ sorts: [], prieres: [] });
const catalogue = (fx: unknown): CatalogueCompetences =>
  new CatalogueCompetences(
    (fx as { competences: unknown[] }).competences as CompetenceCatalogue[]
  );

type ClasseId = ContexteComposition["classe"];
const parClasse: Record<
  ClasseId,
  { cats: Catalogues; contenu: ContenuClasse }
> = {
  guerrier: {
    cats: { competences: catalogue(fxGuerrier), magie: magieVide },
    contenu: CONTENU_GUERRIER,
  },
  pretre: {
    cats: { competences: catalogue(fxPretre), magie },
    contenu: CONTENU_PRETRE,
  },
  voleur: {
    cats: { competences: catalogue(fxVoleur), magie: magieVide },
    contenu: CONTENU_VOLEUR,
  },
  mage: {
    cats: { competences: catalogue(fxMage), magie },
    contenu: CONTENU_MAGE,
  },
};
const monde = fxMonde as unknown as MondeResolveur;
const deps: DepsResolveur = { parClasse, monde };

const VIDE: ReadonlySet<string> = new Set();
/** Inventaire « riche » : toutes les cases vues par la simulation du
 *  composeur + les clés costume de la carte races (fixture s362). */
const RICHE: ReadonlySet<string> = new Set([
  "contondante_moyenne", "ecu", "armure_cuir", "bandages", "pavois",
  "armure_plaques", "lame_longue", "lame_courte", "deux_armes_identiques",
  "targe", "fioles", "armure_maille", "bourse", "feuille_crayon",
  "contondante_longue", "contondante_courte", "arme_distance",
  "baton_sceptre_baguette", "oreilles_pointues", "masque", "maquillage_vert",
  "maquillage_fonce", "costume_animal", "costume_creature", "barbe",
]);

const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

const raceParNom = (nom: string) => {
  const r = monde.races.find((x) => x.nom === nom);
  if (!r) throw new Error(`race introuvable : ${nom}`);
  return r;
};
const religionParNom = (nom: string) => {
  const r = monde.religions.find((x) => x.nom.includes(nom));
  if (!r) throw new Error(`religion introuvable : ${nom}`);
  return r;
};
const idsRoles = (
  classe: ClasseId,
  inv: ReadonlySet<string>,
  inapte: boolean
) =>
  rolesTirables(parClasse[classe].contenu, parClasse[classe].cats, inv, inapte).map(
    (r) => r.id
  );

/* ------------------------------------------------------------------ */
/* 1. Arrivée du lot de données (règle s359 : un test qui rougit si la */
/*    fixture ne voyage pas, comptes recomputés — jamais recopiés).    */
/* ------------------------------------------------------------------ */

describe("fixture monde_resolveur — arrivée et ventilation", () => {
  it("comptes exacts de la capture MCP s362", () => {
    expect(monde.races).toHaveLength(11);
    expect(monde.races.filter((r) => r.est_jouable)).toHaveLength(8);
    expect(monde.race_traits).toHaveLength(50);
    expect(monde.traits_raciaux).toHaveLength(20);
    expect(monde.religions).toHaveLength(15);
    expect(monde.objets_requis).toHaveLength(7);
    expect(raceParNom("Humain").xp_depart).toBe(80);
    expect(raceParNom("Gobelin").xp_depart).toBe(60);
  });

  it("ventilation religions RECOMPUTÉE = les effectifs mesurés (§5.2)", () => {
    const vent = (dom: string) => ({
      principal: monde.religions.filter((r) =>
        r.domaines_principaux.includes(dom)
      ).length,
      proscrit: monde.religions.filter((r) =>
        r.domaines_proscrits.includes(dom)
      ).length,
    });
    expect(vent("Guerre")).toEqual({ principal: 8, proscrit: 4 });
    expect(vent("Bénédiction")).toEqual({ principal: 8, proscrit: 1 });
    expect(vent("Nécromancie")).toEqual({ principal: 3, proscrit: 6 });
    // Chaque religion : exactement 3 principaux, 2 proscrits, disjoints.
    for (const r of monde.religions) {
      expect(r.domaines_principaux, r.nom).toHaveLength(3);
      expect(r.domaines_proscrits, r.nom).toHaveLength(2);
      expect(
        r.domaines_principaux.filter((d) => r.domaines_proscrits.includes(d)),
        r.nom
      ).toHaveLength(0);
    }
  });

  it("le pool du Demi-Orc contient « Inapte à la magie » (1 sur 6) — celui de l'Humain non", () => {
    const inapte = monde.traits_raciaux.find(
      (t) => t.nom === "Inapte à la magie"
    );
    expect(inapte).toBeDefined();
    const pool = (nom: string) =>
      monde.race_traits.filter((rt) => rt.race_id === raceParNom(nom).id);
    expect(pool("Demi-Orc")).toHaveLength(6);
    expect(
      pool("Demi-Orc").some((rt) => rt.trait_id === inapte?.id)
    ).toBe(true);
    expect(
      pool("Humain").some((rt) => rt.trait_id === inapte?.id)
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Pools et gardes — chaque absence avec sa preuve par le contraire.*/
/* ------------------------------------------------------------------ */

describe("pools — gardes G1/G2 (interdits jamais tirés) et leurs jumeaux", () => {
  it("G1 : le catalogue CONTIENT Nécromancie et Magie Noire (13) ; le pool tiré ne les contient plus (11)", () => {
    const tous = magie.cercles();
    expect(tous).toHaveLength(13);
    for (const interdit of CERCLES_JAMAIS_TIRES) {
      expect(tous, "jumeau : la matière première porte l'interdit").toContain(
        interdit
      );
    }
    const tirables = cerclesTirables(parClasse.mage.cats);
    expect(tirables).toHaveLength(11);
    for (const interdit of CERCLES_JAMAIS_TIRES) {
      expect(tirables).not.toContain(interdit);
    }
    expect(tirables).toEqual([
      "Air", "Altération", "Charmes", "Combat", "Divination", "Eau", "Feu",
      "Illusion", "Magie Pure", "Protection", "Terre",
    ]);
  });

  it("G2 : les domaines CONTIENNENT Nécromancie (8) ; le pool tiré non (7) — et Magie Noire n'est PAS un domaine (une seule exclusion, s361)", () => {
    const tous = magie.domaines();
    expect(tous).toHaveLength(8);
    expect(tous, "jumeau").toContain("Nécromancie");
    expect(tous, "les 8 domaines n'incluent pas Magie Noire").not.toContain(
      "Magie Noire"
    );
    const tirables = domainesTirables(parClasse.pretre.cats);
    expect(tirables).toHaveLength(7);
    expect(tirables).not.toContain("Nécromancie");
  });
});

describe("pools — races et rôles (G7/G8) et leurs jumeaux", () => {
  it("à inventaire vide, seule race tirable : l'Humain (80 XP) — jumeau : des oreilles pointues ouvrent le Demi-Elfe", () => {
    expect(racesTirables(monde, VIDE).map((r) => r.nom)).toEqual(["Humain"]);
    const avecOreilles = racesTirables(
      monde,
      new Set(["oreilles_pointues"])
    ).map((r) => r.nom);
    expect(avecOreilles).toContain("Demi-Elfe");
    expect(avecOreilles).toContain("Humain");
    // Et l'inventaire riche ouvre les 8 jouables — jamais les non-jouables.
    const riches = racesTirables(monde, RICHE).map((r) => r.nom);
    expect(riches).toHaveLength(8);
    for (const nj of ["Fée", "Haut-Elfe", "Orc"]) {
      expect(riches).not.toContain(nj);
    }
  });

  it("G8 : rôles tirables à ∅ = 8 sur 15 (mesuré s362) — jumeau : l'inventaire riche ouvre les 15", () => {
    expect(idsRoles("guerrier", VIDE, false)).toEqual(["gForgeron"]);
    expect(idsRoles("voleur", VIDE, false)).toEqual(["vPremier"]);
    expect(idsRoles("mage", VIDE, false)).toEqual(["mGuilde", "mCanalisateur"]);
    expect(idsRoles("pretre", VIDE, false)).toEqual([
      "pRite", "pSoigne", "pMissionnaire", "pConsecrateur",
    ]);
    // Jumeau : avec l'équipement, tout s'ouvre.
    expect(idsRoles("guerrier", RICHE, false)).toEqual([
      "gForgeron", "gTient", "gFrappe",
    ]);
    expect(idsRoles("voleur", RICHE, false)).toEqual([
      "vOrfevre", "vPremier", "vEclaireur",
    ]);
    expect(idsRoles("mage", RICHE, false)).toEqual([
      "mAlchimiste", "mGuilde", "mCanalisateur", "mEnchanteur", "mRuniste",
    ]);
    expect(idsRoles("pretre", RICHE, false)).toEqual([
      "pRite", "pSoigne", "pMissionnaire", "pConsecrateur",
    ]);
  });

  it("G7 : un inapte perd les 4 rôles Prêtre et les 5 Mage sauf l'alchimiste (arbitrage s355) — jumeau : sans l'inaptitude, tout revient", () => {
    expect(idsRoles("pretre", RICHE, true)).toEqual([]);
    expect(idsRoles("mage", RICHE, true)).toEqual(["mAlchimiste"]);
    expect(idsRoles("guerrier", RICHE, true)).toEqual([
      "gForgeron", "gTient", "gFrappe",
    ]);
    // Jumeau : inapte=false → les pools complets (test précédent).
    expect(idsRoles("pretre", RICHE, false)).toHaveLength(4);
    expect(idsRoles("mage", RICHE, false)).toHaveLength(5);
  });

  it("le trou de la garde s355 est fermé : priereAuChoix/sortAuChoix SONT des PS (jumeau du fix s362)", () => {
    // Avant le fix, ces deux lots passaient pour « sans PS » — c'est le
    // trou qui laissait un inapte devenir 📿 avec sa prière.
    expect(exigeDesPS([{ t: "priereAuChoix", rang: 1 }])).toBe(true);
    expect(exigeDesPS([{ t: "sortAuChoix", rang: 1 }])).toBe(true);
    expect(exigeDesPS([{ t: "comp", nom: "Forge", niveau: 1 }])).toBe(false);
  });
});

describe("religions — G3/G4 (principales d'abord, jamais une proscrite) et jumeaux", () => {
  it("G4 : candidates(Guerre) = les 8 principales exactes — jumeau : « non proscrivantes » en compterait 11", () => {
    const candidates = religionsCandidates(monde, "Guerre");
    expect(candidates).toHaveLength(8);
    for (const r of candidates) {
      expect(r.domaines_principaux, r.nom).toContain("Guerre");
      expect(r.domaines_proscrits, r.nom).not.toContain("Guerre");
    }
    // Jumeau : le critère « non proscrit » seul (v8) est plus lâche — la
    // priorité aux principales fait un vrai travail de filtrage.
    const nonProscrivantes = monde.religions.filter(
      (r) => !r.domaines_proscrits.includes("Guerre")
    );
    expect(nonProscrivantes).toHaveLength(11);
    expect(nonProscrivantes.length).toBeGreaterThan(candidates.length);
  });

  it("C3 : le second domaine de 🕊️/📿 n'est jamais en tension avec la foi — jumeau : sans le filtre religion, Nature resterait candidat de Guerre chez Sol-gon", () => {
    for (const impose of ["Guerre", "Bénédiction"]) {
      const candidats = domaines2Candidats(
        parClasse.pretre.cats,
        monde,
        impose
      );
      expect(candidats, impose).toHaveLength(6); // 7 tirables − l'imposé
      expect(candidats).not.toContain(impose);
      expect(candidats).not.toContain("Nécromancie");
      for (const d2 of candidats) {
        const rel = religionsCandidates(monde, impose, d2);
        expect(rel.length, `${impose}+${d2} : aucun cul-de-sac`).toBeGreaterThan(0);
        for (const r of rel) {
          expect(r.domaines_proscrits, `${r.nom} ⊥ ${d2}`).not.toContain(d2);
        }
      }
    }
    // Jumeau : SANS le second filtre, une religion proscrivant d2 passerait.
    const guerreSansFiltre = religionsCandidates(monde, "Guerre");
    const guerreAvecNature = religionsCandidates(monde, "Guerre", "Nature");
    expect(guerreAvecNature.length).toBeLessThan(guerreSansFiltre.length);
    expect(
      guerreSansFiltre.some((r) => r.domaines_proscrits.includes("Nature")),
      "la matière première contient bien une foi Guerre-principale qui proscrit Nature (Sorelf)"
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 3. 🧭 resoudreChoix — refus motivés, foi ≠ loi, inapte, budget.     */
/* ------------------------------------------------------------------ */

const choixBase = (extra: Partial<ChoixJoueur>): ChoixJoueur => ({
  classe: "pretre",
  roleId: "pMissionnaire",
  raceId: raceParNom("Humain").id,
  inventaire: VIDE,
  ...extra,
});

describe("🧭 resoudreChoix — refus avec phrase, jamais en silence (G5)", () => {
  it("G5 : 🕊️ + une foi qui proscrit la Guerre → refus nommé ; jumeau : une foi Guerre-principale → ok", () => {
    const solgon = religionParNom("Sol-gon");
    const refus = resoudreChoix(deps, choixBase({ religionId: solgon.id }));
    expect(refus.ok).toBe(false);
    if (!refus.ok) {
      expect(refus.raison).toContain("Guerre");
      expect(refus.raison).toContain(solgon.nom);
      expect(refus.raison).toContain("choisis une autre foi");
    }
    const asmeis = religionParNom("Asméis");
    const ok = resoudreChoix(deps, choixBase({ religionId: asmeis.id }));
    expect(ok.ok).toBe(true);
  });

  it("domaine libre proscrit par la foi posée → refus nommé ; jumeau : sans religion, tout domaine passe", () => {
    const asmeis = religionParNom("Asméis"); // proscrit Chaos + Nécromancie
    const refus = resoudreChoix(
      deps,
      choixBase({ roleId: "pRite", element: "Chaos", religionId: asmeis.id })
    );
    expect(refus.ok).toBe(false);
    if (!refus.ok) {
      expect(refus.raison).toContain("Chaos");
      expect(refus.raison).toContain(asmeis.nom);
    }
    const libre = resoudreChoix(
      deps,
      choixBase({ roleId: "pRite", element: "Chaos" })
    );
    expect(libre.ok).toBe(true);
  });

  it("foi ≠ loi (§5.2 ②, les DEUX branches) : la Nécromancie se CHOISIT — cercle de mage sans religion, domaine de prêtre légitime chez Shen-Gon — et se refuse chez qui la proscrit", () => {
    // Branche LOI : le cercle interdit par le monde reste choisissable en 🧭.
    const mage = resoudreChoix(
      deps,
      choixBase({
        classe: "mage",
        roleId: "mGuilde",
        element: "Nécromancie",
      })
    );
    expect(mage.ok).toBe(true);
    // Branche FOI : le domaine est légitime dans une foi qui le porte…
    const shenGon = religionParNom("Shen-Gon"); // Nécromancie PRINCIPALE
    const legitime = resoudreChoix(
      deps,
      choixBase({
        roleId: "pRite",
        element: "Nécromancie",
        religionId: shenGon.id,
      })
    );
    expect(legitime.ok).toBe(true);
    // …et refusé chez qui le proscrit.
    const asmeis = religionParNom("Asméis");
    const proscrit = resoudreChoix(
      deps,
      choixBase({
        roleId: "pRite",
        element: "Nécromancie",
        religionId: asmeis.id,
      })
    );
    expect(proscrit.ok).toBe(false);
  });

  it("inapte, quadrant complet : Demi-Orc refusé sur un rôle à PS (conduite 1), Humain ok, traitsChoisis prime dans les deux sens", () => {
    const demiOrc = raceParNom("Demi-Orc").id;
    const humain = raceParNom("Humain").id;
    // Conduite 1 (modèle) : tout Demi-Orc est traité inapte avant le fix DB.
    const refus = resoudreChoix(
      deps,
      choixBase({ roleId: "pSoigne", raceId: demiOrc, element: "Bénédiction" })
    );
    expect(refus.ok).toBe(false);
    if (!refus.ok) expect(refus.raison).toContain("inapte");
    const ok = resoudreChoix(
      deps,
      choixBase({ roleId: "pSoigne", raceId: humain, element: "Bénédiction" })
    );
    expect(ok.ok).toBe(true);
    // L'INSTANCE prime (monde post-fix) : un Demi-Orc sans le trait est mage…
    const sansTrait = resoudreChoix(
      deps,
      choixBase({
        roleId: "pSoigne",
        raceId: demiOrc,
        element: "Bénédiction",
        traitsChoisis: ["Fortuné"],
      })
    );
    expect(sansTrait.ok).toBe(true);
    // …et un Humain qui l'aurait (défensif) serait refusé.
    const avecTrait = resoudreChoix(
      deps,
      choixBase({
        roleId: "pSoigne",
        raceId: humain,
        element: "Bénédiction",
        traitsChoisis: ["Inapte à la magie"],
      })
    );
    expect(avecTrait.ok).toBe(false);
  });

  it("budget dérivé de la race : Humain 80, Gobelin 60 — et traitsIncompatibles reflète la FICHE", () => {
    const h = resoudreChoix(
      deps,
      choixBase({ classe: "guerrier", roleId: "gForgeron" })
    );
    expect(h.ok).toBe(true);
    if (h.ok) {
      expect(h.composition.budget).toBe(80);
      // Le filet ④ Guerrier a posé du Développement Spirituel → le trait
      // « Inapte » est incompatible avec CETTE fiche (conduite 3).
      expect(h.traitsIncompatibles).toEqual(["Inapte à la magie"]);
    }
    const g = resoudreChoix(
      deps,
      choixBase({
        classe: "guerrier",
        roleId: "gForgeron",
        raceId: raceParNom("Gobelin").id,
      })
    );
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.composition.budget).toBe(60);
    // Jumeau : une fiche SANS PS (inapte : le filet saute) → liste vide.
    const inapte = resoudreChoix(deps, {
      classe: "guerrier",
      roleId: "gTient",
      raceId: raceParNom("Demi-Orc").id,
      inventaire: RICHE,
      traitsChoisis: ["Inapte à la magie"],
    });
    expect(inapte.ok).toBe(true);
    if (inapte.ok) {
      expect(
        exigeDesPS(
          inapte.composition.achats.map((a) => ({
            t: "comp" as const,
            nom: a.nom,
            niveau: a.niveau,
          }))
        )
      ).toBe(false);
      expect(inapte.composition.achatsMagie).toHaveLength(0);
      expect(inapte.traitsIncompatibles).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 4. 🎲 tirerPersonnage — e2e seedé + G6.                             */
/* ------------------------------------------------------------------ */

describe("🎲 tirerPersonnage — sweep seedé", () => {
  const N = 400;
  it(`G1/G2/G3/G6 sur ${N} tirages : jamais un interdit, religion principale, element2 ⇒ ACHETÉ (option A s366), compose toujours`, () => {
    const cerclesVus = new Set<string>();
    const rolesAvecE2 = new Set<string>();
    let prêtresVus = 0;
    let rolesE2Vus = 0; // tirages d'un rôle ✨ᚱ🕊️📿 (candidat possible)
    let e2Poses = 0; // … dont element2 est SORTI (donc acheté)
    for (let i = 0; i < N; i++) {
      const t = tirerPersonnage(deps, lcg(i * 7919 + 17));
      expect(t.ok, `seed ${i}`).toBe(true);
      if (!t.ok) continue;
      const { tirage, composition } = t;
      expect(tirage.raceNom).toBe("Humain");
      expect(tirage.budget).toBe(80);
      expect(composition.reliquat).toBeGreaterThanOrEqual(0);
      expect(composition.reliquat).toBeLessThanOrEqual(3);
      if (tirage.classe === "mage" && tirage.element) {
        cerclesVus.add(tirage.element);
        expect(CERCLES_JAMAIS_TIRES).not.toContain(tirage.element);
      }
      if (tirage.classe === "pretre") {
        prêtresVus += 1;
        expect(tirage.element).toBeDefined();
        expect(DOMAINES_JAMAIS_TIRES).not.toContain(tirage.element);
        expect(tirage.religionNom, "religion EN SORTIE").toBeDefined();
        const rel = monde.religions.find((r) => r.id === tirage.religionId);
        expect(rel?.domaines_principaux, "principale (G4)").toContain(
          tirage.element
        );
        if (tirage.element2) {
          expect(rel?.domaines_proscrits, "C3").not.toContain(tirage.element2);
        }
      }
      if (ROLES_ELEMENT2.includes(tirage.roleId)) rolesE2Vus += 1;
      // G6, sens ① (option A s366) : element2 en SORTIE ⟹ rôle de la
      // politique, ≠ du premier, ET RÉELLEMENT ACHETÉ. C'est le test qui
      // ROUGIT sur la version d'avant (680 candidats sur 779 sortaient
      // sans achat — la fiche mentait).
      if (tirage.element2) {
        e2Poses += 1;
        expect(ROLES_ELEMENT2).toContain(tirage.roleId);
        rolesAvecE2.add(tirage.roleId);
        expect(tirage.element2).not.toBe(tirage.element);
        expect(
          composition.achats.some(
            (a) =>
              (a.nom === "Acquisition de Cercle" ||
                a.nom === "Acquisition de Domaine") &&
              a.choix === tirage.element2
          ),
          `seed ${i} : element2 « ${tirage.element2} » affiché mais non acheté`
        ).toBe(true);
      }
    }
    // G6, sens ② (jumeau : le test peut échouer) : le SORTI existe — les
    // deux rôles atteignables à ∅ (🕊️ 📿) finissent par sortir avec un
    // second domaine ACHETÉ au fil du sweep.
    expect(rolesAvecE2).toContain("pMissionnaire");
    expect(rolesAvecE2).toContain("pConsecrateur");
    // G6, sens ③ (jumeau du filtre : sans lui, ce compte serait rolesE2Vus)
    // — le MANGÉ existe aussi : des rôles à candidat sortent SANS element2,
    // preuve que l'effectif filtre vraiment. Comptes MESURÉS (règle s362,
    // lus depuis l'échec du toBe(-1)) : 45 tirages 🕊️/📿 sur 400 à ∅ (seuls
    // rôles de la politique atteignables sans inventaire), dont 3 sortent
    // avec le second domaine ACHETÉ et 42 sans (le candidat était mangé).
    expect(rolesE2Vus).toBe(45);
    expect(e2Poses).toBe(3);
    expect(e2Poses).toBeLessThan(rolesE2Vus);
    expect(prêtresVus).toBeGreaterThan(20);
    // Le tirage BOUGE vraiment (pas un vert-à-vide) : ≥ 5 cercles distincts.
    expect(cerclesVus.size).toBeGreaterThanOrEqual(5);
  });

  it("un inventaire fourni élargit le tirage (jumeau de G8) : sur 300 tirages RICHE, d'autres races et ✨/ᚱ sortent", () => {
    const races = new Set<string>();
    const roles = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const t = tirerPersonnage(deps, lcg(i * 104729 + 3), RICHE);
      expect(t.ok, `seed ${i}`).toBe(true);
      if (!t.ok) continue;
      races.add(t.tirage.raceNom);
      roles.add(t.tirage.roleId);
      if (t.tirage.raceNom === "Demi-Orc") {
        // Conduite 1 : un Demi-Orc tiré est traité inapte → jamais caster.
        expect(["guerrier", "voleur", "mage"]).toContain(t.tirage.classe);
        expect(t.composition.achatsMagie).toHaveLength(0);
      }
    }
    expect(races.size).toBeGreaterThanOrEqual(4);
    expect([...roles].some((r) => r === "mEnchanteur" || r === "mRuniste")).toBe(
      true
    );
  });
});

/* ------------------------------------------------------------------ */
/* 5. SIMULATION — tout l'espace 🎲 atteignable, compte EXACT.         */
/* ------------------------------------------------------------------ */

describe("simulation résolveur — l'espace 🎲 exhaustif", () => {
  it("997 résolutions (180 à vide + 405×2 budgets + 7 inapte) : ok partout, reliquat ≤ 3, religion jamais en tension — pire cas cité", () => {
    // Classes d'équivalence de race (mesure la plus étroite qui tranche) :
    // seules budget et inaptitude entrent dans la composition. Preuve :
    for (const r of monde.races.filter((x) => x.est_jouable)) {
      if (r.nom === "Humain") expect(r.xp_depart).toBe(80);
      else expect(r.xp_depart, r.nom).toBe(60);
    }
    const equivalences = [
      { desc: "Humain(80)", race: raceParNom("Humain"), inapte: false },
      { desc: "autres(60)", race: raceParNom("Gobelin"), inapte: false },
      { desc: "Demi-Orc(60,inapte)", race: raceParNom("Demi-Orc"), inapte: true },
    ];
    let nb = 0;
    const pire = { reliquat: -1, desc: "" };
    const verifier = (choix: ChoixJoueur, desc: string) => {
      const res = resoudreChoix(deps, choix);
      expect(res.ok, desc).toBe(true);
      if (!res.ok) return;
      nb += 1;
      expect(res.composition.reliquat, desc).toBeGreaterThanOrEqual(0);
      expect(res.composition.reliquat, desc).toBeLessThanOrEqual(3);
      if (res.composition.reliquat > pire.reliquat) {
        pire.reliquat = res.composition.reliquat;
        pire.desc = desc;
      }
    };
    for (const inv of [VIDE, RICHE]) {
      const invDesc = inv === VIDE ? "∅" : "RICHE";
      for (const eq of equivalences) {
        // À ∅ seule la classe (80, non-inapte) est ATTEIGNABLE (race=Humain) :
        // on ne simule que l'espace que le tirage peut réellement produire.
        if (inv === VIDE && eq.race.nom !== "Humain") continue;
        for (const classe of ["guerrier", "mage", "pretre", "voleur"] as const) {
          const { cats, contenu } = parClasse[classe];
          for (const role of rolesTirables(contenu, cats, inv, eq.inapte)) {
            const base = {
              classe,
              roleId: role.id,
              raceId: eq.race.id,
              inventaire: inv,
              traitsChoisis: eq.inapte
                ? (["Inapte à la magie"] as const)
                : ([] as const),
            };
            const desc0 = `${invDesc}/${eq.desc}/${classe}/${role.id}`;
            const besoinMagie = classe === "mage" || classe === "pretre";
            if (!besoinMagie || role.id === "mAlchimiste") {
              verifier({ ...base, roleId: role.id }, desc0);
              continue;
            }
            const impose = role.magieImposee;
            const elements = impose
              ? [impose]
              : classe === "pretre"
                ? domainesTirables(cats)
                : cerclesTirables(cats);
            for (const element of elements) {
              if (classe === "mage") {
                if (ROLES_ELEMENT2.includes(role.id)) {
                  for (const e2 of cerclesTirables(cats).filter(
                    (c) => c !== element
                  )) {
                    verifier(
                      { ...base, element, element2: e2 },
                      `${desc0}(${element}+${e2})`
                    );
                  }
                } else {
                  verifier({ ...base, element }, `${desc0}(${element})`);
                }
                continue;
              }
              // Prêtre : chaque religion candidate est une feuille.
              if (ROLES_ELEMENT2.includes(role.id)) {
                for (const e2 of domaines2Candidats(cats, monde, element)) {
                  for (const rel of religionsCandidates(monde, element, e2)) {
                    verifier(
                      {
                        ...base,
                        element,
                        element2: e2,
                        religionId: rel.id,
                      },
                      `${desc0}(${element}+${e2}, ${rel.nom})`
                    );
                  }
                }
              } else {
                for (const rel of religionsCandidates(monde, element)) {
                  verifier(
                    { ...base, element, religionId: rel.id },
                    `${desc0}(${element}, ${rel.nom})`
                  );
                }
              }
            }
          }
        }
      }
    }
    // Le COMPTE est une égalité exacte, jamais un encadrement (règle s361) —
    // le pire cas est CITÉ, pas promis.
    expect(nb, `pire cas : ${pire.desc} → reliquat ${pire.reliquat}`).toBe(997);
    expect(pire.reliquat).toBeLessThanOrEqual(3);
  });
});

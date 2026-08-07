/**
 * [VIS-8 lot 🧭 PR-β2, s367] Logique de l'ESCALIER — mesurée sur les VRAIES
 * fixtures du résolveur (mêmes montages que generateur.proposables.test.ts).
 *
 * Chaque garde a sa preuve par le contraire (règle s355) ; les comptes sont
 * MESURÉS puis gravés avec leur décomposition (règle s362).
 */
import { describe, expect, it } from "vitest";

import { CatalogueCompetences } from "@/moteurCreation/generateur/catalogue";
import {
  CatalogueMagie,
  type PriereModele,
  type SortModele,
} from "@/moteurCreation/generateur/catalogueMagie";
import type { Catalogues } from "@/moteurCreation/generateur/composer";
import { type ContenuClasse } from "@/moteurCreation/generateur/contenu/commun";
import { CONTENU_GUERRIER } from "@/moteurCreation/generateur/contenu/guerrier";
import { CONTENU_MAGE } from "@/moteurCreation/generateur/contenu/mage";
import { CONTENU_PRETRE } from "@/moteurCreation/generateur/contenu/pretre";
import { CONTENU_VOLEUR } from "@/moteurCreation/generateur/contenu/voleur";
import fxGuerrier from "@/moteurCreation/generateur/fixtures/competences_guerrier.fixture.json";
import fxMage from "@/moteurCreation/generateur/fixtures/competences_mage.fixture.json";
import fxMagie from "@/moteurCreation/generateur/fixtures/magie_generateur.fixture.json";
import fxMonde from "@/moteurCreation/generateur/fixtures/monde_resolveur.fixture.json";
import fxPretre from "@/moteurCreation/generateur/fixtures/competences_pretre.fixture.json";
import fxVoleur from "@/moteurCreation/generateur/fixtures/competences_voleur.fixture.json";
import {
  religionsProposables,
  resoudreChoix,
  type DepsResolveur,
  type MondeResolveur,
} from "@/moteurCreation/generateur/resoudre";
import type {
  CompetenceCatalogue,
  ContexteComposition,
} from "@/moteurCreation/generateur/types";

import {
  EMOJIS_CLASSES,
  MOTIF_INAPTE_GRISE,
  PARCOURS_VIDE,
  avertissementElement,
  construireChoix,
  contexteUsageTraits,
  pretPourFiche,
  resumeFois,
  roleAttendElement,
  roleElementOptionnel,
  roleEstCaster,
  texteUsageTrait,
  traitsRaciauxAffiches,
  type ParcoursBoussole,
} from "./boussole.logic";
import { LABELS_CLASSES } from "./ficheTirage.logic";

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
const RICHE: ReadonlySet<string> = new Set([
  "contondante_moyenne", "ecu", "armure_cuir", "bandages", "pavois",
  "armure_plaques", "lame_longue", "lame_courte", "deux_armes_identiques",
  "targe", "fioles", "armure_maille", "bourse", "feuille_crayon",
  "contondante_longue", "contondante_courte", "arme_distance",
  "baton_sceptre_baguette", "oreilles_pointues", "masque", "maquillage_vert",
  "maquillage_fonce", "costume_animal", "costume_creature", "barbe",
]);
const CLASSES: ClasseId[] = ["guerrier", "voleur", "mage", "pretre"];
const raceParNom = (nom: string) => {
  const r = monde.races.find((x) => x.nom === nom);
  if (!r) throw new Error(`race introuvable : ${nom}`);
  return r;
};

/* ------------------------------------------------------------------ */

describe("🧭 escalier — quels rôles attendent un élément", () => {
  it("comptes MESURÉS par classe (attend un choix / caster)", () => {
    const table: Record<string, [number, number, number]> = {};
    for (const c of CLASSES) {
      const { cats, contenu } = parClasse[c];
      const attend = contenu.roles.filter((r) =>
        roleAttendElement(contenu, cats, r, RICHE)
      ).length;
      const casters = contenu.roles.filter((r) =>
        roleEstCaster(contenu, cats, r, RICHE)
      ).length;
      table[c] = [contenu.roles.length, attend, casters];
    }
    // MESURÉ [nb rôles, attendent un choix, casters] :
    // guerrier/voleur : jamais · mage : 4/5 choisissent leur cercle,
    // ⚗️ l'alchimiste vit sans magie · prêtre : ⛪ EXIGE son domaine,
    // ✝️ l'a OPTIONNEL depuis D40 (s372), 🕊️ 📿 l'ont imposé — les 4
    // restent casters (l'étape s'affiche pour tous).
    expect(table).toEqual({
      guerrier: [3, 0, 0],
      voleur: [3, 0, 0],
      mage: [5, 4, 4],
      pretre: [4, 1, 4],
    });
  });

  it("D40 s372 : ✝️ est LE SEUL rôle à élément optionnel — dérivé, jamais une liste", () => {
    const optionnels: string[] = [];
    for (const c of CLASSES) {
      const { cats, contenu } = parClasse[c];
      for (const r of contenu.roles) {
        if (roleElementOptionnel(contenu, cats, r, RICHE)) {
          optionnels.push(r.id);
        }
      }
    }
    expect(optionnels).toEqual(["pSoigne"]);
  });

  it("un rôle à magie imposée n'attend JAMAIS un choix — mais reste caster", () => {
    const { cats, contenu } = parClasse.pretre;
    const imposes = contenu.roles.filter((r) => r.magieImposee);
    expect(imposes.length).toBe(2);
    for (const r of imposes) {
      expect(roleAttendElement(contenu, cats, r, RICHE)).toBe(false);
      expect(roleEstCaster(contenu, cats, r, RICHE)).toBe(true);
    }
  });
});

describe("🧭 escalier — avertissements du catalogue complet", () => {
  it("cercles : les 2 jamais-tirés portent la LOI, les 11 autres rien", () => {
    const cercles = parClasse.mage.cats.magie.cercles();
    const avertis = cercles.filter(
      (c) => avertissementElement("cercle", c, monde) !== null
    );
    expect(avertis.sort()).toEqual(["Magie Noire", "Nécromancie"]);
    expect(avertissementElement("cercle", "Nécromancie", monde)).toContain(
      "Hors-la-loi"
    );
    // Le motif CERCLE ne parle jamais de religion (§5.1 ② ≠ §5.2 ②).
    expect(avertissementElement("cercle", "Nécromancie", monde)).not.toContain(
      "religion"
    );
  });

  it("domaines : Nécromancie seule, avec des comptes DÉRIVÉS du monde", () => {
    const domaines = parClasse.pretre.cats.magie.domaines();
    const avertis = domaines.filter(
      (d) => avertissementElement("domaine", d, monde) !== null
    );
    expect(avertis).toEqual(["Nécromancie"]);
    const texte = avertissementElement("domaine", "Nécromancie", monde)!;
    // Dérivés, pas rédigés : 6 proscrivent / 9 honorent (15 actives).
    expect(texte).toContain("6 religions la proscrivent");
    expect(texte).toContain("9 l'honorent");
    // PREUVE PAR LE CONTRAIRE : un monde où une religion de plus la
    // proscrit change le texte — le compte vient bien du monde injecté.
    const mondePlus: MondeResolveur = {
      ...monde,
      religions: monde.religions.map((r, i) =>
        i === monde.religions.findIndex(
          (x) => x.est_actif && !x.domaines_proscrits.includes("Nécromancie")
        )
          ? { ...r, domaines_proscrits: [...r.domaines_proscrits, "Nécromancie"] }
          : r
      ),
    };
    expect(avertissementElement("domaine", "Nécromancie", mondePlus)).toContain(
      "7 religions la proscrivent"
    );
  });
});

describe("🧭 escalier — l'intro de l'étape Foi", () => {
  it("les trois comptes, dérivés de religionsProposables (Guerre : 8·3·4)", () => {
    const fois = religionsProposables(monde, "Guerre");
    expect(resumeFois(fois, "Guerre")).toBe(
      "8 fois portent Guerre en prédilection · 3 le tolèrent · 4 le proscrivent (grisées)."
    );
  });

  it("[s368 #5] deux domaines : chaque compte porte SA cause (9 = 3 + 5 + 1)", () => {
    const fois = religionsProposables(monde, "Guerre", "Nécromancie");
    expect(resumeFois(fois, "Guerre", "Nécromancie")).toBe(
      "4 fois portent Guerre en prédilection · 2 le tolèrent · 9 grisées — 3 proscrivent Guerre · 5 Nécromancie · 1 les deux."
    );
    // PREUVE PAR LE CONTRAIRE : l'ancienne phrase imputait les 9 à Guerre
    // (« 9 le proscrivent ») alors que 5 venaient du second domaine.
    expect(resumeFois(fois, "Guerre", "Nécromancie")).not.toContain(
      "le proscrivent"
    );
  });
});

describe("🧭 escalier — le bouton « Voir ma fiche »", () => {
  const parcours = (x: Partial<ParcoursBoussole>): ParcoursBoussole => ({
    ...PARCOURS_VIDE,
    ...x,
  });
  // [D53] Humain — pool de 2 traits toujours non-vide, `heritageEffectif`
  // retombe donc TOUJOURS sur un suggéré : ces tests, antérieurs à D53,
  // portent sur les gardes classe/rôle/élément/foi, jamais sur l'héritage.
  const humainId = raceParNom("Humain").id;
  const pret = (p: ParcoursBoussole) =>
    pretPourFiche(
      p,
      p.classe ? parClasse[p.classe].contenu : null,
      p.classe ? parClasse[p.classe].cats : null,
      RICHE,
      monde,
      humainId
    );

  it("guerrier : classe + rôle suffisent (ni élément, ni foi)", () => {
    expect(pret(parcours({ classe: "guerrier" }))).toBe(false);
    expect(pret(parcours({ classe: "guerrier", roleId: "gForgeron" }))).toBe(true);
  });

  it("mage à choix libre : l'élément est ATTENDU — l'alchimiste non", () => {
    expect(pret(parcours({ classe: "mage", roleId: "mCanalisateur" }))).toBe(false);
    expect(
      pret(parcours({ classe: "mage", roleId: "mCanalisateur", element: "Feu" }))
    ).toBe(true);
    expect(pret(parcours({ classe: "mage", roleId: "mAlchimiste" }))).toBe(true);
  });

  it("second coché sans second choisi = pas prêt", () => {
    const base = parcours({
      classe: "mage",
      roleId: "mCanalisateur",
      element: "Feu",
      second: true,
    });
    expect(pret(base)).toBe(false);
    expect(pret({ ...base, element2: "Eau" })).toBe(true);
  });

  it("prêtre : la foi est OBLIGATOIRE (versBrouillon la refuse absente)", () => {
    const sansFoi = parcours({
      classe: "pretre",
      roleId: "pMissionnaire",
    });
    expect(pret(sansFoi)).toBe(false);
    const religion = monde.religions.find(
      (r) => r.est_actif && r.domaines_principaux.includes("Guerre")
    )!;
    expect(pret({ ...sansFoi, religionId: religion.id })).toBe(true);
  });
});

describe("🧭 escalier — construireChoix → resoudreChoix (bout en bout)", () => {
  it("⛪ + Guerre + foi de prédilection : le moteur compose (parcours démo s366)", () => {
    const religion = monde.religions.find(
      (r) => r.est_actif && r.domaines_principaux.includes("Guerre")
    )!;
    const choix = construireChoix(
      {
        ...PARCOURS_VIDE,
        classe: "pretre",
        roleId: "pRite",
        element: "Guerre",
        second: false,
        element2: null,
        religionId: religion.id,
      },
      raceParNom("Humain").id,
      RICHE,
      monde,
      true // pRite est caster (prêtre : les 4 rôles le sont, mesuré plus haut)
    );
    // ⭐ [D53, s381 — RENOMMÉ ET INVERSÉ, remplace l'arbitrage s367] AVANT ce
    // lot, `construireChoix` ne posait JAMAIS `traitsChoisis` (« le modèle
    // fait foi ») : un joueur 🧭 finalisait sans trait racial, et le serveur
    // refusait (« Vous devez choisir exactement 1 trait(s) gratuit(s) »). Le
    // barreau « Ton héritage » alimente désormais ce champ — même à défaut
    // (le suggéré, ici Fortuné, le trait le plus porté chez l'Humain).
    expect("traitsChoisis" in choix).toBe(true);
    expect(choix.traitsChoisis).toEqual(["Fortuné"]);
    const res = resoudreChoix(deps, choix);
    expect(res.ok, res.ok ? "" : res.raison).toBe(true);
    if (res.ok) {
      expect(res.tirage.element).toBe("Guerre");
      expect(res.tirage.religionId).toBe(religion.id);
      expect(res.composition.reliquat).toBeLessThanOrEqual(3);
    }
  });

  it("second décoché ⇒ element2 n'est JAMAIS envoyé, même si un reste posé", () => {
    const choix = construireChoix(
      {
        ...PARCOURS_VIDE,
        classe: "mage",
        roleId: "mCanalisateur",
        element: "Feu",
        second: false,
        element2: "Eau",
        religionId: null,
      },
      raceParNom("Humain").id,
      RICHE,
      monde,
      true // mCanalisateur est caster
    );
    expect(choix.element2).toBeUndefined();
  });

  it("la ceinture du moteur : une foi proscrite est refusée AVEC SA PHRASE", () => {
    // L'écran grise les proscrites (pas cliquables) ; si un choix proscrit
    // arrivait quand même au moteur, il est refusé — jamais composé.
    const proscrivante = monde.religions.find(
      (r) => r.est_actif && r.domaines_proscrits.includes("Guerre")
    )!;
    const res = resoudreChoix(deps, {
      classe: "pretre",
      roleId: "pRite",
      raceId: raceParNom("Humain").id,
      inventaire: RICHE,
      element: "Guerre",
      religionId: proscrivante.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.raison).toContain(proscrivante.nom);
      expect(res.raison).toContain("Guerre");
    }
  });
});

describe("🧭 escalier — éditorial", () => {
  it("chaque voie a son émoji ET son libellé (les 4, pas 3)", () => {
    for (const c of CLASSES) {
      expect(EMOJIS_CLASSES[c].length).toBeGreaterThan(0);
      expect(LABELS_CLASSES[c].length).toBeGreaterThan(0);
    }
  });
});

describe("🧭 escalier — attestion s381bis : usage des traits (corrections du texte)", () => {
  const demiOrcId = raceParNom("Demi-Orc").id;
  const humainId = raceParNom("Humain").id;

  describe("A — « Inapte à la magie » ne dit plus « aucun effet »", () => {
    it("positif : Demi-Orc guerrier affiche le nouveau texte doré", () => {
      const { cats, contenu } = parClasse.guerrier;
      const role = contenu.roles.find((r) => r.id === "gForgeron")!;
      const estCaster = roleEstCaster(contenu, cats, role, RICHE);
      expect(estCaster).toBe(false);

      const ctx = contexteUsageTraits([], estCaster);
      const result = texteUsageTrait("Inapte à la magie", ctx);

      expect(result.sert).toBe(true);
      expect(result.texte).toBe(
        "Tu n'auras jamais de points de spiritualité — en échange, +1 PV permanent."
      );
    });

    it("rougissement par le contraire : sur origin/main le texte anciennement affiché rougit", () => {
      // Cette assertion montre ce qu'il FALLAIT corriger. Sur main l'ancien texte
      // serait retourné, ce test rougirait.
      const { cats, contenu } = parClasse.guerrier;
      const role = contenu.roles.find((r) => r.id === "gForgeron")!;
      const estCaster = roleEstCaster(contenu, cats, role, RICHE);
      const ctx = contexteUsageTraits([], estCaster);
      const result = texteUsageTrait("Inapte à la magie", ctx);

      expect(result.texte).not.toBe("Saveur — aucun effet sur ce que tu joues.");
    });
  });

  describe("B — le repli reste le repli (renommé en TEXTE_SANS_LIEN)", () => {
    it("positif : Mythomane chez Demi-Orc guerrier rend le repli (sert: false)", () => {
      const { cats, contenu } = parClasse.guerrier;
      const role = contenu.roles.find((r) => r.id === "gForgeron")!;
      const estCaster = roleEstCaster(contenu, cats, role, RICHE);
      const ctx = contexteUsageTraits([], estCaster);

      const result = texteUsageTrait("Mythomane", ctx);
      expect(result.sert).toBe(false);
      expect(result.texte).toBe(
        "Aucun lien avec tes compétences — il joue pareil pour tous."
      );
    });

    it("négatif : aucune race jouable n'affiche l'ancienne phrase « Saveur — aucun effet »", () => {
      const racesJouables = monde.races.filter((r) => r.est_jouable);
      const anciennePhraseAuVieux = "Saveur — aucun effet sur ce que tu joues.";

      for (const race of racesJouables) {
        const traits = traitsRaciauxAffiches(monde, race, undefined, false);
        for (const trait of traits) {
          const ctx = contexteUsageTraits([], false);
          const result = texteUsageTrait(trait.nom, ctx);
          expect(result.texte).not.toBe(anciennePhraseAuVieux);
        }
      }
    });
  });

  describe("D — non-régression du grisage d'« Inapte à la magie »", () => {
    it("un Demi-Orc mage affiche le trait grisé avec son motif, sans ligne dorée", () => {
      const { cats, contenu } = parClasse.mage;
      const role = contenu.roles.find((r) => r.id === "mCanalisateur")!;
      const estCaster = roleEstCaster(contenu, cats, role, RICHE);
      expect(estCaster).toBe(true);

      const traits = traitsRaciauxAffiches(monde, raceParNom("Demi-Orc"), undefined, estCaster);
      const inapteAffiches = traits.find((t) => t.nom === "Inapte à la magie");

      expect(inapteAffiches).toBeDefined();
      expect(inapteAffiches!.grise).toBe(true);
      expect(inapteAffiches!.motif).toBe(MOTIF_INAPTE_GRISE);

      // Quand le trait est grisé, la ligne d'usage retourne null (pas affichée).
      const ctx = contexteUsageTraits([], estCaster);
      const result = texteUsageTrait("Inapte à la magie", ctx);
      expect(result.sert).toBe(false);
    });
  });
});

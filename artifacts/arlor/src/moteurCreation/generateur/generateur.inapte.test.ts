/**
 * [VIS-8 lot A2-socle] La garde « inapte à la magie » (référence v4 §2.2).
 *
 * Ce que ces tests protègent, en clair : un personnage qui ne peut pas
 * porter de points de spiritualité ne doit JAMAIS repartir du générateur
 * avec une compétence à PS — ni au noyau, ni glissée par le filet. Et il
 * doit se voir REFUSER proprement, avec une phrase, les rôles qui sont
 * bâtis sur la magie.
 *
 * ⚠️ Le moteur ne calcule pas l'inaptitude : il reçoit un booléen. C'est
 * volontaire — la base la déduit aujourd'hui de la RACE (Demi-Orc), et le
 * fix `[INAPTE-MAGIE-MODELE-INSTANCE]` la fera porter sur le TRAIT CHOISI.
 * Le jour où ça change, seul l'appelant bouge.
 */
import { describe, expect, it } from "vitest";

import { CONTENU_GUERRIER } from "./contenu/guerrier";
import { CONTENU_VOLEUR } from "./contenu/voleur";
import { CONTENU_MAGE } from "./contenu/mage";
import { CONTENU_PRETRE } from "./contenu/pretre";
import {
  archetypeDemandeDesPS,
  COMPETENCES_A_PS,
  estCompetenceAPS,
  FILET_GUERRIER,
  FILET_VOLEUR,
  FILET_CASTER,
  type ContenuClasse,
} from "./contenu/commun";

const TOUS: ContenuClasse[] = [
  CONTENU_GUERRIER,
  CONTENU_VOLEUR,
  CONTENU_MAGE,
  CONTENU_PRETRE,
];

describe("liste des compétences à PS", () => {
  it("couvre les cinq familles de la référence v4 §2.2", () => {
    for (const nom of [
      "Acquisition de Cercle",
      "Acquisition de Domaine",
      "Développement Spirituel",
      "Canalisation",
      "Assemblage de Runes",
    ]) {
      expect(estCompetenceAPS(nom)).toBe(true);
    }
    // La version Supérieure est nommée séparément : c'est une autre ligne
    // du catalogue, la base refuse bien les deux.
    expect(estCompetenceAPS("Développement Spirituel Supérieur")).toBe(true);
    expect(COMPETENCES_A_PS).toHaveLength(6);
  });

  it("ne mord pas sur une compétence martiale", () => {
    expect(estCompetenceAPS("Botte Secrète")).toBe(false);
    expect(estCompetenceAPS("Connaissances des Religions")).toBe(false);
  });
});

describe("archetypeDemandeDesPS — dérivé du noyau, jamais déclaré", () => {
  it("rend un verdict pour CHAQUE rôle des 4 classes (aucun trou)", () => {
    for (const contenu of TOUS) {
      for (const r of contenu.roles) {
        expect(typeof archetypeDemandeDesPS(contenu, r.id)).toBe("boolean");
      }
    }
  });

  it("est faux sur un id inconnu plutôt que de jeter", () => {
    expect(archetypeDemandeDesPS(CONTENU_GUERRIER, "nExistePas")).toBe(false);
  });

  it("aucun rôle martial ne demande de PS par son noyau", () => {
    // Les guerriers/voleurs ne touchent aux PS que par le FILET (couche ④),
    // qui est facultatif — jamais par ce qui définit le rôle.
    for (const contenu of [CONTENU_GUERRIER, CONTENU_VOLEUR]) {
      for (const r of contenu.roles) {
        expect(archetypeDemandeDesPS(contenu, r.id)).toBe(false);
      }
    }
  });
});

describe("les filets et la garde", () => {
  it("les filets MARTIAUX posent bien du Développement Spirituel", () => {
    // C'est précisément ce que la garde doit intercepter : la fuite ne
    // vient pas du noyau mais du filet.
    const noms = [...FILET_GUERRIER, ...FILET_VOLEUR]
      .filter((e) => e.type === "jauge")
      .map((e) => (e as { nom: string }).nom);
    expect(noms).toContain("Développement Spirituel");
  });

  it("le filet CASTER est entièrement fait de compétences à PS", () => {
    for (const e of FILET_CASTER) {
      expect(e.type).toBe("jauge");
      expect(estCompetenceAPS((e as { nom: string }).nom)).toBe(true);
    }
  });

  it("les plafonds du filet caster valent le plafond du JEU, pas un maximum observé", () => {
    // ps_depart Mage/Prêtre = 10 ; DS plafonne les PS à 20, DSS à 30.
    // 10 + 10 = 20, puis 10 de plus = 30. Un autre chiffre serait faux.
    const PS_DEPART_CASTER = 10;
    const jauges = FILET_CASTER.filter((e) => e.type === "jauge") as {
      nom: string;
      plafondRachats: number;
    }[];
    const ds = jauges.find((j) => j.nom === "Développement Spirituel")!;
    const dss = jauges.find(
      (j) => j.nom === "Développement Spirituel Supérieur"
    )!;
    expect(PS_DEPART_CASTER + ds.plafondRachats).toBe(20);
    expect(PS_DEPART_CASTER + ds.plafondRachats + dss.plafondRachats).toBe(30);
  });
});

/* ------------------------------------------------------------------ */
/* LE DRAPEAU EST-IL VRAIMENT CONSOMMÉ ? (anti-[TETEDELISTE-MORT])     */

import { CatalogueCompetences } from "./catalogue";
import { CatalogueMagie } from "./catalogueMagie";
import { composerClasse, type Catalogues } from "./composer";
import fxVoleur from "./fixtures/competences_voleur.fixture.json";
import type { CompetenceCatalogue } from "./types";

const cats: Catalogues = {
  competences: new CatalogueCompetences(
    (fxVoleur as { competences: unknown[] })
      .competences as CompetenceCatalogue[]
  ),
  magie: new CatalogueMagie({ sorts: [], prieres: [] }),
};

/** Cases réelles de `objets_generateur` lues dans `contenu/voleur.ts` —
 *  assez large pour qu'AUCUN des 3 rôles ne parte en refus d'équipement
 *  (sinon les tests ci-dessous passeraient sans rien composer). */
const INV_LARGE = new Set([
  "lame_courte",
  "lame_longue",
  "lame_moyenne",
  "arme_distance",
  "bandages",
  "bourse",
  "feuille_crayon",
  "fioles",
  "contondante_courte",
]);

/**
 * ⚠️ 120 XP n'est PAS un budget de jeu (la création donne 60 ou 80) : c'est
 * le budget SONDÉ auquel le filet Voleur descend jusqu'à `Développement
 * Spirituel`. À 80, il s'arrête à `Langue supplémentaire` et la garde
 * n'aurait rien à intercepter — le test passerait à vide.
 * Mesuré par sonde jetable en s355, pas estimé.
 */
const BUDGET_QUI_ATTEINT_LES_PS = 120;

describe("composerClasse honore inapteMagie (le drapeau est LU)", () => {
  const roles = CONTENU_VOLEUR.roles.map((r) => r.id);

  it.each(roles)(
    "%s : aucune compétence à PS sur la fiche d'un inapte",
    (roleId) => {
      const c = composerClasse(cats, CONTENU_VOLEUR, {
        classe: "voleur",
        roleId,
        inventaire: INV_LARGE,
        budget: BUDGET_QUI_ATTEINT_LES_PS,
        inapteMagie: true,
      });
      if (!c.ok) return; // refus légitime : rien à vérifier
      const fautifs = [...c.gratuites, ...c.achats].filter((a) =>
        estCompetenceAPS(a.nom)
      );
      expect(fautifs.map((f) => f.nom)).toEqual([]);
      expect(c.achatsMagie).toEqual([]);
    }
  );

  it("sans le drapeau, le filet pose bien du Développement Spirituel — la garde change donc quelque chose", () => {
    // Preuve par le CONTRAIRE : si ce test devenait faux, le test du dessus
    // ne prouverait plus rien (il passerait tout seul).
    const vus = new Set<string>();
    for (const roleId of roles) {
      const c = composerClasse(cats, CONTENU_VOLEUR, {
        classe: "voleur",
        roleId,
        inventaire: INV_LARGE,
        budget: BUDGET_QUI_ATTEINT_LES_PS,
      });
      if (c.ok) c.achats.forEach((a) => vus.add(a.nom));
    }
    expect([...vus].some((n) => estCompetenceAPS(n))).toBe(true);
  });

  it("l'XP de la jauge sautée ne disparaît pas : le reliquat reste borné", () => {
    for (const roleId of roles) {
      const c = composerClasse(cats, CONTENU_VOLEUR, {
        classe: "voleur",
        roleId,
        inventaire: INV_LARGE,
        budget: BUDGET_QUI_ATTEINT_LES_PS,
        inapteMagie: true,
      });
      if (!c.ok) continue;
      expect(c.reliquat).toBeGreaterThanOrEqual(0);
      expect(c.budget).toBe(c.totalDepense + c.reliquat);
    }
  });
});

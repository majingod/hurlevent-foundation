/**
 * ⭐ [D52, s380] LE TRAIT RACIAL DU 🎲 — « il repart avec une fiche
 * FINALISABLE ».
 *
 * Le défaut mesuré : un joueur qui utilise « Surprends-moi » obtenait race,
 * classe, compétences, sorts et artisanat — mais AUCUN trait racial. Il
 * nommait son personnage, cliquait « Finaliser », et le serveur refusait :
 * « Vous devez choisir exactement 1 trait(s) gratuit(s), pas 0 ». Un Chiméride
 * ne passait même pas l'étape 2 (`sous_type_chimeride_manquant`).
 *
 * Ce que ce fichier tient, dans l'ordre :
 *  1. INTÉGRITÉ des poids et de la matière première (une faute de frappe = un
 *     poids orphelin silencieux ; une colonne perdue = un filtre mort) ;
 *  2. les POOLS — sous-type, exclusion d'« Inapte à la magie », chacun avec sa
 *     preuve par le contraire ;
 *  3. LE TRAIT EST POSÉ (⭐ rougit sur `origin/main`) et le POIDS reproduit le
 *     terrain ;
 *  4. ⭐ LE DEMI-ORC MAGE — le test qui compte le plus, avec son JUMEAU
 *     obligatoire (sans lui il serait vert à vide : faute vécue s355) ;
 *  5. D42 INTACTE — le Demi-Orc martial ne bouge pas d'un octet ;
 *  6. LE CHIMÉRIDE EST FINALISABLE (⭐ rougit aussi) — sous-type posé, pools
 *     jamais croisés, part carnivore mesurée ;
 *  7. la CONVERSION et la GATE — le trait tiré passe le miroir serveur ;
 *  8. la FICHE ANNONCE — logique pure, avec le cas « rien à dire ».
 *
 * Les comptes chiffrés sont des comptes MACHINE, lus puis gravés (règle s361 :
 * égalité exacte, jamais un encadrement — sauf là où la spécification du lot
 * demande explicitement une fourchette de distribution).
 *
 * ⭐ PREUVE PAR LE CONTRAIRE EXÉCUTÉE (s380). Les deux lignes du bloc ⑧ de
 * `tirerPersonnage` remplacées par `undefined` (le monde d'`origin/main` :
 * ni sous-type, ni trait) — 7 des 18 tests de ce fichier ont rougi. Ce que la
 * machine a dit, verbatim :
 *
 *   « ⭐ un Humain tiré ressort avec EXACTEMENT 1 trait »
 *       AssertionError: seed 0: expected undefined to be defined
 *   « ⭐ 2000 tirages d'un Humain : Fortuné dans [81 %, 87 %] »
 *       AssertionError: expected { AUCUN: 2000 } to deeply equal
 *                       { 'Fortuné': 1694, …(1) }
 *   « ⭐ 2000 tirages complets : chaque Demi-Orc MAGIQUE porte un trait »
 *       AssertionError: seed 2: expected undefined to be defined
 *   « ⛔ un Demi-Orc guerrier ou voleur … « Inapte à la magie » »
 *       AssertionError: expected undefined to be 'Inapte à la magie'
 *   « ⭐ le tirage pose un sousTypeChimeride ∈ {carnivore, herbivore} »
 *       AssertionError: seed 0: expected [ 'carnivore', 'herbivore' ]
 *                       to include undefined
 *   « ⭐ 2000 tirages : jamais un trait de l'AUTRE sous-type »
 *       AssertionError: seed 0: expected undefined to be defined
 *   « ⭐ … la gate dit OK et GRATUIT »
 *       AssertionError: Humain seed 0: expected [] to have a length of 1
 *                       but got +0
 *
 * Le « { AUCUN: 2000 } » et le « [] to have a length of 1 » sont LE défaut du
 * lot, nommé par la machine : zéro trait posé sur 2000 tirages, et un
 * `traitsRaciauxChoisis` vide que `valider_etape_3` refusait.
 *
 * ⚠️ Les 11 tests restés VERTS sous neutralisation le sont à bon droit : ils
 * mesurent les POOLS et les POIDS (pure matière), pas le tirage. Ce sont eux
 * qui tiennent l'exclusion d'« Inapte » et le filtre de sous-type — un défaut
 * de tirage ne doit pas les faire rougir, sinon on ne saurait plus lequel des
 * deux étages a cassé.
 */
import { describe, expect, it } from "vitest";

import snapshotJson from "../../data/snapshotVisiteur.json";
import { peutAcheterTraitRacial } from "../gatesTraits";
import type { SnapshotVisiteur } from "../snapshot";
import { CatalogueCompetences } from "./catalogue";
import {
  CatalogueMagie,
  type PriereModele,
  type SortModele,
} from "./catalogueMagie";
import { type Catalogues } from "./composer";
import { type ContenuClasse } from "./contenu/commun";
import { CONTENU_GUERRIER } from "./contenu/guerrier";
import { CONTENU_MAGE } from "./contenu/mage";
import { CONTENU_PRETRE } from "./contenu/pretre";
import {
  POIDS_SOUS_TYPE_CHIMERIDE,
  POIDS_TRAITS,
  cleRaceTraits,
} from "./contenu/traits";
import { CONTENU_VOLEUR } from "./contenu/voleur";
import fxGuerrier from "./fixtures/competences_guerrier.fixture.json";
import fxMage from "./fixtures/competences_mage.fixture.json";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import fxMonde from "./fixtures/monde_resolveur.fixture.json";
import fxPretre from "./fixtures/competences_pretre.fixture.json";
import fxVoleur from "./fixtures/competences_voleur.fixture.json";
import {
  TRAIT_INAPTE,
  resoudreChoix,
  sousTypesTirables,
  tirerPersonnage,
  tirerTraitRacial,
  traitsRaciauxProposables,
  traitsTirables,
  type Alea,
  type DepsResolveur,
  type MondeResolveur,
} from "./resoudre";
import type { CompetenceCatalogue, ContexteComposition } from "./types";
import { convertirTirageEnBrouillon } from "./versBrouillon";
import {
  MOTIF_INAPTE_GRISE,
  PARCOURS_VIDE,
  construireChoix,
  traitsRaciauxAffiches,
  type ParcoursBoussole,
} from "@/components/createur/generateur/boussole.logic";

/* ------------------------------------------------------------------ */
/* Montage — mêmes fixtures que `generateur.resolveur.test.ts`.        */
/* ------------------------------------------------------------------ */

const snap = snapshotJson as unknown as SnapshotVisiteur;

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

/**
 * ⭐ DEUX SACS QUI FORCENT LA RACE — le 🎲 tire la race, on ne peut pas la lui
 * imposer ; mais l'INVENTAIRE pré-filtre le pool (patron #720), et deux cases
 * suffisent à réduire ce pool à ce qu'on veut mesurer :
 *  · `maquillage_vert` seul → { Humain, Demi-Orc } (le Gobelin exige
 *    oreilles_pointues EN PLUS, le Drow un maquillage foncé) ;
 *  · `costume_animal` seul → { Humain, Chiméride }.
 * L'inventaire ∅, lui, ne laisse que l'Humain (mesuré s362) — c'est ce qui
 * rend le test de poids ci-dessous exact sans truquer un seul tirage.
 */
const SAC_DEMI_ORC: ReadonlySet<string> = new Set(["maquillage_vert"]);
const SAC_CHIMERIDE: ReadonlySet<string> = new Set(["costume_animal"]);

/** LCG seedé — le même que les autres tests du générateur. */
const lcg = (seed: number): Alea => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
};

const raceParNom = (nom: string) => {
  const r = monde.races.find((x) => x.nom === nom);
  if (!r) throw new Error(`race introuvable : ${nom}`);
  return r;
};

/** Le pool BRUT de la race — la matière première, AVANT toute exclusion.
 *  C'est lui qui fournit les preuves par le contraire de tout ce fichier. */
const poolBrut = (nomRace: string, sousType?: string): string[] => {
  const parId = new Map(monde.traits_raciaux.map((t) => [t.id, t.nom]));
  const raceId = raceParNom(nomRace).id;
  return monde.race_traits
    .filter(
      (rt) =>
        rt.race_id === raceId &&
        (sousType === undefined || rt.sous_type == null || rt.sous_type === sousType)
    )
    .map((rt) => parId.get(rt.trait_id) ?? "?")
    .sort((a, b) => a.localeCompare(b, "fr"));
};

/* ------------------------------------------------------------------ */
/* 1. Intégrité — poids mesurés ET matière première                    */
/* ------------------------------------------------------------------ */

describe("traits — intégrité des poids mesurés (D52)", () => {
  const nomsAuSnapshot = new Set(
    (snap.tables.traits_raciaux as { nom: string }[]).map((t) => t.nom)
  );
  const racesAuSnapshot = new Set(
    (snap.tables.races as { nom: string | null }[]).flatMap((r) =>
      r.nom ? [r.nom] : []
    )
  );

  it("chaque CLÉ DE RACE de POIDS_TRAITS existe au snapshot (sous-type compris)", () => {
    const orphelines = Object.keys(POIDS_TRAITS).filter((cle) => {
      // « Chiméride carnivore » → race « Chiméride » + sous-type « carnivore ».
      for (const race of racesAuSnapshot) {
        if (cle === race) return false;
        if (cle.startsWith(`${race} `)) {
          const sousType = cle.slice(race.length + 1);
          return !sousTypesTirables(monde, raceParNom(race).id).includes(
            sousType
          );
        }
      }
      return true;
    });
    expect(orphelines, "clés de race orphelines dans POIDS_TRAITS").toEqual([]);
  });

  it("⭐ chaque CLÉ DE TRAIT existe au snapshot (nom verbatim) ET appartient au pool de sa race", () => {
    // Un poids orphelin ne CASSE rien : le trait pèserait `POIDS_DEFAUT` et le
    // tirage resterait vert — c'est exactement pourquoi il lui faut ce test.
    // Le nom fautif est CITÉ, pas seulement compté.
    const inconnus: string[] = [];
    const horsPool: string[] = [];
    for (const [cleRace, table] of Object.entries(POIDS_TRAITS)) {
      for (const nomTrait of Object.keys(table)) {
        if (!nomsAuSnapshot.has(nomTrait)) {
          inconnus.push(`${cleRace} → ${nomTrait}`);
          continue;
        }
        // Le pool de la clé : « Chiméride carnivore » se relit en (race, st).
        const [nomRace, sousType] = racesAuSnapshot.has(cleRace)
          ? [cleRace, undefined]
          : [
              cleRace.slice(0, cleRace.lastIndexOf(" ")),
              cleRace.slice(cleRace.lastIndexOf(" ") + 1),
            ];
        if (!poolBrut(nomRace, sousType).includes(nomTrait)) {
          horsPool.push(`${cleRace} → ${nomTrait}`);
        }
      }
    }
    expect(inconnus, "noms de traits absents du snapshot").toEqual([]);
    expect(horsPool, "poids mesurés hors du pool de leur race").toEqual([]);
  });

  it("les clés de POIDS_SOUS_TYPE_CHIMERIDE sont les sous-types RÉELS du Chiméride", () => {
    const reels = sousTypesTirables(monde, raceParNom("Chiméride").id);
    expect(reels).toEqual(["carnivore", "herbivore"]);
    expect(Object.keys(POIDS_SOUS_TYPE_CHIMERIDE).sort()).toEqual(reels);
    // Et aucune AUTRE race n'a de sous-type (le lot n'en gère qu'un).
    for (const r of monde.races) {
      if (r.nom === "Chiméride") continue;
      expect(sousTypesTirables(monde, r.id), r.nom).toEqual([]);
    }
  });

  it("`cleRaceTraits` : la clé est le nom de race, suffixé du sous-type", () => {
    expect(cleRaceTraits("Humain")).toBe("Humain");
    expect(cleRaceTraits("Humain", null)).toBe("Humain");
    expect(cleRaceTraits("Chiméride", "carnivore")).toBe("Chiméride carnivore");
  });

  /**
   * ⚠️ [C99, s380] LA COLONNE QUI MANQUAIT. `race_traits.sous_type` existe en
   * base ; la fixture `monde_resolveur` (capture MCP s362) ne la portait PAS,
   * et le type local de `MondeResolveur` ne la déclarait pas non plus — le
   * filtrage par sous-type était donc invisible À LA COMPILATION comme au test.
   * Ce test-ci est la sentinelle : si la colonne re-disparaît d'un côté ou de
   * l'autre, il rougit avant que le Chiméride ne reçoive un trait d'herbivore.
   */
  it("⭐ C99 : la fixture et le snapshot portent LE MÊME `race_traits`, sous_type COMPRIS", () => {
    const cle = (r: { race_id: string; trait_id: string; sous_type: string | null }) =>
      `${r.race_id}|${r.trait_id}|${r.sous_type ?? ""}`;
    const fixture = monde.race_traits.map(cle).sort();
    const snapshot = (
      snap.tables.race_traits as {
        race_id: string;
        trait_id: string;
        sous_type: string | null;
      }[]
    )
      .map(cle)
      .sort();
    expect(fixture).toHaveLength(50);
    expect(fixture).toEqual(snapshot);
    // Jumeau : la colonne PORTE vraiment de l'information (10 lignes
    // sous-typées) — sans quoi l'égalité ci-dessus serait vraie à vide.
    expect(
      monde.race_traits.filter((rt) => rt.sous_type != null)
    ).toHaveLength(10);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Les pools — chaque absence avec sa preuve par le contraire       */
/* ------------------------------------------------------------------ */

describe("traits — pools tirables (exclusion Inapte, filtre sous-type)", () => {
  const noms = (nomRace: string, sousType?: string) =>
    traitsTirables(monde, raceParNom(nomRace).id, sousType).map((t) => t.nom);

  it("l'Humain : les 2 traits de son pool, tels quels", () => {
    expect(noms("Humain")).toEqual(["Coup du destin", "Fortuné"]);
  });

  it("⛔ le Demi-Orc perd « Inapte à la magie » (6 → 5) — jumeau : son pool BRUT le porte", () => {
    // Preuve par le contraire : la matière première contient l'interdit.
    expect(poolBrut("Demi-Orc")).toContain(TRAIT_INAPTE);
    expect(poolBrut("Demi-Orc")).toHaveLength(6);
    // …le pool tiré ne le contient plus.
    expect(noms("Demi-Orc")).toEqual([
      "Charognard",
      "Coup du destin",
      "Fortuné",
      "Marchandage Musclé",
      "Mythomane",
    ]);
    expect(noms("Demi-Orc")).not.toContain(TRAIT_INAPTE);
    // Et c'est bien la SEULE race concernée : aucune autre ne perd de trait.
    // (Le Chiméride est écarté de cette boucle : son pool DÉPEND du sous-type,
    // c'est le test suivant qui le tient — ici on comparerait un pool brut
    // non filtré à un pool filtré, et on mesurerait le filtre, pas l'exclusion.)
    for (const r of monde.races) {
      if (sousTypesTirables(monde, r.id).length > 0) continue;
      const brut = poolBrut(r.nom);
      const tirable = traitsTirables(monde, r.id).map((t) => t.nom);
      expect(tirable.length, r.nom).toBe(
        brut.includes(TRAIT_INAPTE) ? brut.length - 1 : brut.length
      );
    }
  });

  it("⭐ C99 : le Chiméride ne croise JAMAIS ses sous-types — jumeau : sans filtre, l'union ferait 6", () => {
    expect(noms("Chiméride", "carnivore")).toEqual([
      "Affinité animale",
      "Charognard",
      "Coup du destin",
      "Flair affûté",
      "Fortuné",
    ]);
    expect(noms("Chiméride", "herbivore")).toEqual([
      "Affinité animale",
      "Coup du destin",
      "Flair affûté",
      "Fortuné",
      "Instinct de survie",
    ]);
    // L'exclusion croisée, nommée dans les deux sens.
    expect(noms("Chiméride", "carnivore")).not.toContain("Instinct de survie");
    expect(noms("Chiméride", "herbivore")).not.toContain("Charognard");
    // JUMEAU : la matière première porte les DEUX — sans le filtre `sous_type`
    // (le défaut C99), le pool serait leur UNION de 6 traits, et un carnivore
    // pourrait recevoir « Instinct de survie » que la gate refuserait.
    const union = new Set([
      ...poolBrut("Chiméride", "carnivore"),
      ...poolBrut("Chiméride", "herbivore"),
    ]);
    expect(union.size).toBe(6);
    expect(union).toContain("Instinct de survie");
    expect(union).toContain("Charognard");
    // Sans sous-type du tout, le pool retombe sur les seuls traits NON
    // sous-typés du Chiméride — il n'y en a aucun (ses 10 lignes le sont).
    expect(noms("Chiméride")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Le trait est POSÉ, et le poids reproduit le terrain              */
/* ------------------------------------------------------------------ */

describe("traits — ⭐ le 🎲 pose le trait racial (rougit sur origin/main)", () => {
  /**
   * ⭐ LE TEST QUI ROUGIT SUR LA VERSION D'AVANT. Sur `origin/main`,
   * `tirage.traitRacialTire` n'existe pas et `etape3.traitsRaciauxChoisis`
   * sort VIDE pour tout tirage non-inapte — c'est exactement le défaut
   * réparé : le serveur refusait la finalisation (« exactement 1 trait(s)
   * gratuit(s), pas 0 ») sans dire au joueur où aller.
   */
  it("⭐ un Humain tiré ressort avec EXACTEMENT 1 trait, gratuit, 0 XP, dans son pool", () => {
    const pool = traitsTirables(monde, raceParNom("Humain").id).map((t) => t.id);
    for (let i = 0; i < 50; i++) {
      const t = tirerPersonnage(deps, lcg(i * 7919 + 17), VIDE);
      expect(t.ok, `seed ${i}`).toBe(true);
      if (!t.ok) continue;
      expect(t.tirage.raceNom).toBe("Humain"); // à ∅, la seule race tirable
      expect(t.tirage.traitRacialTire, `seed ${i}`).toBeDefined();

      const b = convertirTirageEnBrouillon(snap, t, lcg(i));
      const traits = b.etape3.traitsRaciauxChoisis;
      expect(traits, `seed ${i}`).toHaveLength(1);
      expect(traits[0].est_gratuit).toBe(true);
      expect(traits[0].xp_depense).toBe(0);
      expect(pool, `seed ${i}`).toContain(traits[0].trait_id);
      // Le NOM de la fiche et l'ID du brouillon désignent le MÊME trait
      // (D34 : tiré = affiché = acheté).
      expect(traits[0].trait_id).toBe(t.tirage.traitRacialTire?.id);
    }
  });

  /**
   * Le poids MESURÉ, sur le vrai chemin : à inventaire vide, la seule race
   * tirable est l'Humain — la race est donc forcée sans truquer un tirage.
   * Attendu : Fortuné 48/57 = 84,2 % · Coup du destin 9/57 = 15,8 %.
   */
  it("⭐ 2000 tirages d'un Humain : Fortuné dans [81 %, 87 %], Coup du destin dans [13 %, 19 %]", () => {
    const N = 2000;
    const compte: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const t = tirerPersonnage(deps, lcg(i * 7919 + 17), VIDE);
      expect(t.ok, `seed ${i}`).toBe(true);
      if (!t.ok) continue;
      const nom = t.tirage.traitRacialTire?.nom ?? "AUCUN";
      compte[nom] = (compte[nom] ?? 0) + 1;
    }
    // Comptes MACHINE, lus puis gravés — et les fourchettes de la
    // spécification par-dessus, pour que le test dise la RÈGLE, pas seulement
    // le résultat d'une graine.
    expect(compte).toEqual({ Fortuné: 1694, "Coup du destin": 306 });
    expect(compte.Fortuné + compte["Coup du destin"]).toBe(N);
    expect(compte.Fortuné / N).toBeGreaterThanOrEqual(0.81);
    expect(compte.Fortuné / N).toBeLessThanOrEqual(0.87);
    expect(compte["Coup du destin"] / N).toBeGreaterThanOrEqual(0.13);
    expect(compte["Coup du destin"] / N).toBeLessThanOrEqual(0.19);
    // JUMEAU : le poids PÈSE. Sans lui, l'espérance serait 50/50 sur un pool
    // de 2 — c'est précisément ce que les fourchettes ci-dessus excluent.
    expect(compte.Fortuné).toBeGreaterThan(compte["Coup du destin"] * 3);
  });
});

/* ------------------------------------------------------------------ */
/* 4. ⭐ LE TEST QUI COMPTE LE PLUS — le Demi-Orc MAGE                  */
/* ------------------------------------------------------------------ */

describe("traits — ⭐⭐ le Demi-Orc mage ne reçoit JAMAIS « Inapte à la magie »", () => {
  /**
   * ⚠️ SANS LE JUMEAU, CE TEST EST VERT PAR DÉFAUT (faute vécue s355) : sur
   * `origin/main` aucun trait n'est tiré, donc zéro « Inapte », donc vert — et
   * il ne prouve RIEN. Les DEUX assertions sont donc écrites partout ci-dessous :
   * « combien de traits sont posés » AVANT « combien sont Inapte ».
   *
   * Motif de la règle : sorti pour un Demi-Orc MAGE ou PRÊTRE, ce trait
   * détruirait une fiche magique et `valider_etape_3` la refuserait
   * (`trait_inapte_magie_incoherent`) — on recréerait, en pire, le bug réparé.
   */
  it("⭐ 2000 tirages du pool d'un Demi-Orc apte : 2000 traits posés, 0 « Inapte à la magie »", () => {
    const race = raceParNom("Demi-Orc");
    const N = 2000;
    let poses = 0;
    let inaptes = 0;
    const vus = new Set<string>();
    const alea = lcg(20260806);
    for (let i = 0; i < N; i++) {
      const trait = tirerTraitRacial(monde, race, undefined, alea);
      if (trait) {
        poses += 1;
        vus.add(trait.nom);
        if (trait.nom === TRAIT_INAPTE) inaptes += 1;
      }
    }
    expect(poses, "LE JUMEAU : un trait est posé à chaque fois").toBe(N);
    expect(inaptes).toBe(0);
    // Le tirage BOUGE vraiment : les 5 traits du pool sortent tous.
    expect([...vus].sort((a, b) => a.localeCompare(b, "fr"))).toEqual([
      "Charognard",
      "Coup du destin",
      "Fortuné",
      "Marchandage Musclé",
      "Mythomane",
    ]);
  });

  /**
   * LE VRAI CHEMIN, pas seulement le pool : 2000 tirages complets au sac
   * `maquillage_vert` (races = { Humain, Demi-Orc }). La classe reste tirée
   * au sort — c'est ce qui sépare le magique du martial, et les deux branches
   * de D42 sont attestées CÔTE À CÔTE, avec leurs comptes machine.
   */
  it("⭐ 2000 tirages complets : chaque Demi-Orc MAGIQUE porte un trait, jamais « Inapte »", () => {
    const N = 2000;
    let magiques = 0;
    let martiaux = 0;
    let inaptesChezMagiques = 0;
    for (let i = 0; i < N; i++) {
      const t = tirerPersonnage(deps, lcg(i * 7919 + 17), SAC_DEMI_ORC);
      expect(t.ok, `seed ${i}`).toBe(true);
      if (!t.ok || t.tirage.raceNom !== "Demi-Orc") continue;
      if (t.tirage.inapteMagie) {
        martiaux += 1;
        continue;
      }
      magiques += 1;
      // LE JUMEAU, par tirage : un trait EST posé…
      expect(t.tirage.traitRacialTire, `seed ${i}`).toBeDefined();
      // …et la composition est bien celle d'un caster (l'« apte » n'est pas
      // un mot : il achète de la magie).
      expect(t.tirage.classe === "mage" || t.tirage.classe === "pretre").toBe(
        true
      );
      if (t.tirage.traitRacialTire?.nom === TRAIT_INAPTE) {
        inaptesChezMagiques += 1;
      }
    }
    // Comptes MACHINE (le sac force la race, la classe reste au ¼) :
    expect(magiques).toBe(502);
    expect(martiaux).toBe(502);
    expect(inaptesChezMagiques).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 5. ⛔ D42 INTACTE — le Demi-Orc martial ne bouge pas d'un octet      */
/* ------------------------------------------------------------------ */

describe("traits — ⛔ D42 (s372) : non-régression absolue du Demi-Orc martial", () => {
  it("⛔ un Demi-Orc guerrier ou voleur ressort avec EXACTEMENT un trait : « Inapte à la magie »", () => {
    const idInapte = monde.traits_raciaux.find((t) => t.nom === TRAIT_INAPTE)!.id;
    let martiaux = 0;
    for (let i = 0; i < 300; i++) {
      const t = tirerPersonnage(deps, lcg(i * 7919 + 17), SAC_DEMI_ORC);
      expect(t.ok, `seed ${i}`).toBe(true);
      if (!t.ok || !t.tirage.inapteMagie) continue;
      martiaux += 1;
      expect(t.tirage.raceNom).toBe("Demi-Orc");
      expect(t.tirage.classe === "guerrier" || t.tirage.classe === "voleur").toBe(
        true
      );
      // Le trait de D42 est désormais NOMMÉ sur la fiche (il était posé sans
      // être annoncé) — mais c'est bien LE MÊME trait, par le même chemin.
      expect(t.tirage.traitRacialTire?.nom).toBe(TRAIT_INAPTE);

      const b = convertirTirageEnBrouillon(snap, t, lcg(i));
      const traits = b.etape3.traitsRaciauxChoisis;
      // AUCUN second trait, AUCUN changement de coût.
      expect(traits, `seed ${i}`).toHaveLength(1);
      expect(traits[0].trait_id).toBe(idInapte);
      expect(traits[0].est_gratuit).toBe(true);
      expect(traits[0].xp_depense).toBe(0);
      // …et la composition reste celle d'un inapte : zéro magie.
      expect(t.composition.achatsMagie).toHaveLength(0);
    }
    // JUMEAU : la branche existe VRAIMENT dans ce sweep (sinon vert à vide).
    expect(martiaux).toBe(78);
  });
});

/* ------------------------------------------------------------------ */
/* 6. ⭐ LE CHIMÉRIDE EST FINALISABLE                                   */
/* ------------------------------------------------------------------ */

describe("traits — ⭐ le Chiméride tiré passe enfin l'étape 2 (rougit sur origin/main)", () => {
  /**
   * ⭐ ROUGIT SUR `origin/main` : le générateur ne posait AUCUN sous-type, et
   * la fiche était bloquée à l'étape 2 (`sous_type_chimeride_manquant`) quoi
   * que le joueur fasse — indépendamment des traits.
   */
  it("⭐ le tirage pose un sousTypeChimeride ∈ {carnivore, herbivore}, et le brouillon le porte", () => {
    let chimerides = 0;
    for (let i = 0; i < 100; i++) {
      const t = tirerPersonnage(deps, lcg(i * 31 + 5), SAC_CHIMERIDE);
      expect(t.ok, `seed ${i}`).toBe(true);
      if (!t.ok) continue;
      if (t.tirage.raceNom !== "Chiméride") {
        // Jumeau permanent : les races SANS sous-type n'en reçoivent jamais un
        // (`valider_etape_2` refuserait : sous_type_chimeride_invalide_pour_race).
        expect(t.tirage.sousTypeChimeride, `seed ${i}`).toBeUndefined();
        continue;
      }
      chimerides += 1;
      expect(["carnivore", "herbivore"], `seed ${i}`).toContain(
        t.tirage.sousTypeChimeride
      );
      const b = convertirTirageEnBrouillon(snap, t, lcg(i));
      expect(b.etape2.sousTypeChimeride).toBe(t.tirage.sousTypeChimeride);
      expect(b.etape3.traitsRaciauxChoisis).toHaveLength(1);
    }
    expect(chimerides).toBeGreaterThan(0);
  });

  it("⭐ 2000 tirages : jamais un trait de l'AUTRE sous-type, part carnivore dans [52 %, 68 %]", () => {
    const N = 2000;
    const parSousType: Record<string, number> = { carnivore: 0, herbivore: 0 };
    const traitsVus: Record<string, Set<string>> = {
      carnivore: new Set(),
      herbivore: new Set(),
    };
    for (let i = 0; i < N; i++) {
      const t = tirerPersonnage(deps, lcg(i * 31 + 5), SAC_CHIMERIDE);
      expect(t.ok, `seed ${i}`).toBe(true);
      if (!t.ok || t.tirage.raceNom !== "Chiméride") continue;
      const st = t.tirage.sousTypeChimeride!;
      parSousType[st] += 1;
      // LE JUMEAU : un trait EST posé — sans lui, « jamais X » serait vert
      // à vide (aucun trait tiré ⇒ aucun trait fautif).
      expect(t.tirage.traitRacialTire, `seed ${i}`).toBeDefined();
      traitsVus[st].add(t.tirage.traitRacialTire!.nom);
    }
    // Un carnivore ne reçoit JAMAIS « Instinct de survie » (herbivore)…
    expect([...traitsVus.carnivore]).not.toContain("Instinct de survie");
    // …un herbivore JAMAIS « Charognard » (carnivore).
    expect([...traitsVus.herbivore]).not.toContain("Charognard");
    // JUMEAU du filtre : les deux traits exclusifs SORTENT bel et bien chez
    // le sous-type auquel ils appartiennent — l'absence est un filtre, pas un
    // pool mort.
    expect([...traitsVus.carnivore]).toContain("Charognard");
    expect([...traitsVus.herbivore]).toContain("Instinct de survie");

    // Comptes MACHINE + la fourchette de la spécification (attendu 3/5 = 60 %).
    const chimerides = parSousType.carnivore + parSousType.herbivore;
    expect(parSousType).toEqual({ carnivore: 606, herbivore: 395 });
    const part = parSousType.carnivore / chimerides;
    expect(part).toBeGreaterThanOrEqual(0.52);
    expect(part).toBeLessThanOrEqual(0.68);
  });
});

/* ------------------------------------------------------------------ */
/* 7. La conversion et LA GATE — « finalisable » n'est pas un mot      */
/* ------------------------------------------------------------------ */

describe("traits — le trait tiré passe le miroir serveur (gatesTraits)", () => {
  /**
   * ⭐ LA PREUVE DE BOUT EN BOUT. Le lot promet une fiche FINALISABLE : le
   * critère n'est pas « un trait est écrit », c'est « la gate l'accepte ».
   * `peutAcheterTraitRacial` est le portage 1:1 de la RPC serveur — il vérifie
   * la disponibilité (race + sémantique sous_type) ET la gratuité (0 trait
   * acquis ⇒ 0 XP). Il lit le snapshot COMMITTÉ : les ids de la fixture sont
   * ceux de la prod, le montage tient.
   */
  it("⭐ Humain, Demi-Orc (les deux branches) et Chiméride : la gate dit OK et GRATUIT", () => {
    const cas: { sac: ReadonlySet<string>; seed: (i: number) => number }[] = [
      { sac: VIDE, seed: (i) => i * 7919 + 17 },
      { sac: SAC_DEMI_ORC, seed: (i) => i * 7919 + 17 },
      { sac: SAC_CHIMERIDE, seed: (i) => i * 31 + 5 },
    ];
    const racesVues = new Set<string>();
    for (const { sac, seed } of cas) {
      for (let i = 0; i < 60; i++) {
        const t = tirerPersonnage(deps, lcg(seed(i)), sac);
        expect(t.ok, `seed ${i}`).toBe(true);
        if (!t.ok) continue;
        const b = convertirTirageEnBrouillon(snap, t, lcg(i));
        const traits = b.etape3.traitsRaciauxChoisis;
        expect(traits, `${t.tirage.raceNom} seed ${i}`).toHaveLength(1);
        racesVues.add(t.tirage.raceNom);

        // La gate est interrogée comme le wizard l'interrogera : contexte VIDE
        // (le trait gratuit est le premier), sous-type tel que l'étape 2 l'a
        // enregistré.
        const verdict = peutAcheterTraitRacial(
          { xpDispo: t.tirage.budget, traitsRaciauxChoisis: [] },
          {
            traitId: traits[0].trait_id!,
            raceId: t.tirage.raceId,
            sousType: b.etape2.sousTypeChimeride ?? null,
          }
        );
        expect(
          verdict.peutAcheter,
          `${t.tirage.raceNom}/${t.tirage.sousTypeChimeride ?? "—"} → ${verdict.raison}`
        ).toBe(true);
        expect(verdict.estGratuit).toBe(true);
        expect(verdict.coutXp).toBe(0);
      }
    }
    // JUMEAU : les 3 races visées SONT passées (sinon la boucle serait vide).
    expect([...racesVues].sort()).toEqual(["Chiméride", "Demi-Orc", "Humain"]);
  });

  it("JUMEAU de la gate : un trait de l'AUTRE sous-type serait REFUSÉ", () => {
    // Preuve que le filtre C99 fait un vrai travail : « Instinct de survie »
    // est légitime chez l'herbivore et refusé au carnivore.
    const chimeride = raceParNom("Chiméride").id;
    const instinct = monde.traits_raciaux.find(
      (t) => t.nom === "Instinct de survie"
    )!.id;
    const ctx = { xpDispo: 60, traitsRaciauxChoisis: [] };
    expect(
      peutAcheterTraitRacial(ctx, {
        traitId: instinct,
        raceId: chimeride,
        sousType: "herbivore",
      }).peutAcheter
    ).toBe(true);
    expect(
      peutAcheterTraitRacial(ctx, {
        traitId: instinct,
        raceId: chimeride,
        sousType: "carnivore",
      }).peutAcheter
    ).toBe(false);
  });

  it("COMPAT : un tirage SANS trait ni sous-type (🧭, appels v1) laisse tout vide", () => {
    // La branche « rien » est un cas de PREMIER ORDRE, pas un oubli : 🧭 ne
    // pose aucun trait (le joueur choisit au wizard), et les appelants v1 ne
    // connaissent pas le champ. Le brouillon doit rester exactement celui
    // d'avant le lot.
    const t = tirerPersonnage(deps, lcg(17), VIDE);
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    const v1 = {
      tirage: {
        ...t.tirage,
        traitRacialTire: undefined,
        sousTypeChimeride: undefined,
      },
      composition: t.composition,
    };
    const b = convertirTirageEnBrouillon(snap, v1, lcg(1));
    expect(b.etape3.traitsRaciauxChoisis).toEqual([]);
    expect(b.etape2.sousTypeChimeride).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* ⭐⭐ [D53, s381] LE BARREAU 🧭 « TON HÉRITAGE » — le trait racial se       */
/* CHOISIT, plus jamais un cul-de-sac au clic « Finaliser ».              */
/* ------------------------------------------------------------------ */

/** [D53] Un parcours 🧭 MINIMAL — guerrier `gForgeron` (`requiert: () =>
 *  null`, aucun équipement) — pour composer sans dépendre de l'inventaire :
 *  seul le barreau « Ton héritage » (race, sous-type, trait) est sous test
 *  ici, jamais l'équipement. Guerrier n'est JAMAIS caster (mesuré plus haut :
 *  `guerrier: [3, 0, 0]`) — `estCaster` vaut donc `false` partout ci-dessous
 *  sauf mention contraire. */
const PARCOURS_HERITAGE: ParcoursBoussole = {
  ...PARCOURS_VIDE,
  classe: "guerrier",
  roleId: "gForgeron",
};

describe("🧭 D53 — le barreau « Ton héritage » (sous-type + trait, bout en bout)", () => {
  // ⚠️ [contesté, cf. PR] Le §3 du prompt dit « les 11 races » pour ce
  // balayage — mais 3 des 11 lignes de `races` (Fée, Haut-Elfe, Orc) sont
  // `est_jouable: false` (mesuré Supabase, 2026-08-07) : un parcours 🧭 ne
  // peut JAMAIS les atteindre (`raceId` vient de l'écran de constat, en
  // amont, qui ne propose que les jouables). Le balayage ci-dessous couvre
  // donc les 8 races RÉELLEMENT accessibles au 🧭 — la décomposition exacte
  // du §3 (Humain, Les Non-Races, Chiméride, Demi-Elfe, Demi-Orc, Drow,
  // Gobelin, Myrvalk) — jamais un chiffre rond.
  const RACES_JOUABLES = monde.races.filter(
    (r) => r.est_actif && r.est_jouable
  );

  const sweep = RACES_JOUABLES.map((race) => {
    const choix = construireChoix(PARCOURS_HERITAGE, race.id, VIDE, monde, false);
    const res = resoudreChoix(deps, choix);
    if (!res.ok) return { race, ok: false as const, raison: res.raison };
    return {
      race,
      ok: true as const,
      brouillon: convertirTirageEnBrouillon(snap, res, lcg(1)),
    };
  });

  it("le balayage couvre EXACTEMENT les 8 races jouables (jamais les 3 non-jouables)", () => {
    expect(sweep.map((s) => s.race.nom).sort()).toEqual([
      "Chiméride",
      "Demi-Elfe",
      "Demi-Orc",
      "Drow",
      "Gobelin",
      "Humain",
      "Les Non-Races",
      "Myrvalk",
    ]);
  });

  it("⭐ A-positif [rougit sur origin/main] : 8 parcours (8 races × 1) ⇒ 8 brouillons avec EXACTEMENT 1 trait, gratuit, 0 XP", () => {
    let comptes = 0;
    for (const s of sweep) {
      expect(s.ok, s.ok ? "" : `${s.race.nom} : ${s.raison}`).toBe(true);
      if (!s.ok) continue;
      const traits = s.brouillon.etape3.traitsRaciauxChoisis;
      expect(traits, s.race.nom).toHaveLength(1);
      expect(traits[0].est_gratuit, s.race.nom).toBe(true);
      expect(traits[0].xp_depense, s.race.nom).toBe(0);
      comptes++;
    }
    // Décomposition : 8 races jouables × 1 parcours guerrier chacune = 8.
    expect(comptes).toBe(8);
  });

  it("A-jumeau négatif : 0 des 8 brouillons ne porte un trait absent du pool de sa race (et de son sous-type)", () => {
    const horsPool: string[] = [];
    for (const s of sweep) {
      if (!s.ok) continue;
      const sousType = s.brouillon.etape2.sousTypeChimeride;
      const pool = traitsRaciauxProposables(monde, s.race.id, sousType).map(
        (t) => t.id
      );
      for (const t of s.brouillon.etape3.traitsRaciauxChoisis) {
        if (!pool.includes(t.trait_id ?? "")) {
          horsPool.push(`${s.race.nom} → ${t.trait_id}`);
        }
      }
    }
    expect(horsPool).toEqual([]);
  });

  it("⭐ B-positif [rougit sur origin/main] : le Chiméride pose un sousTypeChimeride ∈ {carnivore, herbivore}", () => {
    const chim = sweep.find((s) => s.race.nom === "Chiméride");
    expect(chim?.ok).toBe(true);
    if (chim?.ok) {
      expect(["carnivore", "herbivore"]).toContain(
        chim.brouillon.etape2.sousTypeChimeride
      );
    }
  });

  it("B-jumeau négatif [vert par défaut, ne prouve rien seul] : les 7 AUTRES races jouables ne posent JAMAIS de sous-type", () => {
    const autres = sweep.filter((s) => s.race.nom !== "Chiméride");
    expect(autres).toHaveLength(7);
    for (const s of autres) {
      expect(s.ok, s.race.nom).toBe(true);
      if (s.ok) {
        expect(
          s.brouillon.etape2.sousTypeChimeride,
          s.race.nom
        ).toBeUndefined();
      }
    }
  });
});

describe("🧭 D53 — le résolveur SAIT (traitsChoisis enfin alimenté par construireChoix)", () => {
  const demiOrc = raceParNom("Demi-Orc");
  const inapteId = monde.traits_raciaux.find((t) => t.nom === TRAIT_INAPTE)!.id;
  const charognardId = monde.traits_raciaux.find(
    (t) => t.nom === "Charognard"
  )!.id;

  it("⭐ C-positif : Demi-Orc voie Guerrier + « Inapte à la magie » ⇒ inapteMagie=true, 0 achat de magie, 0 Développement Spirituel", () => {
    const p: ParcoursBoussole = { ...PARCOURS_HERITAGE, traitRacialChoisi: inapteId };
    const choix = construireChoix(p, demiOrc.id, VIDE, monde, false);
    expect(choix.traitsChoisis).toEqual([TRAIT_INAPTE]);
    const res = resoudreChoix(deps, choix);
    expect(res.ok, res.ok ? "" : res.raison).toBe(true);
    if (!res.ok) return;
    expect(res.tirage.inapteMagie).toBe(true);
    expect(res.composition.achatsMagie).toHaveLength(0);
    expect(
      res.composition.achats.filter((a) => a.nom === "Développement Spirituel")
    ).toHaveLength(0);
  });

  it("jumeau : le MÊME Demi-Orc Guerrier + « Charognard » n'est PAS contraint — inapteMagie=false, composition inchangée", () => {
    const p: ParcoursBoussole = {
      ...PARCOURS_HERITAGE,
      traitRacialChoisi: charognardId,
    };
    const choix = construireChoix(p, demiOrc.id, VIDE, monde, false);
    expect(choix.traitsChoisis).toEqual(["Charognard"]);
    const res = resoudreChoix(deps, choix);
    expect(res.ok, res.ok ? "" : res.raison).toBe(true);
    if (!res.ok) return;
    expect(res.tirage.inapteMagie).toBe(false);
  });
});

describe("🧭 D53 — le grisage d'« Inapte à la magie » (rôle caster, `roleEstCaster`)", () => {
  const demiOrc = raceParNom("Demi-Orc");

  it("négatif : Demi-Orc + rôle CASTER ⇒ Inapte présent dans le pool, mais grisé, motif verbatim", () => {
    const traits = traitsRaciauxAffiches(monde, demiOrc, undefined, true);
    const inapte = traits.find((t) => t.nom === TRAIT_INAPTE);
    expect(inapte).toBeDefined();
    expect(inapte?.grise).toBe(true);
    expect(inapte?.motif).toBe(MOTIF_INAPTE_GRISE);
  });

  it("jumeau positif : le MÊME Demi-Orc, rôle NON-caster ⇒ Inapte choisissable", () => {
    const traits = traitsRaciauxAffiches(monde, demiOrc, undefined, false);
    const inapte = traits.find((t) => t.nom === TRAIT_INAPTE);
    expect(inapte).toBeDefined();
    expect(inapte?.grise).toBe(false);
    expect(inapte?.motif).toBeUndefined();
  });
});

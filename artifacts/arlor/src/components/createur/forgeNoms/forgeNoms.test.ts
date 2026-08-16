/**
 * [s406] LA FORGE DES NOMS — ATTESTATIONS.
 *
 * Quatre choses sont protégées ici :
 * 1. La SOUDURE, au verbatim (les pires cas d'élision de la maquette s405).
 * 2. Le TIRAGE : 8 noms distincts, qui respectent la race, la sonorité et le
 *    sous-type Chiméride — vérifiés par ÉNUMÉRATION du répertoire, jamais en
 *    rappelant la fonction testée (C109).
 * 3. Les DONNÉES : garde anti-stub (pools non vides) + PLANCHER DE VOLUME.
 * 4. L'APPARIEMENT : les 8 labels de la Forge = les 8 races jouables de la
 *    base, attesté contre la CAPTURE VISITEUR, dans les deux sens (C146).
 */
import { describe, expect, it } from "vitest";

import snapshotJson from "../../../data/snapshotVisiteur.json";
import {
  NOMS_PAR_RACE,
  ORDRE_RACES_FORGE,
  type PoolPrenoms,
  type RaceForgeId,
} from "./noms";
import {
  TEXTES,
  forgerNoms,
  raceForgeDepuisNom,
  souder,
} from "./logique";

// Graine fixe (mulberry32) : les tirages des tests sont DÉTERMINISTES.
const rngGraine = (graine: number) => {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Énumération du répertoire d'un volet : l'instrument INDÉPENDANT du tirage. */
const prenomsPossibles = (p: PoolPrenoms): Set<string> => {
  const s = new Set<string>();
  for (const a of p.att) for (const f of p.fin) s.add(souder(a, f));
  if (p.mid) {
    for (const a of p.att)
      for (const m of p.mid) for (const f of p.fin) s.add(souder(souder(a, m), f));
  }
  for (const e of p.entiers) s.add(e);
  return s;
};

describe("souder — les pires cas de la maquette, au verbatim", () => {
  it("élide la voyelle finale devant une voyelle (Élo+onde)", () => {
    expect(souder("Élo", "onde")).toBe("Élonde");
  });
  it("élide DEUX fois quand la frontière reste voyelle·voyelle (Vae+ariel)", () => {
    expect(souder("Vae", "ariel")).toBe("Variel");
  });
  it("soude une médiane puis une finale (Xil+une+aeye)", () => {
    expect(souder(souder("Xil", "une"), "aeye")).toBe("Xilunaeye");
  });
  it("ne touche à rien quand la frontière est consonne·consonne (Bal+drim)", () => {
    expect(souder("Bal", "drim")).toBe("Baldrim");
  });
  it("une pièce vide est transparente (Ald+''+ien)", () => {
    expect(souder(souder("Ald", ""), "ien")).toBe("Aldien");
  });
});

describe("forgerNoms — le tirage respecte la commande", () => {
  const humain = NOMS_PAR_RACE.humain;
  const chimeride = NOMS_PAR_RACE.chimeride;

  it("rend exactement 8 noms, tous distincts (jumeau : le compte ET la dédup)", () => {
    const noms = forgerNoms({
      race: humain,
      sexe: "M",
      sousType: "carnivore",
      avecFamille: true,
      rng: rngGraine(406),
    });
    expect(noms).toHaveLength(8);
    expect(new Set(noms).size).toBe(8);
  });

  it("sonorité M : chaque prénom appartient au répertoire M énuméré", () => {
    const possibles = prenomsPossibles(humain.prenoms.M);
    const noms = forgerNoms({
      race: humain,
      sexe: "M",
      sousType: "carnivore",
      avecFamille: false,
      n: 20,
      rng: rngGraine(1),
    });
    expect(noms.length).toBeGreaterThan(0); // jumeau positif : le tirage produit
    for (const n of noms) expect(possibles.has(n)).toBe(true);
  });

  it("sonorité F : chaque prénom appartient au répertoire F énuméré", () => {
    const possibles = prenomsPossibles(humain.prenoms.F);
    const noms = forgerNoms({
      race: humain,
      sexe: "F",
      sousType: "carnivore",
      avecFamille: false,
      n: 20,
      rng: rngGraine(2),
    });
    expect(noms.length).toBeGreaterThan(0);
    for (const n of noms) expect(possibles.has(n)).toBe(true);
  });

  it("sonorité « Autre » : tire dans les DEUX répertoires (au moins un de chaque)", () => {
    const ensM = prenomsPossibles(humain.prenoms.M);
    const ensF = prenomsPossibles(humain.prenoms.F);
    const noms = forgerNoms({
      race: humain,
      sexe: "A",
      sousType: "carnivore",
      avecFamille: false,
      n: 20,
      rng: rngGraine(3),
    });
    const duM = noms.filter((n) => ensM.has(n) && !ensF.has(n));
    const duF = noms.filter((n) => ensF.has(n) && !ensM.has(n));
    expect(duM.length).toBeGreaterThan(0);
    expect(duF.length).toBeGreaterThan(0);
    for (const n of noms) expect(ensM.has(n) || ensF.has(n)).toBe(true);
  });

  it("avec famille : « Prénom Famille », la famille venant du bon répertoire", () => {
    const possiblesPrenoms = prenomsPossibles(humain.prenoms.M);
    const famillesHumain = new Set<string>();
    if (humain.familles.type === "compose") {
      for (const a of humain.familles.a)
        for (const b of humain.familles.b) famillesHumain.add(a + b);
    }
    expect(famillesHumain.size).toBeGreaterThan(0);
    const noms = forgerNoms({
      race: humain,
      sexe: "M",
      sousType: "carnivore",
      avecFamille: true,
      n: 20,
      rng: rngGraine(4),
    });
    for (const n of noms) {
      const morceaux = n.split(" ");
      expect(morceaux).toHaveLength(2);
      expect(possiblesPrenoms.has(morceaux[0])).toBe(true);
      expect(famillesHumain.has(morceaux[1])).toBe(true);
    }
  });

  it("Chiméride : le totem suit le sous-type (carnivore ∈ 🥩, jamais ∈ 🌿)", () => {
    expect(chimeride.familles.type).toBe("sousType");
    if (chimeride.familles.type !== "sousType") return;
    const carn = new Set(chimeride.familles.carnivore);
    const herb = new Set(chimeride.familles.herbivore);
    // Les deux listes sont disjointes — sans ça le test ne départagerait rien.
    for (const f of carn) expect(herb.has(f)).toBe(false);
    const noms = forgerNoms({
      race: chimeride,
      sexe: "F",
      sousType: "carnivore",
      avecFamille: true,
      n: 20,
      rng: rngGraine(5),
    });
    expect(noms.length).toBeGreaterThan(0);
    for (const n of noms) {
      const famille = n.slice(n.indexOf(" ") + 1);
      expect(carn.has(famille)).toBe(true);
      expect(herb.has(famille)).toBe(false);
    }
  });
});

describe("les données — garde anti-stub et plancher de volume", () => {
  it("8 races, dans l'ordre de la maquette (jumeau positif de la garde)", () => {
    expect(ORDRE_RACES_FORGE).toHaveLength(8);
    expect(Object.keys(NOMS_PAR_RACE).sort()).toEqual(
      [...ORDRE_RACES_FORGE].sort(),
    );
  });

  it("chaque race × sonorité a ses pools non vides (att, fin, et mid s'il existe)", () => {
    for (const id of ORDRE_RACES_FORGE) {
      for (const volet of ["M", "F"] as const) {
        const p = NOMS_PAR_RACE[id].prenoms[volet];
        expect(p.att.length, `${id}.${volet}.att`).toBeGreaterThan(0);
        expect(p.fin.length, `${id}.${volet}.fin`).toBeGreaterThan(0);
        if (p.mid) expect(p.mid.length, `${id}.${volet}.mid`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * ⚠️ PLANCHER DE VOLUME — UNE GARDE, PAS UNE CONSTANTE (C130).
   * Mesuré s406 : le plus petit volet rend 83 prénoms distincts, le total 5508.
   * Les seuils (50 / 4000) sont des planchers anti-stub : si ce test rougit,
   * la CAUSE est un appauvrissement de noms.ts — le correctif va dans les
   * données, ⛔ JAMAIS dans ces seuils.
   */
  it("plancher : ≥ 50 prénoms distincts par volet, ≥ 4000 au total", () => {
    let total = 0;
    for (const id of ORDRE_RACES_FORGE) {
      for (const volet of ["M", "F"] as const) {
        const n = prenomsPossibles(NOMS_PAR_RACE[id].prenoms[volet]).size;
        expect(n, `${id}.${volet}`).toBeGreaterThanOrEqual(50);
        total += n;
      }
    }
    expect(total).toBeGreaterThanOrEqual(4000);
  });

  it("chaque race a de quoi forger un nom de famille", () => {
    for (const id of ORDRE_RACES_FORGE) {
      const f = NOMS_PAR_RACE[id].familles;
      if (f.type === "compose") {
        expect(f.a.length, `${id}.a`).toBeGreaterThan(0);
        expect(f.b.length, `${id}.b`).toBeGreaterThan(0);
      } else if (f.type === "sousType") {
        expect(f.carnivore.length, `${id}.carnivore`).toBeGreaterThan(0);
        expect(f.herbivore.length, `${id}.herbivore`).toBeGreaterThan(0);
      } else {
        expect(f.liste.length, `${id}.liste`).toBeGreaterThan(0);
      }
    }
  });
});

describe("appariement Forge ↔ base (capture visiteur), dans les deux sens", () => {
  type LigneRace = { nom: string; est_jouable?: boolean | null };
  const races = (
    snapshotJson as unknown as { tables: { races: LigneRace[] } }
  ).tables.races;

  /**
   * ⚠️ GARDE ANTI-STUB (C99/C133/C146) : si une recapture perdait la colonne
   * `est_jouable`, le jeu des jouables serait VIDE et une comparaison de jeux
   * vides passerait pour une concordance. Ce test-ci rougit d'abord.
   */
  it("la capture porte des races, TOUTES avec la colonne est_jouable", () => {
    expect(races.length).toBeGreaterThanOrEqual(8);
    for (const r of races) {
      expect(typeof r.est_jouable, r.nom).toBe("boolean");
    }
  });

  it("les 8 labels de la Forge = les 8 races jouables, au caractère près", () => {
    const jouables = races
      .filter((r) => r.est_jouable === true)
      .map((r) => r.nom)
      .sort();
    const labels = ORDRE_RACES_FORGE.map(
      (id) => NOMS_PAR_RACE[id].label,
    ).sort();
    expect(labels).toEqual(jouables);
  });

  it("raceForgeDepuisNom : les 8 jouables se résolvent (jumeau positif)", () => {
    const attendus: Record<string, RaceForgeId> = {
      Humain: "humain",
      "Demi-Elfe": "demiElfe",
      Drow: "drow",
      Gobelin: "gobelin",
      "Demi-Orc": "demiOrc",
      Myrvalk: "myrvalk",
      Chiméride: "chimeride",
      "Les Non-Races": "nonRaces",
    };
    for (const [nom, id] of Object.entries(attendus)) {
      expect(raceForgeDepuisNom(nom)).toBe(id);
    }
  });

  it("raceForgeDepuisNom : refus = null, jamais une exception (jumeau négatif)", () => {
    expect(raceForgeDepuisNom("Fée")).toBeNull();
    expect(raceForgeDepuisNom("Haut-Elfe")).toBeNull();
    expect(raceForgeDepuisNom("Orc")).toBeNull();
    expect(raceForgeDepuisNom(null)).toBeNull();
    expect(raceForgeDepuisNom(undefined)).toBeNull();
  });
});

describe("textes joueur — verbatim (C101)", () => {
  it("le bouton d'entrée", () => {
    expect(TEXTES.bouton).toBe("🔥 Propose-moi des noms");
  });
  it("le titre de la fenêtre", () => {
    expect(TEXTES.titre).toBe("La Forge des noms");
  });
  it("le groupe s'appelle « Sonorité du nom » (arbitrage Fred s405)", () => {
    expect(TEXTES.groupeSonorite).toBe("Sonorité du nom");
  });
  it("le 3ᵉ volet s'appelle « Autre », jamais « Peu importe » (arbitrage Fred s405)", () => {
    expect(TEXTES.autre).toBe("Autre");
  });
});

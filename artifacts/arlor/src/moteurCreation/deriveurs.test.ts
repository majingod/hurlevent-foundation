/**
 * Tests des dériveurs XP / PV / PS sur les données RÉELLES du snapshot.
 */

import { describe, it, expect } from "vitest";
import { getSnapshot } from "./snapshot";
import type { EtatCreationVisiteur, CompetenceAcquiseLocale } from "./deriveurs";
import {
  raceInapteMagie,
  personnageInapteMagie,
  calculerXp,
  calculerPvMax,
  calculerPsMax,
  calculerNiveau,
} from "./deriveurs";

const snapshot = getSnapshot();

function raceId(nom: string): string {
  const r = snapshot.tables.races.find((x) => x.nom === nom);
  if (!r) throw new Error(`race « ${nom} » absente du snapshot`);
  return r.id;
}
function classeId(nom: string): string {
  const c = snapshot.tables.classes.find((x) => x.nom === nom);
  if (!c) throw new Error(`classe « ${nom} » absente du snapshot`);
  return c.id;
}
function competenceId(nom: string): string {
  const c = snapshot.tables.competences.find((x) => x.nom === nom);
  if (!c) throw new Error(`compétence « ${nom} » absente du snapshot`);
  return c.id;
}

function traitInapteId(): string {
  const t = snapshot.tables.traits_raciaux.find(
    (x) => x.nom === "Inapte à la magie"
  );
  if (!t) throw new Error("trait « Inapte à la magie » absent du snapshot");
  return t.id;
}

/** Le trait CHOISI, sous la forme que porte `EtatCreationVisiteur`. */
function avecTraitInapte() {
  return [{ traitId: traitInapteId() }];
}

function acquise(
  id: string,
  xpDepense = 0,
  niveauAcquis = 1
): CompetenceAcquiseLocale {
  return { competenceId: id, niveauAcquis, choixAchat: null, xpDepense };
}

function etat(p: Partial<EtatCreationVisiteur> = {}): EtatCreationVisiteur {
  return {
    raceId: null,
    classeId: null,
    competencesAcquises: [],
    ...p,
  };
}

describe("raceInapteMagie (annexe D)", () => {
  it("Demi-Orc possède le trait actif « Inapte à la magie » → true", () => {
    expect(raceInapteMagie(snapshot, raceId("Demi-Orc"))).toBe(true);
  });
  it("Humain n'est pas inapte → false", () => {
    expect(raceInapteMagie(snapshot, raceId("Humain"))).toBe(false);
  });
  it("raceId null → false", () => {
    expect(raceInapteMagie(snapshot, null)).toBe(false);
  });
});

describe("calculerXp (annexe A)", () => {
  it("xpTotal = races.xp_depart, aucune dépense", () => {
    const r = calculerXp(snapshot, etat({ raceId: raceId("Humain") }));
    const xpDepart = snapshot.tables.races.find((x) => x.nom === "Humain")!.xp_depart!;
    expect(r.xpTotal).toBe(xpDepart);
    expect(r.xpDepense).toBe(0);
    expect(r.xpDispo).toBe(xpDepart);
  });

  it("race absente/nulle → xpTotal 0", () => {
    expect(calculerXp(snapshot, etat()).xpTotal).toBe(0);
  });

  it("xpDepense = Σ coûts des compétences + autres dépenses", () => {
    const e = etat({
      raceId: raceId("Humain"),
      competencesAcquises: [acquise(competenceId("Botte Secrète"), 9)],
      autresDepensesXp: [15, 5],
    });
    const r = calculerXp(snapshot, e);
    const xpDepart = snapshot.tables.races.find((x) => x.nom === "Humain")!.xp_depart!;
    expect(r.xpDepense).toBe(9 + 15 + 5);
    expect(r.xpDispo).toBe(xpDepart - (9 + 15 + 5));
  });

  it("une gratuité (xpDepense 0) ne consomme pas d'XP", () => {
    const e = etat({
      raceId: raceId("Humain"),
      competencesAcquises: [acquise(competenceId("Botte Secrète"), 0)],
    });
    expect(calculerXp(snapshot, e).xpDepense).toBe(0);
  });

  it("retrait local = item absent → recompute (dépense recule)", () => {
    const avant = etat({
      raceId: raceId("Humain"),
      competencesAcquises: [acquise(competenceId("Botte Secrète"), 9)],
    });
    expect(calculerXp(snapshot, avant).xpDepense).toBe(9);
    const apres = { ...avant, competencesAcquises: [] };
    expect(calculerXp(snapshot, apres).xpDepense).toBe(0);
  });
});

describe("personnageInapteMagie (INSTANCE, s370)", () => {
  it("le trait CHOISI → true", () => {
    expect(personnageInapteMagie(snapshot, avecTraitInapte())).toBe(true);
  });
  it("aucun trait choisi → false, même pour une race qui PEUT l'avoir", () => {
    expect(personnageInapteMagie(snapshot, [])).toBe(false);
    expect(personnageInapteMagie(snapshot, undefined)).toBe(false);
  });
  it("un AUTRE trait choisi → false", () => {
    const autre = snapshot.tables.traits_raciaux.find(
      (t) => t.nom !== "Inapte à la magie"
    )!;
    expect(personnageInapteMagie(snapshot, [{ traitId: autre.id }])).toBe(false);
  });
  it("deux verbes, deux maisons : le dériveur de MODÈLE ne bouge pas (C75)", () => {
    // `raceInapteMagie` répond « cette RACE peut-elle naître inapte » — le
    // générateur en dépend tel quel. Il reste vrai pour le Demi-Orc même
    // quand l'instance, elle, est apte.
    expect(raceInapteMagie(snapshot, raceId("Demi-Orc"))).toBe(true);
    expect(personnageInapteMagie(snapshot, [])).toBe(false);
  });
});

describe("calculerPvMax (annexe B)", () => {
  it("classe pv_depart, non inapte (Guerrier=6)", () => {
    const pv = snapshot.tables.classes.find((c) => c.nom === "Guerrier")!.pv_depart!;
    expect(
      calculerPvMax(snapshot, etat({ classeId: classeId("Guerrier"), raceId: raceId("Humain") }))
    ).toBe(pv);
  });
  it("+1 si le PERSONNAGE porte le trait « Inapte à la magie » (s370)", () => {
    const pv = snapshot.tables.classes.find((c) => c.nom === "Guerrier")!.pv_depart!;
    expect(
      calculerPvMax(
        snapshot,
        etat({
          classeId: classeId("Guerrier"),
          raceId: raceId("Demi-Orc"),
          traitsChoisis: avecTraitInapte(),
        })
      )
    ).toBe(pv + 1);
  });
  it("JUMEAU — un Demi-Orc SANS le trait n'a PAS le +1 (le modèle ne décide plus)", () => {
    const pv = snapshot.tables.classes.find((c) => c.nom === "Guerrier")!.pv_depart!;
    // Rougit sur le code d'avant s369, où la RACE suffisait à donner le bonus.
    expect(
      calculerPvMax(
        snapshot,
        etat({ classeId: classeId("Guerrier"), raceId: raceId("Demi-Orc") })
      )
    ).toBe(pv);
  });
  it("classe nulle → défaut 4", () => {
    expect(calculerPvMax(snapshot, etat({ raceId: raceId("Humain") }))).toBe(4);
  });
});

describe("calculerPsMax (annexe C)", () => {
  it("0 si le PERSONNAGE porte le trait « Inapte à la magie » (s370)", () => {
    expect(
      calculerPsMax(
        snapshot,
        etat({
          classeId: classeId("Mage"),
          raceId: raceId("Demi-Orc"),
          traitsChoisis: avecTraitInapte(),
        })
      )
    ).toBe(0);
  });
  it("JUMEAU — un Demi-Orc SANS le trait garde les PS de sa classe (Mage=10)", () => {
    const ps = snapshot.tables.classes.find((c) => c.nom === "Mage")!.ps_depart!;
    // C'est EXACTEMENT le changement de règle de s369 : le manuel donne accès
    // à la magie aux demi-orcs ; seul le trait choisi la retire.
    expect(
      calculerPsMax(
        snapshot,
        etat({ classeId: classeId("Mage"), raceId: raceId("Demi-Orc") })
      )
    ).toBe(ps);
  });

  it("classe ps_depart sans Dév. Spirituel (Mage=10)", () => {
    const ps = snapshot.tables.classes.find((c) => c.nom === "Mage")!.ps_depart!;
    expect(
      calculerPsMax(snapshot, etat({ classeId: classeId("Mage"), raceId: raceId("Humain") }))
    ).toBe(ps);
  });

  it("empilement Développement Spirituel (+1 par achat) et Supérieur", () => {
    const ps = snapshot.tables.classes.find((c) => c.nom === "Mage")!.ps_depart!;
    const dev = competenceId("Développement Spirituel");
    const devSup = competenceId("Développement Spirituel Supérieur");
    const e = etat({
      classeId: classeId("Mage"),
      raceId: raceId("Humain"),
      competencesAcquises: [
        acquise(dev, 2),
        acquise(dev, 2),
        acquise(dev, 2),
        acquise(devSup, 4),
      ],
    });
    // ps_depart + 3 (Dév Spirituel) + 1 (Supérieur)
    expect(calculerPsMax(snapshot, e)).toBe(ps + 3 + 1);
  });

  it("classe nulle → défaut 5", () => {
    expect(calculerPsMax(snapshot, etat({ raceId: raceId("Humain") }))).toBe(5);
  });
});

describe("calculerNiveau", () => {
  it("visiteur → 1", () => {
    expect(calculerNiveau()).toBe(1);
  });
});

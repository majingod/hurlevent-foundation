/**
 * Tests des gratuités de classe (annexe E) sur les 4 classes RÉELLES du snapshot.
 */

import { describe, it, expect } from "vitest";
import { getSnapshot } from "./snapshot";
import { appliquerGratuites } from "./gratuites";
import type { EtatCreationVisiteur } from "./deriveurs";

const snapshot = getSnapshot();

function classe(nom: string) {
  const c = snapshot.tables.classes.find((x) => x.nom === nom);
  if (!c) throw new Error(`classe « ${nom} » absente`);
  return c;
}
function competenceNom(id: string): string | undefined {
  return snapshot.tables.competences.find((c) => c.id === id)?.nom;
}
function religionId(index = 0): string {
  return snapshot.tables.religions[index].id;
}

function etat(p: Partial<EtatCreationVisiteur> = {}): EtatCreationVisiteur {
  return { raceId: null, classeId: null, competencesAcquises: [], ...p };
}

describe("appliquerGratuites — classe manquante", () => {
  it("classe nulle → erreur classe_manquante, état inchangé", () => {
    const e = etat();
    const r = appliquerGratuites(snapshot, e);
    expect(r.erreurs).toEqual([
      { code: "classe_manquante", message: "Le personnage n'a pas de classe." },
    ]);
    expect(r.etat).toBe(e);
  });
});

describe("appliquerGratuites — 4 classes réelles", () => {
  for (const nom of ["Guerrier", "Voleur", "Mage", "Prêtre"]) {
    it(`${nom} : attribue toutes les gratuités sans type_choix, avec choix requis fournis`, () => {
      const cl = classe(nom);
      const defs = cl.competences_gratuites as Array<{
        competence_id: string;
        niveau: number;
      }>;

      // Fournir un choix pour chaque gratuité à type_choix non-null.
      const choix: Record<string, string> = {};
      for (const g of defs) {
        const comp = snapshot.tables.competences.find(
          (c) => c.id === g.competence_id
        )!;
        if (comp.type_choix != null) {
          choix[g.competence_id] =
            comp.type_choix === "religion" ? religionId() : "FIXTURE-CHOIX";
        }
      }

      const r = appliquerGratuites(snapshot, etat({ classeId: cl.id }), choix);
      expect(r.erreurs).toEqual([]);
      // Chaque gratuité de la classe est présente au bon niveau, xp_depense 0.
      for (const g of defs) {
        const item = r.etat.competencesAcquises.find(
          (c) => c.competenceId === g.competence_id && c.niveauAcquis === g.niveau
        );
        expect(item, `${nom} → ${competenceNom(g.competence_id)}`).toBeDefined();
        expect(item!.xpDepense).toBe(0);
        expect(item!.statutMaitre).toBe("non_requis");
        expect(item!.apprisViaMaitre).toBe(false);
      }
      expect(r.etat.competencesAcquises.length).toBe(defs.length);
    });
  }
});

describe("appliquerGratuites — type_choix religion (Prêtre)", () => {
  const cl = classe("Prêtre");
  const defReligion = (cl.competences_gratuites as Array<{
    competence_id: string;
    niveau: number;
  }>).find((g) => {
    const c = snapshot.tables.competences.find((x) => x.id === g.competence_id);
    return c?.type_choix === "religion";
  })!;

  it("sans choix ET sans religion → erreur choix_manquant (format SQL)", () => {
    const r = appliquerGratuites(snapshot, etat({ classeId: cl.id }));
    const nom = competenceNom(defReligion.competence_id);
    expect(r.erreurs).toContainEqual({
      code: "choix_manquant",
      message: `Un choix de type "religion" est obligatoire pour ${nom}`,
    });
  });

  it("choix religion explicite → l'état adopte la religion (religionId, estCroyant)", () => {
    const rid = religionId(1);
    const r = appliquerGratuites(snapshot, etat({ classeId: cl.id }), {
      [defReligion.competence_id]: rid,
    });
    expect(r.etat.religionId).toBe(rid);
    expect(r.etat.estCroyant).toBe(true);
    const item = r.etat.competencesAcquises.find(
      (c) => c.competenceId === defReligion.competence_id
    );
    expect(item!.choixAchat).toBe(rid);
  });

  it("fallback religion : religionId présent dans l'état, aucun choix fourni", () => {
    const rid = religionId(0);
    const r = appliquerGratuites(
      snapshot,
      etat({ classeId: cl.id, religionId: rid, estCroyant: true })
    );
    // Pas d'erreur choix_manquant : la religion de l'état sert de choix.
    expect(r.erreurs.some((e) => e.code === "choix_manquant")).toBe(false);
    const item = r.etat.competencesAcquises.find(
      (c) => c.competenceId === defReligion.competence_id
    );
    expect(item!.choixAchat).toBe(rid);
  });
});

describe("appliquerGratuites — idempotence & purge implicite", () => {
  it("double application → aucun doublon", () => {
    const cl = classe("Guerrier");
    const r1 = appliquerGratuites(snapshot, etat({ classeId: cl.id }));
    const r2 = appliquerGratuites(snapshot, r1.etat);
    expect(r2.etat.competencesAcquises.length).toBe(
      r1.etat.competencesAcquises.length
    );
  });

  it("changement de classe → purge des gratuités obsolètes (recompute)", () => {
    const guerrier = classe("Guerrier");
    const voleur = classe("Voleur");
    const r1 = appliquerGratuites(snapshot, etat({ classeId: guerrier.id }));
    // On rebranche l'état sur la classe Voleur puis on ré-applique.
    const r2 = appliquerGratuites(
      snapshot,
      { ...r1.etat, classeId: voleur.id }
    );
    const idsVoleur = (voleur.competences_gratuites as Array<{
      competence_id: string;
    }>).map((g) => g.competence_id);
    // Aucune gratuité guerrier ne subsiste ; seules celles du Voleur sont là.
    for (const c of r2.etat.competencesAcquises) {
      expect(idsVoleur).toContain(c.competenceId);
    }
    expect(r2.etat.competencesAcquises.length).toBe(idsVoleur.length);
  });

  it("un achat PAYANT (xp_depense > 0) survit au recompute des gratuités", () => {
    const cl = classe("Guerrier");
    const payant = {
      competenceId: "achat-payant-x",
      niveauAcquis: 1,
      choixAchat: null,
      xpDepense: 9,
    };
    const r = appliquerGratuites(
      snapshot,
      etat({ classeId: cl.id, competencesAcquises: [payant] })
    );
    expect(r.etat.competencesAcquises).toContainEqual(payant);
  });
});

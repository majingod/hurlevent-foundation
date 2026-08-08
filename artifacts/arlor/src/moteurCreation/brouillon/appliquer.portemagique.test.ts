/**
 * D54 (s382) — attestation du miroir OFFLINE de `tg_poser_porte_magique`
 * (migration 20260808062934) dans `appliquerAchatCompetence`.
 *
 * Assertions demandées par le prompt s382, portées ici sur le CHEMIN VISITEUR
 * (le chemin serveur est le trigger SQL lui-même, déjà mesuré en base par
 * l'auteur du prompt — cf. commentaire de la migration) :
 *  1. Face positive — acheter « Acquisition de Cercle » pose « Acquisition de
 *     Sort ».
 *  2. Face jumelle, idempotence — un deuxième achat de Cercle laisse
 *     exactement UNE ligne « Acquisition de Sort ».
 *  3. Le pendant prêtre — Domaine → Prière.
 *
 * Preuve par le contraire (assertion 5) : en commentant l'appel à
 * `poserPorteMagiqueSiNecessaire` dans `appliquerAchatCompetence`, les tests
 * 1/2/3 ci-dessous rougissent (vérifié manuellement — cf. rapport de PR) :
 * sans le miroir, un visiteur qui achète un Cercle n'obtient pas la porte,
 * exactement le bug que B.4 corrige.
 */

import { describe, it, expect } from "vitest";
import { getSnapshot } from "../snapshot";
import { creerBrouillonVide } from "./types";
import { appliquerAchatCompetence } from "./appliquer";

const snapshot = getSnapshot();

function idComp(nom: string, categorie: string): string {
  const c = snapshot.tables.competences.find(
    (c) => c.nom === nom && c.categorie === categorie,
  );
  if (!c) throw new Error(`Compétence introuvable en snapshot : ${nom} (${categorie})`);
  return c.id;
}

const COMP_CERCLE = idComp("Acquisition de Cercle", "mage");
const COMP_SORT = idComp("Acquisition de Sort", "mage");
const COMP_DOMAINE = idComp("Acquisition de Domaine", "pretre");
const COMP_PRIERE = idComp("Acquisition de Prière", "pretre");

describe("appliquerAchatCompetence — miroir offline de tg_poser_porte_magique (D54, s382)", () => {
  it("face positive : acheter Cercle pose Sort (0 → 1)", () => {
    const b = appliquerAchatCompetence(creerBrouillonVide(), {
      competenceId: COMP_CERCLE,
      niveauDesire: 1,
      choixAchat: "Feu",
    });
    const sorts = b.acquisitions.competences.filter(
      (c) => c.competenceId === COMP_SORT,
    );
    expect(sorts).toHaveLength(1);
    expect(sorts[0]).toMatchObject({
      competenceId: COMP_SORT,
      niveauAcquis: 1,
      choixAchat: null,
    });
    // La ligne Cercle elle-même reste présente, intacte.
    expect(
      b.acquisitions.competences.some((c) => c.competenceId === COMP_CERCLE),
    ).toBe(true);
  });

  it("face jumelle, idempotence : un deuxième achat de Cercle laisse EXACTEMENT 1 ligne Sort", () => {
    let b = appliquerAchatCompetence(creerBrouillonVide(), {
      competenceId: COMP_CERCLE,
      niveauDesire: 1,
      choixAchat: "Feu",
    });
    // Deuxième achat de Cercle (aucune contrainte UNIQUE côté serveur non plus).
    b = appliquerAchatCompetence(b, {
      competenceId: COMP_CERCLE,
      niveauDesire: 2,
      choixAchat: "Feu",
    });
    const cercles = b.acquisitions.competences.filter(
      (c) => c.competenceId === COMP_CERCLE,
    );
    const sorts = b.acquisitions.competences.filter(
      (c) => c.competenceId === COMP_SORT,
    );
    expect(cercles).toHaveLength(2); // le double achat de Cercle, lui, N'EST PAS dédupliqué
    expect(sorts).toHaveLength(1); // la porte, elle, reste posée UNE seule fois
  });

  it("le pendant prêtre : acheter Domaine pose Prière (0 → 1)", () => {
    const b = appliquerAchatCompetence(creerBrouillonVide(), {
      competenceId: COMP_DOMAINE,
      niveauDesire: 1,
      choixAchat: null,
    });
    const prieres = b.acquisitions.competences.filter(
      (c) => c.competenceId === COMP_PRIERE,
    );
    expect(prieres).toHaveLength(1);
    expect(prieres[0]).toMatchObject({
      competenceId: COMP_PRIERE,
      niveauAcquis: 1,
      choixAchat: null,
    });
  });

  it("achat d'une compétence hors périmètre (ni Cercle ni Domaine) : aucune porte posée", () => {
    const b = appliquerAchatCompetence(creerBrouillonVide(), {
      competenceId: COMP_SORT, // achat direct de la porte elle-même (cas dégénéré)
      niveauDesire: 1,
      choixAchat: null,
    });
    // Pas de récursion : acheter « Acquisition de Sort » ne pose rien d'autre.
    expect(b.acquisitions.competences).toHaveLength(1);
  });
});

/**
 * PARITÉ ENREGISTRÉE — le moteur client doit reproduire, AU CARACTÈRE PRÈS,
 * les 110 verdicts de `public.peut_acheter_competence` capturés en prod sur les
 * fiches du profil de test ZZ-Fixtures (fixtures figées, aucun joueur réel).
 *
 * 100 % hors ligne : aucune requête réseau. Le client lit le snapshot bundlé
 * (src/data/snapshotVisiteur.json).
 *
 * ⚠️ CE SNAPSHOT N'EST PAS LA BASE, et cette nuance a coûté six semaines de vert
 * à vide (s399). Il a été capturé le 2026-07-03 ; il porte désormais
 * `competences.exige_ps`, posée par le patch de s399 — sans quoi la garde
 * d'inaptitude de `gatesCompetences.ts:44` était INERTE ici et 21 divergences
 * dormaient. Il lui manque encore 9 tables et `parametres_jeu.
 * cgu_version_en_vigueur` : voir [SNAPSHOT-COMMITTE-PERIME]. ⛔ Ne jamais écrire
 * que ce fichier dit « le même contenu que la RPC » — mesurer avant d'affirmer.
 *
 * Règle d'or : on NE corrige PAS le serveur, on le REPRODUIT — y compris ses
 * pièges connus (ex. « Vous devez d'abord acquérir le niveau 4 » non plafonné,
 * guillemets droits façon SQL `format('"%s"', …)`). Un écart = échec avec dump,
 * jamais une fixture retouchée.
 */

import { describe, it, expect } from "vitest";
import { peutAcheterCompetence } from "./gatesCompetences";
import type {
  ContextePersonnage,
  DemandeAchatCompetence,
} from "./types";
import fixtures from "./fixtures/pariteCompetences.json";

// ------------------------------------------------------------
// Types des fixtures (contrat serveur, snake_case)
// ------------------------------------------------------------
interface FixtureAcquis {
  competence_id: string;
  competence_nom: string;
  categorie: string | null;
  niveau_acquis: number;
  choix_achat: string | null;
}
interface FixtureContexte {
  ref: number;
  classe_nom: "Guerrier" | "Voleur" | "Mage" | "Prêtre" | null;
  race_id: string;
  race_inapte_magie: boolean;
  xp_dispo: number;
  ps_max: number;
  competences_acquises: FixtureAcquis[];
}
interface FixtureVerdict {
  peut_acheter: boolean;
  raison: string;
  cout_xp?: number;
  necessite_maitre?: boolean;
  niveau_actuel?: number;
  niveau_desire?: number;
  type_achat?: string;
  type_choix?: string | null;
  verrouillage_croise?: boolean;
}
interface FixtureCas {
  ctx: number;
  demande: {
    competence_id: string;
    competence_nom: string;
    niveau_desire: number;
    choix_achat: string | null;
  };
  verdict: FixtureVerdict;
}
interface FixturesFile {
  genere_le: string;
  nb_contextes: number;
  nb_cas: number;
  contextes: FixtureContexte[];
  cas: FixtureCas[];
}

const data = fixtures as unknown as FixturesFile;

const contexteParRef = new Map<number, FixtureContexte>(
  data.contextes.map((c) => [c.ref, c])
);

function toContexte(ctx: FixtureContexte): ContextePersonnage {
  return {
    classeNom: ctx.classe_nom,
    // s370 : le champ dit désormais l'INSTANCE. Les 4 contextes capturés
    // portent tous race_inapte_magie=false, donc la parité est inchangée —
    // ce que la suite PROUVE en s'exécutant, elle n'est pas déduite.
    inapteMagie: ctx.race_inapte_magie,
    xpDispo: ctx.xp_dispo,
    psMax: ctx.ps_max,
    competencesAcquises: ctx.competences_acquises.map((a) => ({
      competenceId: a.competence_id,
      competenceNom: a.competence_nom,
      categorie: a.categorie,
      niveauAcquis: a.niveau_acquis,
      choixAchat: a.choix_achat,
    })),
  };
}

function toDemande(cas: FixtureCas): DemandeAchatCompetence {
  return {
    competenceId: cas.demande.competence_id,
    niveauDesire: cas.demande.niveau_desire,
    choixAchat: cas.demande.choix_achat,
  };
}

describe("parité enregistrée peut_acheter_competence (88 cas)", () => {
  it("les fixtures sont cohérentes (nb_cas === cas.length === 88)", () => {
    expect(data.cas.length).toBe(data.nb_cas);
    expect(data.cas.length).toBe(110);
    expect(data.contextes.length).toBe(data.nb_contextes);
  });

  data.cas.forEach((cas, i) => {
    const ctx = contexteParRef.get(cas.ctx);
    const label = `#${i + 1} ctx${cas.ctx} « ${cas.demande.competence_nom} » niv ${cas.demande.niveau_desire}`;

    it(label, () => {
      expect(ctx, `contexte ref ${cas.ctx} introuvable`).toBeDefined();
      const contexte = toContexte(ctx!);
      const demande = toDemande(cas);
      const client = peutAcheterCompetence(contexte, demande);
      const serveur = cas.verdict;

      // Dump complet en cas d'écart, pour diagnostic.
      const dump = JSON.stringify(
        { ctx, demande: cas.demande, verdictClient: client, verdictServeur: serveur },
        null,
        2
      );

      // peut_acheter + raison : STRICTS (raison au caractère près).
      expect(client.peutAcheter, `peut_acheter\n${dump}`).toBe(serveur.peut_acheter);
      expect(client.raison, `raison\n${dump}`).toBe(serveur.raison);

      // Champs optionnels : comparés seulement s'ils sont présents côté serveur.
      if (serveur.cout_xp !== undefined) {
        expect(client.coutXp, `cout_xp\n${dump}`).toBe(serveur.cout_xp);
      }
      if (serveur.necessite_maitre !== undefined) {
        expect(client.necessiteMaitre, `necessite_maitre\n${dump}`).toBe(
          serveur.necessite_maitre
        );
      }
      if (serveur.niveau_actuel !== undefined) {
        expect(client.niveauActuel, `niveau_actuel\n${dump}`).toBe(
          serveur.niveau_actuel
        );
      }
      if (serveur.niveau_desire !== undefined) {
        expect(client.niveauDesire, `niveau_desire\n${dump}`).toBe(
          serveur.niveau_desire
        );
      }
      if (serveur.type_achat !== undefined) {
        expect(client.typeAchat, `type_achat\n${dump}`).toBe(serveur.type_achat);
      }
      if (serveur.type_choix !== undefined) {
        expect(client.typeChoix, `type_choix\n${dump}`).toBe(serveur.type_choix);
      }
      if (serveur.verrouillage_croise !== undefined) {
        expect(client.verrouillageCroise, `verrouillage_croise\n${dump}`).toBe(
          serveur.verrouillage_croise
        );
      }
    });
  });
});

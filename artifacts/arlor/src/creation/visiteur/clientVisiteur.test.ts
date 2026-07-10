/**
 * Tests de `clientVisiteur` (P2-a3-ii) — chemin RÉEL (déririvation `deriverEtat`,
 * sans couture) :
 *   §D.2 cycle de vie : par étape, cas passant + chaque validation portée VERBATIM
 *        (message attendu = celui du SQL, migration citée en commentaire) ;
 *   §D.3 wizard complet simulé : demarrer → étapes 1-4 → achats multi-familles →
 *        validerPersonnageFinal → rechargement localStorage → état intact (deep-equal) ;
 *   §D.4 verifierPrerequisCompetences : « classe manquante » → pastille rouge, sans
 *        réduire niveau_max_achetable ;
 *   + cas de bout-en-bout non stubés (XP insuffisant, prérequis manquant, artisanat)
 *     prouvant que la VRAIE dérivation alimente le même chemin que le harnais stubé.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clientVisiteur, PERSONNAGE_LOCAL_ID } from "./clientVisiteur";
import { chargerBrouillon, sauverBrouillon, CLE_BROUILLON } from "./stockageBrouillon";
import { getSnapshot } from "@/moteurCreation/snapshot";
import { deriverEtat } from "@/moteurCreation/brouillon/deriver";

// ── localStorage stub (config vitest = node) ──
function installerLocalStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

// ── Ancres réelles (ids résolus depuis le snapshot bundlé) ──
const snap = getSnapshot();
const idClasse = (nom: string) => snap.tables.classes.find((c) => c.nom === nom)!.id;
const idRace = (nom: string) => snap.tables.races.find((r) => r.nom === nom)!.id;

const CLASSE_GUERRIER = idClasse("Guerrier");
const CLASSE_PRETRE = idClasse("Prêtre");
const CLASSE_VOLEUR = idClasse("Voleur");
const RACE_HUMAIN = idRace("Humain");
const RACE_CHIMERIDE = idRace("Chiméride");

const RELIGION = "0d412540-c3f0-48e3-9c49-97a8cbc4701f"; // Les Ecclésias d'Acarthas
const TRAIT_HUMAIN = "4675941e-481c-410d-a14f-9c2672d219ba"; // Coup du destin (10 XP)
const TRAIT_HUMAIN2 = "fad7ba5d-df90-4f24-88b4-987eb9a4891f"; // Fortuné (10 XP)
const COMP_BOTTE = "04cadb85-598c-4dbf-b982-3b5f9d5736f2"; // Botte Secrète (guerrier, niv1 9)
const COMP_PIEGE = "5b82c487-dd4c-48cb-a472-255019bbe835"; // Création et désarmement de piège (11)
const COMP_MEDITATION = "087b2e9c-3995-496f-855b-5851de176c98"; // Méditation (général, 10)
const COMP_PIEGE_SECURISE = "1427677e-98fd-4ba5-86ca-3145fc4aa178"; // prereq: piège niv1
const COMP_BOUCLIER_MOYEN = "05529f8e-0743-4573-bbb9-bad8358e9bd8"; // classes_requises guerrier/pretre
const PIEGE_NIV1 = "15700b76-94ef-4c15-ba73-e105e315b6f2"; // Piège brise-doigts (niv1)
const ASSEMBLAGE = "073c3517-e1ba-4172-9e18-37d7975c2a92";

const nul = null as unknown as string; // p_religion_id est typé `string` (codegen)

interface Env {
  succes: boolean;
  erreurs: Array<{ code?: string; message: string; champ?: string }>;
  avertissements: Array<{ code?: string; message: string }>;
  donnees: Record<string, unknown> | null;
}
const env = (data: unknown) => data as Env;

beforeEach(() => {
  installerLocalStorage();
});

async function demarrer() {
  return clientVisiteur.demarrerCreationPersonnage({});
}

// ============================================================
// §D.2 — Cycle de vie : étape 1 (valider_etape_1, baseline — VERBATIM)
// ============================================================
describe("cycle de vie — sauvegarderEtape1", () => {
  const base = {
    p_personnage_id: PERSONNAGE_LOCAL_ID,
    p_gn_completes: 0,
    p_mini_gn_completes: 0,
    p_ouvertures_terrain: 0,
  };

  it("cas passant → succès, avance en étape 2", async () => {
    await demarrer();
    const r = env(
      (await clientVisiteur.sauvegarderEtape1({ ...base, p_nom: "Aldric", p_est_croyant: false, p_religion_id: nul })).data,
    );
    expect(r.succes).toBe(true);
    expect(r.donnees?.etape_creation_apres).toBe(2);
  });

  it("nom_manquant", async () => {
    await demarrer();
    const r = env((await clientVisiteur.sauvegarderEtape1({ ...base, p_nom: "", p_est_croyant: false, p_religion_id: nul })).data);
    expect(r.succes).toBe(false);
    expect(r.erreurs[0].message).toBe("Le nom du personnage est obligatoire");
  });

  it("nom_trop_court", async () => {
    await demarrer();
    const r = env((await clientVisiteur.sauvegarderEtape1({ ...base, p_nom: "A", p_est_croyant: false, p_religion_id: nul })).data);
    expect(r.erreurs[0].message).toBe("Le nom doit contenir au moins 2 caractères");
  });

  it("religion_manquante", async () => {
    await demarrer();
    const r = env((await clientVisiteur.sauvegarderEtape1({ ...base, p_nom: "Aldric", p_est_croyant: true, p_religion_id: nul })).data);
    expect(r.erreurs[0].message).toBe("Un personnage croyant doit avoir une religion");
  });

  it("religion_incoherente", async () => {
    await demarrer();
    const r = env((await clientVisiteur.sauvegarderEtape1({ ...base, p_nom: "Aldric", p_est_croyant: false, p_religion_id: RELIGION })).data);
    expect(r.erreurs[0].message).toBe("Un personnage non-croyant ne doit pas avoir de religion");
  });

  it("gn_completes_negatif", async () => {
    await demarrer();
    const r = env((await clientVisiteur.sauvegarderEtape1({ ...base, p_gn_completes: -1, p_nom: "Aldric", p_est_croyant: false, p_religion_id: nul })).data);
    expect(r.erreurs[0].message).toBe("Le nombre de GN complétés ne peut pas être négatif");
  });
});

// ============================================================
// §D.2 — étape 2 (valider_etape_2, baseline — VERBATIM)
// ============================================================
describe("cycle de vie — sauvegarderEtape2", () => {
  it("race_manquante", async () => {
    await demarrer();
    const r = env((await clientVisiteur.sauvegarderEtape2({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_race_id: "" })).data);
    expect(r.erreurs[0].message).toBe("La race est obligatoire");
  });

  it("sous_type_chimeride_manquant", async () => {
    await demarrer();
    const r = env((await clientVisiteur.sauvegarderEtape2({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_race_id: RACE_CHIMERIDE })).data);
    expect(r.erreurs[0].message).toBe("Un Chiméride doit avoir un sous-type (carnivore ou herbivore)");
  });

  it("sous_type_chimeride_invalide_pour_race", async () => {
    await demarrer();
    const r = env((await clientVisiteur.sauvegarderEtape2({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_race_id: RACE_HUMAIN, p_sous_type_chimeride: "carnivore" })).data);
    expect(r.erreurs[0].message).toBe("Seuls les Chimérides ont un sous-type");
  });
});

// ============================================================
// §D.2 — étape 3 (valider_etape_3, baseline — VERBATIM)
// ============================================================
describe("cycle de vie — sauvegarderEtape3", () => {
  async function jusquEtape3(race = RACE_HUMAIN) {
    await demarrer();
    await clientVisiteur.sauvegarderEtape1({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_nom: "Aldric", p_gn_completes: 0, p_mini_gn_completes: 0, p_ouvertures_terrain: 0, p_est_croyant: false, p_religion_id: nul });
    await clientVisiteur.sauvegarderEtape2({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_race_id: race });
  }

  it("race_manquante (avant sélection de race)", async () => {
    await demarrer(); // race non renseignée
    const r = env((await clientVisiteur.sauvegarderEtape3({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_traits_raciaux_choisis: [] })).data);
    expect(r.erreurs[0].message).toBe("Sélectionnez une race avant de choisir des traits");
  });

  it("traits_gratuits_quota_incorrect (0 au lieu de 1)", async () => {
    await jusquEtape3();
    const r = env((await clientVisiteur.sauvegarderEtape3({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_traits_raciaux_choisis: [] })).data);
    expect(r.erreurs[0].message).toBe("Vous devez choisir exactement 1 trait(s) gratuit(s), pas 0");
  });

  it("traits_doublon", async () => {
    await jusquEtape3();
    const traits = [
      { trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 },
      { trait_id: TRAIT_HUMAIN, est_gratuit: false, xp_depense: 10 },
    ];
    const r = env((await clientVisiteur.sauvegarderEtape3({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_traits_raciaux_choisis: traits })).data);
    expect(r.erreurs[0].message).toBe("Un même trait apparaît plusieurs fois");
  });

  it("trait_invalide_pour_race", async () => {
    await jusquEtape3();
    const traits = [{ trait_id: "00000000-0000-0000-0000-000000000000", est_gratuit: true, xp_depense: 0 }];
    const r = env((await clientVisiteur.sauvegarderEtape3({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_traits_raciaux_choisis: traits })).data);
    expect(r.erreurs[0].message).toBe("Le trait 00000000-0000-0000-0000-000000000000 n'est pas accessible à cette race");
  });

  it("trait_gratuit_xp_non_nul", async () => {
    await jusquEtape3();
    const traits = [{ trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 5 }];
    const r = env((await clientVisiteur.sauvegarderEtape3({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_traits_raciaux_choisis: traits })).data);
    expect(r.erreurs[0].message).toBe(`Le trait ${TRAIT_HUMAIN} est gratuit mais a un xp_depense non nul`);
  });

  it("trait_payant_xp_incorrect", async () => {
    await jusquEtape3();
    const traits = [
      { trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 },
      { trait_id: TRAIT_HUMAIN2, est_gratuit: false, xp_depense: 999 },
    ];
    const r = env((await clientVisiteur.sauvegarderEtape3({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_traits_raciaux_choisis: traits })).data);
    expect(r.erreurs[0].message).toBe(`Le trait ${TRAIT_HUMAIN2} coûte 10 XP, pas 999`);
  });
});

// ============================================================
// §D.2 — étape 4 (valider_etape_4, baseline — VERBATIM)
// ============================================================
describe("cycle de vie — sauvegarderEtape4", () => {
  it("classe_manquante", async () => {
    await demarrer();
    const r = env((await clientVisiteur.sauvegarderEtape4({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: "" })).data);
    expect(r.erreurs[0].message).toBe("La classe est obligatoire");
  });

  it("classe_introuvable", async () => {
    await demarrer();
    const r = env((await clientVisiteur.sauvegarderEtape4({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: "00000000-0000-0000-0000-000000000000" })).data);
    expect(r.erreurs[0].message).toBe("La classe sélectionnée n'existe pas");
  });

  it("choix_manquant (gratuité de classe à type_choix)", async () => {
    await demarrer();
    // Prêtre a une gratuité « Connaissances des Religions » (type_choix = religion).
    const r = env((await clientVisiteur.sauvegarderEtape4({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: CLASSE_PRETRE })).data);
    expect(r.erreurs[0].message).toBe("Choix de religion manquant pour Connaissances des Religions");
  });
});

// ============================================================
// §D.2 — sauvegarderEtape4, branche CHANGEMENT DE CLASSE (s322) — repro Fred.
// Miroir client de `attribuer_competences_gratuites_classe` appelée après la
// cascade (migrations 20260710163901/163941/164108) : source unique de
// « gratuite + choix + religion », comme la branche non-changement ci-dessus.
// ============================================================
describe("cycle de vie — sauvegarderEtape4 (changement de classe, s322)", () => {
  const CLASSE_MAGE = idClasse("Mage");
  const DECRYPTAGE = "0b0fba09-77d5-4078-946f-9add150f695d"; // Mage, gratuité type_choix=langue_ancienne
  const LANGUE_A = "073762ec-4a6a-4767-85ba-2adf33c9679d"; // L'Ancien Commun
  const ACQ_CERCLE = "9fc3a181-4e29-4d94-8639-65b9a9a7c787"; // Mage, prereq Linguistique (gratuité Mage)
  const ACQ_SORT = "d9a446cc-abdd-40d1-be68-42240b7c9bae"; // Mage, prereq Acquisition de Cercle, niv1 = 0 XP
  const CONNAISSANCES_RELIGIONS = "c821b270-d314-4092-9899-2fd80925e873"; // Prêtre, gratuité type_choix=religion

  async function jusquGuerrier() {
    await demarrer();
    await clientVisiteur.sauvegarderEtape4({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: CLASSE_GUERRIER });
  }

  it("repro Fred (s322) : Guerrier → Mage avec choix de langue → succès, gratuité Décryptage posée au bon choix", async () => {
    await jusquGuerrier();
    const r = env(
      (
        await clientVisiteur.sauvegarderEtape4({
          p_personnage_id: PERSONNAGE_LOCAL_ID,
          p_classe_id: CLASSE_MAGE,
          p_choix_par_competence: { [DECRYPTAGE]: LANGUE_A },
        })
      ).data,
    );
    expect(r.succes).toBe(true);
    const apres = chargerBrouillon()!;
    const grat = deriverEtat(apres).gratuites.find((g) => g.competenceId === DECRYPTAGE);
    expect(grat).toBeDefined();
    expect(grat?.choixAchat).toBe(LANGUE_A);
  });

  it("repro Fred (s322), sans choix : choix_manquant (attribuer_competences_gratuites_classe, source unique)", async () => {
    await jusquGuerrier();
    const r = env(
      (
        await clientVisiteur.sauvegarderEtape4({
          p_personnage_id: PERSONNAGE_LOCAL_ID,
          p_classe_id: CLASSE_MAGE,
          p_choix_par_competence: {},
        })
      ).data,
    );
    expect(r.succes).toBe(false);
    expect(r.erreurs[0]).toEqual({
      code: "choix_manquant",
      message: 'Un choix de type "langue_ancienne" est obligatoire pour Décryptage',
      champ: "choix_par_competence",
    });
  });

  it("protection des achats à 0 XP (volet serveur s311-A) : Acquisition de Sort survit au changement de classe", async () => {
    await jusquGuerrier();
    const avant = chargerBrouillon()!;
    sauverBrouillon({
      ...avant,
      acquisitions: {
        ...avant.acquisitions,
        competences: [
          ...avant.acquisitions.competences,
          { instanceId: "iid-test-acq-cercle", competenceId: ACQ_CERCLE, niveauAcquis: 1, choixAchat: "Terre" },
          { instanceId: "iid-test-acq-sort", competenceId: ACQ_SORT, niveauAcquis: 1, choixAchat: null },
        ],
      },
    });

    const r = env(
      (
        await clientVisiteur.sauvegarderEtape4({
          p_personnage_id: PERSONNAGE_LOCAL_ID,
          p_classe_id: CLASSE_MAGE,
          p_choix_par_competence: { [DECRYPTAGE]: LANGUE_A },
        })
      ).data,
    );
    expect(r.succes).toBe(true);
    const apres = chargerBrouillon()!;
    expect(apres.acquisitions.competences.some((c) => c.instanceId === "iid-test-acq-sort")).toBe(true);
  });

  it("religion (Prêtre) : gratuité posée, religionId/estCroyant synchronisés (miroir B2)", async () => {
    await jusquGuerrier();
    const r = env(
      (
        await clientVisiteur.sauvegarderEtape4({
          p_personnage_id: PERSONNAGE_LOCAL_ID,
          p_classe_id: CLASSE_PRETRE,
          p_choix_par_competence: { [CONNAISSANCES_RELIGIONS]: RELIGION },
        })
      ).data,
    );
    expect(r.succes).toBe(true);
    const apres = chargerBrouillon()!;
    const etat = deriverEtat(apres);
    const grat = etat.gratuites.find((g) => g.competenceId === CONNAISSANCES_RELIGIONS);
    expect(grat).toBeDefined();
    expect(grat?.choixAchat).toBe(RELIGION);
    expect(etat.contexteMagie.religionId).toBe(RELIGION);
  });
});

// ============================================================
// §D.2 — avancer_etape (migration 20260520213653) & corrigerXp
// ============================================================
describe("cycle de vie — avancerEtape & corrigerXp", () => {
  it("etape_invalide hors 5..9", async () => {
    await demarrer();
    const r = env((await clientVisiteur.avancerEtape({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_etape_courante: 4 })).data);
    expect(r.erreurs[0].message).toBe("avancer_etape ne couvre que les etapes 5 a 9.");
  });

  it("étape 5 sans compétence payante → avertissement, valide", async () => {
    await demarrer();
    // Positionne le brouillon en étape 5.
    await clientVisiteur.sauvegarderEtape1({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_nom: "Aldric", p_gn_completes: 0, p_mini_gn_completes: 0, p_ouvertures_terrain: 0, p_est_croyant: false, p_religion_id: nul });
    await clientVisiteur.sauvegarderEtape2({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_race_id: RACE_HUMAIN });
    await clientVisiteur.sauvegarderEtape3({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_traits_raciaux_choisis: [{ trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 }] });
    await clientVisiteur.sauvegarderEtape4({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: CLASSE_GUERRIER });
    const r = env((await clientVisiteur.avancerEtape({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_etape_courante: 5 })).data);
    expect(r.succes).toBe(true);
    expect(r.avertissements[0].message).toBe("Vous n'avez acheté aucune compétence supplémentaire");
  });

  it("corrigerXp → refus poli INDISPONIBLE_VISITEUR", async () => {
    await demarrer();
    const r = env((await clientVisiteur.corrigerXpPersonnage({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_montant: 10 })).data);
    expect(r.succes).toBe(false);
    expect(r.erreurs[0].code).toBe("INDISPONIBLE_VISITEUR");
    expect(r.erreurs[0].message).toBe("Cette action nécessite un compte.");
  });
});

// ============================================================
// Cas de bout-en-bout NON STUBÉS (vraie dérivation deriverEtat)
// ============================================================
describe("bout-en-bout (dérivation réelle)", () => {
  async function brouillonGuerrierHumain() {
    await demarrer();
    await clientVisiteur.sauvegarderEtape1({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_nom: "Aldric", p_gn_completes: 0, p_mini_gn_completes: 0, p_ouvertures_terrain: 0, p_est_croyant: false, p_religion_id: nul });
    await clientVisiteur.sauvegarderEtape2({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_race_id: RACE_HUMAIN });
    await clientVisiteur.sauvegarderEtape3({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_traits_raciaux_choisis: [{ trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 }] });
    await clientVisiteur.sauvegarderEtape4({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: CLASSE_GUERRIER });
  }

  it("refus XP insuffisant (aucune race → 0 XP)", async () => {
    await demarrer(); // pas de race → xp_depart 0 → xpDispo 0
    const r = env((await clientVisiteur.acheterCompetence({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_MEDITATION, p_niveau_desire: 1 })).data);
    expect(r.succes).toBe(false);
    expect(r.erreurs[0].message).toBe("XP insuffisant. Requis : 10 | Disponible : 0");
  });

  it("refus prérequis manquant", async () => {
    await brouillonGuerrierHumain();
    const r = env((await clientVisiteur.acheterCompetence({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_PIEGE_SECURISE, p_niveau_desire: 1 })).data);
    expect(r.succes).toBe(false);
    expect(r.erreurs[0].message).toBe("Prérequis manquant(s) : Création et désarmement de piège niveau 1");
  });

  it("refus artisanat : compétence Assemblage de Runes requise", async () => {
    await brouillonGuerrierHumain();
    const r = env((await clientVisiteur.acheterAssemblage({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_assemblage_id: ASSEMBLAGE })).data);
    expect(r.succes).toBe(false);
    expect(r.erreurs[0].code).toBe("niveau_requis_non_atteint");
    expect(r.erreurs[0].message).toBe("Compétence Assemblage de Runes requise");
  });
});

// ============================================================
// §D.3 — Wizard complet simulé + rechargement localStorage
// ============================================================
describe("wizard complet simulé", () => {
  it("demarrer → étapes 1-4 → achats multi-familles → validerFinal → reload intact", async () => {
    await demarrer();
    await clientVisiteur.sauvegarderEtape1({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_nom: "Aldric", p_gn_completes: 0, p_mini_gn_completes: 0, p_ouvertures_terrain: 0, p_est_croyant: true, p_religion_id: RELIGION });
    await clientVisiteur.sauvegarderEtape2({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_race_id: RACE_HUMAIN });
    await clientVisiteur.sauvegarderEtape3({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_traits_raciaux_choisis: [{ trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 }] });
    await clientVisiteur.sauvegarderEtape4({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: CLASSE_GUERRIER });

    // Achats multi-familles : compétence + compétence artisanat + piège.
    expect(env((await clientVisiteur.acheterCompetence({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_BOTTE, p_niveau_desire: 1 })).data).succes).toBe(true);
    expect(env((await clientVisiteur.acheterCompetence({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_PIEGE, p_niveau_desire: 1 })).data).succes).toBe(true);
    expect(env((await clientVisiteur.acheterPiege({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_piege_id: PIEGE_NIV1 })).data).succes).toBe(true);

    // Finalisation.
    const fin = env((await clientVisiteur.validerPersonnageFinal({ p_personnage_id: PERSONNAGE_LOCAL_ID })).data);
    expect(fin.erreurs, JSON.stringify(fin.erreurs)).toEqual([]);
    expect((fin as unknown as { valide: boolean }).valide).toBe(true);

    // État persisté cohérent.
    const brouillon = chargerBrouillon()!;
    expect(brouillon.meta.etapeCourante).toBe(11);
    expect(brouillon.acquisitions.competences.map((c) => c.competenceId)).toEqual([COMP_BOTTE, COMP_PIEGE]);
    expect(brouillon.acquisitions.pieges.map((p) => p.piegeId)).toEqual([PIEGE_NIV1]);

    // Rechargement localStorage → deep-equal (aucune perte / mutation).
    const rechargé = JSON.parse(localStorage.getItem(CLE_BROUILLON)!);
    expect(rechargé).toEqual(brouillon);
  });
});

// ============================================================
// §D.4 — verifierPrerequisCompetences : pastille classe
// ============================================================
describe("verifierPrerequisCompetences — pastille classe (migration 20260706195514)", () => {
  it("classe manquante → pastille présente, niveau_max_achetable NON réduit", async () => {
    await demarrer();
    // Classe Voleur : la compétence « Maniement du bouclier moyen » exige guerrier/pretre.
    await clientVisiteur.sauvegarderEtape4({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: CLASSE_VOLEUR, p_brouillon: true });

    const res = (await clientVisiteur.verifierPrerequisCompetences({ p_personnage_id: PERSONNAGE_LOCAL_ID })).data as Record<
      string,
      { niveau_max_achetable: number; raisons_par_niveau: Record<string, string>; prereqs_par_niveau: Record<string, Array<{ statut: string; competence_id: string | null }>> }
    >;

    const entree = res[COMP_BOUCLIER_MOYEN];
    expect(entree, "la compétence à classe requise doit figurer dans le résultat").toBeDefined();
    // Pastille rouge (classe manquante) au niveau 1, competence_id null.
    const pastille = entree.prereqs_par_niveau["1"].find((p) => p.competence_id === null);
    expect(pastille?.statut).toBe("manquant");
    // niveau_max_achetable NON réduit par la classe, et pas de raison de classe.
    expect(entree.niveau_max_achetable).toBe(3);
    expect(entree.raisons_par_niveau["1"]).toBeUndefined();
  });

  it("classe présente → pastille verte", async () => {
    await demarrer();
    await clientVisiteur.sauvegarderEtape4({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: CLASSE_GUERRIER, p_brouillon: true });
    const res = (await clientVisiteur.verifierPrerequisCompetences({ p_personnage_id: PERSONNAGE_LOCAL_ID })).data as Record<
      string,
      { prereqs_par_niveau: Record<string, Array<{ statut: string; competence_id: string | null }>> }
    >;
    const pastille = res[COMP_BOUCLIER_MOYEN]?.prereqs_par_niveau["1"]?.find((p) => p.competence_id === null);
    expect(pastille?.statut).toBe("acquis");
  });
});

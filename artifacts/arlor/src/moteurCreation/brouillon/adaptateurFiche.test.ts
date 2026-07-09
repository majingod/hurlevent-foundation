/**
 * Tests de l'adaptateur FICHE (HL-RECAP lot 3 s313).
 *
 * Un brouillon RICHE est construit avec les helpers existants (applicateurs) puis
 * lu À TRAVERS LE VRAI MOTEUR (`creerClientVisiteur()` + `deriverEtat`) — aucun id
 * ni coût inventé, tout vient du snapshot bundlé. Couvre ≥1 cas de CHAQUE famille :
 * race + 2 traits (1 gratuit, 1 payant) · classe avec gratuités · ≥1 compétence par
 * type_achat · 1 sort avec palier · 1 prière · 1 assemblage · 1 recette · piège
 * palier 2 · Forge niv 2 + Joaillerie niv 1 + Alchimie niv 1.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getSnapshot } from "../snapshot";
import { creerBrouillonVide, type BrouillonVisiteur } from "./types";
import { deriverEtat } from "./deriver";
import {
  appliquerEtape1,
  appliquerEtape2,
  appliquerEtape3,
  changerClasse,
  appliquerAchatCompetence,
  appliquerAchatSort,
  appliquerAchatPriere,
  appliquerAchatPiege,
  appliquerAchatRecette,
  appliquerAchatAssemblage,
} from "./appliquer";
import { calculerCoutXP } from "@/utils/calculsMagie";
import {
  creerClientVisiteur,
  PERSONNAGE_LOCAL_ID,
} from "@/creation/visiteur/clientVisiteur";
import { sauverBrouillon } from "@/creation/visiteur/stockageBrouillon";

const snapshot = getSnapshot();

// ── localStorage stub (config vitest = node), même pattern que pariteVisiteur.test ──
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

// ── Sélecteurs de catalogue (aucun id en dur) ──
function comp(nom: string) {
  const c = snapshot.tables.competences.find((x) => x.nom === nom);
  if (!c) throw new Error(`compétence « ${nom} » absente du snapshot`);
  return c;
}
function niveauxDe(nom: string): Array<{ niveau: number; cout_xp: number; description?: string | null; description_courte?: string | null }> {
  return (comp(nom).niveaux as never[]) ?? [];
}
function race(nom: string) {
  const r = snapshot.tables.races.find((x) => x.nom === nom);
  if (!r) throw new Error(`race « ${nom} » absente`);
  return r;
}
function classe(nom: string) {
  const c = snapshot.tables.classes.find((x) => x.nom === nom);
  if (!c) throw new Error(`classe « ${nom} » absente`);
  return c;
}
function traitsDeRace(raceId: string): string[] {
  const traitsActifs = new Set(
    snapshot.tables.traits_raciaux.filter((t) => t.est_actif !== false).map((t) => t.id),
  );
  return snapshot.tables.race_traits
    .filter((rt) => rt.race_id === raceId && rt.sous_type == null && traitsActifs.has(rt.trait_id))
    .map((rt) => rt.trait_id);
}
function premierSortAvecPalier() {
  const s = (snapshot.tables.sorts as Array<Record<string, unknown>>).find(
    (x) => x.est_actif === true && x.paliers != null,
  );
  if (!s) throw new Error("aucun sort avec palier");
  return s as { id: string; cercle: string; cout_xp_base: number };
}
function premierePriere() {
  const p = (snapshot.tables.prieres as Array<Record<string, unknown>>).find((x) => x.est_actif === true);
  if (!p) throw new Error("aucune prière");
  return p as { id: string; cout_xp_base: number };
}
function premierAssemblage() {
  const a = (snapshot.tables.assemblages_runes as Array<Record<string, unknown>>).find((x) => x.est_actif === true);
  if (!a) throw new Error("aucun assemblage");
  return a as { id: string; cout_xp: number };
}
function premiereRecette() {
  const r = (snapshot.tables.recettes_alchimie as Array<Record<string, unknown>>).find((x) => x.est_actif === true);
  if (!r) throw new Error("aucune recette");
  return r as { id: string };
}
function premierPiegeNiveau(niveau: number) {
  const p = (snapshot.tables.pieges as Array<Record<string, unknown>>).find(
    (x) => x.est_actif === true && x.niveau === niveau,
  );
  if (!p) throw new Error(`aucun piège niveau ${niveau}`);
  return p as { id: string };
}

const ZONE = "1 Cible";
const PORTEE = "Toucher";
const DUREE = "Instantanée";

// ── Brouillon RICHE (une famille de chaque) ──
function brouillonRiche(): BrouillonVisiteur {
  const rc = race("Myrvalk");
  const [trait0, trait1] = traitsDeRace(rc.id); // nb_traits_raciaux = 1 → t0 gratuit, t1 payant
  const sort = premierSortAvecPalier();
  const priere = premierePriere();
  const assemblage = premierAssemblage();
  const recette = premiereRecette();
  const piege2 = premierPiegeNiveau(2);
  const categorie = snapshot.tables.categories_creatures?.[0] as { id: string } | undefined;
  const langue = snapshot.tables.langues[0];

  let b = creerBrouillonVide();
  b = appliquerEtape1(b, {
    nom: "Recap Complet",
    gnCompletes: 2, // niveau attendu = 1 + 2 = 3
    miniGnCompletes: 1,
    ouverturesTerrain: 1,
    estCroyant: false,
    religionId: null,
    historique: "Un passé",
    amePersonnage: "Une âme",
  });
  b = appliquerEtape2(b, { raceId: rc.id });
  b = appliquerEtape3(b, {
    traitsRaciauxChoisis: [{ trait_id: trait0 }, { trait_id: trait1 }],
  });
  b = changerClasse(b, classe("Guerrier").id); // gratuités de classe

  // Artisanat → { alchimie:1, forge:2, joaillerie:1, pieges:2, runes:0 }
  b = appliquerAchatCompetence(b, { competenceId: comp("Alchimie").id, niveauDesire: 1, choixAchat: null });
  b = appliquerAchatCompetence(b, { competenceId: comp("Forge").id, niveauDesire: 2, choixAchat: null });
  b = appliquerAchatCompetence(b, { competenceId: comp("Joaillerie").id, niveauDesire: 1, choixAchat: null });
  b = appliquerAchatCompetence(b, {
    competenceId: comp("Création et désarmement de piège").id,
    niveauDesire: 2,
    choixAchat: null,
  });

  // Couverture des type_achat restants (simple déjà couvert par l'artisanat) :
  //   multiple_sans_choix / multiple_avec_choix_par_niveau / multiple_choix_distinct.
  b = appliquerAchatCompetence(b, {
    competenceId: comp("Développement Spirituel").id,
    niveauDesire: 1,
    choixAchat: null,
  });
  b = appliquerAchatCompetence(b, {
    competenceId: comp("Connaissances des Créatures").id,
    niveauDesire: 1,
    choixAchat: categorie?.id ?? "cat",
  });
  b = appliquerAchatCompetence(b, {
    competenceId: comp("Langue supplémentaire").id,
    niveauDesire: 1,
    choixAchat: langue.id,
  });

  // Magie + artisanat (items)
  b = appliquerAchatSort(b, {
    sortId: sort.id,
    niveauSort: 2,
    zoneChoisie: ZONE,
    porteeChoisie: PORTEE,
    dureeChoisie: DUREE,
  });
  b = appliquerAchatPriere(b, {
    priereId: priere.id,
    niveauPriere: 1,
    zoneChoisie: ZONE,
    porteeChoisie: PORTEE,
    dureeChoisie: DUREE,
  });
  b = appliquerAchatAssemblage(b, assemblage.id); // runes 0 → payant
  b = appliquerAchatRecette(b, recette.id);
  b = appliquerAchatPiege(b, piege2.id); // palier 2

  return b;
}

let b: BrouillonVisiteur;
let client: ReturnType<typeof creerClientVisiteur>;

beforeEach(() => {
  installerLocalStorage();
  b = brouillonRiche();
  sauverBrouillon(b);
  client = creerClientVisiteur(); // deriver = deriverEtat (vrai moteur)
});

// Helper : toutes les clés attendues sont présentes sur la ligne.
function attendreColonnes(row: Record<string, unknown>, colonnes: string[]) {
  for (const col of colonnes) expect(row).toHaveProperty(col);
}

// ============================================================
// 1. Parité structurelle — chaque forme-vue expose TOUTES les colonnes du SQL
// ============================================================

describe("parité structurelle (colonnes du SQL embarqué)", () => {
  it("vue_fiche_personnage", async () => {
    const { data } = await client.lireFichePersonnage(PERSONNAGE_LOCAL_ID);
    expect(data).not.toBeNull();
    attendreColonnes(data as Record<string, unknown>, [
      "id", "nom", "niveau", "xp_total", "xp_depense", "pv_max", "ps_max",
      "historique", "ame_personnage", "joueur_id", "race_id", "classe_id",
      "religion_id", "gn_completes", "mini_gn_completes", "ouvertures_terrain",
      "traits_raciaux_choisis", "est_actif", "est_mort", "race_nom",
      "race_nom_latin", "classe_nom", "religion_nom", "race_emoji",
      "race_description", "race_esperance_vie",
      "race_exigences_costume", "race_image_url", "classe_emoji",
      "classe_description", "classe_role_combat",
      "race_resume_condense", "classe_resume_condense",
    ]);
  });

  it("vue_competences_personnage", async () => {
    const { data } = await client.lireFicheCompetences(PERSONNAGE_LOCAL_ID);
    expect((data ?? []).length).toBeGreaterThan(0);
    attendreColonnes((data as Record<string, unknown>[])[0], [
      "id", "personnage_id", "niveau_acquis", "xp_depense", "choix_achat",
      "appris_via_maitre", "nom_maitre", "statut_maitre", "nom", "categorie",
      "competence_description", "description_niveau_acquis", "competence_id",
      "type_achat", "niveau_max", "competence_resume_condense",
      "description_courte_niveau_acquis",
    ]);
  });

  it("vue_sorts_personnage", async () => {
    const { data } = await client.lireFicheSorts(PERSONNAGE_LOCAL_ID);
    expect((data ?? []).length).toBe(1);
    attendreColonnes((data as Record<string, unknown>[])[0], [
      "id", "personnage_id", "nom_personnalise", "formule_magique", "niveau_sort",
      "zone_choisie", "portee_choisie", "duree_choisie", "cercle", "cout_xp_base",
      "sort_nom_base", "sort_description", "paliers",
      "description_tronc", "bonus_niveau", "effet_instance", "type_sort",
      "sort_resume_condense",
    ]);
  });

  it("vue_prieres_personnage", async () => {
    const { data } = await client.lireFichePrieres(PERSONNAGE_LOCAL_ID);
    expect((data ?? []).length).toBe(1);
    attendreColonnes((data as Record<string, unknown>[])[0], [
      "id", "personnage_id", "nom_personnalise", "niveau_priere", "zone_choisie",
      "portee_choisie", "duree_choisie", "domaine", "priere_description",
      "duree_incantation", "cout_xp_base",
      "duree_incantation_calculee", "paliers", "description_tronc", "bonus_niveau",
      "effet_instance", "type_priere", "priere_resume_condense",
    ]);
  });

  it("vue_assemblages_personnage", async () => {
    const { data } = await client.lireFicheAssemblages(PERSONNAGE_LOCAL_ID);
    expect((data ?? []).length).toBe(1);
    attendreColonnes((data as Record<string, unknown>[])[0], [
      "id", "personnage_id", "xp_depense", "nom", "cible", "cout_ps",
      "description", "effet", "runes_requises", "texte_manuel", "duree",
      "effet_maitrise", "cout_ps_maitrise", "resume_condense",
    ]);
  });

  it("personnage_recettes (fiche)", async () => {
    const { data } = await client.lireFicheRecettes(PERSONNAGE_LOCAL_ID);
    expect((data ?? []).length).toBe(1);
    const row = (data as Record<string, unknown>[])[0];
    attendreColonnes(row, ["id", "personnage_id", "xp_depense", "recettes_alchimie"]);
    attendreColonnes(row.recettes_alchimie as Record<string, unknown>, [
      "nom", "type", "niveau_requis", "description", "effet", "formule",
      "ingredients", "description_verbatim", "resume_condense",
    ]);
  });

  it("personnage_pieges (fiche)", async () => {
    const { data } = await client.lireFichePieges(PERSONNAGE_LOCAL_ID);
    expect((data ?? []).length).toBe(1);
    attendreColonnes((data as Record<string, unknown>[])[0], [
      "id", "personnage_id", "piege_id", "piege_nom", "niveau_acquis",
      "est_gratuit", "xp_depense", "date_acquisition", "created_at", "updated_at",
    ]);
  });

  it("catalogues (manipulations / forge / joaillerie / pièges / langues / religions)", async () => {
    const manip = await client.lireFicheManipulations(1);
    attendreColonnes((manip.data as Record<string, unknown>[])[0], ["id", "nom", "niveau", "manipulations"]);

    const forge = await client.lireFicheObjetsForge();
    attendreColonnes((forge.data as Record<string, unknown>[])[0], [
      "id", "nom", "description", "resume_condense", "type", "cout_xp",
      "temps_fabrication_minutes", "materiaux_communs", "materiaux_rares",
      "non_reparable", "reparation",
    ]);

    const joa = await client.lireFicheObjetsJoaillerie();
    attendreColonnes((joa.data as Record<string, unknown>[])[0], [
      "id", "nom", "description", "resume_condense", "effet", "cout_xp",
      "temps_fabrication_minutes", "temps_rare_minutes", "materiaux_communs",
      "materiaux_rares",
    ]);

    const pcat = await client.lireFichePiegesCatalogue(2);
    attendreColonnes((pcat.data as Record<string, unknown>[])[0], ["id", "nom", "niveau", "est_actif"]);

    const langues = await client.lireFicheLangues();
    attendreColonnes((langues.data as Record<string, unknown>[])[0], ["id", "nom"]);

    const religions = await client.lireFicheReligions();
    attendreColonnes((religions.data as Record<string, unknown>[])[0], [
      "id", "nom", "dirigeant", "fondateur", "symbole_sacre", "pouvoir_symbole",
      "domaines_principaux", "domaines_proscrits", "lore_fiche", "rituels_fiche",
      "lore_manuel", "rituels_manuel",
    ]);
  });
});

// ============================================================
// 2. description_niveau_acquis = BON palier ; niveau_max correct
// ============================================================

describe("description du palier acquis", () => {
  it("Forge niveau_acquis 2 → description du palier 2, niveau_max = 3", async () => {
    const { data } = await client.lireFicheCompetences(PERSONNAGE_LOCAL_ID);
    const forgeId = comp("Forge").id;
    const ligne = (data as Array<Record<string, unknown>>).find((r) => r.competence_id === forgeId)!;
    const niveaux = niveauxDe("Forge");
    const palier2 = niveaux.find((n) => n.niveau === 2)!;

    expect(ligne.niveau_acquis).toBe(2);
    expect(ligne.description_niveau_acquis).toBe(palier2.description);
    expect(ligne.description_courte_niveau_acquis).toBe(palier2.description_courte);
    expect(ligne.niveau_max).toBe(Math.max(...niveaux.map((n) => n.niveau)));
  });
});

// ============================================================
// 3. formule_magique / duree_incantation_calculee : SOURCE UNIQUE
// ============================================================

describe("source unique magie", () => {
  it("lireFicheSorts.formule_magique === lirePersonnageSorts.formule_magique", async () => {
    const fiche = (await client.lireFicheSorts(PERSONNAGE_LOCAL_ID)).data as Array<Record<string, unknown>>;
    const perso = (await client.lirePersonnageSorts(PERSONNAGE_LOCAL_ID)).data as Array<Record<string, unknown>>;
    expect(fiche.length).toBe(1);
    expect(fiche[0].formule_magique).toBe(perso[0].formule_magique);
    expect(fiche[0].formule_magique).not.toBeNull();
  });

  it("lireFichePrieres.duree_incantation_calculee === lirePersonnagePrieres", async () => {
    const fiche = (await client.lireFichePrieres(PERSONNAGE_LOCAL_ID)).data as Array<Record<string, unknown>>;
    const perso = (await client.lirePersonnagePrieres(PERSONNAGE_LOCAL_ID)).data as Array<Record<string, unknown>>;
    expect(fiche.length).toBe(1);
    expect(fiche[0].duree_incantation_calculee).toBe(perso[0].duree_incantation_calculee);
  });
});

// ============================================================
// 4. lireFicheArtisanatEtat
// ============================================================

describe("état artisanat dérivé", () => {
  it("{ alchimie:1, forge:2, joaillerie:1, pieges:2, runes:0 }", async () => {
    const { data } = await client.lireFicheArtisanatEtat(PERSONNAGE_LOCAL_ID);
    expect(data).toEqual({
      niveau_alchimie: 1,
      niveau_forge: 2,
      niveau_joaillerie: 1,
      niveau_pieges: 2,
      niveau_runes: 0,
    });
  });
});

// ============================================================
// 5. VENTILATION XP (LE test métier) — somme des xp_depense === etat.xpDepense
// ============================================================

describe("ventilation XP", () => {
  it("Σ xp_depense (traits + comp + sorts + prières + assemblages + recettes + pièges) === etat.xpDepense", async () => {
    const etat = deriverEtat(b);

    const fiche = (await client.lireFichePersonnage(PERSONNAGE_LOCAL_ID)).data as Record<string, unknown>;
    const traits = fiche.traits_raciaux_choisis as Array<{ xp_depense: number }>;
    const sommeTraits = traits.reduce((acc, t) => acc + t.xp_depense, 0);

    const competences = (await client.lireFicheCompetences(PERSONNAGE_LOCAL_ID)).data as Array<{ xp_depense: number }>;
    const sommeComp = competences.reduce((acc, c) => acc + c.xp_depense, 0);

    const assemblages = (await client.lireFicheAssemblages(PERSONNAGE_LOCAL_ID)).data as Array<{ xp_depense: number }>;
    const sommeAssemblages = assemblages.reduce((acc, a) => acc + a.xp_depense, 0);

    const recettes = (await client.lireFicheRecettes(PERSONNAGE_LOCAL_ID)).data as Array<{ xp_depense: number }>;
    const sommeRecettes = recettes.reduce((acc, r) => acc + r.xp_depense, 0);

    const pieges = (await client.lireFichePieges(PERSONNAGE_LOCAL_ID)).data as Array<{ xp_depense: number }>;
    const sommePieges = pieges.reduce((acc, p) => acc + p.xp_depense, 0);

    // Sorts/prières : coût débité par le moteur (mêmes helpers que le débit).
    const sommeSorts = b.acquisitions.sorts.reduce((acc, s) => {
      const cat = snapshot.tables.sorts.find((x) => x.id === s.sortId) as { cout_xp_base: number };
      return acc + calculerCoutXP(s.zoneChoisie, s.porteeChoisie, s.dureeChoisie, s.niveauSort, cat.cout_xp_base ?? 0);
    }, 0);
    const sommePrieres = b.acquisitions.prieres.reduce((acc, p) => {
      const cat = snapshot.tables.prieres.find((x) => x.id === p.priereId) as { cout_xp_base: number };
      return acc + calculerCoutXP(p.zoneChoisie, p.porteeChoisie, p.dureeChoisie, p.niveauPriere, cat.cout_xp_base ?? 0);
    }, 0);

    const total =
      sommeTraits + sommeComp + sommeSorts + sommePrieres + sommeAssemblages + sommeRecettes + sommePieges;

    expect(etat.xpDepense).toBeGreaterThan(0);
    expect(total).toBe(etat.xpDepense);
  });
});

// ============================================================
// 6. Traits triés par nom ; fiche niveau === 1 + gnCompletes
// ============================================================

describe("fiche personnage — traits & niveau", () => {
  it("traits triés par nom, 1 gratuit + 1 payant", async () => {
    const fiche = (await client.lireFichePersonnage(PERSONNAGE_LOCAL_ID)).data as Record<string, unknown>;
    const traits = fiche.traits_raciaux_choisis as Array<{ nom: string; est_gratuit: boolean }>;
    expect(traits.length).toBe(2);

    const noms = traits.map((t) => t.nom);
    const nomsTries = [...noms].sort((x, y) => x.localeCompare(y, "fr"));
    expect(noms).toEqual(nomsTries);

    const gratuits = traits.filter((t) => t.est_gratuit).length;
    expect(gratuits).toBe(1); // nb_traits_raciaux(Myrvalk) = 1
  });

  it("niveau === 1 + gn_completes", async () => {
    const fiche = (await client.lireFichePersonnage(PERSONNAGE_LOCAL_ID)).data as Record<string, unknown>;
    expect(fiche.niveau).toBe(1 + b.etape1.gnCompletes);
    expect(fiche.gn_completes).toBe(b.etape1.gnCompletes);
  });
});

// ============================================================
// Robustesse : sans brouillon → fiche indisponible (pas de crash)
// ============================================================

describe("sans brouillon", () => {
  it("lireFichePersonnage → data null", async () => {
    localStorage.clear();
    const vierge = creerClientVisiteur();
    const { data, error } = await vierge.lireFichePersonnage(PERSONNAGE_LOCAL_ID);
    expect(data).toBeNull();
    expect(error).toBeNull();
  });
});

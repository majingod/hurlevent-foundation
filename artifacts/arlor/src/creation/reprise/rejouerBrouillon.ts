/**
 * [VIS-6] Sync-brouillon — Lot 1 : ORCHESTRATEUR PUR de rejeu du brouillon
 * visiteur.
 *
 * Un visiteur qui a bâti un personnage en essai libre (mode hors-ligne, fichier
 * `BrouillonVisiteur`) doit pouvoir, à la création de son compte, REJOUER son
 * brouillon via les VRAIES RPC — jamais d'écriture directe. Ce module est le
 * cœur logique de ce rejeu : il séquence les appels `ClientCreation` dans le bon
 * ordre et journalise chaque fait / chaque échec.
 *
 * PURETÉ : toute I/O passe par `client` (injecté), aucune dépendance à
 * `localStorage`/`supabase`. La SEULE touche au snapshot est isolée dans
 * `catalogueDepuisSnapshot` (implémentation par défaut du `CatalogueRejeu`) ;
 * les tests injectent un mock de `client` et un `CatalogueRejeu` factice.
 *
 * ORDRE TOPOLOGIQUE (le cœur du lot) : le serveur calcule le rabais
 * « Acquisition de Cercle/Domaine » au MOMENT de l'achat, sur les items déjà
 * possédés (seuils 5/10, cf. `moteurCreation/rabais.ts`). Le moteur hors-ligne,
 * lui, le calcule sur l'état FINAL. Pour maximiser la concordance des XP
 * débités, on rejoue AVANT chaque palier d'acquisition (niv 2/3 d'un
 * cercle/domaine) les sorts/prières du même choix dont le niveau est
 * strictement inférieur au palier. Le reste des sorts/prières est rejoué après
 * toutes les compétences, puis l'artisanat (recettes → assemblages → pièges).
 *
 * POLITIQUE D'ÉCHEC (best-effort journalisé) :
 *  - démarrage refusé (`brouillon_existant`, `FINALISE_EXISTANT`, …) → on
 *    s'arrête net (`echec_demarrage`), rien d'autre n'est tenté ;
 *  - échec d'une étape 1→4 → STOP (`partiel`) : tout ce qui suit en dépend ;
 *  - achat refusé (`succes:false`) → journalisé, on CONTINUE (chaque refus est
 *    consigné individuellement, message serveur verbatim) ;
 *  - exception (réseau) → journalisée `code:"exception"`, STOP (`partiel`) : la
 *    reprise se fera dans le wizard, pas de retry dans ce lot.
 *
 * AUCUN appel à `avancer_etape`/`valider_*` ICI : le rejeu laisse
 * `etape_creation` là où `sauvegarder_etape_4` l'a mis (depuis la migration
 * `20260803145513`, l'étape 4 complète avance vers 5 depuis toute étape ≤ 4).
 * [s373] Pour le GÉNÉRATEUR, c'est `appliquerComposition` qui enchaîne ensuite
 * `avancer_etape` 5→9 (vraies validations) pour déverrouiller le wizard ; les
 * appelants VIS-6 (`RepriseEssai`, `preVolBrouillon`) gardent le comportement
 * séquentiel d'origine.
 *
 * [PR-B 🎲 s365] Le CŒUR du rejeu est extrait en `executerRejeu` : exécution
 * du plan sur un personnage EXISTANT, sans démarrage. `rejouerBrouillon`
 * (VIS-6 — branché en prod par `RepriseEssai` et `preVolBrouillon`) reste
 * « démarrage + cœur », comportement inchangé ; `appliquerComposition` (🎲,
 * src/creation/generateur) est « conversion + cœur », étapes 1-3 en
 * `p_brouillon: true`.
 */

import type { Database, Json } from "@/integrations/supabase/types";
import type { ClientCreation, Reponse } from "../types";
import { getCompetence, getSnapshot } from "@/moteurCreation/snapshot";
import type {
  BrouillonVisiteur,
  BrouillonCompetence,
  BrouillonSort,
  BrouillonPriere,
} from "@/moteurCreation/brouillon/types";

type ArgsR<K extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][K]["Args"];

// ============================================================
// API publique
// ============================================================

export interface CatalogueRejeu {
  /** 'cercle' | 'domaine' | null — type_choix de la compétence (null = pas une Acquisition). */
  typeChoixCompetence(competenceId: string): "cercle" | "domaine" | null;
  /** cercle du sort (ou null si inconnu). */
  cercleDuSort(sortId: string): string | null;
  /** domaine de la prière (ou null si inconnu). */
  domaineDeLaPriere(priereId: string): string | null;
}

export interface FaitRejeu {
  type:
    | "demarrage"
    | "etape1"
    | "etape2"
    | "etape3"
    | "etape4"
    | "competence"
    | "sort"
    | "priere"
    | "recette"
    | "assemblage"
    | "piege";
  /** Identité de la ligne rejouée — pour les acquisitions uniquement. */
  instanceId?: string;
}

export interface EchecRejeu extends FaitRejeu {
  /** Code d'erreur du retour standard (ou "exception" pour une panne réseau). */
  code: string;
  /** Message serveur verbatim. */
  message: string;
}

export interface ResultatRejeu {
  personnageId: string | null;
  statut: "complet" | "partiel" | "echec_demarrage";
  faits: FaitRejeu[];
  echecs: EchecRejeu[];
}

/** Options du cœur de rejeu (`executerRejeu`). */
export interface OptionsRejeu {
  /**
   * [PR-B 🎲] Étapes 1-3 en `p_brouillon: true` : persistance SANS validation
   * ni avancement — le contrat autosave du wizard (migration 20260619030657).
   * Indispensable au tirage : un personnage tiré n'a PAS de nom (l'étape 1
   * complète le refuserait), pas de sous-type Chiméride, pas de traits.
   * L'étape 4 reste TOUJOURS complète : elle seule attribue les gratuites de
   * classe, et `valider_etape_4` ne dépend pas des étapes 1-3 (mesuré s365).
   * Défaut `false` : VIS-6 rejoue les 4 étapes en mode complet, inchangé.
   */
  etapes123EnBrouillon?: boolean;
}

// ============================================================
// Plan de rejeu (source unique de l'ordre)
// ============================================================

/**
 * Une action atomique du plan de rejeu. Les étapes 1→4 n'ont pas d'identité de
 * ligne ; chaque achat en porte une (`instanceId` de l'acquisition ciblée).
 */
export type ActionRejeu =
  | { type: "etape1" | "etape2" | "etape3" | "etape4" }
  | {
      type: "competence" | "sort" | "priere" | "recette" | "assemblage" | "piege";
      instanceId: string;
    };

/**
 * PLAN de rejeu — fonction PURE, SOURCE UNIQUE de l'ordre topologique. Produit la
 * liste ordonnée des actions que `rejouerBrouillon` exécute telle quelle :
 *
 *   étapes 1-4 → pour chaque compétence (ordre brouillon), pré-rejeu des
 *   sorts/prières du même choix dont le niveau ≤ k−1 AVANT chaque palier
 *   d'Acquisition de Cercle/Domaine niv 2/3, puis la compétence → sorts restants
 *   → prières restantes → recettes → assemblages → pièges (ordre brouillon).
 *
 * Le rabais serveur se calcule au moment de l'achat ; pré-rejouer les items
 * éligibles avant le palier maximise la concordance des XP débités (cf. en-tête
 * de module). Marquer un item « tenté » à la planification garantit qu'il n'est
 * ni re-planifié devant un palier ultérieur ni rejoué dans la passe « restants ».
 */
export function planifierRejeu(
  brouillon: BrouillonVisiteur,
  catalogue: CatalogueRejeu,
): ActionRejeu[] {
  const plan: ActionRejeu[] = [
    { type: "etape1" },
    { type: "etape2" },
    { type: "etape3" },
    { type: "etape4" },
  ];

  const sortsTentes = new Set<string>();
  const prieresTentes = new Set<string>();

  for (const comp of brouillon.acquisitions.competences) {
    const typeChoix = catalogue.typeChoixCompetence(comp.competenceId);
    const k = comp.niveauAcquis;
    const choix = comp.choixAchat;
    if (choix != null && (k === 2 || k === 3)) {
      if (typeChoix === "cercle") {
        for (const s of brouillon.acquisitions.sorts) {
          if (sortsTentes.has(s.instanceId)) continue;
          if (catalogue.cercleDuSort(s.sortId) === choix && s.niveauSort <= k - 1) {
            sortsTentes.add(s.instanceId);
            plan.push({ type: "sort", instanceId: s.instanceId });
          }
        }
      } else if (typeChoix === "domaine") {
        for (const p of brouillon.acquisitions.prieres) {
          if (prieresTentes.has(p.instanceId)) continue;
          if (
            catalogue.domaineDeLaPriere(p.priereId) === choix &&
            p.niveauPriere <= k - 1
          ) {
            prieresTentes.add(p.instanceId);
            plan.push({ type: "priere", instanceId: p.instanceId });
          }
        }
      }
    }
    plan.push({ type: "competence", instanceId: comp.instanceId });
  }

  for (const s of brouillon.acquisitions.sorts) {
    if (sortsTentes.has(s.instanceId)) continue;
    plan.push({ type: "sort", instanceId: s.instanceId });
  }
  for (const p of brouillon.acquisitions.prieres) {
    if (prieresTentes.has(p.instanceId)) continue;
    plan.push({ type: "priere", instanceId: p.instanceId });
  }
  for (const r of brouillon.acquisitions.recettes) {
    plan.push({ type: "recette", instanceId: r.instanceId });
  }
  for (const a of brouillon.acquisitions.assemblages) {
    plan.push({ type: "assemblage", instanceId: a.instanceId });
  }
  for (const pg of brouillon.acquisitions.pieges) {
    plan.push({ type: "piege", instanceId: pg.instanceId });
  }

  return plan;
}

// ============================================================
// Lecture du retour standard `{succes, erreurs, donnees}`
// ============================================================

interface ErreurStandard {
  code?: string;
  message?: string;
}

interface PayloadStandard {
  succes?: boolean;
  erreurs?: ErreurStandard[];
  donnees?: Record<string, unknown> | null;
}

/** Issue d'un appel RPC unique, normalisée pour l'orchestrateur. */
type IssueAppel =
  | { statut: "ok"; payload: PayloadStandard }
  | { statut: "refus"; code: string; message: string }
  | { statut: "exception"; message: string };

function lirePayload(resp: Reponse<Json>): PayloadStandard {
  return (resp.data ?? {}) as unknown as PayloadStandard;
}

function premiereErreur(p: PayloadStandard): { code: string; message: string } | null {
  const e = p.erreurs?.[0];
  if (!e) return null;
  return { code: e.code ?? "echec", message: e.message ?? "" };
}

function messageException(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Exécute un appel RPC et normalise son issue :
 *  - jet (réseau) ou `error` supabase non-null → `exception` (arrêt) ;
 *  - `succes:true` → `ok` ;
 *  - `succes:false` → `refus` (code/message du premier `erreurs[]`).
 */
async function executer(invoke: () => Promise<Reponse<Json>>): Promise<IssueAppel> {
  let resp: Reponse<Json>;
  try {
    resp = await invoke();
  } catch (e) {
    return { statut: "exception", message: messageException(e) };
  }
  if (resp.error) return { statut: "exception", message: resp.error.message };
  const payload = lirePayload(resp);
  if (payload.succes === true) return { statut: "ok", payload };
  const err = premiereErreur(payload);
  return { statut: "refus", code: err?.code ?? "echec", message: err?.message ?? "" };
}

// ============================================================
// Constructeurs de params `p_*` (mapping exact — cf. spéc VIS-6 Lot 1)
// ============================================================
//
// Certains champs acceptent `null` côté serveur (religion non renseignée, nom
// personnalisé absent, choix d'achat non pertinent…) alors que les `Args`
// générés les typent `string` (ou optionnels). On construit chaque objet PUIS
// on le projette (`as ArgsR<...>`) sur la forme attendue par `ClientCreation` —
// le `null` transite verbatim jusqu'à la RPC, exactement comme le fait le
// wizard natif.

/** [s368 #1] `personnages_nom_longueur` : la base accepte `null` mais refuse
 *  une chaîne vide ou d'un caractère. Un personnage TIRÉ n'a pas encore de
 *  nom (le wizard le demandera) — le pont traduit « pas de nom » en `null`,
 *  jamais en `""` (mesuré en prod : le premier rejeu réel plantait ici, sur
 *  les DEUX portes). */
const nomOuNull = (nom: string): string | null =>
  nom.trim().length >= 2 ? nom : null;

function paramsEtape1(b: BrouillonVisiteur, personnageId: string, enBrouillon?: boolean) {
  return {
    p_personnage_id: personnageId,
    p_nom: nomOuNull(b.etape1.nom),
    p_gn_completes: b.etape1.gnCompletes,
    p_mini_gn_completes: b.etape1.miniGnCompletes,
    p_ouvertures_terrain: b.etape1.ouverturesTerrain,
    p_est_croyant: b.etape1.estCroyant,
    p_religion_id: b.etape1.religionId,
    ...(enBrouillon ? { p_brouillon: true } : {}),
  } as unknown as ArgsR<"sauvegarder_etape_1">;
}

function paramsEtape2(b: BrouillonVisiteur, personnageId: string, enBrouillon?: boolean) {
  return {
    p_personnage_id: personnageId,
    p_race_id: b.etape2.raceId,
    p_sous_type_chimeride: b.etape2.sousTypeChimeride ?? null,
    ...(enBrouillon ? { p_brouillon: true } : {}),
  } as unknown as ArgsR<"sauvegarder_etape_2">;
}

function paramsEtape3(b: BrouillonVisiteur, personnageId: string, enBrouillon?: boolean) {
  return {
    p_personnage_id: personnageId,
    p_traits_raciaux_choisis: b.etape3.traitsRaciauxChoisis,
    ...(enBrouillon ? { p_brouillon: true } : {}),
  } as unknown as ArgsR<"sauvegarder_etape_3">;
}

function paramsEtape4(b: BrouillonVisiteur, personnageId: string) {
  return {
    p_personnage_id: personnageId,
    p_classe_id: b.etape4.classeId,
    p_choix_par_competence: b.etape4.choixParCompetence ?? null,
  } as unknown as ArgsR<"sauvegarder_etape_4">;
}

function paramsCompetence(c: BrouillonCompetence, personnageId: string) {
  return {
    p_personnage_id: personnageId,
    p_competence_id: c.competenceId,
    p_niveau_desire: c.niveauAcquis,
    p_choix_achat: c.choixAchat,
  } as unknown as ArgsR<"acheter_competence">;
}

function paramsSort(s: BrouillonSort, personnageId: string) {
  return {
    p_personnage_id: personnageId,
    p_sort_id: s.sortId,
    p_niveau_sort: s.niveauSort,
    p_zone_choisie: s.zoneChoisie,
    p_portee_choisie: s.porteeChoisie,
    p_duree_choisie: s.dureeChoisie,
    p_nom_personnalise: s.nomPersonnalise ?? null,
  } as unknown as ArgsR<"acheter_sort">;
}

function paramsPriere(p: BrouillonPriere, personnageId: string) {
  return {
    p_personnage_id: personnageId,
    p_priere_id: p.priereId,
    p_niveau_priere: p.niveauPriere,
    p_zone_choisie: p.zoneChoisie,
    p_portee_choisie: p.porteeChoisie,
    p_duree_choisie: p.dureeChoisie,
    p_nom_personnalise: p.nomPersonnalise ?? null,
  } as unknown as ArgsR<"acheter_priere">;
}

// ============================================================
// Orchestrateur
// ============================================================

/**
 * [VIS-6] Orchestrateur COMPLET : démarre un personnage NEUF
 * (`demarrer_creation_personnage`) puis lui rejoue le brouillon via
 * `executerRejeu`. Comportement identique au Lot 1 (démarrage refusé →
 * `echec_demarrage`, rien d'autre n'est tenté ; fait « demarrage » émis en
 * premier) — c'est le chemin « le visiteur crée son compte ».
 */
export async function rejouerBrouillon(
  client: ClientCreation,
  catalogue: CatalogueRejeu,
  brouillon: BrouillonVisiteur,
  profilId: string,
  onProgres?: (fait: FaitRejeu) => void,
): Promise<ResultatRejeu> {
  // ── 1. Démarrage ────────────────────────────────────────────────────────
  const dem = await executer(() =>
    client.demarrerCreationPersonnage({ p_profil_id: profilId }),
  );
  if (dem.statut !== "ok") {
    const { code, message } =
      dem.statut === "refus"
        ? { code: dem.code, message: dem.message }
        : { code: "exception", message: dem.message };
    return {
      personnageId: null,
      statut: "echec_demarrage",
      faits: [],
      echecs: [{ type: "demarrage", code, message }],
    };
  }
  const personnageId = String(dem.payload.donnees?.personnage_id ?? "");
  const faitDemarrage: FaitRejeu = { type: "demarrage" };
  onProgres?.(faitDemarrage);

  // ── 2. Cœur (plan + achats) sur le personnage fraîchement démarré ───────
  const res = await executerRejeu(
    client,
    catalogue,
    brouillon,
    personnageId,
    {},
    onProgres,
  );
  return { ...res, faits: [faitDemarrage, ...res.faits] };
}

/**
 * [PR-B 🎲 s365] CŒUR du rejeu, extrait pour `appliquerComposition` : exécute
 * le plan (`planifierRejeu`) sur un personnage EXISTANT — ne démarre RIEN.
 * Motif mesuré : quand l'accueil des portes s'affiche, la page a DÉJÀ créé
 * (ou adopté) le personnage ; re-démarrer répondrait `brouillon_existant`.
 * Extraction sans changement de comportement (VIS-6 l'appelle tel quel).
 */
export async function executerRejeu(
  client: ClientCreation,
  catalogue: CatalogueRejeu,
  brouillon: BrouillonVisiteur,
  personnageId: string,
  options: OptionsRejeu = {},
  onProgres?: (fait: FaitRejeu) => void,
): Promise<ResultatRejeu> {
  const faits: FaitRejeu[] = [];
  const echecs: EchecRejeu[] = [];

  const reussir = (fait: FaitRejeu): void => {
    faits.push(fait);
    onProgres?.(fait);
  };

  // Retour anticipé mutualisé pour les arrêts « partiels ».
  const partiel = (): ResultatRejeu => ({
    personnageId,
    statut: "partiel",
    faits,
    echecs,
  });

  // ── 2. Exécution du plan (SOURCE UNIQUE de l'ordre : `planifierRejeu`) ────
  //
  // Index d'instance → ligne du brouillon, pour reconstruire les params `p_*`
  // à partir de l'`instanceId` porté par chaque action du plan.
  const parInstance = <T extends { instanceId: string }>(liste: T[]) =>
    new Map(liste.map((x) => [x.instanceId, x]));
  const competences = parInstance(brouillon.acquisitions.competences);
  const sorts = parInstance(brouillon.acquisitions.sorts);
  const prieres = parInstance(brouillon.acquisitions.prieres);
  const recettes = parInstance(brouillon.acquisitions.recettes);
  const assemblages = parInstance(brouillon.acquisitions.assemblages);
  const pieges = parInstance(brouillon.acquisitions.pieges);

  // Un échec journalise son issue et signale s'il faut poursuivre : `true` =
  // continuer (succès OU refus best-effort d'un achat), `false` = arrêt
  // (exception réseau, OU refus d'une étape 1→4 : tout ce qui suit en dépend).
  const jouer = async (
    action: ActionRejeu,
    invoke: () => Promise<Reponse<Json>>,
    stopSurRefus: boolean,
  ): Promise<boolean> => {
    const issue = await executer(invoke);
    if (issue.statut === "ok") {
      reussir(action);
      return true;
    }
    if (issue.statut === "refus") {
      echecs.push({ ...action, code: issue.code, message: issue.message });
      return !stopSurRefus;
    }
    echecs.push({ ...action, code: "exception", message: issue.message });
    return false;
  };

  for (const action of planifierRejeu(brouillon, catalogue)) {
    let ok: boolean;
    switch (action.type) {
      case "etape1":
        ok = await jouer(action, () => client.sauvegarderEtape1(paramsEtape1(brouillon, personnageId, options.etapes123EnBrouillon)), true);
        break;
      case "etape2":
        ok = await jouer(action, () => client.sauvegarderEtape2(paramsEtape2(brouillon, personnageId, options.etapes123EnBrouillon)), true);
        break;
      case "etape3":
        ok = await jouer(action, () => client.sauvegarderEtape3(paramsEtape3(brouillon, personnageId, options.etapes123EnBrouillon)), true);
        break;
      case "etape4":
        ok = await jouer(action, () => client.sauvegarderEtape4(paramsEtape4(brouillon, personnageId)), true);
        break;
      case "competence": {
        const c = competences.get(action.instanceId)!;
        ok = await jouer(action, () => client.acheterCompetence(paramsCompetence(c, personnageId)), false);
        break;
      }
      case "sort": {
        const s = sorts.get(action.instanceId)!;
        ok = await jouer(action, () => client.acheterSort(paramsSort(s, personnageId)), false);
        break;
      }
      case "priere": {
        const p = prieres.get(action.instanceId)!;
        ok = await jouer(action, () => client.acheterPriere(paramsPriere(p, personnageId)), false);
        break;
      }
      case "recette": {
        const r = recettes.get(action.instanceId)!;
        ok = await jouer(action, () => client.acheterRecette({ p_personnage_id: personnageId, p_recette_id: r.recetteId }), false);
        break;
      }
      case "assemblage": {
        const a = assemblages.get(action.instanceId)!;
        ok = await jouer(action, () => client.acheterAssemblage({ p_personnage_id: personnageId, p_assemblage_id: a.assemblageId }), false);
        break;
      }
      case "piege": {
        const pg = pieges.get(action.instanceId)!;
        ok = await jouer(action, () => client.acheterPiege({ p_personnage_id: personnageId, p_piege_id: pg.piegeId }), false);
        break;
      }
    }
    if (!ok) return partiel();
  }

  return {
    personnageId,
    statut: echecs.length === 0 ? "complet" : "partiel",
    faits,
    echecs,
  };
}

// ============================================================
// Implémentation par défaut du catalogue (SEULE touche au snapshot)
// ============================================================

interface SortCatalogue {
  id: string;
  cercle: string | null;
}
interface PriereCatalogue {
  id: string;
  domaine: string | null;
}

/**
 * `CatalogueRejeu` adossé au snapshot visiteur bundlé. Réutilise le getter
 * exporté `getCompetence` et lit `sorts`/`prieres` via `getSnapshot()` — même
 * source que `moteurCreation/brouillon/deriver.ts`, aucune donnée dupliquée.
 */
export function catalogueDepuisSnapshot(): CatalogueRejeu {
  return {
    typeChoixCompetence(competenceId) {
      const tc = getCompetence(competenceId)?.type_choix;
      return tc === "cercle" || tc === "domaine" ? tc : null;
    },
    cercleDuSort(sortId) {
      const sorts = (getSnapshot().tables.sorts ?? []) as SortCatalogue[];
      return sorts.find((s) => s.id === sortId)?.cercle ?? null;
    },
    domaineDeLaPriere(priereId) {
      const prieres = (getSnapshot().tables.prieres ?? []) as PriereCatalogue[];
      return prieres.find((p) => p.id === priereId)?.domaine ?? null;
    },
  };
}

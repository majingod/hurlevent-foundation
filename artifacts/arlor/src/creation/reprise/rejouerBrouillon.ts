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
 * AUCUN appel à `avancer_etape`/`valider_*` : le rejeu laisse `etape_creation`
 * là où `sauvegarder_etape_4` l'a mis ; le joueur re-parcourt les étapes 5+ dans
 * le wizard (validation native).
 *
 * Code NON APPELÉ en prod (le branchement UI vient au Lot 2) — zéro impact.
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

function paramsEtape1(b: BrouillonVisiteur, personnageId: string) {
  return {
    p_personnage_id: personnageId,
    p_nom: b.etape1.nom,
    p_gn_completes: b.etape1.gnCompletes,
    p_mini_gn_completes: b.etape1.miniGnCompletes,
    p_ouvertures_terrain: b.etape1.ouverturesTerrain,
    p_est_croyant: b.etape1.estCroyant,
    p_religion_id: b.etape1.religionId,
  } as unknown as ArgsR<"sauvegarder_etape_1">;
}

function paramsEtape2(b: BrouillonVisiteur, personnageId: string) {
  return {
    p_personnage_id: personnageId,
    p_race_id: b.etape2.raceId,
    p_sous_type_chimeride: b.etape2.sousTypeChimeride ?? null,
  } as unknown as ArgsR<"sauvegarder_etape_2">;
}

function paramsEtape3(b: BrouillonVisiteur, personnageId: string) {
  return {
    p_personnage_id: personnageId,
    p_traits_raciaux_choisis: b.etape3.traitsRaciauxChoisis,
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

export async function rejouerBrouillon(
  client: ClientCreation,
  catalogue: CatalogueRejeu,
  brouillon: BrouillonVisiteur,
  profilId: string,
  onProgres?: (fait: FaitRejeu) => void,
): Promise<ResultatRejeu> {
  const faits: FaitRejeu[] = [];
  const echecs: EchecRejeu[] = [];

  const reussir = (fait: FaitRejeu): void => {
    faits.push(fait);
    onProgres?.(fait);
  };

  // ── 1. Démarrage ────────────────────────────────────────────────────────
  const dem = await executer(() =>
    client.demarrerCreationPersonnage({ p_profil_id: profilId }),
  );
  if (dem.statut !== "ok") {
    const { code, message } =
      dem.statut === "refus"
        ? { code: dem.code, message: dem.message }
        : { code: "exception", message: dem.message };
    echecs.push({ type: "demarrage", code, message });
    return { personnageId: null, statut: "echec_demarrage", faits, echecs };
  }
  const personnageId = String(dem.payload.donnees?.personnage_id ?? "");
  reussir({ type: "demarrage" });

  // Retour anticipé mutualisé pour les arrêts « partiels ».
  const partiel = (): ResultatRejeu => ({
    personnageId,
    statut: "partiel",
    faits,
    echecs,
  });

  // ── 2. Étapes 1 → 4 (un échec = STOP : tout ce qui suit en dépend) ───────
  const etapes: Array<{
    fait: FaitRejeu;
    invoke: () => Promise<Reponse<Json>>;
  }> = [
    { fait: { type: "etape1" }, invoke: () => client.sauvegarderEtape1(paramsEtape1(brouillon, personnageId)) },
    { fait: { type: "etape2" }, invoke: () => client.sauvegarderEtape2(paramsEtape2(brouillon, personnageId)) },
    { fait: { type: "etape3" }, invoke: () => client.sauvegarderEtape3(paramsEtape3(brouillon, personnageId)) },
    { fait: { type: "etape4" }, invoke: () => client.sauvegarderEtape4(paramsEtape4(brouillon, personnageId)) },
  ];
  for (const etape of etapes) {
    const issue = await executer(etape.invoke);
    if (issue.statut === "ok") {
      reussir(etape.fait);
      continue;
    }
    const { code, message } =
      issue.statut === "refus"
        ? { code: issue.code, message: issue.message }
        : { code: "exception", message: issue.message };
    echecs.push({ ...etape.fait, code, message });
    return partiel();
  }

  // ── 3. Achats (ordre topologique) ────────────────────────────────────────
  //
  // Un achat journalise son issue et signale s'il faut poursuivre : `true` =
  // continuer (succès OU refus best-effort), `false` = arrêt (exception réseau).
  const acheter = async (
    fait: FaitRejeu,
    invoke: () => Promise<Reponse<Json>>,
  ): Promise<boolean> => {
    const issue = await executer(invoke);
    if (issue.statut === "ok") {
      reussir(fait);
      return true;
    }
    if (issue.statut === "refus") {
      echecs.push({ ...fait, code: issue.code, message: issue.message });
      return true;
    }
    echecs.push({ ...fait, code: "exception", message: issue.message });
    return false;
  };

  // Suivi des sorts/prières DÉJÀ tentés (rejoués en amont d'un palier) pour ne
  // pas les rejouer dans la passe « restants ».
  const sortsTentes = new Set<string>();
  const prieresTentes = new Set<string>();

  const jouerSort = (s: BrouillonSort): Promise<boolean> => {
    sortsTentes.add(s.instanceId);
    return acheter(
      { type: "sort", instanceId: s.instanceId },
      () => client.acheterSort(paramsSort(s, personnageId)),
    );
  };
  const jouerPriere = (p: BrouillonPriere): Promise<boolean> => {
    prieresTentes.add(p.instanceId);
    return acheter(
      { type: "priere", instanceId: p.instanceId },
      () => client.acheterPriere(paramsPriere(p, personnageId)),
    );
  };

  // 3a. Compétences dans l'ordre du brouillon, avec pré-rejeu des items éligibles
  //     au rabais AVANT chaque palier d'acquisition niv 2/3.
  for (const comp of brouillon.acquisitions.competences) {
    const typeChoix = catalogue.typeChoixCompetence(comp.competenceId);
    const k = comp.niveauAcquis;
    const choix = comp.choixAchat;
    if (choix != null && (k === 2 || k === 3)) {
      if (typeChoix === "cercle") {
        for (const s of brouillon.acquisitions.sorts) {
          if (sortsTentes.has(s.instanceId)) continue;
          if (catalogue.cercleDuSort(s.sortId) === choix && s.niveauSort <= k - 1) {
            if (!(await jouerSort(s))) return partiel();
          }
        }
      } else if (typeChoix === "domaine") {
        for (const p of brouillon.acquisitions.prieres) {
          if (prieresTentes.has(p.instanceId)) continue;
          if (
            catalogue.domaineDeLaPriere(p.priereId) === choix &&
            p.niveauPriere <= k - 1
          ) {
            if (!(await jouerPriere(p))) return partiel();
          }
        }
      }
    }
    const ok = await acheter(
      { type: "competence", instanceId: comp.instanceId },
      () => client.acheterCompetence(paramsCompetence(comp, personnageId)),
    );
    if (!ok) return partiel();
  }

  // 3b. Sorts puis prières RESTANTS (ordre du brouillon).
  for (const s of brouillon.acquisitions.sorts) {
    if (sortsTentes.has(s.instanceId)) continue;
    if (!(await jouerSort(s))) return partiel();
  }
  for (const p of brouillon.acquisitions.prieres) {
    if (prieresTentes.has(p.instanceId)) continue;
    if (!(await jouerPriere(p))) return partiel();
  }

  // 3c. Artisanat : recettes → assemblages → pièges (ordre du brouillon ;
  //     l'ordre est signifiant — gratuités par quota positionnelles).
  for (const r of brouillon.acquisitions.recettes) {
    const ok = await acheter(
      { type: "recette", instanceId: r.instanceId },
      () => client.acheterRecette({ p_personnage_id: personnageId, p_recette_id: r.recetteId }),
    );
    if (!ok) return partiel();
  }
  for (const a of brouillon.acquisitions.assemblages) {
    const ok = await acheter(
      { type: "assemblage", instanceId: a.instanceId },
      () => client.acheterAssemblage({ p_personnage_id: personnageId, p_assemblage_id: a.assemblageId }),
    );
    if (!ok) return partiel();
  }
  for (const pg of brouillon.acquisitions.pieges) {
    const ok = await acheter(
      { type: "piege", instanceId: pg.instanceId },
      () => client.acheterPiege({ p_personnage_id: personnageId, p_piege_id: pg.piegeId }),
    );
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

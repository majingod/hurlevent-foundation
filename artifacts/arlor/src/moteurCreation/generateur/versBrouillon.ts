/**
 * [VIS-8 PR-B s365] CONVERSION d'un tirage 🎲 en `BrouillonVisiteur`.
 *
 * Le résolveur produit `{ tirage, composition }` ; le créateur (rejeu VIS-6)
 * consomme un `BrouillonVisiteur`. Ce module est le PONT entre les deux —
 * fonction PURE : snapshot et aléa INJECTÉS, aucune I/O, aucune touche au
 * stockage. C'est `appliquerComposition` (src/creation/generateur) qui branche
 * le résultat sur un `ClientCreation`.
 *
 * CE QUE LE TIRAGE NE FOURNIT PAS (et que le brouillon laisse donc vide, pour
 * que le joueur le remplisse au wizard) : le nom, l'historique, l'âme, les
 * compteurs d'XP (`gnCompletes`…), le sous-type Chiméride, les traits raciaux.
 * Les étapes 1-3 seront rejouées en `p_brouillon: true` (aucune validation) —
 * cf. `executerRejeu({ etapes123EnBrouillon: true })`.
 *
 * DÉCISION 32 (arbitrage Fred s364) — les DEUX gratuites à choix :
 * le convertisseur est GÉNÉRIQUE. Il parcourt les `competences_gratuites` de la
 * classe tirée et remplit `etape4.choixParCompetence` selon le `type_choix` de
 * chaque gratuite (lu dans le snapshot, jamais un nom de compétence en dur) :
 *  - `religion`        → la religion TIRÉE (`tirage.religionId`) — cohérence,
 *                        pas du hasard. Format mesuré en prod : l'UUID.
 *  - `langue_ancienne` → UNE langue ancienne active AU HASARD (aléa injecté),
 *                        uniforme sur les 5 (manuel § Décryptage : « la langue
 *                        doit être choisie lors de l'achat », aucune contrainte
 *                        de race malgré les noms de peuples). Format : l'UUID
 *                        (mesuré : les 5 ids du snapshot = ceux de la prod).
 * Le choix part EXPLICITEMENT même pour la religion : le serveur a un fallback
 * sur `personnages.religion_id`, le miroir visiteur N'EN A PAS — explicite =
 * comportement identique des deux côtés.
 *
 * ÉCHEC BRUYANT (style `pontSnapshot`) : un snapshot qui ne permet pas la
 * conversion (classe introuvable, gratuite inconnue, prêtre sans religion,
 * `type_choix` que ce module ne sait pas remplir, zéro langue ancienne) lève
 * `ErreurConversionTirage` au lieu de produire un personnage amputé en silence.
 *
 * GRANULARITÉ (mesurée à la sonde s365) : `composition.achats` porte UNE ligne
 * par NIVEAU (« Mineur niv 1 » + « Mineur niv 2 » = 2 achats) et peut porter
 * PLUSIEURS lignes au même niveau (« Développement Spirituel » ×8, jauge
 * d'étendue — `multiple_sans_choix`, des vivants en portent 10 en prod). La
 * conversion est donc 1 achat → 1 `BrouillonCompetence`, chacun avec son
 * `instanceId` propre. `achatsMagie` est un tableau SÉPARÉ (piège s363) :
 * il se ventile en `sorts` / `prieres`.
 */

import type {
  BrouillonAssemblage,
  BrouillonCompetence,
  BrouillonPiege,
  BrouillonPriere,
  BrouillonRecette,
  BrouillonSort,
  BrouillonVisiteur,
} from "../brouillon/types";
import type { Classe, Competence, Langue, SnapshotVisiteur } from "../snapshot";
import {
  POIDS_ASSEMBLAGES,
  POIDS_PIEGES,
  POIDS_RECETTES,
  poidsDe,
  tirerSansRemisePondere,
} from "./contenu/artisanat";
import { TRAIT_INAPTE, type Alea, type TiragePersonnage } from "./resoudre";
import type { CompositionOk, PlanArtisanat } from "./types";

/** Erreur de conversion — snapshot inutilisable ou tirage incomplet. */
export class ErreurConversionTirage extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurConversionTirage";
  }
}

/** « Prêtre » → « pretre » : rapproche `classes.nom` du `ClasseId` moteur. */
function normaliser(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** [Décision 42] uuid du trait « Inapte à la magie » — par NOM, jamais en dur. */
function traitInapteId(snapshot: SnapshotVisiteur): string {
  const trait = snapshot.tables.traits_raciaux.find(
    (t) => t.nom === TRAIT_INAPTE
  );
  if (!trait) {
    throw new ErreurConversionTirage(
      `Trait « ${TRAIT_INAPTE} » introuvable dans le snapshot — la pose du trait auto (décision 42) est impossible.`,
    );
  }
  return trait.id;
}

/** `ClasseId` moteur → uuid `classes.id` du snapshot (par nom normalisé). */
function classeDuSnapshot(
  classes: readonly Classe[],
  classeId: TiragePersonnage["classe"],
): Classe {
  const classe = classes.find((c) => normaliser(c.nom ?? "") === classeId);
  if (!classe) {
    throw new ErreurConversionTirage(
      `Classe « ${classeId} » introuvable dans le snapshot — la conversion du tirage est impossible.`,
    );
  }
  return classe;
}

/**
 * Une langue ancienne active, tirée UNIFORMÉMENT (décision 32).
 * Tri par id AVANT tirage : l'ordre du snapshot n'est pas contractuel, un
 * aléa seedé doit rendre la même langue quelle que soit la régénération.
 * Filtres en `=== true` : colonnes nullables côté types générés (C72).
 */
function langueAncienneAuHasard(langues: readonly Langue[], alea: Alea): Langue {
  const actives = langues
    .filter((l) => l.est_ancienne === true && l.est_actif === true)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (actives.length === 0) {
    throw new ErreurConversionTirage(
      "Aucune langue ancienne active dans le snapshot — impossible de remplir le choix de Décryptage.",
    );
  }
  const i = Math.min(actives.length - 1, Math.floor(alea() * actives.length));
  return actives[i];
}

/**
 * Remplit `etape4.choixParCompetence` pour les gratuites à `type_choix` de la
 * classe tirée. Générique : la LISTE vient de `classe.competences_gratuites`,
 * la NATURE du choix vient de `competences.type_choix` — zéro nom en dur.
 */
function choixDesGratuites(
  snapshot: SnapshotVisiteur,
  classe: Classe,
  tirage: TiragePersonnage,
  alea: Alea,
): Record<string, string> | undefined {
  const gratuites =
    (classe.competences_gratuites as Array<{ competence_id?: string }> | null) ?? [];
  const parId = new Map<string, Competence>(
    snapshot.tables.competences.map((c) => [c.id, c]),
  );

  const choix: Record<string, string> = {};
  for (const g of gratuites) {
    if (!g.competence_id) continue;
    const comp = parId.get(g.competence_id);
    if (!comp) {
      throw new ErreurConversionTirage(
        `Compétence gratuite ${g.competence_id} (classe ${classe.nom}) absente du snapshot.`,
      );
    }
    if (comp.type_choix == null) continue;

    if (comp.type_choix === "religion") {
      if (!tirage.religionId) {
        throw new ErreurConversionTirage(
          `Le tirage ne porte pas de religion alors que « ${comp.nom} » en exige une — le résolveur doit la fournir.`,
        );
      }
      choix[comp.id] = tirage.religionId;
    } else if (comp.type_choix === "langue_ancienne") {
      choix[comp.id] = langueAncienneAuHasard(snapshot.tables.langues, alea).id;
    } else {
      throw new ErreurConversionTirage(
        `Gratuite « ${comp.nom} » : type_choix « ${comp.type_choix} » inconnu du convertisseur — à câbler avant d'appliquer ce tirage.`,
      );
    }
  }
  return Object.keys(choix).length > 0 ? choix : undefined;
}

/**
 * ⭐ [s366] LES ACHATS À CHOIX REÇOIVENT LEUR CHOIX — le tirage tient parole.
 * Mesuré s366 : 38 % des tirages portaient ≥ 1 achat à `type_choix` sans
 * choix (Langue supplémentaire, Décryptage, Connaissances des Religions,
 * Connaissances Criminelles @2) — la gate, serveur ET miroir, les refuse :
 * le personnage arrivait au wizard AMPUTÉ de lignes que la fiche annonçait.
 *
 * Patron décision 32 étendu : la NATURE du choix vient de
 * `competences.type_choix`, la LISTE vient du snapshot — zéro nom en dur,
 * SAUF l'exception que les deux gates codent nommément (manuel,
 * § Connaissances Criminelles : niv 1 = « les groupes de la région », sans
 * famille ; niv 2 = « un contact parmi l'une des familles »).
 *
 * SANS REMISE par compétence (contrainte serveur mesurée : anti-doublon sur
 * le choix), gratuites comprises — la langue ancienne du Décryptage gratuit
 * et la religion de « Connaissances des Religions » gratuite comptent.
 */
function resoudreChoixDesAchats(
  snapshot: SnapshotVisiteur,
  achats: BrouillonCompetence[],
  choixGratuites: Record<string, string> | undefined,
  alea: Alea,
): void {
  const parId = new Map<string, Competence>(
    snapshot.tables.competences.map((c) => [c.id, c]),
  );
  // Choix déjà pris, par compétence : les gratuites d'abord, puis les achats
  // déjà nommés (Acquisition de Cercle/Domaine portent le leur depuis R1a).
  const pris = new Map<string, Set<string>>();
  const prendre = (compId: string, valeur: string) => {
    const s = pris.get(compId) ?? new Set<string>();
    s.add(valeur);
    pris.set(compId, s);
  };
  for (const [compId, valeur] of Object.entries(choixGratuites ?? {})) {
    prendre(compId, valeur);
  }
  for (const a of achats) {
    if (a.choixAchat != null) prendre(a.competenceId, a.choixAchat);
  }

  for (const a of achats) {
    if (a.choixAchat != null) continue;
    const comp = parId.get(a.competenceId);
    if (!comp) {
      throw new ErreurConversionTirage(
        `Compétence ${a.competenceId} absente du snapshot — la conversion du tirage est impossible.`,
      );
    }
    if (comp.type_choix == null) continue; // rien à inventer (jumeau testé)
    if (comp.nom === "Connaissances Criminelles" && a.niveauAcquis === 1) {
      continue; // exception nommée des gates — voir le bloc de doc ci-dessus
    }
    const valeur = tirerChoix(snapshot, comp, pris.get(a.competenceId), alea);
    a.choixAchat = valeur;
    prendre(a.competenceId, valeur);
  }
}

/**
 * La valeur d'un choix, tirée UNIFORMÉMENT dans la liste légale du snapshot,
 * hors `exclus`. Tri stable AVANT tirage (aléa seedé ⇒ même valeur quelle
 * que soit la régénération du snapshot). Formats mesurés en prod :
 * langues et religions en UUID, familles criminelles en NOM.
 */
function tirerChoix(
  snapshot: SnapshotVisiteur,
  comp: Competence,
  exclus: ReadonlySet<string> | undefined,
  alea: Alea,
): string {
  let candidats: string[];
  switch (comp.type_choix) {
    case "langue":
      candidats = snapshot.tables.langues
        .filter((l) => l.est_ancienne === false && l.est_actif === true)
        .map((l) => l.id);
      break;
    case "langue_ancienne":
      candidats = snapshot.tables.langues
        .filter((l) => l.est_ancienne === true && l.est_actif === true)
        .map((l) => l.id);
      break;
    case "religion":
      candidats = snapshot.tables.religions
        .filter((r) => r.est_actif === true)
        .map((r) => r.id);
      break;
    case "famille_criminelle": {
      const familles = snapshot.tables.familles_criminelles;
      if (!familles || familles.length === 0) {
        throw new ErreurConversionTirage(
          `Le snapshot ne porte pas les familles criminelles — impossible de remplir « ${comp.nom} ».`,
        );
      }
      // `nom` nullable côté types générés (C72) : flatMap garde le strict.
      candidats = familles.flatMap((f) =>
        f.est_actif === true && f.nom ? [f.nom] : [],
      );
      break;
    }
    case "cercle":
    case "domaine":
      // La rampe de `planifierMagie` (R1a) est la SEULE autorité qui nomme
      // un accès — un achat d'Acquisition sans choix est un bug AMONT.
      throw new ErreurConversionTirage(
        `« ${comp.nom} » sans choix : l'accès doit être nommé par la rampe (R1a) — jamais tiré ici.`,
      );
    default:
      throw new ErreurConversionTirage(
        `Achat « ${comp.nom} » : type_choix « ${comp.type_choix} » inconnu du convertisseur — à câbler avant d'appliquer ce tirage.`,
      );
  }
  const libres = candidats
    .filter((v) => !(exclus?.has(v) ?? false))
    .sort((x, y) => x.localeCompare(y));
  if (libres.length === 0) {
    throw new ErreurConversionTirage(
      `Plus aucun choix disponible pour « ${comp.nom} » (${candidats.length} au catalogue, tous déjà pris).`,
    );
  }
  return libres[Math.min(libres.length - 1, Math.floor(alea() * libres.length))];
}

/* ------------------------------------------------------------------ */
/* ⭐ [C1 s375] L'ARTISANAT — l'enveloppe devient des items                */
/* ------------------------------------------------------------------ */

/** Ligne d'artisanat du snapshot — le sous-ensemble que le tirage lit. */
interface LigneArtisanat {
  id: string;
  nom: string | null;
  est_actif: boolean | null;
  /** `recettes_alchimie` (palier de la recette). */
  niveau_requis?: number | null;
  /** `pieges` (le palier y s'appelle `niveau`). */
  niveau?: number | null;
}

const TABLE_DE: Record<PlanArtisanat["famille"], string> = {
  recette: "recettes_alchimie",
  assemblage: "assemblages_runes",
  piege: "pieges",
};

const POIDS_DE: Record<PlanArtisanat["famille"], Record<string, number>> = {
  recette: POIDS_RECETTES,
  assemblage: POIDS_ASSEMBLAGES,
  piege: POIDS_PIEGES,
};

/**
 * Le POOL d'un plan : les entrées ACTIVES du snapshot, du bon palier, moins
 * celles déjà tirées. Tri par id AVANT tirage — l'ordre du snapshot n'est pas
 * contractuel, un aléa seedé doit rendre les mêmes items quelle que soit la
 * régénération (même discipline que `langueAncienneAuHasard`).
 *
 * TOLÉRANT sur la table absente (vieux JSON) : pool vide ⇒ tirage vide, pas
 * d'exception. Les 3 tables sont dans le JSON committé (mesuré : 40/15/27),
 * mais un brouillon amputé vaut mieux qu'un écran mort.
 */
function poolArtisanat(
  snapshot: SnapshotVisiteur,
  plan: PlanArtisanat,
  dejaPris: ReadonlySet<string>,
): LigneArtisanat[] {
  const rows = snapshot.tables[TABLE_DE[plan.famille]];
  if (!Array.isArray(rows)) return [];
  const lignes = rows as readonly LigneArtisanat[];
  return lignes
    .filter((l) => {
      if (l.est_actif !== true || dejaPris.has(l.id)) return false;
      switch (plan.famille) {
        case "recette":
          // Gratuites : le quota serveur est PAR PALIER — palier EXACT.
          // Payantes (3 XP, tous paliers confondus au manuel) : 1..palier.
          return plan.coutUnitaire === 0
            ? l.niveau_requis === plan.palier
            : (l.niveau_requis ?? 0) <= plan.palier &&
                (l.niveau_requis ?? 0) >= 1;
        case "piege":
          return l.niveau === plan.palier;
        default:
          return true; // assemblages : le catalogue entier, sans palier
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * ⭐ [C1 s375] LES ENVELOPPES DEVIENNENT DES ITEMS. Plan par plan, DANS
 * L'ORDRE (les gratuites précèdent les payantes dans `composition.artisanat`,
 * et le tirage est SANS REMISE d'un plan à l'autre : une payante ne peut pas
 * redonner une recette déjà offerte).
 *
 * Pondéré par les goûts MESURÉS des vrais joueurs (`contenu/artisanat.ts`) ;
 * un item non mesuré pèse `POIDS_DEFAUT` — tout le catalogue reste tirable.
 *
 * Un pool plus petit que `nb` rend moins d'items sans lever : c'est le
 * catalogue qui manque, pas le tirage qui casse.
 */
export function tirerArtisanat(
  snapshot: SnapshotVisiteur,
  plans: readonly PlanArtisanat[],
  dejaPris: Set<string>,
  alea: Alea,
): {
  recettes: BrouillonRecette[];
  assemblages: BrouillonAssemblage[];
  pieges: BrouillonPiege[];
} {
  const recettes: BrouillonRecette[] = [];
  const assemblages: BrouillonAssemblage[] = [];
  const pieges: BrouillonPiege[] = [];

  for (const plan of plans) {
    const pool = poolArtisanat(snapshot, plan, dejaPris);
    const table = POIDS_DE[plan.famille];
    const tires = tirerSansRemisePondere(
      pool,
      (l) => poidsDe(l.nom ?? "", table),
      plan.nb,
      alea,
    );
    for (const l of tires) {
      dejaPris.add(l.id);
      const instanceId = crypto.randomUUID();
      if (plan.famille === "recette") recettes.push({ instanceId, recetteId: l.id });
      else if (plan.famille === "assemblage")
        assemblages.push({ instanceId, assemblageId: l.id });
      else pieges.push({ instanceId, piegeId: l.id });
    }
  }
  return { recettes, assemblages, pieges };
}

/**
 * CONVERSION — `{ tirage, composition }` → `BrouillonVisiteur`.
 * Pure : `snapshot` et `alea` injectés. `alea` sert aux CHOIX TIRÉS —
 * gratuites à `type_choix` (décision 32) ET achats à `type_choix` (s366) ;
 * un tirage sans aucun choix à remplir ne le consomme pas.
 */
export function convertirTirageEnBrouillon(
  snapshot: SnapshotVisiteur,
  resultat: { tirage: TiragePersonnage; composition: CompositionOk },
  alea: Alea,
): BrouillonVisiteur {
  const { tirage, composition } = resultat;
  const classe = classeDuSnapshot(snapshot.tables.classes, tirage.classe);
  const now = new Date().toISOString();

  // Les gratuites d'abord : leurs choix (religion du prêtre, langue ancienne
  // du mage) participent au « sans remise » des achats (s366).
  const choixGratuites = choixDesGratuites(snapshot, classe, tirage, alea);

  const competences: BrouillonCompetence[] = composition.achats.map((a) => ({
    instanceId: crypto.randomUUID(),
    competenceId: a.competenceId,
    niveauAcquis: a.niveau,
    choixAchat: a.choix ?? null,
  }));
  resoudreChoixDesAchats(snapshot, competences, choixGratuites, alea);

  const sorts: BrouillonSort[] = [];
  const prieres: BrouillonPriere[] = [];
  for (const m of composition.achatsMagie) {
    const base = {
      instanceId: crypto.randomUUID(),
      niveauSort: m.config.niveau,
      zoneChoisie: m.config.zone,
      porteeChoisie: m.config.portee,
      dureeChoisie: m.config.duree,
    };
    if (m.type === "sort") {
      sorts.push({ ...base, sortId: m.modeleId });
    } else {
      const { niveauSort, ...reste } = base;
      prieres.push({ ...reste, priereId: m.modeleId, niveauPriere: m.config.niveau });
    }
  }

  // ⭐ [C1 s375] L'artisanat DÛ : la composition porte les enveloppes, les
  // items se tirent ICI (D34). Le rejeu (`rejouerBrouillon`) les joue APRÈS
  // les compétences — la gate serveur exige la compétence-mère.
  const artisanat = tirerArtisanat(
    snapshot,
    composition.artisanat,
    new Set<string>(),
    alea,
  );

  return {
    schemaVersion: 2,
    meta: {
      creeLe: now,
      modifieLe: now,
      snapshotGenereLe: snapshot.manifest.genere_le,
      etapeCourante: 1,
    },
    etape1: {
      // Le joueur nomme et raconte son personnage au wizard (§2.5).
      nom: "",
      gnCompletes: 0,
      miniGnCompletes: 0,
      ouverturesTerrain: 0,
      estCroyant: tirage.religionId != null,
      religionId: tirage.religionId ?? null,
    },
    etape2: {
      raceId: tirage.raceId,
      // Sous-type Chiméride : choisi au wizard (le tirage ne le porte pas).
    },
    etape3: {
      // ⭐⭐ [DÉCISION 42, s372] Un tirage `inapteMagie` (Demi-Orc martial —
      // la seule source aujourd'hui) POSE le trait racial : c'est l'arbitrage
      // Fred « trait auto pour guerrier/voleur en 🎲 ». Le trait est GRATUIT
      // (quota `nb_traits_raciaux` = 1, format serveur mesuré C79). Résolu
      // par NOM au snapshot — échec bruyant si absent, jamais un id en dur.
      // 🧭 ne passe jamais ici avec `inapteMagie` (le visiteur est apte,
      // décisions 41+42) : le joueur 🧭 choisit son trait au wizard.
      traitsRaciauxChoisis: tirage.inapteMagie
        ? [
            {
              trait_id: traitInapteId(snapshot),
              est_gratuit: true,
              xp_depense: 0,
            },
          ]
        : [],
    },
    etape4: {
      classeId: classe.id,
      choixParCompetence: choixGratuites,
    },
    acquisitions: {
      competences,
      sorts,
      prieres,
      pieges: artisanat.pieges,
      recettes: artisanat.recettes,
      assemblages: artisanat.assemblages,
    },
  };
}

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
  BrouillonCompetence,
  BrouillonPriere,
  BrouillonSort,
  BrouillonVisiteur,
} from "../brouillon/types";
import type { Classe, Competence, Langue, SnapshotVisiteur } from "../snapshot";
import type { Alea, TiragePersonnage } from "./resoudre";
import type { CompositionOk } from "./types";

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
      traitsRaciauxChoisis: [],
    },
    etape4: {
      classeId: classe.id,
      choixParCompetence: choixGratuites,
    },
    acquisitions: {
      competences,
      sorts,
      prieres,
      pieges: [],
      recettes: [],
      assemblages: [],
    },
  };
}

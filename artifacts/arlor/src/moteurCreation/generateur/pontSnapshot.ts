/**
 * [VIS-8 lot 🎲, s364] LE PONT PROD — snapshot visiteur → `DepsResolveur`.
 *
 * Trois transformations, toutes MESURÉES sur le snapshot du jour (s364) :
 *
 * 1. COMPÉTENCES par classe : éligibilité (`classes_requises` vide ou
 *    contenant la classe) puis départage des homonymes par priorité de
 *    `categorie` (classe > generale > autre). Sans ce départage, 4 paires
 *    mage/prêtre entrent en collision et `CatalogueCompetences` LÈVE
 *    (Assemblage de Runes, Canalisation, Développement Spirituel,
 *    Développement Spirituel Supérieur).
 *    ⚠️ La DB nomme `prerequis_competences` ce que le moteur lit sous
 *    `prerequis` (couts.ts, via un `?.` silencieux). Le mapping vit ICI et
 *    nulle part ailleurs — sans lui, le générateur compose sans voir un
 *    seul prérequis (attrapé s364 : sonde 1 aveugle vs sonde 2 corrigée,
 *    mêmes 800/800 mais l'ordre des chaînes de prérequis change).
 *
 * 2. MAGIE : modèles de NIVEAU 1 actifs seulement — le générateur n'achète
 *    que du niveau 1 (72 sorts / 64 prières, mêmes effectifs que les
 *    fixtures). Sans le filtre, « Poigne de fer » (niveau 6, présent dans
 *    Combat ET Terre) fait lever `CatalogueMagie` sur un doublon de nom.
 *
 * 3. MONDE : races / race_traits / traits_raciaux / religions passent
 *    tels quels (le résolveur ne lit que ses champs). `objets_requis` est
 *    GARDÉ BRUYAMMENT : le JSON committé ne le porte pas (dette
 *    [SNAPSHOT-COMMIT-STUB]) — tirer sans la carte ferait croire
 *    qu'aucune race n'exige de costume et proposerait des Gobelins à un
 *    joueur sans masque. En prod, le prebuild fournit la carte.
 */
import type { SnapshotVisiteur } from "../snapshot";
import { CatalogueCompetences } from "./catalogue";
import {
  CatalogueMagie,
  type PriereModele,
  type SortModele,
} from "./catalogueMagie";
import type { Catalogues } from "./composer";
import type { ContenuClasse } from "./contenu/commun";
import { CONTENU_GUERRIER } from "./contenu/guerrier";
import { CONTENU_MAGE } from "./contenu/mage";
import { CONTENU_PRETRE } from "./contenu/pretre";
import { CONTENU_VOLEUR } from "./contenu/voleur";
import type { DepsResolveur, MondeResolveur } from "./resoudre";
import type { ClasseId, CompetenceCatalogue } from "./types";

/** Levée quand le snapshot ne permet pas de tirer honnêtement. */
export class ErreurPontSnapshot extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurPontSnapshot";
  }
}

const CLASSES: readonly ClasseId[] = ["guerrier", "mage", "pretre", "voleur"];

/* ------------------------------------------------------------------ */
/* Lignes brutes du snapshot (sous-ensemble structurel que le pont lit) */
/* ------------------------------------------------------------------ */

interface CompetenceSnapshotRow {
  id: string;
  nom: string;
  categorie: string | null;
  classes_requises: string[] | null;
  type_achat: string | null;
  est_actif: boolean | null;
  niveaux: unknown;
  /** Nom DB du champ que le moteur lit sous `prerequis`. */
  prerequis_competences: unknown;
}

interface ModeleMagieSnapshotRow {
  niveau: number | null;
  est_actif: boolean | null;
}

/** [C1 s375] Ligne de `recettes_alchimie` — seuls ces 2 champs comptent ici. */
interface RecetteSnapshotRow {
  est_actif: boolean | null;
  niveau_requis: number | null;
}

function table<T>(
  snapshot: SnapshotVisiteur,
  nom: string,
  motifSiVide: string
): readonly T[] {
  const rows = snapshot.tables[nom];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ErreurPontSnapshot(
      `Le snapshot ne contient pas « ${nom} » : ${motifSiVide}`
    );
  }
  return rows as readonly T[];
}

/* ------------------------------------------------------------------ */
/* 1. Compétences                                                      */
/* ------------------------------------------------------------------ */

/** Ligne DB → forme que le moteur consomme. LE mapping `prerequis` vit ici. */
export function versCompetenceCatalogue(
  c: CompetenceSnapshotRow
): CompetenceCatalogue {
  return {
    id: c.id,
    nom: c.nom,
    categorie: c.categorie,
    classes_requises: c.classes_requises,
    type_achat: c.type_achat,
    est_actif: c.est_actif,
    niveaux: c.niveaux as CompetenceCatalogue["niveaux"],
    prerequis:
      (c.prerequis_competences as CompetenceCatalogue["prerequis"]) ?? null,
  };
}

/**
 * Le catalogue d'UNE classe : éligibles (`classes_requises` vide ou
 * contenant la classe), homonymes départagés par `categorie`
 * (classe > generale > autre) — exactement la règle des fixtures.
 */
export function competencesPourClasse(
  competences: readonly CompetenceSnapshotRow[],
  classe: ClasseId
): CompetenceCatalogue[] {
  const eligibles = competences.filter(
    (c) =>
      c.est_actif === true &&
      (!c.classes_requises ||
        c.classes_requises.length === 0 ||
        c.classes_requises.includes(classe))
  );
  const priorite = (c: CompetenceSnapshotRow): number =>
    c.categorie === classe ? 0 : c.categorie === "generale" ? 1 : 2;
  const parNom = new Map<string, CompetenceSnapshotRow>();
  for (const c of [...eligibles].sort((a, b) => priorite(a) - priorite(b))) {
    if (!parNom.has(c.nom)) parNom.set(c.nom, c);
  }
  return [...parNom.values()].map(versCompetenceCatalogue);
}

/* ------------------------------------------------------------------ */
/* 2. Magie                                                            */
/* ------------------------------------------------------------------ */

/** Modèles de niveau 1 actifs — la seule matière que le générateur achète. */
export function modelesMagieNiveau1(snapshot: SnapshotVisiteur): {
  sorts: SortModele[];
  prieres: PriereModele[];
} {
  const sorts = table<ModeleMagieSnapshotRow>(
    snapshot,
    "sorts",
    "sans modèles de sorts, aucun mage ne peut être tiré."
  ).filter((s) => s.est_actif === true && s.niveau === 1);
  const prieres = table<ModeleMagieSnapshotRow>(
    snapshot,
    "prieres",
    "sans modèles de prières, aucun prêtre ne peut être tiré."
  ).filter((p) => p.est_actif === true && p.niveau === 1);
  if (sorts.length === 0 || prieres.length === 0) {
    throw new ErreurPontSnapshot(
      "Le snapshot ne contient aucun modèle de magie de niveau 1 : " +
        "le générateur ne peut pas composer de lanceur."
    );
  }
  return {
    sorts: sorts as unknown as SortModele[],
    prieres: prieres as unknown as PriereModele[],
  };
}

/* ------------------------------------------------------------------ */
/* 2 bis. Artisanat                                                    */
/* ------------------------------------------------------------------ */

/**
 * ⭐ [C1 s375] LES TAILLES DES CATALOGUES D'ARTISANAT — ce que le composeur
 * doit connaître pour BORNER les recettes payantes (D-C) : au-delà du
 * catalogue, une recette de plus n'existe pas, et le tirage sans remise de
 * `versBrouillon` rendrait moins d'items que la fiche n'en annonce (D34).
 *
 * ⚠️ TOLÉRANT, à l'inverse des tables de `table<T>()` : un vieux snapshot
 * sans `recettes_alchimie` rend 0/0 ⇒ zéro payante planifiée. Les GRATUITES,
 * elles, restent dues (elles ne dépendent d'aucun compte). Refuser de
 * construire le pont pour ça fermerait le générateur ENTIER alors que seul
 * le grain manque. Le compte réel est attesté par le test du pont.
 *
 * Typage : le snapshot committé peut être en retard sur le type généré
 * (dette [SNAPSHOT-COMMIT-STUB]) — même assertion structurelle que les
 * autres tables, sur le sous-ensemble de champs réellement lu.
 */
export function taillesArtisanat(snapshot: SnapshotVisiteur): {
  recettesNiv1: number;
  recettesNiv2: number;
} {
  const rows = snapshot.tables.recettes_alchimie;
  const recettes: readonly RecetteSnapshotRow[] = Array.isArray(rows)
    ? (rows as readonly RecetteSnapshotRow[])
    : [];
  const compte = (niveau: number) =>
    recettes.filter((r) => r.est_actif === true && r.niveau_requis === niveau)
      .length;
  return { recettesNiv1: compte(1), recettesNiv2: compte(2) };
}

/* ------------------------------------------------------------------ */
/* 3. Assemblage                                                       */
/* ------------------------------------------------------------------ */

/**
 * Construit les dépendances du résolveur depuis un snapshot visiteur.
 * Lève `ErreurPontSnapshot` (message en clair pour l'écran) si le
 * snapshot ne permet pas de tirer honnêtement — en particulier sans la
 * carte d'équipement (`objets_requis`).
 */
export function depsDepuisSnapshot(snapshot: SnapshotVisiteur): DepsResolveur {
  const competences = table<CompetenceSnapshotRow>(
    snapshot,
    "competences",
    "aucun catalogue de compétences, rien à composer."
  );

  const objetsRequis = snapshot.tables.objets_requis;
  if (!Array.isArray(objetsRequis) || objetsRequis.length === 0) {
    throw new ErreurPontSnapshot(
      "Le snapshot ne contient pas la carte d'équipement (objets_requis) : " +
        "impossible de savoir quelles races exigent un costume, donc " +
        "impossible de tirer un personnage honnêtement. En production le " +
        "prebuild fournit cette carte ; en local, régénère le snapshot."
    );
  }

  const magieModeles = modelesMagieNiveau1(snapshot);
  const magie = new CatalogueMagie(magieModeles);
  const magieVide = new CatalogueMagie({ sorts: [], prieres: [] });

  const contenus: Record<ClasseId, ContenuClasse> = {
    guerrier: CONTENU_GUERRIER,
    mage: CONTENU_MAGE,
    pretre: CONTENU_PRETRE,
    voleur: CONTENU_VOLEUR,
  };

  // ⭐ [C1 s375] Les tailles vont à TOUTES les classes : l'Alchimie n'est pas
  // réservée au mage (un guerrier qui la prend a droit à ses recettes aussi).
  const artisanat = taillesArtisanat(snapshot);

  const parClasse = {} as Record<
    ClasseId,
    { cats: Catalogues; contenu: ContenuClasse }
  >;
  for (const classe of CLASSES) {
    parClasse[classe] = {
      cats: {
        competences: new CatalogueCompetences(
          competencesPourClasse(competences, classe)
        ),
        magie: classe === "mage" || classe === "pretre" ? magie : magieVide,
        artisanat,
      },
      contenu: contenus[classe],
    };
  }

  const monde = {
    races: table(snapshot, "races", "aucune race à tirer."),
    race_traits: table(snapshot, "race_traits", "les traits raciaux sont introuvables."),
    traits_raciaux: table(snapshot, "traits_raciaux", "les traits raciaux sont introuvables."),
    religions: table(snapshot, "religions", "aucune religion à apparier."),
    objets_requis: objetsRequis,
  } as unknown as MondeResolveur;

  return { parClasse, monde };
}

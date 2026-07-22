import type { ClasseId, CompetenceCatalogue } from "./types";

/**
 * [VIS-8 lot 2a] Catalogue de compétences indexé par nom + verrous §2.5.
 *
 * Le catalogue est INJECTÉ : fixture MCP dans les tests (chiffres de prod
 * attestés), snapshot actif en production. Le contenu des archétypes
 * référence les compétences PAR NOM (comme `prerequis_competences` en base) ;
 * un test d'intégrité casse si un nom référencé disparaît du catalogue.
 */

export class CatalogueCompetences {
  private parNom = new Map<string, CompetenceCatalogue>();

  constructor(competences: readonly CompetenceCatalogue[]) {
    for (const c of competences) {
      if (c.est_actif === false) continue;
      if (this.parNom.has(c.nom)) {
        throw new Error(
          `[generateur] Collision d'homonymes au catalogue : « ${c.nom} » ` +
            `apparaît deux fois. Filtrer la fixture par classe — 4 paires ` +
            `mage/prêtre mesurées (s349) : Assemblage de Runes, Canalisation, ` +
            `Développement Spirituel, Développement Spirituel Supérieur.`
        );
      }
      this.parNom.set(c.nom, c);
    }
  }

  get(nom: string): CompetenceCatalogue | undefined {
    return this.parNom.get(nom);
  }

  /** Version stricte : lève si le contenu référence un nom inconnu. */
  exiger(nom: string): CompetenceCatalogue {
    const c = this.parNom.get(nom);
    if (!c) {
      throw new Error(
        `[generateur] Compétence inconnue du catalogue : « ${nom} » — ` +
          `le contenu des archétypes référence un nom absent ou inactif.`
      );
    }
    return c;
  }

  coutNiveau(nom: string, niveau: number): number {
    const c = this.exiger(nom);
    const n = c.niveaux.find((x) => x.niveau === niveau);
    if (!n) {
      throw new Error(
        `[generateur] « ${nom} » n'a pas de niveau ${niveau} au catalogue.`
      );
    }
    return n.cout_xp;
  }
}

/**
 * Verrous de CRÉATION (§2.5, repris par R2 §4.5) :
 * - `classes_requises` non vide et sans la classe → 0 (interdit) ;
 * - catégorie = sa classe ou générale → montée libre marche par marche,
 *   plafond création 2 ;
 * - hors-classe → niveau 1 seulement (le niveau 2 exige un maître en jeu,
 *   jamais disponible à la création). Réf. Gotcha A43 (l'archer guerrier).
 */
export function plafondCreation(
  c: CompetenceCatalogue,
  classe: ClasseId
): 0 | 1 | 2 {
  if (c.classes_requises && !c.classes_requises.includes(classe)) return 0;
  const cat = c.categorie ?? "generale";
  if (cat === classe || cat === "generale") return 2;
  return 1;
}

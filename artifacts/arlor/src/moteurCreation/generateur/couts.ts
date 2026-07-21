import { CatalogueCompetences, plafondCreation } from "./catalogue";
import type { AchatPlanifie, ClasseId } from "./types";

/**
 * [VIS-8 lot 2a] R3 — « Toujours le chemin complet » (§4.5).
 *
 * `cheminComplet` planifie TOUT ce qu'il faut acheter pour amener une
 * compétence au niveau cible : les paliers intermédiaires ET les prérequis
 * de chaque palier (récursivement), en sautant ce qui est déjà possédé.
 *
 * Le prix est CONTEXTUEL : ce qui est déjà au panier n'est pas repayé —
 * mesuré s348 : `Charge` exige Botte Secrète (8 net après un noyau ⚔️,
 * 17 sinon) ; `Mineur` et `Forge` partagent Métaux Communs (payé une fois,
 * d'où le 32 XP exact de l'Artisan).
 *
 * Verrous §2.5 appliqués : toute cible au-delà de `plafondCreation` fait
 * échouer le chemin (null) — on ne propose jamais un achat impossible.
 */

export interface EtatPossession {
  /** nom → niveau possédé (0 si absent). Gratuités incluses. */
  niveaux: Map<string, number>;
}

export function possede(etat: EtatPossession, nom: string): number {
  return etat.niveaux.get(nom) ?? 0;
}

export interface ResultatChemin {
  achats: Omit<AchatPlanifie, "couche" | "motif">[];
  total: number;
}

export function cheminComplet(
  catalogue: CatalogueCompetences,
  classe: ClasseId,
  etat: EtatPossession,
  nom: string,
  niveauCible: number,
  profondeur = 0
): ResultatChemin | null {
  if (profondeur > 8) {
    throw new Error(
      `[generateur] Cycle de prérequis suspect autour de « ${nom} ».`
    );
  }
  const c = catalogue.exiger(nom);
  const plafond = plafondCreation(c, classe);
  if (niveauCible > plafond) return null;

  const achats: ResultatChemin["achats"] = [];
  let total = 0;

  for (let niveau = possede(etat, nom) + 1; niveau <= niveauCible; niveau++) {
    // Prérequis du palier — chacun en chemin complet, AVANT le palier.
    for (const p of c.prerequis?.[String(niveau)] ?? []) {
      const sousChemin = cheminComplet(
        catalogue,
        classe,
        etat,
        p.competence_nom,
        p.niveau_min,
        profondeur + 1
      );
      if (sousChemin === null) return null;
      achats.push(...sousChemin.achats);
      total += sousChemin.total;
    }
    const coutXp = catalogue.coutNiveau(nom, niveau);
    achats.push({ competenceId: c.id, nom: c.nom, niveau, coutXp });
    total += coutXp;
    etat.niveaux.set(nom, niveau);
  }
  return { achats, total };
}

/**
 * Variante SANS effet : chiffre un chemin sur une copie de l'état
 * (pour l'affichage des prix ③ sans engager l'achat).
 */
export function prixChemin(
  catalogue: CatalogueCompetences,
  classe: ClasseId,
  etat: EtatPossession,
  nom: string,
  niveauCible: number
): number | null {
  const copie: EtatPossession = { niveaux: new Map(etat.niveaux) };
  const r = cheminComplet(catalogue, classe, copie, nom, niveauCible);
  return r === null ? null : r.total;
}

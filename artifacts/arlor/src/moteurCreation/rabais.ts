/**
 * Rabais « Acquisition de Cercle / Domaine » — SOURCE UNIQUE du calcul.
 *
 * Portage fidèle de `acheter_competence` (migration 20260617210831) et de son
 * aperçu `apercu_rabais_acquisition_competence` (migration 20260617185134) :
 * pour une acquisition de niveau 2 ou 3 d'un cercle/domaine, chaque item DÉJÀ
 * possédé dans le même cercle/domaine dont le niveau ≤ seuil réduit le coût de
 * 1 XP. Coût débité = `GREATEST(base − nb, 0)` (jamais négatif).
 *
 *   - cercle  → items = sorts   (comptés par cercle,  seuil 5 pour niv 2, 10 pour niv 3)
 *   - domaine → items = prières (comptés par domaine, mêmes seuils)
 *
 * Fonctions PURES, sans I/O ni snapshot : l'appelant fournit les niveaux des
 * items. CONSOMMÉE À DEUX ENDROITS et jamais dupliquée :
 *   - l'APERÇU   (`clientVisiteur.calculerRabais`) — affiche le prix réduit ;
 *   - le DÉBIT   (`brouillon/deriver.ts`)          — stocke `xpDepense` réduit.
 * Garder ces deux consommateurs sur la même fonction est ce qui garantit que le
 * prix affiché == le prix débité (header XP, gate « XP insuffisant », badge
 * « Gratuit », remboursement de désachat cohérents).
 */

/** Palier d'acquisition (niveau 2/3) → seuil de niveau des items comptés. */
export const SEUIL_RABAIS_PAR_NIVEAU: Record<2 | 3, number> = { 2: 5, 3: 10 };

/** Nombre d'items d'un choix éligibles au rabais (niveau ≤ seuil). */
export function nbItemsEligibles(niveauxItems: number[], seuil: number): number {
  return niveauxItems.filter((n) => n <= seuil).length;
}

/**
 * Coût effectif d'un palier après rabais : `GREATEST(base − nb, 0)`, où
 * `nb` = nombre d'items du choix dont le niveau ≤ seuil.
 */
export function coutApresRabais(
  coutBase: number,
  niveauxItems: number[],
  seuil: number
): number {
  return Math.max(coutBase - nbItemsEligibles(niveauxItems, seuil), 0);
}

/** Une ligne d'aperçu de rabais (miroir du retour SQL de l'aperçu). */
export interface LigneRabais {
  choix: string;
  niveau: number; // palier d'acquisition (2 ou 3)
  cout_base: number;
  nb: number;
  cout_final: number;
  rabais: number;
}

/**
 * Toutes les lignes de rabais (paliers 2 ET 3) pour chaque choix ayant des items.
 * @param baseParNiveau coût catalogue des paliers `{ 2, 3 }` de la compétence.
 * @param itemsParChoix choix → niveaux des items déjà possédés (sorts d'un
 *                      cercle / prières d'un domaine).
 */
export function calculerLignesRabais(
  baseParNiveau: { 2: number; 3: number },
  itemsParChoix: Map<string, number[]>
): LigneRabais[] {
  const rows: LigneRabais[] = [];
  for (const [choix, niveauxItems] of itemsParChoix) {
    for (const niveau of [2, 3] as const) {
      const base = baseParNiveau[niveau];
      const seuil = SEUIL_RABAIS_PAR_NIVEAU[niveau];
      const coutFinal = coutApresRabais(base, niveauxItems, seuil);
      rows.push({
        choix,
        niveau,
        cout_base: base,
        nb: nbItemsEligibles(niveauxItems, seuil),
        cout_final: coutFinal,
        rabais: base - coutFinal,
      });
    }
  }
  return rows;
}

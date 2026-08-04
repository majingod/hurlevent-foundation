/**
 * [VIS-8] Quand l'accueil des portes s'affiche-t-il ?
 *
 * Règle mesurée sur le flux réel du wizard (s348) : l'accueil ne concerne
 * qu'un démarrage À ZÉRO. Toute reprise retombe où le joueur en était :
 * - reprise `?id=` (tableau de bord, admin, campagne) → jamais ;
 * - mode admin / mode campagne → jamais ;
 * - brouillon repris à une étape > 1 → jamais (on ne remet pas un joueur
 *   en route devant le menu) ;
 * - une fois une porte franchie (`accueilFranchi`), « Précédent » depuis
 *   l'étape 2 ne le fait pas réapparaître.
 *
 * Fonction PURE : appelée par `PersonnageNouveauV2` APRÈS le positionnement
 * NAV-2 (l'étape passée ici est l'étape réellement affichable).
 */

export interface ContexteAccueil {
  /** `GENERATEUR_ACTIF` — allumé depuis s373 ; `false` referme les 2 portes. */
  actif: boolean;
  /** Une porte a déjà été choisie dans cette session de wizard. */
  accueilFranchi: boolean;
  modeAdmin: boolean;
  modeCampagne: boolean;
  /** Reprise d'un personnage précis via `?id=`. */
  reprise: boolean;
  /** Étape courante après positionnement (1..TOTAL_STEPS). */
  etape: number;
}

export function doitMontrerAccueil(c: ContexteAccueil): boolean {
  return (
    c.actif &&
    !c.accueilFranchi &&
    !c.modeAdmin &&
    !c.modeCampagne &&
    !c.reprise &&
    c.etape === 1
  );
}

/**
 * BUG s312-2 : `xpDisponible` (prop reçue par Etape2_V2) est le disponible du
 * BANDEAU global, qui a déjà retranché `xpDeltaCourant` (= le même delta
 * traits, remonté via `onXpDeltaChange`). `JaugeXP` retranche ELLE-MÊME
 * `coutEnCours.delta` de ce qu'on lui donne → si on lui passe `xpDisponible`
 * tel quel, le delta est soustrait deux fois. On lui passe donc le
 * disponible « brut », c.-à-d. AVANT le delta de l'étape courante, pour que
 * sa propre soustraction retombe sur la même valeur que le bandeau.
 */
export function xpDisponibleJaugeEtape2(
  xpDisponibleBandeau: number,
  xpTraits: number,
  xpTraitsPersistes: number,
): number {
  return xpDisponibleBandeau + (xpTraits - xpTraitsPersistes);
}

/**
 * BUG s313 : en CRÉATION, `xp_total` avant sauvegarde de la race = les XP
 * DÉCLARÉS à l'étape 1 (GN/mini/ouvertures), ADDITIFS à `xp_depart`. L'ancienne
 * formule `xp_depart − xp_total` les retranchait → l'étape 2 affichait
 * `xp_depart` seul, et les XP de GN « disparaissaient » jusqu'à l'étape suivante.
 * On projette donc le départ COMPLET tant qu'aucune race n'est persistée
 * (création). Dès qu'une race est enregistrée (édition admin d'un perso ayant
 * accumulé de l'XP de jeu, `xp_total` reflète déjà `xp_depart`), on conserve
 * STRICTEMENT le comportement d'origine → zéro régression admin.
 */
export function gainDepartProjete(
  raceDejaPersistee: boolean,
  xpDepartCible: number,
  xpTotalServeur: number,
): number {
  return raceDejaPersistee
    ? xpDepartCible > xpTotalServeur
      ? xpDepartCible - xpTotalServeur
      : 0
    : xpDepartCible;
}

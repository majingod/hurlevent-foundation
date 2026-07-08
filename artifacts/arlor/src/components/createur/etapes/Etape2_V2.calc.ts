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

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

/**
 * [WIZARD-TRAIT-INCOMPATIBLE-NON-GRISE, s373] Miroir de la garde serveur
 * `valider_etape_3` (volet 3, s370) : le trait « Inapte à la magie » se
 * propose GRISÉ — avec sa raison — quand le personnage possède déjà des
 * sorts ou des prières. La raison DÉCOMPOSE ses causes (Gotcha C78) et
 * reprend MOT POUR MOT la phrase du refus serveur : l'écran et la gate
 * racontent la même chose. `null` = rien à griser. Le consommateur (C84)
 * est la carte trait d'`Etape2_V2.tsx` ; la reconnaissance du trait se
 * fait par le NOM (`TRAIT_INAPTE`), comme au serveur.
 */
export function raisonTraitInapteBloque(
  nbSorts: number,
  nbPrieres: number,
): string | null {
  if (nbSorts + nbPrieres <= 0) return null;
  const detail =
    nbSorts > 0 && nbPrieres > 0
      ? `${nbSorts} sort(s) et ${nbPrieres} prière(s)`
      : nbSorts > 0
        ? `${nbSorts} sort(s)`
        : `${nbPrieres} prière(s)`;
  return (
    `Ce personnage possède déjà ${detail} : le trait « Inapte à la magie » ` +
    `lui retirerait définitivement tous ses points de spiritualité. ` +
    `Retirez sa magie avant de choisir ce trait.`
  );
}

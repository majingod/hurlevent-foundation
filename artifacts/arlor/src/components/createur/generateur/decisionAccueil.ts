/**
 * [VIS-8] Quand l'accueil des portes s'affiche-t-il ?
 *
 * Règle mesurée sur le flux réel du wizard (s348) : l'accueil ne concerne
 * qu'un démarrage À ZÉRO. Toute reprise retombe où le joueur en était :
 * - [s394b] une reprise est permise tant que le personnage n'a rien reçu ;
 *   ce qui ferme les portes, c'est ce que le personnage porte déjà, pas la
 *   manière dont on est arrivé (`?id=` ou non) ;
 * - mode admin / mode campagne → jamais ;
 * - brouillon repris à une étape > 1 → jamais (on ne remet pas un joueur
 *   en route devant le menu) ;
 * - une fois une porte franchie (`accueilFranchi`), « Précédent » depuis
 *   l'étape 2 ne le fait pas réapparaître.
 *
 * ⭐⭐ [s375-v2 défaut 1c, piège C88] `xpDepense` : LE CRITÈRE MANQUANT.
 * L'étape ne suffit PAS. La condition d'origine (`etape === 1`) lisait
 * l'étape AFFICHÉE du wizard — vraie pour un perso manuel, FAUSSE pour un
 * perso généré : après un tirage appliqué, le wizard s'ouvre à l'étape 1 (le
 * joueur nomme, D43) alors que `etape_creation` vaut 10 et que les achats
 * sont déjà en base. Le commentaire s368 #3 « jamais sur un personnage
 * avancé » lisait donc le mauvais état : le retour aux portes restait offert,
 * un second tirage s'empilait sur le premier (12 refus XP, hybride ⚗️/🔮 —
 * mesuré s375). Le seul état qui dit « ce personnage a déjà reçu quelque
 * chose » est `personnages.xp_depense`. Le critère est posé ICI, dans la
 * fonction PARTAGÉE, donc sur les DEUX portes (accueil initial ET retour) :
 * aucun chemin — rechargement, brouillon local adopté — ne le contourne.
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
  /** Étape courante après positionnement (1..TOTAL_STEPS). */
  etape: number;
  /**
   * ⭐ [s394b] `personnages.etape_creation` — l'étape SERVEUR, pas celle qui
   * est affichée. Un brouillon sans nom et un personnage finalisé repartent
   * tous deux de l'étape 1 À L'ÉCRAN : seule l'étape serveur dit si le
   * personnage est encore vierge.
   */
  etapeServeur: number;
  /**
   * ⭐ [s375-v2] `personnages.xp_depense`. > 0 = le personnage porte déjà des
   * achats (tirage appliqué, ou wizard manuel entamé) : plus aucune porte.
   */
  xpDepense: number;
}

export function doitMontrerAccueil(c: ContexteAccueil): boolean {
  return (
    c.actif &&
    !c.accueilFranchi &&
    !c.modeAdmin &&
    !c.modeCampagne &&
    c.etape === 1 &&
    c.etapeServeur <= 1 &&
    c.xpDepense === 0
  );
}

export interface ContexteSortieTirage {
  modeAdmin: boolean;
  modeCampagne: boolean;
  modeVisiteur: boolean;
  /** Le personnage n'a pas de nom (D43). */
  sansNom: boolean;
  /** `personnages.etape_creation` LU EN BASE. Absent ⇒ passe 0 (fail-closed). */
  etapeServeur: number;
  /** XP déjà dépensée. 0 ⇒ ce n'est pas un tirage appliqué. */
  xpDepense: number;
}

/**
 * ⭐ Le bouton « Repartir d'un autre tirage » n'est offert QUE sur l'état exact du
 * cul-de-sac : un personnage GÉNÉRÉ, jamais nommé, dont les portes ne reviendront pas.
 * ⛔ C120 : on mesure ce que le personnage PORTE, jamais par où il est arrivé.
 * ⛔ Fail-closed : une donnée manquante FERME le bouton.
 */
export function doitOffrirAutreTirage(c: ContexteSortieTirage): boolean {
  return (
    !c.modeAdmin &&
    !c.modeCampagne &&
    !c.modeVisiteur &&
    c.sansNom &&
    c.etapeServeur >= 5 &&
    c.xpDepense > 0
  );
}

// ============================================================
// HURLEVENT — Constructeurs de messages de notification
// Utilisé dans : panel admin (11a+11b), toute action admin
// touchant un personnage
//
// RÈGLE : ne jamais construire de message notification inline
// dans un composant React — toujours utiliser ces fonctions
// ============================================================

/** XP attribué manuellement hors événement */
export const msgXPManuel = (
  montant: number,
  raison: string
): string =>
  `L'organisation vous a attribué ${montant} XP hors événement. Raison : ${raison}.`;

/** Changement de statut d'une inscription à un événement */
export const msgChangementStatutInscription = (
  titreEvenement: string,
  labelStatut: string
): string =>
  `Votre inscription à ${titreEvenement} a été mise à jour : ${labelStatut}.`;

/** Approbation d'une compétence apprise via maître */
export const msgApprobationMaitre = (
  nomCompetence: string,
  niveau: number,
  nomMaitre: string
): string =>
  `Votre compétence ${nomCompetence} niveau ${niveau} avec le maître ${nomMaitre} a été approuvée par l'organisation.`;

/** Refus d'une compétence apprise via maître */
export const msgRefusMaitre = (
  nomCompetence: string,
  niveau: number,
  nomMaitre: string,
  raison?: string
): string =>
  `Votre compétence ${nomCompetence} niveau ${niveau} avec le maître ${nomMaitre} a été refusée.${
    raison ? ` Raison : ${raison}.` : ""
  } Contactez l'organisation.`;

/** Attribution XP via événement (complément au RPC attribuer_xp_evenement) */
export const msgXPEvenement = (
  titreEvenement: string,
  montant: number
): string =>
  `Vous avez reçu ${montant} XP pour votre participation à ${titreEvenement}.`;

/** Mort permanente d'un personnage */
export const msgMortPersonnage = (nomPersonnage: string): string =>
  `Votre personnage ${nomPersonnage} est décédé de façon permanente.`;

/** Modification manuelle du niveau d'un personnage */
export const msgModificationNiveau = (
  nomPersonnage: string,
  nouveauNiveau: number
): string =>
  `Le niveau de votre personnage ${nomPersonnage} a été mis à jour : niveau ${nouveauNiveau}.`;

/**
 * D54 (s382) — textes joueur réécrits après la pose d'office de la porte
 * magique (migration 20260808062934). « Acquisition de Sort »/« Acquisition
 * de Prière » ne sont plus un achat : ces textes ne doivent plus inviter à
 * les acheter, mais désigner le Cercle/Domaine comme le geste réel.
 *
 * Extraites en fonctions pures (plutôt que laissées en littéral JSX inline)
 * pour être testables au caractère près (C101) — voir
 * `textePorteMagique.test.ts`.
 */

/** Étape 5 — astuce affichée en tête de catégorie mage/prêtre. */
export function texteAstucePorteMagique(categorie: "mage" | "pretre"): string {
  return categorie === "mage"
    ? "Achetez un Cercle pour créer vos sorts à l'étape 6."
    : "Achetez un Domaine pour créer vos prières à l'étape 7.";
}

/** Étape 6 — cartouche « Sorts arcaniques indisponibles ». */
export function texteIndisponibleSorts(): string {
  return "Pour acquérir des sorts, ce personnage doit d'abord acheter un Cercle à l'étape 5 (compétence « Acquisition de Cercle »). L'accès s'ouvre en même temps.";
}

/** Étape 7 — cartouche « Prières divines indisponibles ». */
export function texteIndisponiblePrieres(): string {
  return "Pour acquérir des prières, ce personnage doit d'abord acheter un Domaine à l'étape 5 (compétence « Acquisition de Domaine »). L'accès s'ouvre en même temps.";
}

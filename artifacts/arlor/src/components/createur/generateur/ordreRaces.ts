/**
 * [VIS-8 lot 1] Ordre d'affichage des races sur l'écran de constat
 * « De quoi as-tu l'air ? » — contrat de la maquette validée s346 :
 *
 *   1. les races SANS exigence de costume (Humain), ordre alphabétique ;
 *   2. les races à costume SANS approbation, ordre alphabétique ;
 *   3. les races à approbation de l'organisation, ordre alphabétique
 *      (toujours proposées, jamais masquées — décision Fred s340).
 *
 * Le critère « approbation » n'existe pas en base : il est porté PAR NOM,
 * exactement comme dans `Etape2_V2` (Chiméride / Les Non-Races). Si une
 * colonne dédiée arrive un jour, brancher ici et dans `Etape2_V2`.
 */

const RACES_APPROBATION = new Set(["Chiméride", "Les Non-Races"]);

export function raceDemandeApprobation(nom: string): boolean {
  return RACES_APPROBATION.has(nom);
}

export function ordonnerRaces<T extends { nom: string }>(
  races: readonly T[],
  aExigence: (race: T) => boolean
): T[] {
  const rang = (r: T): number =>
    !aExigence(r) ? 0 : raceDemandeApprobation(r.nom) ? 2 : 1;
  return [...races].sort(
    (a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, "fr")
  );
}

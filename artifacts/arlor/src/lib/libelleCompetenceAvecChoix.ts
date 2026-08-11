// s392 · Libellé d'un badge de compétence, avec ses sous-choix résolus
// (langue / religion / texte libre) quand ils sont fournis.

export function libelleCompetenceAvecChoix(
  nom: string,
  niveau: number | null,
  choix?: string[] | null,
): string {
  const base = niveau != null ? `${nom} ${niveau}` : nom;
  if (!choix || choix.length === 0) return base;
  return `${base} · ${choix.join(", ")}`;
}

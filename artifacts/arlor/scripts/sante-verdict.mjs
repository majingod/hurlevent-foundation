/**
 * sante-verdict.mjs — s409, D66. Pur, sans réseau : calcule le verdict à
 * partir de la réponse déjà reçue de la RPC sante_publique(). Extrait de
 * verifier-sante.mjs pour être testable sans appel HTTP (même esprit que
 * verifier-derive-snapshot.mjs : la mesure et le verdict sont deux gestes
 * distincts).
 *
 * Rouge (code 1) ssi l'un des comptes ci-dessous est non nul OU absent — un
 * champ manquant n'est JAMAIS vert (silence n'est jamais vert). erreurs_24h
 * et migrations sont de l'information : ils ne rougissent jamais, quelle que
 * soit leur valeur.
 */

const CHAMPS_ROUGES = [
  'invariants.xp',
  'invariants.pv',
  'invariants.ps',
  'fixtures.anon',
  'fixtures.authenticated',
  'definer_anon',
  'c119_rouges',
];

function lire(reponse, chemin) {
  return chemin
    .split('.')
    .reduce((acc, cle) => (acc && typeof acc === 'object' ? acc[cle] : undefined), reponse);
}

export function verdictSante(reponse) {
  const motifs = [];

  for (const chemin of CHAMPS_ROUGES) {
    const valeur = lire(reponse, chemin);
    if (typeof valeur !== 'number') {
      motifs.push(`${chemin} : champ absent ou invalide (jamais vert à vide)`);
    } else if (valeur !== 0) {
      motifs.push(`${chemin} = ${valeur} (attendu 0)`);
    }
  }

  return {
    code: motifs.length > 0 ? 1 : 0,
    motifs,
    info: {
      erreurs_24h: lire(reponse, 'erreurs_24h'),
      migrations: lire(reponse, 'migrations'),
    },
  };
}

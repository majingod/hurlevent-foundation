#!/usr/bin/env node
/**
 * Gate de santé publique (s409, D66).
 *
 * POURQUOI. Le front n'avait aucune surveillance : une régression en prod
 * (invariant cassé, fixture exposée à anon, vue C119 rouge) n'était vue que
 * si un joueur ou un membre de l'orga la remarquait et la signalait.
 * `sante_publique()` porte les comptes ; ce script les appelle et les
 * imprime, une fois par jour (voir `.github/workflows/sante.yml`).
 *
 * MAISON. Même structure que `verifier-derive-snapshot.mjs` : URL_BASE,
 * 3 essais 0/2/5 s, ⛔ pas de réessai sur une 4xx, sortie 2 si clé absente ou
 * base injoignable (silence n'est jamais vert). Le verdict lui-même (quels
 * comptes rougissent) vit dans `sante-verdict.mjs`, pur et testable sans
 * réseau.
 *
 * SORTIES :
 *   0 = joignable ET tous les comptes nommés sont à 0
 *   1 = joignable ET au moins un compte nommé est non nul ou absent
 *   2 = INJOIGNABLE / non mesuré (réseau, clé, HTTP, réponse illisible)
 */

import { verdictSante } from './sante-verdict.mjs';

// Même ref de projet que verifier-derive-snapshot.mjs (aucune clé écrite ici).
const URL_BASE = process.env.VITE_SUPABASE_URL || 'https://dezocltwpuhbvpxwcbdy.supabase.co';
const CLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const DELAI_MS = 20_000;
const ESSAIS = [0, 2_000, 5_000];

function injoignable(raison) {
  console.error(`\n🔌 SANTÉ NON MESURÉE — ${raison}`);
  console.error('   ⛔ Ce n\'est PAS un feu vert : la mesure n\'a pas eu lieu.');
  process.exit(2);
}

if (!CLE) {
  console.error('\n   GESTE : GitHub → Settings → Secrets and variables → Actions →');
  console.error('           New repository secret → nom exact VITE_SUPABASE_PUBLISHABLE_KEY');
  injoignable('VITE_SUPABASE_PUBLISHABLE_KEY absente de l\'environnement');
}

console.log('🔍 Santé publique : appel de sante_publique()');
console.log(`   base : ${URL_BASE}`);

let reponse;
let dernierEchec = 'aucun essai';
for (const [i, attente] of ESSAIS.entries()) {
  if (attente > 0) {
    console.log(`   … nouvel essai dans ${attente / 1000} s (${i + 1}/${ESSAIS.length})`);
    await new Promise((r) => setTimeout(r, attente));
  }
  try {
    const rep = await fetch(`${URL_BASE}/rest/v1/rpc/sante_publique`, {
      method: 'POST',
      headers: {
        apikey: CLE,
        Authorization: `Bearer ${CLE}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(DELAI_MS),
    });
    // Une clé refusée (4xx) ne se répare pas en réessayant : on s'arrête net.
    if (rep.status >= 400 && rep.status < 500) {
      injoignable(`la RPC sante_publique répond HTTP ${rep.status} (clé refusée ou RPC absente)`);
    }
    if (!rep.ok) {
      dernierEchec = `HTTP ${rep.status}`;
      continue;
    }
    reponse = await rep.json();
    break;
  } catch (err) {
    dernierEchec = `${err?.name ?? 'erreur'} : ${err?.message ?? err}`;
  }
}
if (reponse === undefined) {
  injoignable(`base injoignable après ${ESSAIS.length} essais (dernier : ${dernierEchec})`);
}

const verdict = verdictSante(reponse);

console.log(`\n📋 mesuré le : ${reponse?.mesure_le ?? '?'}`);
console.log(`   erreurs_24h : ${JSON.stringify(verdict.info.erreurs_24h)} (information)`);
console.log(`   migrations  : ${JSON.stringify(verdict.info.migrations)} (information)`);

if (verdict.code === 1) {
  console.error(`\n❌ SANTÉ ROUGE : ${verdict.motifs.length} compte(s) hors norme.`);
  for (const motif of verdict.motifs) console.error(`   • ${motif}`);
  process.exit(1);
}

console.log('\n✅ Santé publique : tous les comptes surveillés sont à 0.');
process.exit(0);

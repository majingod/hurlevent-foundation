#!/usr/bin/env node
/**
 * Gate de dérive de la capture visiteur (s401).
 *
 * POURQUOI. `snapshotVisiteur.json` est committé, et la suite de tests le lit
 * hors ligne par construction. Les gardes de `snapshot.integrity.test.ts`
 * attrapent une TABLE qui disparaît ; elles ne peuvent pas voir une COLONNE qui
 * APPARAÎT en base (cas `competences.exige_ps`, s369 → découvert seulement en
 * s399 : la garde d'inaptitude recevait `undefined` et échouait OUVERT).
 *
 * MAISON. La CI, ⛔ pas le prebuild : sous `--prebuild`, `fail()` sort en 0
 * (fallback tolérant), et hors `--prebuild` une garde placée avant l'écriture
 * bloquerait la commande qui RÉPARE (C137).
 *
 * CE QUI EST COMPARÉ. Le JEU DE CLÉS — tables + colonnes — entre la capture
 * committée et la base vivante. ⛔ Pas les VALEURS : la prod est éditée tous les
 * jours (contenu, lore, prix) et une garde qui rougit pour du normal est
 * désactivée en une semaine. S'y ajoute le seul compte qui ne bouge jamais
 * légitimement : une table vivante à 0 ligne.
 *
 * LÉGITIMITÉ DE LA COMPARAISON (mesurée s401) : `snapshot-visiteur.mjs` recopie
 * `tables[t]` VERBATIM depuis la RPC (seul le `manifest` est recalculé) — le jeu
 * de clés de la capture est donc celui de la RPC, sans transformation.
 *
 * SORTIES — silence n'est JAMAIS vert (C138) :
 *   0 = joignable ET concordant
 *   1 = joignable ET divergent   (les écarts sont nommés)
 *   2 = INJOIGNABLE / non mesuré (réseau, clé, HTTP, réponse illisible)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const CHEMIN_CAPTURE = resolve(ICI, '../src/data/snapshotVisiteur.json');

// Le ref du projet est déjà présent dans le dépôt (8 fichiers, depuis s378) ;
// la forme URL s'en déduit mécaniquement. ⛔ Aucune CLÉ n'est écrite ici :
// elle vient de l'environnement, et de nulle part ailleurs.
const URL_BASE = process.env.VITE_SUPABASE_URL || 'https://dezocltwpuhbvpxwcbdy.supabase.co';
// ⛔ On ne lit JAMAIS VITE_SUPABASE_ANON_KEY : la clé legacy (JWT) est
//    DÉSACTIVÉE côté projet — elle donnerait un échec trompeur (401) au lieu
//    d'une mesure. Seule la clé PUBLIABLE fait foi.
const CLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const DELAI_MS = 20_000;
// Une panne réseau passagère bloquerait le merge de TOUTE PR. On réessaie donc
// avant de déclarer injoignable — sans jamais transformer un échec en vert.
const ESSAIS = [0, 2_000, 5_000];
const REPARER = 'pnpm --dir artifacts/arlor run snapshot:visiteur   (puis committer le fichier)';

function injoignable(raison) {
  console.error(`\n🔌 DÉRIVE NON MESURÉE — ${raison}`);
  console.error('   ⛔ Ce n\'est PAS un feu vert : la comparaison n\'a pas eu lieu.');
  console.error('   Le merge attend ; le déploiement, lui, n\'est jamais bloqué.');
  process.exit(2);
}

function clesDe(lignes) {
  const s = new Set();
  if (Array.isArray(lignes)) {
    for (const l of lignes) {
      if (l && typeof l === 'object') for (const k of Object.keys(l)) s.add(k);
    }
  }
  return s;
}

const tri = (ens) => [...ens].sort();

let capture;
try {
  capture = JSON.parse(readFileSync(CHEMIN_CAPTURE, 'utf-8'));
} catch (err) {
  injoignable(`capture committée illisible (${CHEMIN_CAPTURE}) : ${err.message}`);
}
if (!capture?.tables || typeof capture.tables !== 'object') {
  injoignable('capture committée sans racine { manifest, tables }');
}

if (!CLE) {
  console.error('\n   GESTE : GitHub → Settings → Secrets and variables → Actions →');
  console.error('           New repository secret → nom exact VITE_SUPABASE_PUBLISHABLE_KEY');
  injoignable('VITE_SUPABASE_PUBLISHABLE_KEY absente de l\'environnement');
}

console.log('🔍 Dérive de la capture visiteur : capture committée ↔ base vivante');
console.log(`   base    : ${URL_BASE}`);
console.log(`   capture : ${Object.keys(capture.tables).length} tables, générée le ${capture.manifest?.genere_le ?? '?'}`);

let vivant;
let dernierEchec = 'aucun essai';
for (const [i, attente] of ESSAIS.entries()) {
  if (attente > 0) {
    console.log(`   … nouvel essai dans ${attente / 1000} s (${i + 1}/${ESSAIS.length})`);
    await new Promise((r) => setTimeout(r, attente));
  }
  try {
    const rep = await fetch(`${URL_BASE}/rest/v1/rpc/snapshot_visiteur`, {
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
      injoignable(`la RPC snapshot_visiteur répond HTTP ${rep.status} (clé refusée ou RPC absente)`);
    }
    if (!rep.ok) {
      dernierEchec = `HTTP ${rep.status}`;
      continue;
    }
    vivant = await rep.json();
    break;
  } catch (err) {
    dernierEchec = `${err?.name ?? 'erreur'} : ${err?.message ?? err}`;
  }
}
if (vivant === undefined) {
  injoignable(`base injoignable après ${ESSAIS.length} essais (dernier : ${dernierEchec})`);
}

if (!vivant?.tables || typeof vivant.tables !== 'object') {
  injoignable('réponse RPC sans racine { manifest, tables }');
}

const tablesCapture = new Set(Object.keys(capture.tables));
const tablesVivantes = new Set(Object.keys(vivant.tables));
const ecarts = [];

for (const t of tri(tablesVivantes)) {
  if (!tablesCapture.has(t)) ecarts.push(`table « ${t} » présente en base, ABSENTE de la capture`);
}
for (const t of tri(tablesCapture)) {
  if (!tablesVivantes.has(t)) ecarts.push(`table « ${t} » dans la capture, ABSENTE de la base`);
}

let comparees = 0;
for (const t of tri(tablesCapture)) {
  if (!tablesVivantes.has(t)) continue;
  const lignesVivantes = vivant.tables[t];
  // Une table vivante à 0 ligne ne rend AUCUNE clé : sans ce cas nommé, la
  // comparaison de clés serait verte à vide sur elle (C138).
  if (!Array.isArray(lignesVivantes) || lignesVivantes.length === 0) {
    ecarts.push(`table « ${t} » : 0 ligne en base (la capture en porte ${capture.tables[t]?.length ?? 0})`);
    continue;
  }
  comparees += 1;
  const kCapture = clesDe(capture.tables[t]);
  const kVivant = clesDe(lignesVivantes);
  const manquantes = tri([...kVivant].filter((k) => !kCapture.has(k)));
  const enTrop = tri([...kCapture].filter((k) => !kVivant.has(k)));
  if (manquantes.length) ecarts.push(`table « ${t} » : colonne(s) en base absente(s) de la capture → ${manquantes.join(', ')}`);
  if (enTrop.length) ecarts.push(`table « ${t} » : colonne(s) de la capture disparue(s) en base → ${enTrop.join(', ')}`);
}

if (ecarts.length > 0) {
  console.error(`\n❌ DÉRIVE : ${ecarts.length} écart(s) entre la capture committée et la base.`);
  for (const e of ecarts) console.error(`   • ${e}`);
  console.error('\n   La suite de tests lit la CAPTURE : tant qu\'elle est périmée, elle');
  console.error('   teste une fiction, et une garde affamée peut échouer OUVERT.');
  console.error(`\n   RÉPARER : ${REPARER}`);
  process.exit(1);
}

console.log(`✅ Aucune dérive : ${tablesCapture.size} tables, ${comparees} comparées colonne à colonne, 0 écart.`);
process.exit(0);

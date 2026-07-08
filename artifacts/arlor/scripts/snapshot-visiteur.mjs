#!/usr/bin/env node
/**
 * snapshot-visiteur.mjs — script de RÉGÉNÉRATION du snapshot visiteur offline.
 *
 * Un SEUL appel `supabase.rpc('snapshot_visiteur')` renvoie tout le jsonb
 * `{manifest:{genere_le,comptes}, tables:{…26 tables…}}` — la RPC est
 * SECURITY INVOKER, donc l'appelant anon voit exactement ce que la RLS lui
 * montre (parité stricte avec ce que l'app peut lire).
 *
 * Après réception : les MÊMES garde-fous anti-stub que la version précédente
 * (comptes recalculés depuis tables[t].length, planchers de réalité, ids de
 * `races` = UUID) — un snapshot factice reste IMPOSSIBLE à écrire.
 *
 * Mode `--prebuild` (PREBUILD Vercel) : tolérant aux pannes réseau. En cas
 * d'échec (réseau, garde-fou, env manquante), le script logue un warning et
 * sort en code 0 pour laisser le build continuer sur le JSON déjà committé
 * (fallback silencieux). Sans `--prebuild`, comportement historique inchangé
 * (échec → exit 1, utile en local/CI pour forcer une régénération correcte).
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PREBUILD = process.argv.includes('--prebuild');

// En mode --prebuild, tout échec est un fallback tolérant (warning + exit 0)
// pour laisser le build Vercel continuer sur le JSON déjà committé. Sans le
// flag, comportement historique : échec → exit 1.
function fail(raison) {
  if (PREBUILD) {
    console.warn(`⚠️ prebuild snapshot: fallback sur le JSON committé (${raison})`);
    process.exit(0);
  }
  console.error(`❌ ${raison}`);
  process.exit(1);
}

// ============================================================
// Clés attendues (19 legacy + 7 extension hors-ligne = 26)
// ============================================================

const TABLES_LEGACY = [
  'races', 'race_traits', 'traits_raciaux', 'classes', 'competences', 'sorts',
  'prieres', 'religions', 'langues', 'familles_criminelles', 'categories_creatures',
  'assemblages_runes', 'recettes_alchimie', 'pieges', 'objets_forge',
  'objets_joaillerie', 'reparations_forge', 'parametres_jeu', 'ingredients_alchimiques',
];
const TABLES_HORS_LIGNE = [
  'sections_regles', 'effets_combat', 'bestiaire', 'lore', 'fiches_schemas',
  'fiches_listes', 'vue_competences_encyclopedie',
];
const TABLES_ATTENDUES = [...TABLES_LEGACY, ...TABLES_HORS_LIGNE];

// ============================================================
// Chargement des variables d'environnement
// ============================================================

let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fallback : tenter de lire depuis .env local
if (!supabaseUrl || !supabaseKey) {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envLines = envContent.split('\n');
    for (const line of envLines) {
      const [key, value] = line.split('=');
      if (key?.trim() === 'VITE_SUPABASE_URL') {
        supabaseUrl ||= value?.trim();
      }
      if (key?.trim() === 'VITE_SUPABASE_ANON_KEY') {
        supabaseKey ||= value?.trim();
      }
      if (key?.trim() === 'VITE_SUPABASE_PUBLISHABLE_KEY') {
        supabaseKey ||= value?.trim();
      }
    }
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Requis : VITE_SUPABASE_URL + (VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_PUBLISHABLE_KEY)');
  console.error('Fallback : artifacts/arlor/.env');
  fail('variables d\'environnement manquantes');
}

// ============================================================
// Initialisation Supabase et export via la RPC snapshot_visiteur
// ============================================================

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportSnapshot() {
  console.log('📊 Régénération du snapshot visiteur offline (RPC snapshot_visiteur)...\n');

  const { data, error } = await supabase.rpc('snapshot_visiteur');
  if (error) {
    return fail(`erreur RPC snapshot_visiteur : ${error.message}`);
  }
  if (!data || typeof data !== 'object' || !data.tables) {
    return fail('réponse RPC invalide : racine { manifest, tables } attendue.');
  }

  const tables = data.tables;
  const tableNames = Object.keys(tables);

  // Le compte du manifest est TOUJOURS recalculé côté client depuis la table
  // réelle, jamais repris tel quel : un manifest ne peut donc pas mentir.
  const snapshot = {
    manifest: {
      genere_le: data.manifest?.genere_le ?? new Date().toISOString(),
      comptes: {},
    },
    tables: {},
  };
  for (const t of tableNames) {
    snapshot.tables[t] = Array.isArray(tables[t]) ? tables[t] : [];
    snapshot.manifest.comptes[t] = snapshot.tables[t].length;
    console.log(`✓ ${t.padEnd(25)} : ${snapshot.tables[t].length} lignes`);
  }

  // ============================================================
  // GARDE-FOUS ANTI-STUB (BLOQUANTS, AVANT toute écriture)
  // Un snapshot factice (tables vides, ids inventés) devient un état
  // IMPOSSIBLE : le script refuse d'écrire et sort en code ≠ 0.
  // ⚠️ Aucun compte codé en dur : la seule vérité est la cohérence interne
  //    manifest ↔ contenu (les stats pg divergent — ex. objets_forge).
  // ============================================================

  const UUID_RE = /^[0-9a-f-]{36}$/i;
  const PLANCHERS = {
    races: 3,
    classes: 3,
    competences: 50,
    sorts: 50,
    prieres: 50,
    ingredients_alchimiques: 20,
    // Extension hors-ligne (comptes prod du 2026-07-07 : 52/33/6/18/14/14/91) —
    // planchers conservateurs.
    sections_regles: 40,
    effets_combat: 25,
    bestiaire: 4,
    lore: 10,
    fiches_schemas: 10,
    fiches_listes: 10,
    vue_competences_encyclopedie: 80,
  };

  const violations = [];

  // 0. Les 25 clés attendues doivent toutes être présentes.
  for (const t of TABLES_ATTENDUES) {
    if (!tableNames.includes(t)) {
      violations.push(`Clé « ${t} » absente de la réponse RPC (25 attendues, ${tableNames.length} reçues).`);
    }
  }

  // 1. Aucune table ne doit être vide.
  for (const t of tableNames) {
    if (snapshot.tables[t].length === 0) {
      violations.push(`Table « ${t} » vide (0 ligne) — snapshot factice ou accès refusé.`);
    }
  }

  // 2. Planchers de réalité.
  for (const [t, plancher] of Object.entries(PLANCHERS)) {
    const n = (snapshot.tables[t] || []).length;
    if (n < plancher) {
      violations.push(`Table « ${t} » : ${n} ligne(s) < plancher ${plancher}.`);
    }
  }

  // 3. Les ids de races doivent être des UUID (pas « 1 », « 2 »…).
  const racesRows = snapshot.tables.races || [];
  for (const [i, row] of racesRows.entries()) {
    if (typeof row.id !== 'string' || !UUID_RE.test(row.id)) {
      violations.push(`races[${i}].id = ${JSON.stringify(row.id)} n'est pas un UUID.`);
    }
  }

  if (violations.length > 0) {
    console.error('\n❌ Garde-fous anti-stub déclenchés :');
    for (const v of violations) console.error(`   • ${v}`);
    return fail(`garde-fous anti-stub : ${violations.length} violation(s), aucun fichier écrit`);
  }

  console.log('\n✅ Garde-fous anti-stub : OK (25 clés, aucune table vide, planchers respectés, ids races = UUID).');

  // ============================================================
  // Écriture atomique du fichier JSON (pretty 2 espaces)
  // ============================================================

  const outputDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'snapshotVisiteur.json');
  const tmpPath = `${outputPath}.tmp`;
  const contenu = JSON.stringify(snapshot, null, 2) + '\n';
  fs.writeFileSync(tmpPath, contenu, 'utf-8');
  fs.renameSync(tmpPath, outputPath);

  console.log('\n✅ Snapshot généré :', outputPath);
  console.log('\n📈 Comptes exportés (recalculés depuis le contenu) :');
  Object.entries(snapshot.manifest.comptes).forEach(([t, count]) => {
    console.log(`  ${t}: ${count}`);
  });

  console.log(
    `\n✅ snapshot régénéré : ${tableNames.length} clés, ${Buffer.byteLength(contenu, 'utf-8')} octets, genere_le=${snapshot.manifest.genere_le}`
  );
}

exportSnapshot().catch(err => {
  fail(`erreur réseau/inattendue : ${err.message ?? err}`);
});

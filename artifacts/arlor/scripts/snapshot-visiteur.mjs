#!/usr/bin/env node
/**
 * snapshot-visiteur.mjs
 * Script ESM pour exporter les données de contenu du jeu (tables publiques)
 * vers un JSON snapshot pour le moteur de création offline.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tables à exporter (ordre déterministe par 'id')
const TABLES = [
  'races',
  'race_traits',
  'traits_raciaux',
  'classes',
  'competences',
  'sorts',
  'prieres',
  'religions',
  'langues',
  'familles_criminelles',
  'categories_creatures',
  'assemblages_runes',
  'recettes_alchimie',
  'pieges',
  'objets_forge',
  'objets_joaillerie',
  'parametres_jeu'
];

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
  console.error('❌ ERREUR : Variables d\'environnement manquantes');
  console.error('Requis : VITE_SUPABASE_URL + (VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_PUBLISHABLE_KEY)');
  console.error('Fallback : artifacts/arlor/.env');
  process.exit(1);
}

// ============================================================
// Initialisation Supabase et export des tables
// ============================================================

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportSnapshot() {
  console.log('📊 Exporting snapshot for offline visitor mode...\n');

  const snapshot = {
    manifest: {
      genere_le: new Date().toISOString(),
      comptes: {}
    },
    tables: {}
  };

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('id');

      if (error) {
        console.error(`❌ Erreur lors de l'export de ${table}:`, error.message);
        process.exit(1);
      }

      snapshot.tables[table] = data || [];
      // Le compte du manifest est TOUJOURS calculé depuis la table réelle,
      // jamais écrit à la main. Un manifest ne peut donc pas mentir.
      snapshot.manifest.comptes[table] = snapshot.tables[table].length;
      console.log(`✓ ${table.padEnd(25)} : ${snapshot.tables[table].length} lignes`);
    } catch (err) {
      console.error(`❌ Erreur inattendue pour ${table}:`, err.message);
      process.exit(1);
    }
  }

  // ============================================================
  // GARDE-FOUS ANTI-STUB (BLOQUANTS, AVANT toute écriture)
  // Un snapshot factice (tables vides, ids inventés) devient un état
  // IMPOSSIBLE : le script refuse d'écrire et sort en code ≠ 0.
  // ============================================================

  const UUID_RE = /^[0-9a-f-]{36}$/i;
  // Planchers de réalité : en-dessous de ces seuils, la donnée est
  // forcément incomplète ou factice (prod 2026-07-03 très au-dessus).
  const PLANCHERS = {
    races: 3,
    classes: 3,
    competences: 50,
    sorts: 50,
    prieres: 50,
  };

  const violations = [];

  // 1. Aucune table ne doit être vide.
  for (const table of TABLES) {
    if (snapshot.tables[table].length === 0) {
      violations.push(`Table « ${table} » vide (0 ligne) — snapshot factice ou accès refusé.`);
    }
  }

  // 2. Planchers de réalité.
  for (const [table, plancher] of Object.entries(PLANCHERS)) {
    const n = snapshot.tables[table].length;
    if (n < plancher) {
      violations.push(`Table « ${table} » : ${n} ligne(s) < plancher ${plancher}.`);
    }
  }

  // 3. Les ids de races doivent être des UUID (pas « 1 », « 2 »…).
  const racesRows = snapshot.tables.races;
  for (const [i, row] of racesRows.entries()) {
    if (typeof row.id !== 'string' || !UUID_RE.test(row.id)) {
      violations.push(`races[${i}].id = ${JSON.stringify(row.id)} n'est pas un UUID.`);
    }
  }

  if (violations.length > 0) {
    console.error('\n❌ REFUS D\'ÉCRITURE — garde-fous anti-stub déclenchés :');
    for (const v of violations) console.error(`   • ${v}`);
    console.error('\nAucun fichier écrit. Corrige l\'accès aux données réelles et relance.');
    process.exit(1);
  }

  console.log('\n✅ Garde-fous anti-stub : OK (aucune table vide, planchers respectés, ids races = UUID).');

  // ============================================================
  // Écriture du fichier JSON
  // ============================================================

  const outputDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'snapshotVisiteur.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(snapshot, null, 2) + '\n',
    'utf-8'
  );

  console.log('\n✅ Snapshot généré :', outputPath);
  console.log('\n📈 Comptes exportés:');
  Object.entries(snapshot.manifest.comptes).forEach(([table, count]) => {
    console.log(`  ${table}: ${count}`);
  });

  // ============================================================
  // Vérification des comptes attendus
  // ============================================================

  // Comptes de référence (prod 2026-07-03). Non-bloquants : la donnée RÉELLE
  // fait foi (la prod peut avoir dérivé de quelques lignes). Les garde-fous
  // anti-stub ci-dessus (planchers + tables non vides + UUID) sont le vrai
  // verrou. Tout écart est signalé pour inspection humaine.
  const EXPECTED_COUNTS = {
    competences: 91,
    sorts: 136,
    prieres: 121,
    races: 11,
    classes: 4,
    traits_raciaux: 20,
    race_traits: 20,
    recettes_alchimie: 40,
    pieges: 27,
    religions: 15,
    langues: 10,
    familles_criminelles: 5,
    categories_creatures: 8,
    assemblages_runes: 12,
    objets_forge: 45,
    objets_joaillerie: 38,
    parametres_jeu: 1
  };

  console.log('\nℹ️  Comparaison aux comptes de référence (2026-07-03) — informative :');
  let countMismatch = false;
  for (const [table, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = snapshot.manifest.comptes[table] ?? 0;
    const match = actual === expected ? '✓' : '≠';
    console.log(`  ${match} ${table}: ${actual} (référence: ${expected})`);
    if (actual !== expected) countMismatch = true;
  }

  if (countMismatch) {
    console.warn('\n⚠️  Des comptes diffèrent de la référence 2026-07-03 (voir « ≠ » ci-dessus).');
    console.warn('   Donnée réelle conservée. À rapporter/inspecter si l\'écart est majeur.');
  } else {
    console.log('\n✅ Tous les comptes correspondent aux comptes de référence.');
  }
}

exportSnapshot().catch(err => {
  console.error('❌ Erreur lors de l\'export:', err);
  process.exit(1);
});

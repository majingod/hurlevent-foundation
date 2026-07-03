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
      snapshot.manifest.comptes[table] = (data || []).length;
      console.log(`✓ ${table.padEnd(25)} : ${(data || []).length} lignes`);
    } catch (err) {
      console.error(`❌ Erreur inattendue pour ${table}:`, err.message);
      process.exit(1);
    }
  }

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

  const EXPECTED_COUNTS = {
    competences: 91,
    sorts: 136,
    prieres: 121,
    races: 11,
    classes: 4,
    traits_raciaux: 20,
    recettes_alchimie: 40,
    pieges: 27,
    religions: 15
  };

  console.log('\n⚠️  Vérification des comptes attendus (2026-07-03):');
  let countMismatch = false;
  for (const [table, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = snapshot.manifest.comptes[table] || 0;
    const match = actual === expected ? '✓' : '❌';
    console.log(`  ${match} ${table}: ${actual} (attendu: ${expected})`);
    if (actual !== expected) countMismatch = true;
  }

  if (countMismatch) {
    console.error('\n❌ ERREUR : Les comptes ne correspondent pas aux valeurs attendues.');
    process.exit(1);
  }

  console.log('\n✅ Tous les comptes correspondent aux valeurs attendues.');
}

exportSnapshot().catch(err => {
  console.error('❌ Erreur lors de l\'export:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * snapshot-visiteur.mjs — script de RÉGÉNÉRATION du snapshot visiteur offline.
 *
 * ⚠️ NÉCESSITE LE RÉSEAU (accès Supabase) — NON exécuté dans ce lot.
 *    L'environnement CC ne peut pas joindre Supabase (egress). Le
 *    snapshot committé (src/data/snapshotVisiteur.json) a été capturé en
 *    prod par l'orchestrateur via la RPC public.snapshot_visiteur()
 *    (voir supabase/migrations/20260703182834_visiteur_snapshot_rpc.sql).
 *    Ce script reste la source de RÉGÉNÉRATION quand le réseau est dispo.
 *
 * Un SEUL appel `supabase.rpc('snapshot_visiteur')` renvoie tout le jsonb
 * `{manifest:{genere_le,comptes}, tables:{…17 tables…}}` — la RPC est
 * SECURITY INVOKER, donc l'appelant anon voit exactement ce que la RLS lui
 * montre (parité stricte avec ce que l'app peut lire).
 *
 * Après réception : les MÊMES garde-fous anti-stub que la version précédente
 * (comptes recalculés depuis tables[t].length, planchers de réalité, ids de
 * `races` = UUID) — un snapshot factice reste IMPOSSIBLE à écrire.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
// Initialisation Supabase et export via la RPC snapshot_visiteur
// ============================================================

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportSnapshot() {
  console.log('📊 Régénération du snapshot visiteur offline (RPC snapshot_visiteur)...\n');

  const { data, error } = await supabase.rpc('snapshot_visiteur');
  if (error) {
    console.error('❌ Erreur RPC snapshot_visiteur :', error.message);
    process.exit(1);
  }
  if (!data || typeof data !== 'object' || !data.tables) {
    console.error('❌ Réponse RPC invalide : racine { manifest, tables } attendue.');
    process.exit(1);
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
  };

  const violations = [];

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
    console.error('\n❌ REFUS D\'ÉCRITURE — garde-fous anti-stub déclenchés :');
    for (const v of violations) console.error(`   • ${v}`);
    console.error('\nAucun fichier écrit. Corrige l\'accès aux données réelles et relance.');
    process.exit(1);
  }

  console.log('\n✅ Garde-fous anti-stub : OK (aucune table vide, planchers respectés, ids races = UUID).');

  // ============================================================
  // Écriture du fichier JSON (pretty 2 espaces)
  // ============================================================

  const outputDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'snapshotVisiteur.json');
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');

  console.log('\n✅ Snapshot généré :', outputPath);
  console.log('\n📈 Comptes exportés (recalculés depuis le contenu) :');
  Object.entries(snapshot.manifest.comptes).forEach(([t, count]) => {
    console.log(`  ${t}: ${count}`);
  });
}

exportSnapshot().catch(err => {
  console.error('❌ Erreur lors de l\'export:', err);
  process.exit(1);
});

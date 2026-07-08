#!/usr/bin/env node
/**
 * publier-hors-ligne.mjs — copie le build autonome dans le build du site.
 *
 * Le script `build` Vercel construit le site (`dist/`) PUIS le fichier
 * autonome (`dist-hors-ligne/`) : sans cette étape, ce dernier n'est jamais
 * servi ni téléchargeable en prod. Échoue bruyamment si la copie source est
 * absente, tronquée, ou si `dist/` n'existe pas encore.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TAILLE_MIN_OCTETS = 1024 * 1024; // 1 Mo — en-deçà, le build autonome a raté.

const racine = path.join(__dirname, '..');
const source = path.join(racine, 'dist-hors-ligne', 'hurlevent-hors-ligne.html');
const dossierDist = path.join(racine, 'dist');
const destination = path.join(dossierDist, 'hurlevent-hors-ligne.html');

function fail(raison) {
  console.error(`❌ ${raison}`);
  process.exit(1);
}

if (!fs.existsSync(dossierDist)) {
  fail(`dossier « dist/ » absent (${dossierDist}) — le build du site doit s'exécuter avant.`);
}

if (!fs.existsSync(source)) {
  fail(`fichier autonome absent (${source}) — le build hors-ligne a-t-il échoué ?`);
}

const taille = fs.statSync(source).size;
if (taille < TAILLE_MIN_OCTETS) {
  fail(`fichier autonome tronqué : ${taille} octet(s) < ${TAILLE_MIN_OCTETS} (1 Mo attendu au minimum).`);
}

fs.copyFileSync(source, destination);

const tailleMo = (taille / (1024 * 1024)).toFixed(2);
console.log(`✅ créateur hors ligne publié : ${destination} (${tailleMo} Mo)`);

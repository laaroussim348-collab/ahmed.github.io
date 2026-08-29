/**
 * scripts/build-essai.mjs — construit l'installeur de la version D'ESSAI
 * (7 jours), séparément de la version vendue. Usage : npm run dist:essai
 * -----------------------------------------------------------------------
 * Repris à l'identique de BV-Calc (scripts/build-essai.mjs) : modifie
 * TEMPORAIREMENT package.json (main -> electron-main-essai.mjs, appId,
 * productName, dossier de sortie, nom du raccourci) le temps de lancer
 * electron-builder, puis restaure toujours l'original (bloc finally).
 * -----------------------------------------------------------------------
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHEMIN_PKG = path.join(__dirname, '..', 'package.json');

const original = fs.readFileSync(CHEMIN_PKG, 'utf8');
const pkg = JSON.parse(original);

pkg.name = 'gradex-essai';
pkg.main = 'electron-main-essai.mjs';
pkg.build = {
  ...pkg.build,
  appId: 'com.gradexsuite.app.essai',
  productName: 'HydroCrue Essai',
  directories: { output: 'dist-essai' },
  nsis: { ...pkg.build.nsis, shortcutName: 'HydroCrue Essai' },
};

let echoue = false;
try {
  fs.writeFileSync(CHEMIN_PKG, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log("→ Construction de la version d'essai (electron-main-essai.mjs, verrouillage après 7 jours)…\n");
  execSync('electron-builder --win', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (e) {
  echoue = true;
  console.error("\n❌ Échec de la construction de la version d'essai :", e.message);
} finally {
  fs.writeFileSync(CHEMIN_PKG, original, 'utf8');
  console.log('→ package.json restauré tel quel (la version vendue, "npm run dist", est inchangée).');
}

if (echoue) process.exit(1);
console.log(`\n✅ Terminé : dossier dist-essai/ → "HydroCrue Essai Setup ${pkg.version}.exe"`);

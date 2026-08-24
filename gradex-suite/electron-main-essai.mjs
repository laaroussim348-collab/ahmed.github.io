/**
 * electron-main-essai.mjs — point d'entrée de la version D'ESSAI (24h).
 * -----------------------------------------------------------------------
 * Copie de electron-main.mjs, avec une seule différence fonctionnelle :
 * GRADEX_MODE=essai est défini AVANT d'importer server.mjs, ce qui fait que
 * server.mjs charge src/services/trialClient.js (essai 24h, sans code, sans
 * internet) au lieu de src/services/licenseClient.js (licence par code +
 * Google Sheets) — voir server.mjs pour le détail du branchement. Repris à
 * l'identique de BV-Calc (electron-main-essai.mjs).
 *
 * Ce fichier n'est JAMAIS utilisé par la version vendue : "main" dans
 * package.json (electron-main.mjs) est l'entrée normale, et le script
 * "dist:essai" (voir scripts/build-essai.mjs) est le seul à pointer
 * temporairement "main" vers CE fichier le temps de construire l'installeur
 * d'essai.
 * -----------------------------------------------------------------------
 */
import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.GRADEX_MODE = 'essai'; // doit être défini AVANT d'importer server.mjs (voir server.mjs)
process.env.GRADEX_DATA_DIR = app.getPath('userData');
await import('./server.mjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const URL_APP = `http://localhost:${PORT}`;

Menu.setApplicationMenu(null);

function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'GRADEX — Essai 24h',
    icon: path.join(__dirname, 'build-resources', 'icon.png'),
    backgroundColor: '#e8e8e8',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  fenetre.once('ready-to-show', () => fenetre.show());

  const charger = () => fenetre.loadURL(URL_APP);

  fenetre.webContents.on('did-fail-load', (_e, code) => {
    if (code === -102 || code === -105 || code === -106) {
      setTimeout(charger, 300);
    }
  });

  charger();
}

app.whenReady().then(() => {
  creerFenetre();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

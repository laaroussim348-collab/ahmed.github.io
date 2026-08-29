/**
 * electron-main.mjs — point d'entrée de l'application de bureau HydroCrue.
 * -----------------------------------------------------------------------
 * Démarre le serveur local (server.mjs) et ouvre une fenêtre native pointée
 * dessus — comme un vrai logiciel installé (HEC-RAS, AutoCAD, Global
 * Mapper...), pas un site à ouvrir dans un navigateur. Repris de BV-Calc :
 * même mécanique de licence, adaptée au nom du produit fusionné.
 * -----------------------------------------------------------------------
 */
import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Doit être défini AVANT que server.mjs (et transitivement licenseClient.js)
// ne s'exécute — voir src/services/licenseClient.js.
process.env.GRADEX_DATA_DIR = app.getPath('userData');
await import('./server.mjs'); // démarre l'écoute sur PORT (effet de bord, voir server.mjs)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const URL_APP = `http://localhost:${PORT}`;

Menu.setApplicationMenu(null); // pas de barre de menu générique Electron — le menu Fichier/Éditer est dans l'app elle-même

function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'HydroCrue',
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

// Nouveau / Ouvrir / Enregistrer un projet .hyd utilisent l'API navigateur
// File System Access (window.showSaveFilePicker / showOpenFilePicker),
// nativement disponible dans le moteur Chromium d'Electron — aucun pont IPC
// n'est nécessaire (voir src/App.js, saveProjectFile / openProjectFile).

app.whenReady().then(() => {
  creerFenetre();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

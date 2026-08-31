/**
 * preload.cjs — pont contextBridge exposant le presse-papiers natif
 * d'Electron au renderer (window.hydrocrueClipboard).
 * -----------------------------------------------------------------------
 * navigator.clipboard (API web standard) est utilisé par src/ui.js pour
 * Copier/Couper/Coller, mais Electron ne délivre par défaut AUCUNE des
 * permissions clipboard-read/clipboard-write nécessaires côté renderer
 * (aucune invite n'apparaît non plus — la promesse échoue simplement en
 * silence). Résultat rapporté par un client : "copier/coller ne marche
 * pas" dans le logiciel installé, alors que la même fonction marchait
 * très bien en navigateur (testée tout au long du développement via
 * npm run serve, où navigator.clipboard fonctionne normalement).
 *
 * Le presse-papiers natif d'Electron (module 'clipboard') n'a lui besoin
 * d'aucune permission — mais nodeIntegration est désactivé et
 * contextIsolation activé (bonnes pratiques de sécurité, à conserver
 * telles quelles), donc pas d'accès direct à require('electron') depuis
 * le renderer : ce script preload (chargé par electron-main.mjs) fait le
 * pont via contextBridge. src/ui.js utilise window.hydrocrueClipboard
 * quand il est présent (build Electron), et retombe sur navigator.clipboard
 * sinon (navigateur classique, dev).
 * -----------------------------------------------------------------------
 */
const { contextBridge, clipboard } = require('electron');

contextBridge.exposeInMainWorld('hydrocrueClipboard', {
  writeText: (texte) => clipboard.writeText(texte),
  readText: () => clipboard.readText(),
});

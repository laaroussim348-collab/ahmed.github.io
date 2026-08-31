/**
 * server.mjs — Serveur de fichiers statiques, sans dépendance externe.
 * Sert le dossier /build (interface React, générée par `npm run build`) et
 * expose les routes API qui font office de PROXY vers les services externes
 * (licence, NASA POWER, mghydro.com, Open-Meteo) : /api/activation-status,
 * /api/machine-id, /api/activer, /api/delineation et /api/pluviometrie.
 *
 * Repris tel quel de BV-Calc (server.mjs) : seule la racine statique change
 * (build/ au lieu de public/, car l'interface est désormais une app React
 * compilée) — le moteur de calcul, la licence et les proxys réseau sont
 * inchangés.
 *
 * Lancement :  npm run build && npm run server   →  http://localhost:3000
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDailyPrecipitationUrl, buildHourlyPrecipitationUrl, parseNasaPowerSeries } from './src/services/nasaPowerClient.js';
import { calculerPjmax, calculerMontana, calculerPma } from './src/services/rainfallEstimation.js';
import {
  buildWatershedUrl, buildUpstreamRiversUrl, buildElevationUrl,
  parseWatershedResponse, parseRiversResponse, parseElevationResponse,
} from './src/services/delineationClient.js';
import { analyserDelimitation, finaliserCaracteristiques } from './src/services/watershedFromCoordinates.js';
import { obtenirMachineId, activerAvecCode, verifierActivation } from './src/services/activationClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// build/ (sortie de `react-scripts build`) est embarqué dans l'app (archive
// .asar d'Electron) pour une distribution en un seul .exe installable.
const RACINE_STATIQUE = __dirname;
const RACINE_BUILD = path.join(__dirname, 'build');
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------
// Client HTTP minimal (Node natif, aucune dépendance) pour les appels
// vers les services externes.
// ---------------------------------------------------------------------
function fetchJson(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'HydroCrue/1.0 (bureau-etudes-hydrologie)' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`${url} → HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error(`Réponse JSON invalide depuis ${url}`)); }
      });
    });
    req.on('error', (e) => reject(new Error(`Échec de connexion vers ${new URL(url).hostname} : ${e.message}`)));
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Délai dépassé (${timeoutMs / 1000}s) vers ${new URL(url).hostname}`)));
  });
}

function todayYYYYMMDD() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function sendJson(res, statusCode, obj) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

// ---------------------------------------------------------------------
// Presse-papiers natif Electron (src/ui.js, Copier/Couper/Coller) —
// navigator.clipboard SEUL ne suffit pas : Electron n'accorde par défaut
// aucune permission clipboard-read/clipboard-write au renderer (aucune
// invite non plus, la promesse échoue juste en silence), d'où
// "Copier/Coller ne marche pas" une fois le logiciel installé alors que ça
// fonctionnait très bien en navigateur pendant le développement. Un
// premier essai avait exposé le presse-papiers via un script preload
// (contextBridge), sans effet constaté chez le client — remplacé ici par
// une route HTTP sur CE MÊME serveur local, exactement comme toutes les
// autres API (/api/activation-status, /api/delineation...) qui, elles,
// fonctionnent déjà de façon confirmée dans le logiciel installé :
// electron-main.mjs démarre server.mjs DANS le processus principal
// d'Electron (pas le renderer), où require('electron').clipboard est
// utilisable sans aucune restriction de permission ni de sandbox.
// process.versions.electron n'est présent QUE si ce processus tourne
// réellement sous le binaire Electron (pas `node server.mjs` en dev) —
// import('electron') hors Electron renverrait juste le chemin de
// l'exécutable (chaîne de caractères), sans .clipboard ; le garde-fou
// évite d'essayer.
//
// Résolution VOLONTAIREMENT différée (pas au chargement du module, ici en
// haut de server.mjs, qui est importé par electron-main.mjs AVANT même
// app.whenReady()) — au premier appel réel d'une route /api/clipboard-*
// seulement, à coup sûr après que la fenêtre soit affichée. Gère aussi les
// deux formes possibles renvoyées par import('electron') d'un module
// CommonJS depuis un fichier ESM : soit les propriétés nommées
// directement (import interop les détecte), soit seulement `.default`
// (objet CommonJS complet) selon la version de Node/Electron — un essai
// précédent qui ne lisait que la forme nommée expliquerait que Copier
// (retombé sur navigator.clipboard, qu'Electron autorise en écriture sans
// permission) ait semblé fonctionner alors que Coller (lui vraiment
// bloqué côté navigator.clipboard) restait cassé.
let clipboardElectronPromise = null;
function obtenirClipboardElectron() {
  if (!process.versions?.electron) return Promise.resolve(null);
  if (!clipboardElectronPromise) {
    clipboardElectronPromise = import('electron')
      .then((m) => m.clipboard || m.default?.clipboard || null)
      .catch(() => null);
  }
  return clipboardElectronPromise;
}

// ---------------------------------------------------------------------
// GET /api/activation-status  -> { active, raison?, expiresAt?, machineId, avertissement? }
// GET /api/machine-id         -> { machineId }  (affiché sur l'écran d'activation)
// POST /api/activer  {code}   -> { ok, expiresAt } ou { ok:false, erreur }
// GET /api/clipboard-read     -> { ok, texte } (404 si hors Electron)
// POST /api/clipboard-write {texte} -> { ok } (404 si hors Electron)
// ---------------------------------------------------------------------
async function apiActivationStatus(res) {
  // statut.essai est déjà positionné par activationClient.js (true en essai,
  // absent une fois licencié) — plus de mode de build séparé à refléter ici.
  const statut = await verifierActivation();
  sendJson(res, 200, statut);
}
function apiMachineId(res) {
  sendJson(res, 200, { machineId: obtenirMachineId() });
}
async function apiActiver(req, res) {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', async () => {
    try {
      const { code } = JSON.parse(body || '{}');
      if (!code) { sendJson(res, 400, { ok: false, erreur: 'Code manquant.' }); return; }
      const resultat = await activerAvecCode(code.trim());
      sendJson(res, 200, { ok: true, expiresAt: resultat.expiresAt });
    } catch (e) {
      sendJson(res, 200, { ok: false, erreur: e.message });
    }
  });
}
// -> { surface_km2, perimetre_km, longueur_km, altitude_min_m, altitude_max_m,
//      troncons, contour_latlon, coursEau_latlon, avertissements }
// contour_latlon / coursEau_latlon : géométrie (contour du BV + réseau
// hydrographique amont), en [lat,lon], pour affichage sur la carte du client.
// ---------------------------------------------------------------------
async function apiDelineation(lat, lon, res) {
  try {
    // Grands bassins versants : deux corrections par rapport à la version
    // précédente (qui échouait déjà systématiquement pour les grands BV
    // malgré un délai de 60s) —
    //  1) mghydro.com demande explicitement de NE PAS envoyer de requêtes
    //     en parallèle ("avoid making asynchronous requests, add a pause of
    //     5 seconds between requests" — mghydro.com/please-limit-your-
    //     global-watershed-api-usage-rate/) : watershed_api et
    //     upstream_rivers_api étaient appelées via Promise.all (en même
    //     temps), ce qui expose au throttling — surtout pour un grand BV où
    //     chaque appel prend déjà plus longtemps, donc plus de chances de
    //     chevauchement. Appels désormais SÉQUENTIELS, espacés de 5s.
    //  2) Délai par requête porté à 90s (au lieu de 60s) : un grand bassin
    //     versant en précision "high" demande à mghydro.com de traiter des
    //     rasters flow-accumulation/flow-direction bien plus étendus qu'un
    //     petit BV routier (mghydro.com repasse lui-même en basse précision
    //     seulement au-delà de 50 000 km², donc la plupart des grands BV
    //     marocains restent en haute précision, plus lente).
    const watershedJson = await fetchJson(buildWatershedUrl(lat, lon), 90000);
    await new Promise((r) => setTimeout(r, 5000)); // pause demandée par mghydro.com entre 2 requêtes
    const riversJson = await fetchJson(buildUpstreamRiversUrl(lat, lon), 90000);
    const watershed = parseWatershedResponse(watershedJson);
    const rivers = parseRiversResponse(riversJson);
    const analyse = analyserDelimitation(watershed, rivers, [lat, lon]);

    const elevationJson = await fetchJson(buildElevationUrl(analyse.pointsAltitudeAQuerir), 30000);
    const altitudes = parseElevationResponse(elevationJson);

    const resultat = finaliserCaracteristiques(analyse, altitudes);
    sendJson(res, 200, { ok: true, ...resultat });
  } catch (e) {
    sendJson(res, 502, { ok: false, erreur: e.message });
  }
}

// ---------------------------------------------------------------------
// GET /api/pluviometrie?lat=..&lon=..
// -> { pjmax: {...}, montana: {...}, pma: {pma_mm_an, pma_m_an, anneesUtilisees}, avertissements }
// pma réutilise la série journalière déjà récupérée pour pjmax (aucun appel réseau de plus).
// ---------------------------------------------------------------------
async function apiPluviometrie(lat, lon, res) {
  const avertissements = [
    "Données NASA POWER (réanalyse MERRA-2, résolution ≈50-60 km) : ordre de grandeur régional, pas une " +
    'mesure de station locale. Comparez si possible à une station pluviométrique ABH/DMN proche avant usage définitif.',
  ];
  let pjmaxResultat = null;
  let montanaResultat = null;
  let pmaResultat = null;
  const fin = todayYYYYMMDD();

  try {
    const dailyJson = await fetchJson(buildDailyPrecipitationUrl(lat, lon, '19810101', fin), 45000);
    const serieJournaliere = parseNasaPowerSeries(dailyJson, ['PRECTOTCORR']);
    pjmaxResultat = calculerPjmax(serieJournaliere);
    try {
      pmaResultat = calculerPma(serieJournaliere);
    } catch (e) {
      avertissements.push(`Pma non calculée : ${e.message}`);
    }
  } catch (e) {
    avertissements.push(`Pjmax non calculé : ${e.message}`);
  }

  try {
    const hourlyJson = await fetchJson(buildHourlyPrecipitationUrl(lat, lon, '20010101', fin), 90000);
    const serieHoraire = parseNasaPowerSeries(hourlyJson, ['PRECTOTCORR', 'PRECTOT']);
    montanaResultat = calculerMontana(serieHoraire);
  } catch (e) {
    avertissements.push(`Coefficients de Montana non calculés : ${e.message}`);
  }

  if (!pjmaxResultat && !montanaResultat) {
    sendJson(res, 502, { ok: false, erreur: 'Aucune donnée exploitable renvoyée par NASA POWER pour ce point.', avertissements });
    return;
  }
  sendJson(res, 200, { ok: true, pjmax: pjmaxResultat, montana: montanaResultat, pma: pmaResultat, avertissements });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  const query = new URL(req.url, `http://localhost:${PORT}`).searchParams;

  // --- Licence : ces 3 routes restent accessibles MÊME SANS activation ---
  if (urlPath === '/api/activation-status' && req.method === 'GET') { await apiActivationStatus(res); return; }
  if (urlPath === '/api/machine-id' && req.method === 'GET') { apiMachineId(res); return; }
  if (urlPath === '/api/activer' && req.method === 'POST') { await apiActiver(req, res); return; }

  // --- Presse-papiers : Copier/Coller doit marcher même écran d'activation affiché ---
  if (urlPath === '/api/clipboard-read' && req.method === 'GET') {
    const cb = await obtenirClipboardElectron();
    if (!cb) { sendJson(res, 404, { ok: false, erreur: 'Presse-papiers natif indisponible (hors Electron).' }); return; }
    try {
      sendJson(res, 200, { ok: true, texte: cb.readText() });
    } catch (e) {
      sendJson(res, 500, { ok: false, erreur: e.message });
    }
    return;
  }
  if (urlPath === '/api/clipboard-write' && req.method === 'POST') {
    const cb = await obtenirClipboardElectron();
    if (!cb) { sendJson(res, 404, { ok: false, erreur: 'Presse-papiers natif indisponible (hors Electron).' }); return; }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        const { texte } = JSON.parse(body || '{}');
        cb.writeText(texte || '');
        sendJson(res, 200, { ok: true });
      } catch (e) {
        sendJson(res, 400, { ok: false, erreur: e.message });
      }
    });
    return;
  }

  // --- Routes API réseau (délimitation, pluviométrie) : réservées aux installations activées ---
  if (urlPath === '/api/delineation' || urlPath === '/api/pluviometrie') {
    const statutLicence = await verifierActivation();
    if (!statutLicence.active) {
      sendJson(res, 403, { ok: false, erreur: "Logiciel non activé — voir l'écran d'activation.", licence: statutLicence });
      return;
    }
    const lat = parseFloat(query.get('lat'));
    const lon = parseFloat(query.get('lon'));
    if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      sendJson(res, 400, { ok: false, erreur: 'Coordonnées WGS84 invalides (lat doit être entre -90 et 90, lon entre -180 et 180).' });
      return;
    }
    if (urlPath === '/api/delineation') apiDelineation(lat, lon, res);
    else apiPluviometrie(lat, lon, res);
    return;
  }

  // Tout le reste est servi depuis /build (sortie de react-scripts build) ;
  // toute route inconnue retombe sur build/index.html (app monopage).
  let filePath = urlPath === '/' ? path.join(RACINE_BUILD, 'index.html') : path.join(RACINE_BUILD, urlPath);
  if (!filePath.startsWith(RACINE_STATIQUE)) {
    res.writeHead(403);
    res.end('Accès refusé.');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Route inconnue (pas d'extension de fichier) → repli sur index.html (app monopage)
      if (!path.extname(filePath)) {
        fs.readFile(path.join(RACINE_BUILD, 'index.html'), (err2, data2) => {
          if (err2) { res.writeHead(404); res.end('Introuvable.'); return; }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(data2);
        });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Fichier introuvable : ${urlPath}`);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  HydroCrue est lancé :  http://localhost:${PORT}\n`);
  console.log('  (Ctrl+C pour arrêter le serveur)\n');
});

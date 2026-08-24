/**
 * licenseClient.js
 * -----------------------------------------------------------------------
 * Gère l'activation de BV-Calc : stockage local du code entré, appel au
 * serveur de licence, et tolérance hors-ligne limitée (période de grâce)
 * pour ne pas bloquer l'utilisateur au moindre souci réseau ponctuel —
 * tout en garantissant qu'une désactivation côté serveur finit toujours
 * par prendre effet.
 *
 * Le "serveur de licence" est un déploiement Google Apps Script (Web App)
 * relié à un Google Sheet — voir l'outil admin bv-calc-licences-admin.html
 * (onglet Configuration) pour le code à coller et les instructions de
 * déploiement complètes. Le endpoint est appelé directement en query
 * params (?action=verify&code=...&machineId=...), pas en style REST
 * classique (/api/verify), car Apps Script n'expose qu'une seule URL
 * /exec par déploiement.
 *
 * Fichier de configuration attendu : license-config.json (à la racine du
 * projet BV-Calc, À MODIFIER avant distribution) contenant l'URL de VOTRE
 * déploiement Apps Script :
 *   { "licenseServerUrl": "https://script.google.com/macros/s/XXXX/exec" }
 * -----------------------------------------------------------------------
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { genererMachineId } from './machineId.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// license-config.json est EMBARQUÉ dans l'app (archive .asar d'Electron) —
// même URL de serveur pour toutes les copies distribuées. Electron patche
// fs pour lire un .asar de façon transparente, donc __dirname reste la
// bonne base aussi bien en dev (node server.js) qu'une fois empaqueté.
const RACINE_LECTURE = path.join(__dirname, '..', '..'); // src/services -> racine du projet
const FICHIER_CONFIG = path.join(RACINE_LECTURE, 'license-config.json');

// .license-local.json, à l'inverse, est écrit à chaque activation et doit
// donc pointer vers un VRAI dossier accessible en écriture — l'archive
// .asar est en lecture seule, et Program Files (où l'app est installée)
// n'est pas accessible en écriture à un utilisateur normal. electron-main.js
// définit BV_CALC_DATA_DIR = app.getPath('userData') avant de démarrer le
// serveur (ex: C:\Users\<utilisateur>\AppData\Roaming\BV-Calc — toujours
// accessible en écriture, sans droits admin). Hors Electron (node server.js
// en dev), on retombe simplement sur la racine du projet.
const RACINE_ECRITURE = process.env.GRADEX_DATA_DIR || RACINE_LECTURE;
const FICHIER_ETAT = path.join(RACINE_ECRITURE, '.license-local.json');

const PERIODE_GRACE_JOURS = 7; // tolérance hors-ligne : la dernière vérification réussie reste valable N jours

function lireConfig() {
  try {
    return JSON.parse(fs.readFileSync(FICHIER_CONFIG, 'utf8'));
  } catch {
    return { licenseServerUrl: null };
  }
}
function lireEtat() {
  try {
    return JSON.parse(fs.readFileSync(FICHIER_ETAT, 'utf8'));
  } catch {
    return null;
  }
}
function ecrireEtat(etat) {
  fs.mkdirSync(RACINE_ECRITURE, { recursive: true });
  fs.writeFileSync(FICHIER_ETAT, JSON.stringify(etat, null, 2), 'utf8');
}

function appelHttpJson(url, timeoutMs = 15000, redirectsRestants = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, (res) => {
      // Google Apps Script (/exec) répond TOUJOURS par une redirection HTTP
      // (301/302/303/307/308) vers script.googleusercontent.com avant de
      // renvoyer le vrai contenu JSON. Contrairement à un navigateur ou à
      // fetch(), http.get()/https.get() de Node NE suivent PAS les
      // redirections automatiquement : sans ce correctif, on lisait le
      // corps de la page de redirection (pas du JSON) et on échouait
      // systématiquement au parsing — quelle que soit la validité du
      // déploiement côté Google.
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume(); // vidange le flux courant, on ne s'en sert pas
        if (redirectsRestants <= 0) {
          reject(new Error('Trop de redirections en contactant le serveur de licence.'));
          return;
        }
        resolve(appelHttpJson(res.headers.location, timeoutMs, redirectsRestants - 1));
        return;
      }
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Réponse du serveur de licence illisible.')); }
      });
    });
    req.on('error', (e) => reject(new Error(`Serveur de licence injoignable : ${e.message}`)));
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Délai dépassé en contactant le serveur de licence.')));
  });
}

export function obtenirMachineId() {
  return genererMachineId();
}

/** Enregistre un nouveau code saisi par l'utilisateur ET le vérifie immédiatement. */
export async function activerAvecCode(code) {
  const config = lireConfig();
  if (!config.licenseServerUrl) {
    throw new Error(
      "Aucun serveur de licence configuré (license-config.json manquant ou incomplet). " +
      "Voir bv-calc-licences-admin.html, onglet Configuration."
    );
  }
  const machineId = genererMachineId();
  const resultat = await appelHttpJson(`${config.licenseServerUrl}?action=verify&machineId=${encodeURIComponent(machineId)}&code=${encodeURIComponent(code)}`);
  if (!resultat.valid) {
    throw new Error(resultat.erreur || 'Code invalide.');
  }
  ecrireEtat({
    machineId,
    code,
    licenseServerUrl: config.licenseServerUrl,
    expiresAt: resultat.expiresAt,
    dernierControleOk: true,
    dernierControleLe: new Date().toISOString(),
  });
  return { ok: true, expiresAt: resultat.expiresAt };
}

/**
 * Vérifie l'état d'activation actuel. Tente un contrôle serveur si
 * possible ; si le serveur est injoignable, applique la période de grâce
 * hors-ligne basée sur le dernier contrôle RÉUSSI. Ne lève jamais
 * d'exception — renvoie toujours un statut exploitable par l'interface.
 */
export async function verifierActivation() {
  const etat = lireEtat();
  if (!etat || !etat.code) {
    return { active: false, raison: 'non_active', machineId: genererMachineId() };
  }

  try {
    const resultat = await appelHttpJson(`${etat.licenseServerUrl}?action=verify&machineId=${encodeURIComponent(etat.machineId)}&code=${encodeURIComponent(etat.code)}`, 8000);
    if (resultat.valid) {
      ecrireEtat({ ...etat, dernierControleOk: true, dernierControleLe: new Date().toISOString(), expiresAt: resultat.expiresAt });
      return { active: true, machineId: etat.machineId, expiresAt: resultat.expiresAt, source: 'serveur' };
    }
    // Le serveur a répondu et dit explicitement NON (désactivé ou expiré) : bloquer immédiatement,
    // même si une période de grâce hors-ligne existait par ailleurs — c'est le but recherché.
    ecrireEtat({ ...etat, dernierControleOk: false, dernierControleLe: new Date().toISOString() });
    return { active: false, raison: 'refuse_par_serveur', raisonDetail: resultat.erreur, machineId: etat.machineId };
  } catch (erreurReseau) {
    // Serveur injoignable : tolérance limitée dans le temps depuis le dernier contrôle RÉUSSI.
    if (etat.dernierControleOk && etat.dernierControleLe) {
      const joursDepuisControle = (Date.now() - new Date(etat.dernierControleLe).getTime()) / (24 * 3600 * 1000);
      if (joursDepuisControle <= PERIODE_GRACE_JOURS) {
        return {
          active: true,
          machineId: etat.machineId,
          expiresAt: etat.expiresAt,
          source: 'grace_hors_ligne',
          avertissement: `Serveur de licence injoignable — accès toléré ${Math.ceil(PERIODE_GRACE_JOURS - joursDepuisControle)} jour(s) de plus avant nouvelle vérification obligatoire.`,
        };
      }
    }
    return { active: false, raison: 'serveur_injoignable_periode_grace_depassee', machineId: etat.machineId };
  }
}

/**
 * trialClient.js
 * -----------------------------------------------------------------------
 * Licence de la version D'ESSAI UNIQUEMENT (build séparé — voir
 * electron-main-essai.js et le script npm "dist:essai"). Zéro code, zéro
 * serveur, zéro connexion internet requise : au tout premier lancement on
 * note l'heure locale ; l'application fonctionne normalement pendant
 * DUREE_ESSAI_HEURES puis se verrouille DÉFINITIVEMENT.
 *
 * Expose exactement le même contrat que licenseClient.verifierActivation()
 * ({ active, raison, machineId, expiresAt, ... }) afin que server.js et
 * l'écran d'activation (public/js/activation.js) n'aient besoin d'aucune
 * logique séparée pour ce mode — seul server.js choisit, au démarrage,
 * lequel des deux modules importer (voir BV_CALC_MODE dans server.js).
 *
 * ⚠️ Limite assumée, en connaissance de cause : un essai purement
 * hors-ligne ne peut jamais être blindé à 100 % (un utilisateur qui sait
 * où chercher peut supprimer .essai-local.json pour repartir à zéro). On
 * se protège seulement contre le cas le plus courant — reculer l'horloge
 * système pour "gagner du temps" (voir dernierVu ci-dessous). Le but ici
 * est un essai grand public sans friction, pas un verrou inviolable ; la
 * vraie protection reste le système de licence par code (licenseClient.js)
 * pour la version vendue.
 * -----------------------------------------------------------------------
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { genererMachineId } from './machineId.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE_LECTURE = path.join(__dirname, '..', '..'); // src/services -> racine du projet

// Même logique que licenseClient.js : BV_CALC_DATA_DIR (défini par
// electron-main-essai.js = app.getPath('userData')) pointe vers un dossier
// réellement accessible en écriture une fois l'app installée dans
// Program Files. Repli sur la racine du projet hors Electron (dev/tests).
const RACINE_ECRITURE = process.env.GRADEX_DATA_DIR || RACINE_LECTURE;
const FICHIER_ESSAI = path.join(RACINE_ECRITURE, '.essai-local.json');

// 7 jours (168h) — porté de 24h à 7 jours (2026-08-29, retour utilisateur :
// les clients qui découvraient déjà BV-Calc avaient besoin de plus de temps
// pour évaluer la version fusionnée avant d'acheter une licence complète).
// Même durée que la tolérance hors-ligne de la version sous licence
// (licenseClient.js), pour une cohérence d'ensemble du produit.
export const DUREE_ESSAI_HEURES = 24 * 7;
const TOLERANCE_HORLOGE_MS = 5 * 60 * 1000; // 5 min de marge (fuseau/synchro NTP) avant de suspecter un recul volontaire

function lireEssai() {
  try { return JSON.parse(fs.readFileSync(FICHIER_ESSAI, 'utf8')); }
  catch { return null; }
}
function ecrireEssai(etat) {
  try {
    fs.mkdirSync(RACINE_ECRITURE, { recursive: true });
    fs.writeFileSync(FICHIER_ESSAI, JSON.stringify(etat, null, 2), 'utf8');
  } catch {
    // Échec d'écriture (rarissime) : on ne bloque jamais l'utilisateur pour
    // ça — au pire l'état de l'essai n'est pas persisté cette fois-ci.
  }
}

export function obtenirMachineId() {
  return genererMachineId();
}

/** Le build d'essai n'accepte aucun code — gardé pour la même forme d'API que licenseClient.js. */
export async function activerAvecCode() {
  throw new Error("Cette version d'essai démarre automatiquement, sans code à saisir — rien à activer ici.");
}

/**
 * Amorce l'essai au tout premier appel (premier lancement de l'app), puis
 * vérifie le temps écoulé à chaque appel suivant. Ne lève jamais
 * d'exception — toujours exploitable en toute sécurité par server.js.
 */
export async function verifierActivation() {
  const machineId = genererMachineId();
  const maintenant = Date.now();
  let etat = lireEssai();

  if (!etat) {
    etat = { premierLancement: maintenant, dernierVu: maintenant };
    ecrireEssai(etat);
  } else if (maintenant < etat.dernierVu - TOLERANCE_HORLOGE_MS) {
    // Horloge système reculée de façon significative depuis le dernier
    // lancement connu : on bloque CE lancement par prudence, sans jamais
    // modifier premierLancement ni dernierVu — dès que l'horloge redevient
    // normale, l'essai reprend son cours là où il en était (pas de reset).
    return { active: false, raison: 'essai_horloge_invalide', machineId };
  } else if (maintenant > etat.dernierVu) {
    etat.dernierVu = maintenant;
    ecrireEssai(etat);
  }

  const heuresEcoulees = (maintenant - etat.premierLancement) / (3600 * 1000);
  const expiresAt = new Date(etat.premierLancement + DUREE_ESSAI_HEURES * 3600 * 1000).toISOString();

  if (heuresEcoulees >= DUREE_ESSAI_HEURES) {
    return { active: false, raison: 'essai_expire', machineId, expiresAt };
  }
  return {
    active: true,
    machineId,
    expiresAt,
    source: 'essai',
    essai: true,
    heuresRestantes: Math.max(0, DUREE_ESSAI_HEURES - heuresEcoulees),
  };
}

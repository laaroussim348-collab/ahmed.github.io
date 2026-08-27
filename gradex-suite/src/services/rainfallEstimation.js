/**
 * rainfallEstimation.js
 * -----------------------------------------------------------------------
 * Combine les séries NASA POWER (nasaPowerClient.js) et l'ajustement
 * statistique (statistics.js) pour produire :
 *  - Pjmax(T) : quantile de pluie journalière maximale annuelle, par
 *    ajustement de Gumbel sur la série journalière (recommandé par le
 *    guide, §2.2.2 — alimente ensuite H(24h,T) = 1.15×Pjmax, relation de
 *    Weiss).
 *  - a(T), b(T) : coefficients de Montana, par régression log-log sur des
 *    maxima annuels glissants à plusieurs durées (série horaire).
 *
 * ⚠️ Résolution spatiale NASA POWER ≈ 50-60 km (réanalyse MERRA-2, pas une
 * station ponctuelle) : les intensités de courte durée (issues de la
 * série horaire) sont structurellement lissées par cette résolution et
 * SOUS-ESTIMENT probablement les intensités convectives réelles, très
 * localisées. Traiter a(T), b(T) obtenus ainsi comme un ordre de
 * grandeur de départ, pas comme un substitut à une étude régionale IDF.
 * -----------------------------------------------------------------------
 */
import { maximaAnnuels, maximaAnnuelsGlissants, anneeDeCle } from './nasaPowerClient.js';
import { ajusterGumbel, quantileGumbel, ajusterMontana } from './statistics.js';

const PERIODES_RETOUR = [10, 20, 50, 100];
const DUREES_MONTANA_H = [1, 2, 3, 6, 12, 24];

/**
 * @param {{dateKey:string, value:number}[]} serieJournaliere  précipitation journalière (mm/j), NASA POWER PRECTOTCORR
 * @returns {{parAnneeDisponibles:number, gumbel:object, pjmax:Record<number,number>}}
 */
export function calculerPjmax(serieJournaliere) {
  const maxima = maximaAnnuels(serieJournaliere);
  if (maxima.length < 10) {
    throw new Error(
      `Seulement ${maxima.length} année(s) de données journalières exploitables : au moins 10 sont recommandées ` +
      `pour un ajustement de Gumbel fiable (idéalement 20-30 ans).`
    );
  }
  const gumbel = ajusterGumbel(maxima.map((m) => m.max));
  const pjmax = {};
  for (const T of PERIODES_RETOUR) pjmax[T] = quantileGumbel(gumbel.u, gumbel.alpha, T);
  return {
    anneesDisponibles: maxima.length,
    premiereAnnee: maxima[0].annee,
    derniereAnnee: maxima[maxima.length - 1].annee,
    gumbel,
    pjmax,
    serieMaxima: maxima,
  };
}

/**
 * @param {{dateKey:string, value:number}[]} serieHoraire  précipitation horaire (mm/h), NASA POWER
 * @returns {{montana: Record<number,{a:number,b:number,r2:number}>, dureesUtilisees:number[]}}
 */
export function calculerMontana(serieHoraire) {
  // 1. Pour chaque durée, série de maxima annuels glissants
  const maximaParDuree = {};
  for (const d of DUREES_MONTANA_H) {
    const m = maximaAnnuelsGlissants(serieHoraire, d);
    if (m.length >= 10) maximaParDuree[d] = m;
  }
  const dureesUtilisees = Object.keys(maximaParDuree).map(Number);
  if (dureesUtilisees.length < 3) {
    throw new Error(
      `Seulement ${dureesUtilisees.length} durée(s) exploitable(s) (au moins 3 nécessaires pour ajuster Montana). ` +
      `Vérifiez la disponibilité de la série horaire NASA POWER (2001 à aujourd'hui) pour ce point.`
    );
  }

  // 2. Pour chaque durée, ajustement de Gumbel -> intensité(T) = quantile(T) / durée
  const intensitesParT = {}; // { T: [{duree_h, intensite_mm_h}] }
  for (const T of PERIODES_RETOUR) intensitesParT[T] = [];
  for (const duree of dureesUtilisees) {
    const gumbel = ajusterGumbel(maximaParDuree[duree].map((m) => m.max));
    for (const T of PERIODES_RETOUR) {
      const cumul_mm = quantileGumbel(gumbel.u, gumbel.alpha, T);
      intensitesParT[T].push({ duree_h: duree, intensite_mm_h: cumul_mm / duree });
    }
  }

  // 3. Régression log-log par période de retour -> a(T), b(T)
  const montana = {};
  for (const T of PERIODES_RETOUR) {
    montana[T] = ajusterMontana(intensitesParT[T]);
  }

  return { montana, dureesUtilisees, anneesUtilisees: Math.min(...dureesUtilisees.map((d) => maximaParDuree[d].length)) };
}

/**
 * Pluie moyenne annuelle (Pma), par simple moyenne des totaux annuels —
 * réutilise la MÊME série journalière que calculerPjmax() (aucun appel
 * réseau supplémentaire). Alimente directement Mallet-Gautier (H en m/an)
 * et Hazan-Lazarevich (Pma en mm/an, sélection de la zone) — ajouté le
 * 13/08/2026 pour relier automatiquement ces 2 méthodes au calcul auto.
 * @param {{dateKey:string, value:number}[]} serieJournaliere
 */
export function calculerPma(serieJournaliere) {
  const parAnnee = new Map();
  for (const { dateKey, value } of serieJournaliere) {
    const annee = anneeDeCle(dateKey);
    if (!parAnnee.has(annee)) parAnnee.set(annee, { somme: 0, jours: 0 });
    const e = parAnnee.get(annee);
    e.somme += value;
    e.jours += 1;
  }
  // Années avec au moins 300 jours de données valides (évite le biais d'une année tronquée) ;
  // pro-rata sur 365j pour les quelques jours manquants, afin de limiter le biais résiduel.
  const anneesCompletes = [...parAnnee.entries()].filter(([, e]) => e.jours >= 300);
  if (anneesCompletes.length < 10) {
    throw new Error(
      `Seulement ${anneesCompletes.length} année(s) suffisamment complète(s) : au moins 10 sont recommandées pour Pma.`
    );
  }
  const totauxCorriges = anneesCompletes.map(([, e]) => e.somme * (365 / e.jours));
  const pma_mm_an = totauxCorriges.reduce((s, v) => s + v, 0) / totauxCorriges.length;
  return {
    pma_mm_an,
    pma_m_an: pma_mm_an / 1000,
    anneesUtilisees: anneesCompletes.length,
    formule: 'Pma = moyenne des totaux annuels de précipitation',
  };
}

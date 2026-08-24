/**
 * nasaPowerClient.js
 * -----------------------------------------------------------------------
 * Construction des requêtes vers l'API NASA POWER et analyse de ses
 * réponses JSON. Les fonctions de CONSTRUCTION D'URL et d'ANALYSE DE
 * RÉPONSE sont pures (testables sans réseau, cf. tests/unit-nasa-power.test.js
 * avec des réponses synthétiques reproduisant le format documenté par la
 * NASA). L'appel réseau lui-même (fetchDailyPrecipitation /
 * fetchHourlyPrecipitation) n'a PAS pu être testé en conditions réelles
 * dans cet environnement de développement (pas d'accès réseau sortant) —
 * voir README §11.
 *
 * Documentation officielle :
 *  - https://power.larc.nasa.gov/docs/services/api/temporal/daily/
 *  - https://power.larc.nasa.gov/docs/services/api/temporal/hourly/
 *
 * Couverture temporelle (documentée) :
 *  - Daily  : 1981-01-01 à quasi temps réel (~44 ans en 2026)
 *  - Hourly : 2001-01-01 à quasi temps réel (~24 ans en 2026)
 *
 * Résolution spatiale : grille de réanalyse MERRA-2, environ 0.5°×0.625°
 * (~50-60 km) — PAS une mesure de station ponctuelle. À utiliser comme
 * ordre de grandeur régional, jamais comme substitut à une station
 * pluviométrique locale si celle-ci est disponible.
 * -----------------------------------------------------------------------
 */

const BASE_URL = 'https://power.larc.nasa.gov/api/temporal';
const VALEUR_MANQUANTE_NASA = -999; // valeur de remplissage documentée par la NASA pour donnée absente

export function buildDailyPrecipitationUrl(lat, lon, startYYYYMMDD, endYYYYMMDD) {
  const params = new URLSearchParams({
    parameters: 'PRECTOTCORR',
    community: 'AG',
    longitude: String(lon),
    latitude: String(lat),
    start: startYYYYMMDD,
    end: endYYYYMMDD,
    format: 'JSON',
  });
  return `${BASE_URL}/daily/point?${params.toString()}`;
}

export function buildHourlyPrecipitationUrl(lat, lon, startYYYYMMDD, endYYYYMMDD) {
  const params = new URLSearchParams({
    parameters: 'PRECTOTCORR,PRECTOT',
    community: 'AG',
    longitude: String(lon),
    latitude: String(lat),
    start: startYYYYMMDD,
    end: endYYYYMMDD,
    format: 'JSON',
    'time-standard': 'UTC',
  });
  return `${BASE_URL}/hourly/point?${params.toString()}`;
}

/**
 * Analyse une réponse JSON de l'API NASA POWER (daily ou hourly) et
 * renvoie une série propre [{dateKey, value}], en filtrant les valeurs
 * manquantes (-999) et en essayant plusieurs noms de paramètres possibles
 * (l'API a renommé PRECTOT -> PRECTOTCORR selon les endpoints/versions ;
 * on reste robuste aux deux).
 */
export function parseNasaPowerSeries(json, candidats = ['PRECTOTCORR', 'PRECTOT']) {
  const parametre = json?.properties?.parameter;
  if (!parametre) {
    throw new Error("Réponse NASA POWER inattendue : bloc 'properties.parameter' absent.");
  }
  let cle = candidats.find((c) => parametre[c]);
  if (!cle) {
    throw new Error(`Aucun des paramètres attendus (${candidats.join(', ')}) n'est présent dans la réponse NASA POWER.`);
  }
  const brut = parametre[cle];
  return Object.entries(brut)
    .filter(([, v]) => v !== VALEUR_MANQUANTE_NASA && v !== null && v !== undefined && !Number.isNaN(v))
    .map(([dateKey, value]) => ({ dateKey, value: Number(value) }))
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
}

/** Extrait l'année (AAAA) d'une clé de date NASA POWER ("20230115" ou "2023011506"). */
export function anneeDeCle(dateKey) {
  return Number(dateKey.slice(0, 4));
}
/** Extrait le jour (AAAAMMJJ) d'une clé de date, pour regrouper les heures d'une même journée. */
export function jourDeCle(dateKey) {
  return dateKey.slice(0, 8);
}

/**
 * Regroupe une série journalière par année et renvoie le maximum annuel —
 * c'est la série de "maxima annuels" nécessaire à l'ajustement de Gumbel.
 */
export function maximaAnnuels(serieJournaliere) {
  const parAnnee = new Map();
  for (const { dateKey, value } of serieJournaliere) {
    const annee = anneeDeCle(dateKey);
    if (!parAnnee.has(annee) || value > parAnnee.get(annee)) parAnnee.set(annee, value);
  }
  return [...parAnnee.entries()].map(([annee, max]) => ({ annee, max })).sort((a, b) => a.annee - b.annee);
}

/**
 * À partir d'une série HORAIRE, calcule pour chaque année le cumul de
 * précipitation maximal glissant sur une durée donnée (en heures) —
 * utilisé pour construire les maxima annuels par durée (1h, 2h, 3h, 6h,
 * 12h, 24h) nécessaires à l'ajustement des coefficients de Montana.
 */
export function maximaAnnuelsGlissants(serieHoraire, dureeHeures) {
  // Regrouper par année pour ne pas faire glisser une fenêtre à cheval sur 2 années
  const parAnnee = new Map();
  for (const point of serieHoraire) {
    const annee = anneeDeCle(point.dateKey);
    if (!parAnnee.has(annee)) parAnnee.set(annee, []);
    parAnnee.get(annee).push(point.value);
  }
  const resultats = [];
  for (const [annee, valeurs] of parAnnee.entries()) {
    if (valeurs.length < dureeHeures) continue;
    let max = -Infinity;
    let sommeCourante = valeurs.slice(0, dureeHeures).reduce((s, v) => s + v, 0);
    max = sommeCourante;
    for (let i = dureeHeures; i < valeurs.length; i++) {
      sommeCourante += valeurs[i] - valeurs[i - dureeHeures];
      if (sommeCourante > max) max = sommeCourante;
    }
    resultats.push({ annee, max });
  }
  return resultats;
}

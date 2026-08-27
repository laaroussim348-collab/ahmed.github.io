/**
 * units.js
 * -----------------------------------------------------------------------
 * Conversions d'unités centralisées.
 *
 * Règle du projet (cf. cahier des charges §8) : AUCUNE conversion implicite
 * dans les formules. Toute conversion doit passer par une fonction de ce
 * fichier, nommée explicitement, pour rester traçable et vérifiable.
 *
 * Convention : les fonctions sont nommées `<unitéSource>To<unitéCible>`.
 * -----------------------------------------------------------------------
 */

// --- Surfaces ---
export const km2ToHa = (km2) => km2 * 100;
export const haToKm2 = (ha) => ha / 100;
export const km2ToM2 = (km2) => km2 * 1_000_000;
export const m2ToKm2 = (m2) => m2 / 1_000_000;

// --- Longueurs ---
export const kmToM = (km) => km * 1000;
export const mToKm = (m) => m / 1000;

// --- Pentes ---
// Une pente peut être exprimée en m/m (fraction), en % (m/m × 100),
// ou en ‰ / mm par m (m/m × 1000). Le guide utilise les 3 selon la formule.
export const mParMToPourcent = (i) => i * 100;
export const pourcentToMParM = (i) => i / 100;
export const mParMToPourMille = (i) => i * 1000; // équivalent à mm/m
export const pourMilleToMParM = (i) => i / 1000;
export const pourcentToPourMille = (i) => i * 10;
export const pourMilleToPourcent = (i) => i / 10;

// --- Temps ---
export const hToMin = (h) => h * 60;
export const minToH = (min) => min / 60;
export const minToS = (min) => min * 60;
export const sToMin = (s) => s / 60;
export const hToS = (h) => h * 3600;
export const sToH = (s) => s / 3600;

// --- Pluie / intensité ---
export const mmToM = (mm) => mm / 1000;
export const mToMm = (m) => m * 1000;
// mm/h -> m/s (utile pour vérifications dimensionnelles, ex. vitesses SETRA)
export const mmParHToMParS = (i) => i / 1000 / 3600;
export const mParSToMmParH = (v) => v * 3600 * 1000;

/**
 * Arrondi tardif : à utiliser UNIQUEMENT à l'affichage final,
 * jamais entre deux étapes de calcul (cf. cahier des charges §14).
 */
export function arrondi(valeur, decimales = 2) {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return valeur;
  const f = Math.pow(10, decimales);
  return Math.round(valeur * f) / f;
}

/**
 * Formate un nombre pour affichage avec unité.
 */
export function fmt(valeur, decimales = 2, unite = '') {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return 'N/A';
  const arrondi_ = arrondi(valeur, decimales);
  return unite ? `${arrondi_} ${unite}` : `${arrondi_}`;
}

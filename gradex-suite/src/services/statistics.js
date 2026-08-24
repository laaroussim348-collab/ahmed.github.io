/**
 * statistics.js
 * -----------------------------------------------------------------------
 * Fonctions statistiques PURES (aucun appel réseau) utilisées pour
 * l'analyse fréquentielle des pluies (loi de Gumbel — méthode des
 * moments, standard en hydrologie pour les séries de maxima annuels) et
 * pour l'ajustement des coefficients de Montana par régression log-log.
 *
 * Couvertes par tests/unit-geo-stats.test.js avec des cas calculables à
 * la main.
 * -----------------------------------------------------------------------
 */

const GAMMA_EULER_MASCHERONI = 0.5772156649015329;

function moyenne(arr) {
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}
function ecartTypeEchantillon(arr) {
  const m = moyenne(arr);
  const sommeCarres = arr.reduce((s, x) => s + (x - m) ** 2, 0);
  return Math.sqrt(sommeCarres / (arr.length - 1));
}

/**
 * Ajustement d'une loi de Gumbel (loi des valeurs extrêmes de type I) par
 * la méthode des moments — méthode standard pour l'analyse fréquentielle
 * de séries de maxima annuels (pluies, débits).
 * @param {number[]} echantillon  série de maxima annuels (ex. Pjmax par année)
 * @returns {{u:number, alpha:number, n:number}} paramètres de position (u) et d'échelle (alpha)
 */
export function ajusterGumbel(echantillon) {
  if (!Array.isArray(echantillon) || echantillon.length < 5) {
    throw new Error("L'ajustement de Gumbel nécessite au moins 5 valeurs annuelles (5 ans de données).");
  }
  const s = ecartTypeEchantillon(echantillon);
  const m = moyenne(echantillon);
  const alpha = (Math.sqrt(6) / Math.PI) * s;
  const u = m - GAMMA_EULER_MASCHERONI * alpha;
  return { u, alpha, n: echantillon.length, moyenne: m, ecartType: s };
}

/**
 * Quantile de Gumbel pour une période de retour T (années).
 * x(T) = u − α·ln(−ln(1 − 1/T))
 */
export function quantileGumbel(u, alpha, T) {
  if (!(T > 1)) throw new Error('La période de retour T doit être strictement supérieure à 1 an.');
  const F = 1 - 1 / T; // probabilité de non-dépassement
  return u - alpha * Math.log(-Math.log(F));
}

/**
 * Régression linéaire simple (moindres carrés) y = pente·x + ordonnée.
 */
export function regressionLineaire(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) {
    throw new Error('La régression nécessite au moins 2 points, avec autant de x que de y.');
  }
  const mx = moyenne(xs);
  const my = moyenne(ys);
  let num = 0;
  let denom = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    denom += (xs[i] - mx) ** 2;
  }
  const pente = num / denom;
  const ordonnee = my - pente * mx;
  // R² (qualité d'ajustement)
  const yPred = xs.map((x) => pente * x + ordonnee);
  const ssRes = ys.reduce((s, y, i) => s + (y - yPred[i]) ** 2, 0);
  const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;
  return { pente, ordonnee, r2 };
}

/**
 * Ajustement des coefficients de Montana i(t) = a·t^-b à partir de couples
 * (durée en heures, intensité en mm/h), par régression log-log :
 *   ln(i) = ln(a) − b·ln(t)
 * @param {{duree_h:number, intensite_mm_h:number}[]} points
 * @returns {{a:number, b:number, r2:number}}
 */
export function ajusterMontana(points) {
  const valides = points.filter((p) => p.duree_h > 0 && p.intensite_mm_h > 0);
  if (valides.length < 3) {
    throw new Error("L'ajustement de Montana nécessite au moins 3 couples (durée, intensité) valides.");
  }
  const xs = valides.map((p) => Math.log(p.duree_h));
  const ys = valides.map((p) => Math.log(p.intensite_mm_h));
  const { pente, ordonnee, r2 } = regressionLineaire(xs, ys);
  return { a: Math.exp(ordonnee), b: -pente, r2, nombrePoints: valides.length };
}

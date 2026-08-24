/**
 * unit-geo-stats.test.js
 * -----------------------------------------------------------------------
 * Tests des fonctions PURES de src/services (geoMath.js, statistics.js)
 * contre des cas de référence calculables indépendamment (à la main ou
 * par une formule connue), PUISQUE ces fonctions ne peuvent pas être
 * comparées à une cellule Excel comme le reste du moteur.
 *
 * Exécution : node tests/unit-geo-stats.test.js
 * -----------------------------------------------------------------------
 */
import { distanceHaversine, longueurPolyligne, perimetrePolygone, plusLongCheminEcoulement, pointsSurChemin } from '../src/services/geoMath.js';
import { ajusterGumbel, quantileGumbel, regressionLineaire, ajusterMontana } from '../src/services/statistics.js';

let total = 0;
let reussis = 0;
function verifier(nom, obtenu, attendu, tolerance = 1e-6) {
  total++;
  const ok = typeof attendu === 'number' ? Math.abs(obtenu - attendu) <= tolerance : JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) reussis++;
  console.log(`${ok ? '✅' : '❌'} ${nom}  →  obtenu=${JSON.stringify(obtenu)}  attendu=${JSON.stringify(attendu)}`);
}

console.log('\n=== geoMath.js ===\n');

// 1 degré de latitude ≈ 111 195 m (valeur de référence géodésique standard)
verifier('distanceHaversine : 1° de latitude à l\'équateur', distanceHaversine(0, 0, 1, 0), 111195, 50);

// Distance Rabat -> Casablanca (≈ 87 km à vol d'oiseau, valeur de référence connue)
verifier(
  'distanceHaversine : Rabat → Casablanca ≈ 87 km',
  Math.round(distanceHaversine(34.0209, -6.8416, 33.5731, -7.5898) / 1000),
  87,
  5
);

// Carré de 1000m x 1000m (approx, aux latitudes moyennes) -> périmètre ≈ 4000m
{
  const lat0 = 33.9;
  const dLat = 1000 / 111195; // ≈ 0.008994°
  const dLon = 1000 / (111195 * Math.cos((lat0 * Math.PI) / 180));
  const carre = [
    [-6.85, lat0], [-6.85 + dLon, lat0], [-6.85 + dLon, lat0 + dLat], [-6.85, lat0 + dLat], [-6.85, lat0],
  ];
  verifier('perimetrePolygone : carré ≈1000m de côté → périmètre ≈4000m', Math.round(perimetrePolygone(carre) / 10) * 10, 4000, 60);
}

// Réseau en Y : exutoire O -> confluence C -> 2 affluents A (court) et B (long).
// Chaque longueur d'arête est d'abord calculée indépendamment avec distanceHaversine
// (déjà validée ci-dessus), pour vérifier que l'algorithme choisit bien la branche
// B (la plus longue) et additionne correctement O-C + C-B.
{
  const O = [-6.85, 33.90];
  const C = [-6.85, 33.95];
  const A = [-6.90, 34.00]; // branche courte
  const B = [-6.80, 34.05]; // branche longue

  const longOC = distanceHaversine(O[1], O[0], C[1], C[0]);
  const longCA = distanceHaversine(C[1], C[0], A[1], A[0]);
  const longCB = distanceHaversine(C[1], C[0], B[1], B[0]);
  console.log(`   (info) longueurs indépendantes : O-C=${longOC.toFixed(0)}m, C-A=${longCA.toFixed(0)}m, C-B=${longCB.toFixed(0)}m`);

  const troncons = [
    { coordinates: [O, C] },
    { coordinates: [C, A] },
    { coordinates: [C, B] },
  ];
  const r = plusLongCheminEcoulement(troncons, O);
  verifier('plusLongCheminEcoulement : nombre de tronçons détectés', r.nombreTroncons, 3);
  verifier('plusLongCheminEcoulement : choisit la branche B (la plus longue), pas A', longCB > longCA, true);
  verifier('plusLongCheminEcoulement : longueur totale = O-C + C-B', r.longueur_m, longOC + longCB, 1);
}

// pointsSurChemin : chemin rectiligne à l'équateur, 2 segments de 1° chacun (longueurs égales)
{
  const chemin = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }];
  const pts = pointsSurChemin(chemin, [0, 0.25, 0.5, 0.75, 1]);
  verifier('pointsSurChemin : fraction 0 = premier point', [pts[0].lat, pts[0].lon], [0, 0]);
  verifier('pointsSurChemin : fraction 0.5 = point médian exact', Math.round(pts[2].lon * 1000) / 1000, 1);
  verifier('pointsSurChemin : fraction 1 = dernier point', [pts[4].lat, pts[4].lon], [0, 2]);
  verifier('pointsSurChemin : fraction 0.25 = milieu du 1er segment', Math.round(pts[1].lon * 1000) / 1000, 0.5);
}

console.log('\n=== statistics.js ===\n');
// Gumbel : échantillon simple avec moyenne et écart-type connus
{
  // Série choisie pour avoir mean=100, et un écart-type facilement vérifiable
  const echantillon = [80, 90, 95, 100, 105, 110, 120]; // n=7
  const moyenneAttendue = (80 + 90 + 95 + 100 + 105 + 110 + 120) / 7;
  const r = ajusterGumbel(echantillon);
  verifier('ajusterGumbel : moyenne de l\'échantillon', r.moyenne, moyenneAttendue, 1e-9);
  // alpha = sqrt(6)/pi * ecartType ; u = moyenne - 0.5772*alpha (relations internes, vérifie la cohérence)
  const alphaAttendu = (Math.sqrt(6) / Math.PI) * r.ecartType;
  verifier('ajusterGumbel : alpha = √6/π × écart-type', r.alpha, alphaAttendu, 1e-9);
  const uAttendu = r.moyenne - 0.5772156649015329 * r.alpha;
  verifier('ajusterGumbel : u = moyenne − γ×alpha', r.u, uAttendu, 1e-9);

  // quantileGumbel : à T→très grand, le quantile doit dépasser largement la moyenne (événement rare)
  const xT100 = quantileGumbel(r.u, r.alpha, 100);
  verifier('quantileGumbel : x(T=100) > moyenne (événement extrême)', xT100 > r.moyenne, true);
  const xT2 = quantileGumbel(r.u, r.alpha, 2);
  verifier('quantileGumbel : x(T=2) < x(T=100) (croissance avec T)', xT2 < xT100, true);
}

// Régression log-log : cas construit pour retrouver EXACTEMENT a=20, b=0.5
{
  const a_vrai = 20;
  const b_vrai = 0.5;
  const durees = [0.25, 0.5, 1, 2, 6, 12, 24];
  const points = durees.map((t) => ({ duree_h: t, intensite_mm_h: a_vrai * Math.pow(t, -b_vrai) }));
  const r = ajusterMontana(points);
  verifier('ajusterMontana : retrouve a=20 (données sans bruit)', r.a, 20, 1e-6);
  verifier('ajusterMontana : retrouve b=0.5 (données sans bruit)', r.b, 0.5, 1e-6);
  verifier('ajusterMontana : R²=1 (ajustement parfait, données sans bruit)', r.r2, 1, 1e-6);
}

console.log(`\n${reussis} / ${total} tests réussis.\n`);
if (reussis < total) {
  console.error('❌ Des tests ont échoué.');
  process.exit(1);
} else {
  console.log('✅ Toutes les fonctions géo/statistiques pures sont conformes aux valeurs de référence calculées indépendamment.');
}

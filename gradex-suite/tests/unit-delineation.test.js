/**
 * unit-delineation.test.js
 * -----------------------------------------------------------------------
 * Teste l'analyse des réponses mghydro.com / Open-Meteo avec des réponses
 * SYNTHÉTIQUES reproduisant EXACTEMENT les exemples publiés dans leur
 * documentation officielle (vérifiée le 12/08/2026, voir
 * delineationClient.js). Ne teste pas l'appel réseau lui-même.
 * -----------------------------------------------------------------------
 */
import { parseWatershedResponse, parseRiversResponse, parseElevationResponse, buildElevationUrl } from '../src/services/delineationClient.js';

let total = 0;
let reussis = 0;
function verifier(nom, obtenu, attendu) {
  total++;
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) reussis++;
  console.log(`${ok ? '✅' : '❌'} ${nom}  →  obtenu=${JSON.stringify(obtenu)}  attendu=${JSON.stringify(attendu)}`);
}

console.log('\n=== delineationClient.js ===\n');

// Exemple EXACT reproduit depuis https://mghydro.com/watersheds/help.html
const exempleWatershed = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[-80.51958, 40.11708], [-80.51375, 40.11791], [-80.51958, 40.11708]]] },
    properties: { area_km2: '421', outlet_lat: 40.23, outlet_lng: -80.61 }, // area_km2 est une CHAÎNE dans l'exemple officiel
  }],
};
{
  const r = parseWatershedResponse(exempleWatershed);
  verifier('parseWatershedResponse : surface_km2 (converti depuis chaîne "421")', r.surface_km2, 421);
  verifier('parseWatershedResponse : anneau extrait (3 points)', r.ring.length, 3);
  verifier('parseWatershedResponse : exutoire extrait', r.outlet, [-80.61, 40.23]);
}

// Exemple EXACT reproduit depuis la doc officielle (rivers GeoJSON)
const exempleRivers = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-77.64167, 43.12167], [-77.66083, 43.11083]] }, properties: { comid: 72056019, sorder: 4 } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-77.92583, 42.06417], [-77.93083, 42.07083]] }, properties: { comid: 72058947, sorder: 1 } },
  ],
};
{
  const r = parseRiversResponse(exempleRivers);
  verifier('parseRiversResponse : 2 tronçons extraits', r.length, 2);
  verifier('parseRiversResponse : sorder conservé', r.map((t) => t.sorder), [4, 1]);
}

// Exemple EXACT reproduit depuis https://open-meteo.com/en/docs/elevation-api
{
  const reponse = { elevation: [38.0] };
  verifier('parseElevationResponse : altitude unique', parseElevationResponse(reponse), [38.0]);

  const reponseMultiple = { elevation: [957, 1450, 3865] };
  verifier('parseElevationResponse : altitudes multiples (ordre conservé)', parseElevationResponse(reponseMultiple), [957, 1450, 3865]);

  const url = buildElevationUrl([[33.97, -6.85], [34.10, -6.90]]);
  verifier('buildElevationUrl : latitudes et longitudes correctement listées', url.includes('latitude=33.97,34.1') && url.includes('longitude=-6.85,-6.9'), true);
}

console.log(`\n${reussis} / ${total} tests réussis.\n`);
if (reussis < total) {
  console.error('❌ Des tests ont échoué.');
  process.exit(1);
} else {
  console.log('✅ Analyse des réponses de délimitation/altimétrie conforme aux exemples officiels.');
}

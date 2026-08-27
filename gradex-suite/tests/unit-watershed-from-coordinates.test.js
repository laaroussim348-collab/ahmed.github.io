/**
 * unit-watershed-from-coordinates.test.js
 * -----------------------------------------------------------------------
 * Test d'intégration (sans réseau) de l'assemblage complet : polygone +
 * réseau hydrographique + altitudes -> caractéristiques du bassin versant
 * prêtes à être injectées dans src/calculations/watershed.js.
 * -----------------------------------------------------------------------
 */
import { analyserDelimitation, finaliserCaracteristiques } from '../src/services/watershedFromCoordinates.js';
import { distanceHaversine } from '../src/services/geoMath.js';

let total = 0;
let reussis = 0;
function verifier(nom, condition, info = '') {
  total++;
  if (condition) reussis++;
  console.log(`${condition ? '✅' : '❌'} ${nom}${info ? '  ' + info : ''}`);
}

console.log('\n=== watershedFromCoordinates.js (intégration complète) ===\n');

// --- Cas nominal : bassin en Y avec exutoire, confluence, 2 affluents ---
{
  const exutoire = [33.90, -6.85]; // [lat, lon]
  const confluence = [33.95, -6.85];
  const finAffluentCourt = [34.00, -6.90];
  const finAffluentLong = [34.05, -6.80]; // branche la plus longue -> thalweg principal

  const watershed = {
    surface_km2: 42.5,
    ring: [[-6.95, 33.85], [-6.75, 33.85], [-6.75, 34.10], [-6.95, 34.10], [-6.95, 33.85]],
  };
  const rivers = [
    { coordinates: [[exutoire[1], exutoire[0]], [confluence[1], confluence[0]]] },
    { coordinates: [[confluence[1], confluence[0]], [finAffluentCourt[1], finAffluentCourt[0]]] },
    { coordinates: [[confluence[1], confluence[0]], [finAffluentLong[1], finAffluentLong[0]]] },
  ];

  const analyse = analyserDelimitation(watershed, rivers, exutoire);
  verifier('analyserDelimitation : surface transmise telle quelle', analyse.surface_km2 === 42.5);
  verifier('analyserDelimitation : périmètre calculé (>0)', analyse.perimetre_km > 0, `périmètre=${analyse.perimetre_km.toFixed(2)}km`);
  verifier('analyserDelimitation : longueur du thalweg calculée (branche longue choisie)', analyse.longueur_km > 0, `L=${analyse.longueur_km?.toFixed(3)}km`);
  verifier('analyserDelimitation : 6 points à interroger (exutoire + 5 fractions)', analyse.pointsAltitudeAQuerir.length === 6);
  verifier('analyserDelimitation : le 1er point interrogé est l\'exutoire', analyse.pointsAltitudeAQuerir[0][0] === exutoire[0] && analyse.pointsAltitudeAQuerir[0][1] === exutoire[1]);

  // Altitudes croissantes de l'aval vers l'amont (cohérent avec un écoulement gravitaire)
  const altitudesSimulees = [957, 1150, 1400, 1700, 2100, 2600]; // exutoire -> tête de bassin (6 points)
  const finales = finaliserCaracteristiques(analyse, altitudesSimulees);
  verifier('finaliserCaracteristiques : altitude min = altitude exutoire', finales.altitude_min_m === 957);
  verifier('finaliserCaracteristiques : altitude max = altitude tête de bassin', finales.altitude_max_m === 2600);
  verifier('finaliserCaracteristiques : 5 tronçons générés', finales.troncons.length === 5);
  verifier(
    'finaliserCaracteristiques : somme des longueurs des tronçons = longueur totale du thalweg',
    Math.abs(finales.troncons.reduce((s, t) => s + t.longueur_m, 0) - analyse.longueur_km * 1000) < 1,
  );
  verifier('finaliserCaracteristiques : aucun avertissement bloquant dans le cas nominal', finales.avertissements.length === 0, JSON.stringify(finales.avertissements));
}

// --- Cas dégradé : aucun réseau hydrographique renvoyé (avertissement attendu, pas de crash) ---
{
  const watershed = { surface_km2: 15, ring: [[-6.9, 33.9], [-6.8, 33.9], [-6.8, 34.0], [-6.9, 34.0], [-6.9, 33.9]] };
  const analyse = analyserDelimitation(watershed, [], [33.95, -6.85]);
  verifier('Cas sans rivière : ne lève pas d\'exception', true);
  verifier('Cas sans rivière : avertissement explicite émis', analyse.avertissements.length > 0);
  verifier('Cas sans rivière : longueur_km reste null (pas de valeur inventée)', analyse.longueur_km === null);

  const finales = finaliserCaracteristiques(analyse, [957]); // un seul point interrogé (exutoire)
  verifier('Cas sans rivière : altitude_min_m tout de même disponible', finales.altitude_min_m === 957);
  verifier('Cas sans rivière : troncons vide (pas de thalweg tracé)', finales.troncons.length === 0);
}

// --- Cas incohérent : altitude amont <= altitude exutoire (doit déclencher un avertissement, pas planter) ---
{
  const watershed = { surface_km2: 10, ring: [[-6.9, 33.9], [-6.8, 33.9], [-6.8, 34.0], [-6.9, 34.0], [-6.9, 33.9]] };
  const rivers = [{ coordinates: [[-6.85, 33.90], [-6.85, 33.95]] }];
  const analyse = analyserDelimitation(watershed, rivers, [33.90, -6.85]);
  const finales = finaliserCaracteristiques(analyse, [957, 950, 940, 930]); // altitudes DÉCROISSANTES (incohérent)
  verifier('Cas incohérent (altitude amont < exutoire) : avertissement émis', finales.avertissements.some((a) => a.includes('incohérent')));
}

// --- Cas bruit MNT : une baisse locale isolée doit être corrigée automatiquement, pas juste signalée ---
{
  const watershed = { surface_km2: 20, ring: [[-6.9, 33.9], [-6.8, 33.9], [-6.8, 34.0], [-6.9, 34.0], [-6.9, 33.9]] };
  const rivers = [{ coordinates: [[-6.85, 33.90], [-6.85, 33.95], [-6.85, 34.00]] }];
  const analyse = analyserDelimitation(watershed, rivers, [33.90, -6.85]);
  // profil globalement croissant MAIS avec un creux local au point 3 (bruit MNT typique) :
  // 900 -> 950 -> 940(!) -> 1000 -> 1100 -> 1200
  const altitudesAvecBruit = [900, 950, 940, 1000, 1100, 1200];
  const finales = finaliserCaracteristiques(analyse, altitudesAvecBruit);
  verifier('Cas bruit MNT : le creux local est corrigé (monotone croissant garanti)', finales.troncons.every((t) => t.altitude_aval_m >= t.altitude_amont_m));
  verifier('Cas bruit MNT : correction signalée à l\'utilisateur (transparence)', finales.avertissements.some((a) => a.includes('corrigé')));
  verifier('Cas bruit MNT : altitude max toujours cohérente (1200, dernier point)', finales.altitude_max_m === 1200);
}

console.log(`\n${reussis} / ${total} vérifications réussies.\n`);
if (reussis < total) {
  console.error('❌ Des vérifications ont échoué.');
  process.exit(1);
} else {
  console.log('✅ Assemblage complet des caractéristiques du bassin versant conforme aux invariants attendus.');
}

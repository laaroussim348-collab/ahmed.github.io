/**
 * watershedFromCoordinates.js
 * -----------------------------------------------------------------------
 * Combine les données de délimitation (polygone + réseau hydrographique,
 * mghydro.com) et les fonctions géométriques pures (geoMath.js) pour
 * produire les caractéristiques du bassin versant, PUIS détermine les
 * points où interroger l'altitude (Open-Meteo). Un second appel
 * (finaliserCaracteristiques) combine les altitudes obtenues.
 *
 * Découpage en 2 temps volontaire : on ne sait quels points interroger
 * pour l'altitude qu'une fois le tracé du thalweg principal connu.
 * -----------------------------------------------------------------------
 */
import { perimetrePolygone, plusLongCheminEcoulement, pointsSurChemin, corrigerProfilMonotone } from './geoMath.js';

// 6 points -> 5 tronçons (plus fin que les 4 points/3 tronçons initiaux, pour amortir le bruit
// du MNT à 90m sur chaque tronçon individuel — cf. retour utilisateur du 13/08/2026).
const FRACTIONS_TRONCONS = [0, 0.2, 0.4, 0.6, 0.8, 1];

/**
 * @param {{surface_km2:number, ring:[number,number][]}} watershed  cf. parseWatershedResponse
 * @param {{coordinates:[number,number][], sorder:number|null}[]} rivers  cf. parseRiversResponse
 * @param {[number, number]} exutoireLatLon  [lat, lon] saisi par l'utilisateur
 */
export function analyserDelimitation(watershed, rivers, exutoireLatLon) {
  const [lat, lon] = exutoireLatLon;
  const avertissements = [];

  const perimetre_km = perimetrePolygone(watershed.ring) / 1000;

  let longueur_km = null;
  let pointsAQuerir = [[lat, lon]]; // au minimum, l'exutoire lui-même
  let cheminPrincipal = null;

  if (rivers.length === 0) {
    avertissements.push(
      "Aucun réseau hydrographique renvoyé pour ce point : la longueur du thalweg principal n'a pas pu être " +
      'calculée automatiquement. Renseignez-la manuellement (mesure sur carte topographique ou imagerie satellite).'
    );
  } else {
    const resultat = plusLongCheminEcoulement(rivers, [lon, lat]);
    if (resultat.longueur_m) {
      longueur_km = resultat.longueur_m / 1000;
      cheminPrincipal = resultat.chemin;
      const pts = pointsSurChemin(resultat.chemin, FRACTIONS_TRONCONS);
      pointsAQuerir = pts.map((p) => [p.lat, p.lon]);
    } else {
      avertissements.push(resultat.avertissement || 'Longueur du thalweg non déterminée.');
    }
  }

  if (watershed.surfaceApproximee) {
    avertissements.push(
      "Surface calculée localement à partir du contour (le service de délimitation n'a pas renvoyé de valeur " +
      "exploitable pour ce point) : moins précise qu'une mesure SIG directe — vérifiez si possible sur une carte " +
      'topographique.'
    );
  }

  // Avertissement informatif seulement — la délimitation et le calcul des
  // caractéristiques restent effectués normalement quelle que soit la
  // surface obtenue (y compris pour les grands bassins versants, hors du
  // champ d'application usuel du guide d'assainissement routier, dont les 7
  // méthodes de débit de pointe sont calibrées pour de petits BV).
  if (watershed.surface_km2 < 0.5) {
    avertissements.push(
      `Surface obtenue (${watershed.surface_km2.toFixed(2)} km²) très petite : vérifiez que le point saisi est ` +
      `bien situé sur un cours d'eau, pas à côté.`
    );
  } else if (watershed.surface_km2 > 150) {
    avertissements.push(
      `Surface obtenue (${watershed.surface_km2.toFixed(2)} km²) au-delà de la plage usuelle des petits bassins ` +
      `versants couverts par le guide d'assainissement routier (< 100-150 km²) : le calcul est effectué ` +
      `normalement, mais les 7 méthodes de débit de pointe de cet onglet ne sont calibrées/validées que pour ` +
      `de petits BV — pour un grand bassin versant, privilégiez la méthode GRADEX (onglet Données).`
    );
  }

  return {
    surface_km2: watershed.surface_km2,
    perimetre_km,
    longueur_km,
    cheminPrincipal,
    ring: watershed.ring, // contour du bassin, [lon,lat][] (GeoJSON) — pour affichage carte
    rivers, // réseau hydrographique complet, [{coordinates:[lon,lat][], sorder}] — pour affichage carte
    pointsAltitudeAQuerir: pointsAQuerir, // [lat,lon][], à passer à l'API d'altimétrie, DANS CET ORDRE
    avertissements,
  };
}

/**
 * Deuxième étape : combine les altitudes obtenues (dans le même ordre que
 * pointsAltitudeAQuerir) pour produire les tronçons et altitudes min/max.
 * @param {ReturnType<typeof analyserDelimitation>} analyse
 * @param {number[]} altitudes_m  altitudes, MÊME ORDRE que analyse.pointsAltitudeAQuerir
 */
export function finaliserCaracteristiques(analyse, altitudes_m_brutes) {
  const avertissements = [...analyse.avertissements];

  // Le profil doit être croissant (ou stable) de l'exutoire vers l'amont ;
  // toute baisse locale est un artefact du MNT (bruit à 90m, décalage de
  // calage...), corrigé par report de la valeur précédente.
  const { altitudes: altitudes_m, corrections } = corrigerProfilMonotone(altitudes_m_brutes);
  if (corrections.length > 0) {
    avertissements.push(
      `${corrections.length} point(s) d'altitude incohérent(s) (baisse locale vers l'amont) corrigé(s) automatiquement ` +
      `— probablement du bruit du MNT (résolution ~90m). Détail : ` +
      corrections.map((c) => `point ${c.index + 1} : ${c.brut}m → ${c.corrige}m`).join(', ') + '.'
    );
  }

  const altitude_min_m = altitudes_m[0]; // exutoire = 1er point interrogé
  let altitude_max_m = null;
  let troncons = [];

  if (altitudes_m.length >= 2 && analyse.cheminPrincipal) {
    // N points le long du thalweg -> N-1 tronçons, dans l'ordre exutoire -> amont
    const fractions = FRACTIONS_TRONCONS.slice(0, altitudes_m.length);
    const distances = pointsSurChemin(analyse.cheminPrincipal, fractions).map((p) => p.distanceDepuisDepart_m);
    troncons = altitudes_m.slice(0, -1).map((_, i) => ({
      longueur_m: distances[i + 1] - distances[i],
      altitude_amont_m: altitudes_m[i],
      altitude_aval_m: altitudes_m[i + 1],
    }));
    altitude_max_m = altitudes_m[altitudes_m.length - 1];
    if (troncons.some((t) => t.longueur_m <= 0)) {
      avertissements.push('Tronçons calculés incohérents (longueur nulle ou négative) — à vérifier manuellement.');
      troncons = [];
    }
  } else {
    altitude_max_m = altitudes_m.length > 1 ? Math.max(...altitudes_m) : null;
    avertissements.push("Découpage en tronçons non disponible (thalweg non tracé) : pente pondérée à renseigner manuellement.");
  }

  if (altitude_max_m != null && altitude_min_m != null && altitude_max_m <= altitude_min_m) {
    avertissements.push(
      `Altitude amont (${altitude_max_m}m) ≤ altitude à l'exutoire (${altitude_min_m}m) : résultat incohérent, ` +
      `probablement un point de délimitation imprécis. Vérifiez et corrigez manuellement les altitudes.`
    );
  }

  return {
    surface_km2: analyse.surface_km2,
    perimetre_km: analyse.perimetre_km,
    longueur_km: analyse.longueur_km,
    altitude_min_m,
    altitude_max_m,
    troncons,
    // Géométrie pour affichage carte (Leaflet attend [lat,lon], le GeoJSON de
    // mghydro.com est en [lon,lat] — conversion faite ici, une seule fois).
    contour_latlon: (analyse.ring || []).map(([lon, lat]) => [lat, lon]),
    coursEau_latlon: (analyse.rivers || []).map((r) => r.coordinates.map(([lon, lat]) => [lat, lon])),
    avertissements,
  };
}

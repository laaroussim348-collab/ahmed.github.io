/**
 * delineationClient.js
 * -----------------------------------------------------------------------
 * Construction des requêtes vers les services de délimitation de bassin
 * versant (mghydro.com — Global Watersheds, données MERIT-Hydro) et
 * d'altimétrie (Open-Meteo Elevation API — MNT Copernicus GLO-90), et
 * analyse de leurs réponses GeoJSON / JSON.
 *
 * Sources vérifiées le 12/08/2026 :
 *  - https://mghydro.com/watersheds/help.html (API sans clé, couverture
 *    mondiale, données MERIT-Hydro ~90m)
 *  - https://open-meteo.com/en/docs/elevation-api (API sans clé, CORS
 *    activé, MNT Copernicus GLO-90 ~90m, jusqu'à 100 points par requête)
 *
 * ⚠️ Comme documenté par mghydro.com lui-même : l'algorithme de
 * délimitation automatique est moins fiable pour les petits bassins
 * versants et pour les zones arides (l'Afrique du Nord y est citée
 * explicitement comme cas difficile, faute de réseau de talwegs bien
 * défini). TOUJOURS vérifier visuellement le résultat avant usage
 * professionnel — voir docs/delimitation-bassin-versant.md.
 * -----------------------------------------------------------------------
 */

export function buildWatershedUrl(lat, lon) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lon), precision: 'high' });
  return `https://mghydro.com/app/watershed_api?${params.toString()}`;
}

export function buildUpstreamRiversUrl(lat, lon) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lon), precision: 'high' });
  return `https://mghydro.com/app/upstream_rivers_api?${params.toString()}`;
}

export function buildElevationUrl(pointsLatLon) {
  const lats = pointsLatLon.map((p) => p[0]).join(',');
  const lons = pointsLatLon.map((p) => p[1]).join(',');
  return `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
}

/**
 * Analyse la réponse GeoJSON du watershed_api de mghydro.com.
 * Format documenté : FeatureCollection à 1 Feature Polygon, avec
 * properties.area_km2 (chaîne ou nombre).
 */
export function parseWatershedResponse(geojson) {
  const feature = geojson?.features?.[0];
  if (!feature || feature.geometry?.type !== 'Polygon') {
    throw new Error("Réponse de délimitation inattendue : pas de polygone dans le GeoJSON renvoyé.");
  }
  const ring = feature.geometry.coordinates[0]; // anneau extérieur, [lon,lat][]
  const surface_km2 = Number(feature.properties?.area_km2);
  if (!(surface_km2 > 0)) {
    throw new Error('La surface renvoyée par le service de délimitation est invalide.');
  }
  return {
    surface_km2,
    ring,
    outlet: feature.properties?.outlet_lat != null
      ? [feature.properties.outlet_lng, feature.properties.outlet_lat]
      : null,
  };
}

/**
 * Analyse la réponse GeoJSON du upstream_rivers_api de mghydro.com.
 * Format documenté : FeatureCollection de LineString.
 */
export function parseRiversResponse(geojson) {
  const features = geojson?.features || [];
  return features
    .filter((f) => f.geometry?.type === 'LineString')
    .map((f) => ({ coordinates: f.geometry.coordinates, sorder: f.properties?.sorder ?? null }));
}

/**
 * Analyse la réponse de l'API d'altimétrie Open-Meteo.
 * Format documenté : { "elevation": [z1, z2, ...] }, dans l'ordre des points fournis.
 */
export function parseElevationResponse(json) {
  const elevations = json?.elevation;
  if (!Array.isArray(elevations)) {
    throw new Error("Réponse d'altimétrie inattendue : le champ 'elevation' est absent ou invalide.");
  }
  return elevations.map(Number);
}

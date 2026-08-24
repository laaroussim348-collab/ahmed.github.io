/**
 * geoMath.js
 * -----------------------------------------------------------------------
 * Fonctions géométriques PURES (aucun appel réseau), utilisées pour
 * transformer les géométries renvoyées par les services de délimitation
 * (polygone du bassin, réseau hydrographique amont) en caractéristiques
 * numériques (surface, périmètre, longueur du thalweg).
 *
 * Toutes ces fonctions sont couvertes par tests/unit-geo-stats.test.js
 * avec des cas de référence calculables à la main.
 * -----------------------------------------------------------------------
 */

const RAYON_TERRE_M = 6371000; // rayon moyen de la Terre (m), approximation sphérique standard

/**
 * Distance orthodromique (grand cercle) entre 2 points WGS84, en mètres.
 * Formule de Haversine — précision suffisante (<0.5%) pour des distances
 * de quelques dizaines à quelques centaines de km, largement au-delà des
 * besoins d'un petit bassin versant.
 */
export function distanceHaversine(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RAYON_TERRE_M * c;
}

/**
 * Longueur cumulée d'une polyligne de points [lon, lat] (convention GeoJSON), en mètres.
 */
export function longueurPolyligne(coordsLonLat) {
  let total = 0;
  for (let i = 0; i < coordsLonLat.length - 1; i++) {
    const [lon1, lat1] = coordsLonLat[i];
    const [lon2, lat2] = coordsLonLat[i + 1];
    total += distanceHaversine(lat1, lon1, lat2, lon2);
  }
  return total;
}

/**
 * Périmètre d'un anneau de polygone GeoJSON (liste de [lon, lat], premier = dernier point).
 */
export function perimetrePolygone(ring) {
  return longueurPolyligne(ring);
}

/**
 * Surface approximative d'un polygone GeoJSON en km², par la formule de
 * l'aire sphérique de Girard (somme des excès angulaires), utile en
 * secours si l'API de délimitation ne fournit pas déjà l'aire (ce qui
 * est le cas pour mghydro.com : on utilise alors directement sa valeur
 * "area_km2", plus précise que cette approximation).
 * Non utilisée par défaut — fournie pour vérification croisée.
 */
export function airePolygoneApprox_km2(ring) {
  // Approximation planaire locale (projection équirectangulaire autour du centroïde) :
  // suffisante pour une vérification d'ordre de grandeur sur un petit bassin versant,
  // PAS pour un calcul de précision (préférer la valeur renvoyée par le service SIG).
  const latMoy = ring.reduce((s, [, lat]) => s + lat, 0) / ring.length;
  const mParDegLat = 111320;
  const mParDegLon = 111320 * Math.cos((latMoy * Math.PI) / 180);
  const pts = ring.map(([lon, lat]) => [lon * mParDegLon, lat * mParDegLat]);
  let aire2 = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    aire2 += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  }
  return Math.abs(aire2 / 2) / 1_000_000;
}

/**
 * Recherche du plus long chemin d'écoulement (thalweg principal) dans un
 * réseau hydrographique donné sous forme de tronçons (LineString GeoJSON).
 *
 * Méthode : les tronçons d'un réseau hydrographique forment un arbre
 * (aucun cycle, les affluents rejoignent le cours principal vers l'aval).
 * On construit un graphe non-orienté (nœuds = extrémités arrondies des
 * tronçons, arêtes = tronçons pondérés par leur longueur), puis on
 * cherche par parcours en largeur (BFS) le nœud le plus EXCENTRÉ depuis
 * l'exutoire — c'est la définition même du thalweg principal (plus long
 * chemin hydraulique depuis l'exutoire).
 *
 * @param {Array<{coordinates: [number,number][]}>} troncons  tronçons LineString (coords en [lon,lat])
 * @param {[number, number]} exutoireLonLat  point de sortie approximatif [lon, lat]
 * @param {number} [tolerance_m=60]  tolérance de rapprochement des nœuds (résolution MERIT-Hydro ~90m)
 */
export function plusLongCheminEcoulement(troncons, exutoireLonLat, tolerance_m = 60) {
  if (!troncons || troncons.length === 0) {
    return { longueur_m: null, chemin: [], avertissement: 'Aucun tronçon de réseau hydrographique fourni.' };
  }

  // 1. Construction des nœuds (avec fusion des points proches, en mètres via une grille locale)
  const noeuds = []; // { lon, lat }
  function idNoeud(lon, lat) {
    for (let i = 0; i < noeuds.length; i++) {
      if (distanceHaversine(lat, lon, noeuds[i].lat, noeuds[i].lon) <= tolerance_m) return i;
    }
    noeuds.push({ lon, lat });
    return noeuds.length - 1;
  }

  // 2. Construction des arêtes { a, b, longueur_m }
  const aretes = [];
  for (const t of troncons) {
    const coords = t.coordinates;
    if (!coords || coords.length < 2) continue;
    const a = idNoeud(coords[0][0], coords[0][1]);
    const b = idNoeud(coords[coords.length - 1][0], coords[coords.length - 1][1]);
    const longueur_m = longueurPolyligne(coords);
    aretes.push({ a, b, longueur_m });
  }

  if (aretes.length === 0) {
    return { longueur_m: null, chemin: [], avertissement: 'Tronçons fournis mais géométries vides.' };
  }

  // 3. Nœud de départ = nœud le plus proche de l'exutoire fourni
  let depart = 0;
  let dMin = Infinity;
  noeuds.forEach((n, i) => {
    const d = distanceHaversine(exutoireLonLat[1], exutoireLonLat[0], n.lat, n.lon);
    if (d < dMin) { dMin = d; depart = i; }
  });

  // 4. Liste d'adjacence
  const adjacence = new Map();
  aretes.forEach((ar, idx) => {
    if (!adjacence.has(ar.a)) adjacence.set(ar.a, []);
    if (!adjacence.has(ar.b)) adjacence.set(ar.b, []);
    adjacence.get(ar.a).push({ voisin: ar.b, longueur_m: ar.longueur_m, arete: idx });
    adjacence.get(ar.b).push({ voisin: ar.a, longueur_m: ar.longueur_m, arete: idx });
  });

  // 5. Parcours en largeur pondéré (Dijkstra simplifié, graphe = arbre donc BFS pondéré suffit)
  const distance = new Array(noeuds.length).fill(Infinity);
  const precedent = new Array(noeuds.length).fill(null);
  distance[depart] = 0;
  const aVisiter = [depart];
  const visite = new Set();
  while (aVisiter.length > 0) {
    // extraire le nœud non visité de plus petite distance (graphe petit : recherche linéaire suffit)
    aVisiter.sort((x, y) => distance[x] - distance[y]);
    const courant = aVisiter.shift();
    if (visite.has(courant)) continue;
    visite.add(courant);
    for (const { voisin, longueur_m } of adjacence.get(courant) || []) {
      const nouvelleDistance = distance[courant] + longueur_m;
      if (nouvelleDistance < distance[voisin]) {
        distance[voisin] = nouvelleDistance;
        precedent[voisin] = courant;
        aVisiter.push(voisin);
      }
    }
  }

  // 6. Le nœud le plus loin (parmi les atteignables) = extrémité du thalweg principal
  let plusLoin = depart;
  for (let i = 0; i < noeuds.length; i++) {
    if (distance[i] !== Infinity && distance[i] > distance[plusLoin]) plusLoin = i;
  }

  if (distance[plusLoin] === 0 || distance[plusLoin] === Infinity) {
    return { longueur_m: null, chemin: [], avertissement: "Impossible de relier les tronçons entre eux (réseau fragmenté)." };
  }

  // reconstruction du chemin
  const chemin = [];
  let c = plusLoin;
  while (c !== null) { chemin.unshift(noeuds[c]); c = precedent[c]; }

  return {
    longueur_m: distance[plusLoin],
    nombreTroncons: aretes.length,
    nombreNoeuds: noeuds.length,
    chemin,
    avertissement: null,
  };
}

/**
 * Corrige une séquence d'altitudes le long d'un thalweg (ordonnée de
 * l'aval/exutoire vers l'amont) pour qu'elle soit croissante ou stable —
 * l'eau ne remonte pas : toute altitude inférieure à la précédente ne peut
 * être qu'un artefact (bruit du MNT à 90m, léger décalage de calage du
 * point interrogé, remblai/pont, etc.). Corrige par report de la valeur
 * précédente (méthode standard de "lissage de profil en long").
 * @param {number[]} altitudes  ordonnées de l'aval vers l'amont
 * @returns {{altitudes: number[], corrections: {index:number, brut:number, corrige:number}[]}}
 */
export function corrigerProfilMonotone(altitudes) {
  const corrigees = [...altitudes];
  const corrections = [];
  for (let i = 1; i < corrigees.length; i++) {
    if (corrigees[i] < corrigees[i - 1]) {
      corrections.push({ index: i, brut: corrigees[i], corrige: corrigees[i - 1] });
      corrigees[i] = corrigees[i - 1];
    }
  }
  return { altitudes: corrigees, corrections };
}

/**
 * Choisit des points le long d'un chemin (liste ordonnée de {lon,lat}) à
 * des fractions données de la longueur totale (0 = premier point, 1 =
 * dernier point), par interpolation linéaire entre les 2 points encadrants.
 * Utilisé pour décider où interroger l'altitude le long du thalweg
 * principal (ex. fractions=[0, 0.33, 0.67, 1] -> 4 points -> 3 tronçons).
 * @param {{lon:number, lat:number}[]} chemin
 * @param {number[]} fractions  valeurs entre 0 et 1
 */
export function pointsSurChemin(chemin, fractions) {
  if (!chemin || chemin.length < 2) throw new Error('Le chemin doit contenir au moins 2 points.');
  const segLongueurs = [];
  let total = 0;
  for (let i = 0; i < chemin.length - 1; i++) {
    const d = distanceHaversine(chemin[i].lat, chemin[i].lon, chemin[i + 1].lat, chemin[i + 1].lon);
    segLongueurs.push(d);
    total += d;
  }
  return fractions.map((frac) => {
    const cible = frac * total;
    let cumul = 0;
    for (let i = 0; i < segLongueurs.length; i++) {
      if (cumul + segLongueurs[i] >= cible || i === segLongueurs.length - 1) {
        const restant = cible - cumul;
        const t = segLongueurs[i] > 0 ? Math.min(1, Math.max(0, restant / segLongueurs[i])) : 0;
        const p1 = chemin[i];
        const p2 = chemin[i + 1];
        return { lat: p1.lat + t * (p2.lat - p1.lat), lon: p1.lon + t * (p2.lon - p1.lon), distanceDepuisDepart_m: cumul + t * segLongueurs[i] };
      }
      cumul += segLongueurs[i];
    }
    return { lat: chemin[chemin.length - 1].lat, lon: chemin[chemin.length - 1].lon, distanceDepuisDepart_m: total };
  });
}

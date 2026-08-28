// ============================================================
//  DelimitationCarte.js — Carte interactive de délimitation de BV
//  ─────────────────────────────────────────────────────────────
//  Aperçu réduit (dans l'onglet) + bouton "agrandir" ouvrant une
//  carte plein écran : l'utilisateur navigue, clique pour choisir
//  l'exutoire, confirme → le contour du bassin versant et le
//  réseau hydrographique (mghydro.com) sont dessinés par-dessus
//  le fond de carte (façon ArcGIS), avec export en image PNG.
//
//  Fond de carte : imagerie satellite Esri World Imagery (par
//  défaut, CORS activé) + option "plan" CARTO Voyager (CORS
//  activé aussi) — les deux permettent l'export image (contrairement
//  aux tuiles OpenStreetMap standard, qui ne renvoient pas
//  d'en-têtes CORS et empêcheraient la lecture du canevas).
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useI18n } from './useI18n';
import { C_BLUE, C_TEAL, C_BORDER, C_RED, downloadChartCanvas } from './ui';

const FONDS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  },
  plan: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
  },
};

function iconePoint(couleur, taille = 16) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${taille}px;height:${taille}px;border-radius:50%;background:${couleur};border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.6)"></div>`,
    iconSize: [taille, taille],
    iconAnchor: [taille / 2, taille / 2],
  });
}

// maxZoom 19 (au lieu de 18) : gain de détail au dézoom max sur les deux fonds
// (Esri World Imagery et CARTO Voyager servent tous deux jusqu'à ce niveau) —
// demande utilisateur "je peux zoomer plus".
const ZOOM_MAX = 19;
function ajouterFond(map, id) {
  return L.tileLayer(FONDS[id].url, {
    attribution: FONDS[id].attribution,
    subdomains: FONDS[id].subdomains || 'abc',
    crossOrigin: true,
    maxZoom: ZOOM_MAX,
  }).addTo(map);
}

function creerCarte(container, { interactive }) {
  const map = L.map(container, {
    center: [31.792, -7.083], // centre approx. du Maroc, par défaut
    zoom: interactive ? 6 : 5,
    // minZoom bas : permet de dézoomer suffisamment pour délimiter/visualiser
    // aussi de grands bassins versants (demande utilisateur "accepter les
    // grands BV"), pas seulement les petits bassins routiers habituels.
    minZoom: interactive ? 2 : 3,
    maxZoom: ZOOM_MAX,
    zoomControl: false,
    dragging: interactive,
    scrollWheelZoom: interactive,
    doubleClickZoom: interactive,
    boxZoom: interactive,
    keyboard: interactive,
    touchZoom: interactive,
    attributionControl: interactive,
  });
  // Contrôle de zoom en bas à gauche : le coin haut-gauche est réservé au
  // panneau d'instructions (voir JSX), pour éviter le chevauchement.
  if (interactive) L.control.zoom({ position: 'bottomleft' }).addTo(map);
  ajouterFond(map, 'satellite');
  return { map };
}

function dessinerGeometrie(map, groupeRef, { contour, coursEau, exutoire, exutoireCandidat }) {
  if (groupeRef.current) { groupeRef.current.remove(); groupeRef.current = null; }
  const groupe = L.layerGroup();
  let bounds = null;

  if (contour?.length > 2) {
    const poly = L.polygon(contour, { color: '#ffb300', weight: 2.5, fillColor: '#ffb300', fillOpacity: 0.12 });
    groupe.addLayer(poly);
    bounds = poly.getBounds();
  }
  (coursEau || []).forEach((ligne) => {
    if (ligne?.length > 1) {
      const pl = L.polyline(ligne, { color: '#1565c0', weight: 2 });
      groupe.addLayer(pl);
      bounds = bounds ? bounds.extend(pl.getBounds()) : pl.getBounds();
    }
  });
  if (exutoire) {
    groupe.addLayer(L.marker(exutoire, { icon: iconePoint('#d32f2f', 14) }));
    bounds = bounds ? bounds.extend(L.latLng(exutoire)) : L.latLngBounds([exutoire, exutoire]);
  }
  if (exutoireCandidat) {
    groupe.addLayer(L.marker(exutoireCandidat, { icon: iconePoint('#ffffff', 18) }));
  }
  groupe.addTo(map);
  groupeRef.current = groupe;
  return bounds;
}

/** Palier "rond" (mètres) juste inférieur ou égal à la distance mesurée — même logique que L.control.scale. */
const PALIERS_ECHELLE_M = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
function palierEchelle(m) {
  const eligibles = PALIERS_ECHELLE_M.filter((p) => p <= m);
  return eligibles.length ? eligibles[eligibles.length - 1] : PALIERS_ECHELLE_M[0];
}

// ── Grille de coordonnées (graticule) ──────────────────────────
// Pas "rond" (degrés), même logique que palierEchelle mais visant ~5
// lignes sur l'étendue visible (fonctionne aussi bien à l'échelle d'un
// petit bassin versant qu'à celle d'un grand, cf. demande utilisateur).
const PALIERS_GRILLE_DEG = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
function pasGrille(etendueDeg) {
  const cible = etendueDeg / 5;
  const eligibles = PALIERS_GRILLE_DEG.filter((p) => p <= cible);
  return eligibles.length ? eligibles[eligibles.length - 1] : PALIERS_GRILLE_DEG[0];
}
function formatDegGrille(v, pas) {
  const dec = pas < 0.01 ? 3 : pas < 1 ? 2 : 0;
  return `${v.toFixed(dec)}°`;
}
function lignesGrille(bounds) {
  const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
  const pasLat = pasGrille(ne.lat - sw.lat) || PALIERS_GRILLE_DEG[0];
  const pasLon = pasGrille(ne.lng - sw.lng) || PALIERS_GRILLE_DEG[0];
  const lats = [];
  for (let l = Math.ceil(sw.lat / pasLat) * pasLat; l <= ne.lat + 1e-9; l += pasLat) lats.push(Math.round(l / pasLat) * pasLat);
  const lons = [];
  for (let l = Math.ceil(sw.lng / pasLon) * pasLon; l <= ne.lng + 1e-9; l += pasLon) lons.push(Math.round(l / pasLon) * pasLon);
  return { lats, lons, pasLat, pasLon };
}

/** Grille interactive (carte plein écran) : lignes + étiquettes de degrés, recalculées à chaque déplacement/zoom. */
function dessinerGrille(map, groupeRef) {
  if (groupeRef.current) { groupeRef.current.remove(); groupeRef.current = null; }
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
  const { lats, lons, pasLat, pasLon } = lignesGrille(bounds);
  const groupe = L.layerGroup();
  const styleLigne = { color: '#ffffff', weight: 1, opacity: 0.55, dashArray: '3,5', interactive: false };
  const styleLabel = 'background:rgba(0,0,0,.55);color:#fff;font-size:9.5px;line-height:14px;padding:0 4px;border-radius:2px;white-space:nowrap;font-family:Arial,sans-serif;';
  const icone = (texte, ancre) => L.divIcon({ className: '', html: `<span style="${styleLabel}">${texte}</span>`, iconSize: [0, 14], iconAnchor: ancre });
  lats.forEach((la) => {
    groupe.addLayer(L.polyline([[la, sw.lng], [la, ne.lng]], styleLigne));
    groupe.addLayer(L.marker([la, sw.lng], { icon: icone(formatDegGrille(la, pasLat), [-2, 7]), interactive: false }));
  });
  lons.forEach((lo) => {
    groupe.addLayer(L.polyline([[sw.lat, lo], [ne.lat, lo]], styleLigne));
    groupe.addLayer(L.marker([sw.lat, lo], { icon: icone(formatDegGrille(lo, pasLon), [-8, 14]), interactive: false }));
  });
  groupe.addTo(map);
  groupeRef.current = groupe;
}

/** Même grille, dessinée directement sur le canevas d'export (image PNG téléchargée / rapport). */
function dessinerGrilleCanvas(ctx, map, rect) {
  const bounds = map.getBounds();
  const { lats, lons, pasLat, pasLon } = lignesGrille(bounds);
  const ouest = bounds.getWest(), est = bounds.getEast(), sud = bounds.getSouth(), nord = bounds.getNorth();
  ctx.save();
  ctx.font = '10px Arial';
  lats.forEach((la) => {
    const p1 = map.latLngToContainerPoint([la, ouest]);
    const p2 = map.latLngToContainerPoint([la, est]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(0, p1.y); ctx.lineTo(rect.width, p2.y); ctx.stroke();
    ctx.setLineDash([]);
    const texte = formatDegGrille(la, pasLat);
    const w = ctx.measureText(texte).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(2, p1.y - 7, w + 6, 14);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(texte, 5, p1.y);
  });
  lons.forEach((lo) => {
    const p1 = map.latLngToContainerPoint([sud, lo]);
    const p2 = map.latLngToContainerPoint([nord, lo]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(p1.x, rect.height); ctx.lineTo(p2.x, 0); ctx.stroke();
    ctx.setLineDash([]);
    const texte = formatDegGrille(lo, pasLon);
    const w = ctx.measureText(texte).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(p1.x - w / 2 - 3, rect.height - 16, w + 6, 14);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texte, p1.x, rect.height - 9);
  });
  ctx.restore();
}

/**
 * Cartouche professionnelle dessinée par-dessus la carte exportée : titre
 * du projet, flèche du nord, échelle graphique, légende, coordonnées de
 * l'exutoire (point 12 de la demande — carte "pas juste une image").
 */
function dessinerCartouche(ctx, map, rect, { titre, exutoire, aContour }) {
  // ── Titre ──
  ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const texteTitre = titre || 'Délimitation du bassin versant';
  const largeurTitre = ctx.measureText(texteTitre).width;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(rect.width / 2 - largeurTitre / 2 - 10, 8, largeurTitre + 20, 26);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(texteTitre, rect.width / 2, 14);

  // ── Flèche du nord (haut-droite) ──
  const nx = rect.width - 40, ny = 55;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.beginPath(); ctx.arc(nx, ny, 24, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(nx, ny - 16); ctx.lineTo(nx - 6, ny + 6); ctx.lineTo(nx, ny + 1); ctx.lineTo(nx + 6, ny + 6);
  ctx.closePath();
  ctx.fillStyle = '#c0392b'; ctx.fill();
  ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('N', nx, ny - 18);
  ctx.restore();

  // ── Échelle graphique (bas-gauche) ──
  const yEchelle = rect.height - 20;
  const xDepart = 16, xRefPx = 100;
  let barrePx = 80, texteEchelle = '—';
  try {
    const p1 = map.containerPointToLatLng(L.point(xDepart, yEchelle));
    const p2 = map.containerPointToLatLng(L.point(xDepart + xRefPx, yEchelle));
    const metresRef = map.distance(p1, p2);
    if (metresRef > 0) {
      const metresJolis = palierEchelle(metresRef);
      barrePx = xRefPx * (metresJolis / metresRef);
      texteEchelle = metresJolis >= 1000 ? `${metresJolis / 1000} km` : `${metresJolis} m`;
    }
  } catch { /* map non disponible : échelle non tracée précisément */ }
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(xDepart - 6, yEchelle - 24, Math.max(barrePx, 90) + 20, 40);
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xDepart, yEchelle); ctx.lineTo(xDepart + barrePx, yEchelle);
  ctx.moveTo(xDepart, yEchelle - 4); ctx.lineTo(xDepart, yEchelle + 4);
  ctx.moveTo(xDepart + barrePx, yEchelle - 4); ctx.lineTo(xDepart + barrePx, yEchelle + 4);
  ctx.stroke();
  ctx.fillStyle = '#1a1a1a'; ctx.font = '10px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(texteEchelle, xDepart, yEchelle - 6);

  // ── Légende (haut-gauche, sous le panneau d'instructions si présent) ──
  const legendeItems = [
    ...(aContour ? [['#ffb300', 'polygone', 'Limite du bassin versant']] : []),
    ...(aContour ? [['#1565c0', 'ligne', 'Cours d\'eau (oueds)']] : []),
    ...(exutoire ? [['#d32f2f', 'point', 'Exutoire']] : []),
  ];
  if (legendeItems.length) {
    const lx = rect.width - 210, ly = rect.height - 20 - legendeItems.length * 18 - 14;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(lx - 10, ly - 8, 200, legendeItems.length * 18 + 16);
    legendeItems.forEach(([couleur, forme, texte], i) => {
      const iy = ly + i * 18;
      if (forme === 'point') {
        ctx.beginPath(); ctx.arc(lx + 6, iy + 5, 5, 0, 2 * Math.PI);
        ctx.fillStyle = couleur; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (forme === 'ligne') {
        ctx.strokeStyle = couleur; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(lx, iy + 5); ctx.lineTo(lx + 14, iy + 5); ctx.stroke();
      } else {
        ctx.fillStyle = couleur; ctx.globalAlpha = 0.35; ctx.fillRect(lx, iy, 14, 10); ctx.globalAlpha = 1;
        ctx.strokeStyle = couleur; ctx.lineWidth = 1.5; ctx.strokeRect(lx, iy, 14, 10);
      }
      ctx.fillStyle = '#1a1a1a'; ctx.font = '10.5px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(texte, lx + 22, iy + 5);
    });
  }

  // ── Coordonnées de l'exutoire ──
  if (exutoire) {
    const [elat, elon] = exutoire;
    const texteCoord = `Exutoire : ${elat.toFixed(5)}°, ${elon.toFixed(5)}°`;
    ctx.font = '10.5px Arial'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    const w = ctx.measureText(texteCoord).width;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(rect.width - w - 22, rect.height - 20, w + 12, 18);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(texteCoord, rect.width - 16, rect.height - 6);
  }
}

/**
 * Composite tuiles + contour + réseau hydro + marqueur en une image PNG,
 * sans dépendre d'une bibliothèque externe. Fonctionne uniquement si les
 * tuiles ont été chargées en CORS (cf. FONDS ci-dessus) — sinon le
 * canevas est "taché" et toDataURL() lève une exception, interceptée
 * plus bas avec un message explicite.
 */
function exporterCarteEnImage(map, container, { contour, coursEau, exutoire, titre, grille }) {
  const rect = container.getBoundingClientRect();
  // Résolution d'export : au moins 2x (indépendamment du devicePixelRatio de
  // l'écran), pour une image nette à l'impression/dans le rapport Word — pas
  // seulement à l'affichage écran (demande utilisateur "augmenter la
  // résolution de qualité de mise en page").
  const ratio = Math.max(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(ratio, ratio);

  const tuiles = container.querySelectorAll('.leaflet-tile-pane img.leaflet-tile-loaded');
  tuiles.forEach((img) => {
    const r = img.getBoundingClientRect();
    try { ctx.drawImage(img, r.left - rect.left, r.top - rect.top, r.width, r.height); } catch { /* tuile isolée illisible : ignorée */ }
  });

  const versPoint = (latlng) => map.latLngToContainerPoint(latlng);

  if (contour?.length > 2) {
    ctx.beginPath();
    contour.forEach((p, i) => { const c = versPoint(p); if (i === 0) ctx.moveTo(c.x, c.y); else ctx.lineTo(c.x, c.y); });
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,179,0,0.15)'; ctx.fill();
    ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 2.5; ctx.stroke();
  }
  (coursEau || []).forEach((ligne) => {
    if (!(ligne?.length > 1)) return;
    ctx.beginPath();
    ligne.forEach((p, i) => { const c = versPoint(p); if (i === 0) ctx.moveTo(c.x, c.y); else ctx.lineTo(c.x, c.y); });
    ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 2; ctx.stroke();
  });
  if (exutoire) {
    const c = versPoint(exutoire);
    ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#d32f2f'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }

  if (grille) dessinerGrilleCanvas(ctx, map, rect);
  dessinerCartouche(ctx, map, rect, { titre, exutoire, aContour: contour?.length > 2 });
  return canvas;
}

export default function DelimitationCarte({ lat, lon, geometrie, loading, onConfirmer, nomProjet, onImageExportee }) {
  const { t } = useI18n();
  const previewDivRef = useRef(null);
  const previewMapObjRef = useRef(null);
  const previewGroupeRef = useRef(null);

  const fullDivRef = useRef(null);
  const fullMapObjRef = useRef(null);
  const fullGroupeRef = useRef(null);
  const grilleGroupeRef = useRef(null);

  const [plein, setPlein] = useState(false);
  const [candidat, setCandidat] = useState(null); // {lat, lon} choisi par clic, en attente de confirmation
  const [fondActif, setFondActif] = useState('satellite');
  const [exportMsg, setExportMsg] = useState(null);
  const [confirmErreur, setConfirmErreur] = useState(null);
  const [grilleActive, setGrilleActive] = useState(true);

  const point = lat !== '' && lon !== '' && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lon))
    ? [parseFloat(lat), parseFloat(lon)] : null;

  // ── Carte miniature (aperçu, non interactive) ──
  useEffect(() => {
    if (!previewDivRef.current || previewMapObjRef.current) return;
    const { map } = creerCarte(previewDivRef.current, { interactive: false });
    previewMapObjRef.current = map;
    return () => { map.remove(); previewMapObjRef.current = null; };
  }, []);

  useEffect(() => {
    const map = previewMapObjRef.current;
    if (!map) return;
    const bounds = dessinerGeometrie(map, previewGroupeRef, {
      contour: geometrie?.contour, coursEau: geometrie?.coursEau, exutoire: point,
    });
    if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [10, 10] });
    else if (point) map.setView(point, 11);
  }, [geometrie, lat, lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carte plein écran (montée seulement quand ouverte) ──
  useEffect(() => {
    if (!plein) return undefined;
    const div = fullDivRef.current;
    if (!div) return undefined;
    const { map } = creerCarte(div, { interactive: true });
    fullMapObjRef.current = map;
    setCandidat(null);
    setConfirmErreur(null);
    setExportMsg(null);

    const bounds = dessinerGeometrie(map, fullGroupeRef, {
      contour: geometrie?.contour, coursEau: geometrie?.coursEau, exutoire: point,
    });
    if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
    else if (point) map.setView(point, 12);

    map.on('click', (e) => setCandidat({ lat: e.latlng.lat, lon: e.latlng.lng }));

    setTimeout(() => map.invalidateSize(), 50);
    return () => {
      map.remove(); fullMapObjRef.current = null; fullGroupeRef.current = null;
    };
  }, [plein]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grille de coordonnées (carte plein écran uniquement) : recalculée à
  // chaque déplacement/zoom, activable/désactivable sans reconstruire la carte.
  useEffect(() => {
    const map = fullMapObjRef.current;
    if (!map || !plein) return undefined;
    if (!grilleActive) {
      if (grilleGroupeRef.current) { grilleGroupeRef.current.remove(); grilleGroupeRef.current = null; }
      return undefined;
    }
    const redessiner = () => dessinerGrille(map, grilleGroupeRef);
    redessiner();
    map.on('moveend zoomend', redessiner);
    return () => {
      map.off('moveend zoomend', redessiner);
      if (grilleGroupeRef.current) { grilleGroupeRef.current.remove(); grilleGroupeRef.current = null; }
    };
  }, [plein, grilleActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redessine le marqueur candidat sans reconstruire toute la carte
  useEffect(() => {
    const map = fullMapObjRef.current;
    if (!map || !plein) return;
    dessinerGeometrie(map, fullGroupeRef, {
      contour: geometrie?.contour, coursEau: geometrie?.coursEau, exutoire: point, exutoireCandidat: candidat ? [candidat.lat, candidat.lon] : null,
    });
  }, [candidat]); // eslint-disable-line react-hooks/exhaustive-deps

  function basculerFond() {
    const map = fullMapObjRef.current;
    if (!map) return;
    const suivant = fondActif === 'satellite' ? 'plan' : 'satellite';
    map.eachLayer((l) => { if (l instanceof L.TileLayer) map.removeLayer(l); });
    ajouterFond(map, suivant);
    setFondActif(suivant);
  }

  const confirmer = useCallback(async () => {
    if (!candidat || !onConfirmer) return;
    setConfirmErreur(null);
    try {
      await onConfirmer(candidat.lat, candidat.lon);
      setCandidat(null);
    } catch (e) {
      setConfirmErreur(e.message || String(e));
    }
  }, [candidat, onConfirmer]);

  const titreCarte = nomProjet
    ? `${t('carteTitreDelimitationDe')} ${nomProjet}`
    : t('carteTitreDelimitationGenerique');

  function telechargerImage() {
    const map = fullMapObjRef.current;
    const div = fullDivRef.current;
    if (!map || !div) return;
    try {
      const canvas = exporterCarteEnImage(map, div, { contour: geometrie?.contour, coursEau: geometrie?.coursEau, exutoire: point, titre: titreCarte, grille: grilleActive });
      downloadChartCanvas(canvas, `delimitation-bassin-versant${nomProjet ? '-'+nomProjet.replace(/\s+/g,'_') : ''}.png`, (msg) => setExportMsg(msg));
      // Conserve aussi l'image pour le rapport Word (section "Cartes", point 14) —
      // sans action supplémentaire de l'utilisateur au-delà de ce téléchargement.
      onImageExportee?.(canvas.toDataURL('image/png'));
    } catch (e) {
      setExportMsg(t('carteExportErreur'));
    }
  }

  return (
    <div>
      <div style={{ position: 'relative', height: 150, border: `1px solid ${C_BORDER}`, marginTop: 6, marginBottom: 4, background: '#eee' }}>
        <div ref={previewDivRef} style={{ width: '100%', height: '100%' }} />
        <button onClick={() => setPlein(true)}
          title={t('carteAgrandir')}
          style={{ position: 'absolute', top: 6, right: 6, zIndex: 500, background: '#fff', border: `1px solid ${C_BORDER}`,
            borderRadius: 3, padding: '4px 9px', fontSize: 16, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}>
          🔍
        </button>
      </div>
      <p style={{ fontSize: 10, color: '#888', margin: '0 0 6px' }}>{t('carteApercuHint')}</p>

      {plein && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#000' }}>
          <div ref={fullDivRef} style={{ width: '100%', height: '100%' }} />

          <div style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 500, display: 'flex',
            justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(255,255,255,.95)', border: `1px solid ${C_BORDER}`, borderRadius: 3,
              padding: '8px 12px', fontSize: 12, maxWidth: 420, pointerEvents: 'auto', lineHeight: 1.6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>{titreCarte}</div>
              <b style={{ color: C_BLUE }}>{t('carteTitrePlein')}</b>
              <div style={{ color: '#555', marginTop: 3 }}>{t('carteInstructions')}</div>
              {candidat && <div style={{ marginTop: 4 }}>{t('carteExutoireChoisi')} <b>{candidat.lat.toFixed(5)}, {candidat.lon.toFixed(5)}</b></div>}
              {confirmErreur && <div style={{ marginTop: 4, color: C_RED }}>⚠️ {confirmErreur}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, pointerEvents: 'auto' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={basculerFond} style={{ padding: '6px 10px', fontSize: 12, background: '#fff', border: `1px solid ${C_BORDER}`, borderRadius: 3, cursor: 'pointer' }}>
                  {fondActif === 'satellite' ? t('cartePlanBtn') : t('carteSatelliteBtn')}
                </button>
                <button onClick={() => setGrilleActive(g => !g)}
                  title={t('carteGrilleHint')}
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 3, cursor: 'pointer',
                    background: grilleActive ? C_TEAL : '#fff', color: grilleActive ? '#fff' : '#1a1a1a',
                    border: `1px solid ${grilleActive ? C_TEAL : C_BORDER}` }}>
                  # {t('carteGrilleBtn')}
                </button>
                <button onClick={() => setPlein(false)} style={{ padding: '6px 12px', fontSize: 14, background: '#fff', border: `1px solid ${C_BORDER}`, borderRadius: 3, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 500,
            display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={confirmer} disabled={!candidat || loading}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, color: '#fff',
                background: (!candidat || loading) ? '#999' : C_TEAL, border: 'none', borderRadius: 3,
                cursor: (!candidat || loading) ? 'not-allowed' : 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,.4)' }}>
              {loading ? t('gxChargement') : t('carteConfirmerBtn')}
            </button>
            {geometrie?.contour?.length > 0 && (
              <button onClick={telechargerImage}
                style={{ padding: '8px 16px', fontSize: 13, color: C_BLUE, background: '#fff', border: `1px solid ${C_BLUE}`,
                  borderRadius: 3, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,.4)' }}>
                {t('carteTelechargerBtn')}
              </button>
            )}
            {exportMsg && <span style={{ background: 'rgba(255,255,255,.95)', padding: '4px 10px', fontSize: 11, borderRadius: 3 }}>{exportMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

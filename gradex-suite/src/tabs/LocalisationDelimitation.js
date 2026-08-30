// ============================================================
//  LocalisationDelimitation.js — "Localisation & calcul automatique"
//  ─────────────────────────────────────────────────────────────
//  Extrait de MethodesTab.js (retour utilisateur du 29/08/2026 : "mets la
//  délimitation en haut, avec une carte visible professionnellement") pour
//  être rendu tout en haut de l'onglet fusionné "Données & Méthodes"
//  (App.js), avant même les paramètres GRADEX — la délimitation est le
//  point de départ naturel d'un nouveau projet (elle alimente
//  automatiquement surface/périmètre/altitudes/pente pour BV-Calc, ET la
//  série Pjmax pour GRADEX). Logique de calcul INCHANGÉE, seul
//  l'emplacement dans l'arborescence des composants a changé.
// ============================================================
import { useState, useCallback } from 'react';
import { useI18n } from '../useI18n';
import { Panel, Field, Alert, C_BLUE, C_BORDER } from '../ui';
import DelimitationCarte from '../DelimitationCarte.js';

function fmt(v, d = 3) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function LocalisationDelimitation({ v, setV, onImportToGradex, onCarteImage, nomProjet, showToast }) {
  const { t } = useI18n();
  const patch = useCallback(p => setV(prev => ({ ...prev, ...p })), [setV]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState(null); // { html, tone }
  const [geoGeometrie, setGeoGeometrie] = useState(null); // { contour, coursEau } — pour la carte

  // lat/lon explicites (ex. clic sur la carte) prioritaires sur v.geoLat/v.geoLon.
  async function calculerGeo(latArg, lonArg) {
    const lat = latArg ?? parseFloat(v.geoLat);
    const lon = lonArg ?? parseFloat(v.geoLon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) { setGeoMsg({ tone:'error', html:t('geoErreurCoords') }); throw new Error(t('geoErreurCoords')); }
    patch({ geoLat: String(lat), geoLon: String(lon) });
    setGeoLoading(true);
    setGeoMsg({ tone:'info', html:t('geoEnCours') });
    const avertissements = [];
    let ok = false, okDelineation = false, html = '', erreurDelineation = null;
    try {
      const rep = await fetch(`/api/delineation?lat=${lat}&lon=${lon}`);
      const data = await rep.json();
      if (!data.ok) throw new Error(data.erreur || t('fixEchecDelimitation'));
      const patchGeo = { surface_km2: data.surface_km2 };
      if (data.perimetre_km != null) patchGeo.perimetre_km = data.perimetre_km.toFixed(4);
      if (data.longueur_km) patchGeo.longueur_km = data.longueur_km.toFixed(4);
      if (data.altitude_min_m != null) patchGeo.altitude_min_m = data.altitude_min_m;
      if (data.altitude_max_m != null) patchGeo.altitude_max_m = data.altitude_max_m;
      if (data.troncons?.length) {
        patchGeo.troncons = data.troncons.map(tr => ({ longueur_m: Math.round(tr.longueur_m * 10) / 10, altAmont: tr.altitude_amont_m, altAval: tr.altitude_aval_m }));
      }
      patch(patchGeo);
      if (data.contour_latlon?.length) {
        setGeoGeometrie({ contour: data.contour_latlon, coursEau: data.coursEau_latlon || [] });
      }
      html += `✅ ${t('fixSurfacePerimetre')} ${fmt(data.surface_km2, 2)} ${t('fixPerimetreApprox')} ${fmt(data.perimetre_km, 2)} ${t('fixKm')}` +
        (data.longueur_km ? `${t('fixThalwegApprox')} ${fmt(data.longueur_km, 2)} ${t('fixKm')}` : '') + '.';
      avertissements.push(...(data.avertissements || []));
      ok = true; okDelineation = true;
      // Synchronise automatiquement la surface avec l'onglet GRADEX (Données) —
      // la surface extraite par la délimitation ne doit pas être ressaisie
      // manuellement. On utilise data.surface_km2 directement (pas v.surface_km2,
      // qui n'est pas encore à jour : patch() ci-dessus est asynchrone).
      // lat/lon transmis aussi : permet à App.js de lancer automatiquement le
      // téléchargement de la série Pjmax (Open-Meteo ERA5) pour ce même point,
      // sans clic manuel séparé sur "Importer depuis Open-Meteo ERA5".
      onImportToGradex?.({ surface: data.surface_km2, lat, lon });
    } catch (e) { erreurDelineation = e.message; html += `❌ ${t('erreur')} ${e.message}`; }

    try {
      const rep = await fetch(`/api/pluviometrie?lat=${lat}&lon=${lon}`);
      const data = await rep.json();
      if (!data.ok) throw new Error(data.erreur || t('fixEchecPluviometrie'));
      const T = v.T || 100;
      if (data.pjmax) {
        const pjmaxT = data.pjmax.pjmax[T] ?? data.pjmax.pjmax[100];
        patch({ pjmax_saisie: pjmaxT.toFixed(2), h24Source: 'weiss' });
        html += `<br>✅ ${t('fixPjmaxApprox')}${T}${t('fixAnsApprox')} ${fmt(pjmaxT, 1)} ${t('fixMmApprox')}${data.pjmax.anneesDisponibles} ${t('fixAnsDisponibles')} ${data.pjmax.premiereAnnee}-${data.pjmax.derniereAnnee}).`;
      }
      if (data.montana) {
        const mT = data.montana.montana[T] ?? data.montana.montana[100];
        patch({ a: mT.a.toFixed(3), b: mT.b.toFixed(4), h1h_mm: mT.a.toFixed(2) });
        html += `<br>✅ ${t('fixMontanaEstime')}${fmt(mT.a, 2)}${t('fixBApprox')}${fmt(mT.b, 3)}${t('fixR2Approx')}${fmt(mT.r2, 2)}). ${t('fixH1hDeduit')}${fmt(mT.a, 2)}${t('fixMmDeduitAuto')}`;
      }
      if (data.pma) {
        patch({ pma_mm_an: data.pma.pma_mm_an.toFixed(1) });
        html += `<br>✅ ${t('fixPmaApprox')} ${fmt(data.pma.pma_mm_an, 1)} ${t('fixMmAnMoyenne')} ${data.pma.anneesUtilisees} ${t('fixAnsAlimente')}`;
      }
      avertissements.push(...(data.avertissements || []));
      ok = true;
    } catch (e) { html += `<br>❌ ${t('erreur')} ${e.message}`; }

    html += ok ? `<br><strong>${t('geoVerifiez')}</strong>` : `<br>${t('geoManuel')}`;
    if (avertissements.length) html += '<br>' + avertissements.map(a => `⚠️ ${a}`).join('<br>');
    setGeoMsg({ tone: ok ? 'ok' : 'error', html });
    setGeoLoading(false);
    // Message précis (raison réelle du serveur) propagé jusqu'à la carte
    // plein écran (DelimitationCarte.confirmErreur), pas seulement affiché
    // ici dans le panneau réduit — sinon l'utilisateur qui clique
    // directement sur la carte plein écran ne voit qu'un message générique
    // sans savoir pourquoi ça a échoué.
    if (!okDelineation) throw new Error(erreurDelineation || t('fixEchecDelimitation'));
  }

  function importerVersGradex() {
    if (!v.surface_km2 && !v.tc_h) return;
    onImportToGradex({ surface: v.surface_km2, tc: v.tc_h });
    showToast?.(t('mcGeoImporterFait'));
  }

  return (
    <Panel title={t('geoTitre')} icon="map-2" accent={C_BLUE}>
      <p style={{ fontSize:11, color:'#555', lineHeight:1.7, marginBottom:8 }}>{t('geoHint')}</p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, alignItems:'end' }}>
        <Field label={t('geoLat')} value={v.geoLat} onChange={x => patch({ geoLat:x })} type="number" placeholder="33.9716" />
        <Field label={t('geoLon')} value={v.geoLon} onChange={x => patch({ geoLon:x })} type="number" placeholder="-6.8498" />
        <button onClick={() => calculerGeo().catch(() => {})} disabled={geoLoading}
          style={{ height:24, padding:'0 12px', background:geoLoading?'#aaa':C_BLUE, color:'#fff', border:'none',
            fontSize:11, cursor:geoLoading?'not-allowed':'pointer', marginBottom:6 }}>
          {geoLoading ? t('gxChargement') : t('geoCalcBtn')}
        </button>
      </div>
      {geoMsg && <Alert tone={geoMsg.tone === 'ok' ? 'ok' : geoMsg.tone === 'error' ? 'error' : 'info'}>
        <span dangerouslySetInnerHTML={{ __html: geoMsg.html }} />
      </Alert>}
      <button onClick={importerVersGradex} disabled={!v.surface_km2 && !v.tc_h}
        style={{ marginTop:4, padding:'4px 10px', fontSize:11, background:'#fff', border:`1px solid ${C_BORDER}`,
          cursor: (!v.surface_km2 && !v.tc_h) ? 'not-allowed' : 'pointer', opacity: (!v.surface_km2 && !v.tc_h) ? 0.5 : 1 }}>
        {t('mcGeoImporterVersGradex')}
      </button>

      <DelimitationCarte lat={v.geoLat} lon={v.geoLon} geometrie={geoGeometrie} loading={geoLoading} onConfirmer={calculerGeo} nomProjet={nomProjet} onImageExportee={onCarteImage} />
    </Panel>
  );
}

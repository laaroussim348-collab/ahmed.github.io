// ============================================================
//  MethodesTab.js — Onglet "Méthodes complémentaires"
//  ─────────────────────────────────────────────────────────────
//  Porte l'intégralité du moteur BV-Calc (Guide technique
//  d'assainissement routier 2020) dans l'habillage GRADEX : mêmes
//  fonctions de calcul (src/calculations/*, copiées à l'identique,
//  AUCUNE formule modifiée), même logique de dépendances/
//  adaptateurs par méthode que public/js/app.js — seule la couche
//  d'affichage change (composants Panel/Field/CollapseSection de
//  ui.js au lieu du HTML/CSS "ledger" de BV-Calc), pour que cet
//  onglet ressemble au reste de GRADEX.
//
//  7 méthodes de débit de pointe : Rationnelle, Mac-Math,
//  Burkli-Ziegler, TR-55 (SCS), Mallet-Gautier, Fuller II,
//  Hazan-Lazarevich — + délimitation automatique du bassin
//  (mghydro.com) et estimation pluviométrique (NASA POWER),
//  Curve Number et coefficient de ruissellement Cr.
// ============================================================
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  METHODES, getMethode, watershed, concentrationTime, rainfall, runoff, units,
} from '../calculations/index.js';
import { OCCUPATIONS_SOL } from '../data/coefficientsRuissellement.js';
import { getCN, ajusterCN, CN_I_COEF_OPTIONS } from '../calculations/curveNumber.js';
import { TABLE_CN } from '../data/coefficientsCN.js';
import { useI18n } from '../useI18n';
import {
  Panel, Field, Select, CollapseSection, Alert, TH, TD, C_BORDER, C_TEAL, C_BLUE, C_RED, C_STRIP,
} from '../ui';
import DelimitationCarte from '../DelimitationCarte.js';

function fmt(v, d = 3) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
const estRempli = v => v !== undefined && v !== null && v !== '' && !Number.isNaN(v);

// Libellés lisibles des champs de DEPENDANCES (clés d'état v.xxx), affichés à
// l'utilisateur quand une méthode est indisponible faute de données — plutôt
// que le nom technique brut ("h1h_mm", "malletGautier_K"...).
const LABELS_CHAMPS = {
  surface_km2: 'Surface (A)', h24_mm: 'Pluie 24h (H24h)', h1h_mm: 'Pluie 1h (H1h)',
  pente_m_par_m: 'Pente moyenne (P)', cr: 'Coefficient de ruissellement (Cr)', CN: 'Curve Number (CN)',
  tc_h: 'Temps de concentration (tc)', T: 'Période de retour (T)', a: 'Coefficient de Montana (a)', b: 'Coefficient de Montana (b)',
  macMath_K: 'Coefficient topographique K (Mac-Math)',
  malletGautier_K: 'Coefficient K (Mallet-Gautier)', malletGautier_a: 'Coefficient a (Mallet-Gautier)',
  fullerII_a: 'Coefficient a (Fuller II)', fullerII_N: 'Coefficient N (Fuller II)',
  hazanLazarevich_a: 'Coefficient a (Hazan-Lazarevich)',
  pma_mm_an: 'Pluie moyenne annuelle (Pma)', longueur_km: 'Longueur du thalweg (L)',
  fr_surfaceRef: 'Surface de la station de référence (S_ref)', fr_qRef: 'Débit de référence (Q_ref)',
};
function libelleChamp(cle) { return LABELS_CHAMPS[cle] || cle; }

const DEPENDANCES = {
  rationnelle: ['surface_km2', 'cr', 'a', 'b', 'tc_h', 'T'],
  macMath: ['surface_km2', 'h24_mm', 'pente_m_par_m', 'macMath_K'],
  burkliZiegler: ['surface_km2', 'h1h_mm', 'pente_m_par_m', 'cr'],
  tr55: ['surface_km2', 'CN', 'h24_mm', 'tc_h'],
  malletGautier: ['malletGautier_K', 'malletGautier_a', 'pma_mm_an', 'surface_km2', 'T', 'longueur_km'],
  fullerII: ['fullerII_a', 'T', 'surface_km2', 'fullerII_N'],
  hazanLazarevich: ['pma_mm_an', 'surface_km2', 'hazanLazarevich_a', 'T'],
  francouRodier: ['surface_km2', 'fr_surfaceRef', 'fr_qRef', 'T'],
};
const ADAPTATEURS = {
  rationnelle: v => ({ surface_km2: v.surface_km2, cr: v.cr, a: v.a, b: v.b, tc_h: v.tc_h, T: v.T }),
  macMath: v => ({ surface_km2: v.surface_km2, h24_mm: v.h24_mm, pente_m_par_m: v.pente_m_par_m, K: v.macMath_K, conventionUnites: v.macMath_convention || 'excel' }),
  burkliZiegler: v => ({ surface_km2: v.surface_km2, h1h_mm: v.h1h_mm, pente_m_par_m: v.pente_m_par_m, cr: v.cr }),
  francouRodier: v => ({ surface_km2: v.surface_km2, surface_ref_km2: v.fr_surfaceRef, q_ref_m3s: v.fr_qRef, T: v.T }),
  tr55: v => ({ surface_km2: v.surface_km2, CN: v.CN, p24_mm: v.h24_mm, tc_h: v.tc_h }),
  malletGautier: v => ({ K: v.malletGautier_K, a: v.malletGautier_a, pma_m_an: v.pma_mm_an != null ? v.pma_mm_an / 1000 : undefined, surface_km2: v.surface_km2, T: v.T, longueur_km: v.longueur_km }),
  fullerII: v => ({ a: v.fullerII_a, T: v.T, surface_km2: v.surface_km2, N: v.fullerII_N }),
  hazanLazarevich: v => ({ pma_mm_an: v.pma_mm_an, surface_km2: v.surface_km2, a: v.hazanLazarevich_a, T: v.T }),
};

export const MC_ETAT_INITIAL = {
  surface_km2: '', perimetre_km: '', longueur_km: '', altitude_min_m: '', altitude_max_m: '', altitudeMoyenne_m: '',
  T: 100, a: '', b: '', h1h_mm: '', cr: '', CN: '',
  macMath_K: '', macMath_convention: 'excel', pma_mm_an: '',
  malletGautier_K: 2, malletGautier_a: 20, fullerII_a: 2, fullerII_N: '', hazanLazarevich_a: 1,
  fr_surfaceRef: '', fr_qRef: '',
  tc_h: '', h24_mm: '', pjmax_saisie: '', weiss_k: 1.15, montana_b_suppose: 0.55,
  tcFormuleId: 'kirpich', tcPenteSource: 'globale',
  crCode: '1', crGroupe: 'moyens', crPente: '<=5%',
  cnCategorie: '', cnCondition: '', cnGroupeSol: 'B', cnAmc: 'II', cnCoefAmcI: '0.058',
  troncons: [{ longueur_m: '', altAmont: '', altAval: '' }],
  hypsoTranches: [{ altitude_bas: '', altitude_haut: '', surface_km2: '' }],
  methodesSelectionnees: [],
  geoLat: '', geoLon: '',
};

export default function MethodesTab({ v, setV, showToast, onImportToGradex, onResultatsChange, surfaceGradex }) {
  const { t } = useI18n();
  const patch = useCallback(p => setV(prev => ({ ...prev, ...p })), [setV]);

  // Sens inverse de importerVersGradex() : si l'utilisateur a déjà saisi la
  // surface dans l'onglet GRADEX (Données) AVANT d'ouvrir Méthodes
  // complémentaires, on la reprend automatiquement — pas de ressaisie.
  // Ne s'applique que tant que v.surface_km2 est vide (jamais d'écrasement
  // d'une valeur déjà saisie/calculée ici, ex. par la délimitation auto).
  useEffect(() => {
    if (surfaceGradex && !v.surface_km2) patch({ surface_km2: surfaceGradex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceGradex]);

  const [showGeo, setShowGeo] = useState(false);
  const [showHypso, setShowHypso] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState(null); // { html, tone }
  const [geoGeometrie, setGeoGeometrie] = useState(null); // { contour, coursEau } — pour la carte
  const [tcResult, setTcResult] = useState(null);
  const [crResult, setCrResult] = useState(null);
  const [cnResult, setCnResult] = useState(null);
  const [montanaEstResult, setMontanaEstResult] = useState(null);
  const [resultats, setResultats] = useState([]);
  const [detailIdx, setDetailIdx] = useState(null);
  const [copieMsg, setCopieMsg] = useState('');

  // ── Pente pondérée / globale ──────────────────────────────
  const penteGlobale = useMemo(() => {
    const { altitude_max_m: max, altitude_min_m: min, longueur_km: L } = v;
    if (!estRempli(max) || !estRempli(min) || !estRempli(L)) return null;
    try { return watershed.penteGlobale(parseFloat(max), parseFloat(min), units.kmToM(parseFloat(L))); }
    catch (e) { return { erreur: e.message }; }
  }, [v.altitude_max_m, v.altitude_min_m, v.longueur_km]);

  const pentePonderee = useMemo(() => {
    const valides = v.troncons.filter(tr => tr.longueur_m !== '' && tr.altAmont !== '' && tr.altAval !== '');
    if (!valides.length) return null;
    const altitudes = [parseFloat(valides[0].altAmont), ...valides.map(tr => parseFloat(tr.altAval))];
    const longueurs = valides.map(tr => parseFloat(tr.longueur_m));
    try { return watershed.penteMoyennePonderee(altitudes, longueurs); }
    catch (e) { return { erreur: e.message }; }
  }, [v.troncons]);

  function setTroncon(i, cle, val) {
    const t2 = v.troncons.slice();
    t2[i] = { ...t2[i], [cle]: val };
    patch({ troncons: t2 });
  }
  function ajouterTroncon() { patch({ troncons: [...v.troncons, { longueur_m: '', altAmont: '', altAval: '' }] }); }
  function supprimerTroncon(i) { patch({ troncons: v.troncons.filter((_, idx) => idx !== i) }); }

  // ── Indice de compacité / forme / rectangle équivalent (auto, aucune saisie) ──
  const compacite = useMemo(() => {
    const A = parseFloat(v.surface_km2), P = parseFloat(v.perimetre_km), L = parseFloat(v.longueur_km);
    if (!estRempli(v.surface_km2) || !estRempli(v.perimetre_km)) return null;
    try { return watershed.indiceCompacite(A, P, L || undefined); }
    catch (e) { return { erreur: e.message }; }
  }, [v.surface_km2, v.perimetre_km, v.longueur_km]);

  // ── Courbe hypsométrique → altitude moyenne pondérée ──────
  const [hypsoResult, setHypsoResult] = useState(null);
  function setHypso(i, cle, val) {
    const t2 = v.hypsoTranches.slice();
    t2[i] = { ...t2[i], [cle]: val };
    patch({ hypsoTranches: t2 });
  }
  function ajouterHypso() { patch({ hypsoTranches: [...v.hypsoTranches, { altitude_bas: '', altitude_haut: '', surface_km2: '' }] }); }
  function supprimerHypso(i) { patch({ hypsoTranches: v.hypsoTranches.filter((_, idx) => idx !== i) }); }
  function calculerAltitudeMoyenne() {
    try {
      const r = watershed.altitudeMoyennePonderee(v.hypsoTranches);
      setHypsoResult(r);
      patch({ altitudeMoyenne_m: Math.round(r.altitudeMoyenne_m * 100) / 100 });
    } catch (e) { setHypsoResult({ erreur: e.message }); }
  }

  // ── Temps de concentration (7 formules BV-Calc) ───────────
  function calculerTC() {
    const penteMParM = v.tcPenteSource === 'ponderee' ? pentePonderee?.pente_m_par_m : penteGlobale?.pente_m_par_m;
    const pentePourcent = v.tcPenteSource === 'ponderee' ? pentePonderee?.pente_pourcent : penteGlobale?.pente_pourcent;
    const entrees = {
      longueur_m: v.longueur_km ? units.kmToM(parseFloat(v.longueur_km)) : undefined,
      longueur_km: parseFloat(v.longueur_km) || undefined,
      pente_m_par_m: penteMParM, pente_pourcent: pentePourcent,
      surface_km2: parseFloat(v.surface_km2) || undefined,
      altitudeMoyenne_m: parseFloat(v.altitudeMoyenne_m) || undefined,
      altitudeMin_m: parseFloat(v.altitude_min_m) || undefined,
    };
    const def = concentrationTime.METHODES_TC.find(m => m.id === v.tcFormuleId);
    try {
      const manquants = def.champs.filter(c => entrees[c] === undefined || Number.isNaN(entrees[c]));
      if (manquants.length) throw new Error(`${t('fixChampsManquantsPour')} ${def.nom} : ${manquants.join(', ')}.`);
      const r = def.fn(entrees);
      patch({ tc_h: r.tc_h });
      setTcResult(r);
    } catch (e) {
      setTcResult({ erreur: e.message });
    }
  }

  const intensite = useMemo(() => {
    if (!estRempli(v.a) || !estRempli(v.b) || !v.tc_h) return null;
    try { return rainfall.intensiteMontana({ a: parseFloat(v.a), b: parseFloat(v.b), tc_h: parseFloat(v.tc_h) }); }
    catch (e) { return { erreur: e.message }; }
  }, [v.a, v.b, v.tc_h]);

  function synchroniserH1h() {
    if (!estRempli(v.a)) { showToast(t('fixMontanaANonRenseigne')); return; }
    patch({ h1h_mm: parseFloat(v.a) });
  }

  const [h24Source, setH24Source] = useState('weiss');
  function calculerH24() {
    try {
      let r;
      if (h24Source === 'weiss') {
        const pjmax_mm = parseFloat(v.pjmax_saisie);
        const coefficient = parseFloat(v.weiss_k) || 1.15;
        if (Number.isNaN(pjmax_mm)) throw new Error(t('fixRenseignezPjmaxT'));
        r = rainfall.hauteur24hParWeiss({ pjmax_mm, coefficient });
      } else {
        if (!estRempli(v.a) || !estRempli(v.b)) throw new Error(t('fixRenseignezAB'));
        r = rainfall.hauteur24hParExtrapolationMontana({ a: parseFloat(v.a), b: parseFloat(v.b) });
      }
      patch({ h24_mm: r.h24_mm });
      setMontanaEstResult(null);
      showToast(`H24h = ${fmt(r.h24_mm, 3)} mm`);
    } catch (e) { showToast(t('erreur') + ' ' + e.message); }
  }

  function estimerADepuisH24() {
    try {
      if (!estRempli(v.h24_mm)) throw new Error(t('fixCalculezH24Dabord'));
      const b = parseFloat(v.montana_b_suppose);
      if (!estRempli(b)) throw new Error(t('fixRenseignezBSuppose'));
      const r = rainfall.montanaADepuisH24h({ h24_mm: v.h24_mm, b });
      setMontanaEstResult(r);
      patch({ a: r.a, b });
    } catch (e) { setMontanaEstResult({ erreur: e.message }); }
  }

  // ── Cr / CN ────────────────────────────────────────────────
  function lireCr() {
    try {
      const r = runoff.getCr({ code: v.crCode, groupeSol: v.crGroupe, penteClass: v.crPente, T: v.T || 100 });
      setCrResult(r);
      patch({ cr: r.cr });
    } catch (e) { setCrResult({ erreur: e.message }); }
  }
  const categoriesCN = useMemo(() => [...new Set(TABLE_CN.map(l => l.categorie))], []);
  const conditionsCN = useMemo(() => TABLE_CN.filter(l => l.categorie === v.cnCategorie).map(l => l.condition), [v.cnCategorie]);
  function lireCN() {
    try {
      const base = getCN({ categorie: v.cnCategorie, condition: v.cnCondition, groupeSol: v.cnGroupeSol });
      const ajuste = ajusterCN(base.cn, v.cnAmc, parseFloat(v.cnCoefAmcI) || 0.058);
      setCnResult({ base: base.cn, ajuste: ajuste.cn, formule: ajuste.formule, amc: v.cnAmc });
      patch({ CN: ajuste.cn });
    } catch (e) { setCnResult({ erreur: e.message }); }
  }

  // ── Localisation & calcul automatique (mghydro.com + NASA POWER) ──
  // lat/lon explicites (ex. clic sur la carte) prioritaires sur v.geoLat/v.geoLon.
  async function calculerGeo(latArg, lonArg) {
    const lat = latArg ?? parseFloat(v.geoLat);
    const lon = lonArg ?? parseFloat(v.geoLon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) { setGeoMsg({ tone:'error', html:t('geoErreurCoords') }); throw new Error(t('geoErreurCoords')); }
    patch({ geoLat: String(lat), geoLon: String(lon) });
    setGeoLoading(true);
    setGeoMsg({ tone:'info', html:t('geoEnCours') });
    const avertissements = [];
    let ok = false, okDelineation = false, html = '';
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
      onImportToGradex?.({ surface: data.surface_km2 });
    } catch (e) { html += `❌ ${t('erreur')} ${e.message}`; }

    try {
      const rep = await fetch(`/api/pluviometrie?lat=${lat}&lon=${lon}`);
      const data = await rep.json();
      if (!data.ok) throw new Error(data.erreur || t('fixEchecPluviometrie'));
      const T = v.T || 100;
      if (data.pjmax) {
        const pjmaxT = data.pjmax.pjmax[T] ?? data.pjmax.pjmax[100];
        patch({ pjmax_saisie: pjmaxT.toFixed(2) });
        setH24Source('weiss');
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
    if (!okDelineation) throw new Error(t('fixEchecDelimitation'));
  }

  function importerVersGradex() {
    if (!v.surface_km2 && !v.tc_h) return;
    onImportToGradex({ surface: v.surface_km2, tc: v.tc_h });
    showToast(t('mcGeoImporterFait'));
  }

  // ── Sélection des méthodes + résultats ────────────────────
  function champsManquants(methodeId) {
    return (DEPENDANCES[methodeId] || []).filter(c => !estRempli(v[c]));
  }
  function toggleMethode(id) {
    const set = new Set(v.methodesSelectionnees);
    if (set.has(id)) set.delete(id); else set.add(id);
    patch({ methodesSelectionnees: [...set] });
  }
  function cocherTout() {
    const set = new Set(v.methodesSelectionnees);
    METHODES.forEach(({ meta }) => { if (!champsManquants(meta.id).length) set.add(meta.id); });
    patch({ methodesSelectionnees: [...set] });
  }

  function calculerResultats() {
    const out = [];
    for (const id of v.methodesSelectionnees) {
      const { meta, calculer } = getMethode(id);
      try {
        const args = ADAPTATEURS[id](v);
        const r = calculer(args);
        out.push({ id, methode: r.methode, q_m3s: r.q_m3s, T: args.T ?? '—', etapes: r.etapes, hypotheses: r.hypotheses, source: r.source, erreur: null });
      } catch (e) {
        out.push({ id, methode: meta.nom, q_m3s: null, T: '—', erreur: e.message });
      }
    }
    setResultats(out);
    setDetailIdx(null);
    onResultatsChange?.(out);
  }

  async function copierResultats() {
    const reussis = resultats.filter(r => !r.erreur);
    const lignes = [`${t('fixEnteteCopieMethode')}\t${t('fixEnteteCopieQp')}\t${t('fixEnteteCopieT')}`,
      ...reussis.map(r => `${r.methode}\t${r.q_m3s.toFixed(3)}\t${r.T}`)];
    try {
      await navigator.clipboard.writeText(lignes.join('\n'));
      setCopieMsg(t('p3Copie'));
    } catch { setCopieMsg(t('p3CopieErreur')); }
    setTimeout(() => setCopieMsg(''), 4000);
  }

  const surfWarnStyle = { color:'#a05000' };

  return (
    <div>
      <Alert tone="info" icon="info-circle">{t('mcIntro')}</Alert>

      {/* ── Localisation & calcul automatique ── */}
      <CollapseSection title={t('geoTitre')} icon="map-2" open={showGeo} onToggle={() => setShowGeo(s => !s)} accent={C_BLUE}>
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

        <DelimitationCarte lat={v.geoLat} lon={v.geoLon} geometrie={geoGeometrie} loading={geoLoading} onConfirmer={calculerGeo} />
      </CollapseSection>

      {/* ── Bassin versant ── */}
      <Panel title={t('gxParamBv')} icon="map">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <Field label={t('bvSurface')} unite="km²" value={v.surface_km2} onChange={x=>patch({surface_km2:x})} type="number" />
          <Field label={t('bvPerimetre')} unite="km" value={v.perimetre_km} onChange={x=>patch({perimetre_km:x})} type="number" />
          <Field label={t('bvLongueur')} unite="km" value={v.longueur_km} onChange={x=>patch({longueur_km:x})} type="number" />
          <Field label={t('bvAltmin')} unite="m" value={v.altitude_min_m} onChange={x=>patch({altitude_min_m:x})} type="number" />
          <Field label={t('bvAltmax')} unite="m" value={v.altitude_max_m} onChange={x=>patch({altitude_max_m:x})} type="number" />
          <Field label={t('bvAltmoy')} unite="m" value={v.altitudeMoyenne_m} onChange={x=>patch({altitudeMoyenne_m:x})} type="number" />
        </div>

        <div style={{ marginTop:10, borderTop:`1px solid ${C_BORDER}`, paddingTop:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <b style={{ fontSize:12, color:C_BLUE }}>{t('bvPenteTitre')}</b>
            <button onClick={ajouterTroncon} style={{ padding:'2px 8px', fontSize:11, background:'#fff', border:`1px solid ${C_BORDER}`, cursor:'pointer' }}>{t('bvAjouterTroncon')}</button>
          </div>
          <p style={{ fontSize:10.5, color:'#888', marginBottom:6 }}>{t('bvPenteHint')}</p>
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:6 }}>
            <thead><tr>{[t('bvTronconCol'),t('bvLongueurCol'),t('bvAltAmontCol'),t('bvAltAvalCol'),''].map(h=><th key={h} style={{...TH,padding:'3px 6px'}}>{h}</th>)}</tr></thead>
            <tbody>
              {v.troncons.map((tr,i) => (
                <tr key={i}>
                  <td style={{...TD}}>{i+1}</td>
                  <td style={{...TD}}><input type="number" value={tr.longueur_m} onChange={e=>setTroncon(i,'longueur_m',e.target.value)} style={{width:70,height:20,fontSize:11,border:`1px solid ${C_BORDER}`}} /></td>
                  <td style={{...TD}}><input type="number" value={tr.altAmont} onChange={e=>setTroncon(i,'altAmont',e.target.value)} style={{width:70,height:20,fontSize:11,border:`1px solid ${C_BORDER}`}} /></td>
                  <td style={{...TD}}><input type="number" value={tr.altAval} onChange={e=>setTroncon(i,'altAval',e.target.value)} style={{width:70,height:20,fontSize:11,border:`1px solid ${C_BORDER}`}} /></td>
                  <td style={{...TD}}>{v.troncons.length>1 && <button onClick={()=>supprimerTroncon(i)} style={{border:'none',background:'none',cursor:'pointer',color:C_RED}}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize:11 }}>
            {pentePonderee?.erreur
              ? <span style={surfWarnStyle}>{t('bvPentePonderee')} : {pentePonderee.erreur}</span>
              : pentePonderee
                ? <span>{t('bvPentePonderee')} : <b>{fmt(pentePonderee.pente_pourcent,4)} %</b> ({fmt(pentePonderee.pente_m_par_m,6)} m/m)</span>
                : <span style={surfWarnStyle}>{t('fixPenteRenseignerTroncon')}</span>}
          </div>
          <div style={{ fontSize:11, marginTop:4 }}>
            {penteGlobale?.erreur
              ? <span style={surfWarnStyle}>{t('bvPenteGlobale')} : {penteGlobale.erreur}</span>
              : penteGlobale
                ? <span>{t('bvPenteGlobale')} : <b>{fmt(penteGlobale.pente_m_par_m,6)} m/m</b> ({fmt(penteGlobale.pente_pourcent,4)} %) — {t('fixPenteGlobaleUtilisee')}</span>
                : <span style={surfWarnStyle}>{t('fixPenteRenseignerGlobale')}</span>}
          </div>
        </div>

        {/* ── Indice de compacité / forme / rectangle équivalent — auto ── */}
        <div style={{ marginTop:10, borderTop:`1px solid ${C_BORDER}`, paddingTop:8 }}>
          <b style={{ fontSize:12, color:C_BLUE }}>{t('bvCompaciteTitre')}</b>
          <p style={{ fontSize:10.5, color:'#888', margin:'4px 0 6px' }}>{t('bvCompaciteHint')}</p>
          {compacite?.erreur
            ? <span style={surfWarnStyle}>{compacite.erreur}</span>
            : compacite
              ? (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8, fontSize:11 }}>
                  <div>{t('bvIc')} : <b>{fmt(compacite.Ic,4)}</b></div>
                  <div>{t('bvForme')} : <b>{compacite.forme === 'allongée' ? t('bvFormeAllongee') : t('bvFormeCompacte')}</b></div>
                  {compacite.Kh != null && <div>{t('bvKh')} : <b>{fmt(compacite.Kh,4)}</b></div>}
                  {compacite.L_equiv_km != null
                    ? <>
                        <div>{t('bvRectL')} : <b>{fmt(compacite.L_equiv_km,3)} km</b></div>
                        <div>{t('bvRectl')} : <b>{fmt(compacite.l_equiv_km,3)} km</b></div>
                      </>
                    : <div style={surfWarnStyle}>{t('bvRectImpossible')}</div>}
                </div>
              )
              : <span style={surfWarnStyle}>{t('bvCompaciteManque')}</span>}
        </div>

        {/* ── Courbe hypsométrique → altitude moyenne pondérée ── */}
        <div style={{ marginTop:10, borderTop:`1px solid ${C_BORDER}`, paddingTop:8 }}>
          <CollapseSection title={t('bvHypsoTitre')} icon="chart-area-line" open={showHypso} onToggle={()=>setShowHypso(s=>!s)} accent={C_BLUE}>
            <p style={{ fontSize:10.5, color:'#888', marginBottom:6 }}>{t('bvHypsoHint')}</p>
            <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:6 }}>
              <thead><tr>{[t('bvHypsoAltBas'),t('bvHypsoAltHaut'),t('bvHypsoSurface'),''].map(h=><th key={h} style={{...TH,padding:'3px 6px'}}>{h}</th>)}</tr></thead>
              <tbody>
                {v.hypsoTranches.map((tr,i) => (
                  <tr key={i}>
                    <td style={{...TD}}><input type="number" value={tr.altitude_bas} onChange={e=>setHypso(i,'altitude_bas',e.target.value)} style={{width:80,height:20,fontSize:11,border:`1px solid ${C_BORDER}`}} /></td>
                    <td style={{...TD}}><input type="number" value={tr.altitude_haut} onChange={e=>setHypso(i,'altitude_haut',e.target.value)} style={{width:80,height:20,fontSize:11,border:`1px solid ${C_BORDER}`}} /></td>
                    <td style={{...TD}}><input type="number" value={tr.surface_km2} onChange={e=>setHypso(i,'surface_km2',e.target.value)} style={{width:80,height:20,fontSize:11,border:`1px solid ${C_BORDER}`}} /></td>
                    <td style={{...TD}}>{v.hypsoTranches.length>1 && <button onClick={()=>supprimerHypso(i)} style={{border:'none',background:'none',cursor:'pointer',color:C_RED}}>✕</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={ajouterHypso} style={{ padding:'3px 10px', fontSize:11, background:'#fff', border:`1px solid ${C_BORDER}`, cursor:'pointer' }}>{t('bvHypsoAjouterTranche')}</button>
              <button onClick={calculerAltitudeMoyenne} style={{ padding:'3px 10px', fontSize:11, background:C_TEAL, color:'#fff', border:'none', cursor:'pointer' }}>{t('bvHypsoCalculer')}</button>
            </div>
            {hypsoResult && (hypsoResult.erreur
              ? <Alert tone="error">{hypsoResult.erreur}</Alert>
              : <div style={{ fontSize:11, marginTop:6 }}>{t('bvHypsoResultat')} <b>{fmt(hypsoResult.altitudeMoyenne_m,2)} m</b> ({t('bvHypsoSurfaceTotale')} {fmt(hypsoResult.surfaceTotale_km2,2)} km²) — {t('bvHypsoAppliqueA')} <i>{t('bvAltmoy')}</i>.</div>)}
          </CollapseSection>
        </div>
      </Panel>

      {/* ── Temps de concentration (BV-Calc) ── */}
      <Panel title={t('tcTitre') + ' — BV-Calc'} icon="clock-hour-4" accent={C_TEAL}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Select label={t('tcFormule')} value={v.tcFormuleId} onChange={x=>patch({tcFormuleId:x})}
            options={concentrationTime.METHODES_TC.map(m => ({ value:m.id, label: m.nom + (m.recommandee ? ` (${t('tcRecommandee')})` : '') }))} />
          <Select label={t('tcPenteSource')} value={v.tcPenteSource} onChange={x=>patch({tcPenteSource:x})}
            options={[{value:'globale',label:t('tcPenteGlobaleOpt')},{value:'ponderee',label:t('tcPentePondereeOpt')}]} />
        </div>
        <button onClick={calculerTC} style={{ padding:'5px 14px', background:C_TEAL, color:'#fff', border:'none', fontSize:12, cursor:'pointer' }}>{t('tcCalcBtn')}</button>
        {tcResult && (
          tcResult.erreur
            ? <Alert tone="error">{tcResult.erreur}</Alert>
            : <div style={{ marginTop:8, fontSize:12 }}>
                {t('tcResultat')} ({tcResult.methode}) : <b>{fmt(tcResult.tc_min,2)} min</b> = <b>{fmt(tcResult.tc_h,4)} h</b>
                <div style={{ fontSize:10.5, color:'#666', marginTop:4, fontFamily:'monospace' }}>{tcResult.formule}</div>
                {tcResult.avertissement && <div style={{ fontSize:10.5, color:'#a05000', marginTop:4 }}>⚠️ {tcResult.avertissement}</div>}
              </div>
        )}
      </Panel>

      {/* ── Pluviométrie ── */}
      <Panel title={t('pluieTitre')} icon="cloud-rain">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <Field label={t('pluieT')} unite="ans" value={v.T} onChange={x=>patch({T:x})} type="number" />
          <Field label={t('pluieA')} value={v.a} onChange={x=>patch({a:x})} type="number" />
          <Field label={t('pluieB')} value={v.b} onChange={x=>patch({b:x})} type="number" />
        </div>
        <div style={{ fontSize:11, marginBottom:8 }}>
          {intensite
            ? (intensite.erreur ? <span style={surfWarnStyle}>{intensite.erreur}</span>
              : <span>{t('pluieIntensite')} : <b>{fmt(intensite.i_mm_h,4)} mm/h</b> — {intensite.formule}</span>)
            : <span style={surfWarnStyle}>{t('fixIntensiteCalculerTcDabord')}</span>}
        </div>

        <div style={{ borderTop:`1px solid ${C_BORDER}`, paddingTop:8, marginBottom:8 }}>
          <b style={{ fontSize:12, color:C_BLUE }}>{t('h24Titre')}</b>
          <p style={{ fontSize:10.5, color:'#888', margin:'4px 0' }}>{t('h24Hint')}</p>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, marginBottom:4 }}>
            <input type="radio" checked={h24Source==='weiss'} onChange={()=>setH24Source('weiss')} />{t('h24WeissLabel')}
          </label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, opacity: h24Source==='weiss'?1:0.4, marginBottom:6 }}>
            <Field label={t('h24Pjmax')} unite="mm" value={v.pjmax_saisie} onChange={x=>patch({pjmax_saisie:x})} type="number" />
            <Field label={t('h24CoeffK')} value={v.weiss_k} onChange={x=>patch({weiss_k:x})} type="number" />
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, marginBottom:6 }}>
            <input type="radio" checked={h24Source==='montana'} onChange={()=>setH24Source('montana')} />{t('h24MontanaLabel')}
          </label>
          <button onClick={calculerH24} style={{ padding:'4px 12px', background:C_TEAL, color:'#fff', border:'none', fontSize:11, cursor:'pointer' }}>{t('h24CalcBtn')}</button>
          <div style={{ fontSize:11, marginTop:6 }}>{t('h24Resultat')} : {v.h24_mm ? <b>{fmt(v.h24_mm,3)} mm</b> : '—'}</div>
        </div>

        <div style={{ borderTop:`1px solid ${C_BORDER}`, paddingTop:8, marginBottom:8 }}>
          <b style={{ fontSize:12, color:C_BLUE }}>{t('estimerATitre')}</b>
          <p style={{ fontSize:10.5, color:'#888', margin:'4px 0' }}>{t('estimerAHint')}</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label={t('bSuppose')} value={v.montana_b_suppose} onChange={x=>patch({montana_b_suppose:x})} type="number" />
            <div style={{ display:'flex', alignItems:'flex-end', marginBottom:6 }}>
              <button onClick={estimerADepuisH24} style={{ padding:'4px 12px', background:'#fff', border:`1px solid ${C_BORDER}`, fontSize:11, cursor:'pointer' }}>{t('estimerABtn')}</button>
            </div>
          </div>
          {montanaEstResult && (
            montanaEstResult.erreur
              ? <Alert tone="error">{montanaEstResult.erreur}</Alert>
              : <div style={{ fontSize:11 }}>{t('fixAEstime')} <b>{fmt(montanaEstResult.a,3)}</b> {t('fixAvecB')}{v.montana_b_suppose}) — {montanaEstResult.formule}
                  <div style={{ color:'#a05000' }}>⚠️ {montanaEstResult.avertissement}</div></div>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
          <div style={{ flex:1 }}>
            <Field label={t('h1h')} unite="mm" value={v.h1h_mm} onChange={x=>patch({h1h_mm:x})} type="number" />
          </div>
          <button onClick={synchroniserH1h} title={t('h1hSyncTitle')}
            style={{ height:24, padding:'0 10px', background:'#fff', border:`1px solid ${C_BORDER}`, fontSize:11, cursor:'pointer', marginBottom:6 }}>
            = a (Montana) →
          </button>
        </div>
      </Panel>

      {/* ── Cr ── */}
      <Panel title={t('crTitre')} icon="droplet">
        <p style={{ fontSize:10.5, color:'#888', marginBottom:6 }}>{t('crHint')}</p>
        <Field label={t('crDirect')} value={v.cr} onChange={x=>patch({cr:x})} type="number" />
        <div style={{ borderTop:`1px solid ${C_BORDER}`, paddingTop:8, marginTop:6 }}>
          <b style={{ fontSize:11.5, color:C_BLUE }}>{t('crTableTitre')}</b>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:6, marginBottom:6 }}>
            <Select label={t('crCode')} value={v.crCode} onChange={x=>patch({crCode:x})}
              options={Object.entries(OCCUPATIONS_SOL).map(([c,o])=>({value:c,label:`${c} — ${String(o.bceom).slice(0,36)}…`}))} />
            <Select label={t('crGroupe')} value={v.crGroupe} onChange={x=>patch({crGroupe:x})}
              options={[{value:'grossiers',label:t('crGrossiers')},{value:'moyens',label:t('crMoyens')},{value:'fins',label:t('crFins')}]} />
            <Select label={t('crPente')} value={v.crPente} onChange={x=>patch({crPente:x})}
              options={[{value:'<=5%',label:'≤ 5%'},{value:'5-10%',label:'5–10%'},{value:'10-30%',label:'10–30%'},{value:'>30%',label:'> 30%'}]} />
          </div>
          <button onClick={lireCr} style={{ padding:'4px 12px', background:'#fff', border:`1px solid ${C_BORDER}`, fontSize:11, cursor:'pointer' }}>{t('crLookupBtn')}</button>
          {crResult && (crResult.erreur
            ? <Alert tone="error">{crResult.erreur}</Alert>
            : <div style={{ fontSize:11, marginTop:6 }}>{t('fixCrEgal')} <b>{crResult.cr}</b> {t('fixPenteUtilisee')} {crResult.penteClasseUtilisee}, T={v.T})</div>)}
        </div>
      </Panel>

      {/* ── Paramètres spécifiques ── */}
      <Panel title={t('paramsTitre')} icon="settings-2">
        <CollapseSection title={t('cnTitre')} icon="table" open accent={C_BLUE} onToggle={()=>{}}>
          <Field label={t('cnCurveNumber')} value={v.CN} onChange={x=>patch({CN:x})} type="number" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:6 }}>
            <Select label={t('cnOccupation')} value={v.cnCategorie} onChange={x=>patch({cnCategorie:x, cnCondition:''})}
              options={[{value:'',label:'—'}, ...categoriesCN.map(c=>({value:c,label:c}))]} />
            <Select label={t('cnCondition')} value={v.cnCondition} onChange={x=>patch({cnCondition:x})}
              options={[{value:'',label:'—'}, ...conditionsCN.map(c=>({value:c,label:c}))]} />
            <Select label={t('cnGroupeSol')} value={v.cnGroupeSol} onChange={x=>patch({cnGroupeSol:x})}
              options={[{value:'A',label:t('cnGroupeA')},{value:'B',label:t('cnGroupeB')},{value:'C',label:t('cnGroupeC')},{value:'D',label:t('cnGroupeD')}]} />
          </div>
          <Select label={t('cnAmc')} value={v.cnAmc} onChange={x=>patch({cnAmc:x})}
            options={[{value:'II',label:t('cnAmc2')},{value:'I',label:t('cnAmc1')},{value:'III',label:t('cnAmc3')}]} />
          {v.cnAmc === 'I' && (
            <Select label={t('cnCoefAmcI')} value={v.cnCoefAmcI} onChange={x=>patch({cnCoefAmcI:x})}
              options={CN_I_COEF_OPTIONS.map(o=>({value:String(o.value), label:o.value===0.058?t('cnCoefAmcIStandard'):t('cnCoefAmcIExcel')}))} />
          )}
          <button onClick={lireCN} style={{ padding:'4px 12px', background:'#fff', border:`1px solid ${C_BORDER}`, fontSize:11, cursor:'pointer' }}>{t('cnLookupBtn')}</button>
          {cnResult && (cnResult.erreur
            ? <Alert tone="error">{cnResult.erreur}</Alert>
            : <div style={{ fontSize:11, marginTop:6 }}>{t('fixCnTableEgal')} <b>{cnResult.base}</b>{cnResult.amc!=='II' && <> → CN({cnResult.amc}) {t('fixCnAjuste')} <b>{fmt(cnResult.ajuste,1)}</b> ({cnResult.formule})</>}</div>)}
        </CollapseSection>

        <CollapseSection title={t('macMathTitre')} icon="triangle" open accent={C_BLUE} onToggle={()=>{}}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Select label={t('macMathK')} value={v.macMath_K} onChange={x=>patch({macMath_K:x})}
              options={[{value:'',label:'—'},{value:'0.11',label:t('macMathK1')},{value:'0.22',label:t('macMathK2')},{value:'0.32',label:t('macMathK3')},{value:'0.43',label:t('macMathK4')}]} />
            <Select label={t('macMathConv')} value={v.macMath_convention} onChange={x=>patch({macMath_convention:x})}
              options={[{value:'excel',label:t('macMathConvExcel')},{value:'guide',label:t('macMathConvGuide')}]} />
          </div>
        </CollapseSection>

        <CollapseSection title={t('pmaTitre')} icon="cloud" open accent={C_BLUE} onToggle={()=>{}}>
          <Field label={t('pma')} unite="mm/an" value={v.pma_mm_an} onChange={x=>patch({pma_mm_an:x})} type="number" />
        </CollapseSection>

        <CollapseSection title={t('frTitre')} icon="function" open accent={C_BLUE} onToggle={()=>{}}>
          <p style={{ fontSize:10.5, color:'#888', marginBottom:6 }}>{t('frHint')}</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label={t('frSurfaceRef')} unite="km²" value={v.fr_surfaceRef} onChange={x=>patch({fr_surfaceRef:x})} type="number" />
            <Field label={t('frQRef')} unite="m³/s" value={v.fr_qRef} onChange={x=>patch({fr_qRef:x})} type="number" />
          </div>
        </CollapseSection>

        <CollapseSection title={t('mgTitre')} icon="function" open accent={C_BLUE} onToggle={()=>{}}>
          <p style={{ fontSize:10.5, color:'#888', marginBottom:6 }}>{t('mgHint')}</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label={t('mgK')} value={v.malletGautier_K} onChange={x=>patch({malletGautier_K:x})} type="number" />
            <Field label={t('mgA')} value={v.malletGautier_a} onChange={x=>patch({malletGautier_a:x})} type="number" />
          </div>
        </CollapseSection>

        <CollapseSection title={t('fullerTitre')} icon="function" open accent={C_BLUE} onToggle={()=>{}}>
          <p style={{ fontSize:10.5, color:'#888', marginBottom:6 }}>{t('fullerHint')}</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Field label={t('fullerA')} value={v.fullerII_a} onChange={x=>patch({fullerII_a:x})} type="number" />
            <Field label={t('fullerN')} value={v.fullerII_N} onChange={x=>patch({fullerII_N:x})} type="number" placeholder="80 / 85 / 100" />
          </div>
        </CollapseSection>

        <CollapseSection title={t('hlTitre')} icon="function" open accent={C_BLUE} onToggle={()=>{}}>
          <Field label={t('hlA')} value={v.hazanLazarevich_a} onChange={x=>patch({hazanLazarevich_a:x})} type="number" />
        </CollapseSection>
      </Panel>

      {/* ── Sélection + résultats ── */}
      <Panel title={t('mcSelectionTitre')} icon="checklist" accent={C_TEAL}
        headerRight={<button onClick={cocherTout} style={{ padding:'3px 10px', fontSize:11, background:'#fff', border:`1px solid ${C_BORDER}`, cursor:'pointer' }}>{t('p2CocherTout')}</button>}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:8 }}>
          {METHODES.map(({ meta }) => {
            const manquants = champsManquants(meta.id);
            const disponible = !manquants.length;
            const coche = v.methodesSelectionnees.includes(meta.id) && disponible;
            return (
              <label key={meta.id} style={{ border:`1px solid ${C_BORDER}`, padding:'8px 10px', cursor: disponible?'pointer':'not-allowed',
                background: coche ? '#e8f8ee' : disponible ? '#fff' : '#f5f5f5', opacity: disponible?1:0.65 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  <input type="checkbox" checked={coche} disabled={!disponible} onChange={()=>toggleMethode(meta.id)} />
                  <b style={{ fontSize:11.5 }}>{meta.nom}</b>
                  {meta.recommandee && <span style={{ fontSize:9, background:'#d1fae5', color:'#065f46', padding:'1px 6px', borderRadius:8 }}>{t('tcRecommandee')}</span>}
                  {meta.nonDocumenteeDansLeGuide && <span style={{ fontSize:9, background:'#fef3c7', color:'#92400e', padding:'1px 6px', borderRadius:8 }}>{t('methodeNonDocumentee')}</span>}
                </div>
                {!disponible && <div style={{ fontSize:9.5, color:'#a05000' }}>{t('donneesManquantes')} : {manquants.map(libelleChamp).join(', ')}</div>}
              </label>
            );
          })}
        </div>
      </Panel>

      <Panel title={t('mcResultatsTitre')} icon="report" accent={C_TEAL} noPad
        headerRight={<div style={{ display:'flex', gap:6 }}>
          <button onClick={calculerResultats} style={{ padding:'3px 10px', fontSize:11, background:C_TEAL, color:'#fff', border:'none', cursor:'pointer' }}>{t('p3Recalculer')}</button>
          <button onClick={copierResultats} style={{ padding:'3px 10px', fontSize:11, background:'#fff', border:`1px solid ${C_BORDER}`, cursor:'pointer' }}>{t('p3Copier')}</button>
          {copieMsg && <span style={{ fontSize:11, color:C_TEAL, alignSelf:'center' }}>{copieMsg}</span>}
        </div>}>
        {!resultats.length ? <div style={{ padding:16, fontSize:12, color:'#888' }}>{t('p3Vide')}</div> : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>{[t('p3ColMethode'),t('p3ColQp'),t('p3ColT'),''].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {resultats.map((r,i) => (
                <tr key={r.id} style={{ background: r.erreur ? '#fff0f0' : i%2===0?'#fff':C_STRIP }}>
                  <td style={{...TD, textAlign:'left', paddingLeft:8}}>{r.methode}</td>
                  <td style={{...TD, fontWeight:700, color: r.erreur?'#a05000':C_TEAL}}>{r.erreur ? `⚠️ ${r.erreur}` : fmt(r.q_m3s,3)}</td>
                  <td style={TD}>{r.T}</td>
                  <td style={TD}>{!r.erreur && <button onClick={()=>setDetailIdx(i)} style={{ fontSize:10, padding:'1px 8px', background:'#fff', border:`1px solid ${C_BORDER}`, cursor:'pointer' }}>{t('p3VoirDetail')}</button>}</td>
                </tr>
              ))}
              {resultats.filter(r=>!r.erreur).length > 1 && (() => {
                const vals = resultats.filter(r=>!r.erreur).map(r=>r.q_m3s);
                return (
                  <tr style={{ background:'#eef4ff', borderTop:`2px solid ${C_BLUE}` }}>
                    <td style={{...TD, fontWeight:700, textAlign:'left', paddingLeft:8}}>{t('p3Synthese')} ({vals.length} {t('p3Methodes')})</td>
                    <td colSpan={3} style={{...TD, textAlign:'left'}}>min {fmt(Math.min(...vals),2)} — max {fmt(Math.max(...vals),2)} — moy. {fmt(vals.reduce((s,x)=>s+x,0)/vals.length,2)}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        )}
        {detailIdx != null && resultats[detailIdx] && (
          <div style={{ padding:'10px 14px', borderTop:`1px solid ${C_BORDER}` }}>
            <b style={{ fontSize:12, color:C_BLUE }}>{t('p3Detail')} {resultats[detailIdx].methode}</b>
            {resultats[detailIdx].etapes.map((e,i) => (
              <div key={i} style={{ marginTop:8, fontSize:11, background:'#f8f8f8', border:`1px solid ${C_BORDER}`, padding:'6px 10px' }}>
                <div style={{ fontWeight:700, color:'#333' }}>{e.titre}</div>
                {e.formule && <div style={{ fontFamily:'monospace', color:'#555', marginTop:2 }}>{e.formule}</div>}
                {e.application && <div style={{ fontFamily:'monospace', color:'#777', marginTop:2, fontSize:10.5 }}>{e.application}</div>}
                <div style={{ marginTop:2, fontWeight:600 }}>{e.resultat}</div>
              </div>
            ))}
            <div style={{ marginTop:8, fontSize:10.5, color:'#666' }}>
              <b>{t('p3Hypotheses')}</b>
              <ul style={{ margin:'4px 0 0 16px' }}>
                {(resultats[detailIdx].hypotheses||[]).map((h,i)=><li key={i}>{h}</li>)}
                <li>{t('source')} : <span style={{ fontFamily:'monospace' }}>{resultats[detailIdx].source}</span></li>
              </ul>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ============================================================
//  GRADEX — Débits de Crue & Bassins Versants
//  Méthode GRADEX (Guillot & Duband, 1967) — inchangée —
//  + méthodes complémentaires du Guide technique d'assainissement
//  routier 2020 (moteur BV-Calc, formules inchangées, voir
//  src/calculations/*.js et src/tabs/MethodesTab.js).
//  Licence — voir src/licence/LicenceGate.js et src/services/*.
// ============================================================

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, Scatter, ResponsiveContainer
} from "recharts";
import { concentrationTime } from "./calculations/index.js";
import { useI18n } from "./useI18n";
import LicenceGate from "./licence/LicenceGate";
import MethodesTab, { MC_ETAT_INITIAL } from "./tabs/MethodesTab";
import {
  f2, f3, f6, C_BLUE, C_TEAL, C_AMBER, C_RED, C_BORDER, C_HEADER, C_STRIP,
  TH, TD, TBtn, TSep, Field, CollapseSection, Panel, MItem, ChartBox, NoData,
  copyChartCanvas, downloadChartCanvas,
} from "./ui";
import { t as t0 } from "./i18n";

// ─── Constantes ──────────────────────────────────────────────
const EULER = 0.5772156649;
const gU = F => -Math.log(-Math.log(Math.max(1e-12, Math.min(1 - 1e-12, F))));
const S_MIN = 100;

// ─── Parseur ──────────────────────────────────────────────────
function parsePaste(raw) {
  if (!raw || !raw.trim()) return [];
  const result = [];
  raw.trim().split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t) return;
    const parts = t.split(/\t|;|,|\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) return;
    if (parts.length === 1) {
      const v = parseFloat(parts[0].replace(",", "."));
      if (!isNaN(v) && v > 0) result.push({ y: "—", v });
    } else {
      const year = parts.find(p => isNaN(parseFloat(p.replace(",", ".")))) || parts[0];
      let val = null;
      for (let i = parts.length - 1; i >= 0; i--) {
        const n = parseFloat(parts[i].replace(",", "."));
        if (!isNaN(n) && n > 0) { val = n; break; }
      }
      if (val !== null) result.push({ y: year, v: val });
    }
  });
  return result;
}

// ─── Open-Meteo ERA5 ──────────────────────────────────────────
async function fetchPrecipData(lat, lon, onProgress) {
  const endDate = new Date().toISOString().slice(0, 10);
  const url = `https://archive-api.open-meteo.com/v1/archive`
    + `?latitude=${parseFloat(lat).toFixed(4)}`
    + `&longitude=${parseFloat(lon).toFixed(4)}`
    + `&start_date=1981-01-01&end_date=${endDate}`
    + `&daily=precipitation_sum&timezone=UTC`;
  onProgress("Connexion à Open-Meteo ERA5…");
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  onProgress("Téléchargement…");
  const json = await resp.json();
  const dates = json?.daily?.time;
  const precip = json?.daily?.precipitation_sum;
  if (!dates || !precip) throw new Error("Format inattendu.");
  onProgress("Extraction des maxima annuels…");
  const buckets = {};
  dates.forEach((d, i) => {
    const val = precip[i];
    if (val == null || val < 0) return;
    const yr = parseInt(d.slice(0, 4));
    const mo = parseInt(d.slice(5, 7));
    const key = mo >= 10 ? `${yr}/${yr+1}` : `${yr-1}/${yr}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(val);
  });
  const result = Object.entries(buckets)
    .filter(([, vals]) => vals.length >= 300)
    .map(([year, vals]) => ({ y: year, v: parseFloat(Math.max(...vals).toFixed(1)) }))
    .sort((a, b) => a.y.localeCompare(b.y));
  if (result.length < 3) throw new Error("Trop peu d'années.");
  return result;
}

// ─── Calcul TC — méthode GRADEX (INCHANGÉ) ────────────────────
// Formules TC vérifiées vs Excel "Calcule Debit Oued Ighi PFE"
// L_km=longueur thalweg(km), dH_m=dénivelée(m), S_km2=surface(km²)
// H_max=altitude max(m), H_min=altitude min(m)
function computeTC({ L_km, dH_m, S_km2, H_max, H_min }) {
  const L_m   = L_km * 1000;                    // longueur en mètres
  const I     = dH_m / L_m;                     // pente m/m
  const I_pct = I * 100;                        // pente %
  const results = [];

  if (L_m > 0 && I > 0) {
    const tc_min = 0.0195 * Math.pow(L_m, 0.77) * Math.pow(I, -0.385);
    results.push({ name:"Kirpich", tc_min, tc_h: tc_min/60,
      formule:"0.0195 × L_m^0.77 × I^-0.385", note:"Recommandée bassins arides (Maroc)", source:"gradex" });
  }
  if (L_km > 0 && I > 0) {
    const tc_min = 60 * 0.3 * Math.pow(L_km / Math.pow(I, 0.25), 0.77);
    results.push({ name:"Espagnole", tc_min, tc_h: tc_min/60,
      formule:"60×0.3×(L_km/I^0.25)^0.77", note:"L(km), I(m/m)", source:"gradex" });
  }
  if (L_km > 0 && I > 0) {
    const tc_min = 60 * 0.1452 * Math.pow(L_km / Math.pow(I, 0.5), 0.77);
    results.push({ name:"Californienne", tc_min, tc_h: tc_min/60,
      formule:"60×0.1452×(L_km/I^0.5)^0.77", note:"L(km), I(m/m)", source:"gradex" });
  }
  if (S_km2 > 0 && I_pct > 0) {
    const tc_min = 76.3 * Math.pow(S_km2 / I_pct, 0.5);
    results.push({ name:"Ventura", tc_min, tc_h: tc_min/60,
      formule:"76.3×(S/I%)^0.5", note:"S(km²), I(%)", source:"gradex" });
  }
  if (S_km2 > 0 && L_km > 0 && I_pct > 0) {
    const tc_min = 64.8 * Math.pow(S_km2 * L_km, 0.333) * Math.pow(I_pct, -0.5);
    results.push({ name:"Giandotti", tc_min, tc_h: tc_min/60,
      formule:"64.8×(S×L)^0.333×I%^-0.5", note:"S(km²), L(km), I(%)", source:"gradex" });
  }
  if (S_km2 > 0 && L_km > 0 && I > 0) {
    const tc_min = 60 * 0.108 * Math.pow(S_km2 * L_km, 0.333) * Math.pow(I, -0.5);
    results.push({ name:"Passini", tc_min, tc_h: tc_min/60,
      formule:"60×0.108×(S×L)^0.333×I^-0.5", note:"S(km²), L(km), I(m/m)", source:"gradex" });
  }
  if (L_m > 0 && I > 0) {
    const kirpich_min = 0.0195 * Math.pow(L_m, 0.77) * Math.pow(I, -0.385);
    const tc_min = 0.6 * kirpich_min;
    results.push({ name:"Lag Time", tc_min, tc_h: tc_min/60,
      formule:"0.6 × Kirpich", note:"Basé sur Kirpich", source:"gradex" });
  }

  // ── Formules complémentaires BV-Calc (Guide technique d'assainissement
  // routier 2020, §2.2.4-C) — AJOUTÉES, sans toucher aux formules GRADEX
  // ci-dessus. Turrazza n'existait pas dans GRADEX. Giandotti (BV-Calc)
  // et Passini (BV-Calc) portent volontairement un nom distinct de leurs
  // homonymes GRADEX ci-dessus : ce sont des formules DIFFÉRENTES sous le
  // même nom historique (vérifié : le Giandotti "GRADEX" ci-dessus ne
  // correspond pas à la formule de Giandotti internationalement reconnue
  // (4√S+1.5L)/(0.8√ΔH), que BV-Calc implémente ; et le "Passini" GRADEX
  // ci-dessus correspond en réalité, numériquement, à la formule appelée
  // Turrazza par le guide BV-Calc — voir README §"Formules de temps de
  // concentration : deux sources"). Chaque ligne garde SA formule EXACTE.
  try {
    const r = concentrationTime.tcTurrazza({ surface_km2: S_km2, longueur_km: L_km, pente_pourcent: I_pct });
    results.push({ name: "Turrazza (BV-Calc)", tc_min: r.tc_min, tc_h: r.tc_h, formule: r.formule,
      note: "Guide RAR82/SETRA — nouvelle formule (absente de GRADEX)", source: "bvcalc" });
  } catch { /* entrées insuffisantes */ }
  try {
    const r = concentrationTime.tcGiandotti({ surface_km2: S_km2, longueur_km: L_km, altitudeMoyenne_m: H_max, altitudeMin_m: H_min });
    results.push({ name: "Giandotti (BV-Calc, formule standard)", tc_min: r.tc_min, tc_h: r.tc_h, formule: r.formule,
      note: "Formule internationale (4√S+1.5L)/(0.8√ΔH) — distincte du \"Giandotti\" GRADEX ci-dessus", source: "bvcalc" });
  } catch { /* entrées insuffisantes */ }
  try {
    const r = concentrationTime.tcPassini({ surface_km2: S_km2, longueur_km: L_km, pente_pourcent: I_pct });
    results.push({ name: "Passini (BV-Calc, Guide RAR82)", tc_min: r.tc_min, tc_h: r.tc_h, formule: r.formule,
      note: "Distincte du \"Passini\" GRADEX ci-dessus (voir avertissement du Guide)", source: "bvcalc" });
  } catch { /* entrées insuffisantes */ }

  results.forEach(r => {
    r.tc_min = parseFloat(r.tc_min.toFixed(1));
    r.tc_h   = parseFloat(r.tc_h.toFixed(4));
  });

  if (results.length > 0) {
    const sum   = results.reduce((s, r) => s + r.tc_h, 0);
    const moy   = sum / results.length;
    const moySorted = [...results].sort((a,b) => Math.abs(a.tc_h-moy) - Math.abs(b.tc_h-moy));
    const closest = moySorted[0];
    results._moyenne   = parseFloat(moy.toFixed(4));
    results._closestName = closest.name;
  }

  return results;
}

// ─── Calcul GRADEX (INCHANGÉ, vérifié vs Excel) ────────────────
function computeGRADEX({ data, S, Cp, T0, Q0obs, tcH, bMontana }) {
  const valid = data.filter(d => !isNaN(d.v) && d.v > 0);
  if (valid.length < 3 || !S || S <= 0) return null;

  const n = valid.length;
  const sorted = [...valid].sort((a, b) => a.v - b.v);
  const rows = sorted.map((d, i) => {
    const rank = i + 1;
    const F = (rank - 0.5) / n;
    return { year: d.y, pj: d.v, rank, F, u: gU(F) };
  });

  const mean = rows.reduce((s, r) => s + r.pj, 0) / n;
  const std = Math.sqrt(rows.reduce((s, r) => s + (r.pj - mean) ** 2, 0) / (n - 1));
  const a = std * Math.sqrt(6) / Math.PI;
  const b = mean - a * EULER;
  const rowsFull = rows.map(r => ({ ...r, pEst: a * r.u + b }));

  const useMontana = tcH > 0 && tcH < 24 && bMontana > 0;
  const convFactor = useMontana
    ? Math.pow(tcH / 24, 1 - bMontana) * 1000 * S / (tcH * 3600)
    : 1000 * S / 86400;

  const u0 = gU(1 - 1 / T0);
  const P0g = a * u0 + b;

  const Q0 = Q0obs > 0 ? Q0obs : P0g * convFactor;
  const P0 = Q0obs > 0 ? Q0obs / convFactor : P0g;

  const Ts = [10, 20, 50, 100, 200, 250, 500, 1000, 10000];
  const extrap = Ts.map(T => {
    const F = 1 - 1 / T;
    const u = gU(F);
    const dU = u - u0;
    const P = P0 + a * dU;
    const Qm = Q0 + a * dU * convFactor;
    const Qp = Cp * Qm;
    return { T, F, u, P, Qm, Qp };
  });

  const gumbelChart = rowsFull.map(r => ({
    u: parseFloat(r.u.toFixed(4)),
    pObs: r.pj,
    pEst: parseFloat(r.pEst.toFixed(3))
  }));

  return { n, mean, std, a, b, rowsFull, u0, P0g, P0, Q0,
           extrap, gumbelChart, convFactor, useMontana, tcH, bMontana };
}

// ─── Capture graphique → PNG (dessin direct sur Canvas) ───────
function drawGumbelOnCanvas(canvas, data, station) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext("2d");
  const ML=70, MR=20, MT=30, MB=50;
  const IW=W-ML-MR, IH=H-MT-MB;

  ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);

  const uMin = Math.min(...data.map(d=>d.u))-0.3;
  const uMax = Math.max(...data.map(d=>d.u))+0.3;
  const pMax = Math.max(...data.map(d=>Math.max(d.pObs||0, d.pEst||0)))*1.12;
  const px = u  => ML + ((u-uMin)/(uMax-uMin))*IW;
  const py = p  => MT + IH - (p/pMax)*IH;

  ctx.strokeStyle="#e5e5e5"; ctx.lineWidth=1;
  for(let i=0;i<=5;i++){
    const x=ML+i*IW/5, y=MT+i*IH/5;
    ctx.beginPath(); ctx.moveTo(x,MT); ctx.lineTo(x,MT+IH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ML,y); ctx.lineTo(ML+IW,y); ctx.stroke();
    ctx.fillStyle="#666"; ctx.font="10px Arial"; ctx.textAlign="center";
    ctx.fillText((uMin+i*(uMax-uMin)/5).toFixed(1), x, MT+IH+14);
    ctx.textAlign="right";
    ctx.fillText((pMax*(1-i/5)).toFixed(0), ML-5, y+4);
  }

  const linePts = [...data].sort((a,b)=>a.u-b.u).filter(d=>d.pEst!=null);
  ctx.strokeStyle="#8B1a1a"; ctx.lineWidth=2;
  ctx.beginPath();
  linePts.forEach((d,i)=>{ i===0?ctx.moveTo(px(d.u),py(d.pEst)):ctx.lineTo(px(d.u),py(d.pEst)); });
  ctx.stroke();

  ctx.fillStyle="#2060a0";
  data.forEach(d=>{ if(d.pObs!=null){ ctx.beginPath(); ctx.arc(px(d.u),py(d.pObs),3.5,0,Math.PI*2); ctx.fill(); }});

  ctx.strokeStyle="#aaa"; ctx.lineWidth=1;
  ctx.strokeRect(ML,MT,IW,IH);

  ctx.fillStyle="#444"; ctx.font="11px Arial"; ctx.textAlign="center";
  ctx.fillText(t0('gxVarReduiteGumbel'), ML+IW/2, H-6);
  ctx.save(); ctx.translate(14,MT+IH/2); ctx.rotate(-Math.PI/2);
  ctx.fillText("Pjmax (mm/24h)", 0, 0); ctx.restore();

  ctx.font="bold 12px Arial"; ctx.fillStyle="#2060a0"; ctx.textAlign="center";
  ctx.fillText(t0('gxAjustGumbelTitre').split(' — ')[0] + " — "+station, ML+IW/2, 16);

  ctx.strokeStyle="#8B1a1a"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(ML+IW-110,MT+10); ctx.lineTo(ML+IW-90,MT+10); ctx.stroke();
  ctx.fillStyle="#444"; ctx.font="10px Arial"; ctx.textAlign="left";
  ctx.fillText(t0('gxDroiteGumbel'), ML+IW-86, MT+14);
  ctx.fillStyle="#2060a0";
  ctx.beginPath(); ctx.arc(ML+IW-100,MT+24,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#444"; ctx.fillText(t0('gxPjmaxObservees'), ML+IW-86, MT+28);
}

function drawDischargeOnCanvas(canvas, extrap, station, cp) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext("2d");
  const ML=70, MR=20, MT=30, MB=50;
  const IW=W-ML-MR, IH=H-MT-MB;

  ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);

  const Ts   = extrap.map(d=>d.T);
  const Qmax = Math.max(...extrap.map(d=>d.Qp))*1.12;
  const px = T  => ML + ((T-Ts[0])/(Ts[Ts.length-1]-Ts[0]))*IW;
  const py = Q  => MT + IH - (Q/Qmax)*IH;
  const fmtT = T => T>=10000?"10k":T>=1000?"1k":String(T);

  ctx.strokeStyle="#e5e5e5"; ctx.lineWidth=1;
  for(let i=0;i<=5;i++){
    const y=MT+i*IH/5;
    ctx.beginPath(); ctx.moveTo(ML,y); ctx.lineTo(ML+IW,y); ctx.stroke();
    ctx.fillStyle="#666"; ctx.font="10px Arial"; ctx.textAlign="right";
    ctx.fillText((Qmax*(1-i/5)).toFixed(0), ML-5, y+4);
  }
  Ts.forEach(T=>{ const x=px(T);
    ctx.strokeStyle="#e5e5e5"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x,MT); ctx.lineTo(x,MT+IH); ctx.stroke();
    ctx.fillStyle="#666"; ctx.font="10px Arial"; ctx.textAlign="center";
    ctx.fillText(fmtT(T), x, MT+IH+14);
  });

  ctx.strokeStyle="#0a6045"; ctx.lineWidth=2;
  ctx.beginPath();
  extrap.forEach((d,i)=>{ i===0?ctx.moveTo(px(d.T),py(d.Qm)):ctx.lineTo(px(d.T),py(d.Qm)); });
  ctx.stroke();
  ctx.fillStyle="#0a6045";
  extrap.forEach(d=>{ ctx.beginPath(); ctx.arc(px(d.T),py(d.Qm),3.5,0,Math.PI*2); ctx.fill(); });

  ctx.strokeStyle="#8B5000"; ctx.lineWidth=2;
  ctx.setLineDash([6,4]);
  ctx.beginPath();
  extrap.forEach((d,i)=>{ i===0?ctx.moveTo(px(d.T),py(d.Qp)):ctx.lineTo(px(d.T),py(d.Qp)); });
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle="#8B5000";
  extrap.forEach(d=>{ ctx.beginPath(); ctx.arc(px(d.T),py(d.Qp),3.5,0,Math.PI*2); ctx.fill(); });

  ctx.strokeStyle="#aaa"; ctx.lineWidth=1; ctx.strokeRect(ML,MT,IW,IH);

  ctx.fillStyle="#444"; ctx.font="11px Arial"; ctx.textAlign="center";
  ctx.fillText(t0('gxPeriodeRetourT'), ML+IW/2, H-6);
  ctx.save(); ctx.translate(14,MT+IH/2); ctx.rotate(-Math.PI/2);
  ctx.fillText(t0('gxDebitQ'), 0, 0); ctx.restore();

  ctx.font="bold 12px Arial"; ctx.fillStyle="#0a6045"; ctx.textAlign="center";
  ctx.fillText(t0('gxDebitsCrueTitre')+" "+station, ML+IW/2, 16);

  ctx.strokeStyle="#0a6045"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(ML+IW-140,MT+10); ctx.lineTo(ML+IW-120,MT+10); ctx.stroke();
  ctx.fillStyle="#444"; ctx.font="10px Arial"; ctx.textAlign="left";
  ctx.fillText(t0('gxQMoyen'), ML+IW-116, MT+14);
  ctx.strokeStyle="#8B5000"; ctx.setLineDash([5,3]);
  ctx.beginPath(); ctx.moveTo(ML+IW-140,MT+24); ctx.lineTo(ML+IW-120,MT+24); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle="#444"; ctx.fillText(t0('gxQPointe'), ML+IW-116, MT+28);
}

function makeGumbelCanvas(res, station) {
  const canvas = document.createElement("canvas");
  canvas.width = 800; canvas.height = 420;
  drawGumbelOnCanvas(canvas, res.gumbelChart, station);
  return canvas;
}
function makeDischargeCanvas(res, station, cp) {
  const canvas = document.createElement("canvas");
  canvas.width = 800; canvas.height = 420;
  drawDischargeOnCanvas(canvas, res.extrap, station, cp);
  return canvas;
}

// ─── Rapport Word avec graphiques embarqués ───────────────────
function buildAndDownloadWord({ res, station, surface, tc, bMontana, cp, tPivot,
                                 mcResultats, onDone }) {
  if (!res) return;

  const fmtT = T => T >= 10000 ? "10 000" : T >= 1000 ? "1 000" : String(T);
  const today = new Date().toLocaleDateString("fr-FR");

  function buildHTML(imgG64, imgD64) {
    const rowsHtml = res.extrap.map((e, i) => {
      const big = e.T >= 1000;
      const bg = big ? "#FFF3CD" : (i % 2 === 0 ? "#ffffff" : "#E8F5EE");
      const col = big ? "#8B5000" : "#0F6E56";
      return `<tr>
        <td style="text-align:center;font-weight:bold;color:${col};background:${bg}">${fmtT(e.T)}</td>
        <td style="text-align:center;background:${bg}">${e.F.toFixed(6)}</td>
        <td style="text-align:center;background:${bg}">${e.u.toFixed(6)}</td>
        <td style="text-align:center;background:${bg}">${e.P.toFixed(3)}</td>
        <td style="text-align:center;background:${bg}">${e.Qm.toFixed(3)}</td>
        <td style="text-align:center;font-weight:bold;color:${col};background:${bg}">${e.Qp.toFixed(3)}</td>
      </tr>`;
    }).join("");

    const gumbelRows = res.rowsFull.map((r, i) =>
      `<tr>
        <td style="text-align:center;background:${i%2===0?"#fff":"#f5f5f5"}">${r.rank}</td>
        <td style="background:${i%2===0?"#fff":"#f5f5f5"}">${r.year}</td>
        <td style="text-align:center;background:${i%2===0?"#fff":"#f5f5f5"}">${r.pj.toFixed(1)}</td>
        <td style="text-align:center;background:${i%2===0?"#fff":"#f5f5f5"}">${r.F.toFixed(6)}</td>
        <td style="text-align:center;background:${i%2===0?"#fff":"#f5f5f5"}">${r.u.toFixed(6)}</td>
        <td style="text-align:center;background:${i%2===0?"#fff":"#f5f5f5"}">${r.pEst.toFixed(3)}</td>
      </tr>`
    ).join("");

    const img1 = imgG64 ? `<img src="${imgG64}" width="620" height="300" style="border:1px solid #ccc"/>` : "";
    const img2 = imgD64 ? `<img src="${imgD64}" width="620" height="300" style="border:1px solid #ccc"/>` : "";

    const mcReussis = (mcResultats || []).filter(r => !r.erreur);
    const mcSection = mcReussis.length ? `
<h2>4. Méthodes complémentaires (Guide technique d'assainissement routier — BV-Calc)</h2>
<p>Méthodes calculées en complément de GRADEX (utile en particulier pour les petits bassins, S &lt; 100 km²) :</p>
<table>
  <tr><th>Méthode</th><th>Qp (m³/s)</th><th>T (ans)</th></tr>
  ${mcReussis.map((r,i) => `<tr><td style="background:${i%2===0?"#fff":"#f5f5f5"}">${r.methode}</td><td style="text-align:center;font-weight:bold;background:${i%2===0?"#fff":"#f5f5f5"}">${r.q_m3s.toFixed(3)}</td><td style="text-align:center;background:${i%2===0?"#fff":"#f5f5f5"}">${r.T}</td></tr>`).join("")}
</table>` : "";

    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>GRADEX — ${station}</title>
<style>
body{font-family:Arial,sans-serif;font-size:11pt;margin:2cm;color:#000}
h1{font-size:16pt;color:#1a3a6a;text-align:center;border-bottom:2px solid #1a3a6a;padding-bottom:6px}
h2{font-size:12pt;color:#1a3a6a;border-left:4px solid #1a3a6a;padding-left:8px;margin-top:20px}
h3{font-size:11pt;color:#0a5040;margin-top:14px}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:10pt}
th{background:#1a3a6a;color:#fff;padding:5px 8px;text-align:center;font-size:10pt}
td{padding:4px 8px;border:0.5px solid #ccc;font-size:10pt}
p{line-height:1.6;text-align:justify}
.footer{border-top:1px solid #ccc;padding-top:6px;text-align:center;color:#888;font-size:9pt;margin-top:24px}
</style></head>
<body>
<h1>RAPPORT HYDROLOGIQUE — MÉTHODE GRADEX${mcReussis.length ? " + MÉTHODES COMPLÉMENTAIRES" : ""}</h1>
<p style="text-align:center;color:#444;font-size:11pt;margin-top:4px">
  Station : <b>${station}</b> &nbsp;|&nbsp; Surface : ${surface} km² &nbsp;|&nbsp; Date : ${today}
</p>
<h2>1. Présentation</h2>
<p>La méthode GRADEX (Guillot &amp; Duband, EDF 1967) extrapole les débits de crue par
  transfert du gradient des extrêmes pluviométriques sur les débits au-delà de la période pivot T₀ = ${tPivot} ans.</p>
<h2>2. Paramètres</h2>
<table style="width:55%">
  <tr><td>Station</td><td><b>${station}</b></td></tr>
  <tr><td>Surface (S)</td><td>${surface} km²</td></tr>
  <tr><td>TC</td><td>${tc ? tc+" h" : "Non fourni"}</td></tr>
  ${res.useMontana ? `<tr><td>Coeff. Montana (b)</td><td>${bMontana}</td></tr>` : ""}
  <tr><td>Coeff. de pointe (Cp)</td><td>${cp}</td></tr>
  <tr><td>Période pivot T₀</td><td>${tPivot} ans</td></tr>
  <tr><td>Nombre de données (n)</td><td>${res.n}</td></tr>
  <tr><td>Moyenne µ</td><td>${f2(res.mean)} mm</td></tr>
  <tr><td>Écart-type σ</td><td>${f2(res.std)} mm</td></tr>
  <tr><td>GRADEX (a)</td><td>${f6(res.a)} mm</td></tr>
  <tr><td>Facteur de conversion</td><td>${res.convFactor.toFixed(6)}</td></tr>
  <tr><td>Q₀ pivot</td><td>${f2(res.Q0)} m³/s</td></tr>
</table>
<h2>3. Ajustement Gumbel</h2>
<table>
  <tr><th>Rang</th><th>Année</th><th>Pjmax [mm]</th><th>Fréquence F</th><th>Variable u</th><th>Pjmax estimée [mm]</th></tr>
  ${gumbelRows}
</table>
${img1 ? `<h3>Graphique — Ajustement Gumbel</h3><p>${img1}</p>` : ""}
<h2>4. Extrapolation GRADEX</h2>
<table>
  <tr>
    <th>T (ans)</th><th>Fréquence F</th><th>Variable u</th>
    <th>P_extrap (mm)</th><th>Q moyen (m³/s)</th><th>Q de pointe (m³/s)</th>
  </tr>
  ${rowsHtml}
</table>
${img2 ? `<h3>Graphique — Débits de crue</h3><p>${img2}</p>` : ""}
<h2>5. Conclusions</h2>
<p>L'analyse des <b>${res.n}</b> précipitations de la station <b>${station}</b>
 (µ = ${f2(res.mean)} mm, σ = ${f2(res.std)} mm) donne un GRADEX de <b>${f3(res.a)} mm</b>.
 ${res.useMontana ? `Correction Montana : TC = ${tc} h, b = ${bMontana}.` : ""}
 Ancré à Q(T₀ = ${tPivot} ans) = <b>${f2(res.Q0)} m³/s</b> :</p>
<ul>${res.extrap.map(e => `<li>Qp(T = ${fmtT(e.T)} ans) = <b>${e.Qp.toFixed(1)} m³/s</b></li>`).join("")}</ul>
${mcSection}
<div class="footer">Méthode GRADEX (Guillot &amp; Duband, 1967)${mcReussis.length ? " + Guide technique d'assainissement routier 2020" : ""} — ${new Date().toLocaleString("fr-FR")}</div>
</body></html>`;
  }

  function doDownload(imgG64, imgD64) {
    const html = buildHTML(imgG64, imgD64);
    const blob = new Blob(["﻿", html], { type: "application/vnd.ms-word;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GRADEX_${station.replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onDone) onDone();
  }

  try {
    const cG = makeGumbelCanvas(res, station);
    const cD = makeDischargeCanvas(res, station, cp);
    doDownload(cG.toDataURL("image/png"), cD.toDataURL("image/png"));
  } catch(e) {
    doDownload(null, null);
  }
}

// ─── Gestion fichiers .hyd ────────────────────────────────────
let _currentFileHandle = null;

async function _writeHandle(handle, data) {
  const json = JSON.stringify(data, null, 2);
  const writable = await handle.createWritable();
  await writable.write(json);
  await writable.close();
  return handle.name;
}

async function saveProjectFile(data, forceNew) {
  const json = JSON.stringify(data, null, 2);

  if (window.showSaveFilePicker) {
    if (_currentFileHandle && !forceNew) {
      try { return await _writeHandle(_currentFileHandle, data); }
      catch(e) { _currentFileHandle = null; }
    }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: (data.station || "projet").replace(/\s+/g,"_") + ".hyd",
        types: [{ description:"Fichier GRADEX (.hyd)", accept:{ "application/json":[".hyd"] } }]
      });
      _currentFileHandle = handle;
      return await _writeHandle(handle, data);
    } catch(e) {
      if (e.name === "AbortError") return null;
      throw e;
    }
  }

  const blob = new Blob([json], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (data.station||"projet").replace(/\s+/g,"_")+".hyd";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return a.download;
}

async function openProjectFile() {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description:"Fichier GRADEX (.hyd)", accept:{ "application/json":[".hyd",".json"] } }]
      });
      _currentFileHandle = handle;
      const file = await handle.getFile();
      const text = await file.text();
      return { data: JSON.parse(text), name: file.name };
    } catch(e) {
      if (e.name === "AbortError") return null;
      throw e;
    }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".hyd,.json";
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) { resolve(null); return; }
      try { const text = await file.text(); resolve({ data:JSON.parse(text), name:file.name }); }
      catch { reject(new Error("Fichier invalide")); }
    };
    input.click();
  });
}

async function newProjectDialog(defaultStation) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: (defaultStation||"nouveau_projet").replace(/\s+/g,"_")+".hyd",
        types: [{ description:"Fichier GRADEX (.hyd)", accept:{ "application/json":[".hyd"] } }]
      });
      _currentFileHandle = handle;
      const stationName = handle.name.replace(/\.hyd$/i,"").replace(/_/g," ");
      const empty = newProjectData();
      empty.station = stationName;
      await _writeHandle(handle, empty);
      return { name: handle.name, station: stationName };
    } catch(e) {
      if (e.name === "AbortError") return null;
      throw e;
    }
  }
  _currentFileHandle = null;
  return { name: null, station: "Nouvelle Station" };
}

// getState/loadState portent désormais aussi `mc` (état complet de l'onglet
// "Méthodes complémentaires" — BV-Calc) : un projet .hyd sauvegarde tout,
// GRADEX ET les méthodes complémentaires, comme demandé.
function newProjectData() {
  return { station:"Nouvelle Station", surface:"", cp:"1.4", tc:"", bMontana:"",
           tPivot:"10", qPivot:"", pasteText:"", tcL:"", tcDH:"", tcHmoy:"", tcH0:"",
           mc: MC_ETAT_INITIAL };
}

// ─── Bouton barre d'outils (langue) ────────────────────────────
function LangSwitch({ langue, changerLangue, LANGUES, NOMS_LANGUES }) {
  return (
    <select value={langue} onChange={e=>changerLangue(e.target.value)}
      style={{ fontSize:11, padding:"2px 4px", border:"1px solid rgba(255,255,255,0.4)",
        background:"rgba(255,255,255,0.12)", color:"#fff", borderRadius:2 }}>
      {LANGUES.map(lg => <option key={lg} value={lg} style={{ color:"#000" }}>{NOMS_LANGUES[lg]}</option>)}
    </select>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────
function MainApp() {
  const { t, langue, changerLangue, rtl, LANGUES, NOMS_LANGUES } = useI18n();

  const [station,   setStation]   = useState("Ma Station");
  const [surface,   setSurface]   = useState("");
  const [cp,        setCp]        = useState("1.4");
  const [tc,        setTc]        = useState("");
  const [bMontana,  setBMontana]  = useState("");
  const [tPivot,    setTPivot]    = useState("10");
  const [qPivot,    setQPivot]    = useState("");
  const [pasteText, setPasteText] = useState("");
  const [tab,       setTab]       = useState("donnees");

  const [tcL,       setTcL]       = useState("");
  const [tcDH,      setTcDH]      = useState("");
  const [tcHmoy,    setTcHmoy]    = useState("");
  const [tcH0,      setTcH0]      = useState("");
  const [tcResults, setTcResults] = useState([]);
  const [tcSel,     setTcSel]     = useState(null);
  const [showTC,    setShowTC]    = useState(false);

  const [showNasa,  setShowNasa]  = useState(false);
  const [nasaLat,   setNasaLat]   = useState("");
  const [nasaLon,   setNasaLon]   = useState("");
  const [nasaLoad,  setNasaLoad]  = useState(false);
  const [nasaMsg,   setNasaMsg]   = useState("");
  const [nasaErr,   setNasaErr]   = useState(false);

  const [wordLoad,  setWordLoad]  = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [dirty,     setDirty]     = useState(false);
  const [toast,     setToast]     = useState(null);

  const [menuFile,  setMenuFile]  = useState(false);
  const [menuEdit,  setMenuEdit]  = useState(false);

  // Onglet "Méthodes complémentaires" (BV-Calc) — état séparé, sauvegardé
  // dans le même fichier .hyd que le reste du projet (voir getState/loadState).
  const [mc, setMc] = useState(MC_ETAT_INITIAL);
  const [mcResultats, setMcResultats] = useState([]);

  const gumbelRef    = useRef(null);
  const dischargeRef = useRef(null);

  const showToast = useCallback(msg => {
    setToast(msg); setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => { setDirty(true); },
    [station, surface, cp, tc, bMontana, tPivot, qPivot, pasteText, mc]);

  useEffect(() => {
    const h = () => { setMenuFile(false); setMenuEdit(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  function getState() {
    return { station, surface, cp, tc, bMontana, tPivot, qPivot, pasteText,
             tcL, tcDH, tcHmoy, tcH0, mc };
  }

  function loadState(d) {
    setStation(d.station||""); setSurface(d.surface||""); setCp(d.cp||"1.4");
    setTc(d.tc||""); setBMontana(d.bMontana||""); setTPivot(d.tPivot||"10");
    setQPivot(d.qPivot||""); setPasteText(d.pasteText||"");
    setTcL(d.tcL||""); setTcDH(d.tcDH||""); setTcHmoy(d.tcHmoy||""); setTcH0(d.tcH0||"");
    setMc({ ...MC_ETAT_INITIAL, ...(d.mc || {}) });
    setDirty(false);
  }

  async function handleNew() {
    try {
      const result = await newProjectDialog("nouveau_projet");
      if (result === null) return;
      loadState(newProjectData());
      if (result.station) setStation(result.station);
      setCurrentFile(result.name || null);
      setDirty(false);
      setTab("donnees");
      showToast(result.name ? `${t('gxToastNouveauProjet')} ${result.name}` : t('gxToastNouveauProjetCree'));
    } catch(e) {
      showToast(`${t('erreur')} ${e.message}`);
    }
  }

  async function handleOpen() {
    try {
      const result = await openProjectFile();
      if (!result) return;
      loadState(result.data);
      setCurrentFile(result.name);
      showToast(`${t('gxToastProjetOuvert')} ${result.name}`);
    } catch (e) {
      showToast(`${t('erreur')} ${e.message}`);
    }
  }

  async function handleSave() {
    try {
      const name = await saveProjectFile(getState(), false);
      if (name) { setCurrentFile(name); setDirty(false); showToast(`${t('gxToastSauvegarde')} ${name}`); }
    } catch (e) { showToast(`${t('gxToastErreurSauvegarde')} ${e.message}`); }
  }

  async function handleSaveAs() {
    try {
      const name = await saveProjectFile(getState(), true);
      if (name) { setCurrentFile(name); setDirty(false); showToast(`${t('gxToastEnregistreSous')} ${name}`); }
    } catch (e) { showToast(`${t('erreur')} ${e.message}`); }
  }

  async function handleNasa() {
    const lat = parseFloat(nasaLat), lon = parseFloat(nasaLon);
    if (isNaN(lat)||isNaN(lon)) { setNasaErr(true); setNasaMsg("Coordonnées invalides."); return; }
    setNasaLoad(true); setNasaErr(false); setNasaMsg("");
    try {
      const data = await fetchPrecipData(lat, lon, m => setNasaMsg(m));
      setPasteText(data.map(d => `${d.y}\t${d.v}`).join("\n"));
      setNasaMsg(`✓ ${data.length} ${t('gxAnneesImportees')}`);
    } catch(e) {
      setNasaErr(true); setNasaMsg(`${t('erreur')} ${e.message}`);
    } finally { setNasaLoad(false); }
  }

  function handleComputeTC() {
    const res = computeTC({
      L_km:parseFloat(tcL)||0, dH_m:parseFloat(tcDH)||0,
      S_km2:parseFloat(surface)||0,
      H_max:parseFloat(tcHmoy)||0,
      H_min:parseFloat(tcH0)||0
    });
    setTcResults(res); setTcSel(null);
  }

  // Reporter Surface/TC depuis l'onglet "Méthodes complémentaires" vers GRADEX.
  const handleImportToGradex = useCallback(({ surface: s, tc: tcVal }) => {
    if (s) setSurface(String(s));
    if (tcVal) setTc(String(tcVal));
  }, []);

  const pjData   = useMemo(() => parsePaste(pasteText), [pasteText]);
  const tcH      = parseFloat(tc) || 0;
  const bMont    = parseFloat(bMontana) || 0;
  const showMont = tcH > 0 && tcH < 24;
  const surfVal  = parseFloat(surface) || 0;
  const surfWarn = surfVal > 0 && surfVal < S_MIN;

  const res = useMemo(() => {
    const S = parseFloat(surface);
    if (!S || isNaN(S) || pjData.length < 3) return null;
    return computeGRADEX({
      data: pjData, S, Cp: parseFloat(cp)||1.4,
      T0: parseInt(tPivot)||10, Q0obs: parseFloat(qPivot)||0,
      tcH, bMontana: bMont
    });
  }, [pjData, surface, cp, tPivot, qPivot, tcH, bMont]);

  const fmtT = T => T>=10000?"10 000":T>=1000?"1 000":String(T);

  const TABS = [
    { id:"donnees",    icon:"database",   label:t('tabDonnees')    },
    { id:"tableau",    icon:"table",      label:t('tabTableau')    },
    { id:"gradex",     icon:"wave-sine",  label:t('tabGradex')     },
    { id:"graphiques", icon:"chart-line", label:t('tabGraphiques') },
    { id:"methodes",   icon:"stack-2",    label:t('tabMethodes')   },
    { id:"rapport",    icon:"file-text",  label:t('tabRapport')    },
  ];

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ fontFamily:"Arial,sans-serif", minHeight:"100vh", background:"#e8e8e8",
      display:"flex", flexDirection:"column", fontSize:12 }}>

      {/* ── BARRE TITRE ── */}
      <div style={{ background:"linear-gradient(180deg,#2a6cc0 0%,#1a4a8a 100%)",
        color:"#fff", display:"flex", alignItems:"center", height:40,
        borderBottom:"1px solid #0a3060", userSelect:"none" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8,
          padding:"0 14px", borderRight:"1px solid rgba(255,255,255,0.15)", height:"100%" }}>
          <i className="ti ti-droplet-filled" style={{ fontSize:20, color:"#a0d8ff" }} />
          <div>
            <div style={{ fontWeight:700, fontSize:14, letterSpacing:0.5 }}>GRADEX</div>
            <div style={{ fontSize:9, opacity:0.7 }}>{t('gxVersion')}</div>
          </div>
        </div>

        <div style={{ display:"flex", height:"100%", alignItems:"stretch" }}>
          <div style={{ position:"relative", height:"100%" }}>
            <button onClick={e=>{ e.stopPropagation(); setMenuFile(v=>!v); setMenuEdit(false); }}
              style={{ height:"100%", padding:"0 14px", background:menuFile?"rgba(255,255,255,0.18)":"transparent",
                border:"none", color:"#fff", cursor:"pointer", fontSize:13 }}
              onMouseEnter={e=>e.target.style.background="rgba(255,255,255,0.12)"}
              onMouseLeave={e=>{ if(!menuFile) e.target.style.background="transparent"; }}>
              {t('mFichier')}
            </button>
            {menuFile && (
              <div onClick={e=>e.stopPropagation()} style={{
                position:"absolute", top:"100%", left:0, background:"#f5f5f5",
                border:"1px solid #999", boxShadow:"2px 2px 8px rgba(0,0,0,0.2)",
                minWidth:220, zIndex:1000, padding:"2px 0", color:"#1a1a1a" }}>
                <MItem icon="file-plus" label={t('mNouveau')} shortcut="Ctrl+N"
                  onClick={()=>{ handleNew(); setMenuFile(false); }} />
                <MItem icon="folder-open" label={t('mOuvrir')} shortcut="Ctrl+O"
                  onClick={()=>{ handleOpen(); setMenuFile(false); }} />
                <div style={{ height:1, background:"#ccc", margin:"2px 6px" }} />
                <MItem icon="device-floppy" label={t('mEnregistrer')} shortcut="Ctrl+S"
                  onClick={()=>{ handleSave(); setMenuFile(false); }} />
                <MItem icon="device-floppy" label={t('mEnregistrerSous')}
                  onClick={()=>{ handleSaveAs(); setMenuFile(false); }} />
              </div>
            )}
          </div>

          <div style={{ position:"relative", height:"100%" }}>
            <button onClick={e=>{ e.stopPropagation(); setMenuEdit(v=>!v); setMenuFile(false); }}
              style={{ height:"100%", padding:"0 14px", background:menuEdit?"rgba(255,255,255,0.18)":"transparent",
                border:"none", color:"#fff", cursor:"pointer", fontSize:13 }}
              onMouseEnter={e=>e.target.style.background="rgba(255,255,255,0.12)"}
              onMouseLeave={e=>{ if(!menuEdit) e.target.style.background="transparent"; }}>
              {t('mEditer')}
            </button>
            {menuEdit && (
              <div onClick={e=>e.stopPropagation()} style={{
                position:"absolute", top:"100%", left:0, background:"#f5f5f5",
                border:"1px solid #999", boxShadow:"2px 2px 8px rgba(0,0,0,0.2)",
                minWidth:200, zIndex:1000, padding:"2px 0" }}>
                <MItem icon="copy"      label={t('mCopier')}    shortcut="Ctrl+C" onClick={()=>{ document.execCommand("copy"); setMenuEdit(false); }} />
                <MItem icon="scissors"  label={t('mCouper')}    shortcut="Ctrl+X" onClick={()=>{ document.execCommand("cut"); setMenuEdit(false); }} />
                <MItem icon="clipboard" label={t('mColler')}    shortcut="Ctrl+V"
                  onClick={async()=>{ try{ const t=await navigator.clipboard.readText(); if(tab==="donnees") setPasteText(p=>p+"\n"+t); }catch{} setMenuEdit(false); }} />
              </div>
            )}
          </div>
        </div>

        <div style={{ marginLeft:"auto", paddingRight:16, fontSize:12, opacity:0.8,
          display:"flex", alignItems:"center", gap:10 }}>
          <LangSwitch langue={langue} changerLangue={changerLangue} LANGUES={LANGUES} NOMS_LANGUES={NOMS_LANGUES} />
          {dirty && <span style={{ color:"#ffd060", fontSize:10 }}>{t('mNonSauvegarde')}</span>}
          <span>{currentFile || t('mSansTitre')}</span>
        </div>
      </div>

      {/* ── BARRE D'OUTILS ── */}
      <div style={{ background:"#f0f0f0", borderBottom:"1px solid #b0b0b0",
        padding:"2px 8px", display:"flex", alignItems:"center", gap:0 }}>
        <TBtn icon="file-plus"     label={t('tbNouveau')}    onClick={handleNew} />
        <TBtn icon="folder-open"   label={t('tbOuvrir')}     onClick={handleOpen} />
        <TBtn icon="device-floppy" label={t('tbSauvegarder')} onClick={handleSave} />
        <TSep />
        <TBtn icon="printer"       label={t('tbImprimer')}   onClick={()=>window.print()} />
        <TBtn icon="file-type-doc" label={t('tbWord')}       onClick={()=>{
          if (!res) return;
          setWordLoad(true);
          buildAndDownloadWord({ res, station, surface, tc, bMontana, cp, tPivot, mcResultats,
            onDone:()=>{ setWordLoad(false); showToast(t('gxToastRapportGenere')); } });
        }} disabled={!res||wordLoad} title="Exporter rapport Word avec graphiques" />
        <TSep />
        <TBtn icon="copy"      label={t('tbCopier')}  onClick={()=>document.execCommand("copy")} />
        <TBtn icon="scissors"  label={t('tbCouper')}  onClick={()=>document.execCommand("cut")} />
        <TBtn icon="clipboard" label={t('tbColler')}  onClick={async()=>{
          try{ const t=await navigator.clipboard.readText(); if(tab==="donnees") setPasteText(p=>p+"\n"+t); }catch{}
        }} />
        <div style={{ flex:1 }} />
        <span style={{ fontSize:11, color:"#555", paddingRight:8 }}>
          {pjData.length} {t('tbDonnees')}
          {res && <> &nbsp;|&nbsp; <span style={{ color:C_TEAL, fontWeight:600 }}>{t('tbGradexOk')}</span></>}
        </span>
      </div>

      {/* ── ONGLETS ── */}
      <div style={{ background:"#e0e8f0", borderBottom:"1px solid #a0a8b0",
        display:"flex", padding:"3px 10px 0", flexWrap:"wrap" }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={()=>setTab(tb.id)}
            style={{ padding:"5px 14px", background:tab===tb.id?"#fff":"transparent",
              border: tab===tb.id ? "1px solid #a0a8b0" : "1px solid transparent",
              borderBottom: tab===tb.id ? "1px solid #fff" : "1px solid transparent",
              marginRight:2, cursor:"pointer", fontSize:12, fontWeight:tab===tb.id?700:400,
              color:tab===tb.id?C_BLUE:"#333", borderRadius:"3px 3px 0 0",
              marginBottom: tab===tb.id ? -1 : 0,
              display:"flex", alignItems:"center", gap:5 }}>
            <i className={`ti ti-${tb.icon}`} style={{ fontSize:13 }} />{tb.label}
          </button>
        ))}
      </div>

      {/* ── CONTENU ── */}
      <div style={{ flex:1, overflow:"auto", background:"#fff", padding:"14px 18px" }}>

        {/* ═══ ONGLET DONNÉES ═══════════════════════════════════════ */}
        {tab === "donnees" && (
          <div style={{ display:"grid", gridTemplateColumns:"290px 1fr", gap:16 }}>

            <div>
              <Panel title={t('gxParamBv')} icon="settings">
                <Field label={t('gxStation')} value={station} onChange={setStation} placeholder="ex: Oued Ighi" />
                <Field label={`${t('gxSurfaceGx')} (km²)${surfWarn?" — ⚠ "+t('gxSurfaceWarn').replace('⚠ ',''):""}`} value={surface}
                  onChange={setSurface} type="number" placeholder="ex: 664.878" warning={surfWarn} />
                <Field label={`${t('gxTcH')}`} value={tc} onChange={setTc} type="number" placeholder={t('gxOptionnel')} />
                {showMont && (
                  <div style={{ background:"#fffce0", border:"1px solid #d0a020",
                    padding:"8px 10px", marginTop:2, marginBottom:6 }}>
                    <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#7a5000", marginBottom:3 }}>
                      {t('gxParamMontana').replace('{tc}', tc)}
                    </label>
                    <input type="number" step="0.01" min="0.1" max="1" value={bMontana}
                      onChange={e=>setBMontana(e.target.value)} placeholder="ex: 0.65"
                      style={{ width:"100%", boxSizing:"border-box", height:24,
                        border:"1px solid #c08020", fontSize:12, padding:"0 6px" }} />
                    <div style={{ fontSize:10, color:"#7a5000", marginTop:4, lineHeight:1.6 }}>
                      {t('gxConvMontana')}
                    </div>
                  </div>
                )}
                <Field label={t('gxCoeffPointe')} value={cp} onChange={setCp} type="number" placeholder="ex: 1.4" />
                <Field label={t('gxPeriodePivot')} value={tPivot} onChange={setTPivot} type="number" placeholder="10" />
                <div style={{ borderTop:`1px solid ${C_BORDER}`, paddingTop:8, marginTop:4 }}>
                  <Field label={t('gxDebitObserve')} value={qPivot}
                    onChange={setQPivot} type="number" placeholder={t('gxDebitVideCalcAuto')} />
                  <div style={{ fontSize:10, color:"#888", marginTop:2, lineHeight:1.5 }}>
                    {t('gxDebitHint')}
                  </div>
                </div>
              </Panel>

              {res && (
                <Panel title={t('gxParamGumbelCalc')} icon="check" accent={C_TEAL}>
                  {[[t('gxN'), res.n],[t('gxMoyenne'), f2(res.mean)+" mm"],[t('gxEcartType'), f2(res.std)+" mm"],
                    [t('gxGradexA'), f6(res.a)],[t('gxParamB'), f6(res.b)],
                    [t('gxConvFactor'), res.convFactor.toFixed(6)],[t('gxQ0Pivot'), f2(res.Q0)+" m³/s"],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between",
                      fontSize:11, borderBottom:`1px solid ${C_BORDER}`, padding:"3px 0" }}>
                      <span style={{ color:"#444" }}>{k}</span>
                      <span style={{ fontWeight:600, color:"#1a1a1a" }}>{v}</span>
                    </div>
                  ))}
                  {res.useMontana && (
                    <div style={{ marginTop:6, fontSize:10, color:C_TEAL, background:"#f0fff5",
                      padding:"4px 8px", border:`1px solid #a0d8b0` }}>
                      {t('gxMontanaActif').replace('{b}',bMontana).replace('{tc}',tc)}
                    </div>
                  )}
                </Panel>
              )}
            </div>

            <div>
              <Panel title={t('gxPjmaxTitre')}
                icon="cloud-rain"
                headerRight={
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <span style={{ fontSize:11, fontWeight:600,
                      color:pjData.length>=3?C_TEAL:"#999" }}>{pjData.length} {t('gxValeurs')}</span>
                    <button onClick={()=>setPasteText("")}
                      style={{ padding:"2px 8px", fontSize:11, background:"#fff",
                        border:`1px solid ${C_BORDER}`, cursor:"pointer", borderRadius:1 }}>
                      {t('gxEffacer')}
                    </button>
                  </div>
                }>

                <div style={{ background:"#e8f0f8", border:`1px solid #b0c8e0`,
                  padding:"7px 10px", fontSize:11, marginBottom:8, lineHeight:1.9 }}>
                  <b>{t('gxFormatsAcceptes')}</b>&nbsp;
                  <code>1990/1991[Tab]43.5</code> &nbsp;|&nbsp;
                  <code>43.5</code> &nbsp;|&nbsp;
                  <code>1990;43.5</code>
                </div>

                <CollapseSection title={t('gxImportEra5')}
                  icon="cloud-download" open={showNasa} onToggle={()=>setShowNasa(v=>!v)} accent="#0060a0">
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                    <div>
                      <label style={{ fontSize:11, display:"block", marginBottom:2 }}>{t('gxLatitude')}</label>
                      <input type="number" step="0.0001" value={nasaLat}
                        onChange={e=>setNasaLat(e.target.value)} placeholder="ex: 31.21"
                        style={{ width:"100%", boxSizing:"border-box", height:24, border:`1px solid ${C_BORDER}`, fontSize:12, padding:"0 6px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize:11, display:"block", marginBottom:2 }}>{t('gxLongitude')}</label>
                      <input type="number" step="0.0001" value={nasaLon}
                        onChange={e=>setNasaLon(e.target.value)} placeholder="ex: -8.21"
                        style={{ width:"100%", boxSizing:"border-box", height:24, border:`1px solid ${C_BORDER}`, fontSize:12, padding:"0 6px" }} />
                    </div>
                  </div>
                  <button onClick={handleNasa} disabled={nasaLoad||!nasaLat||!nasaLon}
                    style={{ padding:"4px 14px", background:(nasaLoad||!nasaLat||!nasaLon)?"#aaa":C_BLUE,
                      color:"#fff", border:"none", cursor:(nasaLoad||!nasaLat||!nasaLon)?"not-allowed":"pointer",
                      fontSize:12, borderRadius:1 }}>
                    {nasaLoad ? t('gxChargement') : t('gxTelecharger')}
                  </button>
                  {nasaMsg && (
                    <div style={{ marginTop:8, padding:"6px 10px", fontSize:11, borderRadius:1,
                      background:nasaErr?"#fff0f0":"#f0fff5",
                      border:`1px solid ${nasaErr?"#f5a0a0":"#80d0a0"}`,
                      color:nasaErr?"#900":"#0a5030" }}>
                      {nasaMsg}
                    </div>
                  )}
                </CollapseSection>

                <CollapseSection title={`${t('gxCalculerTcTitre')} (${10} ${t('p3Methodes')})`}
                  icon="clock-hour-4" open={showTC} onToggle={()=>setShowTC(v=>!v)} accent={C_TEAL}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6, marginBottom:8 }}>
                    {[
                      [t('gxLThalweg'), tcL, setTcL, "ex: 23.619"],
                      [t('gxDhDenivelee'), tcDH, setTcDH, "ex: 2057"],
                      [t('gxHmaxSommet'), tcHmoy, setTcHmoy, t('gxGiandottiVentura')],
                      [t('gxHminExutoire'), tcH0, setTcH0, t('gxGiandottiVentura')],
                    ].map(([lbl,val,setter,ph]) => (
                      <div key={lbl}>
                        <label style={{ fontSize:10, display:"block", marginBottom:2, color:"#444" }}>{lbl}</label>
                        <input type="number" step="any" value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
                          style={{ width:"100%", boxSizing:"border-box", height:22, border:`1px solid ${C_BORDER}`, fontSize:11, padding:"0 4px" }} />
                      </div>
                    ))}
                  </div>
                  <button onClick={handleComputeTC} disabled={!tcL||!tcDH}
                    style={{ padding:"4px 14px", background:(!tcL||!tcDH)?"#aaa":C_TEAL,
                      color:"#fff", border:"none", borderRadius:1, fontSize:12,
                      cursor:(!tcL||!tcDH)?"not-allowed":"pointer" }}>
                    {t('gxCalculer')}
                  </button>
                  {tcResults.length > 0 && (
                    <div style={{ marginTop:10, overflowX:"auto" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C_TEAL, marginBottom:4 }}>
                        {t('gxResultatsCliquez')}
                      </div>
                      <p style={{ fontSize:10, color:"#888", marginBottom:6, lineHeight:1.6 }}>{t('gxTcAjouteBvCalc')}</p>
                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                        <thead>
                          <tr style={{ background:C_HEADER }}>
                            {[t('gxColFormule'),t('gxColTcH'),t('gxColTcMin'),t('gxColFormuleDetail'),t('gxColUtiliser')].map(h =>
                              <th key={h} style={{ ...TH, padding:"4px 6px" }}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {tcResults.map((r,i) => {
                            const sel  = tcSel?.name === r.name;
                            const isMoy = tcResults._closestName === r.name;
                            const isBv = r.source === "bvcalc";
                            return (
                              <tr key={r.name} onClick={()=>{ setTcSel(r); setTc(String(r.tc_h)); }}
                                style={{ background:sel?"#c8ecd8":(isMoy?"#f0fff4":isBv?"#f5f8ff":(i%2===0?"#fff":"#f8f8f8")),
                                  cursor:"pointer", borderLeft:isMoy?`3px solid ${C_TEAL}`:isBv?`3px solid ${C_BLUE}`:"3px solid transparent" }}>
                                <td style={{ ...TD, fontWeight:sel?700:400, textAlign:"left", paddingLeft:8 }}>
                                  {sel?"✓ ":isMoy?"→ ":""}{r.name}
                                </td>
                                <td style={{ ...TD, fontWeight:600, color:sel?C_TEAL:"#1a1a1a" }}>{r.tc_h.toFixed(4)}</td>
                                <td style={{ ...TD, color:"#555" }}>{r.tc_min.toFixed(1)}</td>
                                <td style={{ ...TD, fontSize:10, color:"#666", fontFamily:"monospace", textAlign:"left" }}>{r.formule}</td>
                                <td style={{ ...TD }}>
                                  <button onClick={e=>{ e.stopPropagation(); setTcSel(r); setTc(String(r.tc_h)); }}
                                    style={{ padding:"1px 8px", fontSize:10, background:sel?C_TEAL:"#fff",
                                      color:sel?"#fff":C_TEAL, border:`1px solid ${C_TEAL}`, cursor:"pointer", borderRadius:1 }}>
                                    {sel?`✓ ${t('gxColUtiliser')}`:t('gxColUtiliser')}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {tcResults._moyenne != null && (
                            <tr style={{ background:"#deeeff", borderTop:`2px solid #7aaccc`, cursor:"pointer" }}
                              onClick={()=>{ setTc(String(tcResults._moyenne)); showToast(t('gxToastTcMoyenneUtilise')); }}>
                              <td style={{ ...TD, fontWeight:700, color:"#1a4a80", textAlign:"left", paddingLeft:8, borderLeft:"3px solid #2060a0" }}>
                                {t('gxMoyenneDesTc')}
                              </td>
                              <td style={{ ...TD, fontWeight:700, color:"#1a4a80" }}>{(tcResults._moyenne).toFixed(4)}</td>
                              <td style={{ ...TD, fontWeight:600, color:"#1a4a80" }}>{(tcResults._moyenne*60).toFixed(1)}</td>
                              <td style={{ ...TD, fontSize:10, color:"#444" }}>
                                Σ(TC) / {tcResults.length} &nbsp;|&nbsp;
                                <span style={{color:C_TEAL, fontWeight:600}}>{t('gxPlusProche')} {tcResults._closestName}</span>
                              </td>
                              <td style={{ ...TD }}>
                                <button onClick={e=>{ e.stopPropagation(); setTc(String(tcResults._moyenne)); showToast(t('gxToastTcMoyenneUtilise')); }}
                                  style={{ padding:"1px 8px", fontSize:10, background:"#2060a0",
                                    color:"#fff", border:"1px solid #2060a0", cursor:"pointer", borderRadius:1 }}>
                                  {t('gxColUtiliser')}
                                </button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      {tcSel && (
                        <div style={{ marginTop:6, fontSize:11, color:C_TEAL, background:"#e8f8ee",
                          padding:"5px 10px", border:`1px solid #a0d8b0` }}>
                          {t('gxTcRetenu')} <b>{tcSel.tc_h.toFixed(4)} h</b> ({(tcSel.tc_h*60).toFixed(1)} min) — {tcSel.name}
                        </div>
                      )}
                    </div>
                  )}
                </CollapseSection>

                <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)}
                  placeholder={t('gxCollezDonnees')+"\n\n1990/1991\t43.5\n1991/1992\t38.2\n…"}
                  style={{ width:"100%", boxSizing:"border-box", height:200, fontSize:12,
                    fontFamily:"'Courier New',monospace", resize:"vertical",
                    border:`1px solid ${C_BORDER}`, padding:"8px 10px",
                    background:"#fafafa", lineHeight:1.7 }} />

                {pjData.length > 0 && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C_TEAL, marginBottom:4 }}>
                      {t('gxApercu')} {pjData.length} {t('gxValeursDetectees')}
                      {pjData.length < 3 && <span style={{ color:C_RED, fontWeight:400 }}> {t('gxMin3Requis')}</span>}
                    </div>
                    <div style={{ maxHeight:180, overflowY:"auto", border:`1px solid ${C_BORDER}` }}>
                      <table style={{ width:"100%", borderCollapse:"collapse" }}>
                        <thead>
                          <tr>
                            {[t('gxNum'),t('gxAnnee'),t('gxPjmax24h')].map(h =>
                              <th key={h} style={{ ...TH, position:"sticky", top:0 }}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {pjData.map((row,i) => (
                            <tr key={i} style={{ background:i%2===0?"#fff":C_STRIP }}>
                              <td style={{ ...TD, color:"#999", width:40 }}>{i+1}</td>
                              <td style={{ ...TD, textAlign:"left", paddingLeft:10 }}>{row.y}</td>
                              <td style={{ ...TD, fontWeight:600, color:C_BLUE }}>{row.v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          </div>
        )}

        {/* ═══ ONGLET TABLEAU GUMBEL ════════════════════════════════ */}
        {tab === "tableau" && (
          !res ? <NoData title={t('gxDonneesInsuffisantes')} hint={t('gxDonneesInsuffisantesHint')} /> : (
            <>
              {surfWarn && <SurfWarn t={t} />}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                {[[t('gxNDonnees'),res.n,null],[t('gxMoyenne'),f2(res.mean)+" mm",null],
                  [t('gxEcartType'),f2(res.std)+" mm",null],[t('gxGradexA'),f6(res.a),C_TEAL],
                  [t('gxParamB'),f6(res.b),null],[t('gxQ0Pivot'),f2(res.Q0)+" m³/s",C_AMBER],
                ].map(([k,v,c]) => (
                  <div key={k} style={{ background:C_HEADER, border:`1px solid ${C_BORDER}`,
                    padding:"4px 10px", minWidth:100 }}>
                    <div style={{ fontSize:10, color:"#666" }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:c||"#1a1a1a" }}>{v}</div>
                  </div>
                ))}
              </div>
              {res.useMontana && <MontBanner res={res} tc={tc} bMontana={bMontana} t={t} />}
              <Panel title={`${t('gxTableauAjustement')} ${station} (n=${res.n})`} icon="table" noPad>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr>
                      {[t('gxRang'),t('gxAnnee'),t('gxPjmax24h'),t('gxFreqHazen'),
                        t('gxVarReduite'),t('gxPjmaxEstimee')].map(h =>
                        <th key={h} style={TH}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {res.rowsFull.map((r,i) => (
                      <tr key={i} style={{ background:i%2===0?"#fff":C_STRIP }}>
                        <td style={TD}>{r.rank}</td>
                        <td style={{ ...TD, textAlign:"left", paddingLeft:10 }}>{r.year}</td>
                        <td style={{ ...TD, fontWeight:600, color:C_BLUE }}>{r.pj.toFixed(1)}</td>
                        <td style={TD}>{r.F.toFixed(6)}</td>
                        <td style={TD}>{r.u.toFixed(6)}</td>
                        <td style={{ ...TD, color:C_TEAL }}>{r.pEst.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </>
          )
        )}

        {/* ═══ ONGLET GRADEX ════════════════════════════════════════ */}
        {tab === "gradex" && (
          !res ? <NoData title={t('gxDonneesInsuffisantes')} hint={t('gxDonneesInsuffisantesHint')} /> : (
            <>
              {surfWarn && <SurfWarn t={t} />}
              {res.useMontana && <MontBanner res={res} tc={tc} bMontana={bMontana} t={t} />}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                <Panel title={t('gxParamGradex')} icon="math-symbols">
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <tbody>
                      {[["GRADEX a = σ√6/π",f6(res.a)+" mm"],[t('gxParamB'),f6(res.b)+" mm"],
                        [t('gxPT0Gumbel'),f2(res.P0g)+" mm"],[t('gxP0Pivot'),f2(res.P0)+" mm"],
                        [t('gxConvFactor'),res.convFactor.toFixed(6)],[t('gxQ0Pivot'),f2(res.Q0)+" m³/s"],
                        [t('gxSurfaceS'),surfVal.toFixed(3)+" km²"],[t('gxCoeffPointe'),cp],
                        [t('gxTcH'),tc?tc+" h":"—"],
                        ...(res.useMontana?[["b Montana",bMontana]]:[]),
                      ].map(([k,v]) => (
                        <tr key={k} style={{ borderBottom:`1px solid ${C_BORDER}` }}>
                          <td style={{ padding:"4px 6px", color:"#555", fontSize:11 }}>{k}</td>
                          <td style={{ padding:"4px 6px", fontWeight:600, textAlign:"right" }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
                <Panel title={t('gxFormulesAppliquees')} icon="math">
                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:11, lineHeight:2.2,
                    background:"#f5f8ff", border:`1px solid ${C_BORDER}`, padding:"10px 12px" }}>
                    <div><b>u(T)</b> = −ln(−ln(1−1/T))</div>
                    <div><b>P(T)</b> = a × u(T) + b_Gumbel</div>
                    <div><b>Q(T)</b> = Q₀ + a × [u(T)−u(T₀)] × conv</div>
                    <div><b>Qp(T)</b> = Cp × Q(T)</div>
                    <div><b>conv</b> = {res.useMontana
                      ? `(TC/24)^(1−b) × 1000×S/(TC×3600)`
                      : `1000 × S / 86400`}</div>
                  </div>
                </Panel>
              </div>
              <Panel title={`${t('gxDebitsExtrapoles')} ${station}`} icon="wave-sine" accent={C_TEAL} noPad>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr>
                      {[t('gxTAns'),t('gxFreqF'),t('gxVarU'),t('gxPExtrap'),
                        t('gxQMoyen'),t('gxQPointe')].map(h =>
                        <th key={h} style={{ ...TH, background:"#d0e8d8", color:"#0a4030" }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {res.extrap.map((e,i) => {
                      const big = e.T >= 1000;
                      return (
                        <tr key={i} style={{ background:big?"#fffce8":(i%2===0?"#fff":C_STRIP) }}>
                          <td style={{ ...TD, fontWeight:700, color:big?C_AMBER:C_TEAL }}>{fmtT(e.T)}</td>
                          <td style={TD}>{e.F.toFixed(6)}</td>
                          <td style={TD}>{e.u.toFixed(6)}</td>
                          <td style={TD}>{e.P.toFixed(3)}</td>
                          <td style={TD}>{e.Qm.toFixed(3)}</td>
                          <td style={{ ...TD, fontWeight:700, color:big?C_AMBER:"#085030",
                            background:big?"#fff0c0":"#e8f8ee" }}>{e.Qp.toFixed(3)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            </>
          )
        )}

        {/* ═══ ONGLET GRAPHIQUES ════════════════════════════════════ */}
        {tab === "graphiques" && (
          !res ? <NoData title={t('gxDonneesInsuffisantes')} hint={t('gxDonneesInsuffisantesHint')} /> : (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {surfWarn && <SurfWarn t={t} />}

              <ChartBox
                title={t('gxAjustGumbelTitre')}
                subtitle={`${station} | a = ${f3(res.a)} mm | µ = ${f2(res.mean)} mm | n = ${res.n}`}
                copyLabel={t('gxCopierImage')} downloadLabel={t('gxTelechargerPng')}
                onCopy={()=>res && copyChartCanvas(makeGumbelCanvas(res,station), showToast)}
                onDownload={()=>res && downloadChartCanvas(makeGumbelCanvas(res,station), `Gumbel_${station}.png`, showToast)}>
                <div ref={gumbelRef} style={{ background:"#fff" }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={res.gumbelChart} margin={{ top:10,right:20,bottom:40,left:60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="u" type="number" domain={["auto","auto"]}
                        label={{ value:t('gxVarReduiteGumbel'), position:"insideBottom", offset:-20, fontSize:12 }}
                        tickFormatter={v=>v.toFixed(1)} tick={{ fontSize:11 }} />
                      <YAxis
                        label={{ value:"Pjmax (mm/24h)", angle:-90, position:"insideLeft", offset:-10, fontSize:12 }}
                        tick={{ fontSize:11 }} />
                      <Tooltip formatter={(v,n)=>[v.toFixed(2)+" mm", n==="pObs"?t('gxObserve'):t('gxGumbelAjuste')]}
                        labelFormatter={v=>`u = ${parseFloat(v).toFixed(3)}`} />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize:12 }} />
                      <Line name={t('gxDroiteGumbel')} dataKey="pEst" stroke={C_RED} dot={false} strokeWidth={2} type="linear" />
                      <Scatter name={t('gxPjmaxObservees')} dataKey="pObs" fill={C_BLUE} opacity={0.8} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>

              <ChartBox
                title={`${t('gxDebitsCrueTitre')} ${station}`}
                subtitle={`Cp=${cp} | S=${surface} km² | T₀=${tPivot} ans${res.useMontana?` | TC=${tc}h, b=${bMontana}`:""}`}
                copyLabel={t('gxCopierImage')} downloadLabel={t('gxTelechargerPng')}
                onCopy={()=>res && copyChartCanvas(makeDischargeCanvas(res,station,cp), showToast)}
                onDownload={()=>res && downloadChartCanvas(makeDischargeCanvas(res,station,cp), `Debits_${station}.png`, showToast)}>
                <div ref={dischargeRef} style={{ background:"#fff" }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={res.extrap} margin={{ top:10,right:20,bottom:40,left:70 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="T"
                        label={{ value:t('gxPeriodeRetourT'), position:"insideBottom", offset:-20, fontSize:12 }}
                        tickFormatter={v=>v>=10000?"10k":v>=1000?"1k":String(v)} tick={{ fontSize:11 }} />
                      <YAxis
                        label={{ value:t('gxDebitQ'), angle:-90, position:"insideLeft", offset:-10, fontSize:12 }}
                        tick={{ fontSize:11 }} />
                      <Tooltip formatter={(v,n)=>[`${v.toFixed(1)} m³/s`,n]}
                        labelFormatter={v=>`T = ${fmtT(v)} ans`} />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize:12 }} />
                      <Line name={t('gxQMoyen')}     dataKey="Qm" stroke={C_TEAL}  strokeWidth={2} dot={{ r:4 }} type="monotone" />
                      <Line name={t('gxQPointe')} dataKey="Qp" stroke={C_AMBER} strokeWidth={2} dot={{ r:4 }} strokeDasharray="5 3" type="monotone" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
            </div>
          )
        )}

        {/* ═══ ONGLET MÉTHODES COMPLÉMENTAIRES (BV-Calc) ═══════════ */}
        {tab === "methodes" && (
          <MethodesTab v={mc} setV={setMc} showToast={showToast} onImportToGradex={handleImportToGradex}
            onResultatsChange={setMcResultats} surfaceGradex={surface} />
        )}

        {/* ═══ ONGLET RAPPORT ══════════════════════════════════════ */}
        {tab === "rapport" && (
          !res ? <NoData title={t('gxDonneesInsuffisantes')} hint={t('gxDonneesInsuffisantesHint')} /> : (
            <div>
              <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
                <button onClick={()=>window.print()}
                  style={{ padding:"5px 16px", background:C_BLUE, color:"#fff",
                    border:"none", borderRadius:1, cursor:"pointer", fontSize:12,
                    display:"flex", alignItems:"center", gap:6 }}>
                  <i className="ti ti-printer" style={{ fontSize:14 }} />{t('gxImprimerPdf')}
                </button>
                <button onClick={()=>{
                  if(!res) return;
                  setWordLoad(true);
                  buildAndDownloadWord({ res, station, surface, tc, bMontana, cp, tPivot, mcResultats,
                    onDone:()=>{ setWordLoad(false); showToast(t('gxToastRapportGenere')); } });
                }} disabled={wordLoad||!res}
                  style={{ padding:"5px 16px", background:wordLoad?"#aaa":C_TEAL, color:"#fff",
                    border:"none", borderRadius:1, cursor:wordLoad?"not-allowed":"pointer", fontSize:12,
                    display:"flex", alignItems:"center", gap:6 }}>
                  <i className="ti ti-file-type-doc" style={{ fontSize:14 }} />
                  {wordLoad?t('gxGenerationEnCours'):t('gxTelechargerWord')}
                </button>
                <div style={{ fontSize:11, color:"#888", padding:"5px 0", marginLeft:8 }}>
                  {t('gxGraphiquesInclus')}
                </div>
              </div>
              {surfWarn && <SurfWarn t={t} />}
              <div style={{ background:"#fff", border:`1px solid ${C_BORDER}`, padding:"32px 44px",
                maxWidth:820, boxShadow:"1px 1px 5px rgba(0,0,0,0.1)" }}>
                <div style={{ textAlign:"center", borderBottom:`2px solid ${C_BLUE}`, paddingBottom:14, marginBottom:22 }}>
                  <div style={{ fontSize:20, fontWeight:700, color:C_BLUE }}>{t('gxRapportTitre')}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C_TEAL, marginTop:4 }}>
                    {t('gxRapportSousTitre')}
                  </div>
                  <div style={{ fontSize:12, color:"#555", marginTop:8 }}>
                    {t('gxRapportStation')} <b>{station}</b> &nbsp;|&nbsp; S = {surface} km² &nbsp;|&nbsp; {new Date().toLocaleDateString("fr-FR")}
                  </div>
                </div>

                <RS n="1" title={t('gxS1Parametres')}>
                  <table style={{ width:"60%", borderCollapse:"collapse", fontSize:12 }}>
                    <tbody>
                      {[["n",res.n],["µ",f2(res.mean)+" mm"],["σ",f2(res.std)+" mm"],
                        ["GRADEX a",f6(res.a)],["b Gumbel",f6(res.b)],
                        ["Q₀",f2(res.Q0)+" m³/s"],["Conv.",res.convFactor.toFixed(6)],
                      ].map(([k,v]) => (
                        <tr key={k} style={{ borderBottom:`1px solid ${C_BORDER}` }}>
                          <td style={{ padding:"3px 8px", color:"#555" }}>{k}</td>
                          <td style={{ padding:"3px 8px", fontWeight:600 }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </RS>

                <RS n="2" title={t('gxS2DebitsExtrap')}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr style={{ background:"#e0e8d0" }}>
                        {[t('gxTAns'),"F","u","P extrap (mm)",t('gxQMoyen'),t('gxQPointe')].map(h =>
                          <th key={h} style={{ ...TH, background:"#d0e8d0", color:"#0a4030" }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {res.extrap.map((e,i) => {
                        const big = e.T >= 1000;
                        return (
                          <tr key={i} style={{ background:big?"#fffce8":(i%2===0?"#fff":C_STRIP),
                            borderBottom:`1px solid ${C_BORDER}` }}>
                            <td style={{ ...TD, fontWeight:700, color:big?C_AMBER:C_TEAL }}>{fmtT(e.T)}</td>
                            <td style={TD}>{e.F.toFixed(6)}</td>
                            <td style={TD}>{e.u.toFixed(6)}</td>
                            <td style={TD}>{e.P.toFixed(3)}</td>
                            <td style={TD}>{e.Qm.toFixed(3)}</td>
                            <td style={{ ...TD, fontWeight:700, color:big?C_AMBER:"#085030" }}>{e.Qp.toFixed(3)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </RS>

                <RS n="3" title={t('gxS3Conclusions')}>
                  <p style={{ fontSize:12, lineHeight:1.9, textAlign:"justify" }}>
                    {t('gxConclusionIntro')} <b>{res.n}</b> Pjmax {t('gxConclusionPjmax')} <b>{station}</b>
                    &nbsp;(µ={f2(res.mean)} mm, σ={f2(res.std)} mm) {t('gxConclusionDonne')} <b>{f3(res.a)} mm</b>.
                    {res.useMontana && ` Correction Montana : TC=${tc}h, b=${bMontana}.`}
                    {" "}{t('gxConclusionAncre')} Q(T₀={tPivot} ans) = <b>{f2(res.Q0)} m³/s</b> :
                  </p>
                  <ul style={{ fontSize:12, lineHeight:2.2, paddingLeft:20 }}>
                    {res.extrap.map(e => (
                      <li key={e.T}>
                        Qp(T={fmtT(e.T)} ans) = <b style={{ color:e.T>=1000?C_AMBER:C_TEAL }}>{e.Qp.toFixed(1)} m³/s</b>
                      </li>
                    ))}
                  </ul>
                </RS>

                {mcResultats.filter(r=>!r.erreur).length > 0 && (
                  <RS n="4" title={t('gxS4MethodesComp')}>
                    <table style={{ width:"70%", borderCollapse:"collapse", fontSize:12 }}>
                      <thead>
                        <tr style={{ background:"#e8f0f8" }}>
                          {[t('p3ColMethode'),t('p3ColQp'),t('p3ColT')].map(h =>
                            <th key={h} style={{ ...TH, background:"#d8e8f8" }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {mcResultats.filter(r=>!r.erreur).map((r,i) => (
                          <tr key={r.id} style={{ background:i%2===0?"#fff":C_STRIP }}>
                            <td style={{ ...TD, textAlign:"left", paddingLeft:8 }}>{r.methode}</td>
                            <td style={{ ...TD, fontWeight:700, color:C_TEAL }}>{r.q_m3s.toFixed(3)}</td>
                            <td style={TD}>{r.T}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </RS>
                )}

                <div style={{ borderTop:`1px solid ${C_BORDER}`, paddingTop:8, marginTop:20,
                  fontSize:10, color:"#aaa", textAlign:"center" }}>
                  {t('gxFooterMethode')} — {new Date().toLocaleString("fr-FR")}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* ── BARRE DE STATUT ── */}
      <div style={{ background:C_HEADER, borderTop:`1px solid ${C_BORDER}`,
        padding:"2px 12px", fontSize:11, color:"#444",
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span>{t('gxStatutMethode')}</span>
        <div style={{ display:"flex", gap:16 }}>
          {res && <span style={{ color:C_TEAL, fontWeight:600 }}>{t('gxCalculOk')}</span>}
          <span>{pjData.length} {t('tbDonnees')}</span>
          {surfVal > 0 && <span>S = {surface} km²</span>}
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position:"fixed", bottom:20, right:20, background:"#1a2a3a",
          color:"#fff", padding:"8px 18px", fontSize:12,
          boxShadow:"2px 2px 8px rgba(0,0,0,0.3)", zIndex:9999, border:"1px solid #4a6a9a" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Composants utilitaires spécifiques GRADEX ────────────────
function SurfWarn({ t }) {
  return (
    <div style={{ background:"#fff8e0", border:`1px solid #d0a020`, padding:"7px 12px",
      fontSize:11, marginBottom:10, display:"flex", gap:8, alignItems:"center" }}>
      <i className="ti ti-alert-triangle" style={{ fontSize:15, color:"#a06000" }} />
      <b>{t('gxSurfaceInf100')}</b> — {t('gxSurfaceInf100Hint')}
    </div>
  );
}

function MontBanner({ res, tc, bMontana, t }) {
  return (
    <div style={{ background:"#f0fff5", border:`1px solid #80c090`, padding:"7px 12px",
      fontSize:11, marginBottom:10, display:"flex", gap:8, alignItems:"center" }}>
      <i className="ti ti-calculator" style={{ fontSize:15, color:C_TEAL }} />
      <span><b>{t('gxCorrectionMontana')}</b> — TC = {tc} h, b = {bMontana}
        &nbsp;|&nbsp; {t('gxFacteur')} {res.convFactor.toFixed(6)}</span>
    </div>
  );
}

function RS({ n, title, children }) {
  return (
    <section style={{ marginBottom:22 }}>
      <h2 style={{ fontSize:13, fontWeight:700, color:C_BLUE,
        borderLeft:`4px solid ${C_BLUE}`, paddingLeft:8, marginBottom:10 }}>
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

// ─── Export avec LicenceGate ─────────────────────────────────
export default function App() {
  return <LicenceGate><MainApp /></LicenceGate>;
}

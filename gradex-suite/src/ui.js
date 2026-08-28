// ============================================================
//  ui.js — Primitives visuelles partagées de l'habillage GRADEX
//  (barre de titre / menus / barre d'outils / onglets / panneaux
//  façon HEC-HMS-Word). Extrait tel quel de l'App.js original de
//  GRADEX pour que TOUT nouvel onglet (méthodes BV-Calc incluses)
//  utilise exactement le même langage visuel — c'est ce qui fait
//  que l'application fusionnée "ressemble à GRADEX".
// ============================================================
export const f2 = v => (typeof v === 'number' ? v.toFixed(2) : String(v));
export const f3 = v => (typeof v === 'number' ? v.toFixed(3) : String(v));
export const f4 = v => (typeof v === 'number' ? v.toFixed(4) : String(v));
export const f6 = v => (typeof v === 'number' ? v.toFixed(6) : String(v));

export const C_BLUE   = '#2060a0';
export const C_TEAL   = '#0a6045';
export const C_AMBER  = '#8B5000';
export const C_RED    = '#8B1a1a';
export const C_BORDER = '#bbbec5';
export const C_HEADER = '#f0f0f0';
export const C_STRIP  = '#f8f8f8';

// Style cellules tableau — comme Excel/HEC-HMS
export const TH = {
  padding: '5px 8px', textAlign: 'center', fontWeight: 600, fontSize: 11,
  color: '#1a1a1a', borderBottom: '2px solid #a0a0a0', borderRight: '1px solid #c0c0c0',
  background: C_HEADER, whiteSpace: 'nowrap'
};
export const TD = {
  padding: '3px 8px', textAlign: 'center', fontSize: 11,
  color: '#1a1a1a', borderBottom: '1px solid #d5d5d5', borderRight: '1px solid #d5d5d5'
};

// ─── Bouton barre d'outils ────────────────────────────────────
export function TBtn({ icon, label, onClick, disabled, title, onMouseDown }) {
  return (
    <button onClick={onClick} onMouseDown={onMouseDown} disabled={disabled} title={title || label}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1,
        padding:'4px 10px', background:'transparent', border:'none',
        cursor:disabled?'not-allowed':'pointer', borderRadius:2, opacity:disabled?0.4:1,
        minWidth:44 }}
      onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.background='#e0e8f0'; }}
      onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; }}>
      <i className={`ti ti-${icon}`} style={{ fontSize:18, color:disabled?'#aaa':C_BLUE }} />
      <span style={{ fontSize:9, color:disabled?'#bbb':'#444', whiteSpace:'nowrap' }}>{label}</span>
    </button>
  );
}

export function TSep() {
  return <div style={{ width:1, height:36, background:C_BORDER, margin:'0 3px' }} />;
}

// ─── Composant Field ─────────────────────────────────────────
export function Field({ label, value, onChange, type, placeholder, warning, unite }) {
  return (
    <div style={{ marginBottom:6 }}>
      <label style={{ display:'block', fontSize:11, color:warning?'#a05000':'#333', marginBottom:2, fontWeight:500 }}>
        {label}{unite ? <span style={{ color:'#888', fontWeight:400 }}> ({unite})</span> : null}
      </label>
      <input type={type||'text'} value={value}
        onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', boxSizing:'border-box', height:24, padding:'0 6px',
          border:`1px solid ${warning?'#c08020':C_BORDER}`, borderRadius:1,
          fontSize:12, background:'#fff', fontFamily:'Arial,sans-serif' }} />
    </div>
  );
}

export function Select({ label, value, onChange, options, unite }) {
  return (
    <div style={{ marginBottom:6 }}>
      <label style={{ display:'block', fontSize:11, color:'#333', marginBottom:2, fontWeight:500 }}>
        {label}{unite ? <span style={{ color:'#888', fontWeight:400 }}> ({unite})</span> : null}
      </label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        title={options.find(o => String(o.value) === String(value))?.label}
        style={{ width:'100%', boxSizing:'border-box', height:24, padding:'0 4px',
          border:`1px solid ${C_BORDER}`, borderRadius:1, fontSize:12, background:'#fff',
          fontFamily:'Arial,sans-serif', textOverflow:'ellipsis' }}>
        {options.map(o => <option key={o.value} value={o.value} title={o.label}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Section pliable ──────────────────────────────────────────
export function CollapseSection({ title, icon, open, onToggle, children, accent }) {
  return (
    <div style={{ border:`1px solid ${C_BORDER}`, marginBottom:6 }}>
      <button onClick={onToggle}
        style={{ width:'100%', background:open?C_HEADER:'#f5f5f5', border:'none',
          cursor:'pointer', padding:'5px 10px', display:'flex', justifyContent:'space-between',
          alignItems:'center', borderBottom: open?`1px solid ${C_BORDER}`:'none' }}>
        <span style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, fontWeight:600, color:accent||C_BLUE }}>
          <i className={`ti ti-${icon}`} style={{ fontSize:14 }} />{title}
        </span>
        <i className={`ti ti-chevron-${open?'up':'down'}`} style={{ fontSize:12, color:'#666' }} />
      </button>
      {open && <div style={{ padding:'10px 12px' }}>{children}</div>}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────
export function Panel({ title, icon, children, headerRight, accent, noPad }) {
  return (
    <div style={{ border:`1px solid ${C_BORDER}`, marginBottom:12, background:'#fff' }}>
      <div style={{ background:C_HEADER, borderBottom:`1px solid ${C_BORDER}`,
        padding:'5px 10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:12, fontWeight:700, color:accent||C_BLUE,
          display:'flex', alignItems:'center', gap:7 }}>
          <i className={`ti ti-${icon}`} style={{ fontSize:14 }} />{title}
        </span>
        {headerRight}
      </div>
      <div style={{ padding:noPad?0:12 }}>{children}</div>
    </div>
  );
}

export function MItem({ icon, label, shortcut, onClick, onMouseDown }) {
  return (
    <div onClick={onClick} onMouseDown={onMouseDown}
      style={{ padding:'5px 14px', fontSize:12, cursor:'pointer',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}
      onMouseEnter={e=>e.currentTarget.style.background='#dce8f8'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <span style={{ display:'flex', alignItems:'center', gap:8 }}>
        <i className={`ti ti-${icon}`} style={{ fontSize:14, color:'#555' }} />{label}
      </span>
      {shortcut && <span style={{ fontSize:10, color:'#999' }}>{shortcut}</span>}
    </div>
  );
}

export function ChartBox({ title, subtitle, onCopy, onDownload, children, copyLabel, downloadLabel }) {
  return (
    <div style={{ border:`1px solid ${C_BORDER}`, background:'#fff' }}>
      <div style={{ background:C_HEADER, borderBottom:`1px solid ${C_BORDER}`,
        padding:'5px 10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:12, color:C_BLUE }}>{title}</div>
          <div style={{ fontSize:10, color:'#666', marginTop:1 }}>{subtitle}</div>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {[['copy',copyLabel||'Copier image',onCopy],['download',downloadLabel||'Télécharger PNG',onDownload]].map(([ic,lb,fn])=>(
            <button key={ic} onClick={fn}
              style={{ padding:'3px 10px', fontSize:11, background:'#fff',
                border:`1px solid ${C_BORDER}`, cursor:'pointer',
                display:'flex', alignItems:'center', gap:4 }}
              onMouseEnter={e=>e.currentTarget.style.background='#e0e8f0'}
              onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
              <i className={`ti ti-${ic}`} style={{ fontSize:12 }} />{lb}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding:10 }}>{children}</div>
    </div>
  );
}

export function NoData({ title, hint }) {
  return (
    <div style={{ textAlign:'center', padding:60, color:'#888' }}>
      <i className="ti ti-database-off" style={{ fontSize:48, display:'block', marginBottom:12, color:'#ccc' }} />
      <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:12 }}>{hint}</div>
    </div>
  );
}

export function Alert({ tone, children, icon }) {
  const tones = {
    warn:  { bg:'#fff8e0', border:'#d0a020', color:'#7a5000', ic:icon||'alert-triangle' },
    ok:    { bg:'#f0fff5', border:'#80c090', color:C_TEAL,    ic:icon||'circle-check' },
    error: { bg:'#fff0f0', border:'#e0a0a0', color:'#900',    ic:icon||'alert-circle' },
    info:  { bg:'#e8f0f8', border:'#b0c8e0', color:'#1a4a80', ic:icon||'info-circle' },
  };
  const t = tones[tone] || tones.info;
  return (
    <div style={{ background:t.bg, border:`1px solid ${t.border}`, padding:'7px 12px',
      fontSize:11, marginBottom:10, display:'flex', gap:8, alignItems:'flex-start', color:t.color, lineHeight:1.6 }}>
      <i className={`ti ti-${t.ic}`} style={{ fontSize:15, flexShrink:0, marginTop:1 }} />
      <div>{children}</div>
    </div>
  );
}

// ─── Capture graphique Canvas → PNG (copier / télécharger) ───
export function copyChartCanvas(canvas, onDone) {
  canvas.toBlob(blob => {
    if (!blob) { if(onDone) onDone('Erreur génération.'); return; }
    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([new ClipboardItem({'image/png':blob})])
        .then(()=>{ if(onDone) onDone('Graphique copié !'); })
        .catch(()=>{
          const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
          a.download='graphique.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
          if(onDone) onDone('Copie non supportée → téléchargé.');
        });
    } else {
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
      a.download='graphique.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      if(onDone) onDone('PNG téléchargé.');
    }
  }, 'image/png');
}

export function downloadChartCanvas(canvas, filename, onDone) {
  canvas.toBlob(blob => {
    if(!blob) return;
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    if(onDone) onDone('PNG téléchargé.');
  }, 'image/png');
}

// ─── Copier / Couper / Coller génériques sur le champ actif ───────────────
// Remplace `document.execCommand('copy'/'cut')`, qui ne fait RIEN de fiable
// quand il est déclenché par un clic sur un bouton de barre d'outils (la
// sélection navigateur est perdue dès que le focus quitte le champ). On lit/
// écrit directement l'élément actuellement focalisé (input/textarea), ce qui
// fonctionne pour N'IMPORTE QUEL champ de l'appli, pas seulement le collage
// de données Pjmax (comportement précédent, limité à l'onglet "Données").
function champActif() {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !el.disabled && !el.readOnly) return el;
  return null;
}

// Modifie la valeur d'un <input>/<textarea> contrôlé par React en passant
// par le setter natif puis en émettant un évènement 'input' — nécessaire
// car assigner directement `el.value` est ignoré par React (state contrôlé).
function fixerValeurNative(el, valeur) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, valeur); else el.value = valeur;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export async function copierChampActif(onDone) {
  const el = champActif();
  if (!el) { onDone?.('Cliquez dans un champ, puis Copier.'); return; }
  const [debut, fin] = [el.selectionStart ?? 0, el.selectionEnd ?? el.value.length];
  const texte = debut !== fin ? el.value.slice(debut, fin) : el.value;
  if (!texte) { onDone?.('Rien à copier.'); return; }
  try { await navigator.clipboard.writeText(texte); onDone?.('Copié.'); }
  catch { onDone?.('Copie impossible (presse-papiers refusé par le navigateur).'); }
}

export async function couperChampActif(onDone) {
  const el = champActif();
  if (!el) { onDone?.('Cliquez dans un champ, puis Couper.'); return; }
  const [debut, fin] = [el.selectionStart ?? 0, el.selectionEnd ?? el.value.length];
  const aSelection = debut !== fin;
  const texte = aSelection ? el.value.slice(debut, fin) : el.value;
  if (!texte) { onDone?.('Rien à couper.'); return; }
  try {
    await navigator.clipboard.writeText(texte);
    fixerValeurNative(el, aSelection ? el.value.slice(0, debut) + el.value.slice(fin) : '');
    if (aSelection) { el.selectionStart = el.selectionEnd = debut; }
    onDone?.('Coupé.');
  } catch { onDone?.('Coupe impossible (presse-papiers refusé par le navigateur).'); }
}

export async function collerChampActif(onDone) {
  const el = champActif();
  if (!el) { onDone?.('Cliquez dans un champ avant de coller.'); return; }
  try {
    const texte = await navigator.clipboard.readText();
    if (!texte) { onDone?.('Presse-papiers vide.'); return; }
    const [debut, fin] = [el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length];
    fixerValeurNative(el, el.value.slice(0, debut) + texte + el.value.slice(fin));
    const position = debut + texte.length;
    el.selectionStart = el.selectionEnd = position;
    onDone?.('Collé.');
  } catch { onDone?.('Collage impossible (presse-papiers refusé par le navigateur).'); }
}

export function esc(t) { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

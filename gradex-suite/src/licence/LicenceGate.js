// ============================================================
//  LicenceGate.js — Écran d'activation de GRADEX.
//  ─────────────────────────────────────────────────────────────
//  Visuellement : repris tel quel de l'écran d'activation original
//  de GRADEX (dégradé bleu #185FA5/#0C447C, carte centrée, secousse
//  sur erreur) — c'est ce qui fait que l'activation "ressemble à
//  GRADEX".
//  Fonctionnellement : repris du système de licence de BV-Calc —
//  Identifiant Machine (et non IP), vérification via le serveur
//  local (server.js -> src/services/licenseClient.js, Google
//  Sheets + tolérance hors-ligne de 7 jours), ET prise en charge du
//  mode ESSAI 24h (src/services/trialClient.js) qui affiche un badge
//  et masque le formulaire de code (voir activation-status.essai).
//  La vérification se répète toutes les 60s (comme public/js/
//  activation.js de BV-Calc), pour verrouiller l'essai en direct
//  sans attendre un redémarrage.
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../useI18n';

async function fetchActivationStatus() {
  const r = await fetch('/api/activation-status', { cache: 'no-store' });
  return r.json();
}
async function fetchMachineId() {
  const r = await fetch('/api/machine-id', { cache: 'no-store' });
  const d = await r.json();
  return d.machineId || '';
}
async function postActiver(code) {
  const r = await fetch('/api/activer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return r.json();
}

function formaterRestant(heures, t) {
  if (heures == null || Number.isNaN(heures)) return '';
  if (heures < 1) return `${Math.max(1, Math.round(heures * 60))} min`;
  return `${Math.floor(heures)} h`;
}

export default function LicenceGate({ children }) {
  const { t, langue, changerLangue, LANGUES, NOMS_LANGUES } = useI18n();
  const [phase, setPhase] = useState('init'); // init -> checking -> form | blocked | valid
  const [machineId, setMachineId] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState({ text: '', ok: false });
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [statut, setStatut] = useState(null);
  const [showLogout, setShowLogout] = useState(false);

  const doShake = useCallback(() => { setShake(true); setTimeout(() => setShake(false), 500); }, []);

  const messagesBlocage = {
    non_active: t('nonActive'),
    refuse_par_serveur: t('refuseParServeur'),
    serveur_injoignable_periode_grace_depassee: t('injoignableGrace'),
    essai_expire: t('essaiExpire'),
    essai_horloge_invalide: t('essaiHorlogeInvalide'),
  };

  const verifier = useCallback(async () => {
    try {
      const s = await fetchActivationStatus();
      setStatut(s);
      if (s.machineId) setMachineId(s.machineId);
      if (s.active) {
        setPhase('valid');
      } else {
        setMsg({ text: messagesBlocage[s.raison] || s.raisonDetail || t('activationRequise'), ok: false });
        setPhase(s.raison === 'non_active' ? 'form' : 'blocked');
      }
    } catch (e) {
      setPhase('blocked');
      setStatut({ raison: 'erreur' });
      setMsg({ text: t('erreur') + ' ' + e.message, ok: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langue]);

  useEffect(() => {
    (async () => {
      try { setMachineId(await fetchMachineId()); } catch { /* affiché plus bas via statut */ }
      await verifier();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revérification périodique (60s, comme BV-Calc) : verrouille l'essai 24h
  // en direct, tient le badge à jour, et applique une révocation serveur
  // sans attendre un redémarrage.
  useEffect(() => {
    const id = setInterval(verifier, 60000);
    return () => clearInterval(id);
  }, [verifier]);

  async function handleActivate() {
    const c = code.trim().toUpperCase();
    if (!c) { setMsg({ text: t('collezCode'), ok: false }); doShake(); return; }
    setBusy(true);
    setMsg({ text: t('verifEnCours'), ok: false });
    try {
      const r = await postActiver(c);
      if (r.ok) {
        setMsg({ text: `✅ ${t('activeJusquau')} ${new Date(r.expiresAt).toLocaleDateString(langue === 'ar' ? 'ar' : langue)}.`, ok: true });
        setTimeout(verifier, 700);
      } else {
        setMsg({ text: `❌ ${t('erreur')} ${r.erreur}`, ok: false });
        doShake();
      }
    } catch (e) {
      setMsg({ text: `❌ ${t('erreur')} ${e.message}`, ok: false });
      doShake();
    }
    setBusy(false);
  }

  function copierId() {
    navigator.clipboard?.writeText(machineId).catch(() => {});
  }

  // ── Rendu : chargement ───────────────────────────────────
  if (phase === 'init') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:'100vh', background:'#f0f4f8', fontFamily:'Arial,sans-serif', gap:16 }}>
      <div style={{ width:44, height:44, border:'4px solid #d0d8e8', borderTop:'4px solid #185FA5',
        borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      <div style={{ fontSize:14, color:'#555', fontWeight:500 }}>{t('gxLicInitialisation')}</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Rendu : bloqué (révoqué / expiré / essai terminé) ────
  if (phase === 'blocked') return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh',
      background:'#f0f4f8', fontFamily:'Arial,sans-serif' }}>
      <div style={{ background:'#fff', width:420, borderRadius:6, overflow:'hidden',
        boxShadow:'0 4px 24px rgba(0,0,0,0.13)' }}>
        <div style={{ background:'#8B1a1a', padding:'20px 24px', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#fff' }}>⛔ GRADEX</div>
          <div style={{ fontSize:11, color:'#ffaaaa', marginTop:4 }}>{t('gxLicAccesRefuse')}</div>
        </div>
        <div style={{ padding:'24px', textAlign:'center' }}>
          <div style={{ fontSize:13, color:'#333', lineHeight:1.7, marginBottom:12 }}>{msg.text}</div>
          {machineId && (
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:12, color:'#888', marginBottom:16 }}>
              {t('identifiantTitre')} : {machineId}
            </div>
          )}
          <button onClick={() => setPhase('form')}
            style={{ padding:'9px 24px', background:'#185FA5', color:'#fff', border:'none',
              borderRadius:5, fontSize:13, cursor:'pointer', fontWeight:600 }}>
            {t('gxLicNouveauCode')}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Rendu : valide → app + bouton licence flottant ──────
  if (phase === 'valid') return (
    <>
      {children}
      {statut?.essai && (
        <div style={{ position:'fixed', top:8, left:'50%', transform:'translateX(-50%)', zIndex:8000,
          background:'#8B5000', color:'#fff', fontSize:11, fontWeight:700, padding:'4px 14px',
          borderRadius:20, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
          ⏱ {t('essaiBadge')} — {formaterRestant(statut.heuresRestantes, t)} {t('gxLicRestant')}
        </div>
      )}
      <div style={{ position:'fixed', bottom:28, left:14, zIndex:8000 }}>
        {showLogout ? (
          <div style={{ background:'#fff', border:'1px solid #d1d5db', borderRadius:6, padding:'14px 16px',
            boxShadow:'0 4px 16px rgba(0,0,0,0.15)', width:260, fontFamily:'Arial,sans-serif' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>{t('gxLicSeDeconnecterConfirm')}</div>
            <div style={{ fontSize:11, color:'#555', marginBottom:10, lineHeight:1.6 }}>
              <div>{t('gxLicStatutActif')} — {machineId}</div>
            </div>
            <div style={{ fontSize:11, color:'#888', marginBottom:12, lineHeight:1.5 }}>{t('gxLicSeDeconnecterHint')}</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setShowLogout(false)}
                style={{ flex:1, padding:'7px', background:'#f3f4f6', color:'#333', border:'1px solid #d1d5db',
                  borderRadius:4, cursor:'pointer', fontSize:12 }}>{t('gxLicAnnuler')}</button>
              <button onClick={() => setShowLogout(false)}
                title="Utilisez le bouton Révoquer de l'outil admin pour désactiver ce poste."
                style={{ flex:1, padding:'7px', background:'#8B1a1a', color:'#fff', border:'none',
                  borderRadius:4, cursor:'pointer', fontSize:12, fontWeight:600 }}>{t('gxLicSeDeconnecter')}</button>
            </div>
          </div>
        ) : !statut?.essai && (
          <button onClick={() => setShowLogout(true)} title={t('gxLicGererLicence')}
            style={{ background:'rgba(255,255,255,0.92)', border:'1px solid #d1d5db', borderRadius:20,
              padding:'5px 12px', fontSize:11, color:'#555', cursor:'pointer',
              boxShadow:'0 1px 4px rgba(0,0,0,0.12)', display:'flex', alignItems:'center', gap:5 }}>
            🔑 {t('gxLicGererLicence')}
          </button>
        )}
      </div>
    </>
  );

  // ── Rendu : formulaire d'activation ──────────────────────
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh',
      background:'#f0f4f8', fontFamily:'Arial,sans-serif' }}>
      <div style={{ background:'#fff', width:440, borderRadius:6, boxShadow:'0 4px 24px rgba(0,0,0,0.13)',
        overflow:'hidden', animation: shake ? 'shakeLic 0.45s' : 'none' }}>

        <div style={{ background:'linear-gradient(135deg,#185FA5 0%,#0C447C 100%)', padding:'22px 24px', textAlign:'center' }}>
          <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:12 }}>
            {LANGUES.map(lg => (
              <button key={lg} onClick={() => changerLangue(lg)} type="button"
                style={{ padding:'3px 9px', fontSize:11, borderRadius:3, cursor:'pointer',
                  background: langue===lg ? 'rgba(255,255,255,0.28)' : 'transparent',
                  border:'1px solid rgba(255,255,255,0.4)', color:'#fff',
                  fontWeight: langue===lg ? 700 : 400 }}>
                {lg.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ fontSize:26, fontWeight:700, color:'#fff', letterSpacing:1 }}>GRADEX</div>
          <div style={{ fontSize:11, color:'#a0d0ff', marginTop:4 }}>{t('gxLicSousTitre')}</div>
        </div>

        <div style={{ padding:'24px' }}>
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:5, padding:'12px 14px', marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#1e40af', marginBottom:6 }}>
              🖥️ {t('identifiantTitre')}
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <span style={{ fontFamily:"'Courier New',monospace", fontSize:15, color:'#185FA5', fontWeight:700,
                letterSpacing:1, wordBreak:'break-all' }}>
                {machineId || '…'}
              </span>
              {machineId && (
                <button onClick={copierId}
                  style={{ padding:'3px 10px', fontSize:10, background:'#185FA5', color:'#fff', border:'none',
                    borderRadius:3, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                  {t('copier')}
                </button>
              )}
            </div>
            <div style={{ fontSize:10, color:'#6b7280', marginTop:6, lineHeight:1.5 }}>{t('identifiantDesc')}</div>
          </div>

          {!statut?.essai && (
            <>
              <div style={{ marginBottom:10 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#374151', marginBottom:5 }}>
                  {t('codeTitre')}
                </label>
                <input value={code}
                  onChange={e => { setCode(e.target.value.toUpperCase()); setMsg({ text:'', ok:false }); }}
                  onKeyDown={e => e.key === 'Enter' && !busy && handleActivate()}
                  placeholder="GDX-XXXXXX-XXXXXX" spellCheck={false} autoComplete="off"
                  style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px',
                    border:`1.5px solid ${msg.text && !msg.ok ? '#dc2626' : '#d1d5db'}`, borderRadius:5, fontSize:13,
                    fontFamily:"'Courier New',monospace", letterSpacing:1, textAlign:'center', outline:'none',
                    transition:'border 0.2s' }} />
              </div>

              {msg.text && (
                <div style={{ padding:'9px 12px', borderRadius:4, marginBottom:12, fontSize:12, lineHeight:1.6,
                  background: msg.ok ? '#f0fff4' : '#fff5f5', color: msg.ok ? '#065f46' : '#991b1b',
                  border:`1px solid ${msg.ok ? '#a7f3d0' : '#fecaca'}` }}>
                  {msg.text}
                </div>
              )}

              <button onClick={handleActivate} disabled={busy || !code.trim()}
                style={{ width:'100%', padding:'11px', fontWeight:700, fontSize:14, border:'none', borderRadius:5,
                  cursor: busy || !code.trim() ? 'not-allowed' : 'pointer',
                  background: busy || !code.trim() ? '#9ca3af' : '#185FA5', color:'#fff',
                  transition:'background 0.2s', marginBottom:14 }}>
                {busy ? t('verifEnCours') : t('activerBouton')}
              </button>
            </>
          )}

          {statut?.essai && msg.text && (
            <div style={{ padding:'9px 12px', borderRadius:4, marginBottom:12, fontSize:12, lineHeight:1.6,
              background:'#fff5f5', color:'#991b1b', border:'1px solid #fecaca' }}>
              {msg.text}
            </div>
          )}

          <div style={{ textAlign:'center', fontSize:10, color:'#9ca3af', borderTop:'1px solid #f3f4f6', paddingTop:10 }}>
            {t('gxLicNonTransferable')}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shakeLic {
          0%,100%{transform:translateX(0)}
          20%,60%{transform:translateX(-8px)}
          40%,80%{transform:translateX(8px)}
        }
      `}</style>
    </div>
  );
}

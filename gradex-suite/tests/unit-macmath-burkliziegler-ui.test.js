/**
 * unit-macmath-burkliziegler-ui.test.js
 * -----------------------------------------------------------------------
 * Régression : macMath.calculer() rejetait TOUJOURS la valeur de K reçue
 * depuis l'interface (un <select> HTML ne renvoie que des chaînes, ex.
 * "0.43"), car elle était comparée par égalité stricte à un tableau de
 * NOMBRES ([0.11, 0.22, 0.32, 0.43].includes('0.43') === false). L'onglet
 * "Méthodes complémentaires" ne parse jamais les champs en nombres avant
 * de les transmettre (ADAPTATEURS.macMath), donc ce cas n'était pas
 * hypothétique : il se produisait à CHAQUE calcul lancé depuis l'écran.
 * Ce test simule exactement ce que l'UI envoie (des chaînes) pour les
 * deux méthodes concernées par le signalement utilisateur.
 * -----------------------------------------------------------------------
 */
import { calculer as macMath } from '../src/calculations/methods/macMath.js';
import { calculer as burkliZiegler } from '../src/calculations/methods/burkliZiegler.js';

let total = 0;
let reussis = 0;
function verifier(nom, obtenu, attendu, tolerance = 1e-6) {
  total++;
  const ok = typeof attendu === 'number' ? Math.abs(obtenu - attendu) <= tolerance : obtenu === attendu;
  if (ok) reussis++;
  console.log(`${ok ? '✅' : '❌'} ${nom}  →  obtenu=${JSON.stringify(obtenu)}  attendu=${JSON.stringify(attendu)}`);
}

console.log('\n=== macMath / burkliZiegler avec entrées chaîne (comme envoyées par MethodesTab.js) ===\n');

// K en chaîne (cas réel de l'UI) doit donner EXACTEMENT le même résultat que K en nombre.
const refNombre = macMath({ surface_km2: 0.447, h24_mm: 40.40, pente_m_par_m: 0.0345, K: 0.43 });
const refChaine = macMath({ surface_km2: '0.447', h24_mm: '40.40', pente_m_par_m: '0.0345', K: '0.43' });
verifier('macMath : K en chaîne "0.43" donne le même résultat que K=0.43 (nombre)', refChaine.q_m3s, refNombre.q_m3s, 1e-9);

for (const k of ['0.11', '0.22', '0.32', '0.43']) {
  let ok = true;
  try { macMath({ surface_km2: '1', h24_mm: '50', pente_m_par_m: '0.02', K: k }); } catch { ok = false; }
  verifier(`macMath : K="${k}" (chaîne UI) accepté sans exception`, ok, true);
}

{
  let leveErreur = false;
  try { macMath({ surface_km2: '1', h24_mm: '50', pente_m_par_m: '0.02', K: '0.99' }); } catch { leveErreur = true; }
  verifier('macMath : K invalide (hors des 4 valeurs) toujours rejeté', leveErreur, true);
}

// Avertissement de domaine (guide p.7 : S ≤ 1 km² en usage courant)
{
  const r = macMath({ surface_km2: '5', h24_mm: '50', pente_m_par_m: '0.02', K: '0.32' });
  verifier('macMath : avertissement de domaine émis si S > 1 km²', r.hypotheses.some(h => h.includes('1 km²')), true);
  const r2 = macMath({ surface_km2: '0.5', h24_mm: '50', pente_m_par_m: '0.02', K: '0.32' });
  verifier('macMath : pas d\'avertissement de domaine si S ≤ 1 km²', r2.hypotheses.some(h => h.includes('1 km²')), false);
}

// burkliZiegler : toutes les entrées numériques en chaîne (comme l'UI)
const bzChaine = burkliZiegler({ surface_km2: '0.447', h1h_mm: '20', pente_m_par_m: '0.0345', cr: '0.5' });
const bzNombre = burkliZiegler({ surface_km2: 0.447, h1h_mm: 20, pente_m_par_m: 0.0345, cr: 0.5 });
verifier('burkliZiegler : entrées chaîne donnent le même résultat qu\'en nombre', bzChaine.q_m3s, bzNombre.q_m3s, 1e-9);

// Avertissement de domaine (guide p.8 : A < 20 km² au Maroc)
{
  const r = burkliZiegler({ surface_km2: '50', h1h_mm: '20', pente_m_par_m: '0.02', cr: '0.5' });
  verifier('burkliZiegler : avertissement de domaine émis si A > 20 km²', r.hypotheses.some(h => h.includes('20 km²')), true);
  const r2 = burkliZiegler({ surface_km2: '5', h1h_mm: '20', pente_m_par_m: '0.02', cr: '0.5' });
  verifier('burkliZiegler : pas d\'avertissement de domaine si A ≤ 20 km²', r2.hypotheses.some(h => h.includes('20 km²')), false);
}

console.log(`\n${reussis} / ${total} tests réussis.\n`);
if (reussis !== total) { console.log('❌ Échec.'); process.exit(1); }
console.log('✅ macMath et burkliZiegler fonctionnent correctement avec les entrées telles qu\'envoyées par l\'UI.');

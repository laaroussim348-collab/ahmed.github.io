/**
 * unit-francou-rodier.test.js
 * -----------------------------------------------------------------------
 * Formule de Francou-Rodier (guide technique d'assainissement routier
 * 2020, §2.4 p.43) : transposition régionale d'un débit de pointe connu
 * (station jaugée de référence) vers un bassin non jaugé, via le
 * coefficient K(T) = 10×[1 − log10(Q/10⁶)/log10(S/10⁸)].
 *
 * Vérification principale : identité algébrique. Si on applique la
 * transposition avec le bassin étudié = le bassin de référence lui-même
 * (S = S_ref), on doit retrouver EXACTEMENT Q_ref — c'est la définition
 * même de K(T) (il est construit pour que la formule reproduise le point
 * de départ). Un écart signalerait une erreur d'implémentation.
 * -----------------------------------------------------------------------
 */
import { calculer as francouRodier, coefficientFrancouRodier } from '../src/calculations/methods/francouRodier.js';

let total = 0;
let reussis = 0;
function verifier(nom, obtenu, attendu, tolerance = 1e-6) {
  total++;
  const ok = typeof attendu === 'number' ? Math.abs(obtenu - attendu) <= tolerance : obtenu === attendu;
  if (ok) reussis++;
  console.log(`${ok ? '✅' : '❌'} ${nom}  →  obtenu=${JSON.stringify(obtenu)}  attendu=${JSON.stringify(attendu)}`);
}

console.log('\n=== francouRodier.js (guide p.43, transposition régionale) ===\n');

// Identité algébrique : S = S_ref doit reproduire Q_ref exactement, quel que soit K.
for (const [S_ref, Q_ref] of [[500, 120], [50, 15], [8000, 900], [120, 45]]) {
  const r = francouRodier({ surface_km2: S_ref, surface_ref_km2: S_ref, q_ref_m3s: Q_ref, T: 100 });
  verifier(`S=S_ref reproduit Q_ref exactement (S_ref=${S_ref}, Q_ref=${Q_ref})`, r.q_m3s, Q_ref, 1e-6);
}

// Cohérence physique : un bassin PLUS GRAND que la référence donne un débit PLUS GRAND (K fixé, Q croît avec S).
{
  const K = coefficientFrancouRodier(500, 120);
  const rPetit = francouRodier({ surface_km2: 200, surface_ref_km2: 500, q_ref_m3s: 120, T: 100 });
  const rGrand = francouRodier({ surface_km2: 2000, surface_ref_km2: 500, q_ref_m3s: 120, T: 100 });
  verifier('Q croît avec la surface (K fixé)', rGrand.q_m3s > rPetit.q_m3s, true);
  verifier('K(T) calculé cohérent avec le détail retourné', rPetit.resultatsIntermediaires.K, K, 1e-9);
}

// Erreurs explicites
{
  let leve = false;
  try { francouRodier({ surface_km2: 100, surface_ref_km2: -5, q_ref_m3s: 50, T: 100 }); } catch { leve = true; }
  verifier('Erreur si S_ref négative', leve, true);
}
{
  let leve = false;
  try { francouRodier({ surface_km2: 100, surface_ref_km2: 500, q_ref_m3s: 0, T: 100 }); } catch { leve = true; }
  verifier('Erreur si Q_ref nul', leve, true);
}

console.log(`\n${reussis} / ${total} tests réussis.\n`);
if (reussis !== total) { console.log('❌ Échec.'); process.exit(1); }
console.log('✅ francouRodier.js respecte l\'identité algébrique de sa propre définition et les invariants physiques attendus.');

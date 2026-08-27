/**
 * unit-cn-montana.test.js
 * -----------------------------------------------------------------------
 * Teste la table CN (guide p.22), l'ajustement AMC I/III (Chow et al.
 * 1988, guide p.23) et l'estimation du coefficient de Montana 'a' à
 * partir de H24h (algèbre pure, aucune donnée externe requise).
 * -----------------------------------------------------------------------
 */
import { getCN, ajusterCN } from '../src/calculations/curveNumber.js';
import { montanaADepuisH24h, intensiteMontana } from '../src/calculations/rainfall.js';
import { TABLE_CN } from '../src/data/coefficientsCN.js';

let total = 0;
let reussis = 0;
function verifier(nom, obtenu, attendu, tolerance = 1e-6) {
  total++;
  const ok = typeof attendu === 'number' ? Math.abs(obtenu - attendu) <= tolerance : obtenu === attendu;
  if (ok) reussis++;
  console.log(`${ok ? '✅' : '❌'} ${nom}  →  obtenu=${JSON.stringify(obtenu)}  attendu=${JSON.stringify(attendu)}`);
}

console.log('\n=== curveNumber.js (table CN, guide p.22-23) ===\n');

// Quelques valeurs transcrites directement de l'image de la page 22, vérifiées une à une
verifier('CN Terrain cultivé/sans traitement/A', getCN({ categorie: 'Terrain cultivé', condition: 'Sans traitement de conservation', groupeSol: 'A' }).cn, 72);
verifier('CN Terrain cultivé/sans traitement/D', getCN({ categorie: 'Terrain cultivé', condition: 'Sans traitement de conservation', groupeSol: 'D' }).cn, 91);
verifier('CN Pâturage/bonne condition/B', getCN({ categorie: 'Pâturage', condition: 'Bonne condition', groupeSol: 'B' }).cn, 61);
verifier('CN Boisé ou forêt/bon couvert/C', getCN({ categorie: 'Boisé ou forêt', condition: 'Bon couvert (protégé par broussailles)', groupeSol: 'C' }).cn, 70);
verifier('CN Secteurs commerciaux/A', getCN({ categorie: 'Secteurs commerciaux', condition: '85% imperméable', groupeSol: 'A' }).cn, 89);
verifier('CN Résidentiel 0.2ha/D', getCN({ categorie: 'Résidentiel — lots 0.2 ha', condition: '25% imperméable', groupeSol: 'D' }).cn, 85);
verifier('CN Rues/gravier/C', getCN({ categorie: 'Rues', condition: 'Gravier', groupeSol: 'C' }).cn, 89);
verifier('CN Stationnements pavés : 98 quel que soit le groupe', getCN({ categorie: "Stationnements pavés, toits, entrées d'autos", condition: 'Pavé', groupeSol: 'A' }).cn, 98);
verifier('Table CN : 20 lignes transcrites', TABLE_CN.length, 20);

let leveErreur = false;
try { getCN({ categorie: 'Inexistant', condition: 'X', groupeSol: 'A' }); } catch { leveErreur = true; }
verifier('getCN : erreur explicite si combinaison introuvable', leveErreur, true);

console.log('\n=== ajusterCN (Chow et al. 1988, guide p.23) ===\n');
// Vérification indépendante : recalcul manuel de la formule pour CN(II)=80
verifier('CN(I) pour CN(II)=80', ajusterCN(80, 'I').cn, (4.2 * 80) / (10 - 0.058 * 80), 1e-9);
verifier('CN(III) pour CN(II)=80', ajusterCN(80, 'III').cn, (23 * 80) / (10 + 0.13 * 80), 1e-9);
verifier('CN(II) renvoie la valeur inchangée', ajusterCN(80, 'II').cn, 80);
verifier('CN(I) < CN(II) < CN(III) (cohérence physique : sol sec ruisselle moins)', ajusterCN(80, 'I').cn < 80 && 80 < ajusterCN(80, 'III').cn, true);
verifier('CN(I) avec coefficient 0.085 (variante classeur Excel Oued Ighi, CN(II)=66.415)', ajusterCN(66.415, 'I', 0.085).cn, (4.2 * 66.415) / (10 - 0.085 * 66.415), 1e-6);
{
  let leveErreurCn100 = false;
  try { ajusterCN(80, 'I', 0.085); } catch { leveErreurCn100 = true; }
  verifier('CN(I) avec coefficient 0.085 : erreur explicite si résultat > 100 (CN(II)=80)', leveErreurCn100, true);
}

console.log('\n=== montanaADepuisH24h (rainfall.js) ===\n');
// Test de cohérence : si on calcule a depuis (H24h, b), puis qu'on recalcule l'intensité à t=24h avec ce a et ce b,
// on doit retrouver exactement i(24h) = H24h/24 (aller-retour algébrique exact).
{
  const h24_mm = 77.733;
  const b = 0.55;
  const r = montanaADepuisH24h({ h24_mm, b });
  const intensite24h = intensiteMontana({ a: r.a, b, tc_h: 24 });
  verifier('montanaADepuisH24h : aller-retour exact (i(24h) recalculé = H24h/24)', intensite24h.i_mm_h, h24_mm / 24, 1e-9);
  console.log(`   (info) a estimé=${r.a.toFixed(3)} pour H24h=${h24_mm}mm, b=${b}`);
}
{
  // Avec le b "SET Maroc" du classeur Excel (0.55) et le H24h déjà validé (77.733mm), on doit
  // retrouver un ordre de grandeur cohérent avec le a=18.6 du même classeur (même b, données liées).
  const r = montanaADepuisH24h({ h24_mm: 77.73346070475161, b: 0.55 });
  verifier('montanaADepuisH24h : cohérent avec le a=18.6 du classeur Excel (même b, même H24h)', Math.abs(r.a - 18.6) < 0.01, true);
}

let leveErreurB = false;
try { montanaADepuisH24h({ h24_mm: 50, b: 0 }); } catch { leveErreurB = true; }
verifier('montanaADepuisH24h : erreur explicite si b invalide', leveErreurB, true);

console.log(`\n${reussis} / ${total} tests réussis.\n`);
if (reussis < total) {
  console.error('❌ Des tests ont échoué.');
  process.exit(1);
} else {
  console.log('✅ Table CN et estimation Montana-depuis-H24h conformes.');
}

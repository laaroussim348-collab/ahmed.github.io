/**
 * run-tests.js
 * -----------------------------------------------------------------------
 * Compare, pour chaque cas de référence, le résultat du moteur Node.js au
 * résultat du classeur Excel (ou du guide). Affiche :
 *    Résultat Excel | Résultat Node.js | Écart | % d'écart | PASS/FAIL
 *
 * Exécution :  npm test   (ou : node tests/run-tests.js)
 * Code de sortie non nul si au moins un test échoue.
 * -----------------------------------------------------------------------
 */
import { getMethode, watershed, concentrationTime, rainfall } from '../src/calculations/index.js';
import { CAS_REFERENCE, BV_EXCEL } from './reference-cases.js';

const TOLERANCE_DEFAUT_POURCENT = 0.5; // écart acceptable dû aux arrondis (cahier des charges §7)

let total = 0;
let reussis = 0;
const lignes = [];

function comparer(libelle, valeurAttendue, valeurObtenue, cellule, tolerancePourcent = TOLERANCE_DEFAUT_POURCENT) {
  total++;
  const ecart = valeurObtenue - valeurAttendue;
  const ecartPourcent = valeurAttendue !== 0 ? Math.abs((ecart / valeurAttendue) * 100) : (Math.abs(ecart) < 1e-9 ? 0 : Infinity);
  const pass = ecartPourcent <= tolerancePourcent;
  if (pass) reussis++;
  lignes.push({
    test: libelle,
    excel: valeurAttendue,
    nodejs: valeurObtenue,
    ecart,
    ecartPourcent,
    cellule,
    statut: pass ? 'PASS' : 'FAIL',
  });
}

// --- 1. Géométrie du bassin versant (pente pondérée) ---
try {
  const r = watershed.penteMoyennePonderee(BV_EXCEL.troncons.altitudes_m, BV_EXCEL.troncons.longueurs_m);
  comparer('Pente pondérée par tronçons (%)', BV_EXCEL.troncons.pente_pourcent_attendue, r.pente_pourcent, "'CARACT DE BV'!G13");
} catch (e) {
  total++;
  lignes.push({ test: 'Pente pondérée par tronçons (%)', statut: 'FAIL', erreur: e.message });
}

// --- 2. Temps de concentration ---
for (const cas of CAS_REFERENCE.filter((c) => c.categorie === 'tc')) {
  try {
    const fnByName = {
      kirpich: concentrationTime.tcKirpich,
      espagnole: concentrationTime.tcEspagnole,
      californienne: concentrationTime.tcCalifornienne,
      ventura: concentrationTime.tcVentura,
      passini: concentrationTime.tcPassini,
      turrazza: concentrationTime.tcTurrazza,
      giandotti: concentrationTime.tcGiandotti,
    };
    const r = fnByName[cas.methode](cas.entrees);
    comparer(`tc — ${cas.methode}`, cas.attendu.tc_min, r.tc_min, cas.cellule, cas.tolerancePourcent);
  } catch (e) {
    total++;
    lignes.push({ test: `tc — ${cas.methode}`, statut: 'FAIL', erreur: e.message });
  }
}

// --- 3. Pluviométrie ---
for (const cas of CAS_REFERENCE.filter((c) => c.categorie === 'rainfall_intensite')) {
  const r = rainfall.intensiteMontana(cas.entrees);
  comparer('Intensité Montana i(T,tc)', cas.attendu.i_mm_h, r.i_mm_h, cas.cellule, cas.tolerancePourcent);
}
for (const cas of CAS_REFERENCE.filter((c) => c.categorie === 'rainfall_h24_montana')) {
  const r = rainfall.hauteur24hParExtrapolationMontana(cas.entrees);
  comparer('H24h (extrapolation Montana)', cas.attendu.h24_mm, r.h24_mm, cas.cellule, cas.tolerancePourcent);
}

// --- 4. Méthodes de calcul du débit de pointe ---
for (const cas of CAS_REFERENCE.filter((c) => c.categorie === 'methode')) {
  try {
    const { calculer } = getMethode(cas.methode);
    const r = calculer(cas.entrees);
    comparer(`Qp — ${cas.methode}`, cas.attendu.q_m3s, r.q_m3s, cas.cellule, cas.tolerancePourcent);
  } catch (e) {
    total++;
    lignes.push({ test: `Qp — ${cas.methode}`, statut: 'FAIL', erreur: e.message });
  }
}

// --- Rapport ---
console.log('\n=== Comparaison Node.js vs Excel / guide de référence ===\n');
const largeurTest = Math.max(...lignes.map((l) => l.test.length), 30);
console.log(
  'Test'.padEnd(largeurTest) + '  Excel/guide'.padEnd(18) + 'Node.js'.padEnd(18) + 'Écart'.padEnd(14) + '% écart'.padEnd(12) + 'Statut'
);
console.log('-'.repeat(largeurTest + 18 + 18 + 14 + 12 + 8));
for (const l of lignes) {
  if (l.erreur) {
    console.log(l.test.padEnd(largeurTest) + `  ERREUR : ${l.erreur}`);
    continue;
  }
  console.log(
    l.test.padEnd(largeurTest) +
      String(l.excel.toFixed(4)).padEnd(18) +
      String(l.nodejs.toFixed(4)).padEnd(18) +
      String(l.ecart.toFixed(4)).padEnd(14) +
      String(l.ecartPourcent.toFixed(3) + ' %').padEnd(12) +
      l.statut +
      `   (${l.cellule})`
  );
}

console.log(`\n${reussis} / ${total} tests réussis (tolérance par défaut : ${TOLERANCE_DEFAUT_POURCENT}%).\n`);

if (reussis < total) {
  console.error('❌ Au moins un test a échoué — voir le détail ci-dessus avant de considérer le moteur validé.');
  process.exit(1);
} else {
  console.log('✅ Tous les tests sont conformes au classeur Excel / au guide de référence.');
}

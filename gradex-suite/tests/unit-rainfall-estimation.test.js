/**
 * unit-rainfall-estimation.test.js
 * -----------------------------------------------------------------------
 * Test d'intégration du pipeline complet (série -> maxima -> Gumbel ->
 * quantiles / régression Montana) avec des séries SYNTHÉTIQUES construites
 * localement (aucun appel réseau). Vérifie des invariants mathématiques
 * généraux (croissance avec T, plages plausibles) plutôt que des valeurs
 * exactes, les données d'entrée étant elles-mêmes arbitraires.
 * -----------------------------------------------------------------------
 */
import { calculerPjmax, calculerMontana, calculerPma } from '../src/services/rainfallEstimation.js';

let total = 0;
let reussis = 0;
function verifier(nom, condition) {
  total++;
  if (condition) reussis++;
  console.log(`${condition ? '✅' : '❌'} ${nom}`);
}

console.log('\n=== rainfallEstimation.js (pipeline complet, données synthétiques) ===\n');

// --- Pjmax : 20 ans de maxima journaliers synthétiques (valeurs variées, non-aléatoires pour reproductibilité) ---
{
  const maximaBruts = [38, 42, 51, 33, 60, 45, 71, 39, 55, 48, 62, 36, 58, 47, 66, 41, 53, 44, 69, 50]; // 20 valeurs
  const serie = [];
  maximaBruts.forEach((max, i) => {
    const annee = 2004 + i;
    // quelques valeurs "bruit" dans l'année + le maximum lui-même
    serie.push({ dateKey: `${annee}0101`, value: max * 0.3 });
    serie.push({ dateKey: `${annee}0615`, value: max }); // le maximum de l'année
    serie.push({ dateKey: `${annee}1201`, value: max * 0.5 });
  });

  const r = calculerPjmax(serie);
  verifier('calculerPjmax : détecte 20 années', r.anneesDisponibles === 20);
  verifier('calculerPjmax : Pjmax croît avec T (10<20<50<100)', r.pjmax[10] < r.pjmax[20] && r.pjmax[20] < r.pjmax[50] && r.pjmax[50] < r.pjmax[100]);
  verifier('calculerPjmax : Pjmax(10) dans une plage plausible (20-100mm)', r.pjmax[10] > 20 && r.pjmax[10] < 100);
  console.log(`   (info) Pjmax : T10=${r.pjmax[10].toFixed(1)}mm, T100=${r.pjmax[100].toFixed(1)}mm`);

  // Doit lever une erreur explicite si <10 ans
  let leveErreur = false;
  try { calculerPjmax(serie.slice(0, 15)); } catch (e) { leveErreur = /au moins 10/.test(e.message); }
  verifier('calculerPjmax : erreur explicite si <10 ans de données', leveErreur);
}

// --- Montana : 12 ans de séries horaires synthétiques, chaque année un "orage" de forme différente ---
{
  const serieHoraire = [];
  for (let an = 2013; an <= 2024; an++) {
    // 8760 heures/an, toutes à 0 sauf un "orage" de 24h avec un profil décroissant (pic en tête)
    const intensitePic = 8 + (an % 5) * 2; // varie un peu d'une année à l'autre
    for (let h = 0; h < 8760; h++) {
      let valeur = 0;
      if (h >= 4000 && h < 4024) {
        const k = h - 4000;
        valeur = intensitePic * Math.exp(-k / 6); // décroissance exponentielle sur 24h
      }
      const jour = String(Math.floor(h / 24) + 1).padStart(3, '0');
      serieHoraire.push({ dateKey: `${an}${jour}${String(h % 24).padStart(2, '0')}`, value: valeur });
    }
  }

  const r = calculerMontana(serieHoraire);
  verifier('calculerMontana : au moins 3 durées exploitées', r.dureesUtilisees.length >= 3);
  verifier('calculerMontana : b(T) dans une plage physiquement plausible (0 < b < 1.2)', Object.values(r.montana).every((m) => m.b > 0 && m.b < 1.2));
  verifier('calculerMontana : a(T) croît avec T (orages plus rares = plus intenses)', r.montana[10].a < r.montana[100].a);
  verifier('calculerMontana : qualité de régression R² > 0.8 (orages synthétiques réguliers)', Object.values(r.montana).every((m) => m.r2 > 0.8));
  console.log(`   (info) Montana : a(T10)=${r.montana[10].a.toFixed(2)}, b(T10)=${r.montana[10].b.toFixed(3)}, R²=${r.montana[10].r2.toFixed(3)}`);
}

// --- Pma : 12 années à 300mm/an exactement (construites avec ~365 jours/an) -> Pma doit retrouver ≈300 ---
{
  const serie = [];
  for (let an = 2013; an <= 2024; an++) {
    const parJour = 300 / 365; // mm/jour constant -> total annuel exact = 300mm
    for (let j = 1; j <= 365; j++) {
      serie.push({ dateKey: `${an}${String(j).padStart(3, '0')}`, value: parJour });
    }
  }
  const r = calculerPma(serie);
  verifier('calculerPma : retrouve Pma≈300mm/an (série construite à 300mm/an exactement)', Math.abs(r.pma_mm_an - 300) < 1);
  verifier('calculerPma : pma_m_an = pma_mm_an / 1000', Math.abs(r.pma_m_an - 0.3) < 0.001);
  verifier('calculerPma : 12 années utilisées', r.anneesUtilisees === 12);
  console.log(`   (info) Pma calculé=${r.pma_mm_an.toFixed(2)}mm/an sur ${r.anneesUtilisees} ans`);

  // Année tronquée (150 jours seulement) -> doit être exclue (<300 jours), pas fausser la moyenne
  const avecAnneeTronquee = [...serie, ...Array.from({ length: 150 }, (_, i) => ({ dateKey: `2025${String(i + 1).padStart(3, '0')}`, value: 5 }))];
  const r2 = calculerPma(avecAnneeTronquee);
  verifier("calculerPma : année tronquée (<300j) exclue du calcul", r2.anneesUtilisees === 12);
}

console.log(`\n${reussis} / ${total} vérifications réussies.\n`);
if (reussis < total) {
  console.error('❌ Des vérifications ont échoué.');
  process.exit(1);
} else {
  console.log('✅ Le pipeline Pjmax/Montana respecte les invariants mathématiques attendus sur données synthétiques.');
}

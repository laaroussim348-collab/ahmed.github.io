/**
 * unit-nasa-power.test.js
 * -----------------------------------------------------------------------
 * Teste l'ANALYSE des réponses NASA POWER avec des réponses SYNTHÉTIQUES
 * reproduisant fidèlement le format documenté par la NASA (vérifié par
 * recherche web le 12/08/2026 — voir commentaires de nasaPowerClient.js).
 * Ne teste PAS l'appel réseau lui-même (impossible dans cet environnement).
 * -----------------------------------------------------------------------
 */
import {
  buildDailyPrecipitationUrl,
  parseNasaPowerSeries,
  maximaAnnuels,
  maximaAnnuelsGlissants,
  anneeDeCle,
} from '../src/services/nasaPowerClient.js';

let total = 0;
let reussis = 0;
function verifier(nom, obtenu, attendu) {
  total++;
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) reussis++;
  console.log(`${ok ? '✅' : '❌'} ${nom}  →  obtenu=${JSON.stringify(obtenu)}  attendu=${JSON.stringify(attendu)}`);
}

console.log('\n=== nasaPowerClient.js ===\n');

// 1. Construction d'URL — vérifie la présence des paramètres attendus
{
  const url = buildDailyPrecipitationUrl(33.97, -6.85, '19810101', '20251231');
  const contientTout = ['parameters=PRECTOTCORR', 'latitude=33.97', 'longitude=-6.85', 'start=19810101', 'end=20251231', 'format=JSON'].every((p) => url.includes(p));
  verifier('buildDailyPrecipitationUrl contient tous les paramètres attendus', contientTout, true);
}

// 2. Analyse d'une réponse synthétique (format documenté : properties.parameter.PRECTOTCORR)
{
  const reponseSynthetique = {
    properties: {
      parameter: {
        PRECTOTCORR: {
          '20230101': 5.2,
          '20230102': -999, // valeur manquante NASA -> doit être filtrée
          '20230103': 10.1,
          '20240101': 0.0,
        },
      },
    },
  };
  const serie = parseNasaPowerSeries(reponseSynthetique);
  verifier('parseNasaPowerSeries filtre les valeurs manquantes (-999)', serie.length, 3);
  verifier('parseNasaPowerSeries conserve les valeurs valides', serie.map((s) => s.value), [5.2, 10.1, 0.0]);
}

// 3. Maxima annuels sur 2 ans
{
  const serie = [
    { dateKey: '20220101', value: 5 },
    { dateKey: '20220615', value: 42 }, // max 2022
    { dateKey: '20221231', value: 3 },
    { dateKey: '20230101', value: 8 },
    { dateKey: '20230715', value: 55 }, // max 2023
  ];
  const maxima = maximaAnnuels(serie);
  verifier('maximaAnnuels : 2 années détectées', maxima.length, 2);
  verifier('maximaAnnuels : max 2022 = 42', maxima.find((m) => m.annee === 2022).max, 42);
  verifier('maximaAnnuels : max 2023 = 55', maxima.find((m) => m.annee === 2023).max, 55);
}

// 4. Maxima annuels glissants (fenêtre de 3h) — série construite pour avoir un maximum connu
{
  // 6 valeurs horaires : fenêtres de 3h possibles = [1+2+4=7, 2+4+5=11, 4+5+1=10, 5+1+0=6] -> max=11
  const serieHoraire = [1, 2, 4, 5, 1, 0].map((v, i) => ({ dateKey: `202301010${i}`, value: v }));
  const resultats = maximaAnnuelsGlissants(serieHoraire, 3);
  verifier('maximaAnnuelsGlissants(3h) : cumul maximal correctement identifié', resultats[0].max, 11);
}

// 5. anneeDeCle : robuste aux 2 formats de clé (journalier AAAAMMJJ, horaire AAAAMMJJHH)
{
  verifier('anneeDeCle format journalier', anneeDeCle('20230615'), 2023);
  verifier('anneeDeCle format horaire', anneeDeCle('2023061514'), 2023);
}

console.log(`\n${reussis} / ${total} tests réussis.\n`);
if (reussis < total) {
  console.error('❌ Des tests ont échoué.');
  process.exit(1);
} else {
  console.log('✅ Analyse des réponses NASA POWER conforme au format documenté.');
}

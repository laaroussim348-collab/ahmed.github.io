/**
 * Méthode Rationnelle
 * -----------------------------------------------------------------------
 * Qp(T) = (1/3.6) × Cr × I(T,tc) × A
 *
 * Source : Guide §2.2.4, p.8-9. « Cette formule a été recommandée par le
 * guide d'assainissement de la Setra (...). Elle donne satisfaction et
 * elle est utilisée pour tous les projets routiers et autoroutiers au
 * Maroc. » — C'est la méthode PRINCIPALE recommandée par le guide.
 * Excel de référence : feuille 'calcule debit'!G15.
 * -----------------------------------------------------------------------
 */
import { valider } from '../validation.js';
import { intensiteMontana } from '../rainfall.js';

export const META = {
  id: 'rationnelle',
  nom: 'Méthode Rationnelle',
  recommandee: true,
  domaine: 'Bassins versants < 25 km² (jusqu\'à 100 km² selon le guide, abattement spatial négligeable). Méthode utilisée pour tous les projets routiers et autoroutiers au Maroc.',
  source: "Guide §2.2.4, p.8-9 ; Excel 'calcule debit'!G15",
  champs: [
    { cle: 'surface_km2', label: 'Surface du bassin versant (A)', unite: 'km²' },
    { cle: 'cr', label: 'Coefficient de ruissellement pondéré (Cr)', unite: '' },
    { cle: 'a', label: 'Coefficient de Montana a(T)', unite: '' },
    { cle: 'b', label: 'Coefficient de Montana b(T)', unite: '' },
    { cle: 'tc_h', label: 'Temps de concentration (tc)', unite: 'h' },
    { cle: 'T', label: 'Période de retour (T)', unite: 'ans' },
  ],
};

export function calculer({ surface_km2, cr, a, b, tc_h, T }) {
  valider({ surface_km2, cr, tc_h, T });

  const etapes = [];

  const intensite = intensiteMontana({ a, b, tc_h });
  etapes.push({
    titre: '1. Intensité pluviométrique de projet — formule de Montana',
    formule: intensite.formule,
    application: intensite.application,
    resultat: `I(T,tc) = ${intensite.i_mm_h.toFixed(4)} mm/h`,
  });

  const q_m3s = (1 / 3.6) * cr * intensite.i_mm_h * surface_km2;
  etapes.push({
    titre: '2. Débit de pointe',
    formule: 'Qp(T) = (1/3.6) × Cr × I(T,tc) × A',
    application: `Qp = (1/3.6) × ${cr} × ${intensite.i_mm_h.toFixed(4)} × ${surface_km2}`,
    resultat: `Qp = ${q_m3s.toFixed(4)} m³/s`,
  });

  return {
    methode: META.nom,
    q_m3s,
    etapes,
    parametresEntree: { surface_km2, cr, a, b, tc_h, T },
    resultatsIntermediaires: { i_mm_h: intensite.i_mm_h },
    hypotheses: [
      'Cr pondéré si le bassin versant comporte plusieurs occupations du sol (Cr(BV) = Σ Cri·Si / Σ Si).',
      'a et b sont des coefficients de Montana RÉGIONAUX (poste pluviométrique le plus proche), propres à la période de retour T retenue.',
    ],
    source: META.source,
  };
}

/**
 * Formule de Burkli-Ziegler
 * -----------------------------------------------------------------------
 * Qp = 0.0039 . Cr . H1h . A^0.75 . P^0.25    avec A en ha, P en mm/m (= ‰), H1h en mm
 *
 * Formule confirmée à l'identique entre le guide (p.7) et le classeur
 * Excel de référence ('calcule debit'!G27) — aucune ambiguïté ici.
 *
 * Source : Guide §2.2.3, p.7. « Cette formule est couramment utilisée au
 * Maroc pour des bassins versants dont la surface est inférieure à 20 km².
 * Certains auteurs recommandent son utilisation entre 15 et 200 km². »
 * -----------------------------------------------------------------------
 */
import { valider } from '../validation.js';
import { km2ToHa, mParMToPourMille } from '../units.js';

export const META = {
  id: 'burkliZiegler',
  nom: 'Formule de Burkli-Ziegler',
  domaine: 'Couramment utilisée au Maroc pour A < 20 km² (certains auteurs : 15 à 200 km²).',
  source: "Guide §2.2.3, p.7 ; Excel 'calcule debit'!G27",
  champs: [
    { cle: 'surface_km2', label: 'Surface du bassin versant (A)', unite: 'km²' },
    { cle: 'h1h_mm', label: 'Hauteur de pluie max. en 1h (H1h)', unite: 'mm' },
    { cle: 'pente_m_par_m', label: 'Pente moyenne du bassin versant (P)', unite: 'm/m' },
    { cle: 'cr', label: 'Coefficient de ruissellement (Cr)', unite: '' },
  ],
};

export function calculer({ surface_km2, h1h_mm, pente_m_par_m, cr }) {
  valider({ surface_km2, pente_m_par_m, cr });
  if (!(h1h_mm > 0)) throw new Error('La hauteur de pluie en 1h (H1h) doit être strictement positive.');

  const etapes = [];

  const surface_ha = km2ToHa(surface_km2);
  const pente_pour_mille = mParMToPourMille(pente_m_par_m);
  etapes.push({
    titre: '1. Conversion des unités',
    formule: 'A(ha) = A(km²) × 100  ;  P(mm/m) = P(m/m) × 1000',
    application: `A = ${surface_km2} × 100 = ${surface_ha} ha  ;  P = ${pente_m_par_m} × 1000 = ${pente_pour_mille} mm/m`,
    resultat: `A = ${surface_ha} ha, P = ${pente_pour_mille} mm/m`,
  });

  const q_m3s = 0.0039 * cr * h1h_mm * Math.pow(surface_ha, 0.75) * Math.pow(pente_pour_mille, 0.25);
  etapes.push({
    titre: '2. Débit de pointe',
    formule: 'Qp = 0.0039 × Cr × H1h × A(ha)^0.75 × P(mm/m)^0.25',
    application: `Qp = 0.0039 × ${cr} × ${h1h_mm} × ${surface_ha.toFixed(3)}^0.75 × ${pente_pour_mille.toFixed(3)}^0.25`,
    resultat: `Qp = ${q_m3s.toFixed(4)} m³/s`,
  });

  return {
    methode: META.nom,
    q_m3s,
    etapes,
    parametresEntree: { surface_km2, h1h_mm, pente_m_par_m, cr },
    resultatsIntermediaires: { surface_ha, pente_pour_mille },
    hypotheses: [
      'H1h peut être estimée par Montana : H1h = a×(1h)^-b = a (car 1^-b = 1).',
      ...(surface_km2 > 20
        ? [`⚠️ Surface = ${surface_km2} km² > 20 km² : le guide (p.8) indique que cette formule est « couramment utilisée au Maroc » pour des surfaces inférieures à 20 km² (certains auteurs l'étendent jusqu'à 200 km²) — résultat à interpréter avec prudence au-delà.`]
        : []),
    ],
    source: META.source,
  };
}

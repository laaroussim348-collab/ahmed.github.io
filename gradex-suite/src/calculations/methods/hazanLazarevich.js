/**
 * Formule de Hazan et Lazarevich
 * -----------------------------------------------------------------------
 * Q(1000) = K1 . S^K2                                    (débit décamillénnal de référence)
 * Q(T)     = Q(1000) . (1 + a.log10(T)) / (1 + a.log10(1000))
 *
 * ⚠️ Formule ABSENTE des 28 pages du guide fournies à ce logiciel.
 * Extraite exclusivement du classeur Excel ('calcule debit', bloc A18:J23).
 *
 * Le classeur associe (K1, K2) à 4 tranches de pluviométrie moyenne
 * annuelle (mm/an). Il y a des LACUNES entre tranches (500-600 et
 * 800-1000 mm/an ne sont couvertes par aucune ligne) — voir le rapport
 * d'analyse, point ambigu n°4.
 * -----------------------------------------------------------------------
 */
import { valider } from '../validation.js';

export const META = {
  id: 'hazanLazarevich',
  nom: 'Formule de Hazan et Lazarevich',
  domaine: 'Non documenté dans les pages du guide fournies (voir avertissement). Formule extraite exclusivement du classeur Excel.',
  source: "Excel 'calcule debit'!A18:J23 (absent des pages 6-33 du guide fourni)",
  nonDocumenteeDansLeGuide: true,
  champs: [
    { cle: 'pma_mm_an', label: 'Pluie moyenne annuelle (Pma), pour sélectionner la zone', unite: 'mm/an' },
    { cle: 'surface_km2', label: 'Surface du bassin versant (S)', unite: 'km²' },
    { cle: 'a', label: "Coefficient de croissance a (défaut Excel : 1)", unite: '' },
    { cle: 'T', label: 'Période de retour recherchée (T)', unite: 'ans' },
  ],
};

/**
 * Table des zones pluviométriques -> (K1, K2), telle qu'utilisée dans le
 * classeur Excel de référence. ATTENTION : lacunes entre 500-600 et
 * 800-1000 mm/an (non couvertes par le classeur).
 */
export const ZONES_PLUVIOMETRIQUES = [
  { min: 1000, max: 1300, k1: 15.55, k2: 0.776, libelle: '1000–1300 mm/an' },
  { min: 600, max: 800, k1: 7.58, k2: 0.808, libelle: '600–800 mm/an' },
  { min: 400, max: 500, k1: 13.47, k2: 0.587, libelle: '400–500 mm/an' },
  { min: 200, max: 400, k1: 9.38, k2: 0.742, libelle: '200–400 mm/an' },
];

export function zonePourPma(pma_mm_an) {
  const zone = ZONES_PLUVIOMETRIQUES.find((z) => pma_mm_an >= z.min && pma_mm_an <= z.max);
  if (!zone) {
    throw new Error(
      `Pma=${pma_mm_an} mm/an ne correspond à aucune zone tabulée dans le classeur Excel ` +
      `(tranches couvertes : 200-400, 400-500, 600-800, 1000-1300 mm/an — lacunes entre 500-600 et 800-1000 mm/an). ` +
      `Merci de fournir (K1, K2) manuellement pour ce cas.`
    );
  }
  return zone;
}

export function calculer({ pma_mm_an, surface_km2, a = 1, T }) {
  valider({ surface_km2, T });
  const etapes = [];

  const zone = zonePourPma(pma_mm_an);
  etapes.push({
    titre: '1. Sélection de la zone pluviométrique',
    formule: 'Zone déterminée par la pluie moyenne annuelle (Pma)',
    application: `Pma = ${pma_mm_an} mm/an → zone "${zone.libelle}" → K1=${zone.k1}, K2=${zone.k2}`,
    resultat: `K1 = ${zone.k1}, K2 = ${zone.k2}`,
  });

  const q1000 = zone.k1 * Math.pow(surface_km2, zone.k2);
  etapes.push({
    titre: '2. Débit de référence décamillénnal Q(1000)',
    formule: 'Q(1000) = K1 × S^K2',
    application: `Q(1000) = ${zone.k1} × ${surface_km2}^${zone.k2}`,
    resultat: `Q(1000) = ${q1000.toFixed(4)} m³/s`,
  });

  const q_m3s = (q1000 * (1 + a * Math.log10(T))) / (1 + a * Math.log10(1000));
  etapes.push({
    titre: '3. Extrapolation vers la période de retour T',
    formule: 'Q(T) = Q(1000) × (1+a×log10(T)) / (1+a×log10(1000))',
    application: `Q(T) = ${q1000.toFixed(4)} × (1+${a}×log10(${T})) / (1+${a}×log10(1000))`,
    resultat: `Q(T) = ${q_m3s.toFixed(4)} m³/s`,
  });

  return {
    methode: META.nom,
    q_m3s,
    etapes,
    parametresEntree: { pma_mm_an, surface_km2, a, T },
    resultatsIntermediaires: { zone: zone.libelle, k1: zone.k1, k2: zone.k2, q1000 },
    hypotheses: ["Formule non documentée narrativement dans les pages du guide fournies à ce logiciel — reproduite exactement depuis le classeur Excel."],
    source: META.source,
  };
}

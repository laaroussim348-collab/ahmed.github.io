/**
 * Formule de Mallet-Gautier
 * -----------------------------------------------------------------------
 * Q = 2 . K . log10(1 + a.Pma) . S . (1 + 4.log10(T) − log10(S))^0.5 / L^0.5
 *
 * ⚠️ Cette formule n'apparaît PAS dans les 28 pages du guide fournies à ce
 * logiciel (numérotées p.6 à p.33 sur 116 au total). Elle a été extraite
 * uniquement de la formule EXCEL (feuille 'calcule debit', cellule H5),
 * qui constitue l'une de vos deux sources obligatoires. Aucune information
 * sur le domaine de validité, l'origine de "K" ou la plage normale de
 * "Pma" n'est disponible dans les documents fournis — voir le rapport
 * d'analyse, point ambigu n°1.
 * -----------------------------------------------------------------------
 */
import { valider } from '../validation.js';

export const META = {
  id: 'malletGautier',
  nom: 'Formule de Mallet-Gautier',
  domaine: "Non documenté dans les pages du guide fournies (voir avertissement). Formule extraite exclusivement du classeur Excel.",
  source: "Excel 'calcule debit'!B3:H6 (absent des pages 6-33 du guide fourni)",
  nonDocumenteeDansLeGuide: true,
  champs: [
    { cle: 'K', label: 'Coefficient K', unite: '' },
    { cle: 'a', label: 'Coefficient a', unite: '' },
    { cle: 'pma_m_an', label: 'Pluie moyenne annuelle (Pma)', unite: 'm/an' },
    { cle: 'surface_km2', label: 'Surface du bassin versant (S)', unite: 'km²' },
    { cle: 'T', label: 'Période de retour (T)', unite: 'ans' },
    { cle: 'longueur_km', label: 'Longueur du thalweg principal (L)', unite: 'km' },
  ],
};

export function calculer({ K, a, pma_m_an, surface_km2, T, longueur_km }) {
  valider({ surface_km2, T });
  if (!(longueur_km > 0)) throw new Error('La longueur du thalweg (L) doit être strictement positive.');
  if (!(pma_m_an > 0)) throw new Error("La pluie moyenne annuelle (Pma) doit être strictement positive.");

  const etapes = [];

  const logTerm = Math.log10(1 + a * pma_m_an);
  const sizeTerm = Math.pow(1 + 4 * Math.log10(T) - Math.log10(surface_km2), 0.5);
  etapes.push({
    titre: '1. Termes intermédiaires',
    formule: 'log10(1 + a×Pma)  et  (1 + 4×log10(T) − log10(S))^0.5',
    application: `log10(1 + ${a}×${pma_m_an}) = ${logTerm.toFixed(5)}  ;  (1+4×log10(${T})−log10(${surface_km2}))^0.5 = ${sizeTerm.toFixed(5)}`,
    resultat: `${logTerm.toFixed(5)} et ${sizeTerm.toFixed(5)}`,
  });

  const q_m3s = (2 * K * logTerm * surface_km2 * sizeTerm) / Math.pow(longueur_km, 0.5);
  etapes.push({
    titre: '2. Débit de pointe',
    formule: 'Q = 2×K×log10(1+a×Pma)×S×(1+4×log10(T)−log10(S))^0.5 / L^0.5',
    application: `Q = 2×${K}×${logTerm.toFixed(5)}×${surface_km2}×${sizeTerm.toFixed(5)} / ${longueur_km}^0.5`,
    resultat: `Q = ${q_m3s.toFixed(4)} m³/s`,
  });

  return {
    methode: META.nom,
    q_m3s,
    etapes,
    parametresEntree: { K, a, pma_m_an, surface_km2, T, longueur_km },
    hypotheses: ["Formule non documentée narrativement dans les pages du guide fournies à ce logiciel — reproduite exactement depuis le classeur Excel."],
    source: META.source,
  };
}

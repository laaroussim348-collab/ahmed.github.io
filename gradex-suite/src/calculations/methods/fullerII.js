/**
 * Formule de Fuller II
 * -----------------------------------------------------------------------
 * Q = (1 + a.log10(T)) . (S^0.8 + 8/3.S^0.5) . 4.N / 300
 *
 * ⚠️ Comme Mallet-Gautier, cette formule est ABSENTE des 28 pages du guide
 * fournies à ce logiciel. Extraite exclusivement de la formule Excel
 * (feuille 'calcule debit', cellule G10). Le sens physique et le domaine
 * de variation normal du coefficient "N" ne sont pas documentés dans les
 * documents fournis — voir le rapport d'analyse, point ambigu n°1.
 * Dans l'exemple du classeur, N a été saisi à 100, une valeur identique à
 * T=100 ans : il est possible que N=T dans l'usage prévu, mais ceci n'a
 * pas pu être confirmé.
 * -----------------------------------------------------------------------
 */
import { valider } from '../validation.js';

export const META = {
  id: 'fullerII',
  nom: 'Formule de Fuller II',
  domaine: 'Non documenté dans les pages du guide fournies (voir avertissement). Formule extraite exclusivement du classeur Excel.',
  source: "Excel 'calcule debit'!C8:G10 (absent des pages 6-33 du guide fourni)",
  nonDocumenteeDansLeGuide: true,
  champs: [
    { cle: 'a', label: 'Coefficient a', unite: '' },
    { cle: 'T', label: 'Période de retour (T)', unite: 'ans' },
    { cle: 'surface_km2', label: 'Surface du bassin versant (S)', unite: 'km²' },
    { cle: 'N', label: 'Coefficient N', unite: '' },
  ],
};

export function calculer({ a, T, surface_km2, N }) {
  valider({ surface_km2, T });
  if (N === undefined || N === null || Number.isNaN(N)) throw new Error('Le coefficient N est obligatoire.');

  const etapes = [];

  const facteurFrequence = 1 + a * Math.log10(T);
  const facteurSurface = Math.pow(surface_km2, 0.8) + (8 / 3) * Math.pow(surface_km2, 0.5);
  etapes.push({
    titre: '1. Termes intermédiaires',
    formule: '(1 + a×log10(T))  et  (S^0.8 + 8/3×S^0.5)',
    application: `(1+${a}×log10(${T})) = ${facteurFrequence.toFixed(5)}  ;  (${surface_km2}^0.8 + 8/3×${surface_km2}^0.5) = ${facteurSurface.toFixed(5)}`,
    resultat: `${facteurFrequence.toFixed(5)} et ${facteurSurface.toFixed(5)}`,
  });

  const q_m3s = facteurFrequence * facteurSurface * ((4 * N) / 300);
  etapes.push({
    titre: '2. Débit de pointe',
    formule: 'Q = (1+a×log10(T)) × (S^0.8 + 8/3×S^0.5) × 4×N/300',
    application: `Q = ${facteurFrequence.toFixed(5)} × ${facteurSurface.toFixed(5)} × 4×${N}/300`,
    resultat: `Q = ${q_m3s.toFixed(4)} m³/s`,
  });

  return {
    methode: META.nom,
    q_m3s,
    etapes,
    parametresEntree: { a, T, surface_km2, N },
    hypotheses: ["Formule non documentée narrativement dans les pages du guide fournies à ce logiciel — reproduite exactement depuis le classeur Excel."],
    source: META.source,
  };
}

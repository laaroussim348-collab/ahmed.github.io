/**
 * Formule de Mac-Math
 * -----------------------------------------------------------------------
 * Telle qu'écrite et confirmée VISUELLEMENT dans le guide (p.7) :
 *    Qp(T) = K . H . A^0.58 . P^0.42        avec A EN KM², P EN M/M
 *
 * ⚠️ HISTORIQUE DE CETTE CONVENTION (important, lire avant de modifier) :
 *  - 12/08/2026 : convention Excel adoptée par défaut (A ha, P ‰, /1000),
 *    car c'est ce que calculait le classeur 'calcule debit'!P5.
 *  - 12/08/2026 (plus tard) : bascule vers la convention LITTÉRALE du
 *    guide (A km², P m/m, sans /1000) suite à la consigne « le guide prime
 *    sur l'Excel ».
 *  - 13/08/2026 : RETOUR à la convention Excel (A ha, P ‰, /1000) comme
 *    valeur par défaut. Raison : le document "Formules_empiriques" fourni
 *    (calcul réel « BASSIN VERSANT 1 ») applique la même formule avec
 *    S en HECTARES (44.7 ha) et P en mm/m (10.34), puis divise par 1000
 *    (K=0.43, Hf=40.40mm -> Qf=0.420 m³/s, recalcul indépendant : 0.4199,
 *    écart <0.3%). C'est donc la DEUXIÈME source indépendante (après le
 *    classeur Excel) qui confirme cette convention comme celle réellement
 *    appliquée en pratique, quel que soit ce que dit le texte du guide.
 *    Le document donnant ce second exemple a été désigné par l'utilisateur
 *    comme source de priorité 1 (au-dessus même du guide).
 *
 * Conclusion : la convention "excel" (A ha, P ‰/mm par m, /1000) est
 * désormais le défaut, appuyée par 2 exemples de calcul réels concordants.
 * La convention littérale du guide reste disponible via conventionUnites:'guide'.
 * -----------------------------------------------------------------------
 */
import { valider } from '../validation.js';
import { km2ToHa, mParMToPourMille } from '../units.js';

export const META = {
  id: 'macMath',
  nom: 'Formule de Mac-Math',
  domaine: 'S ≤ 1 km² (confirmé par le document "Formules_empiriques" : exemple à S=0.447km²=44.7ha). Grande sensibilité au coefficient K (écart de 40 à 100% entre 2 valeurs consécutives de K).',
  source: "Guide §2.2.2 p.7 ; Excel 'calcule debit'!K3:P6 ; Formules_empiriques_100242.pdf (2 sources concordantes)",
  champs: [
    { cle: 'surface_km2', label: 'Surface du bassin versant (A)', unite: 'km²' },
    { cle: 'h24_mm', label: 'Hauteur de pluie max. en 24h, H = P(24h,T) (H)', unite: 'mm' },
    { cle: 'pente_m_par_m', label: 'Pente moyenne du bassin versant (P)', unite: 'm/m' },
    { cle: 'K', label: 'Coefficient topographique (K)', unite: '' },
  ],
  optionsK: [
    { valeur: 0.11, description: 'BV de grande dimension et végétation' },
    { valeur: 0.22, description: 'BV cultivé, terrain vague des zones suburbaines' },
    { valeur: 0.32, description: 'Terrain non aménagé, non rocheux, pente moyenne, peu peuplé, faubourgs non pavés' },
    { valeur: 0.43, description: 'Petites cités, terrain non aménagé rocheux à forte pente' },
  ],
};

/**
 * @param {'excel'|'guide'} [conventionUnites='excel']  'excel' = A ha/P ‰, /1000 (DÉFAUT, confirmé par 2 exemples réels) ; 'guide' = A km²/P m/m, texte littéral du guide
 */
export function calculer({ surface_km2, h24_mm, pente_m_par_m, K, conventionUnites = 'excel' }) {
  valider({ surface_km2, pente_m_par_m });
  if (!(h24_mm > 0)) throw new Error('La hauteur de pluie de 24h (H) doit être strictement positive.');
  if (![0.11, 0.22, 0.32, 0.43].includes(K)) {
    throw new Error('K doit être l\'une des 4 valeurs proposées par le guide : 0.11, 0.22, 0.32 ou 0.43.');
  }

  const etapes = [];
  let q_m3s;

  if (conventionUnites === 'guide') {
    q_m3s = K * h24_mm * Math.pow(surface_km2, 0.58) * Math.pow(pente_m_par_m, 0.42);
    etapes.push({
      titre: '1. Débit de pointe (convention littérale du guide — secondaire)',
      formule: 'Qp(T) = K × H × A(km²)^0.58 × P(m/m)^0.42',
      application: `Qp = ${K} × ${h24_mm} × ${surface_km2}^0.58 × ${pente_m_par_m}^0.42`,
      resultat: `Qp = ${q_m3s.toFixed(4)} m³/s`,
      avertissement:
        "Convention textuelle du guide (secondaire). Par défaut, ce logiciel utilise la convention confirmée par " +
        "2 exemples de calcul réels concordants (A ha, P ‰) — voir README §7.",
    });
  } else {
    const surface_ha = km2ToHa(surface_km2);
    const pente_pour_mille = mParMToPourMille(pente_m_par_m);
    etapes.push({
      titre: '1. Conversion des unités (convention confirmée par 2 exemples de calcul réels)',
      formule: 'A(ha) = A(km²) × 100  ;  P(‰) = P(m/m) × 1000',
      application: `A = ${surface_km2} × 100 = ${surface_ha} ha  ;  P = ${pente_m_par_m} × 1000 = ${pente_pour_mille} ‰`,
      resultat: `A = ${surface_ha} ha, P = ${pente_pour_mille} ‰`,
    });
    const q_brut = K * h24_mm * Math.pow(surface_ha, 0.58) * Math.pow(pente_pour_mille, 0.42);
    q_m3s = q_brut / 1000;
    etapes.push({
      titre: '2. Débit de pointe',
      formule: 'Qp(T) = [ K × H × A(ha)^0.58 × P(‰)^0.42 ] / 1000',
      application: `Qp = [ ${K} × ${h24_mm} × ${surface_ha.toFixed(3)}^0.58 × ${pente_pour_mille.toFixed(3)}^0.42 ] / 1000`,
      resultat: `Qp = ${q_m3s.toFixed(4)} m³/s`,
    });
  }

  return {
    methode: META.nom,
    q_m3s,
    etapes,
    parametresEntree: { surface_km2, h24_mm, pente_m_par_m, K, conventionUnites },
    hypotheses: [
      `K = ${K} retenu par l'utilisateur parmi les 4 classes topographiques du guide.`,
      'H doit être estimée de préférence via la relation de Weiss (P24h = 1.15×Pjmax) plutôt que par extrapolation des paramètres de Montana (cf. avertissement guide p.7).',
      `Convention d'unités utilisée : ${conventionUnites === 'guide' ? 'littérale du guide (A km², P m/m)' : 'A ha, P ‰ — défaut, confirmé par 2 exemples de calcul réels'}.`,
    ],
    source: META.source,
  };
}

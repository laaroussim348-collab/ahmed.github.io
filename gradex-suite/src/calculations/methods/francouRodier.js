/**
 * Formule de Francou-Rodier — transposition régionale de débits de pointe
 * -----------------------------------------------------------------------
 * Q(T) = 10^6 × (S/10^8)^(1 − K(T)/10)      avec S en km², Q en m³/s
 * K(T) = 10 × [1 − log10(Q/10^6) / log10(S/10^8)]
 *
 * Principe (guide §2.4, « C. Pour les bassins versants de grande taille
 * S > 100 km² voire 150 km² », p.43) : on dispose d'une STATION HYDRO-
 * MÉTRIQUE DE RÉFÉRENCE jaugée, de surface S_ref et de débit de pointe
 * connu Q_ref(T) (par ajustement statistique des débits mesurés). On en
 * déduit le coefficient régional K(T), propre à la région climatique et
 * à la période de retour T, PUIS on l'applique à la surface du bassin
 * ÉTUDIÉ (non jaugé) pour transposer le débit de pointe.
 *
 * « La transposition des débits d'un bassin jaugé vers un bassin non
 * jaugé suppose une similitude physique des deux bassins versants et une
 * distorsion qui n'est pas très importante des surfaces drainées. »
 * (guide, p.43) — cette hypothèse doit être vérifiée par l'utilisateur
 * (même région climatique, même régime hydrologique, tailles pas trop
 * disproportionnées) avant d'utiliser cette méthode ; K(T) est un
 * paramètre RÉGIONAL, pas universel.
 *
 * Source : Guide technique d'assainissement routier 2020, p.43/116.
 * -----------------------------------------------------------------------
 */
import { valider } from '../validation.js';

export const META = {
  id: 'francouRodier',
  nom: 'Formule de Francou-Rodier (transposition régionale)',
  domaine:
    "Transposition d'un débit de pointe connu (station de référence jaugée) vers un bassin non jaugé de " +
    "surface et de contexte climatique similaires. Le guide la cite pour les grands bassins (S > 100-150 km²), " +
    "mais elle s'applique dès qu'une station de référence adéquate est disponible, quelle que soit la taille.",
  source: 'Guide technique d\'assainissement routier 2020, §2.4 p.43',
  champs: [
    { cle: 'surface_ref_km2', label: 'Surface du bassin de la station de référence (S_ref)', unite: 'km²' },
    { cle: 'q_ref_m3s', label: 'Débit de pointe connu à la station de référence, période de retour T (Q_ref)', unite: 'm³/s' },
    { cle: 'surface_km2', label: 'Surface du bassin versant étudié (non jaugé) (S)', unite: 'km²' },
    { cle: 'T', label: 'Période de retour (T) — doit correspondre à celle de Q_ref', unite: 'ans' },
  ],
};

/** K(T) = 10 × [1 − log10(Q_ref/10^6) / log10(S_ref/10^8)] */
export function coefficientFrancouRodier(surface_ref_km2, q_ref_m3s) {
  if (!(surface_ref_km2 > 0)) throw new Error('La surface de la station de référence (S_ref) doit être strictement positive.');
  if (!(q_ref_m3s > 0)) throw new Error('Le débit de référence (Q_ref) doit être strictement positif.');
  if (surface_ref_km2 === 1e8) {
    throw new Error('S_ref = 10⁸ km² : log10(S_ref/10⁸) = 0, K(T) indéfini (division par zéro).');
  }
  return 10 * (1 - Math.log10(q_ref_m3s / 1e6) / Math.log10(surface_ref_km2 / 1e8));
}

export function calculer({ surface_km2, surface_ref_km2, q_ref_m3s, T }) {
  valider({ surface_km2, T });
  const etapes = [];

  const K = coefficientFrancouRodier(surface_ref_km2, q_ref_m3s);
  etapes.push({
    titre: '1. Coefficient régional de Francou-Rodier, déduit de la station de référence',
    formule: 'K(T) = 10 × [1 − log10(Q_ref/10⁶) / log10(S_ref/10⁸)]',
    application: `K(T) = 10 × [1 − log10(${q_ref_m3s}/10⁶) / log10(${surface_ref_km2}/10⁸)]`,
    resultat: `K(T) = ${K.toFixed(3)}`,
  });

  const q_m3s = 1e6 * Math.pow(surface_km2 / 1e8, 1 - K / 10);
  etapes.push({
    titre: '2. Transposition vers le bassin étudié',
    formule: 'Q(T) = 10⁶ × (S/10⁸)^(1 − K(T)/10)',
    application: `Q(T) = 10⁶ × (${surface_km2}/10⁸)^(1 − ${K.toFixed(3)}/10)`,
    resultat: `Q(T) = ${q_m3s.toFixed(4)} m³/s`,
  });

  return {
    methode: META.nom,
    q_m3s,
    etapes,
    parametresEntree: { surface_km2, surface_ref_km2, q_ref_m3s, T },
    resultatsIntermediaires: { K },
    hypotheses: [
      `K(T) = ${K.toFixed(3)} déduit de la station de référence (S_ref=${surface_ref_km2} km², Q_ref=${q_ref_m3s} m³/s) — ` +
        'ce coefficient est RÉGIONAL : sa réutilisation suppose une similitude climatique/physique entre le bassin de ' +
        'référence et le bassin étudié.',
      "Vérifier que la période de retour T de Q_ref correspond bien à celle recherchée pour le bassin étudié " +
        "(K(T) dépend de T).",
    ],
    source: META.source,
  };
}

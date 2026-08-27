/**
 * curveNumber.js
 * -----------------------------------------------------------------------
 * Lecture de la table CN (occupation du sol × groupe hydrologique) et
 * ajustement selon les conditions antécédentes d'humidité (AMC).
 * Source : Guide §2.2.6, p.22-23.
 * -----------------------------------------------------------------------
 */
import { TABLE_CN } from '../data/coefficientsCN.js';

/**
 * @param {string} categorie  doit correspondre exactement à un `categorie` de TABLE_CN
 * @param {string} condition  doit correspondre exactement à un `condition` de TABLE_CN pour cette catégorie
 * @param {'A'|'B'|'C'|'D'} groupeSol
 */
export function getCN({ categorie, condition, groupeSol }) {
  const ligne = TABLE_CN.find((l) => l.categorie === categorie && l.condition === condition);
  if (!ligne) throw new Error(`Combinaison "${categorie}" / "${condition}" introuvable dans la table CN.`);
  if (!['A', 'B', 'C', 'D'].includes(groupeSol)) throw new Error('Groupe hydrologique du sol invalide (attendu A, B, C ou D).');
  return {
    cn: ligne[groupeSol],
    categorie,
    condition,
    groupeSol,
    source: 'Guide, table CN II p.22 (Chow et al. 1988 ; Rivard, 2005)',
  };
}

/**
 * Ajuste un CN II (conditions moyennes) vers CN I (sec) ou CN III (humide),
 * par les formules de Chow et al. (1988) — guide p.23.
 * @param {number} cn2  CN en conditions antécédentes MOYENNES (table standard)
 * @param {'I'|'II'|'III'} amc  condition antécédente d'humidité visée
 * @param {number} [coefAmcI=0.058]  coefficient de la formule CN(I). 0.058 est la
 *   valeur standard (Chow et al. 1988, reprise par le guide) ; certains classeurs
 *   Excel de terrain (ex. Oued Ighi) utilisent 0.085 — voir CN_I_COEF_OPTIONS.
 */
export function ajusterCN(cn2, amc, coefAmcI = 0.058) {
  if (!(cn2 > 0 && cn2 <= 100)) throw new Error('CN(II) doit être compris entre 0 et 100.');
  if (amc === 'II') return { cn: cn2, formule: 'CN(II) — valeur de table, aucun ajustement.' };
  if (amc === 'I') {
    const cn1 = (4.2 * cn2) / (10 - coefAmcI * cn2);
    if (cn1 > 100) {
      throw new Error(
        `CN(I) calculé = ${cn1.toFixed(1)} > 100 (physiquement impossible) avec coefficient ${coefAmcI} pour CN(II)=${cn2}. ` +
        'Ce coefficient (variante classeur Excel) ne convient pas aux CN(II) élevés — utilisez le coefficient standard 0.058.',
      );
    }
    return { cn: cn1, formule: `CN(I) = 4.2×CN(II) / (10 − ${coefAmcI}×CN(II))`, source: 'Guide p.23 (Chow et al. 1988)' };
  }
  if (amc === 'III') {
    const cn3 = (23 * cn2) / (10 + 0.13 * cn2);
    return { cn: cn3, formule: 'CN(III) = 23×CN(II) / (10 + 0.13×CN(II))', source: 'Guide p.23 (Chow et al. 1988)' };
  }
  throw new Error("AMC invalide (attendu 'I', 'II' ou 'III').");
}

/** Options proposées à l'utilisateur pour le coefficient de la formule CN(I). */
export const CN_I_COEF_OPTIONS = [
  { value: 0.058, label: '0.058 (standard — Chow et al. 1988)' },
  { value: 0.085, label: '0.085 (classeur Excel Oued Ighi)' },
];

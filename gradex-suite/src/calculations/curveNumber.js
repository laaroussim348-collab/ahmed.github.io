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
 */
export function ajusterCN(cn2, amc) {
  if (!(cn2 > 0 && cn2 <= 100)) throw new Error('CN(II) doit être compris entre 0 et 100.');
  if (amc === 'II') return { cn: cn2, formule: 'CN(II) — valeur de table, aucun ajustement.' };
  if (amc === 'I') {
    const cn1 = (4.2 * cn2) / (10 - 0.058 * cn2);
    return { cn: cn1, formule: 'CN(I) = 4.2×CN(II) / (10 − 0.058×CN(II))', source: 'Guide p.23 (Chow et al. 1988)' };
  }
  if (amc === 'III') {
    const cn3 = (23 * cn2) / (10 + 0.13 * cn2);
    return { cn: cn3, formule: 'CN(III) = 23×CN(II) / (10 + 0.13×CN(II))', source: 'Guide p.23 (Chow et al. 1988)' };
  }
  throw new Error("AMC invalide (attendu 'I', 'II' ou 'III').");
}

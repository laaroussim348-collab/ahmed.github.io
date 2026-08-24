/**
 * coefficientsRuissellement.js
 * -----------------------------------------------------------------------
 * « Table Enveloppe des coefficients de ruissellement corrigés en fonction
 * de la période de retour (T) », pour bassins versants ≤ 100 km².
 * Source : Guide technique d'assainissement routier 2020, p.13.
 *
 * Chaque ligne correspond à un couple (code d'occupation du sol, classe de
 * pente) et donne, pour les 3 groupes hydrologiques de sol (grossiers /
 * moyennement grossiers à fins / fins à très fins) et les 4 périodes de
 * retour tabulées (10, 20, 50, 100 ans), le coefficient de ruissellement Cr.
 *
 * `null` = case vide dans le guide (donnée non fournie). Pour les pentes
 * >30%, le guide autorise (note de bas de tableau) d'utiliser par défaut
 * les valeurs de la tranche 10%<P<=30% comme valeurs MINIMALES ; c'est le
 * repli appliqué par getCr() dans runoff.js.
 * -----------------------------------------------------------------------
 */

export const PERIODES_RETOUR_TABULEES = [10, 20, 50, 100];

export const CLASSES_PENTE = ['<=5%', '5-10%', '10-30%', '>30%'];

export const GROUPES_SOL = {
  grossiers: 'Sols grossiers',
  moyens: 'Sols moyennement grossiers à fins',
  fins: 'Sols fins à très fins',
};

/** code -> libellés (nomenclature BCEOM et SCS telles que présentes dans le guide) */
export const OCCUPATIONS_SOL = {
  1: { bceom: 'Plate-forme et chaussée de route', scs: '*** (assimilé chaussée)' },
  2: { bceom: "Terrain dénudé ou à végétation non couvrante, terrains déjà entachés par l'érosion, labours frais", scs: 'Zone cultivée' },
  3: { bceom: 'Cultures couvrantes, céréales hautes, terrains de parcours à petite brousse clairsemée', scs: 'Pâturage' },
  4: { bceom: 'Sous-bois ou forêt', scs: 'Forêt' },
  5: { bceom: '*** (assimilé zone urbaine)', scs: 'Zone urbaine' },
};

// [T=10, T=20, T=50, T=100]
export const TABLE_RUISSELLEMENT = [
  // ---- Code 1 : Plate-forme et chaussée de route ----
  { code: 1, penteClass: '<=5%', grossiers: [0.90, 0.92, 0.94, 0.95], moyens: [0.90, 0.92, 0.94, 0.95], fins: [0.90, 0.92, 0.94, 0.95] },
  { code: 1, penteClass: '5-10%', grossiers: [0.90, 0.92, 0.94, 0.95], moyens: [0.90, 0.92, 0.94, 0.95], fins: [0.90, 0.92, 0.94, 0.95] },
  { code: 1, penteClass: '10-30%', grossiers: [0.90, 0.92, 0.94, 0.95], moyens: [0.90, 0.92, 0.94, 0.95], fins: [0.90, 0.92, 0.94, 0.95] },
  { code: 1, penteClass: '>30%', grossiers: [0.90, 0.92, 0.94, 0.95], moyens: [0.90, 0.92, 0.94, 0.95], fins: [0.90, 0.92, 0.94, 0.95] },

  // ---- Code 2 : Terrain dénudé / zone cultivée ----
  { code: 2, penteClass: '<=5%', grossiers: [0.30, 0.40, 0.51, 0.57], moyens: [0.50, 0.57, 0.64, 0.68], fins: [0.60, 0.65, 0.71, 0.74] },
  { code: 2, penteClass: '5-10%', grossiers: [0.40, 0.49, 0.57, 0.63], moyens: [0.60, 0.65, 0.71, 0.74], fins: [0.70, 0.74, 0.78, 0.80] },
  { code: 2, penteClass: '10-30%', grossiers: [0.52, 0.59, 0.65, 0.69], moyens: [0.72, 0.75, 0.79, 0.81], fins: [0.82, 0.84, 0.87, 0.88] },
  { code: 2, penteClass: '>30%', grossiers: null, moyens: null, fins: null },

  // ---- Code 3 : Cultures couvrantes / pâturage ----
  { code: 3, penteClass: '<=5%', grossiers: [0.10, 0.24, 0.39, 0.48], moyens: [0.30, 0.40, 0.51, 0.57], fins: [0.40, 0.49, 0.57, 0.63] },
  { code: 3, penteClass: '5-10%', grossiers: [0.15, 0.28, 0.42, 0.50], moyens: [0.36, 0.45, 0.55, 0.60], fins: [0.55, 0.61, 0.67, 0.71] },
  { code: 3, penteClass: '10-30%', grossiers: [0.22, 0.34, 0.46, 0.53], moyens: [0.42, 0.50, 0.59, 0.64], fins: [0.60, 0.65, 0.71, 0.74] },
  { code: 3, penteClass: '>30%', grossiers: null, moyens: null, fins: [0.74, 0.76, 0.78, 0.80] },

  // ---- Code 4 : Sous-bois ou forêt ----
  { code: 4, penteClass: '<=5%', grossiers: [0.10, 0.24, 0.39, 0.48], moyens: [0.30, 0.40, 0.51, 0.57], fins: [0.40, 0.49, 0.57, 0.63] },
  { code: 4, penteClass: '5-10%', grossiers: [0.25, 0.36, 0.48, 0.54], moyens: [0.35, 0.45, 0.54, 0.60], fins: [0.50, 0.57, 0.64, 0.68] },
  { code: 4, penteClass: '10-30%', grossiers: [0.30, 0.40, 0.51, 0.57], moyens: [0.50, 0.57, 0.64, 0.68], fins: [0.60, 0.65, 0.71, 0.74] },
  { code: 4, penteClass: '>30%', grossiers: null, moyens: null, fins: null },

  // ---- Code 5 : Zone urbaine ----
  { code: 5, penteClass: '<=5%', grossiers: [0.40, 0.49, 0.57, 0.63], moyens: [0.55, 0.61, 0.67, 0.71], fins: [0.65, 0.70, 0.74, 0.77] },
  { code: 5, penteClass: '5-10%', grossiers: [0.50, 0.57, 0.64, 0.68], moyens: [0.65, 0.70, 0.74, 0.77], fins: [0.80, 0.82, 0.84, 0.86] },
  { code: 5, penteClass: '10-30%', grossiers: null, moyens: null, fins: null },
  { code: 5, penteClass: '>30%', grossiers: null, moyens: null, fins: null },
];

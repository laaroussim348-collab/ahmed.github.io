/**
 * concentrationTime.js
 * -----------------------------------------------------------------------
 * Formules de temps de concentration (tc) présentes dans le guide,
 * §2.2.4-C « Temps de concentration tc », p.15-18.
 *
 * IMPORTANT — chaque formule attend ses variables dans DES UNITÉS PRÉCISES
 * (rappelées dans la doc de chaque fonction et dans `variables` du résultat).
 * Ne jamais réordonner/adapter silencieusement : convertir explicitement
 * via units.js avant l'appel.
 *
 * Le guide conclut (p.23) que, pour les petits et moyens bassins versants
 * arides à semi-arides du Maroc, la formule de KIRPICH constitue la
 * référence recommandée. Les autres formules sont fournies à titre de
 * comparaison / alternative, comme le demande le cahier des charges.
 * -----------------------------------------------------------------------
 */

function finaliser({ methode, tc_min, tc_h, formule, variables, domaine, source, avertissement }) {
  if (tc_min == null && tc_h != null) tc_min = tc_h * 60;
  if (tc_h == null && tc_min != null) tc_h = tc_min / 60;
  if (!(tc_min > 0)) {
    throw new Error(`${methode} : le temps de concentration calculé est nul ou négatif — vérifier les entrées.`);
  }
  return { methode, tc_min, tc_h, formule, variables, domaine, source, avertissement: avertissement || null };
}

/**
 * Formule de KIRPICH — recommandée par le guide pour l'Afrique / le Maroc.
 * @param {number} longueur_m   longueur du thalweg principal, EN MÈTRES
 * @param {number} pente_m_par_m pente moyenne, EN m/m
 */
export function tcKirpich({ longueur_m, pente_m_par_m }) {
  const tc_min = 0.0195 * Math.pow(longueur_m, 0.77) * Math.pow(pente_m_par_m, -0.385);
  return finaliser({
    methode: 'Kirpich',
    tc_min,
    formule: 'tc (min) = 0.0195 × L(m)^0.77 × I(m/m)^-0.385',
    variables: { 'L (longueur du thalweg)': `${longueur_m} m`, 'I (pente moyenne)': `${pente_m_par_m} m/m` },
    domaine:
      "Formule recommandée par l'ouvrage Hydraulique Routière du BCEOM pour l'Afrique, et confirmée par plusieurs " +
      'études marocaines (Moulouya, PNI) pour les bassins arides à semi-arides.',
    source: "Guide §2.2.4-C p.15 ; Excel 'CARACT DE BV'!H17",
  });
}

/** Formule dite « Espagnole » (US Corps modifiée). L en km, P en m/m, tc en h. */
export function tcEspagnole({ longueur_km, pente_m_par_m }) {
  const tc_h = 0.3 * Math.pow(longueur_km / Math.pow(pente_m_par_m, 0.25), 0.77);
  return finaliser({
    methode: 'Espagnole',
    tc_h,
    formule: 'tc (h) = 0.3 × ( L(km) / I(m/m)^0.25 )^0.77',
    variables: { 'L (longueur du thalweg)': `${longueur_km} km`, 'I (pente moyenne)': `${pente_m_par_m} m/m` },
    source: "Guide §2.2.4-C p.16 ; Excel 'CARACT DE BV'!H18",
  });
}

/** Formule Californienne (dérivée de Kirpich, forme modifiée). L en km, P en m/m, tc en h. */
export function tcCalifornienne({ longueur_km, pente_m_par_m }) {
  const tc_h = 0.1452 * Math.pow(longueur_km / Math.pow(pente_m_par_m, 0.5), 0.77);
  return finaliser({
    methode: 'Californienne',
    tc_h,
    formule: 'tc (h) = 0.1452 × ( L(km) / I(m/m)^0.5 )^0.77',
    variables: { 'L (longueur du thalweg)': `${longueur_km} km`, 'I (pente moyenne)': `${pente_m_par_m} m/m` },
    source: "Guide §2.2.4-C p.16 ; Excel 'CARACT DE BV'!H19",
  });
}

/** Formule de Ventura. S en km², P en m/m, tc en h. */
export function tcVentura({ surface_km2, pente_m_par_m }) {
  const tc_h = 0.1272 * Math.pow(surface_km2 / pente_m_par_m, 0.5);
  return finaliser({
    methode: 'Ventura',
    tc_h,
    formule: 'tc (h) = 0.1272 × ( S(km²) / I(m/m) )^0.5',
    variables: { 'S (surface)': `${surface_km2} km²`, 'I (pente moyenne)': `${pente_m_par_m} m/m` },
    domaine: 'Le guide précise (note 6, p.17) que Ventura, Passini, Giandotti et Turazza ont été établies pour des bassins plus grands que le champ de ce chapitre (RAR82/SETRA, BV<100km²).',
    source: "Guide §2.2.4-C p.17 ; Excel 'CARACT DE BV'!H20",
  });
}

/**
 * Formule de PASSINI — telle que définie dans le guide (p.17) : coefficient 0.8, P en %.
 * ATTENTION : la cellule "formule de passini" du classeur Excel de référence (H21) ne
 * reproduit PAS cette formule ; voir le rapport d'analyse (point ambigu n°5).
 */
export function tcPassini({ surface_km2, longueur_km, pente_pourcent }) {
  const tc_h = 0.8 * Math.cbrt(surface_km2 * longueur_km) / Math.sqrt(pente_pourcent);
  return finaliser({
    methode: 'Passini',
    tc_h,
    formule: 'tc (h) = 0.8 × (S(km²)×L(km))^(1/3) / I(%)^0.5',
    variables: { 'S (surface)': `${surface_km2} km²`, 'L (longueur)': `${longueur_km} km`, 'I (pente moyenne)': `${pente_pourcent} %` },
    domaine: 'Établie pour des bassins versants plus grands que les petits BV (cf. note du guide). À utiliser avec précaution < 100 km².',
    source: 'Guide §2.2.4-C p.17',
    avertissement:
      "Le classeur Excel fourni calcule une valeur différente sous ce même nom (voir README, point ambigu n°5) : " +
      'il duplique en réalité la formule de Turrazza. Cette fonction implémente la formule TELLE QU\'ÉCRITE dans le guide.',
  });
}

/** Formule de TURRAZZA — telle que définie dans le guide (p.16) : coefficient 0.108, P en %. */
export function tcTurrazza({ surface_km2, longueur_km, pente_pourcent }) {
  const tc_h = 0.108 * Math.cbrt(surface_km2 * longueur_km) / Math.sqrt(pente_pourcent);
  return finaliser({
    methode: 'Turrazza',
    tc_h,
    formule: 'tc (h) = 0.108 × (S(km²)×L(km))^(1/3) / I(%)^0.5',
    variables: { 'S (surface)': `${surface_km2} km²`, 'L (longueur)': `${longueur_km} km`, 'I (pente moyenne)': `${pente_pourcent} %` },
    domaine: 'Établie pour des bassins versants plus grands que les petits BV (cf. note du guide). À utiliser avec précaution < 100 km².',
    source: 'Guide §2.2.4-C p.16',
    avertissement:
      "Le classeur Excel fourni (cellule H22) applique cette même formule mais avec la pente en m/m au lieu de % " +
      '(voir README, point ambigu n°5), ce qui multiplie tc par 10. Cette fonction implémente la formule ' +
      "TELLE QU'ÉCRITE dans le guide (P en %).",
  });
}

/** Formule de Giandotti. S en km², L en km, H/H0 en m, tc en h. */
export function tcGiandotti({ surface_km2, longueur_km, altitudeMoyenne_m, altitudeMin_m }) {
  const denom = 0.8 * Math.sqrt(altitudeMoyenne_m - altitudeMin_m);
  if (!(denom > 0)) throw new Error("Giandotti : l'altitude moyenne doit être supérieure à l'altitude minimale.");
  const tc_h = (4 * Math.sqrt(surface_km2) + 1.5 * longueur_km) / denom;
  return finaliser({
    methode: 'Giandotti',
    tc_h,
    formule: 'tc (h) = (4×S(km²)^0.5 + 1.5×L(km)) / (0.8×√(Hmoy − H0))',
    variables: {
      'S (surface)': `${surface_km2} km²`,
      'L (longueur)': `${longueur_km} km`,
      'Hmoy (altitude moyenne, courbe hypsométrique)': `${altitudeMoyenne_m} m`,
      'H0 (altitude exutoire)': `${altitudeMin_m} m`,
    },
    domaine: "Décrite dans le guide (p.17) mais non exercée dans le classeur Excel de référence pour l'exemple fourni.",
    source: 'Guide §2.2.4-C p.17',
  });
}

/** Registre exploitable par l'UI pour lister dynamiquement les formules de tc disponibles. */
export const METHODES_TC = [
  { id: 'kirpich', nom: 'Kirpich', fn: tcKirpich, champs: ['longueur_m', 'pente_m_par_m'], recommandee: true },
  { id: 'espagnole', nom: 'Espagnole', fn: tcEspagnole, champs: ['longueur_km', 'pente_m_par_m'] },
  { id: 'californienne', nom: 'Californienne', fn: tcCalifornienne, champs: ['longueur_km', 'pente_m_par_m'] },
  { id: 'ventura', nom: 'Ventura', fn: tcVentura, champs: ['surface_km2', 'pente_m_par_m'] },
  { id: 'passini', nom: 'Passini', fn: tcPassini, champs: ['surface_km2', 'longueur_km', 'pente_pourcent'] },
  { id: 'turrazza', nom: 'Turrazza', fn: tcTurrazza, champs: ['surface_km2', 'longueur_km', 'pente_pourcent'] },
  { id: 'giandotti', nom: 'Giandotti', fn: tcGiandotti, champs: ['surface_km2', 'longueur_km', 'altitudeMoyenne_m', 'altitudeMin_m'] },
];

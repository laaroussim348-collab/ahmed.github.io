/**
 * rainfall.js
 * -----------------------------------------------------------------------
 * Grandeurs pluviométriques : intensité de Montana, hauteur de pluie de 24h.
 * Source : Guide §2.2.4-B « Intensité pluviométrique », p.14, et §2.2.2, p.7.
 * -----------------------------------------------------------------------
 */

/**
 * Intensité de la pluie de durée tc et de période de retour T, par la
 * formule de Montana.
 * @param {number} a  coefficient de Montana a(T) — valeur régionale, dépend de la station et de T
 * @param {number} b  coefficient de Montana b(T) — valeur régionale, dépend de la station et de T
 * @param {number} tc_h  temps de concentration, EN HEURES
 */
export function intensiteMontana({ a, b, tc_h }) {
  if (!(tc_h > 0)) throw new Error('tc doit être strictement positif pour calculer une intensité.');
  const i_mm_h = a * Math.pow(tc_h, -b);
  return {
    i_mm_h,
    formule: 'i(T,tc) = a(T) × tc(h)^-b(T)',
    application: `i = ${a} × ${tc_h}^-${b}`,
    variables: { a, b, tc_h },
    domaine: 'a et b sont des paramètres RÉGIONAUX (poste pluviométrique), établis pour des durées de 5 à 720 min.',
    source: "Guide §2.2.4-B p.14 ; Excel 'CARACT DE BV'!F29",
  };
}

/**
 * Hauteur de pluie de 24h obtenue par EXTRAPOLATION des coefficients de
 * Montana au-delà de leur domaine de validité usuel (Montana est en général
 * calée pour des durées ≤ 12h).
 *
 * ⚠️ Le guide déconseille explicitement cette approche (§2.2.2, p.7) :
 * « Cette grandeur ne peut pas être estimée par les paramètres de Montana
 * (...), car ces derniers sont établis pour des durées qui ne dépassent
 * pas 12h. L'extrapolation vers des durées plus grandes peut induire des
 * erreurs importantes, vu l'allure exponentielle des IDF. »
 *
 * C'est néanmoins la voie effectivement utilisée dans le classeur Excel de
 * référence (cellules 'calcule debit'!L5 et 'TR55'!I18) — voir le rapport
 * d'analyse, point ambigu n°2.
 */
export function hauteur24hParExtrapolationMontana({ a, b }) {
  const h24_mm = a * Math.pow(24, 1 - b);
  return {
    h24_mm,
    formule: 'H(24h) = a × 24^(1−b)   [ = 24 × a × 24^-b ]',
    application: `H(24h) = ${a} × 24^(1−${b})`,
    variables: { a, b },
    avertissement:
      "Le guide déconseille cette extrapolation des paramètres de Montana au-delà de 12h. Elle est fournie ici " +
      'uniquement car le classeur Excel de référence l\'utilise. Préférer hauteur24hParWeiss() dès que Pjmax(T) ' +
      'est disponible (ajustement statistique des pluies journalières maximales annuelles).',
    source: "Excel 'calcule debit'!L5, 'TR55'!I18",
  };
}

/**
 * Estimation du coefficient de Montana 'a' à partir de H24h et d'un
 * coefficient 'b' supposé (régional/littérature).
 *
 * ⚠️ IMPORTANT : une seule mesure (H24h, donc Pjmax) ne peut déterminer
 * qu'UN SEUL des 2 paramètres de Montana (i = a·t^-b a 2 degrés de
 * liberté). 'b' doit donc être fixé indépendamment — valeur régionale de
 * la littérature (exemples de ce projet : 0.55 « SET Maroc », 0.74
 * « Resigne »), ou calculé séparément à partir de données sub-journalières
 * (pluviomètre local, ou régression NASA POWER horaire — voir
 * src/services/rainfallEstimation.js).
 *
 * Dérivation : à t=24h, i(24h) = a×24^-b = H24h/24  =>  a = (H24h/24)×24^b
 */
export function montanaADepuisH24h({ h24_mm, b }) {
  if (!(h24_mm > 0)) throw new Error('H24h doit être strictement positif.');
  if (!(b > 0)) throw new Error('Le coefficient b doit être strictement positif.');
  const a = (h24_mm / 24) * Math.pow(24, b);
  return {
    a,
    formule: 'a = (H24h / 24) × 24^b',
    application: `a = (${h24_mm}/24) × 24^${b}`,
    variables: { h24_mm, b },
    avertissement:
      "Une seule mesure (H24h/Pjmax) ne peut déterminer qu'un seul des 2 paramètres de Montana : b doit être " +
      "fixé indépendamment (valeur régionale ou calculée séparément depuis des données sub-journalières).",
    source: 'Dérivé algébriquement de i(t)=a·t^-b à t=24h — pas un résultat direct du guide.',
  };
}

/**
 * Hauteur de pluie de 24h par la relation de Weiss — voie RECOMMANDÉE par le guide.
 * @param {number} pjmax_mm  quantile de pluie journalière maximale annuelle, période de retour T (mm)
 * @param {number} [coefficient=1.15]  coefficient régional (1.10 à 1.41 en zone ABHBC, 1.15 par défaut)
 */
export function hauteur24hParWeiss({ pjmax_mm, coefficient = 1.15 }) {
  const h24_mm = coefficient * pjmax_mm;
  return {
    h24_mm,
    formule: 'P(24h,T) = k × Pjmax(T)',
    application: `P(24h,T) = ${coefficient} × ${pjmax_mm}`,
    variables: { pjmax_mm, coefficient },
    domaine: 'k ≈ 1.15 par défaut (valeur régionale ; 1.1 à 1.41 observé en zone ABHBC).',
    source: 'Guide §2.2.2 p.7 (relation de Weiss) — voie recommandée par le guide',
  };
}

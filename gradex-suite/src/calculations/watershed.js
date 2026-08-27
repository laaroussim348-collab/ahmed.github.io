/**
 * watershed.js
 * -----------------------------------------------------------------------
 * Caractéristiques géométriques du bassin versant :
 *  - pente pondérée par tronçons (méthode Li/√Ii)
 *  - pente globale simple (dénivelée / longueur)
 *
 * Sources :
 *  - Guide technique d'assainissement routier 2020, §2.2.4-C, p.18
 *    (formule de pondération de la pente par tronçons)
 *  - Classeur Excel de référence, feuille "CARACT DE BV"
 *    (cellules F9:J13 pour la pente pondérée, I16 pour la pente globale)
 * -----------------------------------------------------------------------
 */

/**
 * Pente moyenne pondérée d'un cours d'eau composé de plusieurs tronçons
 * de pentes différentes.
 *
 * Formule (guide, p.18) :   1/√I = (1/ΣLi) × Σ(Li/√Ii)
 * Forme utilisée pour le calcul direct :   I = ( ΣLi / Σ(Li/√Ii) )²
 *
 * @param {number[]} altitudes_m  n+1 altitudes (m), de l'aval (exutoire) vers l'amont
 * @param {number[]} longueurs_m  n longueurs de tronçons (m), longueurs[i] entre altitudes[i] et altitudes[i+1]
 */
export function penteMoyennePonderee(altitudes_m, longueurs_m) {
  if (!Array.isArray(altitudes_m) || !Array.isArray(longueurs_m)) {
    throw new Error('altitudes_m et longueurs_m doivent être des tableaux');
  }
  if (altitudes_m.length !== longueurs_m.length + 1) {
    throw new Error(
      `Incohérence : ${altitudes_m.length} altitudes fournies pour ${longueurs_m.length} tronçon(s). ` +
      `Il faut exactement n+1 altitudes pour n tronçons.`
    );
  }
  if (longueurs_m.some((l) => !(l > 0))) {
    throw new Error('Chaque longueur de tronçon doit être strictement positive.');
  }

  let sommeL = 0;
  let sommeLSurRacineI = 0;
  const detail = [];

  for (let i = 0; i < longueurs_m.length; i++) {
    const li = longueurs_m[i];
    const hAmont = altitudes_m[i];
    const hAval = altitudes_m[i + 1];
    const deniveleeAbs = Math.abs(hAval - hAmont);
    const pentePourcent = (deniveleeAbs / li) * 100;
    if (pentePourcent === 0) {
      throw new Error(`Tronçon ${i + 1} : pente nulle (altitudes identiques) — impossible de calculer 1/√I.`);
    }
    const liSurRacineI = li / Math.sqrt(pentePourcent);
    sommeL += li;
    sommeLSurRacineI += liSurRacineI;
    detail.push({
      troncon: i + 1,
      longueur_m: li,
      altitude_amont_m: hAmont,
      altitude_aval_m: hAval,
      denivelee_m: deniveleeAbs,
      pente_pourcent: pentePourcent,
      li_sur_racine_i: liSurRacineI,
    });
  }

  const pente_pourcent = Math.pow(sommeL / sommeLSurRacineI, 2);

  return {
    pente_pourcent,
    pente_m_par_m: pente_pourcent / 100,
    longueur_totale_m: sommeL,
    somme_li_sur_racine_i: sommeLSurRacineI,
    detail,
    formule: 'I (%) = ( ΣLi / Σ(Li/√Ii) )²   [Ii en %]',
    source: "Guide §2.2.4-C p.18 ; Excel 'CARACT DE BV'!G13",
  };
}

/**
 * Pente globale simple : dénivelée totale / longueur du thalweg principal.
 * C'est cette pente (et non la pente pondérée par tronçons) qui est utilisée
 * par la formule de Kirpich, Espagnole, Californienne et Turrazza dans le
 * classeur Excel de référence (cellule I16).
 *
 * @param {number} altitudeMax_m
 * @param {number} altitudeMin_m  (exutoire)
 * @param {number} longueur_m     longueur du thalweg principal, en m
 */
export function penteGlobale(altitudeMax_m, altitudeMin_m, longueur_m) {
  if (!(longueur_m > 0)) throw new Error('La longueur doit être strictement positive.');
  if (altitudeMax_m <= altitudeMin_m) {
    throw new Error("L'altitude maximale doit être supérieure à l'altitude minimale (exutoire).");
  }
  const pente_m_par_m = (altitudeMax_m - altitudeMin_m) / longueur_m;
  return {
    pente_m_par_m,
    pente_pourcent: pente_m_par_m * 100,
    pente_pour_mille: pente_m_par_m * 1000,
    formule: 'I (m/m) = (Zmax − Zmin) / L',
    source: "Excel 'CARACT DE BV'!I16",
  };
}

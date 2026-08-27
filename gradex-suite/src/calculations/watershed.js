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
 * Indice de compacité de Gravelius (Ic), forme du bassin, coefficient Kh et
 * rectangle équivalent (L, l) — calculés automatiquement à partir de la
 * surface, du périmètre et de la longueur du thalweg principal déjà saisis
 * (aucune donnée supplémentaire à renseigner).
 *
 * Ic = 0.28 × P/√A                          forme : Ic > 1.12 → allongée, sinon compacte
 * Kh = 2 × A / L                            (A : km², L : longueur du thalweg principal, km)
 * L, l (rectangle équivalent, Gravelius) :
 *   L = (Ic×√A/1.12) × [1 + √(1 − (1.12/Ic)²)]
 *   l = (Ic×√A/1.12) × [1 − √(1 − (1.12/Ic)²)]
 *
 * @param {number} surface_km2
 * @param {number} perimetre_km
 * @param {number} [longueur_km]  longueur du thalweg principal (facultatif, pour Kh)
 * Source : Excel 'CAR DE BV'!H36:J38 (formule de Gravelius, standard en hydrologie).
 */
export function indiceCompacite(surface_km2, perimetre_km, longueur_km) {
  if (!(surface_km2 > 0)) throw new Error('La surface doit être strictement positive.');
  if (!(perimetre_km > 0)) throw new Error('Le périmètre doit être strictement positif.');

  const racineA = Math.sqrt(surface_km2);
  const Ic = 0.28 * (perimetre_km / racineA);
  const forme = Ic > 1.12 ? 'allongée' : 'compacte';

  let L_equiv_km = null;
  let l_equiv_km = null;
  const sousRacine = 1 - (1.12 / Ic) ** 2;
  if (sousRacine >= 0) {
    const base = (Ic * racineA) / 1.12;
    L_equiv_km = base * (1 + Math.sqrt(sousRacine));
    l_equiv_km = base * (1 - Math.sqrt(sousRacine));
  }

  const Kh = longueur_km > 0 ? (2 * surface_km2) / longueur_km : null;

  return {
    Ic, forme, Kh, L_equiv_km, l_equiv_km,
    formule: 'Ic = 0.28×P/√A ; L,l = (Ic×√A/1.12)×[1±√(1−(1.12/Ic)²)] ; Kh = 2A/L',
    source: "Excel 'CAR DE BV'!H36:J38",
  };
}

/**
 * Altitude moyenne pondérée par la surface (courbe hypsométrique simplifiée) :
 * pour chaque tranche d'altitude [altitude_bas ; altitude_haut] occupant une
 * surface Si, on prend l'altitude moyenne de la tranche (milieu), pondérée
 * par Si. Remplace une saisie manuelle unique de l'altitude moyenne par un
 * calcul à partir des surfaces par tranche (ex. sorties ArcGIS / QGIS
 * "zonal statistics").
 *
 * altitude_moyenne = Σ[Si × (altitude_bas_i + altitude_haut_i)/2] / ΣSi
 *
 * @param {{altitude_bas:number, altitude_haut:number, surface_km2:number}[]} tranches
 * Source : Excel 'CAR DE BV'!F41:I57 ("COURBE HYPSOMETRIQUE").
 */
export function altitudeMoyennePonderee(tranches) {
  const valides = (tranches || []).filter((t) =>
    t.altitude_bas !== '' && t.altitude_haut !== '' && t.surface_km2 !== '' &&
    t.altitude_bas != null && t.altitude_haut != null && t.surface_km2 != null &&
    !Number.isNaN(Number(t.altitude_bas)) && !Number.isNaN(Number(t.altitude_haut)) && !Number.isNaN(Number(t.surface_km2))
  );
  if (!valides.length) throw new Error('Aucune tranche altitudinale valide (altitude bas, altitude haut, surface).');

  let sommeSurfaces = 0;
  let sommePondere = 0;
  const detail = valides.map((t) => {
    const bas = Number(t.altitude_bas);
    const haut = Number(t.altitude_haut);
    const s = Number(t.surface_km2);
    if (haut <= bas) throw new Error(`Tranche invalide : altitude haute (${haut}) ≤ altitude basse (${bas}).`);
    if (!(s > 0)) throw new Error('Chaque surface de tranche doit être strictement positive.');
    const milieu = (bas + haut) / 2;
    const pondere = s * milieu;
    sommeSurfaces += s;
    sommePondere += pondere;
    return { altitude_bas: bas, altitude_haut: haut, surface_km2: s, altitude_milieu: milieu, pondere };
  });

  const altitudeMoyenne_m = sommePondere / sommeSurfaces;
  return {
    altitudeMoyenne_m,
    surfaceTotale_km2: sommeSurfaces,
    detail,
    formule: 'Zmoy = Σ[Si×(Zbas_i+Zhaut_i)/2] / ΣSi',
    source: "Excel 'CAR DE BV'!F41:I57 (courbe hypsométrique)",
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

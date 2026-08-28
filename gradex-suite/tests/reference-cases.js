/**
 * reference-cases.js
 * -----------------------------------------------------------------------
 * Valeurs extraites TELLES QUELLES du classeur ETUDE_HYDROLOGIE.xlsx fourni
 * (bassin versant unique : S=79.538846624038 km², périmètre=42.864122 km,
 * thalweg principal=14.99678 km) et de l'exemple chiffré du guide (p.32-33,
 * bassin de 25 km² indépendant, pour la méthode TR-55).
 *
 * Chaque cas indique la cellule Excel d'origine, pour permettre une
 * re-vérification manuelle en cas de doute.
 * -----------------------------------------------------------------------
 */

export const BV_EXCEL = {
  surface_km2: 79.538846624038, // 'CARACT DE BV'!F5
  perimetre_km: 42.864122, // 'CARACT DE BV'!G5
  longueur_thalweg_km: 14.99678, // 'CARACT DE BV'!H5 (=H16)
  altitude_min_m: 957, // 'CARACT DE BV'!I20
  altitude_max_m: 3865, // 'CARACT DE BV'!I22
  troncons: {
    // 'CARACT DE BV'!F9:J12 — pente pondérée par tronçons
    altitudes_m: [957, 1000, 2000, 3856],
    longueurs_m: [509.392485, 12879.766303, 1607.25],
    pente_pourcent_attendue: 9.188608520958748, // G13
  },
};

// Second bassin de référence : classeur CALCULE_DEBIT_OUED_IGHI.xlsx (fourni
// le 27/08/2026), utilisé pour vérifier les fonctions ajoutées après coup
// (indice de compacité / rectangle équivalent / altitude moyenne pondérée
// par courbe hypsométrique) et pour re-vérifier TR-55 sur un 2e cas complet.
export const BV_IGHI_EXCEL = {
  surface_km2: 202.519508, // 'CAR DE BV'!F6
  perimetre_km: 70.938858, // 'CAR DE BV'!G6
  longueur_thalweg_km: 23.619052, // 'CAR DE BV'!H6
  compacite: {
    Ic_attendu: 1.3957537144154113, // 'CAR DE BV'!H36
    forme_attendue: 'allongée', // 'CAR DE BV'!I36
    Kh_attendu: 17.14882612562096, // 'CAR DE BV'!J36
    L_equiv_km_attendu: 28.31774763783483, // 'CAR DE BV'!F38
    l_equiv_km_attendu: 7.151681362165166, // 'CAR DE BV'!G38
  },
  hypsometrie: {
    // 'CAR DE BV'!F42:I57 — tranches [altitude_bas ; altitude_haut] et surface (km²)
    tranches: [
      { altitude_bas: 1191, altitude_haut: 1500, surface_km2: 18.5474905193 },
      { altitude_bas: 1500, altitude_haut: 2000, surface_km2: 76.3644105924 },
      { altitude_bas: 2000, altitude_haut: 2500, surface_km2: 70.674358379 },
      { altitude_bas: 2500, altitude_haut: 3000, surface_km2: 31.0157649482 },
      { altitude_bas: 3000, altitude_haut: 3248, surface_km2: 5.91392919582 },
    ],
    // Écart de 0.04m (0.002%) avec 'CAR DE BV'!G57 (2080.684...) dû à la
    // convention de bornage des tranches extrêmes du classeur (décalage
    // d'une ligne entre F52:G56) ; formule mathématiquement équivalente,
    // tolérance élargie ci-dessous.
    altitudeMoyenne_m_attendue: 2080.684206473876,
  },
  tr55: {
    // 'TR55' — CN(I) déjà calculé par le classeur (coefficient 0.085, non
    // repris ici — voir README) ; on part directement de ce CN(I) transcrit
    // pour vérifier uniquement le moteur TR-55 (S, Ia, Pe, C0/C1/C2, k, qu, Qp).
    entrees: { surface_km2: 202.519508, CN: 64.04617051813248, p24_mm: 114, tc_h: 1.9382344242605813 },
    attendu: { q_m3s: 560.8160679541742 }, // 'TR55'!E5
  },
};

export const CAS_REFERENCE = [
  {
    categorie: 'tc',
    methode: 'kirpich',
    entrees: { longueur_m: 14996.78, pente_m_par_m: 0.19390829231341664 },
    attendu: { tc_min: 60.23216588153955 },
    cellule: "'CARACT DE BV'!H17",
  },
  {
    categorie: 'tc',
    methode: 'espagnole',
    entrees: { longueur_km: 14.99678, pente_m_par_m: 0.19390829231341664 },
    attendu: { tc_min: 198.57687750659414 },
    cellule: "'CARACT DE BV'!H18",
  },
  {
    categorie: 'tc',
    methode: 'californienne',
    entrees: { longueur_km: 14.99678, pente_m_par_m: 0.19390829231341664 },
    attendu: { tc_min: 131.7988848114183 },
    cellule: "'CARACT DE BV'!H19",
  },
  {
    categorie: 'tc',
    methode: 'ventura',
    entrees: { surface_km2: 79.538846624038, pente_m_par_m: 0.19390829231341664 },
    attendu: { tc_min: 154.53113401624339 },
    cellule: "'CARACT DE BV'!H20",
  },
  // Passini et Turrazza : vérifiées contre les exemples numériques du document
  // utilisateur « Calcul de temps de concentration » (formules et coefficients
  // corrigés suite à cette source — voir concentrationTime.js).
  {
    categorie: 'tc',
    methode: 'passini',
    entrees: { surface_km2: 4.55, longueur_km: 18.08, pente_pourcent: 0.5 },
    attendu: { tc_min: 397.9741599 },
    cellule: "Document utilisateur « Calcul de temps de concentration »",
  },
  {
    categorie: 'tc',
    methode: 'turrazza',
    entrees: { surface_km2: 1.3, longueur_km: 1.94, pente_m_par_m: 0.047 },
    attendu: { tc_min: 40.68563553 },
    cellule: "Document utilisateur « Calcul de temps de concentration »",
  },

  {
    categorie: 'rainfall_intensite',
    entrees: { a: 18.6, b: 0.55, tc_h: 1.0038694313589924 },
    attendu: { i_mm_h: 18.560534033824027 },
    cellule: "'CARACT DE BV'!F29",
  },
  {
    categorie: 'rainfall_h24_montana',
    entrees: { a: 18.6, b: 0.55 },
    attendu: { h24_mm: 77.73346070475161 },
    cellule: "'calcule debit'!L5",
  },

  {
    categorie: 'methode',
    methode: 'rationnelle',
    entrees: { surface_km2: 79.538846624038, cr: 0.81, a: 18.6, b: 0.55, tc_h: 1.0038694313589924, T: 100 },
    attendu: { q_m3s: 332.1637806997275 },
    cellule: "'calcule debit'!G15",
  },
  {
    // Convention EXCEL (A ha, P ‰) — DÉFAUT depuis le 13/08/2026, confirmée par 2 exemples de
    // calcul réels concordants (classeur Excel + Formules_empiriques_100242.pdf, "BASSIN VERSANT 1").
    categorie: 'methode',
    methode: 'macMath',
    entrees: { surface_km2: 79.538846624038, h24_mm: 77.73346070475161, pente_m_par_m: 0.19390829231341664, K: 0.43 },
    attendu: { q_m3s: 55.8720978649924 },
    cellule: "'calcule debit'!P6 (défaut) ; recoupé indépendamment par Formules_empiriques_100242.pdf",
  },
  {
    // Convention littérale du guide (A km², P m/m) — disponible en option, non comparable à un
    // exemple chiffré indépendant (voir README §7).
    categorie: 'methode',
    methode: 'macMath',
    entrees: { surface_km2: 79.538846624038, h24_mm: 77.73346070475161, pente_m_par_m: 0.19390829231341664, K: 0.43, conventionUnites: 'guide' },
    attendu: { q_m3s: 212.42367917629366 },
    cellule: "Guide p.7, application directe (A km², P m/m) — option, PAS le défaut",
  },
  {
    categorie: 'methode',
    methode: 'burkliZiegler',
    entrees: { surface_km2: 79.538846624038, h1h_mm: 18.6, pente_m_par_m: 0.193908292313417, cr: 0.81 },
    attendu: { q_m3s: 184.6699077994979 },
    cellule: "'calcule debit'!G27",
  },
  {
    categorie: 'methode',
    methode: 'malletGautier',
    entrees: { K: 2, a: 20, pma_m_an: 0.403, surface_km2: 79.538846624038, T: 100, longueur_km: 14.99678 },
    attendu: { q_m3s: 209.518240257088 },
    cellule: "'calcule debit'!H5",
  },
  {
    categorie: 'methode',
    methode: 'fullerII',
    entrees: { a: 2, T: 100, surface_km2: 79.538846624038, N: 100 },
    attendu: { q_m3s: 379.54008929814813 },
    cellule: "'calcule debit'!G10",
  },
  {
    categorie: 'methode',
    methode: 'hazanLazarevich',
    entrees: { pma_mm_an: 403, surface_km2: 79.538846624038, a: 1, T: 100 },
    attendu: { q_m3s: 131.84658995756058 },
    cellule: "'calcule debit'!G20",
  },
  {
    categorie: 'methode',
    methode: 'tr55',
    entrees: { surface_km2: 79.538846624038, CN: 88, p24_mm: 77.73346070475161, tc_h: 1.0038694313589924 },
    attendu: { q_m3s: 564.8055088947795 },
    cellule: "'TR55'!E5",
  },
  {
    // Second cas TR-55, indépendant du bassin ci-dessus : exemple entièrement
    // rédigé dans le guide lui-même (p.32-33), utile pour confirmer que le
    // moteur ne "colle" pas seulement à un unique jeu de données.
    categorie: 'methode',
    methode: 'tr55',
    entrees: { surface_km2: 25, CN: 80, p24_mm: 100, tc_h: 40 / 60 },
    attendu: { q_m3s: 240 },
    tolerancePourcent: 3, // le guide arrondit qu=0.19 et Pe=50.5mm dans son texte
    cellule: 'Guide p.32-33 (exemple rédigé, CN=80, A=25km², tc=40min, P=100mm)',
  },

  // -----------------------------------------------------------------
  // Cas issus de Formules_empiriques_100242.pdf ("CALCUL DU DEBIT
  // D'APPORT DU BASSIN VERSANT 1"), document fourni le 13/08/2026,
  // désigné comme source de PREMIÈRE priorité. Bassin indépendant de
  // celui de l'Excel (S≈44-85km² selon la méthode, pluviométrie
  // ~200-400mm/an) — validation croisée sur un 2e cas réel.
  // -----------------------------------------------------------------
  {
    categorie: 'methode',
    methode: 'malletGautier',
    entrees: { K: 2, a: 20, pma_m_an: 0.251, surface_km2: 44.01, T: 10, longueur_km: 13.249 },
    attendu: { q_m3s: 69.08 },
    tolerancePourcent: 0.05,
    cellule: 'Formules_empiriques_100242.pdf, formule de Mallet-Gautier',
  },
  {
    categorie: 'methode',
    methode: 'fullerII',
    entrees: { a: 1, T: 10, surface_km2: 44.01, N: 85 },
    attendu: { q_m3s: 86.897 },
    cellule: 'Formules_empiriques_100242.pdf, formule de Fuller II (ligne 1)',
  },
  {
    categorie: 'methode',
    methode: 'fullerII',
    entrees: { a: 1, T: 100, surface_km2: 85.38, N: 80 },
    attendu: { q_m3s: 191.112 },
    cellule: 'Formules_empiriques_100242.pdf, formule de Fuller II (ligne 2)',
  },
  {
    categorie: 'methode',
    methode: 'hazanLazarevich',
    // Pma dans la tranche 200-400mm/an (K1=9.38, K2=0.742) -> Q1000=254.255, confirmé par le document
    entrees: { pma_mm_an: 300, surface_km2: 85.38, a: 1, T: 1000 },
    attendu: { q_m3s: 254.255 },
    tolerancePourcent: 0.05,
    cellule: 'Formules_empiriques_100242.pdf, formule de Hazan et Lazarevich (Q1000, zone 200-400mm/an)',
  },
  {
    categorie: 'methode',
    methode: 'rationnelle',
    entrees: { surface_km2: 6.04, cr: 0.52, a: 21.2, b: 0.62, tc_h: 1.03, T: 10 },
    attendu: { q_m3s: 18.204 },
    tolerancePourcent: 0.3, // a/b/tc affichés arrondis dans le document source
    cellule: 'Formules_empiriques_100242.pdf, méthode Rationnelle (ligne 1)',
  },
  {
    categorie: 'methode',
    methode: 'rationnelle',
    entrees: { surface_km2: 15.62, cr: 0.3, a: 45.1, b: 0.73, tc_h: 7.87, T: 10 },
    attendu: { q_m3s: 13.020 },
    cellule: 'Formules_empiriques_100242.pdf, méthode Rationnelle (ligne 2)',
  },
  {
    categorie: 'methode',
    methode: 'burkliZiegler',
    entrees: { surface_km2: 1.75, h1h_mm: 636, pente_m_par_m: 0.1383, cr: 0.72 },
    attendu: { q_m3s: 294.672 },
    cellule: 'Formules_empiriques_100242.pdf, formule de Burkli-Ziegler',
  },
];

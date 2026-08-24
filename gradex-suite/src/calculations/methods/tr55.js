/**
 * Méthode Graphique SCS (TR-55)
 * -----------------------------------------------------------------------
 * S      = 25400/CN − 254                                    (mm)
 * Ia     = 0.2 × S                                            (mm)
 * Pe     = (P − Ia)² / (P − Ia + S)  =  (P − 0.2S)² / (P + 0.8S)   (mm)
 * Ia/P   → (C0, C1, C2) par régression polynomiale (averse type II)
 * k      = C0 + C1×log10(tc) + C2×log10(tc)²
 * qu     = Cf × 10^k     avec Cf = 4.3e-4 (système SI)
 * Qp     = qu × A × Pe
 *
 * Domaine de validité (guide, p.32) :
 *  (1) CN homogène sur tout le bassin, CN > 50 ;
 *  (2) tc compris entre 0.1h et 10h ;
 *  (3) un seul cours d'eau, ou deux de tc voisins ;
 *  (4) Ia/P compris entre 0.1 et 0.5, pluie SCS de durée 24h.
 *
 * Les coefficients (C0,C1,C2) ci-dessous sont les régressions polynomiales
 * EXACTES du classeur Excel de référence (feuille 'TR55', lignes 12-13),
 * ajustées sur la table numérique complète (Ia/P de 0.10 à 0.50, feuille
 * 'TR55' lignes 17-25) que le guide (p.31) ne fournit que sous forme
 * d'image (non transcrite par l'OCR). Le guide recommande explicitement
 * ce type d'ajustement polynomial (p.32) : « des polynômes d'ordre 4
 * présentent des lissages très satisfaisants » — les degrés effectivement
 * utilisés par le classeur Excel sont 2 (C0), 2 (C1) et 6 (C2).
 * -----------------------------------------------------------------------
 */
import { valider } from '../validation.js';

export const META = {
  id: 'tr55',
  nom: 'Méthode Graphique SCS (TR-55)',
  domaine: 'CN homogène > 50 ; tc entre 0.1h et 10h ; Ia/P entre 0.1 et 0.5 ; pluie SCS de type II, durée 24h ; un seul cours d\'eau (ou deux de tc voisins).',
  source: "Guide §2.2.6, p.30-32 ; Excel feuille 'TR55'",
  champs: [
    { cle: 'surface_km2', label: 'Surface du bassin de drainage (A)', unite: 'km²' },
    { cle: 'CN', label: 'Curve Number (CN)', unite: '' },
    { cle: 'p24_mm', label: 'Pluie de 24h, période de retour T (P)', unite: 'mm' },
    { cle: 'tc_h', label: 'Temps de concentration (tc)', unite: 'h' },
  ],
};

/** S = 25400/CN − 254 (mm) — Guide p.27 & p.32 */
export function retentionMaximale(CN) {
  if (!(CN > 0 && CN <= 100)) throw new Error('CN doit être compris entre 0 et 100.');
  return (25400 - 254 * CN) / CN;
}

// Régressions polynomiales C0(Ia/P), C1(Ia/P), C2(Ia/P) — averse type II,
// identiques à Excel 'TR55'!B13:D13.
function c0(x) { return -2.0628 * x ** 2 + 0.412 * x + 2.5214; }
function c1(x) { return 1.3998 * x ** 2 - 0.6457 * x - 0.555; }
function c2(x) {
  return 11066 * x ** 6 - 19996 * x ** 5 + 14272 * x ** 4 - 5112.4 * x ** 3 + 963.85 * x ** 2 - 89.965 * x + 3.0694;
}

export function calculer({ surface_km2, CN, p24_mm, tc_h }) {
  valider({ surface_km2, tc_h });
  if (!(p24_mm > 0)) throw new Error('La pluie de 24h (P) doit être strictement positive.');
  if (!(CN > 50 && CN <= 100)) {
    throw new Error("Le guide impose CN > 50 pour la méthode TR-55 (CN homogène sur tout le bassin).");
  }
  if (tc_h < 0.1 || tc_h > 10) {
    throw new Error('Le guide limite la méthode TR-55 à des tc compris entre 0.1h et 10h.');
  }

  const etapes = [];

  const S = retentionMaximale(CN);
  const Ia = 0.2 * S;
  etapes.push({
    titre: '1. Rétention potentielle maximale et perte initiale',
    formule: 'S = 25400/CN − 254   ;   Ia = 0.2 × S',
    application: `S = 25400/${CN} − 254 = ${S.toFixed(4)} mm  ;  Ia = 0.2 × ${S.toFixed(4)} = ${Ia.toFixed(4)} mm`,
    resultat: `S = ${S.toFixed(4)} mm, Ia = ${Ia.toFixed(4)} mm`,
  });

  const IaSurP = Ia / p24_mm;
  if (IaSurP < 0.1 || IaSurP > 0.5) {
    etapes.push({
      titre: 'Avertissement de domaine de validité',
      formule: '',
      application: '',
      resultat: `Ia/P = ${IaSurP.toFixed(4)} est HORS du domaine recommandé par le guide [0.1 ; 0.5].`,
    });
  }

  const Pe = Math.pow(p24_mm - Ia, 2) / (p24_mm - Ia + S);
  etapes.push({
    titre: "2. Pluie efficace (ruissellement)",
    formule: 'Pe = (P − Ia)² / (P − Ia + S)',
    application: `Pe = (${p24_mm} − ${Ia.toFixed(4)})² / (${p24_mm} − ${Ia.toFixed(4)} + ${S.toFixed(4)})`,
    resultat: `Pe = ${Pe.toFixed(4)} mm`,
  });

  const C0 = c0(IaSurP);
  const C1 = c1(IaSurP);
  const C2 = c2(IaSurP);
  etapes.push({
    titre: '3. Coefficients C0, C1, C2 (régression polynomiale, averse type II)',
    formule: 'C0(Ia/P), C1(Ia/P), C2(Ia/P) — régressions polynomiales ajustées sur la table du guide (p.31)',
    application: `Ia/P = ${IaSurP.toFixed(4)} → C0=${C0.toFixed(5)}, C1=${C1.toFixed(5)}, C2=${C2.toFixed(5)}`,
    resultat: `C0=${C0.toFixed(5)}, C1=${C1.toFixed(5)}, C2=${C2.toFixed(5)}`,
  });

  const k = C0 + C1 * Math.log10(tc_h) + C2 * Math.pow(Math.log10(tc_h), 2);
  const Cf = 4.3e-4;
  const qu = Cf * Math.pow(10, k);
  etapes.push({
    titre: '4. Débit unitaire qu',
    formule: 'k = C0 + C1×log10(tc) + C2×log10(tc)²   ;   qu = Cf × 10^k  (Cf = 4.3×10⁻⁴, système SI)',
    application: `k = ${C0.toFixed(5)} + ${C1.toFixed(5)}×log10(${tc_h}) + ${C2.toFixed(5)}×log10(${tc_h})² = ${k.toFixed(5)}`,
    resultat: `qu = ${qu.toFixed(6)}`,
  });

  const q_m3s = qu * surface_km2 * Pe;
  etapes.push({
    titre: '5. Débit de pointe',
    formule: 'Qp = qu × A × Pe',
    application: `Qp = ${qu.toFixed(6)} × ${surface_km2} × ${Pe.toFixed(4)}`,
    resultat: `Qp = ${q_m3s.toFixed(4)} m³/s`,
  });

  return {
    methode: META.nom,
    q_m3s,
    etapes,
    parametresEntree: { surface_km2, CN, p24_mm, tc_h },
    resultatsIntermediaires: { S, Ia, IaSurP, Pe, C0, C1, C2, k, qu },
    hypotheses: ['Averse de type II (recommandée par le guide en absence de distribution temporelle régionale mieux connue).', 'CN supposé homogène sur tout le bassin.'],
    source: META.source,
  };
}

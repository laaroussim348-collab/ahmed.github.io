/**
 * runoff.js
 * -----------------------------------------------------------------------
 * Lecture de la table des coefficients de ruissellement Cr et calcul du
 * Cr pondéré pour un bassin versant composé de plusieurs sous-bassins.
 * Source : Guide §2.2.4-A, p.9 et 13.
 * -----------------------------------------------------------------------
 */
import { TABLE_RUISSELLEMENT, PERIODES_RETOUR_TABULEES, OCCUPATIONS_SOL } from '../data/coefficientsRuissellement.js';

/**
 * @param {number} code        code d'occupation du sol (1 à 5, cf. OCCUPATIONS_SOL)
 * @param {'grossiers'|'moyens'|'fins'} groupeSol  groupe hydrologique de sol
 * @param {'<=5%'|'5-10%'|'10-30%'|'>30%'} penteClass classe de pente
 * @param {number} T            période de retour en années (10, 20, 50 ou 100)
 */
export function getCr({ code, groupeSol, penteClass, T }) {
  const idxT = PERIODES_RETOUR_TABULEES.indexOf(Number(T));
  if (idxT === -1) {
    throw new Error(
      `Période de retour T=${T} ans non tabulée dans le guide (valeurs disponibles : ${PERIODES_RETOUR_TABULEES.join(', ')} ans).`
    );
  }
  if (!OCCUPATIONS_SOL[code]) {
    throw new Error(`Code d'occupation du sol invalide : ${code} (attendu 1 à 5).`);
  }

  let ligne = TABLE_RUISSELLEMENT.find((e) => e.code === Number(code) && e.penteClass === penteClass);
  if (!ligne) throw new Error(`Combinaison code=${code} / pente=${penteClass} introuvable dans la table.`);

  let valeurs = ligne[groupeSol];
  let penteClasseUtilisee = penteClass;
  let repli = false;

  if (!valeurs && penteClass === '>30%') {
    // Le guide autorise, en l'absence de valeur pour P>30%, d'utiliser la
    // tranche 10%<P<=30% comme valeur MINIMALE (note de bas de tableau, p.13).
    const ligneRepli = TABLE_RUISSELLEMENT.find((e) => e.code === Number(code) && e.penteClass === '10-30%');
    valeurs = ligneRepli ? ligneRepli[groupeSol] : null;
    penteClasseUtilisee = '10-30% (repli réglementaire pour P>30%, cf. guide p.13)';
    repli = true;
  }

  if (!valeurs) {
    throw new Error(
      `Aucun coefficient de ruissellement disponible dans le guide pour code=${code}, sol=${groupeSol}, pente=${penteClass}. ` +
      `Vérifier la table (guide p.13) ou saisir un Cr manuellement.`
    );
  }

  return {
    cr: valeurs[idxT],
    code,
    libelle: OCCUPATIONS_SOL[code],
    groupeSol,
    penteClasseUtilisee,
    repliApplique: repli,
    T,
    source: 'Guide, Table Enveloppe des coefficients de ruissellement, p.13',
  };
}

/**
 * Coefficient de ruissellement pondéré d'un bassin versant hétérogène.
 * Formule : Cr(BV) = Σ(Cri × SBVi) / Σ(SBVi)
 * @param {{cr:number, surface_km2:number}[]} sousBassins
 */
export function crPondere(sousBassins) {
  if (!Array.isArray(sousBassins) || sousBassins.length === 0) {
    throw new Error('Il faut au moins un sous-bassin pour calculer un Cr pondéré.');
  }
  const sommeS = sousBassins.reduce((s, b) => s + b.surface_km2, 0);
  if (!(sommeS > 0)) throw new Error('La surface totale des sous-bassins doit être positive.');
  const sommeCrS = sousBassins.reduce((s, b) => s + b.cr * b.surface_km2, 0);
  return {
    cr: sommeCrS / sommeS,
    surfaceTotale_km2: sommeS,
    detail: sousBassins,
    formule: 'Cr(BV) = Σ(Cri × SBVi) / Σ(SBVi)',
    source: 'Guide §2.2.4-A p.9',
  };
}

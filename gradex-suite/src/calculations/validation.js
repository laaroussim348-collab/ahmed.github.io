/**
 * validation.js
 * -----------------------------------------------------------------------
 * Validation générique des données d'entrée (cahier des charges §9).
 * Chaque règle renvoie un message d'erreur EN FRANÇAIS, compréhensible par
 * un ingénieur, et jamais une exception JS brute.
 * -----------------------------------------------------------------------
 */

export class ErreurValidation extends Error {
  constructor(messages) {
    super(Array.isArray(messages) ? messages.join(' | ') : messages);
    this.name = 'ErreurValidation';
    this.messages = Array.isArray(messages) ? messages : [messages];
  }
}

const REGLES = {
  surface_km2: (v) => (v > 0 ? null : 'La surface du bassin versant doit être strictement positive.'),
  longueur_km: (v) => (v > 0 ? null : 'La longueur du thalweg doit être strictement positive.'),
  longueur_m: (v) => (v > 0 ? null : 'La longueur du thalweg doit être strictement positive.'),
  pente_m_par_m: (v) => (v > 0 ? null : 'La pente moyenne doit être strictement positive (vérifier Zmax > Zmin).'),
  pente_pourcent: (v) => (v > 0 ? null : 'La pente moyenne doit être strictement positive (vérifier Zmax > Zmin).'),
  tc_h: (v) => (v > 0 ? null : 'Le temps de concentration doit être strictement positif.'),
  tc_min: (v) => (v > 0 ? null : 'Le temps de concentration doit être strictement positif.'),
  cr: (v) => (v > 0 && v <= 1 ? null : 'Le coefficient de ruissellement Cr doit être compris entre 0 (exclu) et 1.'),
  T: (v) => (v > 0 ? null : 'La période de retour T doit être strictement positive.'),
  CN: (v) => (v > 0 && v <= 100 ? null : 'Le Curve Number CN doit être compris entre 0 et 100 (>50 pour la méthode TR-55).'),
};

/**
 * Valide un objet de champs { cle: valeur } selon les règles connues.
 * Les champs sans règle définie ne sont pas bloqués (validation permissive
 * par défaut, complétée au cas par cas dans chaque méthode).
 * @throws {ErreurValidation} si au moins un champ est invalide
 */
export function valider(champs) {
  const erreurs = [];
  for (const [cle, valeur] of Object.entries(champs)) {
    if (valeur === undefined || valeur === null || valeur === '') {
      erreurs.push(`Champ obligatoire manquant : "${cle}".`);
      continue;
    }
    if (typeof valeur === 'number' && Number.isNaN(valeur)) {
      erreurs.push(`Champ "${cle}" : valeur numérique invalide.`);
      continue;
    }
    const regle = REGLES[cle];
    if (regle) {
      const message = regle(valeur);
      if (message) erreurs.push(`Champ "${cle}" (=${valeur}) : ${message}`);
    }
  }
  if (erreurs.length > 0) throw new ErreurValidation(erreurs);
  return true;
}

/** Vérifie qu'un ensemble de clés obligatoires est bien présent dans l'objet. */
export function verifierChampsObligatoires(objet, clesObligatoires) {
  const manquants = clesObligatoires.filter((cle) => objet[cle] === undefined || objet[cle] === null || objet[cle] === '');
  if (manquants.length > 0) {
    throw new ErreurValidation(manquants.map((c) => `Champ obligatoire manquant : "${c}".`));
  }
}

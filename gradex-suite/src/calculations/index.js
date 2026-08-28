/**
 * index.js — Registre central des méthodes de calcul du débit de pointe.
 * -----------------------------------------------------------------------
 * Toute nouvelle méthode s'ajoute ici (cahier des charges §5 : « créer une
 * architecture permettant d'ajouter plusieurs méthodes »). Chaque entrée
 * expose META (métadonnées + champs requis) et calculer() (le moteur).
 * -----------------------------------------------------------------------
 */
import * as Rationnelle from './methods/rationnelle.js';
import * as MacMath from './methods/macMath.js';
import * as BurkliZiegler from './methods/burkliZiegler.js';
import * as MalletGautier from './methods/malletGautier.js';
import * as FullerII from './methods/fullerII.js';
import * as HazanLazarevich from './methods/hazanLazarevich.js';
import * as TR55 from './methods/tr55.js';
import * as FrancouRodier from './methods/francouRodier.js';

export const METHODES = [
  { meta: Rationnelle.META, calculer: Rationnelle.calculer },
  { meta: MacMath.META, calculer: MacMath.calculer },
  { meta: BurkliZiegler.META, calculer: BurkliZiegler.calculer },
  { meta: TR55.META, calculer: TR55.calculer },
  { meta: MalletGautier.META, calculer: MalletGautier.calculer },
  { meta: FullerII.META, calculer: FullerII.calculer },
  { meta: HazanLazarevich.META, calculer: HazanLazarevich.calculer },
  { meta: FrancouRodier.META, calculer: FrancouRodier.calculer },
];

export function getMethode(id) {
  const m = METHODES.find((m) => m.meta.id === id);
  if (!m) throw new Error(`Méthode inconnue : "${id}"`);
  return m;
}

export * as watershed from './watershed.js';
export * as concentrationTime from './concentrationTime.js';
export * as rainfall from './rainfall.js';
export * as runoff from './runoff.js';
export * as units from './units.js';
export { valider, ErreurValidation } from './validation.js';

// ============================================================
//  useI18n.js — petit hook React autour de i18n.js : redéclenche
//  le rendu quand la langue change, et applique le sens RTL/LTR
//  sur <html> (comme le faisait public/js/activation.js dans BV-Calc).
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { t, langueActuelle, definirLangue, metaMethode, RTL, LANGUES, NOMS_LANGUES } from './i18n';

export function useI18n() {
  const [langue, setLangueState] = useState(langueActuelle());

  useEffect(() => {
    document.documentElement.lang = langue;
    document.documentElement.dir = RTL[langue] ? 'rtl' : 'ltr';
  }, [langue]);

  const changerLangue = useCallback((code) => {
    definirLangue(code);
    setLangueState(code);
  }, []);

  return {
    langue,
    changerLangue,
    rtl: !!RTL[langue],
    t,
    metaMethode,
    LANGUES,
    NOMS_LANGUES,
  };
}

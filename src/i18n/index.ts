import { createContext, useContext } from 'react';
import { en, type TranslationDict, type TranslationKey } from './en';

export type { TranslationKey } from './en';

export interface Language {
  code: string;
  name: string;
  dir: 'ltr' | 'rtl';
  dict: TranslationDict;
}

/**
 * Language registry. Adding a language is a one-file change plus an entry here.
 * RTL languages (Arabic, Hebrew, …) just set `dir: 'rtl'` — the whole layout is
 * built with logical CSS properties so it mirrors automatically.
 */
export const LANGUAGES: Record<string, Language> = {
  en: { code: 'en', name: 'English', dir: 'ltr', dict: en },
  // ar: { code: 'ar', name: 'العربية', dir: 'rtl', dict: ar },
};

export const DEFAULT_LANGUAGE = 'en';

type Vars = Record<string, string | number>;

export function translate(dict: TranslationDict, key: TranslationKey, vars?: Vars): string {
  let out: string = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}

export interface I18n {
  lang: Language;
  t: (key: TranslationKey, vars?: Vars) => string;
}

export const I18nContext = createContext<I18n>({
  lang: LANGUAGES.en,
  t: (key, vars) => translate(en, key, vars),
});

export function useI18n(): I18n {
  return useContext(I18nContext);
}

export function useT(): I18n['t'] {
  return useContext(I18nContext).t;
}

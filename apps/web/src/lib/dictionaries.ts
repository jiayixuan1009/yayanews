import 'server-only';

const dictionaries = {
  en: () => import('../dictionaries/en.json').then((module) => module.default),
  zh: () => import('../dictionaries/zh.json').then((module) => module.default),
};

export type Locale = keyof typeof dictionaries;
export type Dictionary = Awaited<ReturnType<(typeof dictionaries)[Locale]>>;

function isLocale(value: string): value is Locale {
  return value === 'en' || value === 'zh';
}

/**
 * Load a locale dictionary. Accepts any string (e.g. `params.lang` from a
 * dynamic Next.js route segment) and falls back to Chinese if the value is
 * not a known locale. This keeps call sites free of `as any` casts.
 */
export const getDictionary = async (locale: string): Promise<Dictionary> => {
  if (isLocale(locale)) {
    return dictionaries[locale]();
  }
  return dictionaries.zh();
};

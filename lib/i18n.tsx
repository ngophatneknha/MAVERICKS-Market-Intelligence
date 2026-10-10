'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translate, type Locale } from './translations';

export type { Locale } from './translations';
export { translate } from './translations';
const languageKey = 'mavericks.locale.v1';
type Variables = Record<string, string | number>;
type LanguageState = { locale: Locale; setLocale: (locale: Locale) => void };
const LanguageContext = createContext<LanguageState>({ locale: 'vi', setLocale: () => undefined });

/** Language only changes product copy and formatting; source records remain untouched. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>('vi');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(languageKey);
      if (saved === 'vi' || saved === 'en') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- browser language preference hydrates after SSR.
        updateLocale(saved);
      }
    } catch { /* A blocked storage area must not prevent switching language. */ }
  }, []);
  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    try { localStorage.setItem(languageKey, next); } catch { /* Session preference still works. */ }
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LanguageContext.Provider value={value}><div lang={locale} className="mavericks-language-surface">{children}</div></LanguageContext.Provider>;
}

export function useLanguage() {
  const { locale, setLocale } = useContext(LanguageContext);
  return useMemo(() => {
    const language = locale === 'en' ? 'en-GB' : 'vi-VN';
    const count = (value: number, digits = 0) => new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value);
    const money = (value: number, country: 'vn' | 'id' = 'vn') => {
      const formatted = count(value);
      return country === 'id' ? `Rp${formatted}` : locale === 'en' ? `₫${formatted}` : `${formatted}đ`;
    };
    const date = (value: string | Date, withTime = false) => {
      const parsed = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
      if (!Number.isFinite(parsed.getTime())) return '—';
      return withTime ? parsed.toLocaleString(language) : parsed.toLocaleDateString(language);
    };
    return {
      locale, setLocale, t: (source: string, vars?: Variables) => translate(source, locale, vars), money, count, date,
      percent: (value: number, digits = 1) => `${count(value, digits)}%`,
      compact: (value: number) => new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0),
      dateLabel: (value?: string) => value ? date(value) : '—',
      shortDate: (value: string) => {
        const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
        return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString(language, { day: '2-digit', month: '2-digit' }) : '—';
      },
    };
  }, [locale, setLocale]);
}

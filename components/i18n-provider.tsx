"use client";

import { createContext, useContext } from "react";

import {
  localizePathname,
  type Locale,
} from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface I18nContextValue {
  locale: Locale;
  dictionary: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  locale,
  dictionary,
}: {
  children: React.ReactNode;
  locale: Locale;
  dictionary: Dictionary;
}) {
  return (
    <I18nContext.Provider value={{ locale, dictionary }}>
      {children}
    </I18nContext.Provider>
  );
}

function useI18nContext() {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error("I18nProvider is missing from the tree");
  }

  return value;
}

export function useLocale() {
  return useI18nContext().locale;
}

export function useDictionary() {
  return useI18nContext().dictionary;
}

export function useLocalizedPathname(pathname: string) {
  const locale = useLocale();
  return localizePathname(pathname, locale);
}

export function formatI18nText(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

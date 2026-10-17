import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";

export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "uk", label: "Українська" },
  { id: "ru", label: "Русский" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export function detectLanguage(saved: string | null | undefined): LanguageId {
  const pick = (v: string | undefined | null) =>
    LANGUAGES.find((l) => v?.toLowerCase().startsWith(l.id))?.id;
  return pick(saved) ?? pick(typeof navigator !== "undefined" ? navigator.language : "en") ?? "en";
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, uk: { translation: uk }, ru: { translation: ru } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };

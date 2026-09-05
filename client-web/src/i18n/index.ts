import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";
import { type Language, usePreferences } from "../shared/preferences";

export const LANGUAGES: readonly Language[] = ["en", "uk", "ru"];

function isLanguage(value: string | undefined): value is Language {
  return LANGUAGES.includes(value as Language);
}

/**
 * Language lives in the same persisted preferences store as theme and motion.
 * It used to be written straight to its own localStorage key, which left the
 * app with two persistence mechanisms and two migration stories.
 */
function initialLanguage(): Language {
  const stored = usePreferences.getState().language;
  if (isLanguage(stored) && stored !== "en") return stored;
  // One-time carry-over from the standalone key this used to use.
  const legacy = localStorage.getItem("oq-language") ?? undefined;
  if (isLanguage(legacy)) {
    usePreferences.getState().setLanguage(legacy);
    localStorage.removeItem("oq-language");
    return legacy;
  }
  if (isLanguage(stored)) return stored;
  const fromBrowser = navigator.language.split("-")[0];
  return isLanguage(fromBrowser) ? fromBrowser : "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk },
    ru: { translation: ru },
  },
  lng: initialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;

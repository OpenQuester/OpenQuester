import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";

const savedLanguage =
  localStorage.getItem("oq-language") ??
  navigator.language.split("-")[0] ??
  "en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk },
    ru: { translation: ru },
  },
  lng: ["en", "uk", "ru"].includes(savedLanguage) ? savedLanguage : "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;

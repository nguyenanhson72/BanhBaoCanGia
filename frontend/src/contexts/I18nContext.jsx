import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import vi from "../i18n/vi";
import en from "../i18n/en";

const dictionaries = { vi, en };
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "vi");

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((path) => {
    const parts = path.split(".");
    let cur = dictionaries[lang];
    for (const p of parts) {
      if (cur == null) return path;
      cur = cur[p];
    }
    return cur ?? path;
  }, [lang]);

  const toggleLang = useCallback(() => setLang((l) => (l === "vi" ? "en" : "vi")), []);

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { api } from '@/lib/api';

// Import language resources
import en from './locales/en.json';
import zh from './locales/zh.json';

const resources = {
  en: {
    translation: en
  },
  zh: {
    translation: zh
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh', // Default to Chinese
    lng: 'zh', // Set Chinese as default language
    debug: false,

    interpolation: {
      escapeValue: false, // React already does escaping
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

// Sync with backend language when frontend language changes
i18n.on('languageChanged', async (lng: string) => {
  try {
    await api.setBackendLanguage(lng);
  } catch (error) {
    console.warn('Failed to sync backend language:', error);
  }
});

// Initialize backend language on startup
const initializeBackendLanguage = async () => {
  try {
    const currentLanguage = i18n.language;
    await api.setBackendLanguage(currentLanguage);
  } catch (error) {
    console.warn('Failed to initialize backend language:', error);
  }
};

// Call initialization after i18n is ready
if (i18n.isInitialized) {
  initializeBackendLanguage();
} else {
  i18n.on('initialized', initializeBackendLanguage);
}

export default i18n;

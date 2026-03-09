
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import AsyncStorage from '@react-native-async-storage/async-storage';

// load JSON files
const resources = {
  en: { translation: require('./locales/en.json') },
  hi: { translation: require('./locales/hi.json') },
};


i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
  });

// try to load persisted user language (async) — override if present
AsyncStorage.getItem('user-language').then((lang) => {
  if (lang && lang !== i18n.language) {
    i18n.changeLanguage(lang);
  }
});

export default i18n;
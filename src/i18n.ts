import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const DEFAULT_LANGUAGE = 'ka';

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      lng: DEFAULT_LANGUAGE,
      fallbackLng: [DEFAULT_LANGUAGE, 'en'],
      defaultNS: 'translation',
      resources: {
        [DEFAULT_LANGUAGE]: { translation: {} },
        en: { translation: {} },
      },
      interpolation: {
        escapeValue: false,
      },
      returnNull: false,
      keySeparator: false,
    })
    .catch((error) => {
      console.error('Failed to initialize i18n', error);
    });
}

export default i18n;

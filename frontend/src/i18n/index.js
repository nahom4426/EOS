import { createI18n } from 'vue-i18n'
import en from './en.json'
import am from './am.json'

const savedLang = localStorage.getItem('eos_lang') || 'en'

export const i18n = createI18n({
  legacy: false,
  locale: savedLang,
  fallbackLocale: 'en',
  messages: { en, am },
})

export default i18n

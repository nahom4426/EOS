import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n } from '../i18n/index'

export const useLangStore = defineStore('lang', () => {
  const lang = ref(localStorage.getItem('eos_lang') || 'en')

  function setLang(newLang) {
    lang.value = newLang
    i18n.global.locale.value = newLang
    localStorage.setItem('eos_lang', newLang)
    // Set dir for RTL (Amharic is LTR but uses Ethiopic script)
    document.documentElement.lang = newLang
  }

  return { lang, setLang }
})

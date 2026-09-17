import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(localStorage.getItem('eos_theme') === 'dark')

  function toggle() {
    isDark.value = !isDark.value
    localStorage.setItem('eos_theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  }

  // Apply on init
  applyTheme()

  return { isDark, toggle }
})

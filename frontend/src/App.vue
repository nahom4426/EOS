<template>
  <RouterView />
</template>

<script setup>
import { RouterView } from 'vue-router'
import { useThemeStore } from './stores/theme'

// Initialize theme on mount
const theme = useThemeStore()
</script>

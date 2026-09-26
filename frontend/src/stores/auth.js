import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api/axios'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('eos_token') || null)
  const user = ref(JSON.parse(localStorage.getItem('eos_user') || 'null'))

  const isAuthenticated = computed(() => !!token.value)

  // Role computed helpers
  const isSuperAdmin  = computed(() => user.value?.role === 'superadmin')
  const isAdmin       = computed(() => user.value?.role === 'admin')
  const isMiniAdmin   = computed(() => user.value?.role === 'mini_admin')
  const isFirstChild  = computed(() => user.value?.role === 'first_child')
  const isMember      = computed(() => user.value?.role === 'member')

  // Backward-compat alias for any code still referencing isBranchAdmin
  const isBranchAdmin = isAdmin

  async function login(phone, password) {
    const res = await api.post('/api/auth/login', { phone, password })
    token.value = res.data.token
    user.value = res.data.user
    localStorage.setItem('eos_token', res.data.token)
    localStorage.setItem('eos_user', JSON.stringify(res.data.user))
    return res.data.user
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('eos_token')
    localStorage.removeItem('eos_user')
  }

  function updateUser(updatedUser) {
    user.value = { ...user.value, ...updatedUser }
    localStorage.setItem('eos_user', JSON.stringify(user.value))
  }

  async function updateProfile(formData) {
    const res = await api.put('/api/auth/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    updateUser(res.data.user)
    return res.data.user
  }

  return {
    token, user,
    isAuthenticated,
    isSuperAdmin, isAdmin, isBranchAdmin,
    isMiniAdmin, isFirstChild, isMember,
    login, logout, updateUser, updateProfile
  }
})

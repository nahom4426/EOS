import axios from 'axios'

const defaultBaseUrl = import.meta.env.DEV ? 'http://localhost:5000' : ''
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL !== undefined ? import.meta.env.VITE_API_BASE_URL : defaultBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eos_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally (except for login endpoint itself or when already on login page)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/api/auth/login')
    const isLoginPage = window.location.pathname === '/login'
    if (error.response?.status === 401 && !isLoginRequest && !isLoginPage) {
      localStorage.removeItem('eos_token')
      localStorage.removeItem('eos_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

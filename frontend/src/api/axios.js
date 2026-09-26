import axios from 'axios'

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://207.180.201.199:8080'
// If running on an HTTPS page (e.g. Vercel) and target is unencrypted http:// IP, use relative path to route through Vercel reverse proxy rewrites
const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:'
const baseURL = (isHttpsPage && rawBaseUrl.startsWith('http://')) ? '' : rawBaseUrl

const api = axios.create({
  baseURL,
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

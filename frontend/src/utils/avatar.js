const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://207.180.201.199:8080';
const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
const API_BASE_URL = (isHttpsPage && rawBaseUrl.startsWith('http://')) ? '' : rawBaseUrl;

/**
 * Returns absolute avatar URL for display in img tags
 * @param {string|null} url - Avatar URL string from backend
 * @returns {string|null} Formatted absolute URL
 */
export function getAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

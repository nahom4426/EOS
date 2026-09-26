const defaultBaseUrl = 'http://207.180.201.199:8080';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || defaultBaseUrl;

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

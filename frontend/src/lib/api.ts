import axios from 'axios';
import Cookies from 'js-cookie';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Attach JWT token from cookie on every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401 (skip during OAuth callback to avoid race)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const onCallback = window.location.pathname.startsWith('/oauth');
      if (!onCallback) {
        Cookies.remove('auth_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

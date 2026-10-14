import axios from 'axios';
import { apiBase } from '../config/api';
import { token, borrarSesion } from '../sesion';

const axiosClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

axiosClient.interceptors.request.use(async (config) => {
  config.baseURL = await apiBase();
  const jwt = token();
  if (jwt) {
    config.headers.Authorization = `Bearer ${jwt}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      // El borrado tiene que COMPLETAR antes de recargar. Si se recarga antes,
      // Preferences no alcanza a quitar citab_token, App.jsx rehidrata una sesion
      // muerta y el bucle de 401 se repite solo.
      borrarSesion().finally(() => {
        window.location.href = '/';
      });
    }
    return Promise.reject(err);
  }
);

export default axiosClient;

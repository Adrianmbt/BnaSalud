import { Capacitor } from '@capacitor/core';

const CLAVE_SERVIDOR = 'citab_api_base';
const SUFIJO = '/api/v1';

let pendiente = null;

// Acepta lo que el usuario escriba: "10.0.0.5:8000", "https://x.com/",
// "https://x.com/api/v1". Siempre queda con el sufijo correcto y sin barra final.
export function normalizarServidor(url) {
  const limpio = String(url ?? '').trim().replace(/\/+$/, '');
  if (!limpio) return SUFIJO;
  return limpio.endsWith(SUFIJO) ? limpio : `${limpio}${SUFIJO}`;
}

// El health check vive en la raíz del backend, fuera del prefijo /api/v1.
export function origenDe(base) {
  return String(base).replace(/\/api\/v1$/, '');
}

async function leerServidor() {
  const { Preferences } = await import('@capacitor/preferences');
  const guardada = (await Preferences.get({ key: CLAVE_SERVIDOR })).value;
  return normalizarServidor(guardada || import.meta.env.VITE_API_URL);
}

// Se resuelve una sola vez y se cachea como promesa para no repetir lecturas en
// cada request ni tener carreras con la pantalla de Servidor.
export function apiBase() {
  pendiente ??= leerServidor();
  return pendiente;
}

export async function setServidor(url) {
  const base = normalizarServidor(url);
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: CLAVE_SERVIDOR, value: base });
  pendiente = Promise.resolve(base);
  return base;
}

export async function getServidor() {
  const base = await apiBase();
  return base === SUFIJO ? '' : base;
}

export async function probarServidor(base) {
  const salud = `${origenDe(base)}/health`;
  try {
    const res = await fetch(salud, { headers: { Accept: 'application/json' } });
    if (!res.ok) return { ok: false, detalle: `El servidor respondió HTTP ${res.status}` };
    const cuerpo = await res.json().catch(() => ({}));
    return { ok: true, detalle: cuerpo?.status ?? 'Servidor accesible' };
  } catch (err) {
    return { ok: false, detalle: err?.message ?? 'No se pudo conectar' };
  }
}

export function esNativo() {
  return Capacitor.isNativePlatform();
}

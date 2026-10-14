// Las 8 claves vivían triplicadas (App.jsx lectura, App.jsx escritura,
// axiosClient.js). Aquí hay una sola lista y un solo par read/write.
//
// En nativo usa @capacitor/preferences: el localStorage de un WebView lo puede
// borrar el sistema bajo presión de almacenamiento y desaparece al limpiar los
// datos de la app. Una sesión que habilita un turno no puede depender de eso.

// Import ESTATICO a proposito. registerPlugin() devuelve un Proxy, y devolver
// ese proxy desde una funcion async hacia que el runtime le lea .then() para
// resolver la promesa: ese get('then') lanza
// CapacitorException "Preferences.then() is not implemented on web" y dejaba
// la app colgada en "Restaurando sesion...". Con el import estatico,
// Preferences.get() usa la impl web (localStorage) en el navegador y el puente
// nativo en el telefono, sin ese_lookup.
//
// El import dinamico se puede reponer solo si algun dia molesta el bundle; la
// version web del plugin ya se carga por separado (registerPlugin usa
// import('./web') lazy), asi que el peso en el bundle inicial no cambia.
import { Preferences } from '@capacitor/preferences';

export const CLAVES = [
  'citab_role',
  'citab_user',
  'citab_token',
  'citab_especialidad',
  'citab_personal_id',
  'citab_clinica_id',
  'citab_clinica_code',
  'citab_clinica_nombre',
];

let cache = {};

export async function cargarSesion() {
  const out = {};
  for (const clave of CLAVES) {
    const valor = (await Preferences.get({ key: clave })).value;
    if (valor != null) out[clave] = valor;
  }
  cache = out;
  return out;
}

// Relleno síncrono de la cache. Exportado aparte para poder testear el
// invariante sin arrancar Preferences (que no existe fuera de la app).
export function cacheSync(datos) {
  cache = {};
  for (const clave of CLAVES) {
    if (datos[clave] != null) cache[clave] = String(datos[clave]);
  }
  return cache;
}

// La cache se llena ANTES del primer await a proposito: token() es sincrono
// (lo consume el interceptor de axios) y App.jsx publica la sesion antes de que
// Preferences haya escrito. Con la cache populada al final, las primeras
// peticiones de la consulta salian sin Authorization -> 401.
export async function guardarSesion(datos) {
  cacheSync(datos);
  for (const clave of CLAVES) {
    const valor = datos[clave];
    if (valor == null) await Preferences.remove({ key: clave });
    else await Preferences.set({ key: clave, value: valor });
  }
  return cargarSesion();
}

// La cache se vacia de entrada: si no, el logout sigue mandando el token
// viejo mientras Preferences termina de borrar.
export async function borrarSesion() {
  cacheSync({});
  for (const clave of CLAVES) await Preferences.remove({ key: clave });
}

// Síncrono a propósito: el interceptor de axios corre por request y no puede
// esperar. La cache se llena en cargarSesion() antes de cualquier request.
export function token() {
  return cache.citab_token ?? null;
}

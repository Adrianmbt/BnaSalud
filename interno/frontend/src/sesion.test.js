import assert from 'node:assert/strict';
import { cacheSync, token } from './sesion.js';

// Self-check del invariante que rompia la sesion: token() es sincrono porque lo
// consume el interceptor de axios, pero Preferences es async. App.jsx publica
// la sesion (setLoggedIn) antes de que Preferences escriba, asi que la cache
// tiene que estar poblada ANTES del primer await de guardarSesion. Con la cache
// poblada al final, las primeras peticiones de la consulta salian sin
// Authorization y el backend respondia 401 en cascada.

const datos = { citab_role: 'recepcion', citab_user: 'Recepcionista', citab_token: 'token.fake.abc' };

cacheSync(datos);
assert.equal(token(), 'token.fake.abc', 'token disponible de inmediato');

// El logout tiene que ser sincrono tambien: si no, sigue saliendo el token viejo.
cacheSync({});
assert.equal(token(), null, 'logout vacia la cache de inmediato');

// Preferences guarda strings; numeros como personal_id deben llegar como texto.
cacheSync({ citab_personal_id: 41, citab_token: 't2' });
assert.equal(token(), 't2');

// Una clave ausente no debe pisar con undefined.
cacheSync({ citab_token: 't3', citab_clinica_code: undefined });
assert.equal(token(), 't3');

console.log('sesion: 4 asserts OK');
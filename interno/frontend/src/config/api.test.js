import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarServidor, origenDe } from './api.js';

// El usuario escribe lo que se le ocurre; normalizarServidor tiene que dejar
// siempre una base usable sin duplicar el sufijo.
test('normaliza una IP de centro con puerto', () => {
  assert.equal(normalizarServidor('192.168.1.10:8000'), '192.168.1.10:8000/api/v1');
});

test('normaliza una URL https sin esquema de ruta', () => {
  assert.equal(normalizarServidor('https://citab.bnasalud.ve'), 'https://citab.bnasalud.ve/api/v1');
});

test('no duplica el sufijo si ya viene puesto', () => {
  assert.equal(normalizarServidor('https://citab.bnasalud.ve/api/v1'), 'https://citab.bnasalud.ve/api/v1');
});

test('recorta barras finales y espacios', () => {
  assert.equal(normalizarServidor('  https://x.com///  '), 'https://x.com/api/v1');
});

test('sin configuración cae en el proxy relativo de Vite', () => {
  assert.equal(normalizarServidor(''), '/api/v1');
  assert.equal(normalizarServidor(null), '/api/v1');
  assert.equal(normalizarServidor(undefined), '/api/v1');
});

// El health check vive fuera del prefijo /api/v1: sin esto no se puede probar
// un servidor en el dispositivo.
test('deriva el origen para el health check', () => {
  assert.equal(origenDe('http://192.168.1.10:8000/api/v1'), 'http://192.168.1.10:8000');
  assert.equal(origenDe('/api/v1'), '');
});

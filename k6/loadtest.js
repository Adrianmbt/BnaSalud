import http from 'k6/http';
import { check, sleep } from 'k6';

// Prueba de carga ligera para el piloto. Uso:
//   k6 run k6/loadtest.js
//   k6 run -e BASE=https://tu-backend.up.railway.app k6/loadtest.js
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // sube a 10 usuarios virtuales
    { duration: '1m', target: 10 },    // se mantiene 1 minuto
    { duration: '30s', target: 0 },    // baja a 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // el 95% de peticiones bajo 2s
    checks: ['rate>0.9'],              // al menos 90% de comprobaciones OK
  },
};

const BASE = __ENV.BASE || 'http://localhost:8001';

export default function () {
  // 1. Health check (público)
  let res = http.get(`${BASE}/api/v1/health`);
  check(res, {
    'health status 200': (r) => r.status === 200,
  });

  // 2. Listar centros (público)
  res = http.get(`${BASE}/api/v1/centros`);
  check(res, {
    'centros status 200': (r) => r.status === 200,
  });

  // 3. Listar especialidades (público)
  res = http.get(`${BASE}/api/v1/especialidades`);
  check(res, {
    'especialidades status 200': (r) => r.status === 200,
  });

  sleep(1);
}

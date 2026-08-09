const API_BASE = '/api/v1';

async function apiFetch(endpoint, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: controller.signal,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const detail = data && (data.detail || data.message);
      throw new Error(detail || `Error ${res.status} en el servidor`);
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Verifica que el servidor esté activo.');
    }
    if (err instanceof TypeError) {
      throw new Error('No se pudo conectar con el servidor.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const API = {
  getCentros: () => apiFetch('/centros'),
  getEspecialidades: (centroId) =>
    apiFetch(centroId ? `/especialidades?centro_id=${centroId}` : '/especialidades'),
  getDisponibilidad: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/citas/disponibilidad?${qs}`);
  },
  crearCita: (payload) => apiFetch('/citas', { method: 'POST', body: payload }),

  /* === Módulo Farmacia === */
  buscarReceta: (codigoOcedula) =>
    apiFetch(`/farmacia/recetas/${encodeURIComponent(codigoOcedula)}`),
  despacharReceta: (payload) =>
    apiFetch('/farmacia/despachar', { method: 'POST', body: payload }),
  recetasPendientes: () =>
    apiFetch('/farmacia/recetas/pendientes'),
  getInventario: () =>
    apiFetch('/farmacia/inventario'),

  /* === Módulo Doctores === */
  buscarPaciente: (cedula) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}`),
  crearConsulta: (payload) =>
    apiFetch('/consultas', { method: 'POST', body: payload }),
  historialPaciente: (cedula) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/historial`),

  /* === Estudios médicos / OCR === */
  procesarEstudio: (payload) =>
    apiFetch('/estudios/procesar', { method: 'POST', body: payload }),

  /* === Órdenes de estudios === */
  crearOrdenEstudios: (payload) =>
    apiFetch('/estudios/ordenes', { method: 'POST', body: payload }),
  ordenesPaciente: (pacienteId) =>
    apiFetch(`/estudios/ordenes/paciente/${encodeURIComponent(pacienteId)}`),
  registrarResultadosOrden: (ordenId, payload) =>
    apiFetch(`/estudios/ordenes/${encodeURIComponent(ordenId)}/resultados`, {
      method: 'POST',
      body: payload,
    }),
};

export function parseCedula(valor) {
  const limpio = valor.trim();
  const match = limpio.match(/^([VEP])\s*[-.\s]?\s*(\d+)$/i);
  if (match) return { tipo_cedula: match[1].toUpperCase(), cedula: match[2] };
  return { tipo_cedula: 'V', cedula: limpio.replace(/[^\d]/g, '') };
}

export function formatoCedula(valor) {
  return valor.length === 5 ? `${valor}:00` : valor;
}

const API_BASE = '/api/v1';

export const CLAVES_SESION = {
  staff: 'bna_token',
  paciente: 'bna_token_paciente',
};

function tokenActivo() {
  try {
    return (
      localStorage.getItem(CLAVES_SESION.staff) ||
      localStorage.getItem(CLAVES_SESION.paciente) ||
      ''
    );
  } catch {
    return '';
  }
}

export function cerrarSesion(tipo) {
  try {
    if (tipo === 'staff' || !tipo) localStorage.removeItem(CLAVES_SESION.staff);
    if (tipo === 'paciente' || !tipo) localStorage.removeItem(CLAVES_SESION.paciente);
  } catch {
    /* sin almacenamiento disponible */
  }
}

async function apiFetch(endpoint, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const token = tokenActivo();
  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      const err = new Error(detail || `Error ${res.status} en el servidor`);
      err.status = res.status;
      throw err;
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
  actualizarPaciente: (cedula, payload) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}`, { method: 'PATCH', body: payload }),
  crearConsulta: (payload) =>
    apiFetch('/consultas', { method: 'POST', body: payload }),
  historialPaciente: (cedula) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/historial`),
  medicoTratante: (cedula) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/medico`),
  citasPaciente: (cedula) =>
    apiFetch(`/citas?cedula=${encodeURIComponent(cedula)}`),

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

  /* === Autenticación === */
  login: (username, password) =>
    apiFetch('/auth/login', { method: 'POST', body: { username, password } }),
  loginPaciente: (cedula, pin) =>
    apiFetch('/auth/paciente', { method: 'POST', body: { cedula, pin } }),
  recuperarPin: (cedula, email) =>
    apiFetch('/auth/paciente/recuperar', { method: 'POST', body: { cedula, email } }),
  resetPin: (cedula, codigo, pin_nuevo) =>
    apiFetch('/auth/paciente/reset', { method: 'POST', body: { cedula, codigo, pin_nuevo } }),
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

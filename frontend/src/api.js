const API_BASE = '/api/v1';

export const CLAVES_SESION = {
  staff: 'bna_token',
  paciente: 'bna_token_paciente',
};

// Cuál de las dos sesiones entró en último lugar. `tokenActivo` usa este
// marcador para no mezclar tokens (un token staff caducado rompía el portal
// del paciente, porque siempre ganaba la prioridad).
const CLAVE_ULTIMA_SESION = 'bna_ultima_sesion';

export function marcarUltimaSesion(tipo) {
  try {
    localStorage.setItem(CLAVE_ULTIMA_SESION, tipo);
  } catch {
    /* sin almacenamiento disponible */
  }
}

function tokenActivo() {
  try {
    const ultima = localStorage.getItem(CLAVE_ULTIMA_SESION);
    if (ultima === 'paciente') {
      return (
        localStorage.getItem(CLAVES_SESION.paciente) ||
        localStorage.getItem(CLAVES_SESION.staff) ||
        ''
      );
    }
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
    if (tipo === 'staff' || !tipo) {
      localStorage.removeItem(CLAVES_SESION.staff);
      if (localStorage.getItem(CLAVE_ULTIMA_SESION) === 'staff') {
        localStorage.removeItem(CLAVE_ULTIMA_SESION);
      }
    }
    if (tipo === 'paciente' || !tipo) {
      localStorage.removeItem(CLAVES_SESION.paciente);
      if (localStorage.getItem(CLAVE_ULTIMA_SESION) === 'paciente') {
        localStorage.removeItem(CLAVE_ULTIMA_SESION);
      }
    }
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
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return apiFetch(`/citas/disponibilidad?${qs}`);
  },
  getMedicosPorEspecialidad: (centroId, especialidadId) =>
    apiFetch(`/citas/medicos?centro_id=${centroId}&especialidad_id=${especialidadId}`),
  crearCita: (payload) => apiFetch('/citas', { method: 'POST', body: payload }),

  /* === Módulo Farmacia === */
  buscarReceta: (codigoOcedula) =>
    apiFetch(`/farmacia/recetas/${encodeURIComponent(codigoOcedula)}`),
  despacharReceta: (payload) =>
    apiFetch('/farmacia/despachar', { method: 'POST', body: payload }),
  recetasPendientes: () =>
    apiFetch('/farmacia/recetas/pendientes'),
  recetasPaciente: (cedula) =>
    apiFetch(`/farmacia/recetas/paciente/${encodeURIComponent(cedula)}`),
  entregarReceta: (recetaId, payload) =>
    apiFetch(`/farmacia/recetas/${recetaId}/entregar`, { method: 'POST', body: payload }),
  recibirReceta: (recetaId) =>
    apiFetch(`/farmacia/recetas/${recetaId}/recibir`, { method: 'POST' }),
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
  buscarCita: (codigo) =>
    apiFetch(`/citas/${encodeURIComponent(codigo)}`),

  // Gestión de citas — médico (staff)
  actualizarEstadoCita: (citaId, payload) =>
    apiFetch(`/citas/${citaId}/estado`, { method: 'PATCH', body: payload }),

  // Gestión de citas — paciente
  posponerCita: (citaId, payload) =>
    apiFetch(`/citas/${citaId}/posponer`, { method: 'PATCH', body: payload }),

  /* === Notificaciones al paciente (Fase 5) === */
  notificacionesPaciente: (cedula) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/notificaciones`),
  notificarPaciente: (cedula, payload) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/notificar`, {
      method: 'POST',
      body: payload,
    }),

  /* === Estudios médicos / OCR === */
  procesarEstudio: (payload) =>
    apiFetch('/estudios/procesar', { method: 'POST', body: payload }),

  /* === Órdenes de estudios === */
  crearOrdenEstudios: (payload) =>
    apiFetch('/estudios/ordenes', { method: 'POST', body: payload }),
  ordenesPaciente: (pacienteId) =>
    apiFetch(`/estudios/ordenes/paciente/${encodeURIComponent(pacienteId)}`),
  ordenesTodas: (estado) =>
    apiFetch(estado ? `/estudios/ordenes?estado=${encodeURIComponent(estado)}` : '/estudios/ordenes'),
  registrarResultadosOrden: (ordenId, payload) =>
    apiFetch(`/estudios/ordenes/${encodeURIComponent(ordenId)}/resultados`, {
      method: 'POST',
      body: payload,
    }),

  /* === Cola de pacientes (check-in / médico de turno) === */
  colaClinica: (clinicaId) =>
    apiFetch(clinicaId ? `/cola?clinica_id=${clinicaId}` : '/cola'),
  registrarTurno: (payload) =>
    apiFetch('/cola', { method: 'POST', body: payload }),
  asignarPaciente: (colaId) =>
    apiFetch(`/cola/${colaId}/asignar`, { method: 'POST' }),
  finalizarPaciente: (colaId) =>
    apiFetch(`/cola/${colaId}/finalizar`, { method: 'POST' }),
  cancelarTurno: (colaId) =>
    apiFetch(`/cola/${colaId}/cancelar`, { method: 'POST' }),

  /* === Panel de administración (trazabilidad) === */
  trazabilidadRecetas: () =>
    apiFetch('/admin/trazabilidad'),
  resumenAdmin: () =>
    apiFetch('/admin/resumen'),
  bitacoraAcciones: (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return apiFetch(qs ? `/admin/bitacora?${qs}` : '/admin/bitacora');
  },

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

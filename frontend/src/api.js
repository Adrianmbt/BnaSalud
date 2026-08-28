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

function tokenActivo(tipo) {
  try {
    // Un módulo staff (médico/farmacia/enfermería/admin) siempre usa el token
    // del personal, sin importar qué sesión entró en último lugar (en caso
    // contrario, abrir el portal del paciente después rompía las llamadas
    // staff-only porque el token del paciente las rechazaba con 403).
    if (tipo === 'staff') {
      return localStorage.getItem(CLAVES_SESION.staff) || '';
    }
    if (tipo === 'paciente') {
      return localStorage.getItem(CLAVES_SESION.paciente) || '';
    }
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

  const token = tokenActivo(options.tipo);
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

  /* === Módulo Farmacia (staff) === */
  buscarReceta: (codigoOcedula) =>
    apiFetch(`/farmacia/recetas/${encodeURIComponent(codigoOcedula)}`, { tipo: 'staff' }),
  despacharReceta: (payload) =>
    apiFetch('/farmacia/despachar', { method: 'POST', body: payload, tipo: 'staff' }),
  recetasPendientes: () =>
    apiFetch('/farmacia/recetas/pendientes', { tipo: 'staff' }),
  recetasPaciente: (cedula, tipo) =>
    apiFetch(`/farmacia/recetas/paciente/${encodeURIComponent(cedula)}`, tipo ? { tipo } : {}),
  entregarReceta: (recetaId, payload) =>
    apiFetch(`/farmacia/recetas/${recetaId}/entregar`, { method: 'POST', body: payload, tipo: 'staff' }),
  recibirReceta: (recetaId) =>
    apiFetch(`/farmacia/recetas/${recetaId}/recibir`, { method: 'POST', tipo: 'paciente' }),
  getInventario: () =>
    apiFetch('/farmacia/inventario', { tipo: 'staff' }),

  /* === Módulo Doctores (staff) === */
  buscarPaciente: (cedula, tipo) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}`, tipo ? { tipo } : {}),
  actualizarPaciente: (cedula, payload, tipo) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}`, tipo ? { method: 'PATCH', body: payload, tipo } : { method: 'PATCH', body: payload }),
  crearConsulta: (payload) =>
    apiFetch('/consultas', { method: 'POST', body: payload, tipo: 'staff' }),
  historialPaciente: (cedula, tipo) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/historial`, tipo ? { tipo } : {}),
  medicoTratante: (cedula, tipo) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/medico`, tipo ? { tipo } : {}),
  citasPaciente: (cedula, tipo) =>
    apiFetch(`/citas?cedula=${encodeURIComponent(cedula)}`, tipo ? { tipo } : {}),
  buscarCita: (codigo) =>
    apiFetch(`/citas/${encodeURIComponent(codigo)}`),

  // Gestión de citas — médico (staff)
  actualizarEstadoCita: (citaId, payload) =>
    apiFetch(`/citas/${citaId}/estado`, { method: 'PATCH', body: payload, tipo: 'staff' }),

  // Gestión de citas — paciente
  posponerCita: (citaId, payload) =>
    apiFetch(`/citas/${citaId}/posponer`, { method: 'PATCH', body: payload }),
  cancelarCita: (citaId, payload) =>
    apiFetch(`/citas/${citaId}/cancelar`, { method: 'PATCH', body: payload }),

  /* === Notificaciones al paciente (Fase 5) === */
  notificacionesPaciente: (cedula) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/notificaciones`),
  notificarPaciente: (cedula, payload) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/notificar`, {
      method: 'POST',
      body: payload,
      tipo: 'staff',
    }),

  /* === Estudios médicos / OCR (staff) === */
  procesarEstudio: (payload) =>
    apiFetch('/estudios/procesar', { method: 'POST', body: payload, tipo: 'staff' }),

  /* === Órdenes de estudios === */
  crearOrdenEstudios: (payload) =>
    apiFetch('/estudios/ordenes', { method: 'POST', body: payload, tipo: 'staff' }),
  ordenesPaciente: (pacienteId, tipo) =>
    apiFetch(`/estudios/ordenes/paciente/${encodeURIComponent(pacienteId)}`, tipo ? { tipo } : {}),
  ordenesTodas: (estado) =>
    apiFetch(estado ? `/estudios/ordenes?estado=${encodeURIComponent(estado)}` : '/estudios/ordenes', {
      tipo: 'staff',
    }),
  registrarResultadosOrden: (ordenId, payload) =>
    apiFetch(`/estudios/ordenes/${encodeURIComponent(ordenId)}/resultados`, {
      method: 'POST',
      body: payload,
      tipo: 'staff',
    }),

  /* === Cola de pacientes (staff) === */
  colaClinica: (clinicaId, medicoid) =>
    apiFetch(
      `/cola${clinicaId || medicoid ? '?' : ''}${[
        clinicaId ? `clinica_id=${clinicaId}` : '',
        medicoid ? `medico_id=${medicoid}` : '',
      ]
        .filter(Boolean)
        .join('&')}`,
      { tipo: 'staff' }
    ),
  registrarTurno: (payload) =>
    apiFetch('/cola', { method: 'POST', body: payload, tipo: 'staff' }),
  asignarPaciente: (colaId) =>
    apiFetch(`/cola/${colaId}/asignar`, { method: 'POST', tipo: 'staff' }),
  finalizarPaciente: (colaId) =>
    apiFetch(`/cola/${colaId}/finalizar`, { method: 'POST', tipo: 'staff' }),
  cancelarTurno: (colaId) =>
    apiFetch(`/cola/${colaId}/cancelar`, { method: 'POST', tipo: 'staff' }),

  /* === Panel de administración (staff) === */
  trazabilidadRecetas: () =>
    apiFetch('/admin/trazabilidad', { tipo: 'staff' }),
  resumenAdmin: () =>
    apiFetch('/admin/resumen', { tipo: 'staff' }),
  bitacoraAcciones: (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return apiFetch(qs ? `/admin/bitacora?${qs}` : '/admin/bitacora', { tipo: 'staff' });
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

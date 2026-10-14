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

  /* === Citas y Agenda (Público / Paciente) === */
  posponerCita: (citaId, payload) =>
    apiFetch(`/citas/${citaId}/posponer`, { method: 'PATCH', body: payload }),
  cancelarCita: (citaId, payload) =>
    apiFetch(`/citas/${citaId}/cancelar`, { method: 'PATCH', body: payload }),
  buscarCita: (codigo) =>
    apiFetch(`/citas/${encodeURIComponent(codigo)}`),

  /* === Portal del Paciente === */
  buscarPaciente: (cedula) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}`, { tipo: 'paciente' }),
  actualizarPaciente: (cedula, payload) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}`, { method: 'PATCH', body: payload, tipo: 'paciente' }),
  historialPaciente: (cedula) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/historial`, { tipo: 'paciente' }),
  medicoTratante: (cedula) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/medico`, { tipo: 'paciente' }),
  citasPaciente: (cedula) =>
    apiFetch(`/citas?cedula=${encodeURIComponent(cedula)}`, { tipo: 'paciente' }),
  ordenesPaciente: (pacienteId) =>
    apiFetch(`/estudios/ordenes/paciente/${encodeURIComponent(pacienteId)}`, { tipo: 'paciente' }),
  recetasPaciente: (cedula) =>
    apiFetch(`/farmacia/recetas/paciente/${encodeURIComponent(cedula)}`, { tipo: 'paciente' }),
  recibirReceta: (recetaId) =>
    apiFetch(`/farmacia/recetas/${recetaId}/recibir`, { method: 'POST', tipo: 'paciente' }),
  notificacionesPaciente: (cedula) =>
    apiFetch(`/pacientes/${encodeURIComponent(cedula)}/notificaciones`, { tipo: 'paciente' }),

  /* === Autenticación del Paciente === */
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

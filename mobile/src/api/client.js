/**
 * Cliente de API para la aplicación móvil de BnaSalud (React Native).
 * Conecta con el backend FastAPI (/api/v1).
 */

// En desarrollo local con emulador / dispositivo físico Expo:
// Si usas emulador Android: 'http://10.0.2.2:8000/api/v1'
// Si usas dispositivo físico con Expo Go: IP local de tu máquina 'http://192.168.x.x:8000/api/v1'
export const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * @typedef {Object} PacienteCola
 * @property {number} id
 * @property {string} token
 * @property {string} paciente_cedula
 * @property {string} paciente_nombre
 * @property {string} [motivo]
 * @property {number} prioridad - 1: Alta, 3: Normal
 * @property {'EN_ESPERA'|'EN_CONSULTA'|'ATENDIDO'|'CANCELADO'} estado
 * @property {string} creado_en
 */

/**
 * @typedef {Object} DetalleRecetaItem
 * @property {number} medicamento_id
 * @property {string} nombre_medicamento
 * @property {number} cantidad_prescrita
 * @property {number} cantidad_despachada
 * @property {string} [posologia]
 * @property {number} [stock]
 */

/**
 * @typedef {Object} RecetaPendiente
 * @property {number} id
 * @property {string} codigo_receta
 * @property {string} paciente_cedula
 * @property {string} paciente_nombre
 * @property {string} medico
 * @property {'PENDIENTE'|'DESPACHADA'|'ENTREGADA'|'RECIBIDA'} estado
 * @property {string} [fecha_emision]
 * @property {DetalleRecetaItem[]} detalles
 */

/**
 * @typedef {Object} DespachoPayload
 * @property {number} receta_id
 * @property {number} [clinica_id]
 * @property {number} [despachado_por_id]
 * @property {{ medicamento_id: number; cantidad_despachada: number }[]} items
 */

/**
 * Wrapper de fetch con timeout y manejo de errores.
 * @param {string} endpoint
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const errorMsg = data?.detail || data?.message || `Error ${res.status}`;
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado. Verifique la conexión al servidor.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const MobileAPI = {
  // === Módulo Médico / Cola ===
  obtenerCola: async (clinicaId) => {
    return request(
      clinicaId ? `/cola?clinica_id=${clinicaId}` : '/cola'
    );
  },

  registrarEmergencia: async (payload) => {
    return request('/cola', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  asignarPaciente: async (colaId) => {
    return request(`/cola/${colaId}/asignar`, { method: 'POST' });
  },

  finalizarPaciente: async (colaId) => {
    return request(`/cola/${colaId}/finalizar`, { method: 'POST' });
  },

  // === Módulo Farmacia ===
  obtenerRecetasPendientes: async (limite = 20) => {
    return request(`/farmacia/recetas/pendientes?limite=${limite}`);
  },

  buscarReceta: async (codigoOcedula) => {
    return request(`/farmacia/recetas/${encodeURIComponent(codigoOcedula)}`);
  },

  despacharReceta: async (payload) => {
    return request('/farmacia/despachar', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

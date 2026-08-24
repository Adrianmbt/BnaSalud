/**
 * Cliente de API para la aplicación móvil de BnaSalud (React Native).
 * Conecta con el backend FastAPI (/api/v1).
 */

// En desarrollo local con emulador / dispositivo físico Expo:
// Si usas emulador Android: 'http://10.0.2.2:8000/api/v1'
// Si usas dispositivo físico con Expo Go: IP local de tu máquina 'http://192.168.x.x:8000/api/v1'
export const API_BASE_URL = 'http://localhost:8000/api/v1';

export interface PacienteCola {
  id: number;
  token: string;
  paciente_cedula: string;
  paciente_nombre: string;
  motivo?: string;
  prioridad: number; // 1: Alta, 3: Normal
  estado: 'EN_ESPERA' | 'EN_CONSULTA' | 'ATENDIDO' | 'CANCELADO';
  creado_en: string;
}

export interface DetalleRecetaItem {
  medicamento_id: number;
  nombre_medicamento: string;
  cantidad_prescrita: number;
  cantidad_despachada: number;
  posologia?: string;
  stock?: number;
}

export interface RecetaPendiente {
  id: number;
  codigo_receta: string;
  paciente_cedula: string;
  paciente_nombre: string;
  medico: string;
  estado: 'PENDIENTE' | 'DESPACHADA' | 'ENTREGADA' | 'RECIBIDA';
  fecha_emision?: string;
  detalles: DetalleRecetaItem[];
}

export interface DespachoPayload {
  receta_id: number;
  clinica_id?: number;
  despachado_por_id?: number;
  items: Array<{
    medicamento_id: number;
    cantidad_despachada: number;
  }>;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    return data as T;
  } catch (err: any) {
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
  obtenerCola: async (clinicaId?: number) => {
    return request<{ espera: PacienteCola[]; consulta: PacienteCola[]; finalizado: PacienteCola[] }>(
      clinicaId ? `/cola?clinica_id=${clinicaId}` : '/cola'
    );
  },

  registrarEmergencia: async (payload: {
    cedula: string;
    nombre: string;
    motivo: string;
    prioridad: number;
    clinica_id?: number;
  }) => {
    return request<PacienteCola>('/cola', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  asignarPaciente: async (colaId: number) => {
    return request<PacienteCola>(`/cola/${colaId}/asignar`, { method: 'POST' });
  },

  finalizarPaciente: async (colaId: number) => {
    return request<PacienteCola>(`/cola/${colaId}/finalizar`, { method: 'POST' });
  },

  // === Módulo Farmacia ===
  obtenerRecetasPendientes: async (limite: number = 20) => {
    return request<RecetaPendiente[]>(`/farmacia/recetas/pendientes?limite=${limite}`);
  },

  buscarReceta: async (codigoOcedula: string) => {
    return request<RecetaPendiente>(`/farmacia/recetas/${encodeURIComponent(codigoOcedula)}`);
  },

  despacharReceta: async (payload: DespachoPayload) => {
    return request<{ status: string; message: string; receta_id: number; medicamentos_despachados: number }>(
      '/farmacia/despachar',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },
};

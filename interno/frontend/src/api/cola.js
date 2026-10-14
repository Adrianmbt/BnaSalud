import axiosClient from './axiosClient';

/**
 * Cola de atención del módulo interno.
 * La API (GET /cola) devuelve la cola agrupada por estado:
 * { recepcion, triaje, espera, consulta, finalizado }
 */
export const getCola = async (clinicaId) => {
  const url = clinicaId ? `/cola/?clinica_id=${clinicaId}` : '/cola/';
  const { data } = await axiosClient.get(url);
  return data;
};

export const registrarCheckin = async (payload) => {
  const { data } = await axiosClient.post('/cola/', payload);
  return data;
};

export const transicionarEstado = async (colaId, payload) => {
  const { data } = await axiosClient.patch(`/cola/${colaId}/transicion`, payload);
  return data;
};

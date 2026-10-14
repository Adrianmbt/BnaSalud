import axiosClient from './axiosClient';

export const getColaEspecialista = async (especialidad) => {
  const { data } = await axiosClient.get('/cola', {
    params: { especialidad },
  });
  return data;
};

export const transicionarEstado = async (colaId, payload) => {
  const { data } = await axiosClient.patch(`/cola/${colaId}/transicion`, payload);
  return data;
};

export const getHistoriaClinica = async (cedula) => {
  const { data } = await axiosClient.get(`/historias-clinicas/${cedula}`);
  return data;
};

export const registrarConsulta = async (payload) => {
  const { data } = await axiosClient.post('/consultas', payload);
  return data;
};

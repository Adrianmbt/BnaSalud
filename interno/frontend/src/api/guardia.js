import axiosClient from './axiosClient';

/**
 * API de guardias para el modulo de recepcion.
 */

export const getGuardiasActivas = async (clinicaId) => {
  const params = {};
  if (clinicaId) params.clinica_id = clinicaId;
  const { data } = await axiosClient.get('/guardias/activas', { params });
  return data;
};

export const iniciarGuardia = async (payload) => {
  const { data } = await axiosClient.post('/guardias/iniciar', payload);
  return data;
};

export const cambiarGuardia = async (payload) => {
  const { data } = await axiosClient.post('/guardias/cambiar', payload);
  return data;
};

export const finalizarGuardia = async (guardiaId) => {
  const { data } = await axiosClient.patch(`/guardias/${guardiaId}/finalizar`);
  return data;
};

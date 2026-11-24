import axiosClient from './axiosClient';

export const buscarPacientesRecepcion = async (q) => {
  const { data } = await axiosClient.get('/recepcion/pacientes', { params: { q } });
  return data.items || [];
};

export const obtenerDisponibilidadRecepcion = async ({ medico_id, fecha }) => {
  const { data } = await axiosClient.get('/recepcion/disponibilidad', {
    params: { medico_id, fecha },
  });
  return data;
};

export const crearCitaRecepcion = async (payload) => {
  const { data } = await axiosClient.post('/recepcion/citas', payload);
  return data;
};

export const estadoSyncCitas = async () => {
  const { data } = await axiosClient.get('/recepcion/sync/estado');
  return data;
};

export const sincronizarCitas = async () => {
  const { data } = await axiosClient.post('/recepcion/sync');
  return data;
};

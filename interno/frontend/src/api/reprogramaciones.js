import axiosClient from './axiosClient';

export const listarCitas = async (params = {}) => {
  const { data } = await axiosClient.get('/reprogramaciones/citas', { params });
  return data;
};

export const listarSemanasCertificadas = async (params = {}) => {
  const { data } = await axiosClient.get('/agenda/semanas-certificadas', {
    params,
  });
  return data;
};

export const listarEspecialidades = async () => {
  const { data } = await axiosClient.get('/reprogramaciones/especialidades');
  return data;
};

export const obtenerFichaCita = async (citaId) => {
  const { data } = await axiosClient.get(`/reprogramaciones/citas/${citaId}/ficha`);
  return data;
};

export const obtenerCalendarioMedico = async ({ medico_id, dias = 30, desde = null }) => {
  const { data } = await axiosClient.get('/agenda/disponibilidad/calendario', {
    params: { medico_id, dias, ...(desde ? { desde } : {}) },
  });
  return data;
};

export const obtenerCuposSemanal = async ({ medico_id, semana_desde = null }) => {
  const { data } = await axiosClient.get('/agenda/cupos-semanal', {
    params: { medico_id, ...(semana_desde ? { semana_desde } : {}) },
  });
  return data;
};

export const crearAusencia = async (payload) => {
  const { data } = await axiosClient.post('/reprogramaciones/ausencias', payload);
  return data;
};

export const listarAusencias = async (params = {}) => {
  const { data } = await axiosClient.get('/reprogramaciones/ausencias', { params });
  return data;
};

export const cancelarAusencia = async (ausenciaId) => {
  const { data } = await axiosClient.patch(`/reprogramaciones/ausencias/${ausenciaId}/cancelar`);
  return data;
};

export const listarAfectadas = async (ausenciaId) => {
  const { data } = await axiosClient.get(`/reprogramaciones/ausencias/${ausenciaId}/afectadas`);
  return data;
};

export const generarPlan = async (ausenciaId, payload) => {
  const { data } = await axiosClient.post(`/reprogramaciones/ausencias/${ausenciaId}/plan`, payload);
  return data;
};

export const listarPropuestas = async (params = {}) => {
  const { data } = await axiosClient.get('/reprogramaciones/propuestas', { params });
  return data;
};

export const confirmarPropuesta = async (propuestaId) => {
  const { data } = await axiosClient.post(`/reprogramaciones/propuestas/${propuestaId}/confirmar`);
  return data;
};

export const rechazarPropuesta = async (propuestaId, notas = null) => {
  const { data } = await axiosClient.post(`/reprogramaciones/propuestas/${propuestaId}/rechazar`, { notas });
  return data;
};

export const reproponerPropuesta = async (propuestaId, payload) => {
  const { data } = await axiosClient.post(`/reprogramaciones/propuestas/${propuestaId}/reproponer`, payload);
  return data;
};

export const actualizarContacto = async (propuestaId, contacto, notas = null) => {
  const { data } = await axiosClient.patch(`/reprogramaciones/propuestas/${propuestaId}/contacto`, {
    contacto,
    notas,
  });
  return data;
};

export const obtenerPreviaJornada = async ({ medico_id, fecha, turno_id = null }) => {
  const { data } = await axiosClient.get('/reprogramaciones/jornada/previa', {
    params: { medico_id, fecha, ...(turno_id ? { turno_id } : {}) },
  });
  return data;
};

export const obtenerTurnosJornada = async ({ medico_id, fecha }) => {
  const { data } = await axiosClient.get('/reprogramaciones/jornada/turnos', {
    params: { medico_id, fecha },
  });
  return data;
};

export const moverJornada = async (payload) => {
  const { data } = await axiosClient.post('/reprogramaciones/mover-jornada', payload);
  return data;
};


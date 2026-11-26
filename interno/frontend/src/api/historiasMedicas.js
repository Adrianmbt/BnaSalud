import axiosClient from './axiosClient';

const BASE = '/historias-medicas';

export const buscarPacientes = (q) =>
  axiosClient.get(`${BASE}/pacientes`, { params: { q } }).then((r) => r.data);

export const listarColaHistorias = (params = {}) =>
  axiosClient.get(`${BASE}/cola`, { params }).then((r) => r.data);

export const listarCatalogoMedicamentos = (q = '') =>
  axiosClient
    .get('/medicamentos', { params: q ? { q } : {} })
    .then((r) => (Array.isArray(r.data?.items) ? r.data.items : []));

export const crearPaciente = (payload) =>
  axiosClient.post(`${BASE}/pacientes`, payload).then((r) => r.data);

export const actualizarContactoPaciente = (historiaId, payload) =>
  axiosClient.patch(`${BASE}/pacientes/${historiaId}/contacto`, payload).then((r) => r.data);

export const obtenerPaciente = (historiaId) =>
  axiosClient.get(`${BASE}/pacientes/${historiaId}`).then((r) => r.data);

export const guardarFicha = (historiaId, payload) =>
  axiosClient.put(`${BASE}/pacientes/${historiaId}/ficha`, payload).then((r) => r.data);

export const crearAtencion = (historiaId, payload) =>
  axiosClient.post(`${BASE}/pacientes/${historiaId}/atenciones`, payload).then((r) => r.data);

export const listarAtenciones = (historiaId) =>
  axiosClient.get(`${BASE}/pacientes/${historiaId}/atenciones`).then((r) => r.data);

export const listarMedicos = () =>
  axiosClient.get(`${BASE}/medicos`).then((r) => r.data);

export const crearReposo = (historiaId, payload) =>
  axiosClient.post(`${BASE}/pacientes/${historiaId}/reposos`, payload).then((r) => r.data);

export const listarReposos = (params = {}) =>
  axiosClient.get(`${BASE}/reposos`, { params }).then((r) => r.data);

export const anularReposo = (reposoId, motivo) =>
  axiosClient.post(`${BASE}/reposos/${reposoId}/anular`, { motivo }).then((r) => r.data);

export const metricasReposos = (params = {}) =>
  axiosClient.get(`${BASE}/metricas/reposos`, { params }).then((r) => r.data);

export const resumenHistorias = () =>
  axiosClient.get(`${BASE}/metricas/resumen`).then((r) => r.data);

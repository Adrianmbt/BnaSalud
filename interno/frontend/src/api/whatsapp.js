import axiosClient from './axiosClient';

export const obtenerEstadoWhatsapp = async () => {
  const { data } = await axiosClient.get('/whatsapp/estado');
  return data;
};

export const obtenerQrWhatsapp = async (params = {}) => {
  const { data } = await axiosClient.get('/whatsapp/qr', { params });
  return data;
};

export const enviarWhatsapp = async ({ telefono, mensaje, cedula = null }) => {
  const { data } = await axiosClient.post('/whatsapp/enviar', {
    telefono,
    mensaje,
    cedula,
  });
  return data;
};

export const enviarWhatsappMasivo = async ({ mensaje, destinatarios }) => {
  const { data } = await axiosClient.post('/whatsapp/enviar-masivo', {
    mensaje,
    destinatarios,
  });
  return data;
};

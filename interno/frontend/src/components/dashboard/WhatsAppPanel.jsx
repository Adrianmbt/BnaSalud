import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, MessageSquare, CheckCircle2, XCircle, Wifi, WifiOff, Users } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const ESTADO_COLORES = {
  PENDIENTE: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  ENVIADO: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  FALLIDO: 'bg-red-50 text-red-700 ring-1 ring-red-200',
};

export default function WhatsAppPanel() {
  const [estado, setEstado] = useState(null);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [destinatarios, setDestinatarios] = useState([{ telefono: '', cedula: '', nombre: '' }]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');

  const verificarEstado = useCallback(async () => {
    setCargandoEstado(true);
    try {
      const { data } = await axiosClient.get('/whatsapp/estado');
      setEstado(data);
    } catch {
      setEstado({ conectado: false, estado: 'error', instancia: 'bnasalud' });
    } finally {
      setCargandoEstado(false);
    }
  }, []);

  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    try {
      const params = { limit: 50 };
      if (filtroEstado) params.estado = filtroEstado;
      const { data } = await axiosClient.get('/whatsapp/mensajes', { params });
      setHistorial(data);
    } catch {
      setHistorial([]);
    } finally {
      setCargandoHistorial(false);
    }
  }, [filtroEstado]);

  useEffect(() => { verificarEstado(); }, [verificarEstado]);
  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const agregarDestinatario = () => {
    setDestinatarios([...destinatarios, { telefono: '', cedula: '', nombre: '' }]);
  };

  const actualizarDestinatario = (index, campo, valor) => {
    const nuevos = [...destinatarios];
    nuevos[index][campo] = valor;
    setDestinatarios(nuevos);
  };

  const eliminarDestinatario = (index) => {
    if (destinatarios.length > 1) {
      setDestinatarios(destinatarios.filter((_, i) => i !== index));
    }
  };

  const enviar = async (esMasivo = false) => {
    if (!mensaje.trim()) return;
    setEnviando(true);
    setResultado(null);

    try {
      if (esMasivo) {
        const destsValidos = destinatarios.filter((d) => d.telefono.trim());
        if (destsValidos.length === 0) {
          setResultado({ tipo: 'error', texto: 'Agrega al menos un destinatario con teléfono.' });
          return;
        }
        const { data } = await axiosClient.post('/whatsapp/enviar-masivo', {
          mensaje: mensaje.trim(),
          destinatarios: destsValidos,
        });
        setResultado({
          tipo: data.fallidos === 0 ? 'exito' : 'parcial',
          texto: `Enviados: ${data.enviados}/${data.total}${data.fallidos > 0 ? ` (${data.fallidos} fallidos)` : ''}`,
        });
      } else {
        const tel = destinatarios[0]?.telefono;
        if (!tel) {
          setResultado({ tipo: 'error', texto: 'Ingresa un número de teléfono.' });
          return;
        }
        await axiosClient.post('/whatsapp/enviar', {
          telefono: tel,
          mensaje: mensaje.trim(),
          cedula: destinatarios[0]?.cedula || null,
        });
        setResultado({ tipo: 'exito', texto: 'Mensaje enviado correctamente.' });
      }
      setMensaje('');
      cargarHistorial();
    } catch (err) {
      setResultado({
        tipo: 'error',
        texto: err?.response?.data?.detail || 'Error al enviar mensaje.',
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4" role="region" aria-label="Panel de WhatsApp">
      {/* Estado de conexión */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cargandoEstado ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : estado?.conectado ? (
              <Wifi className="w-5 h-5 text-brand-success" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Estado de WhatsApp</h3>
              <p className="text-xs text-slate-500">
                Instancia: {estado?.instancia || '—'} |
                Estado: <span className={estado?.conectado ? 'text-brand-success font-medium' : 'text-red-500 font-medium'}>
                  {estado?.conectado ? 'Conectado' : 'Desconectado'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={verificarEstado}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Formulario de envío */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Send className="w-4 h-4" /> Enviar Mensaje
        </h3>

        {/* Destinatarios */}
        <div className="space-y-2 mb-3">
          {destinatarios.map((dest, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="Teléfono (ej: 584121234567)"
                value={dest.telefono}
                onChange={(e) => actualizarDestinatario(i, 'telefono', e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              <input
                type="text"
                placeholder="Cédula (opcional)"
                value={dest.cedula}
                onChange={(e) => actualizarDestinatario(i, 'cedula', e.target.value)}
                className="w-28 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              <input
                type="text"
                placeholder="Nombre (opcional)"
                value={dest.nombre}
                onChange={(e) => actualizarDestinatario(i, 'nombre', e.target.value)}
                className="w-36 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              {destinatarios.length > 1 && (
                <button
                  onClick={() => eliminarDestinatario(i)}
                  className="px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={agregarDestinatario}
          className="text-xs text-brand-primary hover:text-brand-deep font-medium mb-3"
        >
          + Agregar destinatario
        </button>

        {/* Mensaje */}
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Escribe tu mensaje aquí..."
          rows={4}
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-brand-primary mb-3"
        />

        {/* Botones */}
        <div className="flex gap-2">
          <button
            onClick={() => enviar(false)}
            disabled={enviando || !mensaje.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-brand-primary hover:bg-brand-deep rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Enviar Individual
          </button>
          <button
            onClick={() => enviar(true)}
            disabled={enviando || !mensaje.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-brand-deep hover:bg-blue-900 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
            Enviar Masivo ({destinatarios.filter((d) => d.telefono.trim()).length})
          </button>
        </div>

        {/* Resultado */}
        {resultado && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium ${
            resultado.tipo === 'exito' ? 'bg-emerald-50 text-emerald-700' :
            resultado.tipo === 'parcial' ? 'bg-amber-50 text-amber-700' :
            'bg-red-50 text-red-700'
          }`}>
            {resultado.texto}
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Historial de Mensajes
          </h3>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg"
          >
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="ENVIADO">Enviados</option>
            <option value="FALLIDO">Fallidos</option>
          </select>
        </div>

        {cargandoHistorial ? (
          <div className="py-8 text-center">
            <Loader2 className="w-4 h-4 mx-auto animate-spin text-slate-400" />
          </div>
        ) : historial.length === 0 ? (
          <p className="text-center text-slate-400 text-xs py-8">No hay mensajes registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Teléfono</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Nombre</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Mensaje</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Estado</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono">{m.destinatario_telefono}</td>
                    <td className="py-2 px-2">{m.destinatario_nombre || '—'}</td>
                    <td className="py-2 px-2 max-w-[200px] truncate">{m.mensaje}</td>
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORES[m.estado] || ''}`}>
                        {m.estado === 'ENVIADO' ? <CheckCircle2 className="w-3 h-3" /> :
                         m.estado === 'FALLIDO' ? <XCircle className="w-3 h-3" /> : null}
                        {m.estado}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-400">
                      {m.created_at ? new Date(m.created_at).toLocaleString('es-VE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

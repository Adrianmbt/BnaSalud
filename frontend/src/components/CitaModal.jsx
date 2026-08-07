import { useCallback, useEffect, useState } from 'react';
import { API, parseCedula } from '../api';
import Icon from './Icon';

export default function CitaModal({ centro, onClose }) {
  const [especialidades, setEspecialidades] = useState([]);
  const [especialidadId, setEspecialidadId] = useState('');
  const [fecha, setFecha] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotMsg, setSlotMsg] = useState('');
  const [hora, setHora] = useState('');
  const [cargandoEsp, setCargandoEsp] = useState(true);
  const [consultandoSlots, setConsultandoSlots] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [apiError, setApiError] = useState('');
  const [exitoCodigo, setExitoCodigo] = useState(null);

  const [form, setForm] = useState({ nombre: '', cedula: '', email: '' });
  const [errores, setErrores] = useState({});

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    let activo = true;
    setCargandoEsp(true);
    API.getEspecialidades(centro.id)
      .then((data) => activo && setEspecialidades(Array.isArray(data) ? data : []))
      .catch(() => activo && setEspecialidades([]))
      .finally(() => activo && setCargandoEsp(false));
    return () => {
      activo = false;
    };
  }, [centro.id]);

  const consultarDisponibilidad = useCallback(async () => {
    if (!centro.id || !especialidadId || !fecha) {
      setSlots([]);
      setSlotMsg('Seleccione fecha y especialidad para ver horarios');
      return;
    }
    setConsultandoSlots(true);
    setHora('');
    try {
      const data = await API.getDisponibilidad({
        centro_id: centro.id,
        especialidad_id: especialidadId,
        fecha,
      });
      if (data.slots && data.slots.length > 0) {
        setSlots(data.slots);
        setSlotMsg('');
      } else {
        setSlots([]);
        setSlotMsg(data.mensaje || 'No hay horarios disponibles para esta fecha.');
      }
    } catch {
      setSlots([]);
      setSlotMsg('Error al consultar horarios.');
    } finally {
      setConsultandoSlots(false);
    }
  }, [centro.id, especialidadId, fecha]);

  useEffect(() => {
    consultarDisponibilidad();
  }, [especialidadId, fecha, consultarDisponibilidad]);

  function validar() {
    const errs = {};
    if (!form.nombre.trim()) errs.nombre = 'Este campo es obligatorio';
    if (!form.cedula.trim()) errs.cedula = 'Este campo es obligatorio';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Ingrese un correo válido';
    if (!especialidadId) errs.especialidad = 'Seleccione una especialidad';
    if (!fecha) errs.fecha = 'Seleccione una fecha';
    if (!hora) errs.hora = 'Seleccione un horario';
    setErrores(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validar()) return;

    setEnviando(true);
    setApiError('');
    const ident = parseCedula(form.cedula);

    const payload = {
      centro_id: centro.id,
      especialidad_id: parseInt(especialidadId, 10),
      fecha_cita: fecha,
      hora_inicio: hora,
      motivo: 'Solicitud web portal municipal',
      paciente: {
        tipo_cedula: ident.tipo_cedula,
        cedula: ident.cedula,
        nombre_completo: form.nombre.trim(),
        email: form.email.trim(),
      },
    };

    try {
      const cita = await API.crearCita(payload);
      setExitoCodigo(cita.codigo_confirmacion || 'CITAB-2026-OK');
    } catch (err) {
      setApiError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const inputCls = (campo) =>
    `w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all ${errores[campo] ? 'border-error' : ''}`;

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
    >
      <div className="bg-white rounded-[2rem] p-8 w-[90%] max-w-[520px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 id="modal-titulo" className="text-2xl font-bold text-primary">Agendar Cita</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-full transition-colors" aria-label="Cerrar modal">
            <Icon name="close" className="text-on-surface-variant" />
          </button>
        </div>

        <p className="text-sm text-on-surface-variant mb-6">
          Agendando cita en: <strong>{centro.nombre}</strong> — {centro.parroquia}
        </p>

        {apiError && (
          <div className="mb-4 p-4 bg-error-container rounded-xl border border-error/20">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="error" className="text-error text-lg" />
              <span className="text-sm font-semibold text-error">Error al agendar</span>
            </div>
            <p className="text-xs text-error/80">{apiError}</p>
          </div>
        )}

        {exitoCodigo ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="check_circle" filled className="text-5xl" />
            </div>
            <h4 className="text-xl font-bold text-primary mb-2">¡Cita Agendada!</h4>
            <p className="text-sm text-on-surface-variant">Recibirás un correo de confirmación con los detalles de tu cita.</p>
            <div className="mt-4 p-4 bg-secondary/5 rounded-xl border border-secondary/20">
              <p className="text-xs text-on-surface-variant mb-1">Código de Confirmación</p>
              <p className="text-lg font-extrabold text-secondary tracking-wider">{exitoCodigo}</p>
            </div>
            <button onClick={onClose} className="mt-6 btn-primary text-white px-8 py-3 rounded-xl font-semibold text-sm shadow-lg">
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              <div>
                <label htmlFor="modal-nombre" className="text-sm font-medium text-on-surface-variant">Nombre Completo</label>
                <input
                  type="text"
                  id="modal-nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className={inputCls('nombre')}
                  placeholder="Ej: Juan Pérez"
                />
                {errores.nombre && <span className="text-xs text-error mt-1 block">{errores.nombre}</span>}
              </div>
              <div>
                <label htmlFor="modal-cedula" className="text-sm font-medium text-on-surface-variant">Cédula de Identidad</label>
                <input
                  type="text"
                  id="modal-cedula"
                  value={form.cedula}
                  onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                  className={inputCls('cedula')}
                  placeholder="V-12345678"
                />
                {errores.cedula && <span className="text-xs text-error mt-1 block">{errores.cedula}</span>}
              </div>
              <div>
                <label htmlFor="modal-email" className="text-sm font-medium text-on-surface-variant">Correo Electrónico</label>
                <input
                  type="email"
                  id="modal-email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputCls('email')}
                  placeholder="ejemplo@correo.com"
                />
                {errores.email && <span className="text-xs text-error mt-1 block">{errores.email}</span>}
              </div>
              <div>
                <label htmlFor="modal-especialidad" className="text-sm font-medium text-on-surface-variant">Especialidad</label>
                <select
                  id="modal-especialidad"
                  value={especialidadId}
                  onChange={(e) => setEspecialidadId(e.target.value)}
                  className={inputCls('especialidad')}
                >
                  <option value="">{cargandoEsp ? 'Cargando especialidades...' : 'Seleccione una especialidad'}</option>
                  {especialidades.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
                {errores.especialidad && <span className="text-xs text-error mt-1 block">{errores.especialidad}</span>}
              </div>
              <div>
                <label htmlFor="modal-fecha" className="text-sm font-medium text-on-surface-variant">Fecha Preferida</label>
                <input
                  type="date"
                  id="modal-fecha"
                  value={fecha}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFecha(e.target.value)}
                  className={inputCls('fecha')}
                />
                {errores.fecha && <span className="text-xs text-error mt-1 block">{errores.fecha}</span>}
              </div>
              <div>
                <label className="text-sm font-medium text-on-surface-variant">Horario Disponible</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {consultandoSlots && (
                    <span className="text-xs text-secondary animate-pulse flex items-center gap-1">
                      <Icon name="sync" className="text-sm animate-spin" /> Consultando disponibilidad...
                    </span>
                  )}
                  {!consultandoSlots && slots.length === 0 && (
                    <span className={`text-xs italic ${slotMsg.includes('Error') || slotMsg.includes('No hay') ? 'text-error' : 'text-on-surface-variant/60'}`}>
                      {slotMsg}
                    </span>
                  )}
                  {!consultandoSlots && slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setHora(slot.length === 5 ? `${slot}:00` : slot)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${hora === (slot.length === 5 ? `${slot}:00` : slot) ? 'bg-secondary text-white border-secondary' : 'border-outline-variant text-primary hover:border-secondary hover:bg-secondary/5'}`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                {errores.hora && <span className="text-xs text-error mt-1 block">{errores.hora}</span>}
              </div>
            </div>
            <div className="flex gap-3 mt-8 pt-6 border-t border-outline-variant/20">
              <button type="button" onClick={onClose} className="flex-1 border-2 border-outline-variant text-on-surface-variant font-semibold text-sm rounded-xl py-3 hover:bg-surface-container-low transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={enviando} className="flex-1 btn-primary text-white font-semibold text-sm rounded-xl py-3 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {enviando ? (
                  <>
                    <Icon name="sync" className="text-sm animate-spin" /> Procesando...
                  </>
                ) : (
                  'Confirmar Cita'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

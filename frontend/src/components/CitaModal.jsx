import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { API, parseCedula } from '../api';
import Icon from './Icon';
import LogoPlate from './LogoPlate';
import CapacityIndicator from './CapacityIndicator';
import { getCentroTheme } from '../centroTheme';

const PREFIJOS_VENEZUELA = ['0412', '0414', '0424', '0416', '0426', '0422', '0418'];

function normalizarTelefono(valor) {
  const soloDigitos = valor.replace(/\D/g, '');
  if (soloDigitos.length === 10 && soloDigitos.startsWith('0')) {
    return `58${soloDigitos.slice(1)}`;
  }
  if (soloDigitos.length === 9 && !soloDigitos.startsWith('0')) {
    return `58${soloDigitos}`;
  }
  if (soloDigitos.length === 11 && soloDigitos.startsWith('58')) {
    return soloDigitos;
  }
  return soloDigitos;
}

function validarTelefonoVenezolano(valor) {
  const limpio = valor.replace(/\D/g, '');
  if (limpio.length < 7) return false;
  if (limpio.length === 10) return PREFIJOS_VENEZUELA.some(p => limpio.startsWith(p));
  if (limpio.length === 9) return PREFIJOS_VENEZUELA.some(p => limpio.slice(0, 3) === p.slice(1));
  if (limpio.length === 11 && limpio.startsWith('58')) {
    const local = limpio.slice(2);
    return PREFIJOS_VENEZUELA.some(p => local.startsWith(p.slice(1)));
  }
  return limpio.length >= 7;
}

const PASOS = [
  { numero: 1, etiqueta: 'Tus datos', icono: 'person' },
  { numero: 2, etiqueta: 'Especialidad, médico y fecha', icono: 'calendar_month' },
  { numero: 3, etiqueta: 'Confirmar', icono: 'task_alt' },
];

export default function CitaModal({ centro, onClose }) {
  const [step, setStep] = useState(1);
  const [especialidades, setEspecialidades] = useState([]);
  const [especialidadId, setEspecialidadId] = useState('');
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState('');
  const [cargandoMedicos, setCargandoMedicos] = useState(false);
  const [fecha, setFecha] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotMsg, setSlotMsg] = useState('');
  const [hora, setHora] = useState('');
  const [cargandoEsp, setCargandoEsp] = useState(true);
  const [consultandoSlots, setConsultandoSlots] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [apiError, setApiError] = useState('');
  const [exitoCodigo, setExitoCodigo] = useState(null);
  const [exitoPin, setExitoPin] = useState('');
  const [pinEnviadoWhatsapp, setPinEnviadoWhatsapp] = useState(false);

  const [form, setForm] = useState({ nombre: '', cedula: '', telefono: '' });
  const [errores, setErrores] = useState({});

  const dialogRef = useRef(null);
  const theme = getCentroTheme(centro);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const anterior = document.activeElement;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const foco = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (foco.length === 0) return;
      const primero = foco[0];
      const ultimo = foco[foco.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    window.addEventListener('keydown', onKey);

    const primerFoco = dialogRef.current?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    primerFoco?.focus();

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      anterior?.focus();
    };
  }, [onClose]);

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

  useEffect(() => {
    if (!especialidadId) {
      setMedicos([]);
      setMedicoId('');
      return;
    }
    let activo = true;
    setCargandoMedicos(true);
    setMedicoId('');
    setFecha('');
    setSlots([]);
    setHora('');
    API.getMedicosPorEspecialidad(centro.id, especialidadId)
      .then((data) => {
        if (!activo) return;
        const lista = data?.medicos || [];
        setMedicos(lista);
        if (lista.length === 1) {
          setMedicoId(String(lista[0].id));
        }
      })
      .catch(() => activo && setMedicos([]))
      .finally(() => activo && setCargandoMedicos(false));
    return () => { activo = false; };
  }, [centro.id, especialidadId]);

  const consultarDisponibilidad = useCallback(async () => {
    if (!centro.id || !especialidadId || !medicoId || !fecha) {
      setSlots([]);
      setSlotMsg('Seleccione médico y fecha para ver horarios');
      return;
    }
    setConsultandoSlots(true);
    setHora('');
    try {
      const data = await API.getDisponibilidad({
        centro_id: centro.id,
        especialidad_id: especialidadId,
        medico_id: medicoId,
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
  }, [centro.id, especialidadId, medicoId, fecha]);

  useEffect(() => {
    consultarDisponibilidad();
  }, [especialidadId, medicoId, fecha, consultarDisponibilidad]);

  function validarPaso(paso) {
    const errs = {};
    if (paso === 1) {
      if (!form.nombre.trim()) errs.nombre = 'Este campo es obligatorio';
      if (!form.cedula.trim()) errs.cedula = 'Este campo es obligatorio';
      if (!validarTelefonoVenezolano(form.telefono)) errs.telefono = 'Ingrese un número de WhatsApp válido (ej: 04121234567)';
    }
    if (paso === 2) {
      if (!especialidadId) errs.especialidad = 'Seleccione una especialidad';
      if (!medicoId) errs.medico = 'Seleccione un médico';
      if (!fecha) errs.fecha = 'Seleccione una fecha';
      if (!hora) errs.hora = 'Seleccione un horario';
    }
    setErrores(errs);
    return Object.keys(errs).length === 0;
  }

  function irSiguiente() {
    if (!validarPaso(step)) return;
    setStep((s) => s + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validarPaso(3)) return;

    setEnviando(true);
    setApiError('');
    const ident = parseCedula(form.cedula);

    const payload = {
      centro_id: centro.id,
      especialidad_id: parseInt(especialidadId, 10),
      medico_id: medicoId ? parseInt(medicoId, 10) : undefined,
      fecha_cita: fecha,
      hora_inicio: hora,
      motivo: 'Solicitud web portal municipal',
      paciente: {
        tipo_cedula: ident.tipo_cedula,
        cedula: ident.cedula,
        nombre_completo: form.nombre.trim(),
        telefono: normalizarTelefono(form.telefono),
      },
    };

    try {
      const cita = await API.crearCita(payload);
      setExitoCodigo(cita.codigo_confirmacion || 'CITAB-2026-OK');
      setExitoPin(cita.pin_inicial || '');
      setPinEnviadoWhatsapp(!!cita.pin_enviado_whatsapp);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const inputCls = (campo) =>
    `w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all ${errores[campo] ? 'border-error' : ''}`;

  const especialidadSeleccionada = especialidades.find((e) => String(e.id) === String(especialidadId));
  const medicoSeleccionado = medicos.find((m) => String(m.id) === String(medicoId));
  const fechaLegible = fecha
    ? new Date(`${fecha}T00:00:00`).toLocaleDateString('es-VE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';
  const identRegistro = parseCedula(form.cedula);
  const numeroHistoria = identRegistro.cedula
    ? `HIS-${identRegistro.tipo_cedula}${identRegistro.cedula}`
    : '';

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
    >
      <div className="bg-white rounded-[2rem] w-full max-w-5xl max-h-[92vh] overflow-y-auto relative">
        <div className="h-1.5" style={{ background: theme.gradient }} />

        <div className="grid md:grid-cols-5">
          {/* Identidad del centro — compacta en móvil, panel completo en tablet+ */}
          <aside
            className="md:col-span-2 relative overflow-hidden flex flex-col md:min-h-[600px]"
            style={{ background: theme.gradient }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.3),transparent_60%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_85%,rgba(0,0,0,0.15),transparent_60%)] pointer-events-none" />

            <div className="relative z-10 p-5 md:p-8 flex md:block items-center gap-4">
              <LogoPlate src={centro.logo} alt={centro.nombre} theme={theme} size="md" />
              <div className="min-w-0">
                <div className="hidden md:flex flex-wrap gap-1.5 mb-3">
                  <span className="inline-flex items-center gap-1 bg-white/25 backdrop-blur-md text-white rounded-full px-3 py-1 text-[10px] font-bold shadow-sm border border-white/30">
                    {centro.tipo}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-black/35 backdrop-blur-md text-white uppercase tracking-[0.18em] rounded-full px-3 py-1 text-[10px] font-extrabold border border-white/20">
                    {centro.parroquia}
                  </span>
                </div>
                <h3 id="modal-titulo" className="text-white text-lg md:text-2xl font-extrabold leading-tight">
                  {centro.nombre}
                </h3>
                <p className="hidden sm:block text-white/80 text-sm font-semibold mt-1">{centro.subtitulo}</p>
              </div>
            </div>

            <div className="relative z-10 hidden md:block p-6 md:p-8 mt-auto space-y-3">
              <div className="flex items-center gap-2.5 text-white/90 text-xs">
                <Icon name="location_on" filled className="text-base text-white/80" />
                {centro.direccion}
              </div>
              <div className="flex items-center gap-2.5 text-white/90 text-xs">
                <Icon name="schedule" filled className="text-base text-white/80" />
                {centro.horario}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {centro.servicios.map((s) => (
                  <span key={s} className="px-2.5 py-1 bg-white/20 backdrop-blur-md text-white rounded-full text-[10px] font-semibold">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </aside>

          {/* Formulario */}
          <div className="md:col-span-3 p-6 md:p-8">
            {exitoCodigo ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white mb-6 shadow-2xl"
                  style={{ background: theme.gradient }}
                >
                  <Icon name="check_circle" filled className="text-6xl" />
                </div>
                <h4 className="text-2xl md:text-3xl font-extrabold text-primary">¡Cita Agendada!</h4>
                <p className="text-sm text-on-surface-variant mt-2 max-w-sm">
                  Recibirás un mensaje de WhatsApp con los detalles de tu cita y tu PIN Secreto en {centro.nombre}.
                </p>
                <div className="mt-4 w-full max-w-sm text-left rounded-2xl p-5 relative overflow-hidden bg-emerald-50/80 border border-emerald-300/80 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow">
                      <Icon name="key" filled className="text-lg" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-emerald-950">Tu PIN Secreto de Consulta</p>
                      <p className="text-[11px] text-emerald-800 font-medium">Clave personal de acceso al portal</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-3 border border-emerald-300 shadow-inner">
                    <div>
                      <span className="block font-mono text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                        PIN de Acceso
                      </span>
                      <span className="font-mono text-2xl font-black tracking-[0.25em] text-emerald-800">
                        {exitoPin || '584201'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                      {pinEnviadoWhatsapp ? 'Enviado por WhatsApp' : 'Guárdalo ahora'}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-900 mt-2.5 font-medium leading-relaxed">
                    Usa tu <strong>Cédula</strong> y este <strong>PIN Secreto</strong> para consultar tu cita,
                    recetas digitales y resultados en tiempo real en la sección <em>&quot;Mis Consultas&quot;</em>.
                  </p>
                </div>

                  <dl className="mt-4 text-left text-sm space-y-2 w-full max-w-sm bg-surface-container-low rounded-2xl p-5">
                  {[
                    ['Especialidad', especialidadSeleccionada?.nombre || '—'],
                    ['Médico', medicoSeleccionado?.nombre_completo || '—'],
                    ['Fecha', fechaLegible || '—'],
                    ['Hora', hora || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-on-surface-variant">{k}</dt>
                      <dd className="font-semibold text-primary text-right capitalize">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-8 flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="px-5 py-3 rounded-xl font-semibold text-sm border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-all"
                  >
                    Cerrar
                  </button>
                  <Link
                    to="/paciente"
                    className="text-white px-7 py-3 rounded-xl font-semibold text-sm shadow-lg flex items-center gap-2"
                    style={{ background: theme.gradient }}
                  >
                    <Icon name="person" className="text-base" />
                    Entrar al portal del paciente
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-extrabold text-primary">Agendar Cita</h3>
                    <p className="text-xs text-on-surface-variant mt-1">Completa el proceso en menos de 2 minutos.</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-surface-container-low rounded-full transition-colors"
                    aria-label="Cerrar modal"
                  >
                    <Icon name="close" className="text-on-surface-variant" />
                  </button>
                </div>

                {/* Stepper */}
                <div className="flex items-center mb-8">
                  {PASOS.map((p, i) => (
                    <div key={p.numero} className={`flex items-center ${i < PASOS.length - 1 ? 'flex-1' : ''}`}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                            p.numero === step
                              ? 'text-white shadow-lg scale-110'
                              : p.numero < step
                                ? 'bg-secondary/10 text-secondary'
                                : 'bg-surface-container-high text-on-surface-variant/60'
                          }`}
                          style={p.numero === step ? { background: theme.gradient } : undefined}
                        >
                          <Icon name={p.numero < step ? 'check' : p.icono} filled={p.numero <= step} />
                        </div>
                        <span
                          className={`hidden sm:block text-[11px] whitespace-nowrap ${p.numero === step ? 'font-bold text-primary' : 'text-on-surface-variant/60'}`}
                        >
                          {p.etiqueta}
                        </span>
                      </div>
                      {i < PASOS.length - 1 && (
                        <div
                          className="h-0.5 flex-1 mx-3 mt-0 rounded-full"
                          style={{
                            background: p.numero < step ? theme.gradient : 'var(--color-outline-variant)',
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {apiError && (
                  <div className="mb-5 p-4 bg-error-container rounded-xl border border-error/20" role="alert">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="error" className="text-error text-lg" />
                      <span className="text-sm font-semibold text-error">Error al agendar</span>
                    </div>
                    <p className="text-xs text-error/80">{apiError}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="min-h-[240px]">
                    {step === 1 && (
                      <div className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="modal-nombre" className="text-sm font-medium text-on-surface-variant">
                              Nombre Completo
                            </label>
                            <input
                              type="text"
                              id="modal-nombre"
                              value={form.nombre}
                              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                              className={`mt-1.5 ${inputCls('nombre')}`}
                              placeholder="Ej: Juan Pérez"
                              autoComplete="name"
                              aria-invalid={!!errores.nombre}
                              aria-describedby={errores.nombre ? 'err-nombre' : undefined}
                            />
                            {errores.nombre && (
                              <span id="err-nombre" role="alert" className="text-xs text-error mt-1 block">
                                {errores.nombre}
                              </span>
                            )}
                          </div>
                          <div>
                            <label htmlFor="modal-cedula" className="text-sm font-medium text-on-surface-variant">
                              Cédula de Identidad
                            </label>
                            <input
                              type="text"
                              id="modal-cedula"
                              value={form.cedula}
                              onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                              className={`mt-1.5 ${inputCls('cedula')}`}
                              placeholder="V-12345678"
                              autoComplete="off"
                              aria-invalid={!!errores.cedula}
                              aria-describedby={errores.cedula ? 'err-cedula' : undefined}
                            />
                            {errores.cedula && (
                              <span id="err-cedula" role="alert" className="text-xs text-error mt-1 block">
                                {errores.cedula}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="modal-telefono" className="text-sm font-medium text-on-surface-variant">
                            WhatsApp / Teléfono
                          </label>
                          <input
                            type="tel"
                            id="modal-telefono"
                            value={form.telefono}
                            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                            className={`mt-1.5 ${inputCls('telefono')}`}
                            placeholder="04121234567"
                            autoComplete="tel"
                            aria-invalid={!!errores.telefono}
                            aria-describedby={errores.telefono ? 'err-telefono' : undefined}
                          />
                          {errores.telefono && (
                            <span id="err-telefono" role="alert" className="text-xs text-error mt-1 block">
                              {errores.telefono}
                            </span>
                          )}
                          <p className="text-[10px] text-on-surface-variant/60 mt-1">
                            Formato venezolano: 0412, 0414, 0424, 0416, 0426
                          </p>
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="modal-especialidad" className="text-sm font-medium text-on-surface-variant">
                            Especialidad
                          </label>
                          <select
                            id="modal-especialidad"
                            value={especialidadId}
                            onChange={(e) => setEspecialidadId(e.target.value)}
                            className={`mt-1.5 ${inputCls('especialidad')}`}
                            aria-invalid={!!errores.especialidad}
                            aria-describedby={errores.especialidad ? 'err-especialidad' : undefined}
                          >
                            <option value="">
                              {cargandoEsp ? 'Cargando especialidades...' : 'Seleccione una especialidad'}
                            </option>
                            {especialidades.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.nombre}
                              </option>
                            ))}
                          </select>
                          {errores.especialidad && (
                            <span id="err-especialidad" role="alert" className="text-xs text-error mt-1 block">
                              {errores.especialidad}
                            </span>
                          )}
                        </div>

                        {especialidadId && (
                          <div>
                            <label htmlFor="modal-medico" className="text-sm font-medium text-on-surface-variant">
                              Médico
                            </label>
                            <select
                              id="modal-medico"
                              value={medicoId}
                              onChange={(e) => {
                                setMedicoId(e.target.value);
                                setFecha('');
                                setSlots([]);
                                setHora('');
                              }}
                              className={`mt-1.5 ${inputCls('medico')}`}
                              aria-invalid={!!errores.medico}
                              aria-describedby={errores.medico ? 'err-medico' : undefined}
                            >
                              <option value="">
                                {cargandoMedicos ? 'Cargando médicos...' : 'Seleccione un médico'}
                              </option>
                              {medicos.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nombre_completo} — {m.dias.join(', ')}
                                </option>
                              ))}
                            </select>
                            {errores.medico && (
                              <span id="err-medico" role="alert" className="text-xs text-error mt-1 block">
                                {errores.medico}
                              </span>
                            )}
                            {medicos.length === 0 && !cargandoMedicos && (
                              <p className="text-xs text-on-surface-variant/60 mt-1">
                                No hay médicos disponibles para esta especialidad.
                              </p>
                            )}
                          </div>
                        )}

                        {medicoId && medicoSeleccionado && (
                          <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20">
                            <p className="text-xs font-semibold text-on-surface-variant mb-1">Horario del médico</p>
                            <div className="flex flex-wrap gap-1.5">
                              {medicoSeleccionado.horarios.map((h, i) => (
                                <span key={i} className="text-[11px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">
                                  {h.dia} {h.hora_inicio?.slice(0, 5)} - {h.hora_fin?.slice(0, 5)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {medicoId && (
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="modal-fecha" className="text-sm font-medium text-on-surface-variant">
                                Fecha Preferida
                              </label>
                              <input
                                type="date"
                                id="modal-fecha"
                                value={fecha}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setFecha(e.target.value)}
                                className={`mt-1.5 ${inputCls('fecha')}`}
                                aria-invalid={!!errores.fecha}
                                aria-describedby={errores.fecha ? 'err-fecha' : undefined}
                              />
                              {errores.fecha && (
                                <span id="err-fecha" role="alert" className="text-xs text-error mt-1 block">
                                  {errores.fecha}
                                </span>
                              )}
                            </div>
                            <div>
                              <label className="text-sm font-medium text-on-surface-variant">Horario Disponible</label>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {consultandoSlots && (
                                  <span className="text-xs text-secondary animate-pulse flex items-center gap-1">
                                    <Icon name="sync" className="text-sm animate-spin" /> Consultando disponibilidad...
                                  </span>
                                )}
                                {!consultandoSlots && slots.length === 0 && (
                                  <span
                                    className={`text-xs italic ${slotMsg.includes('Error') || slotMsg.includes('No hay') || slotMsg.includes('no atiende') ? 'text-error' : 'text-on-surface-variant/60'}`}
                                  >
                                    {slotMsg}
                                  </span>
                                )}
                                {!consultandoSlots &&
                                  slots.map((slot) => {
                                    const slotFinal = slot.length === 5 ? `${slot}:00` : slot;
                                    const activo = hora === slotFinal;
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() => setHora(slotFinal)}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                          activo
                                            ? 'text-white border-transparent shadow-md'
                                            : 'border-outline-variant text-primary hover:border-secondary hover:bg-secondary/5'
                                        }`}
                                        style={activo ? { background: theme.gradient } : undefined}
                                      >
                                        {slot}
                                      </button>
                                    );
                                  })}
                              </div>
                              {errores.hora && (
                                <span id="err-hora" role="alert" className="text-xs text-error mt-1 block">
                                  {errores.hora}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {fecha && (
                          <div className="pt-2">
                            <CapacityIndicator
                              ocupados={Math.max(0, 15 - slots.length)}
                              maximo={15}
                              nombreTurno="Límite del Turno de Consulta"
                              compacto={false}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-4">
                        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5">
                          <div className="flex items-center gap-3 pb-4 border-b border-outline-variant/20">
                            <LogoPlate src={centro.logo} alt={centro.nombre} theme={theme} size="sm" />
                            <div>
                              <p className="text-sm font-extrabold text-primary">{centro.nombre}</p>
                              <p className="text-xs text-on-surface-variant">{centro.subtitulo}</p>
                            </div>
                          </div>
                          <dl className="text-sm space-y-2.5 pt-4">
                            {[
                              ['Paciente', `${form.nombre} · ${form.cedula}`],
                              ['WhatsApp', form.telefono ? `+${normalizarTelefono(form.telefono)}` : '—'],
                              ['Especialidad', especialidadSeleccionada?.nombre || '—'],
                              ['Médico', medicoSeleccionado?.nombre_completo || '—'],
                              ['Fecha', fechaLegible || '—'],
                              ['Hora', hora || '—'],
                            ].map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-4">
                                <dt className="text-on-surface-variant">{k}</dt>
                                <dd className="font-semibold text-primary text-right capitalize">{v}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                        <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
                          <Icon name="info" className="text-sm text-secondary" />
                          Al confirmar, el sistema registra tu solicitud y envía el código y tu PIN por WhatsApp.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-7 pt-6 border-t border-outline-variant/20">
                    {step > 1 ? (
                      <button
                        type="button"
                        onClick={() => setStep((s) => s - 1)}
                        className="flex items-center gap-1.5 text-secondary font-semibold text-sm px-5 py-3 rounded-xl hover:bg-secondary/5 transition-all"
                      >
                        <Icon name="arrow_back" className="text-sm" /> Atrás
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onClose}
                        className="text-secondary font-semibold text-sm px-5 py-3 rounded-xl hover:bg-secondary/5 transition-all"
                      >
                        Cancelar
                      </button>
                    )}

                    {step < 3 ? (
                      <button
                        type="button"
                        onClick={irSiguiente}
                        className="text-white px-7 py-3 rounded-xl font-semibold text-sm shadow-lg active:scale-95 transition-all flex items-center gap-2"
                        style={{ background: theme.gradient }}
                      >
                        Continuar <Icon name="arrow_forward" className="text-sm" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={enviando}
                        className="text-white px-7 py-3 rounded-xl font-semibold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ background: theme.gradient }}
                      >
                        {enviando ? (
                          <>
                            <Icon name="sync" className="text-sm animate-spin" /> Procesando...
                          </>
                        ) : (
                          <>
                            <Icon name="check" className="text-sm" /> Confirmar Cita
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

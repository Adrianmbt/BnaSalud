import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X,
  Stethoscope,
  CalendarDays,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Send,
  UserRound,
  Phone,
  Clock,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';

function fechaLarga(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('es-VE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function horaHumana(hhmm) {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (h === 12 && m === '00') return '12:00 m';
  const ampm = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function rangoTurnoHumano(inicio, fin) {
  if (!inicio || !fin) return '';
  return `${horaHumana(inicio)} – ${horaHumana(fin)}`;
}

function cupoBadgeColor(cupos) {
  const n = Number(cupos || 0);
  if (n >= 6) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (n >= 1) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

function calcularLunesSemana(offsetSemanas = 0) {
  const hoy = new Date();
  const diaSemana = hoy.getDay();
  const diffAlLunes = (diaSemana === 0 ? -6 : 1) - diaSemana;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffAlLunes + offsetSemanas * 7);
  return lunes.toISOString().split('T')[0];
}

export default function AsignarCitaModal({
  citaId,
  pacienteData,
  especialistasCache = null,
  onClose,
  onAsignada,
  // Desplaza el modal fuera del sidebar de 256 px (lg) para que no lo tape.
  offsetConSidebar = false,
}) {
  const [data, setData] = useState(null);
  const [cuposSemanal, setCuposSemanal] = useState(null);
  const [semanasLista, setSemanasLista] = useState([]);
  const [especialistas, setEspecialistas] = useState(especialistasCache || []);
  const [cargando, setCargando] = useState(true);
  const [cargandoCupos, setCargandoCupos] = useState(false);
  const [cargandoSemanas, setCargandoSemanas] = useState(false);
  const [error, setError] = useState('');
  const [medicoId, setMedicoId] = useState(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [modoEmergencia, setModoEmergencia] = useState(false);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [dropdownSemanasAbierto, setDropdownSemanasAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [citaConfirmada, setCitaConfirmada] = useState(null);

  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownSemanasAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (pacienteData) {
      const dataConstruida = { paciente: pacienteData, cita: { ...pacienteData } };
      setData(dataConstruida);
      setCargando(false);
      return;
    }
    if (!citaId) return;
    let vivo = true;
    setCargando(true);
    axiosClient
      .get(`/reprogramaciones/ficha/${citaId}`)
      .then((r) => { if (vivo) setData(r.data); })
      .catch(() => { if (vivo) setError('No se pudo cargar la solicitud.'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [citaId, pacienteData]);

  useEffect(() => {
    if (especialistasCache && especialistasCache.length > 0) {
      setEspecialistas(especialistasCache);
      return;
    }
    let vivo = true;
    axiosClient
      .get('/agenda/especialistas')
      .then((r) => { if (vivo) setEspecialistas(r.data || []); })
      .catch(() => { if (vivo) setEspecialistas([]); });
    return () => { vivo = false; };
  }, [especialistasCache]);

  const paciente = data?.paciente;
  const cita = data?.cita;
  const especialidadCita = cita?.especialidad || '';
  const centroCita = cita?.centro_salud || '';

  useEffect(() => {
    if (cita?.medico_id && !medicoId) {
      setMedicoId(cita.medico_id);
    }
  }, [cita, medicoId]);

  useEffect(() => {
    if (!medicoId) {
      setSemanasLista([]);
      return;
    }
    let vivo = true;
    setCargandoSemanas(true);
    axiosClient
      .get('/agenda/semanas-resumen', { params: { medico_id: medicoId, cantidad: 6 } })
      .then((r) => {
        if (vivo) setSemanasLista(r.data || []);
      })
      .catch(() => {
        if (vivo) setSemanasLista([]);
      })
      .finally(() => {
        if (vivo) setCargandoSemanas(false);
      });
    return () => { vivo = false; };
  }, [medicoId]);

  useEffect(() => {
    if (!medicoId) {
      setCuposSemanal(null);
      setFechaSeleccionada(null);
      setTurnoSeleccionado(null);
      return;
    }
    let vivo = true;
    setCargandoCupos(true);
    const params = { medico_id: medicoId };
    if (semanaOffset !== 0) {
      params.semana_desde = calcularLunesSemana(semanaOffset);
    }

    axiosClient
      .get('/agenda/cupos-semanal', { params })
      .then((r) => {
        if (vivo) {
          setCuposSemanal(r.data || null);
          setFechaSeleccionada(null);
          setTurnoSeleccionado(null);
        }
      })
      .catch(() => {
        if (vivo) setCuposSemanal(null);
      })
      .finally(() => {
        if (vivo) setCargandoCupos(false);
      });
    return () => { vivo = false; };
  }, [medicoId, semanaOffset]);

  const especialistasFiltrados = useMemo(() => {
    if (modoEmergencia) return especialistas;
    if (!especialidadCita) return especialistas;
    const filtrados = especialistas.filter((esp) => esp.especialidad === especialidadCita);
    return filtrados.length > 0 ? filtrados : especialistas;
  }, [especialistas, especialidadCita, modoEmergencia]);

  const turnosDia = useMemo(() => {
    if (!cuposSemanal || !fechaSeleccionada) return [];
    const dia = cuposSemanal.dias?.find((d) => d.fecha === fechaSeleccionada);
    return dia ? (dia.turnos || []) : [];
  }, [cuposSemanal, fechaSeleccionada]);

  useEffect(() => {
    if (turnosDia.length === 1 && !turnoSeleccionado) {
      setTurnoSeleccionado(turnosDia[0]);
    }
  }, [turnosDia, turnoSeleccionado]);

  const semanaActualInfo = useMemo(() => {
    return semanasLista.find((s) => s.offset === semanaOffset) || null;
  }, [semanasLista, semanaOffset]);

  const semanaTieneHorarioAprobado = useMemo(() => {
    return Boolean(cuposSemanal?.dias?.some((d) => d.turnos?.length > 0));
  }, [cuposSemanal]);

  const confirmarAsignacion = useCallback(async () => {
    if (!medicoId || !fechaSeleccionada || !turnoSeleccionado) {
      setError('Seleccione médico, fecha y turno antes de continuar.');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const payload = {
        cita_id: citaId || cita?.id || null,
        paciente_id: paciente?.id || null,
        medico_id: medicoId,
        fecha: fechaSeleccionada,
        hora_inicio: turnoSeleccionado.hora_asignada || turnoSeleccionado.hora_inicio,
        turno_id: turnoSeleccionado.turno_id,
        nivel: 'verde',
        especialidad: cita?.especialidad || '',
        motivo: cita?.motivo || 'Asignación de cita',
        origen: modoEmergencia ? 'emergencia' : (cita?.origen || 'remision'),
        preasignada: false,
      };
      const resp = await axiosClient.post('/agenda/citas', payload);
      setEnviando(false);
      setCitaConfirmada(resp.data);
      onAsignada?.();
    } catch (err) {
      setEnviando(false);
      setError(err?.response?.data?.detail || 'Error al asignar la cita.');
    }
  }, [medicoId, fechaSeleccionada, turnoSeleccionado, paciente, cita, citaId, onAsignada, modoEmergencia]);

  const confirmarPreasignacion = useCallback(async () => {
    if (!medicoId) {
      setError('Seleccione un médico especialista.');
      return;
    }
    const fechaLunes = semanaActualInfo?.semana_desde || calcularLunesSemana(semanaOffset);
    setEnviando(true);
    setError('');
    try {
      const payload = {
        cita_id: citaId || cita?.id || null,
        paciente_id: paciente?.id || null,
        medico_id: medicoId,
        fecha: fechaLunes,
        nivel: 'verde',
        especialidad: cita?.especialidad || '',
        // Sin turno ni hora: salen del horario del especialista al certificar.
        motivo: `Preasignada para ${semanaActualInfo?.etiqueta || 'la semana'}`,
        origen: modoEmergencia ? 'emergencia' : (cita?.origen || 'remision'),
        preasignada: true,
      };
      const resp = await axiosClient.post('/agenda/citas', payload);
      setEnviando(false);
      setCitaConfirmada(resp.data);
      onAsignada?.();
    } catch (err) {
      setEnviando(false);
      setError(err?.response?.data?.detail || 'Error al preasignar la cita.');
    }
  }, [medicoId, semanaActualInfo, semanaOffset, citaId, cita, paciente, modoEmergencia, onAsignada]);

  if (!citaId) return null;

  const medicoSeleccionado = especialistas.find((e) => e.id === medicoId);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 animate-fade-in ${
        offsetConSidebar ? 'lg:pl-64' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Asignar cita"
    >
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      />

      <aside
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-3xl lg:max-w-4xl mx-auto flex flex-col border border-slate-200 overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        id="contenido-modal"
      >
        {/* Header Modal Compacto */}
        <header className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-brand-deep/10 text-brand-deep flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 truncate text-xs">
              <span className="font-bold text-slate-900 text-sm">
                {citaConfirmada ? 'Confirmación de Cita' : 'Asignar Cita Médica'}
              </span>
              {paciente?.nombre_completo && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-700 font-semibold truncate">{paciente.nombre_completo}</span>
                  <span className="font-mono text-slate-400">V-{paciente.cedula || '—'}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Cuerpo del Modal */}
        <div className="p-3 sm:p-4 space-y-3 overflow-y-auto">
          {cargando ? (
            <div className="py-14 text-center">
              <Loader2 className="w-7 h-7 text-brand-deep animate-spin mx-auto" />
              <p className="text-xs text-slate-500 mt-2 font-medium">Cargando información de la cita…</p>
            </div>
          ) : error ? (
            <div
              className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 text-xs font-semibold"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : citaConfirmada ? (
            /* Vista de Confirmación o Preasignación */
            <div className="space-y-4 text-center py-3 max-w-md mx-auto">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
                citaConfirmada.estado === 'preasignada'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-600'
              }`}>
                {citaConfirmada.estado === 'preasignada' ? (
                  <Clock className="w-7 h-7" />
                ) : (
                  <CheckCircle2 className="w-7 h-7" />
                )}
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">
                  {citaConfirmada.estado === 'preasignada'
                    ? '¡Cupo Semanal Preasignado!'
                    : '¡Cita Confirmada con Éxito!'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {citaConfirmada.estado === 'preasignada'
                    ? 'El cupo ha sido reservado. Cuando RRHH certifique el horario semanal, el sistema le asignará el día y el turno según la agenda del especialista.'
                    : 'Registrada en la agenda médica y notificada en el sistema.'}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-left space-y-2 text-xs text-slate-700">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Estado:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                    citaConfirmada.estado === 'preasignada'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {citaConfirmada.estado === 'preasignada' ? 'PREASIGNADA (Aprobación RRHH)' : 'CONFIRMADA'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Paciente:</span>
                  <span className="font-semibold text-slate-900">{paciente?.nombre_completo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Especialidad:</span>
                  <span className="font-semibold text-slate-900">{citaConfirmada.especialidad || especialidadCita}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Médico:</span>
                  <span className="font-semibold text-slate-900">Dr(a). {citaConfirmada.medico_nombre || medicoSeleccionado?.nombre}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Semana:</span>
                  <span className="font-semibold text-slate-900">
                    {citaConfirmada.estado === 'preasignada'
                      ? `${semanaActualInfo?.etiqueta || 'Semana elegida'} · Día y turno según el horario del especialista`
                      : `${fechaLarga(citaConfirmada.fecha_cita)} · ${turnoSeleccionado?.nombre || 'Consulta'}`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                Cerrar y volver a solicitudes
              </button>
            </div>
          ) : (
            <>
              {/* Barra Única: Paciente + Selector de Médico */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <UserRound className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-900">{paciente?.nombre_completo || 'Paciente'}</span>
                  </div>
                  {paciente?.telefono && (
                    <div className="flex items-center gap-1 text-slate-500">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{paciente.telefono}</span>
                    </div>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold text-[11px]">
                    {especialidadCita || 'Consulta'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {centroCita || 'CITAB'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-1 md:max-w-sm justify-end">
                  <select
                    id="medico-select"
                    value={medicoId || ''}
                    onChange={(e) => {
                      setMedicoId(Number(e.target.value) || null);
                      setFechaSeleccionada(null);
                      setTurnoSeleccionado(null);
                      setSemanaOffset(0);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-brand-deep/20 focus:border-brand-deep transition-all"
                    aria-label="Seleccionar médico"
                  >
                    <option value="">— Elija Médico Especialista —</option>
                    {especialistasFiltrados.map((esp) => (
                      <option key={esp.id} value={esp.id}>
                        Dr(a). {esp.nombre} — {esp.especialidad}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-500 whitespace-nowrap select-none" title="Ver todos los médicos">
                    <input
                      type="checkbox"
                      checked={modoEmergencia}
                      onChange={(e) => {
                        setModoEmergencia(e.target.checked);
                        setMedicoId(null);
                        setFechaSeleccionada(null);
                        setTurnoSeleccionado(null);
                      }}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-brand-deep"
                    />
                    <span>Todos</span>
                  </label>
                </div>
              </div>

              {/* Área Central de Selección: Días y Turnos */}
              {medicoId ? (
                <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-3">
                  {/* Fila del Desplegable de Semanas */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Semana
                      </span>
                      {semanaActualInfo && (
                        <span className="text-[11px] font-semibold text-slate-500">
                          (Máx. 10 cupos por turno)
                        </span>
                      )}
                    </div>

                    {/* Desplegable de Semanas Compacto */}
                    <div className="flex items-center gap-1.5 relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setSemanaOffset((prev) => Math.max(0, prev - 1))}
                        disabled={semanaOffset <= 0 || cargandoCupos}
                        aria-label="Semana anterior"
                        className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                        title="Semana anterior"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Botón Trigger del Desplegable */}
                      <button
                        type="button"
                        onClick={() => setDropdownSemanasAbierto((prev) => !prev)}
                        className={`h-7 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-bold transition-all ${
                          semanaActualInfo?.tiene_cupos
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 hover:bg-emerald-100/70'
                            : semanaActualInfo
                            ? 'bg-rose-50/70 border-rose-300 text-rose-900 hover:bg-rose-100/70'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                        }`}
                        title="Haga clic para ver semanas disponibles"
                      >
                        <CalendarDays className="w-3.5 h-3.5 opacity-70" />
                        <span className="truncate max-w-[170px] text-[11px]">
                          {semanaActualInfo?.etiqueta || (cuposSemanal ? `${cuposSemanal.semana_desde} al ${cuposSemanal.semana_hasta}` : 'Seleccionar semana')}
                        </span>

                        {semanaActualInfo && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase border ${
                              semanaActualInfo.tiene_cupos
                                ? 'bg-emerald-200/80 text-emerald-800 border-emerald-300'
                                : 'bg-rose-200/80 text-rose-800 border-rose-300'
                            }`}
                          >
                            {semanaActualInfo.tiene_cupos ? `${semanaActualInfo.cupos_libres}` : '0'}
                          </span>
                        )}

                        <ChevronDown className={`w-3 h-3 transition-transform opacity-60 ${dropdownSemanasAbierto ? 'rotate-180' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setSemanaOffset((prev) => prev + 1)}
                        disabled={cargandoCupos}
                        aria-label="Semana siguiente"
                        className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors shrink-0"
                        title="Semana siguiente"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Menú Desplegable Flotante */}
                      {dropdownSemanasAbierto && (
                        <div className="absolute right-0 top-8 z-50 w-64 sm:w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-fade-in overflow-hidden">
                          <div className="px-2.5 py-1 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Semanas</span>
                            <span className="flex items-center gap-2">
                              <span className="text-emerald-600">● Con cupo</span>
                              <span className="text-amber-600">● Pendiente RRHH</span>
                              <span className="text-rose-600">● Sin cupo</span>
                            </span>
                          </div>

                          <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                            {cargandoSemanas ? (
                              <div className="py-4 text-center text-xs text-slate-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto mb-1 text-brand-deep" />
                                Consultando…
                              </div>
                            ) : semanasLista.length === 0 ? (
                              <div className="py-3 text-center text-xs text-slate-400">
                                Sin semanas disponibles.
                              </div>
                            ) : (
                              semanasLista.map((sem) => {
                                const seleccionada = sem.offset === semanaOffset;
                                return (
                                  <button
                                    key={sem.offset}
                                    type="button"
                                    onClick={() => {
                                      setSemanaOffset(sem.offset);
                                      setDropdownSemanasAbierto(false);
                                    }}
                                    className={`w-full px-2.5 py-2 text-left flex items-center justify-between gap-2 transition-colors ${
                                      seleccionada
                                        ? 'bg-brand-deep/[0.06] font-bold text-slate-900'
                                        : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                          sem.certificada === false
                                            ? 'bg-amber-400'
                                            : sem.tiene_cupos
                                            ? 'bg-emerald-500'
                                            : 'bg-rose-500'
                                        }`}
                                      />
                                      <span className="text-[11px] truncate">{sem.etiqueta}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span
                                        className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${
                                          sem.certificada === false
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : sem.tiene_cupos
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                        }`}
                                      >
                                        {sem.certificada === false
                                          ? 'Pendiente RRHH'
                                          : sem.tiene_cupos
                                          ? `${sem.cupos_libres} cupos`
                                          : 'Agotado'}
                                      </span>
                                      {seleccionada && (
                                        <Check className="w-3 h-3 text-brand-deep stroke-[3]" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {cargandoCupos ? (
                    <div className="py-8 text-center">
                      <Loader2 className="w-5 h-5 text-brand-deep animate-spin mx-auto" />
                      <p className="text-xs text-slate-500 mt-1 font-medium">Consultando disponibilidad…</p>
                    </div>
                  ) : !semanaTieneHorarioAprobado ? (
                    /* Semana con Horario Pendiente de Aprobación por RRHH -> MODO PREASIGNACIÓN */
                    <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-3.5 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="text-xs text-amber-900 min-w-0">
                          <p className="font-bold text-sm">Horario pendiente de verificación por RRHH</p>
                          <p className="text-amber-800/90 mt-0.5 text-[11px] leading-relaxed">
                            El horario definitivo de esta semana aún no ha sido certificado por Recursos Humanos. Puede <strong>preasignar</strong> el cupo: cuando RRHH certifique el horario, el sistema tomará el día y el turno del especialista y asignará la cita por orden de llegada.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-amber-200/60">
                        <p className="text-[11px] text-amber-800/90 leading-relaxed">
                          No hace falta elegir turno: el día, el turno y la hora se toman del horario
                          cargado del especialista en cuanto RRHH certifique la semana.
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Layout con Horario Aprobado */
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                      {/* Columna 1: Días de la Semana */}
                      <div className="md:col-span-5 space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          1. Elegir Día
                        </p>

                        <div className="grid grid-cols-5 gap-1.5">
                          {cuposSemanal?.dias?.map((d) => {
                            const disponible = d.cupos_libres > 0;
                            const seleccionado = fechaSeleccionada === d.fecha;
                            const diaNum = d.fecha.split('-')[2];
                            const badgeClase = cupoBadgeColor(d.cupos_libres);

                            return (
                              <button
                                key={d.fecha}
                                type="button"
                                disabled={!disponible}
                                onClick={() => {
                                  setFechaSeleccionada(d.fecha);
                                  setTurnoSeleccionado(null);
                                }}
                                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border transition-all text-center ${
                                  seleccionado
                                    ? 'bg-brand-deep border-brand-deep text-white shadow-sm ring-1 ring-brand-deep/30'
                                    : !disponible
                                    ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                                    : 'bg-white border-slate-200 hover:border-brand-deep hover:bg-slate-50 text-slate-800'
                                }`}
                              >
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${seleccionado ? 'text-emerald-100' : 'text-slate-400'}`}>
                                  {d.nombre?.slice(0, 3) || 'Día'}
                                </span>
                                <span className="font-extrabold text-sm leading-tight my-0.5">
                                  {diaNum}
                                </span>
                                <span
                                  className={`text-[8px] font-bold px-1 rounded-full border leading-tight ${
                                    seleccionado
                                      ? 'bg-white/20 border-white/30 text-white'
                                      : disponible
                                      ? badgeClase
                                      : 'bg-transparent border-transparent text-slate-300'
                                  }`}
                                >
                                  {disponible ? `${d.cupos_libres}` : '—'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Columna 2: Turnos Genéricos (Máximo 10 cupos) */}
                      <div className="md:col-span-7 space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          2. Elegir Turno (Máx. 10 cupos)
                        </p>

                        {!fechaSeleccionada ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center flex flex-col items-center justify-center min-h-[75px]">
                            <p className="text-xs font-semibold text-slate-500">
                              Seleccione un día con cupo a la izquierda
                            </p>
                          </div>
                        ) : turnosDia.length === 0 ? (
                          <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center text-xs text-rose-700 font-semibold">
                            Sin turnos disponibles en este día.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {turnosDia.map((t) => {
                              const esManana = (t.nombre || '').toLowerCase().includes('mañana') || parseInt(t.hora_inicio, 10) < 13;
                              const nombreVisible = t.nombre || (esManana ? 'Mañana' : 'Tarde');
                              const horarioVisible = rangoTurnoHumano(t.hora_inicio, t.hora_fin);
                              const seleccionado = turnoSeleccionado?.turno_id === t.turno_id;

                              return (
                                <button
                                  key={t.turno_id}
                                  type="button"
                                  onClick={() => setTurnoSeleccionado(t)}
                                  className={`p-2.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between gap-1 ${
                                    seleccionado
                                      ? 'border-brand-deep bg-brand-deep/[0.04] shadow-sm'
                                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <div className={`p-1 rounded-md ${seleccionado ? 'bg-brand-deep text-white' : 'bg-slate-100 text-slate-600'}`}>
                                        {esManana ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                                      </div>
                                      <span className={`font-bold text-xs ${seleccionado ? 'text-brand-deep' : 'text-slate-900'}`}>
                                        {nombreVisible}
                                      </span>
                                    </div>
                                    {seleccionado && (
                                      <Check className="w-3.5 h-3.5 text-brand-deep stroke-[3]" />
                                    )}
                                  </div>

                                  <div>
                                    <p className="text-[11px] font-semibold text-slate-700 leading-tight">
                                      {horarioVisible}
                                    </p>
                                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                                      {t.cupos_libres} cupo{t.cupos_libres !== 1 ? 's' : ''} libre{t.cupos_libres !== 1 ? 's' : ''} / 10
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                  <Stethoscope className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-600">
                    Seleccione un médico arriba para desplegar el calendario y turnos
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Modal Compacto */}
        <footer className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            {citaConfirmada ? (
              <span className="text-xs font-semibold text-emerald-700">Operación exitosa</span>
            ) : !semanaTieneHorarioAprobado && medicoId ? (
              <div className="text-xs truncate text-amber-900 font-medium">
                <span className="font-bold">Preasignación:</span> {semanaActualInfo?.etiqueta || 'Semana'} · Día y turno según el horario del especialista
              </div>
            ) : turnoSeleccionado ? (
              <div className="text-xs truncate text-slate-700">
                <span className="font-bold text-brand-deep">Dr(a). {medicoSeleccionado?.nombre}</span>
                <span className="mx-1 text-slate-300">·</span>
                <span className="font-semibold">{fechaLarga(fechaSeleccionada)}</span>
                <span className="mx-1 text-slate-300">·</span>
                <span className="text-emerald-700 font-bold">{turnoSeleccionado.nombre || 'Turno'} ({rangoTurnoHumano(turnoSeleccionado.hora_inicio, turnoSeleccionado.hora_fin)})</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">
                {medicoId ? 'Seleccione día y turno' : 'Seleccione médico especialista'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
            >
              {citaConfirmada ? 'Cerrar' : 'Cancelar'}
            </button>

            {!citaConfirmada && !semanaTieneHorarioAprobado && medicoId && (
              <button
                type="button"
                onClick={confirmarPreasignacion}
                disabled={enviando}
                className="py-1.5 px-3.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-sm hover:bg-amber-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {enviando ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Preasignar Cupo Semanal</span>
                  </>
                )}
              </button>
            )}

            {!citaConfirmada && semanaTieneHorarioAprobado && turnoSeleccionado && (
              <button
                type="button"
                onClick={confirmarAsignacion}
                disabled={enviando}
                className="py-1.5 px-3.5 rounded-xl bg-brand-deep text-white text-xs font-bold shadow-sm hover:bg-brand-primary active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {enviando ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Asignar Cita y Notificar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}

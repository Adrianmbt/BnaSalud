import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  MapPin,
  MessageCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { obtenerCuposSemanal } from '../../api/reprogramaciones';

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

function cupoColor(cupos) {
  const n = Number(cupos || 0);
  if (n >= 6) return { bg: 'bg-emerald-50/60', border: 'border-emerald-200/80', text: 'text-emerald-800' };
  if (n >= 1) return { bg: 'bg-amber-50/60', border: 'border-amber-200/80', text: 'text-amber-700' };
  return { bg: 'bg-rose-50/60', border: 'border-rose-200/80', text: 'text-rose-700' };
}

export default function AsignarCitaModal({ citaId, pacienteData, onClose, onAsignada }) {
  const [data, setData] = useState(null);
  const [cuposSemanal, setCuposSemanal] = useState(null);
  const [especialistas, setEspecialistas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [medicoId, setMedicoId] = useState(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [modoEmergencia, setModoEmergencia] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [citaConfirmada, setCitaConfirmada] = useState(null);

  // Cargar ficha del paciente y datos de la cita
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

  // Especialistas disponibles
  useEffect(() => {
    axiosClient
      .get('/agenda/especialistas')
      .then((r) => setEspecialistas(r.data || []))
      .catch(() => setEspecialistas([]));
  }, []);

  // Cupos semanales del médico seleccionado
  useEffect(() => {
    if (!medicoId) {
      setCuposSemanal(null);
      setFechaSeleccionada(null);
      setTurnoSeleccionado(null);
      return;
    }
    let vivo = true;
    axiosClient
      .get('/agenda/cupos-semanal', { params: { medico_id: medicoId } })
      .then((r) => { if (vivo) setCuposSemanal(r.data || null); })
      .catch(() => { if (vivo) setCuposSemanal(null); });
    return () => { vivo = false; };
  }, [medicoId]);

  const paciente = data?.paciente;
  const cita = data?.cita;
  const especialidadCita = cita?.especialidad || '';
  const centroCita = cita?.centro_salud || '';

  // Médicos filtrados por especialidad, o todos si es modo emergencia
  const especialistasFiltrados = useMemo(() => {
    if (modoEmergencia) return especialistas;
    return especialistas.filter((esp) => esp.especialidad === especialidadCita);
  }, [especialistas, especialidadCita, modoEmergencia]);

  // Días con cupos del médico seleccionado
  const diasConCupos = useMemo(
    () => (cuposSemanal?.dias || []).filter((d) => d.cupos_libres > 0),
    [cuposSemanal]
  );

  // Jornadas (turnos) del día seleccionado
  const jornadasDia = useMemo(() => {
    if (!cuposSemanal || !fechaSeleccionada) return [];
    const dia = cuposSemanal.dias.find((d) => d.fecha === fechaSeleccionada);
    return dia ? (dia.turnos || []) : [];
  }, [cuposSemanal, fechaSeleccionada]);

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
        hora_inicio: turnoSeleccionado.hora_inicio,
        turno_id: turnoSeleccionado.turno_id,
        nivel: 'verde',
        especialidad: cita?.especialidad || '',
        motivo: cita?.motivo || 'Asignación de cita',
        origen: modoEmergencia ? 'emergencia' : (cita?.origen || 'remision'),
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

  if (!citaId) return null;

  // Sección: datos del paciente
  const seccionPaciente = (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
      <p className="text-[10px] font-semibold text-slate-400 tracking-wider">
        Paciente
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-slate-700">
        <div className="flex items-start gap-3">
          <UserRound className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-900 leading-tight">
              {paciente?.nombre_completo || 'Sin nombre'}
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              V-{paciente?.cedula || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Phone className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-900 leading-tight">
              {paciente?.telefono || 'Sin teléfono'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 col-span-2">
          <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <p className="font-semibold text-slate-900 leading-tight">
            {paciente?.direccion || 'Sin dirección'}
          </p>
        </div>
        <div className="flex items-start gap-3 col-span-2">
          <CalendarDays className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-900 leading-tight">
              {especialidadCita || 'Sin especialidad'}
            </p>
            <p className="text-[11px] text-slate-500">
              Solicitud por la web ({centroCita || 'CITAB'})
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  // Sección: elegir médico
  const seccionMedico = (
    <section className="rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Stethoscope className="w-5 h-5 text-brand-deep" />
        <h4 className="font-bold text-sm text-slate-900">
          Elegir médico
        </h4>
        <span className="ml-auto text-[10px] font-bold text-slate-400 tracking-wider">
          {modoEmergencia ? 'Emergencia' : especialidadCita}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        {modoEmergencia
          ? 'Cualquier médico disponible para atención de urgencia.'
          : `Especialistas de ${especialidadCita} con cupos disponibles.`}
      </p>
      <label htmlFor="modo-emergencia" className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
        <input
          id="modo-emergencia"
          type="checkbox"
          checked={modoEmergencia}
          onChange={(e) => {
            setModoEmergencia(e.target.checked);
            setMedicoId(null);
            setFechaSeleccionada(null);
            setTurnoSeleccionado(null);
          }}
          className="w-4 h-4 rounded border-slate-300 text-brand-deep focus:ring-brand-deep"
        />
        <span>Atención de emergencia (cualquier médico)</span>
      </label>
      {especialistasFiltrados.length === 0 ? (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">
          No hay especialistas disponibles en este momento.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label htmlFor="medico-select" className="text-[10px] font-semibold text-slate-400 tracking-wider">
            Médico
          </label>
          <select
            id="medico-select"
            value={medicoId || ''}
            onChange={(e) => {
              setMedicoId(Number(e.target.value) || null);
              setFechaSeleccionada(null);
              setTurnoSeleccionado(null);
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-brand-deep/20 focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label="Seleccionar médico"
          >
            <option value="">— Elija un médico —</option>
            {especialistasFiltrados.map((esp) => (
              <option key={esp.id} value={esp.id}>
                Dr(a). {esp.nombre} — {esp.especialidad}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  );

  // Sección: cupos semanales + calendario de días + turnos
  const seccionCupos = (
    <section className="rounded-xl border border-slate-200 p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-brand-deep" />
          <h4 className="font-bold text-sm text-slate-900">
            Elegir fecha y turno
          </h4>
        </div>
        {cuposSemanal && (
          <span className="text-[10px] font-bold text-slate-400 tracking-wider">
            {cuposSemanal.especialidad}
          </span>
        )}
      </div>

      {cuposSemanal === null && (
        <p className="text-xs text-amber-600 font-semibold py-8 text-center">
          Cargando horario del médico…
        </p>
      )}

      {cuposSemanal && cuposSemanal.dias.length === 0 && (
        <p className="text-xs text-rose-600 font-semibold py-8 text-center">
          Sin días disponibles para este médico.
        </p>
      )}

      {cuposSemanal && cuposSemanal.dias.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contador semanal */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-[10px] font-semibold text-slate-400 tracking-wider mb-3">
              Cupos esta semana
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">
                Disponibles:
              </span>
              <span className="font-bold text-lg text-slate-900">
                {cuposSemanal.cupos_libres_totales}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Semana {cuposSemanal.semana_desde} al {cuposSemanal.semana_hasta}
            </p>
          </div>

          {/* Calendario visual de días */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold text-slate-400 tracking-wider">
              Días disponibles (esta semana)
            </p>
            <div className="grid grid-cols-7 gap-1">
              {cuposSemanal.dias.map((d) => {
                const c = cupoColor(d.cupos_libres);
                const disponible = d.cupos_libres > 0;
                const seleccionado = fechaSeleccionada === d.fecha;
                return (
                  <button
                    key={d.fecha}
                    type="button"
                    disabled={!disponible}
                    onClick={
                      disponible
                        ? () => { setFechaSeleccionada(d.fecha); setTurnoSeleccionado(null); }
                        : undefined
                    }
                    className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-all ${
                      seleccionado
                        ? 'bg-brand-deep border-brand-deep text-white'
                        : !disponible
                        ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                        : `${c.bg} ${c.border} ${c.text} hover:border-slate-300`
                    }`}
                  >
                    <span className={`font-bold text-sm ${seleccionado ? 'text-white' : disponible ? c.text : 'text-slate-300'}`}>
                      {d.fecha.split('-')[2]}
                    </span>
                    <span className={`text-[10px] font-semibold ${seleccionado ? 'text-emerald-100' : disponible ? c.text : 'text-slate-400'}`}>
                      {disponible ? d.cupos_libres : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Verde: 6+ cupos · Amarillo: 1-5 cupos · Rojo: sin cupos · Gris: sin disponibilidad
            </p>
          </div>

          {/* Detalles del día y turno */}
          <div className="space-y-4">
            {fechaSeleccionada ? (
              <>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 tracking-wider">
                    Turnos disponibles
                  </p>
                  <p className="font-bold text-sm text-slate-900 mb-3">
                    {fechaLarga(fechaSeleccionada)}
                  </p>
                  {jornadasDia.length === 0 ? (
                    <p className="text-xs text-rose-600 font-semibold py-4 text-center">
                      Sin turnos libres este día.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {jornadasDia.map((t) => {
                        const seleccionado = turnoSeleccionado?.turno_id === t.turno_id;
                        return (
                          <button
                            key={t.turno_id}
                            type="button"
                            onClick={() => setTurnoSeleccionado(t)}
                            className={`w-full py-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                              seleccionado
                                ? 'bg-brand-deep border-brand-deep text-white'
                                : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className={`text-xs font-semibold ${seleccionado ? 'text-emerald-100' : 'text-slate-600'}`}>
                              {t.turno_nombre || 'Turno'}
                            </span>
                            <span className={`font-bold text-sm ${seleccionado ? 'text-white' : 'text-slate-900'}`}>
                              {t.hora_inicio} - {t.hora_fin}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {turnoSeleccionado && (
                  <div className="rounded-xl border border-brand-deep/20 bg-brand-deep/[0.03] p-4 space-y-3">
                    <p className="text-[10px] font-semibold text-brand-deep tracking-wider">
                      Confirmar asignación
                    </p>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Médico</span>
                        <span className="font-semibold text-slate-900">
                          Dr(a).{' '}
                          {especialistasFiltrados.find((e) => e.id === medicoId)?.nombre}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Fecha</span>
                        <span className="font-semibold text-slate-900">
                          {fechaLarga(fechaSeleccionada)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Turno</span>
                        <span className="font-semibold text-slate-900">
                          {turnoSeleccionado.turno_nombre ? `${turnoSeleccionado.turno_nombre} · ${turnoSeleccionado.hora_inicio}-${turnoSeleccionado.hora_fin}` : `${turnoSeleccionado.hora_inicio}-${turnoSeleccionado.hora_fin}`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={confirmarAsignacion}
                      disabled={enviando}
                      className="w-full py-4 px-5 rounded-xl bg-brand-deep text-white text-sm font-bold shadow-lg shadow-brand-deep/25 hover:bg-brand-primary active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2"
                    >
                      {enviando ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Send className="w-5 h-5" />
                          Asignar cita y notificar por WhatsApp
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-8 text-center">
                <p className="text-xs text-slate-400 mb-3">
                  Seleccione un día del calendario para ver los turnos disponibles.
                </p>
                <p className="text-[10px] text-slate-400">
                  Verde: 6+ cupos · Amarillo: 1-5 cupos · Rojo: sin cupos · Gris: sin disponibilidad
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );

  // Sección: confirmación exitosa
  const seccionConfirmada = citaConfirmada ? (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="font-bold text-lg text-slate-900">
        ¡Cita confirmada!
      </h2>
      <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
        La cita ha sido agendada en la agenda médica. El paciente puede verla en el portal web.
      </p>

      <section className="rounded-xl bg-slate-50 border border-slate-100 p-6 text-left space-y-4 text-sm text-slate-700">
        <div className="flex items-start gap-4">
          <span className="font-bold text-slate-500 w-28 shrink-0">Centro:</span>
          {citaConfirmada.centro_salud || centroCita || 'CITAB'}
        </div>
        <div className="flex items-start gap-4">
          <span className="font-bold text-slate-500 w-28 shrink-0">Médico:</span>
          Dr(a).{' '}
          {citaConfirmada.medico_nombre ||
            especialistas.find((e) => e.id === medicoId)?.nombre}
        </div>
        <div className="flex items-start gap-4">
          <span className="font-bold text-slate-500 w-28 shrink-0">Especialidad:</span>
          {citaConfirmada.especialidad || especialidadCita}
        </div>
        <div className="flex items-start gap-4">
          <span className="font-bold text-slate-500 w-28 shrink-0">Fecha y hora:</span>
          {fechaLarga(citaConfirmada.fecha_cita)} a las{' '}
          {citaConfirmada.hora_inicio}
        </div>
        <div className="flex items-start gap-4">
          <span className="font-bold text-slate-500 w-28 shrink-0">Código:</span>
          <span className="font-mono font-bold text-brand-deep">
            {citaConfirmada.codigo_confirmacion}
          </span>
        </div>
      </section>

      {citaConfirmada.whatsapp_url ? (
        <a
          href={citaConfirmada.whatsapp_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl bg-brand-deep text-white text-sm font-semibold shadow-lg shadow-brand-deep/25 hover:bg-brand-primary active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2"
        >
          <MessageCircle className="w-5 h-5" />
          Abrir WhatsApp Web con confirmación
        </a>
      ) : (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">
          El paciente no tiene un número telefónico registrado para enviar por WhatsApp Web.
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full py-3 px-6 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2"
      >
        Cerrar y volver a la lista
      </button>
    </div>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Asignar cita"
    >
      {/* Skip link para lectores de pantalla */}
      <a
        href="#contenido-modal"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10001] focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:border focus:border-brand-deep"
      >
        Ir al contenido de la modal
      </a>

      <div
        className="absolute inset-0 z-[9998] bg-slate-900/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className="relative z-[10000] bg-white rounded-2xl shadow-2xl w-full sm:max-w-2xl mx-auto flex flex-col max-h-[90vh] border border-slate-200/70"
        id="contenido-modal"
      >
        <header className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold tracking-wider text-slate-400"
            >
              {citaConfirmada ? 'Cita confirmada' : 'Asignar cita'}
            </p>
            <h3 className="font-bold text-base text-slate-900 truncate leading-tight">
              {paciente?.nombre_completo || (cargando ? 'Cargando…' : 'Sin historia')}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">
              V-{paciente?.cedula || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 shrink-0">
          {cargando && (
            <div className="py-20 text-center">
              <Loader2 className="w-7 h-7 text-brand-deep animate-spin mx-auto" />
              <p className="text-sm text-slate-500 mt-3">Cargando solicitud de cita…</p>
            </div>
          )}

          {error && (
            <div
              className="flex items-start gap-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 text-sm font-semibold"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!cargando && data && (
            <>
              {seccionPaciente}

              {!citaConfirmada && medicoId ? seccionCupos : seccionMedico}

              {citaConfirmada && seccionConfirmada}
            </>
          )}
        </div>

        <footer className="border-t border-slate-100 bg-white/80 backdrop-blur px-6 py-3.5 flex items-center justify-between shrink-0">
          {!citaConfirmada && (
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2"
            >
              Cancelar
            </button>
          )}
          {citaConfirmada && (
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-brand-deep hover:bg-brand-deep/10 rounded-lg px-4 py-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2"
            >
              Cerrar
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

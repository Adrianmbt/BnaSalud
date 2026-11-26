import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Moon,
  Phone,
  Search,
  Send,
  Sun,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import {
  buscarPacientesRecepcion,
  crearCitaRecepcion,
  obtenerDisponibilidadRecepcion,
} from '../../api/citasRecepcion';

function hoyISO() {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

function fechaLarga(iso) {
  if (!iso) return 'Sin fecha';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('es-VE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
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

function rangoTurno(inicio, fin) {
  if (!inicio || !fin) return '';
  return `${horaHumana(inicio)} – ${horaHumana(fin)}`;
}

function vinculoPaciente(p) {
  if (!p?.vinculo) return '';
  if (p.vinculo === 'trabajador') return 'Trabajador';
  const parentesco = (p.parentesco || '').toLowerCase();
  const trabajador = p.empleado_nombre ? ` de ${p.empleado_nombre}` : '';
  return `Beneficiario${parentesco ? ` · ${parentesco}` : ''}${trabajador}`;
}

const FORM_NUEVO_VACIO = {
  cedula: '',
  nombre_completo: '',
  apellido: '',
  telefono: '',
  comuna: '',
  fecha_nacimiento: '',
};

const CAMPO = 'cp-input !py-1.5 text-sm w-full';

export default function NuevaSolicitudCitaModal({ clinicaId, onClose, onCreada }) {
  const [especialistas, setEspecialistas] = useState([]);
  const [especialidad, setEspecialidad] = useState('');
  const [medicoId, setMedicoId] = useState(null);

  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [pacienteSel, setPacienteSel] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState(FORM_NUEVO_VACIO);

  const [fecha, setFecha] = useState(hoyISO());
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [cargandoDisp, setCargandoDisp] = useState(false);
  const [turnoSel, setTurnoSel] = useState(null);
  const [horaSel, setHoraSel] = useState('');

  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  // Cartera del centro: solo los médicos que pertenecen a esta clínica.
  useEffect(() => {
    let vivo = true;
    axiosClient
      .get('/agenda/especialistas', { params: clinicaId ? { centro_id: clinicaId } : {} })
      .then((r) => { if (vivo) setEspecialistas(r.data || []); })
      .catch(() => { if (vivo) setEspecialistas([]); });
    return () => { vivo = false; };
  }, [clinicaId]);

  useEffect(() => {
    const alPresionar = (e) => { if (e.key === 'Escape' && !enviando) onClose?.(); };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [onClose, enviando]);

  // Buscador de pacientes (cédula o nombre), con retardo corto.
  useEffect(() => {
    const termino = q.trim();
    if (termino.length < 2 || pacienteSel || nuevo) {
      setResultados([]);
      return undefined;
    }
    let vivo = true;
    setBuscando(true);
    const timer = setTimeout(() => {
      buscarPacientesRecepcion(termino)
        .then((items) => { if (vivo) setResultados(items); })
        .catch(() => { if (vivo) setResultados([]); })
        .finally(() => { if (vivo) setBuscando(false); });
    }, 300);
    return () => { vivo = false; clearTimeout(timer); };
  }, [q, pacienteSel, nuevo]);

  // Disponibilidad del médico para la fecha elegida.
  useEffect(() => {
    if (!medicoId || !fecha) {
      setDisponibilidad(null);
      return undefined;
    }
    let vivo = true;
    setCargandoDisp(true);
    setTurnoSel(null);
    setHoraSel('');
    obtenerDisponibilidadRecepcion({ medico_id: medicoId, fecha })
      .then((data) => { if (vivo) setDisponibilidad(data); })
      .catch((err) => {
        if (vivo) {
          setDisponibilidad(null);
          setError(err?.response?.data?.detail || 'No se pudo consultar la disponibilidad.');
        }
      })
      .finally(() => { if (vivo) setCargandoDisp(false); });
    return () => { vivo = false; };
  }, [medicoId, fecha]);

  const especialidades = useMemo(() => {
    const mapa = new Map();
    especialistas.forEach((e) => {
      const nombre = (e.especialidad || '').trim();
      if (nombre) mapa.set(nombre.toLowerCase(), nombre);
    });
    return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [especialistas]);

  const medicosFiltrados = useMemo(() => {
    if (!especialidad) return especialistas;
    return especialistas.filter(
      (e) => (e.especialidad || '').toLowerCase() === especialidad.toLowerCase(),
    );
  }, [especialistas, especialidad]);

  const medicoSel = especialistas.find((e) => e.id === medicoId) || null;

  const puedeGuardar = Boolean(
    (pacienteSel || (nuevo && formNuevo.cedula.trim() && formNuevo.nombre_completo.trim()))
    && medicoId
    && fecha
    && turnoSel,
  );

  const seleccionarPaciente = (p) => {
    setPacienteSel(p);
    setResultados([]);
    setQ(p.nombre_completo || p.cedula || '');
    setNuevo(false);
  };

  const limpiarPaciente = () => {
    setPacienteSel(null);
    setQ('');
    setResultados([]);
  };

  const guardar = useCallback(async () => {
    setError('');
    if (!puedeGuardar) {
      setError('Complete paciente, médico, fecha y turno antes de registrar la cita.');
      return;
    }
    setEnviando(true);
    try {
      const payload = {
        medico_id: medicoId,
        fecha,
        turno_id: turnoSel?.turno_id ?? null,
        hora_inicio: horaSel || turnoSel?.hora_asignada || null,
        motivo: motivo.trim() || null,
        centro_id: clinicaId || null,
      };
      if (pacienteSel?.id) {
        payload.paciente_id = pacienteSel.id;
      } else if (pacienteSel) {
        // Trabajador o beneficiario sin historia clínica: el backend crea la
        // ficha a partir de estos datos al confirmar la cita.
        payload.paciente = {
          cedula: pacienteSel.cedula,
          nombre_completo: pacienteSel.nombre_completo,
          telefono: pacienteSel.telefono || null,
          fecha_nacimiento: pacienteSel.fecha_nacimiento || null,
        };
      } else {
        payload.paciente = {
          cedula: formNuevo.cedula.trim(),
          nombre_completo: formNuevo.nombre_completo.trim(),
          apellido: formNuevo.apellido.trim() || null,
          telefono: formNuevo.telefono.trim() || null,
          comuna: formNuevo.comuna.trim() || null,
          fecha_nacimiento: formNuevo.fecha_nacimiento || null,
        };
      }
      const resp = await crearCitaRecepcion(payload);
      setResultado(resp);
      onCreada?.();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo registrar la cita.');
    } finally {
      setEnviando(false);
    }
  }, [puedeGuardar, medicoId, fecha, turnoSel, horaSel, motivo, clinicaId, pacienteSel, formNuevo, onCreada]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Nueva solicitud de cita">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => { if (!enviando) onClose?.(); }}
      />

      <aside className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-deep/10 text-brand-deep">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-sm font-bold text-brand-deep">
                {resultado ? 'Cita registrada' : 'Nueva solicitud / Asignar cita'}
              </h3>
              <p className="truncate text-xs text-slate-500">
                {resultado ? `Turno #${resultado.numero_turno} · ${resultado.codigo_confirmacion}` : 'Recepción · cita presencial o telefónica'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto px-4">
          {resultado ? (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">Cita confirmada</p>
                  <p className="text-xs text-slate-500">
                    Guardada en la agenda local con el turno #{resultado.numero_turno}.
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-1.5 rounded-lg bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-slate-200/70">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Paciente</dt>
                  <dd className="truncate font-semibold text-slate-900">{resultado.paciente?.nombre_completo}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Especialidad</dt>
                  <dd className="truncate font-semibold text-slate-900">{resultado.especialidad}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Médico</dt>
                  <dd className="truncate font-semibold text-slate-900">Dr(a). {resultado.medico_nombre}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Fecha y hora</dt>
                  <dd className="text-right font-semibold capitalize text-slate-900">
                    {fechaLarga(resultado.fecha_cita)} · {horaHumana(resultado.hora_inicio)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-slate-200/70 pt-1.5">
                  <dt className="text-slate-500">Portal web</dt>
                  <dd className={`text-right font-bold ${resultado.sincronizada ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {resultado.sincronizada ? 'Sincronizada' : 'Pendiente (se envía al reconectar)'}
                  </dd>
                </div>
              </dl>

              <div className="flex items-center gap-2">
                {resultado.whatsapp_url && (
                  <a
                    href={resultado.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-2 py-3 text-xs font-semibold text-rose-700" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              {/* 1. Paciente */}
              <section className="space-y-2 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-700">Paciente</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setNuevo((v) => !v);
                      setPacienteSel(null);
                      setResultados([]);
                      setQ('');
                    }}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors ${
                      nuevo
                        ? 'border-brand-deep bg-brand-deep text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Paciente nuevo
                  </button>
                </div>

                {pacienteSel ? (
                  <div className="flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-2.5 py-2 ring-1 ring-emerald-200">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{pacienteSel.nombre_completo}</p>
                      <p className="truncate text-[11px] text-slate-600">
                        <span className="font-mono">V-{pacienteSel.cedula || '—'}</span>
                        {pacienteSel.telefono ? ` · ${pacienteSel.telefono}` : ''}
                        {vinculoPaciente(pacienteSel) ? ` · ${vinculoPaciente(pacienteSel)}` : ''}
                      </p>
                      {!pacienteSel.id && (
                        <p className="mt-0.5 text-[11px] font-semibold text-amber-700">
                          Sin historia clínica: se crea al confirmar la cita.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={limpiarPaciente}
                      className="shrink-0 text-[11px] font-bold text-slate-500 hover:text-rose-600"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : nuevo ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      value={formNuevo.cedula}
                      onChange={(e) => setFormNuevo({ ...formNuevo, cedula: e.target.value })}
                      placeholder="Cédula *"
                      className={CAMPO}
                      aria-label="Cédula del paciente nuevo"
                    />
                    <input
                      value={formNuevo.nombre_completo}
                      onChange={(e) => setFormNuevo({ ...formNuevo, nombre_completo: e.target.value })}
                      placeholder="Nombre completo *"
                      className={CAMPO}
                      aria-label="Nombre del paciente nuevo"
                    />
                    <input
                      value={formNuevo.telefono}
                      onChange={(e) => setFormNuevo({ ...formNuevo, telefono: e.target.value })}
                      placeholder="Teléfono / WhatsApp"
                      className={CAMPO}
                      aria-label="Teléfono del paciente nuevo"
                    />
                    <input
                      value={formNuevo.comuna}
                      onChange={(e) => setFormNuevo({ ...formNuevo, comuna: e.target.value })}
                      placeholder="Comuna"
                      className={CAMPO}
                      aria-label="Comuna del paciente nuevo"
                    />
                    <input
                      type="date"
                      value={formNuevo.fecha_nacimiento}
                      onChange={(e) => setFormNuevo({ ...formNuevo, fecha_nacimiento: e.target.value })}
                      className={CAMPO}
                      aria-label="Fecha de nacimiento"
                      title="Fecha de nacimiento"
                    />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Cédula o nombre de paciente, trabajador o beneficiario"
                        className={`${CAMPO} pl-9`}
                        aria-label="Buscar paciente"
                      />
                      {buscando && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                      )}
                    </div>
                    {resultados.length > 0 && (
                      <ul className="max-h-36 divide-y divide-slate-100 overflow-y-auto rounded-md ring-1 ring-slate-200">
                        {resultados.map((p) => {
                          const parentesco = p.vinculo === 'beneficiario'
                            ? [p.parentesco?.toLowerCase(), p.empleado_nombre ? `de ${p.empleado_nombre}` : '']
                              .filter(Boolean).join(' ')
                            : '';
                          return (
                            <li key={p.id || `${p.vinculo}-${p.cedula}`}>
                              <button
                                type="button"
                                onClick={() => seleccionarPaciente(p)}
                                className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left hover:bg-slate-50"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5">
                                    <span className="truncate text-sm font-semibold text-slate-800">{p.nombre_completo}</span>
                                    {p.vinculo && (
                                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                        p.vinculo === 'trabajador'
                                          ? 'bg-brand-deep/10 text-brand-deep'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {p.vinculo === 'trabajador' ? 'Trabajador' : 'Beneficiario'}
                                      </span>
                                    )}
                                  </span>
                                  <span className="block truncate text-[11px] text-slate-500">
                                    <span className="font-mono">V-{p.cedula || '—'}</span>
                                    {parentesco && <span> · {parentesco}</span>}
                                  </span>
                                </span>
                                {p.telefono && (
                                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                                    <Phone className="h-3 w-3" /> {p.telefono}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {q.trim().length >= 2 && !buscando && resultados.length === 0 && (
                      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <UserRound className="h-3.5 w-3.5" />
                        Sin coincidencias. Use «Paciente nuevo» para registrarlo.
                      </p>
                    )}
                  </>
                )}
              </section>

              {/* 2. Especialidad y médico */}
              <section className="space-y-2 py-3">
                <h4 className="text-xs font-bold text-slate-700">Especialidad y médico</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={especialidad}
                    onChange={(e) => {
                      setEspecialidad(e.target.value);
                      setMedicoId(null);
                    }}
                    className={CAMPO}
                    aria-label="Especialidad"
                  >
                    <option value="">Todas las especialidades</option>
                    {especialidades.map((esp) => (
                      <option key={esp} value={esp}>{esp}</option>
                    ))}
                  </select>
                  <select
                    value={medicoId || ''}
                    onChange={(e) => setMedicoId(Number(e.target.value) || null)}
                    className={CAMPO}
                    aria-label="Médico"
                  >
                    <option value="">— Elija médico —</option>
                    {medicosFiltrados.map((m) => (
                      <option key={m.id} value={m.id}>
                        Dr(a). {m.nombre} — {m.especialidad || 'General'}
                      </option>
                    ))}
                  </select>
                </div>
                {especialidades.length === 0 && (
                  <p className="text-[11px] text-amber-700">No hay especialistas registrados.</p>
                )}
              </section>

              {/* 3. Fecha y cupos */}
              <section className="space-y-2.5 py-3">
                <h4 className="text-xs font-bold text-slate-700">Fecha y disponibilidad</h4>

                <div className="grid grid-cols-2 items-center gap-3">
                  <input
                    type="date"
                    value={fecha}
                    min={hoyISO()}
                    onChange={(e) => setFecha(e.target.value)}
                    className={CAMPO}
                    aria-label="Fecha de la cita"
                  />
                  <div className="text-right text-xs text-slate-600">
                    {!medicoId ? (
                      <span className="text-slate-400">Elija un médico</span>
                    ) : cargandoDisp ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando…
                      </span>
                    ) : !disponibilidad ? (
                      <span className="font-semibold text-rose-700">Sin datos</span>
                    ) : !disponibilidad.trabaja ? (
                      <span className="font-semibold text-amber-700">{disponibilidad.motivo || 'No labora ese día'}</span>
                    ) : (
                      <span className="tabular-nums">
                        <span className="font-bold text-slate-900">{disponibilidad.ocupadas_total}</span>
                        <span className="text-slate-400"> / {disponibilidad.capacidad_total} ocupados · </span>
                        <span className={`font-bold ${disponibilidad.libres_total > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {disponibilidad.libres_total} libres
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {medicoId && !cargandoDisp && disponibilidad?.trabaja && (
                  <>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {disponibilidad.turnos.map((t) => {
                        const esManana = parseInt(t.hora_inicio, 10) < 13;
                        const agotado = t.libres <= 0;
                        const seleccionado = turnoSel?.turno_id === t.turno_id;
                        return (
                          <button
                            key={t.turno_id}
                            type="button"
                            disabled={agotado}
                            onClick={() => {
                              setTurnoSel(t);
                              setHoraSel(t.hora_asignada || '');
                            }}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                              seleccionado
                                ? 'border-brand-deep bg-brand-deep/[0.05]'
                                : agotado
                                ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                                : 'border-slate-200 hover:border-brand-deep hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-800">
                              <span className={`rounded p-0.5 ${seleccionado ? 'bg-brand-deep text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {esManana ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                              </span>
                              <span className="truncate">
                                {t.nombre}
                                <span className="ml-1 font-normal text-slate-500">{rangoTurno(t.hora_inicio, t.hora_fin)}</span>
                              </span>
                            </span>
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                              agotado ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {agotado ? 'Agotado' : `${t.libres} libres`}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {disponibilidad.libres_total <= 0 && (
                      <p className="text-[11px] font-semibold text-rose-700">
                        El médico alcanzó su límite diario. Elija otra fecha.
                      </p>
                    )}

                    {turnoSel && turnoSel.horas_libres?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <select
                          value={horaSel || turnoSel.hora_asignada || ''}
                          onChange={(e) => setHoraSel(e.target.value)}
                          className="cp-input !py-1.5 text-xs"
                          aria-label="Hora de la cita"
                        >
                          {turnoSel.horas_libres.map((h) => (
                            <option key={h} value={h}>{horaHumana(h)}</option>
                          ))}
                        </select>
                        <span className="text-[11px] text-slate-500">Hora asignada</span>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* 4. Motivo */}
              <section className="space-y-2 py-3">
                <label htmlFor="motivo-cita" className="block text-xs font-bold text-slate-700">
                  Motivo de la consulta <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  id="motivo-cita"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej.: control de tensión arterial, dolor lumbar…"
                  className={CAMPO}
                />
              </section>
            </>
          )}
        </div>

        {!resultado && (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="min-w-0 truncate text-xs text-slate-500">
              {turnoSel && medicoSel ? (
                <>
                  <span className="font-semibold text-slate-700">Dr(a). {medicoSel.nombre}</span>
                  <span className="mx-1 text-slate-300">·</span>
                  <span className="capitalize">{fechaLarga(fecha)}</span>
                  <span className="mx-1 text-slate-300">·</span>
                  <span className="font-semibold text-emerald-700">
                    {horaHumana(horaSel || turnoSel.hora_asignada)}
                  </span>
                </>
              ) : (
                'Faltan datos por elegir'
              )}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={enviando || !puedeGuardar}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-deep px-3.5 py-1.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-primary active:scale-[0.98] disabled:opacity-50"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Registrar y confirmar cita
              </button>
            </div>
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}

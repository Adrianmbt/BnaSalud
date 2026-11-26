import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Phone,
  RotateCcw,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import {
  moverJornada,
  obtenerPreviaJornada,
  obtenerTurnosJornada,
} from '../../api/reprogramaciones';

function isoDe(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function hoyIso() {
  return isoDe(new Date());
}

function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  fecha.setDate(fecha.getDate() + dias);
  return isoDe(fecha);
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

export default function ReprogramacionCitas({ clinicaId = null }) {
  const [medicos, setMedicos] = useState([]);
  const [cargandoMedicos, setCargandoMedicos] = useState(true);
  const [medicoId, setMedicoId] = useState('');

  const [turnos, setTurnos] = useState([]);
  const [turnoId, setTurnoId] = useState(null);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);

  const [citas, setCitas] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [cargandoCitas, setCargandoCitas] = useState(false);

  const [fechaDestino, setFechaDestino] = useState(sumarDias(hoyIso(), 1));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);
  const [copiado, setCopiado] = useState('');

  const medico = useMemo(
    () => medicos.find((m) => String(m.id) === String(medicoId)) || null,
    [medicos, medicoId],
  );

  const turno = useMemo(
    () => turnos.find((t) => String(t.turno_id) === String(turnoId)) || null,
    [turnos, turnoId],
  );

  // Cartera del centro: solo los médicos que pertenecen a esta clínica.
  useEffect(() => {
    let activo = true;
    axiosClient
      .get('/agenda/especialistas', { params: clinicaId ? { centro_id: clinicaId } : {} })
      .then(({ data }) => {
        if (activo) setMedicos(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar la lista de médicos.');
      })
      .finally(() => {
        if (activo) setCargandoMedicos(false);
      });
    return () => {
      activo = false;
    };
  }, [clinicaId]);

  // Turnos de hoy del médico seleccionado.
  useEffect(() => {
    if (!medicoId) {
      setTurnos([]);
      setTurnoId(null);
      return undefined;
    }
    let activo = true;
    setCargandoTurnos(true);
    setTurnos([]);
    setTurnoId(null);
    setCitas([]);
    setSeleccionadas(new Set());
    setError('');
    obtenerTurnosJornada({ medico_id: Number(medicoId), fecha: hoyIso() })
      .then((data) => {
        if (!activo) return;
        const lista = data.items || [];
        setTurnos(lista);
        const conCitas = lista.find((t) => t.citas > 0);
        setTurnoId(conCitas ? String(conCitas.turno_id) : '');
      })
      .catch((err) => {
        if (!activo) return;
        setError(
          err?.response?.data?.detail ||
            'No se pudieron consultar los turnos del médico.',
        );
        setTurnoId('');
      })
      .finally(() => {
        if (activo) setCargandoTurnos(false);
      });
    return () => {
      activo = false;
    };
  }, [medicoId]);

  // Cola de citas de hoy según el turno elegido.
  useEffect(() => {
    if (!medicoId || turnoId === null) {
      setCitas([]);
      setSeleccionadas(new Set());
      return undefined;
    }
    let activo = true;
    setCargandoCitas(true);
    setError('');
    obtenerPreviaJornada({
      medico_id: Number(medicoId),
      fecha: hoyIso(),
      turno_id: turnoId ? Number(turnoId) : null,
    })
      .then((data) => {
        if (!activo) return;
        const items = data.items || [];
        setCitas(items);
        setSeleccionadas(new Set(items.map((c) => c.id)));
      })
      .catch((err) => {
        if (!activo) return;
        setCitas([]);
        setSeleccionadas(new Set());
        setError(
          err?.response?.data?.detail || 'No se pudieron consultar las citas de hoy.',
        );
      })
      .finally(() => {
        if (activo) setCargandoCitas(false);
      });
    return () => {
      activo = false;
    };
  }, [medicoId, turnoId]);

  const toggleCita = (id) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodas = () => {
    setSeleccionadas((prev) =>
      prev.size === citas.length ? new Set() : new Set(citas.map((c) => c.id)),
    );
  };

  const copiar = async (texto, clave) => {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(''), 2500);
    } catch {
      setError('El navegador no permitió copiar al portapapeles.');
    }
  };

  const postponer = async (e) => {
    e.preventDefault();
    if (!medicoId) {
      setError('Selecciona el médico al que vas a postponerle las citas.');
      return;
    }
    if (seleccionadas.size === 0) {
      setError('Selecciona al menos una cita de hoy.');
      return;
    }
    if (!fechaDestino || fechaDestino <= hoyIso()) {
      setError('La nueva fecha debe ser posterior a hoy.');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const res = await moverJornada({
        medico_id: Number(medicoId),
        fecha_origen: hoyIso(),
        fecha_destino: fechaDestino,
        ajustar_horas: false,
        intervalo_minutos: 30,
        citas_ids: Array.from(seleccionadas),
      });
      setResultado(res);
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudieron postponer las citas.');
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    setResultado(null);
    setError('');
    setMedicoId('');
    setTurnos([]);
    setTurnoId(null);
    setCitas([]);
    setSeleccionadas(new Set());
    setFechaDestino(sumarDias(hoyIso(), 1));
  };

  if (resultado) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-up">
        <section className="rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 to-teal-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                  Citas postponidas
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300">
                    {resultado.total_movidas}
                  </span>
                </h3>
                <p className="text-xs text-slate-600 capitalize">
                  {resultado.medico_nombre} · {fechaLarga(resultado.fecha_origen)} →{' '}
                  <span className="font-bold text-emerald-700">
                    {fechaLarga(resultado.fecha_destino)}
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={reiniciar}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 ring-1 ring-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Postponer otras citas
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="rounded-xl bg-emerald-50/70 ring-1 ring-emerald-200 px-3.5 py-3 flex items-start gap-2.5">
              <MessageCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-900 leading-relaxed">
                Cada enlace abre tu <span className="font-bold">WhatsApp Web vinculado</span>{' '}
                con el mensaje ya redactado para ese paciente. Solo pulsa{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-white font-mono text-[11px] ring-1 ring-emerald-300">
                  Enviar
                </kbd>
                . También puedes copiar el enlace para enviarlo por otro medio.
              </p>
            </div>

            {resultado.citas.length === 0 ? (
              <p className="text-sm text-slate-500">No se trasladó ninguna cita.</p>
            ) : (
              <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {resultado.citas.map((cita) => (
                  <li
                    key={cita.cita_id}
                    className="p-3.5 sm:p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-brand-deep inline-flex items-center gap-1.5">
                          <UserRound className="w-3.5 h-3.5 text-slate-400" />
                          {cita.paciente_nombre}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          V-{cita.paciente_cedula || '—'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {cita.hora_anterior} →{' '}
                          <span className="font-bold text-emerald-700">
                            {cita.hora_nueva}
                          </span>{' '}
                          · {fechaLarga(cita.fecha_nueva)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {cita.paciente_telefono || (
                            <span className="text-rose-500 italic">Sin teléfono</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {cita.link_whatsapp ? (
                        <a
                          href={cita.link_whatsapp}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic px-2">
                          Sin WhatsApp
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => copiar(cita.link_whatsapp, `link-${cita.cita_id}`)}
                        disabled={!cita.link_whatsapp}
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 disabled:opacity-40"
                      >
                        {copiado === `link-${cita.cita_id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        {copiado === `link-${cita.cita_id}` ? 'Copiado' : 'Copiar enlace'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          copiar(cita.mensaje_whatsapp, `msg-${cita.cita_id}`)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200"
                      >
                        {copiado === `msg-${cita.cita_id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        {copiado === `msg-${cita.cita_id}` ? 'Copiado' : 'Copiar mensaje'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      <section className="rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-brand-deep">
              Postponer citas de hoy
            </h3>
            <p className="text-[11px] text-slate-500">
              Elige el médico y su turno, marca las citas y define la nueva fecha.
            </p>
          </div>
        </div>

        <form onSubmit={postponer} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3.5 py-2.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError('')} aria-label="Cerrar aviso">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="postponer-medico"
                className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1"
              >
                Médico
              </label>
              <select
                id="postponer-medico"
                value={medicoId}
                onChange={(e) => setMedicoId(e.target.value)}
                className="cp-input !py-2 text-sm"
                disabled={cargandoMedicos}
                required
              >
                <option value="">
                  {cargandoMedicos ? 'Cargando médicos…' : 'Selecciona un médico'}
                </option>
                {!cargandoMedicos && medicos.length === 0 && (
                  <option value="" disabled>
                    Sin médicos registrados en este centro
                  </option>
                )}
                {medicos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} — {m.especialidad || 'Sin especialidad'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="postponer-turno"
                className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1"
              >
                Turno de hoy
              </label>
              <select
                id="postponer-turno"
                value={turnoId ?? ''}
                onChange={(e) => setTurnoId(e.target.value)}
                className="cp-input !py-2 text-sm"
                disabled={!medicoId || cargandoTurnos || turnos.length === 0}
              >
                {cargandoTurnos ? (
                  <option value="">Cargando turnos…</option>
                ) : (
                  <>
                    <option value="">Todos los turnos</option>
                    {turnos.map((t) => (
                      <option key={t.turno_id} value={t.turno_id}>
                        {t.nombre} ({t.hora_inicio}–{t.hora_fin}) · {t.citas} cita(s)
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="postponer-fecha"
                className="block text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1"
              >
                Nueva fecha
              </label>
              <input
                id="postponer-fecha"
                type="date"
                min={sumarDias(hoyIso(), 1)}
                value={fechaDestino}
                onChange={(e) => setFechaDestino(e.target.value)}
                className="cp-input !py-2 text-sm ring-1 ring-emerald-300 focus:ring-emerald-500"
                required
              />
              <p className="text-[10px] text-emerald-700 font-semibold mt-0.5 capitalize">
                {fechaLarga(fechaDestino)}
              </p>
            </div>
            <div className="sm:col-span-2 flex items-end">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Se moverán <span className="font-bold text-slate-700">{seleccionadas.size}</span>{' '}
                de {citas.length} cita(s) de hoy del turno{' '}
                <span className="font-semibold">
                  {turnoId ? turno?.nombre || 'seleccionado' : 'completo'}
                </span>
                . Los horarios se conservan y cada cita deja su registro de reprogramación.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-brand-primary" />
                <p className="text-xs font-bold text-brand-deep">
                  Cola de citas de hoy
                  {citas.length > 0 && (
                    <span className="ml-2 text-[10px] font-bold text-slate-500">
                      {seleccionadas.size} de {citas.length} seleccionadas
                    </span>
                  )}
                </p>
              </div>
              {citas.length > 0 && (
                <button
                  type="button"
                  onClick={toggleTodas}
                  className="text-[11px] font-bold text-brand-primary hover:text-brand-deep px-2 py-1 rounded"
                >
                  {seleccionadas.size === citas.length
                    ? 'Deseleccionar todas'
                    : 'Seleccionar todas'}
                </button>
              )}
            </div>

            <div className="p-3">
              {!medicoId ? (
                <div className="py-8 text-center text-slate-400">
                  <Stethoscope className="w-6 h-6 mx-auto mb-2 opacity-60" />
                  <p className="text-xs">Selecciona un médico para ver su cola de hoy.</p>
                </div>
              ) : cargandoTurnos || cargandoCitas ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 text-brand-primary animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">Buscando citas de hoy…</p>
                </div>
              ) : citas.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <CalendarCheck className="w-6 h-6 mx-auto mb-2 opacity-60" />
                  <p className="text-xs">
                    No hay citas pendientes o confirmadas en este turno hoy.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {citas.map((cita) => {
                    const activa = seleccionadas.has(cita.id);
                    return (
                      <li key={cita.id}>
                        <label
                          className={`flex items-center gap-3 px-1.5 py-2.5 rounded-lg cursor-pointer transition-colors ${
                            activa ? 'bg-brand-primary/[0.04]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={activa}
                            onChange={() => toggleCita(cita.id)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary shrink-0"
                          />
                          <span className="font-mono text-xs font-bold text-slate-700 w-12 shrink-0">
                            {cita.hora_inicio}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-800 truncate">
                              {cita.paciente_nombre}
                            </span>
                            <span className="block text-[11px] text-slate-500 truncate">
                              V-{cita.paciente_cedula || '—'} ·{' '}
                              {cita.paciente_telefono || 'Sin teléfono'}
                            </span>
                          </span>
                          {!cita.paciente_telefono && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold uppercase ring-1 ring-amber-200 shrink-0">
                              Sin WhatsApp
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
            <p className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              Al postponer se generan los enlaces de WhatsApp Web para avisar a cada paciente.
            </p>
            <button
              type="submit"
              disabled={enviando || !medicoId || seleccionadas.size === 0}
              className="w-full sm:w-auto min-h-11 inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-brand-primary hover:bg-brand-deep text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Postponiendo…
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Postponer {seleccionadas.size} cita(s) al {fechaLarga(fechaDestino)}
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, AlertCircle, CheckCircle2, X, Users, Clock, ArrowRight, CalendarDays } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useModalFocus } from './specialistMeta';

function isoDe(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function PostponeModal({
  abierto,
  onClose,
  medicoId,
  enEspera = 0,
  enConsulta = 0,
  onPostpuesto,
}) {
  const [fecha, setFecha] = useState(isoDe(new Date()));
  const [turnos, setTurnos] = useState([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);
  const [hora, setHora] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  useModalFocus(abierto, onClose, 'postponer-fecha');

  const hoyIso = useMemo(() => isoDe(new Date()), []);
  const total = enEspera + enConsulta;

  useEffect(() => {
    if (!abierto) return;
    setHora('');
    setError('');
    setAviso('');
  }, [abierto]);

  useEffect(() => {
    if (!abierto || !fecha || !medicoId) return;
    let activo = true;
    setCargandoTurnos(true);
    setHora('');
    setError('');
    (async () => {
      try {
        const { data } = await axiosClient.get('/agenda/turnos', {
          params: { medico_id: medicoId, fecha },
        });
        if (activo) setTurnos(Array.isArray(data) ? data : []);
      } catch (e) {
        if (activo) {
          setError(e?.response?.data?.detail || 'No se pudo consultar la disponibilidad.');
          setTurnos([]);
        }
      } finally {
        if (activo) setCargandoTurnos(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [abierto, fecha, medicoId]);

  const horasLibres = useMemo(() => {
    if (!turnos.length) return [];
    const mapa = new Map();
    turnos[0].turnos_libres?.forEach?.((t) => {
      if (t.hora_inicio) mapa.set(t.hora_inicio.slice(0, 5), t);
    });
    return [...mapa.values()];
  }, [turnos]);

  const confirmar = async () => {
    if (!hora) return;
    setBusy(true);
    setError('');
    setAviso('');
    try {
      const { data } = await axiosClient.post('/agenda/reprogramar-todas', {
        medico_id: medicoId,
        fecha,
        hora_inicio: hora,
      });
      setAviso(`Se reprogramaron ${data.movidas} cita(s) para el ${fecha} a las ${hora}:00.`);
      onPostpuesto && onPostpuesto(data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudieron reprogramar las citas.');
    } finally {
      setBusy(false);
    }
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="postponer-title">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="brand-orbit text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-sky-200" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="postponer-title" className="font-display font-bold text-lg leading-tight truncate">Postponer citas restantes</h3>
            <p className="text-[11px] text-white/70">Reprograma toda la cola pendiente de hoy a tu disponibilidad</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg text-white/80 hover:bg-white/15 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-sky-50 ring-1 ring-sky-200 px-3.5 py-3">
              <p className="text-2xl font-extrabold text-sky-700 font-mono">{enEspera}</p>
              <p className="text-[11px] font-bold text-sky-700/80 uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" /> En espera
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-3.5 py-3">
              <p className="text-2xl font-extrabold text-emerald-700 font-mono">{enConsulta}</p>
              <p className="text-[11px] font-bold text-emerald-700/80 uppercase tracking-wide flex items-center gap-1">
                <Users className="w-3 h-3" /> En consulta
              </p>
            </div>
          </div>

          {total === 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl px-3.5 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> No hay pacientes en la cola; no hay citas que postponer.
            </div>
          )}

          <div>
            <label htmlFor="postponer-fecha" className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Nueva fecha de las citas restantes
            </label>
            <input
              id="postponer-fecha"
              type="date"
              min={hoyIso}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="cp-input"
            />
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-brand-primary" /> Hora disponible
              {cargandoTurnos && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </div>
            {cargandoTurnos ? (
              <p className="text-xs text-slate-400 flex items-center gap-2 px-2 py-2">Consultando agenda…</p>
            ) : horasLibres.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3.5 py-3">No hay turnos libres para esa fecha.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-0.5">
                {horasLibres.map((t) => {
                  const hhmm = t.hora_inicio.slice(0, 5);
                  const activa = hora === hhmm;
                  return (
                    <button
                      key={t.turno_id + hhmm}
                      type="button"
                      onClick={() => setHora(hhmm)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                        activa
                          ? 'bg-brand-primary text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-brand-primary/10'
                      }`}
                    >
                      {hhmm}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {aviso && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 text-emerald-800 px-3.5 py-2.5 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {aviso}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-1 flex gap-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!hora || total === 0 || busy}
            className="flex-[1.6] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-deep text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Reprogramar ({total})
          </button>
        </div>
      </div>
    </div>
  );
}
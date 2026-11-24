import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarDays, FileText, Loader2, Users } from 'lucide-react';
import { metricasReposos, resumenHistorias } from '../../api/historiasMedicas';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function Tarjeta({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colores = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl ring-1 flex items-center justify-center shrink-0 ${colores[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="font-display font-bold text-xl text-slate-800 leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

export default function MetricasPanel() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [mes, setMes] = useState('');
  const [resumen, setResumen] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [r, m] = await Promise.all([
        resumenHistorias(),
        metricasReposos({ anio, mes: mes ? Number(mes) : undefined }),
      ]);
      setResumen(r);
      setMetricas(m);
    } catch {
      setError('No se pudieron cargar las métricas.');
    } finally {
      setCargando(false);
    }
  }, [anio, mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const maxMes = Math.max(1, ...(metricas?.por_mes || []).map((m) => m.total));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        >
          {[anioActual, anioActual - 1, anioActual - 2].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        >
          <option value="">Todo el año</option>
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <span className="text-[11px] text-slate-400 ml-auto">
          {cargando ? 'Actualizando…' : 'Datos del sistema interno'}
        </span>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-xs font-semibold bg-rose-50 text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      )}

      {cargando && !metricas ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando métricas…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tarjeta
              icon={Users}
              label="Pacientes"
              value={resumen?.pacientes ?? 0}
              sub={`${resumen?.fichas ?? 0} fichas integrales`}
            />
            <Tarjeta
              icon={Activity}
              label="Atenciones del mes"
              value={resumen?.atenciones_mes ?? 0}
              sub="Origen historia integral"
              color="violet"
            />
            <Tarjeta
              icon={FileText}
              label="Reposos vigentes"
              value={resumen?.reposos_vigentes ?? 0}
              sub={`${resumen?.reposos_mes ?? 0} emitidos este mes`}
              color="emerald"
            />
            <Tarjeta
              icon={CalendarDays}
              label="Trabajadores con reposo"
              value={resumen?.trabajadores_con_reposo ?? 0}
              sub="Vinculados a nómina"
              color="amber"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-sm text-slate-800">Reposos por mes</h3>
                <span className="text-[11px] text-slate-400">{anio}</span>
              </div>
              <div className="flex items-end gap-1.5 h-40">
                {(metricas?.por_mes || []).map((m) => (
                  <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-500">{m.total || ''}</span>
                    <div
                      className="w-full rounded-t bg-brand-primary/70 min-h-[2px] transition-all"
                      style={{ height: `${Math.max(2, (m.total / maxMes) * 120)}px` }}
                      title={`${MESES[m.mes - 1]}: ${m.total}`}
                    />
                    <span className="text-[8px] text-slate-400">{MESES[m.mes - 1].slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-display font-bold text-sm text-slate-800 mb-3">Resumen del período</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Total emitidos', metricas?.total ?? 0],
                  ['Vigentes', metricas?.vigentes ?? 0],
                  ['Anulados', metricas?.anulados ?? 0],
                  ['Días de reposo vigentes', metricas?.dias_vigentes ?? 0],
                  ['Vinculados a nómina', metricas?.trabajadores ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="font-display font-bold text-lg text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                  Distribución por días
                </p>
                <div className="flex gap-2">
                  {[1, 3, 5, 7].map((d) => {
                    const totalDia = (metricas?.por_dia || []).find((x) => Number(x.dias) === d)?.total || 0;
                    return (
                      <div key={d} className="flex-1 rounded-lg bg-brand-primary/5 ring-1 ring-brand-primary/10 px-2 py-2 text-center">
                        <p className="font-display font-bold text-slate-800">{totalDia}</p>
                        <p className="text-[9px] text-slate-400">{d} día{d > 1 ? 's' : ''}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-display font-bold text-sm text-slate-800">Reposos por médico</h3>
            </div>
            {(metricas?.por_medico || []).length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Sin datos en el período.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(metricas?.por_medico || []).map((m) => (
                  <div key={m.medico} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-700 truncate">{m.medico}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {m.total} reposo(s) · {m.dias} día(s)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

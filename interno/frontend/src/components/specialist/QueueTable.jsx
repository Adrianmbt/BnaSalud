import React, { useMemo, useState } from 'react';
import { Clock, Loader2, Search, UserRound, ListChecks, ArrowRight, CheckCircle2, Stethoscope, Eye } from 'lucide-react';
import { ESTADO_LABEL, rutaMeta, horaCorta } from './specialistMeta';

// "Atendidos" y no "Atendidos hoy": la etiqueta tiene que caber en ~80px en el
// tab apilado de 360px. accent/dot no los lee nadie.
const TABS = [
  { id: 'espera', etiqueta: 'En espera', icono: Clock },
  { id: 'consulta', etiqueta: 'En consulta', icono: UserRound },
  { id: 'finalizado', etiqueta: 'Atendidos', icono: ListChecks },
];

function prioridadChip(p) {
  if (p?.categoria_prioridad === 'ROJO' || p?.prioridad === 1)
    return { cls: 'bg-red-100 text-red-700', t: `P${p.prioridad ?? 1} · Crítico` };
  if (p?.categoria_prioridad === 'VERDE' || p?.prioridad === 2)
    return { cls: 'bg-emerald-100 text-emerald-700', t: `P${p.prioridad ?? 2}` };
  if (p?.categoria_prioridad === 'AMARILLO' && p?.prioridad >= 3)
    return { cls: 'bg-amber-100 text-amber-700', t: `P${p.prioridad} · Normal` };
  return { cls: 'bg-slate-100 text-slate-600', t: `P${p?.prioridad ?? 3}` };
}

export default function QueueTable({
  grupos = { espera: [], consulta: [], finalizado: [] },
  cargando = false,
  onAtender,
  onFinalizar,
  onVerDetalle,
}) {
  const [tab, setTab] = useState('espera');
  const [q, setQ] = useState('');

  const filas = useMemo(() => {
    const base = tab === 'consulta' ? grupos.consulta : tab === 'finalizado' ? grupos.finalizado : grupos.espera;
    const texto = q.trim().toLowerCase();
    if (!texto) return base || [];
    return (base || []).filter((p) =>
      [p.paciente_nombre, p.paciente_cedula, p.motivo_consulta, p.token]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(texto)
    );
  }, [tab, q, grupos]);

  const totales = useMemo(
    () => ({
      espera: grupos.espera?.length || 0,
      consulta: grupos.consulta?.length || 0,
      finalizado: grupos.finalizado?.length || 0,
    }),
    [grupos]
  );

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm animate-fade-up">
      {/* Cabecera + tabs */}
      <div className="px-5 pt-4 pb-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 w-full sm:w-auto bg-slate-100 rounded-full p-1" role="tablist" aria-label="Grupos de la cola">
            {TABS.map((t) => {
              const I = t.icono;
              const activa = tab === t.id;
              const n = totales[t.id];
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setTab(t.id)}
                  /* Movil: 3 tabs con icono+texto+contador en linea median 442px y el
                     padre da 286px -> el strip se salia de la tarjeta. Apilados
                     (icono+contador arriba, etiqueta abajo) caben los 3.
                     Desde sm vuelve a la fila horizontal de antes. */
                  className="flex flex-1 sm:flex-none flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1.5 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all min-w-0"
                  style={
                    activa
                      ? { background: t.id === 'finalizado' ? '#38B000' : '#1A4B7C', color: '#fff' }
                      : { color: '#64748b' }
                  }
                >
                  <span className="flex items-center gap-1 shrink-0">
                    <I className="w-3 h-3" />
                    <span className={`font-mono text-[10px] font-bold leading-none px-1 py-0.5 rounded ${activa ? 'bg-white/20' : 'bg-slate-200/70'}`}>
                      {n}
                    </span>
                  </span>
                  <span className="text-[8px] sm:text-xs uppercase sm:normal-case leading-tight truncate w-full">
                    {t.etiqueta}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar paciente, C.I. o motivo…"
              className="cp-input !py-2 !pl-9 text-[13px]"
              aria-label="Buscar en la cola"
            />
          </div>
        </div>

        {/* Leyenda de rutas */}
        <div className="flex items-center gap-4 mt-3 text-[10px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Emergencia
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500" /> Especialista / Cita
          </span>
        </div>
      </div>

      {/* Tabla. En móvil Ruta/Prioridad/Estado/Hora se ocultan y su información
          baja a una línea meta bajo el nombre: 7 columnas no caben en 360dp y
          obligaban a scrollear en horizontal para leer un paciente.
          table-fixed en móvil + anchos por columna: con table-auto el nombre
          largo (truncate = nowrap) fija el min-content y la tabla se desborda. */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed md:table-auto md:min-w-[760px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-y border-slate-100">
              <th className="w-[46%] px-4 sm:px-5 py-3">Paciente</th>
              <th className="w-[34%] px-3 sm:px-4 py-3">Motivo</th>
              <th className="hidden md:table-cell px-4 py-3">Ruta</th>
              <th className="hidden md:table-cell px-4 py-3">Prioridad</th>
              <th className="hidden md:table-cell px-4 py-3">Estado</th>
              <th className="hidden md:table-cell px-4 py-3">Hora</th>
              <th className="w-[20%] px-3 sm:px-5 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[13px]">
            {cargando && filas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-primary" />
                  <p className="mt-2 text-sm">Cargando cola…</p>
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                  No hay pacientes en este grupo.
                </td>
              </tr>
            ) : (
              filas.map((p) => {
                const ruta = rutaMeta(p.ruta_atencion);
                const RIcon = ruta.Icono;
                const est = ESTADO_LABEL[p.atencion_estado] || ESTADO_LABEL.RECEPCION;
                const prio = prioridadChip(p);
                return (
                  <tr key={p.id} className="hover:bg-brand-surface/60 transition-colors group">
                    <td className="px-4 sm:px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-brand-deep text-white flex items-center justify-center font-display font-bold text-sm shrink-0 shadow-sm">
                          {(p.paciente_nombre || 'P').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate leading-tight">{p.paciente_nombre}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {p.paciente_cedula} · {p.token}
                          </p>
                          {/* Meta solo en móvil: sustituye a las columnas ocultas */}
                          <p className="md:hidden text-[10px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={`inline-flex items-center gap-1 font-bold ${ruta.cls.split(' ').find((c) => c.startsWith('text-')) || 'text-slate-500'}`}>
                              <RIcon className="w-3 h-3" /> {ruta.t}
                            </span>
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full font-bold ${prio.cls}`}>{prio.t}</span>
                            <span className="font-mono">{horaCorta(p.creado_en)}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-3.5">
                      <p className="text-slate-600 leading-snug line-clamp-2 break-words">{p.motivo_consulta || '—'}</p>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-bold ${ruta.cls}`}>
                        <RIcon className="w-3 h-3" />
                        {ruta.t}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3.5">
                      <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold ${prio.cls}`}>{prio.t}</span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${est.cls}`}>{est.t}</span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3.5 text-slate-500 font-mono text-xs">{horaCorta(p.creado_en)}</td>
                    <td className="px-3 sm:px-5 py-3.5 text-right">
                      {tab === 'espera' && (
                        <button
                          type="button"
                          onClick={() => onAtender && onAtender(p)}
                          aria-label={`Atender a ${p.paciente_nombre}`}
                          title={`Atender a ${p.paciente_nombre}`}
                          className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg bg-brand-primary hover:bg-brand-deep text-white text-xs font-bold transition-all hover:-translate-y-0.5 shadow-sm"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Atender</span>
                        </button>
                      )}
                      {tab === 'consulta' && (
                        <div className="inline-flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onFinalizar && onFinalizar(p)}
                            className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg bg-brand-success hover:opacity-90 text-white text-xs font-bold transition-all shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Finalizar
                          </button>
                          <button
                            type="button"
                            onClick={() => onAtender && onAtender(p)}
                            className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg bg-brand-primary hover:bg-brand-deep text-white text-xs font-bold transition-all hover:-translate-y-0.5 shadow-sm"
                          >
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span className="sm:hidden">Seguir</span>
                            <span className="hidden sm:inline">Seguir atención</span>
                          </button>
                        </div>
                      )}
                      {tab === 'finalizado' && (
                        <button
                          type="button"
                          onClick={() => onVerDetalle && onVerDetalle(p)}
                          aria-label={`Ver detalle de ${p.paciente_nombre}`}
                          title={`Ver detalle de ${p.paciente_nombre}`}
                          className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg bg-brand-deep/5 ring-1 ring-brand-deep/20 text-brand-deep hover:bg-brand-deep/10 text-xs font-bold transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Ver detalle</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
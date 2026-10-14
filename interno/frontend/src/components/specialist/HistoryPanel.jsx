import React from 'react';
import {
  Stethoscope, Siren, Loader2, Pill,
  FlaskConical, ScanLine, Activity, ClipboardList, History, RefreshCw,
} from 'lucide-react';
import { esRegistroEmergencia, formatearFecha } from './specialistMeta';

const CATEGORIA_CATALOGO = {
  LABORATORIO: { etiqueta: 'Laboratorio', Icono: FlaskConical, cls: 'bg-emerald-50 text-emerald-700' },
  IMAGEN: { etiqueta: 'Imagen', Icono: ScanLine, cls: 'bg-cyan-50 text-cyan-700' },
  FUNCIONAL: { etiqueta: 'Funcional', Icono: Activity, cls: 'bg-amber-50 text-amber-700' },
};

export function badgeOrigen(especialidad) {
  const esEmerg = esRegistroEmergencia(especialidad);
  return esEmerg
    ? { t: 'Emergencia', Icono: Siren, cls: 'bg-red-100 text-red-700 ring-red-200' }
    : { t: 'Especialista', Icono: Stethoscope, cls: 'bg-sky-100 text-sky-700 ring-sky-200' };
}

export function emergenciaConTratamiento(consultasPrevias = []) {
  return (Array.isArray(consultasPrevias) ? consultasPrevias : [])
    .filter((c) => {
      if (!esRegistroEmergencia(c.especialidad)) return false;
      if ((c.tratamiento || '').trim()) return true;
      const recetas = Array.isArray(c.recetas) ? c.recetas : [];
      return recetas.some((r) => r?.nombre);
    })
    .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0))
    .pop();
}

function OrdenLinea({ item, categoria }) {
  const meta = CATEGORIA_CATALOGO[categoria] || CATEGORIA_CATALOGO.LABORATORIO;
  const Icono = meta.Icono;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${meta.cls}`}>
      <Icono className="w-3 h-3" />
      {item.estudio || item.examen || item.nombre || '—'}
      {item.indicacion ? ` · ${item.indicacion}` : ''}
    </span>
  );
}

function ConsultaPrevia({ consulta, onReSolicitar }) {
  const origen = badgeOrigen(consulta.especialidad);
  const esEmerg = esRegistroEmergencia(consulta.especialidad);
  const Icono = origen.Icono;
  const labs = Array.isArray(consulta.laboratorios) ? consulta.laboratorios : [];
  const estud = Array.isArray(consulta.estudios) ? consulta.estudios : [];
  const recetas = Array.isArray(consulta.recetas) ? consulta.recetas.filter((r) => r.nombre) : [];
  const ordenes = [
    ...labs.map((l) => ({ item: l, cat: 'LABORATORIO' })),
    ...estud.filter((e) => e.tipo === 'IMAGEN').map((e) => ({ item: e, cat: 'IMAGEN' })),
    ...estud.filter((e) => e.tipo === 'FUNCIONAL').map((e) => ({ item: e, cat: 'FUNCIONAL' })),
  ];
  const resolicitable = ordenes.length > 0;

  return (
    <div className={`rounded-xl border border-slate-200 overflow-hidden bg-white ${esEmerg ? 'border-l-red-400' : 'border-l-sky-400'} border-l-4`}>
      <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ring-1 text-[10px] font-bold ${origen.cls}`}>
          <Icono className="w-3 h-3" />
          {origen.t}
        </span>
        <span className="text-xs font-bold text-slate-700">{consulta.especialidad || 'Consulta'}</span>
        <span className="ml-auto text-[11px] text-slate-500 font-mono">{formatearFecha(consulta.fecha)}</span>
      </div>
      <div className="px-4 py-3 space-y-2 text-xs">
        {consulta.motivo_consulta && (
          <p className="text-slate-600">
            <span className="font-bold text-slate-700">Motivo:</span> {consulta.motivo_consulta}
          </p>
        )}
        {consulta.cie10_descripcion && (
          <p className="text-slate-600">
            <span className="font-bold text-slate-700">Diagnóstico:</span> {consulta.cie10_descripcion}
          </p>
        )}
        {consulta.tratamiento && (
          <p className="text-slate-600 line-clamp-2">
            <span className="font-bold text-slate-700">Tratamiento:</span> {consulta.tratamiento}
          </p>
        )}
        {Array.isArray(consulta.insumos_aplicados) && consulta.insumos_aplicados.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {consulta.insumos_aplicados.map((ins, i) => (
              <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${ins.tipo === 'medicamento_externo' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'}`}>
                {ins.nombre || ins.insumo_nombre}
                {ins.dosis && ` ${ins.dosis}`}
                {ins.hora_aplicacion && ` • ${ins.hora_aplicacion}`}
                {ins.tipo === 'medicamento_externo' && ' (externo)'}
              </span>
            ))}
          </div>
        )}
        {consulta.medico_nombre && (
          <p className="text-[11px] text-slate-400">Atendió: {consulta.medico_nombre}</p>
        )}

        {ordenes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
              <ClipboardList className="w-3 h-3" /> Órdenes ({ordenes.length}):
            </span>
            {ordenes.map((o, i) => (
              <OrdenLinea key={`${o.cat}-${i}`} item={o.item} categoria={o.cat} />
            ))}
            {resolicitable && (
              <button
                type="button"
                onClick={() => onReSolicitar && onReSolicitar(consulta)}
                className="inline-flex items-center gap-1 ml-1 px-2.5 py-1 rounded-lg bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white font-bold text-[10px] transition-colors"
                title="Cargar los exámenes solicitados en esa consulta a la orden actual"
              >
                <RefreshCw className="w-3 h-3" /> Re-solicitar
              </button>
            )}
          </div>
        )}

        {recetas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
              <Pill className="w-3 h-3" /> Recetas ({recetas.length}):
            </span>
            {recetas.map((r, i) => (
              <span key={i} className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-semibold">
                {r.nombre}{r.posologia ? ` — ${r.posologia}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryPanel({ consultasPrevias = [], previasCargando = false, onReSolicitar }) {
  const lista = (Array.isArray(consultasPrevias) ? consultasPrevias : [])
    .slice()
    .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));

  const nEmerg = lista.filter((c) => esRegistroEmergencia(c.especialidad)).length;
  const nEspec = lista.length - nEmerg;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1 flex-wrap">
        <History className="w-4 h-4 text-brand-primary" />
        <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">Consultas previas</h3>
        <span className="ml-auto text-xs font-mono text-slate-400">{lista.length}</span>
      </div>

      <div className="flex flex-wrap gap-2 px-1">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 ring-1 ring-red-200 text-[10px] font-bold">
          <Siren className="w-3 h-3" /> Emergencia (remitente) · {nEmerg}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 ring-1 ring-sky-200 text-[10px] font-bold">
          <Stethoscope className="w-3 h-3" /> Especialista (nueva) · {nEspec}
        </span>
      </div>

      {previasCargando ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-primary" />
          <p className="mt-2 text-sm">Cargando historial…</p>
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400 text-sm">
          Este paciente no tiene consultas registradas previamente.
        </div>
      ) : (
        <ol className="relative border-s-2 border-slate-200 ms-3 space-y-5">
          {lista.map((c) => {
            const esEmerg = esRegistroEmergencia(c.especialidad);
            return (
              <li key={c.consulta_id} className="relative ps-6">
                <span
                  className={`absolute left-0 top-2 -translate-x-1/2 h-3.5 w-3.5 rounded-full ring-4 ${
                    esEmerg ? 'bg-red-500 ring-red-200' : 'bg-sky-500 ring-sky-200'
                  }`}
                />
                <ConsultaPrevia consulta={c} onReSolicitar={onReSolicitar} />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import {
  History, Building2, Loader2, Stethoscope, Siren,
  Pill, FlaskConical, ScanLine, Activity, ChevronDown, ChevronUp,
} from 'lucide-react';

const CENTRO_COLORES = {
  CITAB: 'bg-sky-100 text-sky-700 ring-sky-200',
  CMUJER: 'bg-pink-100 text-pink-700 ring-pink-200',
  CNINOS: 'bg-amber-100 text-amber-700 ring-amber-200',
  CAPJPF: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  CAMAYOR: 'bg-violet-100 text-violet-700 ring-violet-200',
  OMARUJA: 'bg-red-100 text-red-700 ring-red-200',
};

function centroBadge(codigo) {
  return CENTRO_COLORES[codigo] || 'bg-slate-100 text-slate-600 ring-slate-200';
}

function ConsultaCard({ consulta }) {
  const [expandido, setExpandido] = useState(false);
  const labs = Array.isArray(consulta.laboratorios) ? consulta.laboratorios : [];
  const estudios = Array.isArray(consulta.estudios) ? consulta.estudios : [];
  const recetas = Array.isArray(consulta.recetas) ? consulta.recetas.filter((r) => r?.nombre) : [];
  const insumos = Array.isArray(consulta.insumos_aplicados) ? consulta.insumos_aplicados : [];

  const esEmerg = (consulta.especialidad || '').toLowerCase().includes('emergencia');

  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden border-l-4 ${esEmerg ? 'border-l-red-400' : 'border-l-sky-400'}`}>
<button
        type="button"
        onClick={() => setExpandido(!expandido)}
        aria-expanded={expandido}
        className="w-full px-4 py-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-0">
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 text-[10px] font-bold ${esEmerg ? 'bg-red-100 text-red-700 ring-red-200' : 'bg-sky-100 text-sky-700 ring-sky-200'}`}>
            {esEmerg ? <Siren className="w-3 h-3" /> : <Stethoscope className="w-3 h-3" />}
            {esEmerg ? 'Emergencia' : 'Especialista'}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">
            {consulta.especialidad || 'Consulta'}
          </span>
          <span className="sm:ml-auto shrink-0 text-[11px] text-slate-400 font-mono">
            {consulta.fecha ? new Date(consulta.fecha).toLocaleDateString('es-VE') : '—'}
          </span>
          {expandido
            ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
            : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          }
        </div>
        <span className={`inline-flex items-center gap-1 self-start sm:self-auto min-w-0 max-w-full px-2 py-0.5 rounded-full ring-1 text-[10px] font-bold ${centroBadge(consulta.centro_codigo)}`}>
          <Building2 className="w-3 h-3 shrink-0" />
          <span className="truncate">{consulta.centro_nombre}</span>
        </span>
      </button>

      {expandido && (
        <div className="px-4 pb-4 space-y-2 text-xs border-t border-slate-100 pt-3">
          {consulta.motivo_consulta && (
            <p className="text-slate-600">
              <span className="font-bold text-slate-700">Motivo:</span> {consulta.motivo_consulta}
            </p>
          )}
          {consulta.cie10_descripcion && (
            <p className="text-slate-600">
              <span className="font-bold text-slate-700">Diagnóstico:</span>{' '}
              <span className="font-mono text-[10px] bg-slate-100 px-1 rounded">{consulta.cie10_codigo}</span>{' '}
              {consulta.cie10_descripcion}
            </p>
          )}
          {consulta.tratamiento && (
            <p className="text-slate-600 line-clamp-2">
              <span className="font-bold text-slate-700">Tratamiento:</span> {consulta.tratamiento}
            </p>
          )}
          {consulta.recomendaciones && (
            <p className="text-slate-600 line-clamp-2">
              <span className="font-bold text-slate-700">Recomendaciones:</span> {consulta.recomendaciones}
            </p>
          )}
          {insumos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {insumos.map((ins, i) => (
                <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${ins.tipo === 'medicamento_externo' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'}`}>
                  {ins.nombre || ins.insumo_nombre}
                  {ins.dosis && ` ${ins.dosis}`}
                </span>
              ))}
            </div>
          )}
          {recetas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recetas.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-semibold">
                  <Pill className="w-3 h-3" />{r.nombre}{r.posologia ? ` — ${r.posologia}` : ''}
                </span>
              ))}
            </div>
          )}
          {labs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {labs.map((l, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                  <FlaskConical className="w-3 h-3" />{l.estudio || l.examen || l.nombre || 'Laboratorio'}
                </span>
              ))}
            </div>
          )}
          {estudios.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {estudios.map((e, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[10px] font-semibold">
                  <ScanLine className="w-3 h-3" />{e.estudio || e.examen || e.nombre || 'Estudio'}
                </span>
              ))}
            </div>
          )}
          {consulta.medico_nombre && (
            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
              Atendió: {consulta.medico_nombre}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerHistorial({ pacienteId }) {
  const [consultas, setConsultas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pacienteId) return;
    setCargando(true);
    setError('');
    axiosClient.get(`/consultas/${pacienteId}`)
      .then((r) => setConsultas(r.data))
      .catch(() => setError('No se pudo cargar el historial.'))
      .finally(() => setCargando(false));
  }, [pacienteId]);

  if (!pacienteId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400 text-sm">
        <History className="w-6 h-6 mx-auto mb-2 text-slate-300" />
        Selecciona un paciente para ver su historial.
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-primary" />
        <p className="mt-2 text-sm">Cargando historial…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (consultas.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400 text-sm">
        <History className="w-6 h-6 mx-auto mb-2 text-slate-300" />
        Este paciente no tiene consultas registradas.
      </div>
    );
  }

  const centros = [...new Set(consultas.map((c) => c.centro_nombre))];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <History className="w-4 h-4 text-brand-primary" />
        <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
          Historial del paciente
        </h3>
        <span className="ml-auto text-xs font-mono text-slate-400">{consultas.length} consultas</span>
      </div>

      {centros.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {centros.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
              <Building2 className="w-3 h-3" />{c}
            </span>
          ))}
        </div>
      )}

      <ol className="relative border-s-2 border-slate-200 ms-3 space-y-4">
        {consultas.map((c) => {
          const esEmerg = (c.especialidad || '').toLowerCase().includes('emergencia');
          return (
            <li key={c.consulta_id} className="relative ps-6">
              <span
                className={`absolute left-0 top-2.5 -translate-x-1/2 h-3.5 w-3.5 rounded-full ring-4 ${
                  esEmerg ? 'bg-red-500 ring-red-200' : 'bg-sky-500 ring-sky-200'
                }`}
              />
              <ConsultaCard consulta={c} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

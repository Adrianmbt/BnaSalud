import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2, Save } from 'lucide-react';
import { guardarFicha } from '../../api/historiasMedicas';
import {
  SECCIONES_CITAB,
  contarCamposCompletos,
  normalizarDatos,
} from './formularioCitab';

function SiNo({ valor, onChange, label }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex gap-1.5">
        {[
          { v: true, t: 'SÍ' },
          { v: false, t: 'NO' },
        ].map((opcion) => {
          const activo = valor === opcion.v;
          return (
            <button
              key={opcion.t}
              type="button"
              onClick={() => onChange(activo ? null : opcion.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ring-1 transition-all ${
                activo
                  ? opcion.v
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-300'
                    : 'bg-rose-50 text-rose-700 ring-rose-300'
                  : 'bg-white text-slate-400 ring-slate-200 hover:bg-slate-50'
              }`}
              aria-pressed={activo}
            >
              {opcion.t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Campo({ campo, valor, onChange, error }) {
  const baseInput =
    'w-full px-3 py-2 bg-white border text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all';

  if (campo.tipo === 'bool') {
    return <SiNo valor={valor} onChange={onChange} label={campo.label} />;
  }

  return (
    <div className={campo.ancho === 'full' ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
        {campo.label}
        {campo.requerido && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {campo.tipo === 'select' ? (
        <select
          value={valor ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseInput} ${error ? 'border-rose-300' : 'border-slate-200'}`}
        >
          <option value="">Sin registrar</option>
          {(campo.opciones || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : campo.tipo === 'textarea' ? (
        <textarea
          value={valor ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={campo.filas || 3}
          className={`${baseInput} ${error ? 'border-rose-300' : 'border-slate-200'} resize-y`}
        />
      ) : (
        <input
          type={campo.tipo === 'number' ? 'number' : campo.tipo === 'date' ? 'date' : 'text'}
          value={valor ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseInput} ${error ? 'border-rose-300' : 'border-slate-200'}`}
        />
      )}
      {error && <p className="text-[10px] text-rose-500 mt-1">{error}</p>}
    </div>
  );
}

export default function FichaIntegralForm({ paciente, ficha, onSaved }) {
  const [datos, setDatos] = useState(() => normalizarDatos(ficha?.datos));
  const [numeroCarpeta, setNumeroCarpeta] = useState(ficha?.numero_carpeta || '');
  const [seccionActiva, setSeccionActiva] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [errores, setErrores] = useState({});

  useEffect(() => {
    setDatos(normalizarDatos(ficha?.datos));
    setNumeroCarpeta(ficha?.numero_carpeta || '');
  }, [ficha?.id, ficha?.version]);

  const seccion = SECCIONES_CITAB[seccionActiva];
  const avance = useMemo(() => contarCamposCompletos(datos), [datos]);

  const actualizar = (seccionId, key, valor) => {
    setDatos((prev) => ({
      ...prev,
      [seccionId]: { ...prev[seccionId], [key]: valor },
    }));
    setErrores((prev) => ({ ...prev, [`${seccionId}.${key}`]: undefined }));
  };

  const validar = () => {
    const nuevos = {};
    const ident = datos.identificacion || {};
    if (!String(ident.nombres || '').trim()) nuevos['identificacion.nombres'] = 'Requerido';
    if (!String(ident.apellidos || '').trim()) nuevos['identificacion.apellidos'] = 'Requerido';
    setErrores(nuevos);
    if (Object.keys(nuevos).length) {
      setSeccionActiva(0);
      return false;
    }
    return true;
  };

  const guardar = async () => {
    setMensaje(null);
    if (!validar()) return;
    setGuardando(true);
    try {
      const actualizada = await guardarFicha(paciente.id, {
        numero_carpeta: numeroCarpeta.trim() || datos.identificacion?.numero_carpeta || null,
        datos,
      });
      setMensaje({ tipo: 'ok', texto: `Ficha guardada · versión ${actualizada.version}` });
      onSaved?.(actualizada);
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err?.response?.data?.detail || 'No se pudo guardar la ficha.',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-sm font-display font-bold text-slate-800">
            {ficha ? `Ficha integral · versión ${ficha.version}` : 'Nueva ficha integral'}
          </p>
          <p className="text-[11px] text-slate-400">
            {avance.completos} de {avance.total} campos registrados ({avance.porcentaje}%)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-32 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-brand-primary transition-all"
              style={{ width: `${avance.porcentaje}%` }}
            />
          </div>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>

      {mensaje && (
        <div
          className={`rounded-lg px-3 py-2 text-xs font-semibold ring-1 ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-rose-50 text-rose-700 ring-rose-200'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1" aria-label="Secciones de la ficha">
          {SECCIONES_CITAB.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeccionActiva(idx)}
              className={`shrink-0 text-left px-3 py-2 rounded-lg text-[11px] font-semibold transition-all ${
                idx === seccionActiva
                  ? 'bg-brand-primary/10 text-brand-deep ring-1 ring-brand-primary/20'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
              aria-current={idx === seccionActiva ? 'step' : undefined}
            >
              {idx + 1}. {s.titulo}
            </button>
          ))}
        </nav>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="font-display font-bold text-sm text-slate-800">{seccion.titulo}</h3>
            <p className="text-[11px] text-slate-400">{seccion.descripcion}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {seccion.campos.map((campo) => (
              <Campo
                key={campo.key}
                campo={campo}
                valor={datos[seccion.id]?.[campo.key]}
                onChange={(valor) => actualizar(seccion.id, campo.key, valor)}
                error={errores[`${seccion.id}.${campo.key}`]}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setSeccionActiva((s) => Math.max(0, s - 1))}
              disabled={seccionActiva === 0}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            {seccionActiva < SECCIONES_CITAB.length - 1 ? (
              <button
                type="button"
                onClick={() => setSeccionActiva((s) => Math.min(SECCIONES_CITAB.length - 1, s + 1))}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-brand-deep bg-brand-primary/10 hover:bg-brand-primary/15"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <Check className="w-4 h-4" /> Fin de la ficha
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

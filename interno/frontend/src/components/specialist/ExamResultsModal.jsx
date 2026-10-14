import React, { useState, useMemo, useCallback } from 'react';
import { FlaskConical, ScanLine, Activity, Loader2, Save, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import PanelModal from './PanelModal';
import {
  buscarResultDef,
  obtenerRango,
  estaFueraDeRango,
  todosLosExamenes,
} from './catalogoExamenes';

function ValorRow({ def, valor, onChange }) {
  const rango = obtenerRango(def);
  const estado = estaFueraDeRango(valor, def);
  const hasValor = valor !== '' && valor !== undefined && valor !== null;

  return (
    <tr className={`border-b border-slate-100 last:border-0 ${estado === 'bajo' || estado === 'alto' ? 'bg-red-50/60' : ''}`}>
      <td className="py-1.5 pr-2 text-xs font-semibold text-slate-600 whitespace-nowrap">{def.label}</td>
      <td className="py-1.5 w-28">
        <input
          type="text"
          inputMode="decimal"
          value={valor || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className={`w-full text-xs text-right px-2 py-1 rounded-lg border transition-colors ${
            estado === 'bajo' || estado === 'alto'
              ? 'border-red-400 bg-red-50 text-red-700 font-bold'
              : hasValor
              ? 'border-emerald-300 bg-emerald-50/50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-700'
          } focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400`}
        />
      </td>
      <td className="py-1.5 pl-2 text-[10px] text-slate-400 whitespace-nowrap">{def.unidad}</td>
      <td className="py-1.5 pl-2 text-[10px] text-slate-500 whitespace-nowrap">
        {rango.texto || `${def.refMin} – ${def.refMax}`}
      </td>
      <td className="py-1.5 pl-2 w-6">
        {hasValor && (
          estado === 'bajo' || estado === 'alto' ? (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-100">
              <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-emerald-100">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
            </span>
          )
        )}
      </td>
    </tr>
  );
}

function ExamenCard({ item, index, onChange, onRemove, totalItems }) {
  const [abierto, setAbierto] = useState(true);
  const resultDef = useMemo(() => buscarResultDef(item.estudio), [item.estudio]);
  const Icon = FlaskConical;

  const opciones = useMemo(() => {
    const all = todosLosExamenes();
    return all.map((e) => ({
      value: e.nombre,
      label: e.nombre,
      grupo: e.grupo,
      categoria: e.categoria,
      tieneDef: e.tieneResultDef,
    }));
  }, []);

  const setField = (field, value) => {
    const updated = { ...item, [field]: value };
    if (field === 'estudio') {
      const newDef = buscarResultDef(value);
      const existingVals = {};
      (item.valores || []).forEach((v) => { existingVals[v.id] = v.valor; });
      if (newDef) {
        updated.valores = newDef.valores.map((v) => ({ id: v.id, valor: existingVals[v.id] || '' }));
      } else {
        updated.valores = [];
      }
    }
    onChange(index, updated);
  };

  const setValor = (valorId, valor) => {
    const newVals = (item.valores || []).map((v) => (v.id === valorId ? { ...v, valor } : v));
    onChange(index, { ...item, valores: newVals });
  };

  const valsConDato = (item.valores || []).filter((v) => v.valor !== '' && v.valor !== undefined).length;
  const valsTotal = item.valores?.length || 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/80 border-b border-slate-100">
        <span className="shrink-0 h-5 w-5 rounded flex items-center justify-center bg-slate-200">
          <Icon className="w-3 h-3 text-slate-600" />
        </span>
        <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
        <p className="flex-1 min-w-0 text-sm font-bold text-slate-700 truncate">
          {item.estudio || 'Sin nombre'}
        </p>
        {valsTotal > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            valsConDato === valsTotal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {valsConDato}/{valsTotal}
          </span>
        )}
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
        >
          {abierto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {totalItems > 1 && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="shrink-0 text-[10px] text-red-400 hover:text-red-600 font-bold px-1"
            title="Quitar examen"
          >
            ✕
          </button>
        )}
      </div>

      {abierto && (
        <div className="p-3 space-y-2">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Indicación</label>
            <input
              type="text"
              value={item.indicacion || ''}
              onChange={(e) => setField('indicacion', e.target.value)}
              placeholder="Motivo del examen..."
              className="cp-input text-[12px]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Tipo de examen</label>
            <div className="relative">
              <select
                value={item.estudio || ''}
                onChange={(e) => setField('estudio', e.target.value)}
                className="cp-input text-[12px] pr-7 appearance-none"
              >
                <option value="">— Seleccionar examen —</option>
                {opciones.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}{op.tieneDef ? ' ✓' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {item.valores?.length > 0 && (
            <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="py-1.5 px-3 text-left">Parámetro</th>
                    <th className="py-1.5 px-2 text-right w-28">Valor</th>
                    <th className="py-1.5 px-2 text-left w-16">Unidad</th>
                    <th className="py-1.5 px-2 text-left w-24">Referencia</th>
                    <th className="py-1.5 px-2 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {item.valores.map((v) => {
                    const def = resultDef?.valores.find((d) => d.id === v.id);
                    if (!def) return null;
                    return (
                      <ValorRow
                        key={v.id}
                        def={def}
                        valor={v.valor}
                        onChange={(val) => setValor(v.id, val)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
              {item.valores?.length > 0 ? 'Observaciones adicionales' : 'Resultado'}
            </label>
            <textarea
              rows={2}
              value={item.resultado || ''}
              onChange={(e) => setField('resultado', e.target.value)}
              placeholder={item.valores?.length > 0 ? 'Notas adicionales (opcional)...' : 'Ingrese el resultado del examen...'}
              className="cp-input resize-none text-[12px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function examItemInicial(nombre, indicacion) {
  const def = buscarResultDef(nombre);
  return {
    estudio: nombre || '',
    indicacion: indicacion || '',
    resultado: '',
    valores: def ? def.valores.map((v) => ({ id: v.id, valor: '' })) : [],
  };
}

export default function ExamResultsModal({ abierto, onClose, consulta, onGuardado }) {
  const [lab, setLab] = useState([]);
  const [est, setEst] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [inicializado, setInicializado] = useState(false);

  React.useEffect(() => {
    if (abierto && consulta && !inicializado) {
      const labs = (Array.isArray(consulta.laboratorios) ? consulta.laboratorios : []).map((l) => {
        const nombre = l.estudio || l.examen || l.nombre || '';
        const def = buscarResultDef(nombre);
        const existingVals = Array.isArray(l.valores) ? l.valores : [];
        return {
          estudio: nombre,
          indicacion: l.indicacion || '',
          resultado: l.resultado || '',
          valores: def
            ? def.valores.map((v) => {
                const found = existingVals.find((ev) => ev.id === v.id);
                return { id: v.id, valor: found ? found.valor : '' };
              })
            : existingVals,
        };
      });
      const estudios = (Array.isArray(consulta.estudios) ? consulta.estudios : []).map((e) => {
        const nombre = e.estudio || e.examen || e.nombre || '';
        const def = buscarResultDef(nombre);
        const existingVals = Array.isArray(e.valores) ? e.valores : [];
        return {
          estudio: nombre,
          indicacion: e.indicacion || '',
          resultado: e.resultado || '',
          valores: def
            ? def.valores.map((v) => {
                const found = existingVals.find((ev) => ev.id === v.id);
                return { id: v.id, valor: found ? found.valor : '' };
              })
            : existingVals,
        };
      });
      setLab(labs);
      setEst(estudios);
      setInicializado(true);
      setMsg('');
      setErr('');
    }
    if (!abierto) {
      setInicializado(false);
    }
  }, [abierto, consulta, inicializado]);

  const totalExamenes = lab.length + est.length;
  const totalConDato = useMemo(() => {
    const count = (items) => items.filter((i) => {
      if (i.valores?.length > 0) return i.valores.some((v) => v.valor !== '');
      return (i.resultado || '').trim().length > 0;
    }).length;
    return count(lab) + count(est);
  }, [lab, est]);

  const updateLabItem = useCallback((idx, updated) => {
    setLab((prev) => prev.map((item, i) => (i === idx ? updated : item)));
  }, []);

  const updateEstItem = useCallback((idx, updated) => {
    setEst((prev) => prev.map((item, i) => (i === idx ? updated : item)));
  }, []);

  const removeLabItem = useCallback((idx) => {
    setLab((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const removeEstItem = useCallback((idx) => {
    setEst((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addLabItem = () => {
    setLab((prev) => [...prev, examItemInicial('', '')]);
  };

  const addEstItem = () => {
    setEst((prev) => [...prev, examItemInicial('', '')]);
  };

  const guardar = async () => {
    if (!consulta?.consulta_id) return;
    setCargando(true);
    setMsg('');
    setErr('');
    try {
      await axiosClient.put(`/consultas/${consulta.consulta_id}/resultados-examenes`, {
        laboratorios: lab,
        estudios: est,
      });
      setMsg('Resultados guardados correctamente.');
      onGuardado && onGuardado();
    } catch (e) {
      setErr(e?.response?.data?.detail || 'No se pudieron guardar los resultados.');
    } finally {
      setCargando(false);
    }
  };

  if (!consulta) return null;

  return (
    <PanelModal
      abierto={abierto}
      onClose={onClose}
      id="sp-resultados-modal"
      titulo="Resultados de exámenes del remitente"
      subtitulo={`${totalConDato}/${totalExamenes} con resultado · ${consulta.especialidad || 'Emergencia'}`}
      icono={<FlaskConical className="w-5 h-5" />}
      maxW="max-w-4xl"
    >
      {totalExamenes === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">
          Esta consulta no tiene exámenes registrados.
        </div>
      ) : (
        <div className="space-y-4">
          {lab.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Laboratorio ({lab.length})</h4>
              </div>
              <div className="space-y-3">
                {lab.map((item, idx) => (
                  <ExamenCard key={`lab-${idx}`} item={item} index={idx} onChange={updateLabItem} onRemove={removeLabItem} totalItems={lab.length} />
                ))}
              </div>
              <button
                type="button"
                onClick={addLabItem}
                className="mt-2 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                + Agregar examen de laboratorio
              </button>
            </section>
          )}

          {est.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <ScanLine className="w-3.5 h-3.5 text-cyan-600" />
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Estudios ({est.length})</h4>
              </div>
              <div className="space-y-3">
                {est.map((item, idx) => (
                  <ExamenCard key={`est-${idx}`} item={item} index={idx} onChange={updateEstItem} onRemove={removeEstItem} totalItems={est.length} />
                ))}
              </div>
              <button
                type="button"
                onClick={addEstItem}
                className="mt-2 text-[11px] font-bold text-cyan-600 hover:text-cyan-700 transition-colors"
              >
                + Agregar estudio de imagen/funcional
              </button>
            </section>
          )}

          {msg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-800 px-3 py-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {msg}
            </div>
          )}
          {err && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 text-red-700 px-3 py-2 text-xs font-semibold">
              {err}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={guardar}
              disabled={cargando}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-success hover:opacity-90 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-60"
            >
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar resultados
            </button>
          </div>
        </div>
      )}
    </PanelModal>
  );
}

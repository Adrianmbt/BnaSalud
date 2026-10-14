import React, { useMemo, useState } from 'react';
import { Plus, Search, X, FlaskConical, ScanLine, Activity, Loader2, Trash2, ClipboardList, CheckCircle2 } from 'lucide-react';
import { CATALOGO_EXAMENES, CATEGORIAS_ORDEN, categoriaEstilo, grupoEstilo } from '../../clinical/catalogoExamenes';

const EXAMENES_VACIOS = {
  laboratorio: { activo: false, items: [] },
  imagen: { activo: false, items: [] },
  funcional: { activo: false, items: [] },
  anatomia_patologica: { activo: false, items: [] },
};

export function examenesVacios() {
  return JSON.parse(JSON.stringify(EXAMENES_VACIOS));
}

function ItemFila({ item, onQuitar }) {
  return (
    <div className="flex items-start gap-2 py-1.5 group">
      <span className="text-sm text-slate-700 flex-1">{item.estudio}</span>
      {item.indicacion && <span className="text-[11px] text-slate-400 italic">{item.indicacion}</span>}
      <button
        type="button"
        onClick={onQuitar}
        className="p-1 rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
        aria-label={`Quitar ${item.estudio}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function BrowserExamenes({ categoria, busqueda, sel, onToggle, onConfirm, onCancel, onBusqueda }) {
  const cat = categoriaEstilo(categoria);
  const I = cat.icono;
  const grupos = useMemo(() => {
    const g = CATALOGO_EXAMENES[categoria] || [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return g;
    return g
      .map((gr) => ({
        ...gr,
        estudios: gr.estudios.filter((e) => e.toLowerCase().includes(q)),
      }))
      .filter((gr) => gr.estudios.length > 0);
  }, [categoria, busqueda]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-in">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-100"
        style={{ background: `${cat.soft}` }}>
        <span className="h-6 w-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: cat.color }}>
          <I className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Catálogo · {cat.etiqueta}</span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">{sel.size} seleccionado(s)</span>
      </div>
      <div className="px-3.5 pt-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder={`Buscar examen de ${cat.etiqueta}…`}
            className="cp-input !py-2 !pl-9 text-[13px]"
            autoComplete="off"
          />
        </div>
      </div>
      <div className="p-3 max-h-[300px] overflow-y-auto space-y-2">
        {grupos.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400 italic">Sin resultados para "{busqueda}".</p>
        )}
        {grupos.map((g) => {
          const gEstilo = grupoEstilo(g.grupo);
          const color = gEstilo.color || cat.color;
          const GrupI = g.icono;
          return (
            <div key={g.grupo} className="pb-1">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: color }}>
                  {gEstilo.sigla ? (
                    <span className="font-mono text-[9px] font-bold tracking-wide">{gEstilo.sigla}</span>
                  ) : (
                    <GrupI className="w-3.5 h-3.5" />
                  )}
                </span>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{g.grupo}</span>
              </div>
              <div className="pl-4">
                {g.estudios.map((estudio) => (
                  <label
                    key={estudio}
                    className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg cursor-pointer select-none transition-colors ${
                      sel.has(estudio) ? 'bg-brand-primary/5' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sel.has(estudio)}
                      onChange={() => onToggle(estudio)}
                      className="w-[17px] h-[17px] accent-brand-primary shrink-0"
                    />
                    <span className="text-sm text-slate-700">{estudio}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 px-3.5 py-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={sel.size === 0}
          className="flex-[1.6] py-2 rounded-xl text-white font-bold text-xs transition-all disabled:opacity-50"
          style={{ backgroundColor: cat.color }}
        >
          Agregar ({sel.size})
        </button>
      </div>
    </div>
  );
}

export default function ExamOrderPanel({ examenes, onExamenes }) {
  const [browserCat, setBrowserCat] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState(() => new Set());

  const total = useMemo(
    () => ['laboratorio', 'imagen', 'funcional'].reduce((acc, c) => acc + (examenes[c]?.items?.length || 0), 0),
    [examenes]
  );

  const actualizarCat = (cat, patch) =>
    onExamenes((prev) => ({ ...prev, [cat]: { ...(prev[cat] || EXAMENES_VACIOS[cat]), ...patch } }));

  const abrir = (cat) => {
    setBrowserCat(cat);
    setBusqueda('');
    setSel(new Set());
  };

  const toggleSel = (estudio) => {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(estudio)) n.delete(estudio);
      else n.add(estudio);
      return n;
    });
  };

  const confirmar = () => {
    const actuales = (examenes[browserCat]?.items || []).map((i) => i.estudio);
    const nuevos = [...sel].filter((e) => !actuales.includes(e)).map((estudio) => ({ estudio, indicacion: '', resultado: '' }));
    actualizarCat(browserCat, { activo: true, items: [...(examenes[browserCat]?.items || []), ...nuevos] });
    setBrowserCat(null);
  };

  const vaciarCat = (cat) => actualizarCat(cat, { activo: false, items: [] });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-brand-primary" />
        <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">Órdenes de exámenes</h3>
        <span className="ml-auto px-2.5 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-bold font-mono">
          {total} estudio(s)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {CATEGORIAS_ORDEN.map((cat) => {
          const I = cat.icono;
          const estado = examenes[cat.id] || EXAMENES_VACIOS[cat.id];
          const n = estado.items?.length || 0;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => abrir(cat.id)}
              className={`rounded-xl border-2 px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 ${
                n > 0 ? 'border-transparent shadow-sm' : 'border-dashed border-slate-300 hover:border-brand-primary/50'
              }`}
              style={n > 0 ? { backgroundColor: cat.soft } : undefined}
            >
              <span className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: cat.color }}>
                  <I className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-slate-700">{cat.etiqueta}</span>
                {n > 0 && (
                  <span className="ml-auto font-mono text-[10px] font-bold text-white px-2 py-0.5 rounded-md" style={{ backgroundColor: cat.color }}>
                    {n}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {browserCat && (
        <BrowserExamenes
          categoria={browserCat}
          busqueda={busqueda}
          sel={sel}
          onToggle={toggleSel}
          onConfirm={confirmar}
          onCancel={() => setBrowserCat(null)}
          onBusqueda={setBusqueda}
        />
      )}

      {total === 0 && !browserCat && (
        <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-3 text-center">
          Agrega exámenes de laboratorio, imagen o funcionales para incluirlos en la consulta.
        </p>
      )}

      {/* Items actuales */}
      {['laboratorio', 'imagen', 'funcional']
        .filter((c) => (examenes[c]?.items || []).length > 0)
        .map((c) => {
          const cat = categoriaEstilo(c);
          return (
            <div key={c} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-3.5 py-2 flex items-center gap-2 border-b border-slate-100" style={{ backgroundColor: cat.soft }}>
                <span className="h-6 w-6 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}>
                  <FlaskConical className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold text-slate-700">{cat.etiqueta}</span>
                <button
                  type="button"
                  onClick={() => vaciarCat(c)}
                  className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Vaciar
                </button>
              </div>
              <div className="px-3.5 py-2 divide-y divide-slate-100">
                {(examenes[c].items || []).map((item) => (
                  <ItemFila key={item.estudio} item={item} onQuitar={() => vaciarCat(c)} />
                ))}
              </div>
            </div>
          );
        })}

      {total > 0 && (
        <p className="inline-flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" /> Estas órdenes se registrarán al finalizar la consulta.
        </p>
      )}
    </div>
  );
}
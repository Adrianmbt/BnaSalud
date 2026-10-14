/**
 * MedicalOrderSelector — Selector de exámenes médicos con búsqueda, multi-selección y badges.
 * WCAG 2.2 AA: keyboard nav, aria labels, focus management, live regions, target sizes ≥44px.
 */
import React, { useState, useMemo, useCallback, useRef, useEffect, useId } from 'react';
import {
  Search, X, Check,
  FlaskConical, ScanLine, Activity, FileCheck,
} from 'lucide-react';
import {
  CATALOGO_EXAMENES,
  CATEGORIAS_ORDEN,
  categoriaEstilo,
  grupoEstilo,
} from './catalogoExamenes';

const CAT_ICONS = { laboratorio: FlaskConical, imagen: ScanLine, funcional: Activity, anatomia_patologica: FileCheck };
const CAT_COLORS = {
  laboratorio: { ring: 'ring-emerald-500/40', bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-600' },
  imagen:      { ring: 'ring-cyan-500/40',    bg: 'bg-cyan-50',    text: 'text-cyan-700',    badge: 'bg-cyan-600' },
  funcional:   { ring: 'ring-amber-500/40',   bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-600' },
  anatomia_patologica: { ring: 'ring-rose-500/40', bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-600' },
};

/** El catálogo guarda estudios como string en unas categorías y como {nombre} en otras. */
const nombreDe = (e) => (typeof e === 'string' ? e : e.nombre);

/**
 * Localiza la categoría y el grupo de un estudio en TODO el catálogo.
 * Necesario porque al buscar el médico puede encontrar un estudio de imagen
 * mientras está en la pestaña de laboratorio: si se usara catActiva, la orden
 * se guardaría con la categoría equivocada.
 */
function ubicar(nombre) {
  for (const [categoria, grupos] of Object.entries(CATALOGO_EXAMENES)) {
    for (const g of grupos) {
      if (g.estudios.some((e) => nombreDe(e) === nombre)) return { categoria, grupo: g.grupo };
    }
  }
  return { categoria: null, grupo: '' };
}

function useLiveAnnounce() {
  const [msg, setMsg] = useState('');
  const t = useRef(null);
  const announce = useCallback((text) => {
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(text), 50);
  }, []);
  useEffect(() => () => clearTimeout(t.current), []);
  return { msg, announce };
}

function ExamItemRow({ nombre, seleccionado, onToggle, optId, isFocused }) {
  const ref = useRef(null);
  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
      ref.current.focus();
    }
  }, [isFocused]);

  return (
    <label
      ref={ref}
      id={optId}
      role="option"
      aria-selected={seleccionado}
      tabIndex={isFocused ? 0 : -1}
      onClick={(e) => { e.preventDefault(); onToggle(nombre); }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(nombre); }
      }}
      className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg cursor-pointer select-none transition-colors min-h-[44px] ${
        seleccionado ? 'bg-brand-primary/5 ring-1 ring-brand-primary/20' : 'hover:bg-slate-50'
      } ${isFocused ? 'ring-2 ring-brand-primary/40' : ''}`}
    >
      <span
        className={`shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
          seleccionado ? 'bg-brand-primary border-brand-primary text-white' : 'border-slate-300 bg-white'
        }`}
        aria-hidden="true"
      >
        {seleccionado && <Check className="w-3 h-3" />}
      </span>
      <input type="checkbox" checked={seleccionado} readOnly className="sr-only" tabIndex={-1} aria-hidden="true" />
      <span className="text-sm text-slate-700 flex-1">{nombre}</span>
    </label>
  );
}

export default function MedicalOrderSelector({ seleccionados = new Map(), onSeleccionados }) {
  const [busqueda, setBusqueda] = useState('');
  const [catActiva, setCatActiva] = useState('laboratorio');
  const [activeIdx, setActiveIdx] = useState(-1);
const baseId = useId();
  const { msg: liveMsg, announce } = useLiveAnnounce();

  const q = busqueda.trim().toLowerCase();
  const buscando = q.length > 0;

  /**
   * Sin búsqueda: solo la pestaña activa.
   * Con búsqueda: TODAS las categorías, porque el médico no sabe de antemano
   * si "mamografía" es imagen o funcional, y antes tenía que adivinar la pestaña.
   */
  const examenesFiltrados = useMemo(() => {
    if (!q) return CATALOGO_EXAMENES[catActiva] || [];
    return Object.values(CATALOGO_EXAMENES)
      .flat()
      .map((g) => ({ ...g, estudios: g.estudios.filter((e) => nombreDe(e).toLowerCase().includes(q)) }))
      .filter((g) => g.estudios.length > 0);
  }, [catActiva, q]);

  const flatItems = useMemo(() => {
    const items = [];
    examenesFiltrados.forEach((g) => {
      g.estudios.forEach((e) => { items.push(nombreDe(e)); });
    });
    return items;
  }, [examenesFiltrados]);

  const toggleExamen = useCallback((nombre) => {
    onSeleccionados((prev) => {
      const next = new Map(prev);
      if (next.has(nombre)) {
        next.delete(nombre);
        announce(`${nombre} removido`);
      } else {
        const { categoria, grupo } = ubicar(nombre);
        next.set(nombre, { nombre, categoria: categoria || catActiva, grupo });
        announce(`${nombre} seleccionado`);
      }
      return next;
    });
  }, [catActiva, onSeleccionados, announce]);

  const onListaKeyDown = useCallback((e) => {
    const len = flatItems.length;
    if (!len) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActiveIdx((p) => (p + 1) % len); break;
      case 'ArrowUp':   e.preventDefault(); setActiveIdx((p) => (p - 1 + len) % len); break;
      case 'Enter': case ' ':
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < len) toggleExamen(flatItems[activeIdx]);
        break;
      case 'Home': e.preventDefault(); setActiveIdx(0); break;
      case 'End':  e.preventDefault(); setActiveIdx(len - 1); break;
      default: break;
    }
  }, [flatItems, activeIdx, toggleExamen]);

  useEffect(() => { setActiveIdx(-1); }, [busqueda, catActiva]);

  const totalSeleccionados = seleccionados.size;

  const statsPorCat = useMemo(() => {
    const s = {};
    for (const [, d] of seleccionados) { s[d.categoria] = (s[d.categoria] || 0) + 1; }
    return s;
  }, [seleccionados]);

  // Calcular índice start para cada grupo
  let runningIdx = 0;

  return (
    <div className="space-y-3">
      {/* Tabs de categoría. El contador global vive en el pie de la modal (PadModal). */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categorías de exámenes">
        {CATEGORIAS_ORDEN.map((cat) => {
          const Icon = CAT_ICONS[cat.id] || FlaskConical;
          const c = CAT_COLORS[cat.id] || CAT_COLORS.laboratorio;
          const count = statsPorCat[cat.id] || 0;
          const activa = !buscando && catActiva === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              id={`cat-tab-${cat.id}`}
              aria-selected={activa}
              aria-controls={`cat-panel-${catActiva}`}
              onClick={() => { setCatActiva(cat.id); setBusqueda(''); setActiveIdx(-1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] min-w-[44px] ${
                activa ? `${c.bg} ${c.text} ring-2 ${c.ring}` : 'bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {cat.etiqueta}
              {count > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white ${c.badge}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chips de seleccionados: arriba del catálogo, para verlos sin(scrollear */}
      {totalSeleccionados > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Exámenes seleccionados">
          {[...seleccionados.values()].map((item) => {
            const c = CAT_COLORS[item.categoria] || CAT_COLORS.laboratorio;
            return (
              <span key={item.nombre} role="listitem"
                className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg text-xs font-semibold ${c.bg} ${c.text} min-h-[36px]`}>
                {item.nombre}
                <button
                  type="button"
                  onClick={() => toggleExamen(item.nombre)}
                  className="rounded p-1.5 hover:bg-black/10 transition-colors min-w-[28px] min-h-[28px] -my-1 flex items-center justify-center"
                  aria-label={`Quitar ${item.nombre}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Catálogo: siempre visible. Es la pantalla, no un panel que se abre y cierra. */}
      <div
        role="tabpanel"
        id={`cat-panel-${catActiva}`}
        aria-labelledby={`cat-tab-${catActiva}`}
        className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
          {/* Búsqueda: primero, antes que la lista. */}
          <div className="p-3 border-b border-slate-100">
            <label htmlFor={`busq-${baseId}`} className="sr-only">
              Buscar examen
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id={`busq-${baseId}`}
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar examen…"
                className="cp-input !py-2.5 !pl-9 min-h-[44px]"
                autoComplete="off"
                enterKeyHint="search"
                aria-describedby={`hint-${baseId}`}
              />
            </div>
            <p id={`hint-${baseId}`} className="sr-only">
              La búsqueda cubre todas las categorías. Flechas arriba y abajo para navegar.
              Espacio o Enter para seleccionar.
            </p>
            <p className="mt-2 text-[11px] text-slate-500" aria-live="polite" aria-atomic="true">
              {buscando
                ? `${flatItems.length} resultado(s) en todas las categorías`
                : categoriaEstilo(catActiva).etiqueta}
            </p>
          </div>

          {/* Lista de exámenes */}
          <div
            role="listbox"
            aria-label="Exámenes"
            aria-multiselectable="true"
            aria-activedescendant={activeIdx >= 0 ? `opt-${activeIdx}` : undefined}
            onKeyDown={onListaKeyDown}
            className="p-3 max-h-[min(40dvh,350px)] sm:max-h-[350px] overflow-y-auto space-y-1"
          >
            {examenesFiltrados.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400 italic" role="status">
                Sin resultados para "{busqueda}".
              </p>
            )}
            {examenesFiltrados.map((grupo) => {
              const gEstilo = grupoEstilo(grupo.grupo) || {};
              const colorG = gEstilo.color || categoriaEstilo(catActiva).color;
              const startIdx = runningIdx;
              const estudiosNombres = grupo.estudios.map(nombreDe);
              runningIdx += estudiosNombres.length;

              return (
                <div key={grupo.grupo} className="pb-2">
                  <div className="flex items-center gap-2 px-2 py-2 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: colorG }} aria-hidden="true">
                      <span className="font-mono text-[9px] font-bold tracking-wide">{gEstilo.sigla || '·'}</span>
                    </span>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{grupo.grupo}</span>
                  </div>
                  <div className="pl-4 space-y-0.5">
                    {estudiosNombres.map((nombre, i) => (
                      <ExamItemRow
                        key={nombre}
                        nombre={nombre}
                        seleccionado={seleccionados.has(nombre)}
                        onToggle={toggleExamen}
                        optId={`opt-${startIdx + i}`}
                        isFocused={activeIdx === startIdx + i}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
      </div>

      {/* Live region */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">{liveMsg}</div>
    </div>
  );
}

/** Convierte Map de seleccionados al formato ExamOrderPanel. */
export function seleccionadosAExamenes(seleccionados) {
  const result = {
    laboratorio: { activo: false, items: [] },
    imagen: { activo: false, items: [] },
    funcional: { activo: false, items: [] },
    anatomia_patologica: { activo: false, items: [] },
  };
  for (const [, data] of seleccionados) {
    const cat = data.categoria;
    if (!result[cat]) result[cat] = { activo: false, items: [] };
    result[cat].activo = true;
    result[cat].items.push({ estudio: data.nombre, indicacion: '', resultado: '' });
  }
  return result;
}

/** Convierte formato ExamOrderPanel al Map de seleccionados. */
export function examenesASeleccionados(examenes) {
  const map = new Map();
  for (const [cat, data] of Object.entries(examenes)) {
    if (data?.items) {
      for (const item of data.items) {
        map.set(item.estudio, { nombre: item.estudio, categoria: cat, grupo: '' });
      }
    }
  }
  return map;
}

import React, { useMemo, useState } from 'react';
import { Pill, Search, Loader2, PackageCheck, PackageX } from 'lucide-react';
import PanelModal from './PanelModal';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function tokeniza(nombre) {
  return norm(nombre)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

export default function MedicationCatalogModal({
  abierto,
  onClose,
  onSeleccionar,
  catalogo = [],
  inventario = [],
  cargando = false,
  err = '',
  stockDe,
  permitirSinStock = false,
}) {
  const [busqueda, setBusqueda] = useState('');

  const stockPorNombre = useMemo(() => {
    const m = new Map();
    for (const item of inventario) {
      const clave = norm(item.nombre);
      if (!m.has(clave)) m.set(clave, item.stock_actual || 0);
    }
    return m;
  }, [inventario]);

  const stockLocal = (med) => {
    if (stockDe) return stockDe(med);
    const nombre = norm(med.nombre);
    if (stockPorNombre.has(nombre)) return stockPorNombre.get(nombre);
    const tokens = tokeniza(med.nombre);
    for (const [clave, stock] of stockPorNombre) {
      const tokensInv = tokeniza(clave);
      const inter = tokens.filter((t) => tokensInv.includes(t));
      if (inter.length > 0 && inter.length / Math.min(tokens.length, tokensInv.length) >= 0.6) return stock;
    }
    return null;
  };

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter((m) =>
      [m.nombre, m.presentacion, m.concentracion].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [catalogo, busqueda]);

  const handleSeleccionar = (med) => {
    const stock = stockLocal(med);
    if (!permitirSinStock && (stock === null || stock <= 0)) return;
    onSeleccionar(med);
    setBusqueda('');
  };

  const handleClose = () => {
    setBusqueda('');
    onClose();
  };

  return (
    <PanelModal
      abierto={abierto}
      onClose={handleClose}
      id="sp-catalogo-medicinas"
      titulo="Catálogo de medicamentos"
      subtitulo={permitirSinStock ? "Selecciona un medicamento para la receta" : "Selecciona un medicamento del inventario"}
      icono={<Pill className="w-5 h-5" />}
      maxW="max-w-lg"
    >
      {/* Barra de búsqueda */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, presentación o concentración…"
          className="cp-input !pl-9 !py-2.5 !text-sm"
          autoFocus
        />
      </div>

      {/* Error */}
      {err && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 text-red-700 px-3 py-2 text-xs font-semibold mb-3">
          {err}
        </div>
      )}

      {/* Lista */}
      <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
        {cargando ? (
          <div className="py-10 text-center text-slate-400">
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-brand-primary" />
            <p className="mt-2 text-xs">Cargando catálogo…</p>
          </div>
        ) : lista.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">
            {busqueda ? 'Sin resultados para esta búsqueda.' : 'Sin medicamentos en el catálogo.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {lista.map((m) => {
              const stock = stockLocal(m);
              const ok = stock !== null && stock > 0;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={permitirSinStock && !ok}
                    onClick={() => handleSeleccionar(m)}
                    title={ok ? `${m.presentacion || ''} · ${m.concentracion || ''}` : (permitirSinStock ? 'Disponible para receta' : 'Sin stock')}
                    className={`w-full text-left rounded-xl px-3 py-2.5 transition-all ${
                      (ok || permitirSinStock)
                        ? 'bg-slate-50 hover:bg-brand-success/10 ring-1 ring-slate-200 hover:ring-brand-success/40'
                        : 'bg-slate-50 opacity-50 cursor-not-allowed ring-1 ring-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-700 truncate">{m.nombre}</span>
                        <span className="text-[11px] text-slate-400">
                          {[m.presentacion, m.concentracion].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold shrink-0 ${ok ? 'text-emerald-700' : 'text-red-600'}`}>
                        {ok ? (
                          <>
                            <PackageCheck className="w-3 h-3" /> {stock}
                          </>
                        ) : (
                          <>
                            <PackageX className="w-3 h-3" /> Sin stock
                          </>
                        )}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PanelModal>
  );
}

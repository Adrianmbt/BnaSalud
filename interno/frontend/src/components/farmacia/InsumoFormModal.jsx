import React, { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';

const CATEGORIAS = [
  'PROTECCION', 'INYECCION', 'HIGIENE', 'CURACION', 'INFUSION',
  'ACCESO_VENOSO', 'LABORATORIO',
];

const UNIDADES = ['pieza', 'caja', 'rollo', 'paquete', 'unidad', 'frasco'];

const EMPTY_FORM = {
  nombre: '', descripcion: '', categoria: 'PROTECCION', unidad: 'pieza',
  stock_actual: 0, stock_minimo: 10,
};

export default function InsumoFormModal({ abierto, onClose, onSubmit, insumo }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (insumo) {
      setForm({
        nombre: insumo.nombre || '',
        descripcion: insumo.descripcion || '',
        categoria: insumo.categoria || 'PROTECCION',
        unidad: insumo.unidad || 'pieza',
        stock_actual: insumo.stock_actual ?? 0,
        stock_minimo: insumo.stock_minimo ?? 10,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [insumo, abierto]);

  if (!abierto) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insumo-form-title"
    >
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[#1a1d27] border border-white/10 shadow-2xl overflow-hidden animate-scale-in">
        <header className="px-5 py-3.5 flex items-center gap-3 border-b border-white/5 shrink-0">
          <span className="h-9 w-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center ring-1 ring-purple-500/20 shrink-0">
            <Package className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="insumo-form-title" className="font-display font-bold text-base text-white">
              {insumo ? 'Editar Insumo' : 'Agregar Insumo'}
            </h2>
            <p className="text-[11px] text-slate-400">{insumo ? 'Modificar datos del insumo' : 'Registrar nuevo insumo en el catalogo'}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nombre *</label>
            <input
              type="text"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              placeholder="Guantes desechables"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Descripcion</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none"
              placeholder="Guantes de latex talla M"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Categoria</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c} className="bg-[#1a1d27] text-white">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Unidad</label>
              <select
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u} className="bg-[#1a1d27] text-white">{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Stock Actual</label>
              <input
                type="number"
                min="0"
                value={form.stock_actual}
                onChange={(e) => setForm({ ...form, stock_actual: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Stock Minimo</label>
              <input
                type="number"
                min="0"
                value={form.stock_minimo}
                onChange={(e) => setForm({ ...form, stock_minimo: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              />
            </div>
          </div>
        </form>

        <footer className="px-5 py-3.5 border-t border-white/5 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.nombre.trim()}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Guardando...' : insumo ? 'Actualizar' : 'Agregar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

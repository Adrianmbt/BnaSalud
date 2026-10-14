import React, { useState, useEffect } from 'react';
import { X, Layers } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const EMPTY_FORM = {
  codigo_lote: '', medicamento_id: '', insumo_id: '',
  cantidad: 0, fecha_entrada: new Date().toISOString().split('T')[0], fecha_vencimiento: '',
};

export default function LoteFormModal({ abierto, onClose, onSubmit, lote, medicamentos, insumos }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lote) {
      setForm({
        codigo_lote: lote.codigo_lote || '',
        medicamento_id: lote.medicamento_id || '',
        insumo_id: lote.insumo_id || '',
        cantidad: lote.cantidad ?? 0,
        fecha_entrada: lote.fecha_entrada || new Date().toISOString().split('T')[0],
        fecha_vencimiento: lote.fecha_vencimiento || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [lote, abierto]);

  if (!abierto) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        medicamento_id: form.medicamento_id ? parseInt(form.medicamento_id) : null,
        insumo_id: form.insumo_id ? parseInt(form.insumo_id) : null,
        cantidad: parseInt(form.cantidad) || 0,
      };
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lote-form-title"
    >
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[#1a1d27] border border-white/10 shadow-2xl overflow-hidden animate-scale-in">
        <header className="px-5 py-3.5 flex items-center gap-3 border-b border-white/5 shrink-0">
          <span className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center ring-1 ring-emerald-500/20 shrink-0">
            <Layers className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="lote-form-title" className="font-display font-bold text-base text-white">
              {lote ? 'Editar Lote' : 'Agregar Lote'}
            </h2>
            <p className="text-[11px] text-slate-400">{lote ? 'Modificar datos del lote' : 'Registrar nuevo lote de inventario'}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Codigo Lote *</label>
            <input
              type="text"
              required
              value={form.codigo_lote}
              onChange={(e) => setForm({ ...form, codigo_lote: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              placeholder="LOTE-0001"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Medicamento</label>
              <select
                value={form.medicamento_id}
                onChange={(e) => setForm({ ...form, medicamento_id: e.target.value, insumo_id: '' })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              >
                <option value="" className="bg-[#1a1d27] text-white">Seleccionar...</option>
                {(medicamentos || []).map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#1a1d27] text-white">{m.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Insumo</label>
              <select
                value={form.insumo_id}
                onChange={(e) => setForm({ ...form, insumo_id: e.target.value, medicamento_id: '' })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              >
                <option value="" className="bg-[#1a1d27] text-white">Seleccionar...</option>
                {(insumos || []).map((i) => (
                  <option key={i.id} value={i.id} className="bg-[#1a1d27] text-white">{i.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Cantidad</label>
            <input
              type="number"
              min="0"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Fecha Entrada</label>
              <input
                type="date"
                value={form.fecha_entrada}
                onChange={(e) => setForm({ ...form, fecha_entrada: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Fecha Vencimiento *</label>
              <input
                type="date"
                required
                value={form.fecha_vencimiento}
                onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
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
            disabled={submitting || !form.codigo_lote.trim() || !form.fecha_vencimiento}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Guardando...' : lote ? 'Actualizar' : 'Agregar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

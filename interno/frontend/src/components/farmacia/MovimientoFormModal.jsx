import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const TIPOS = ['ENTRADA', 'SALIDA', 'AJUSTE'];

export default function MovimientoFormModal({ abierto, onClose, onSubmit, lotes }) {
  const [form, setForm] = useState({ lote_id: '', tipo: 'ENTRADA', cantidad: 1, observacion: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (abierto) {
      setForm({ lote_id: '', tipo: 'ENTRADA', cantidad: 1, observacion: '' });
    }
  }, [abierto]);

  if (!abierto) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        lote_id: parseInt(form.lote_id),
        tipo: form.tipo,
        cantidad: parseInt(form.cantidad) || 1,
        observacion: form.observacion || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mov-form-title"
    >
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[#1a1d27] border border-white/10 shadow-2xl overflow-hidden animate-scale-in">
        <header className="px-5 py-3.5 flex items-center gap-3 border-b border-white/5 shrink-0">
          <span className="h-9 w-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center ring-1 ring-cyan-500/20 shrink-0">
            <ArrowRightLeft className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="mov-form-title" className="font-display font-bold text-base text-white">
              Registrar Movimiento
            </h2>
            <p className="text-[11px] text-slate-400">Registrar entrada, salida o ajuste de inventario</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Lote *</label>
            <select
              required
              value={form.lote_id}
              onChange={(e) => setForm({ ...form, lote_id: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
            >
              <option value="" className="bg-[#1a1d27] text-white">Seleccionar lote...</option>
              {(lotes || []).map((l) => (
                <option key={l.id} value={l.id} className="bg-[#1a1d27] text-white">
                  {l.codigo_lote} — {l.producto_nombre} (Stock: {l.cantidad})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Tipo de Movimiento *</label>
            <div className="flex gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: t })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    form.tipo === t
                      ? t === 'ENTRADA' ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
                        : t === 'SALIDA' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Cantidad *</label>
            <input
              type="number"
              min="1"
              required
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Observacion</label>
            <textarea
              value={form.observacion}
              onChange={(e) => setForm({ ...form, observacion: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none"
              placeholder="Detalle del movimiento..."
            />
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
            disabled={submitting || !form.lote_id}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Guardando...' : 'Registrar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

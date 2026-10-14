import React, { useState, useEffect } from 'react';
import { Search, Plus, ArrowRightLeft, ArrowDown, ArrowUp, Settings } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import MovimientoFormModal from './MovimientoFormModal';

const getTipoBadge = (tipo) => {
  if (tipo === 'ENTRADA') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-semibold uppercase tracking-wider"><ArrowDown className="w-3 h-3" />Entrada</span>;
  if (tipo === 'SALIDA') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-semibold uppercase tracking-wider"><ArrowUp className="w-3 h-3" />Salida</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-[10px] font-semibold uppercase tracking-wider"><Settings className="w-3 h-3" />Ajuste</span>;
};

export default function MovimientosSection() {
  const [items, setItems] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [movRes, lotesRes] = await Promise.all([
        axiosClient.get('/farmacia/movimientos'),
        axiosClient.get('/farmacia/lotes'),
      ]);
      setItems(movRes.data);
      setLotes(lotesRes.data);
    } catch (err) {
      console.error('Error fetching movimientos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((m) => {
    const matchSearch = (m.producto_nombre || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.codigo_lote || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.observacion || '').toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterTipo === 'all') return true;
    return m.tipo === filterTipo;
  });

  const handleSubmit = async (form) => {
    try {
      await axiosClient.post('/farmacia/movimientos', form);
      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving movimiento:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, lote..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
          />
        </div>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
        >
          <option value="all" className="bg-[#1a1d27]">Todos</option>
          <option value="ENTRADA" className="bg-[#1a1d27]">Entradas</option>
          <option value="SALIDA" className="bg-[#1a1d27]">Salidas</option>
          <option value="AJUSTE" className="bg-[#1a1d27]">Ajustes</option>
        </select>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Registrar
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-[#1a1d27] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
                <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Producto</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lote</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cantidad</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Registrado por</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Observacion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-slate-500">
                    <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm">Sin movimientos encontrados</p>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-2.5 text-slate-300 text-xs font-mono">
                      {m.created_at ? new Date(m.created_at).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </td>
                    <td className="px-5 py-2.5 text-center">{getTipoBadge(m.tipo)}</td>
                    <td className="px-5 py-2.5 text-white font-medium">{m.producto_nombre || '-'}</td>
                    <td className="px-5 py-2.5 text-slate-300 font-mono text-xs">{m.codigo_lote || '-'}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-white tabular-nums">{m.cantidad}</td>
                    <td className="px-5 py-2.5 text-slate-300 text-xs">{m.creado_por || '-'}</td>
                    <td className="px-5 py-2.5 text-slate-400 text-xs max-w-[200px] truncate">{m.observacion || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MovimientoFormModal
        abierto={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        lotes={lotes}
      />
    </div>
  );
}

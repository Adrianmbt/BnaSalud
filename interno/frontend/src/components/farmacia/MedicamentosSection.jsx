import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, Pill, ChevronLeft, ChevronRight } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import MedicamentoFormModal from './MedicamentoFormModal';

const PER_PAGE = 8;

const getStockBadge = (actual, minimo) => {
  if (actual >= minimo * 1.5) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />OK</span>;
  if (actual >= minimo) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-[10px] font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />Bajo</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Critico</span>;
};

export default function MedicamentosSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: PER_PAGE };
      if (search) params.q = search;
      if (filterStatus === 'bajo') params.stock_status = 'bajo';
      const res = await axiosClient.get('/farmacia/medicamentos', { params });
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Error fetching medicamentos:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleSubmit = async (form) => {
    try {
      if (editing) {
        await axiosClient.put(`/farmacia/medicamentos/${editing.id}`, form);
      } else {
        await axiosClient.post('/farmacia/medicamentos', form);
      }
      setModalOpen(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      console.error('Error saving medicamento:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar este medicamento?')) return;
    try {
      await axiosClient.delete(`/farmacia/medicamentos/${id}`);
      fetchData();
    } catch (err) {
      console.error('Error deleting medicamento:', err);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition-all"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all"
        >
          <option value="all">Todos</option>
          <option value="ok">OK</option>
          <option value="bajo">Bajo</option>
          <option value="critico">Critico</option>
        </select>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-[#1a1d27] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Presentacion</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Concentracion</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Minimo</th>
                <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-slate-500">
                    <Pill className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm">Sin medicamentos encontrados</p>
                  </td>
                </tr>
              ) : (
                items.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-2.5 text-white font-medium">{m.nombre}</td>
                    <td className="px-5 py-2.5 text-slate-300">{m.presentacion || '-'}</td>
                    <td className="px-5 py-2.5 text-slate-300">{m.concentracion || '-'}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-white tabular-nums">{m.stock_actual}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-slate-400 tabular-nums">{m.stock_minimo}</td>
                    <td className="px-5 py-2.5 text-center">{getStockBadge(m.stock_actual, m.stock_minimo)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(m); setModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Editar">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-slate-400">
          <span>{total} registros &middot; Pagina {page} de {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <MedicamentoFormModal
        abierto={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
        medicamento={editing}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Layers } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import LoteFormModal from './LoteFormModal';

const getVencimientoBadge = (fecha) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fecha);
  venc.setHours(0, 0, 0, 0);
  const dias = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
  if (dias < 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-900/30 text-red-300 text-[10px] font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Vencido</span>;
  if (dias < 30) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Urgente</span>;
  if (dias < 60) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-[10px] font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />Por Vencer</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Vigente</span>;
};

export default function LotesSection() {
  const [items, setItems] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchData = async () => {
    try {
      const [lotesRes, medsRes, insRes] = await Promise.all([
        axiosClient.get('/farmacia/lotes'),
        axiosClient.get('/farmacia/medicamentos'),
        axiosClient.get('/farmacia/insumos'),
      ]);
      setItems(lotesRes.data);
      setMedicamentos(medsRes.data);
      setInsumos(insRes.data);
    } catch (err) {
      console.error('Error fetching lotes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((l) => {
    const nombre = l.producto_nombre || '';
    const matchSearch = nombre.toLowerCase().includes(search.toLowerCase()) ||
      l.codigo_lote.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterStatus === 'all') return true;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(l.fecha_vencimiento);
    venc.setHours(0, 0, 0, 0);
    const dias = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
    if (filterStatus === 'vencido') return dias < 0;
    if (filterStatus === 'urgente') return dias >= 0 && dias < 30;
    if (filterStatus === 'por_vencer') return dias >= 30 && dias < 60;
    if (filterStatus === 'vigente') return dias >= 60;
    return true;
  });

  const handleSubmit = async (form) => {
    try {
      if (editing) {
        await axiosClient.put(`/farmacia/lotes/${editing.id}`, form);
      } else {
        await axiosClient.post('/farmacia/lotes', form);
      }
      setModalOpen(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      console.error('Error saving lote:', err);
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
            placeholder="Buscar lote o producto..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
        >
          <option value="all" className="bg-[#1a1d27]">Todos</option>
          <option value="vigente" className="bg-[#1a1d27]">Vigente</option>
          <option value="por_vencer" className="bg-[#1a1d27]">Por Vencer</option>
          <option value="urgente" className="bg-[#1a1d27]">Urgente</option>
          <option value="vencido" className="bg-[#1a1d27]">Vencido</option>
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
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Codigo Lote</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Producto</th>
                <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cantidad</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Entrada</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Vencimiento</th>
                <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-10 text-center text-slate-500">
                    <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm">Sin lotes encontrados</p>
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-2.5 text-white font-mono font-medium text-xs">{l.codigo_lote}</td>
                    <td className="px-5 py-2.5 text-white font-medium">{l.producto_nombre}</td>
                    <td className="px-5 py-2.5 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        l.producto_tipo === 'MEDICAMENTO' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'
                      }`}>
                        {l.producto_tipo}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-white tabular-nums">{l.cantidad}</td>
                    <td className="px-5 py-2.5 text-slate-300 text-xs">{l.fecha_entrada}</td>
                    <td className="px-5 py-2.5 text-slate-300 text-xs">{l.fecha_vencimiento}</td>
                    <td className="px-5 py-2.5 text-center">{getVencimientoBadge(l.fecha_vencimiento)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        onClick={() => { setEditing(l); setModalOpen(true); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LoteFormModal
        abierto={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
        lote={editing}
        medicamentos={medicamentos}
        insumos={insumos}
      />
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Search, Loader2, User, Stethoscope, Pill, ChevronLeft, ChevronRight } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const PER_PAGE = 8;

export default function AplicacionSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [busquedaInput, setBusquedaInput] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: PER_PAGE };
      if (busqueda) params.q = busqueda;
      const { data } = await axiosClient.get('/farmacia/recetas-aplicadas', { params });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('Error cargando recetas aplicadas:', err);
    } finally {
      setLoading(false);
    }
  }, [page, busqueda]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(busquedaInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [busquedaInput]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center ring-1 ring-violet-200/60">
            <ClipboardList className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-slate-800">Medicamentos Aplicados</h3>
            <p className="text-[11px] text-slate-400">{total} registros encontrados</p>
          </div>
        </div>
      </div>

      {/* Busqueda */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por medicamento, doctor o fecha..."
          value={busquedaInput}
          onChange={(e) => setBusquedaInput(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-[13px] rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Pill className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">No hay medicamentos aplicados</p>
            <p className="text-[11px] text-slate-400 mt-1">Los registros aparecerán cuando los médicos receten tratamientos en las consultas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Fecha</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Paciente</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Cedula</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Medicamento</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Cantidad</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Doctor</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Especialidad</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 tabular-nums text-slate-500">{formatDate(r.fecha)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-violet-50 flex items-center justify-center ring-1 ring-violet-100">
                          <User className="w-3 h-3 text-violet-500" />
                        </div>
                        <span className="font-medium text-slate-700">{r.paciente_nombre || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{r.paciente_cedula || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[12px] font-medium ring-1 ring-emerald-100">
                        <Pill className="w-3 h-3" />
                        {r.medicamento_nombre || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{r.cantidad_despachada ?? r.cantidad_prescrita ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-600">{r.medico_nombre || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{r.especialidad || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-slate-400">
          <span>{total} registros &middot; Pagina {page} de {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Pill, AlertTriangle, MinusCircle, Building2, RefreshCw } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useTheme } from '../ThemeProvider';

const getStockBadge = (actual, minimo) => {
  if (actual >= minimo * 1.5) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 text-[10px] font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />OK</span>;
  if (actual >= minimo) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-600 text-[10px] font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />Bajo</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 text-[10px] font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Critico</span>;
};

const KPI = ({ icon: Icon, label, value, tint, sub }) => (
  <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm p-4 flex items-center gap-3 hover:shadow-md hover:ring-brand-primary/30 transition-all">
    <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${tint}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="font-display font-bold text-2xl text-brand-deep tabular-nums leading-none">{value}</div>
      <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">{label}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

export default function CentroDashboard({ clinicaId = null }) {
  const { centerFullName, centerName, centerLogo } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPage(1);
    try {
      const params = clinicaId ? { clinica_id: clinicaId } : {};
      const res = await axiosClient.get('/farmacia/inventario', { params });
      setRows(res.data || []);
    } catch (err) {
      console.error('Error fetching inventario:', err);
    } finally {
      setLoading(false);
    }
  }, [clinicaId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const esVistaCentro = Boolean(clinicaId);
  const insumos = rows.filter(r => r.tipo === 'INSUMO');
  const meds = rows.filter(r => r.tipo === 'MEDICAMENTO');
  const stockInsumos = insumos.reduce((a, r) => a + (esVistaCentro ? r.stock_centro : r.stock_actual), 0);
  const stockMeds = meds.reduce((a, r) => a + (r.stock_actual || 0), 0);
  const criticos = insumos.filter(r => (esVistaCentro ? r.stock_centro : r.stock_actual) === 0);
  const bajos = insumos.filter(r => {
    const s = esVistaCentro ? r.stock_centro : r.stock_actual;
    return s > 0 && s < (r.stock_minimo ?? 0);
  });
  const alertas = [...criticos, ...bajos].sort((a, b) =>
    (esVistaCentro ? a.stock_centro - b.stock_centro : a.stock_actual - b.stock_actual)
  );
  const PER_PAGE = 6;
  const totalPages = Math.max(Math.ceil(alertas.length / PER_PAGE), 1);
  const pageAlerts = alertas.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const dateStr = new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Encabezado del centro */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm p-5 flex flex-wrap items-center gap-4">
        {centerLogo && (
          <div className="h-12 w-12 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-white flex items-center justify-center shrink-0">
            <img src={centerLogo} alt={`Logo ${centerName}`} className="h-full w-full object-contain" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-primary">Panel del centro</p>
          <h3 className="font-display font-bold text-lg text-brand-deep truncate">
            {esVistaCentro ? (centerFullName || 'Centro de salud') : 'Stock general (todos los centros)'}
          </h3>
          <p className="text-[11px] text-slate-400 capitalize">{dateStr}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 ring-1 ring-emerald-200/70">
          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[11px] font-semibold text-emerald-700">{esVistaCentro ? 'Mi centro' : 'Red completa'}</span>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-xl text-slate-400 hover:text-brand-primary hover:bg-brand-primary/5 ring-1 ring-slate-200 hover:ring-brand-primary/40 transition-all"
          title="Actualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPIs compactos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Package} label={esVistaCentro ? 'Unidades de insumos en el centro' : 'Unidades de insumos'} value={stockInsumos} tint="bg-brand-primary/10 text-brand-primary" sub={`${insumos.length} insumos activos`} />
        <KPI icon={Pill} label="Unidades de medicamentos" value={stockMeds} tint="bg-indigo-500/10 text-indigo-600" sub={`${meds.length} medicamentos activos`} />
        <KPI icon={MinusCircle} label="Sin stock en el centro" value={criticos.length} tint="bg-red-500/10 text-red-600" sub="insumos en 0" />
        <KPI icon={AlertTriangle} label="Por debajo del minimo" value={bajos.length} tint="bg-yellow-500/10 text-yellow-600" sub="sin llegar a 0" />
      </div>

      {/* Alertas del centro */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/70 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <h4 className="font-display font-bold text-sm text-brand-deep">Alertas de inventario del centro</h4>
        </div>
        {alertas.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Sin alertas: todos los insumos tienen cobertura adecuada.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pageAlerts.map((r, i) => {
              const stock = esVistaCentro ? r.stock_centro : r.stock_actual;
              const minimo = r.stock_minimo ?? 0;
              const ratio = minimo > 0 ? Math.min(stock / minimo, 1) : 0;
              const barColor = stock === 0 ? 'bg-red-500' : ratio < 0.5 ? 'bg-yellow-500' : 'bg-green-500';
              return (
                <li key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.nombre}</p>
                      {getStockBadge(stock, minimo)}
                    </div>
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.max(stock === 0 ? 4 : ratio * 100, 4)}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-sm text-brand-deep tabular-nums">{stock} <span className="text-slate-400 font-medium">/ {minimo}</span></p>
                    <p className="text-[10px] text-slate-400">stock / minimo</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {alertas.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200/70 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400 font-medium">
              {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} &middot; pagina {page} de {totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  aria-current={page === n ? 'page' : undefined}
                  className={`h-7 w-7 rounded-lg text-xs font-semibold transition-all ${
                    page === n
                      ? 'bg-brand-primary text-white shadow-sm shadow-brand-primary/30'
                      : 'text-slate-500 bg-slate-50 ring-1 ring-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
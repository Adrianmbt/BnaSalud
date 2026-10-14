import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import axiosClient from '../../api/axiosClient';
import { compartirPdf } from '../../utils/compartirPdf';

const ChartCard = ({ titulo, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
    <div className="px-2.5 py-1.5 border-b border-slate-100">
      <h3 className="text-[10px] font-semibold text-slate-600">{titulo}</h3>
    </div>
    <div className="p-2">{children}</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-lg">
      <p className="text-[9px] text-slate-500 mb-0.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[10px] font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const AlertRow = ({ item, tipo }) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
    <div className="min-w-0 flex-1">
      <p className="text-[9px] text-slate-700 truncate">{item.nombre}</p>
      <p className="text-[8px] text-slate-400">
        Stock: <span className="text-red-500 font-semibold">{item.stock_actual}</span> / Mín: {item.stock_minimo}
        {item.pct !== null && <span className="ml-1 text-amber-500">({item.pct}%)</span>}
      </p>
    </div>
    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider bg-red-50 text-red-600 ring-1 ring-red-200 rounded-full ml-2">
      {tipo === 'med' ? 'MED' : 'INS'}
    </span>
  </div>
);

const LoteRow = ({ lote, vencido }) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
    <div className="min-w-0 flex-1">
      <p className="text-[9px] text-slate-700 truncate">{lote.producto}</p>
      <p className="text-[8px] text-slate-400">
        Lote: <span className="font-mono">{lote.codigo_lote}</span> · Cant: {lote.cantidad}
      </p>
    </div>
    <p className={`shrink-0 text-[8px] font-semibold ml-2 ${vencido ? 'text-red-500' : 'text-amber-500'}`}>
      {lote.fecha_vencimiento}
    </p>
  </div>
);

export default function InventoryKpiTab({ selectedCentro }) {
  const [inventario, setInventario] = useState(null);
  const [compras, setCompras] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [invRes, compRes] = await Promise.all([
        axiosClient.get('/dashboard/inventario'),
        axiosClient.get('/dashboard/compras-inventario'),
      ]);
      setInventario(invRes.data);
      setCompras(compRes.data);
    } catch {
      setInventario(null);
      setCompras(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const exportarPDF = useCallback(async () => {
    if (!compras?.orden_compra_sugerida?.length) return;
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Orden de Compra Sugerida — BnaSalud', 15, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-VE')}`, 15, 22);

    const cols = ['#', 'Producto', 'Tipo', 'Stock Actual', 'Stock Mínimo', 'Cantidad Sugerida'];
    const rows = compras.orden_compra_sugerida.map((item, i) => [
      i + 1,
      item.nombre,
      item.tipo === 'medicamento' ? 'Medicamento' : 'Insumo',
      item.stock_actual,
      item.stock_minimo,
      item.cantidad_sugerida,
    ]);

    let y = 30;
    const colWidths = [10, 75, 30, 30, 30, 40];
    doc.setFillColor(26, 75, 124);
    doc.rect(15, y, colWidths.reduce((a, b) => a + b, 0), 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = 17;
    cols.forEach((col, i) => {
      doc.text(col, x, y + 5.5);
      x += colWidths[i];
    });

    y += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    rows.forEach((row) => {
      if (y > 190) { doc.addPage(); y = 15; }
      x = 17;
      row.forEach((cell, i) => {
        doc.text(String(cell).slice(0, 35), x, y + 5);
        x += colWidths[i];
      });
      y += 7;
    });

    await compartirPdf(doc, 'orden_compra_bnasalud.pdf');
  }, [compras]);

  if (cargando) return (
    <div className="py-10 text-center" role="status" aria-label="Cargando datos de inventario">
      <Loader2 className="w-4 h-4 mx-auto animate-spin text-brand-primary" />
      <span className="sr-only">Cargando...</span>
    </div>
  );

  const inv = inventario || {};
  const comp = compras || {};

  // Top insumos aplicados
  const topInsumos = (inv.meds_aplicados || []).slice(0, 8).map((m) => ({
    name: m.nombre?.length > 22 ? m.nombre.slice(0, 22) + '…' : m.nombre,
    cantidad: parseInt(m.total_cantidad) || 0,
  }));

  // Movimientos 30d
  const movData = (inv.movimientos_30d || []).map((m) => ({
    name: m.tipo,
    cantidad: parseInt(m.total_cantidad) || 0,
  }));

  // Riesgo vencimiento
  const riesgo = comp.valor_riesgo_vencimiento || {};

  return (
    <div className="space-y-2" role="region" aria-label="Gráficos de inventario">
      {/* Fila 1: Top Insumos + Movimientos 30d */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <ChartCard titulo="Top Insumos Más Aplicados">
          {topInsumos.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={topInsumos} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={8} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={8} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="cantidad" name="Unidades" radius={[0, 3, 3, 0]} aria-label="Unidades aplicadas">
                  {topInsumos.map((_, i) => (
                    <Cell key={i} fill={['#3B98D4', '#38B000', '#F59E0B', '#8B5CF6', '#06B6D4'][i % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-400 text-[9px] py-6">Sin datos de consumo</p>
          )}
        </ChartCard>

        <ChartCard titulo="Movimientos — Últimos 30 Días">
          {movData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={movData} margin={{ bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="cantidad" name="Cantidad" radius={[3, 3, 0, 0]} aria-label="Cantidad de movimientos">
                  {movData.map((entry, i) => (
                    <Cell key={i} fill={entry.name === 'ENTRADA' ? '#38B000' : entry.name === 'SALIDA' ? '#EF4444' : '#F59E0B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-400 text-[9px] py-6">Sin movimientos</p>
          )}
        </ChartCard>
      </div>

      {/* Fila 2: Alertas Stock + Vencimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <ChartCard titulo="Alertas de Stock Bajo">
          <div className="max-h-[130px] overflow-y-auto space-y-0">
            {inv.medicamentos_stock_bajo?.length > 0 ? (
              inv.medicamentos_stock_bajo.slice(0, 6).map((item) => <AlertRow key={`med-${item.id}`} item={item} tipo="med" />)
            ) : inv.insumos_stock_bajo?.length > 0 ? (
              inv.insumos_stock_bajo.slice(0, 6).map((item) => <AlertRow key={`ins-${item.id}`} item={item} tipo="ins" />)
            ) : (
              <p className="text-center text-slate-400 text-[9px] py-6">Stock suficiente</p>
            )}
          </div>
        </ChartCard>

        <ChartCard titulo="Lotes Próximos a Vencer">
          <div className="max-h-[130px] overflow-y-auto space-y-0">
            {inv.lotes_por_vencer?.length > 0 ? (
              inv.lotes_por_vencer.slice(0, 6).map((l) => <LoteRow key={`lpv-${l.id}`} lote={l} vencido={false} />)
            ) : inv.lotes_vencidos?.length > 0 ? (
              inv.lotes_vencidos.slice(0, 6).map((l) => <LoteRow key={`lv-${l.id}`} lote={l} vencido={true} />)
            ) : (
              <p className="text-center text-slate-400 text-[9px] py-6">Sin lotes por vencer</p>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Fila 3: Riesgo Vencimiento */}
      <ChartCard titulo="Riesgo de Vencimiento">
        <div className="grid grid-cols-3 gap-3 py-2">
          {[
            { label: '30 días', value: riesgo.dias_30 || 0, color: '#EF4444', bg: 'bg-red-50' },
            { label: '60 días', value: riesgo.dias_60 || 0, color: '#F59E0B', bg: 'bg-amber-50' },
            { label: '90 días', value: riesgo.dias_90 || 0, color: '#3B98D4', bg: 'bg-blue-50' },
          ].map((r, i) => (
            <div key={i} className={`${r.bg} rounded-lg py-2 text-center`}>
              <p className="text-base font-bold" style={{ color: r.color }}>{r.value}</p>
              <p className="text-[8px] text-slate-500">uds — {r.label}</p>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Fila 4: Orden de Compra Sugerida */}
      <ChartCard titulo="Orden de Compra Sugerida">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[8px] text-slate-400">
            {comp.orden_compra_sugerida?.length || 0} productos requieren reposición
          </p>
          <button
            onClick={exportarPDF}
            disabled={!comp.orden_compra_sugerida?.length}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-semibold text-white bg-brand-primary rounded-md hover:bg-brand-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Exportar orden de compra a PDF"
          >
            <Download className="w-2.5 h-2.5" />
            PDF
          </button>
        </div>
        <div className="max-h-[160px] overflow-y-auto">
          {comp.orden_compra_sugerida?.length > 0 ? (
            <table className="w-full text-left" role="table">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-[7px] font-bold uppercase tracking-wider text-slate-500 py-1 px-1.5">Producto</th>
                  <th className="text-[7px] font-bold uppercase tracking-wider text-slate-500 py-1 px-1.5">Tipo</th>
                  <th className="text-[7px] font-bold uppercase tracking-wider text-slate-500 py-1 px-1.5 text-right">Stock</th>
                  <th className="text-[7px] font-bold uppercase tracking-wider text-slate-500 py-1 px-1.5 text-right">Mínimo</th>
                  <th className="text-[7px] font-bold uppercase tracking-wider text-slate-500 py-1 px-1.5 text-right">Sugerido</th>
                </tr>
              </thead>
              <tbody>
                {comp.orden_compra_sugerida.slice(0, 10).map((item, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="text-[9px] text-slate-700 py-1 px-1.5 truncate max-w-[160px]">{item.nombre}</td>
                    <td className="py-1 px-1.5">
                      <span className={`inline-flex items-center px-1 py-0.5 text-[6px] font-bold uppercase rounded-full ${
                        item.tipo === 'medicamento' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {item.tipo === 'medicamento' ? 'MED' : 'INS'}
                      </span>
                    </td>
                    <td className="text-[9px] text-slate-600 py-1 px-1.5 text-right font-semibold">{item.stock_actual}</td>
                    <td className="text-[9px] text-slate-600 py-1 px-1.5 text-right">{item.stock_minimo}</td>
                    <td className="text-[9px] text-red-600 py-1 px-1.5 text-right font-bold">{item.cantidad_sugerida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-slate-400 text-[9px] py-6">No hay productos por debajo del mínimo</p>
          )}
        </div>
      </ChartCard>
    </div>
  );
}

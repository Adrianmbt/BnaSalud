import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import axiosClient from '../../api/axiosClient';

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

// Funnel compacto de eficiencia
const FunnelCompacto = ({ data }) => {
  if (!data || data.length === 0) return <p className="text-center text-slate-400 text-[9px] py-4">Sin datos</p>;

  const fin = data.find((e) => e.estado === 'FINALIZADO')?.total || 0;
  const canc = data.find((e) => e.estado === 'CANCELADO')?.total || 0;
  const noAs = data.find((e) => e.estado === 'NO_ASISTIO')?.total || 0;
  const total = fin + canc + noAs;

  if (total === 0) return <p className="text-center text-slate-400 text-[9px] py-4">Sin datos</p>;

  const steps = [
    { label: 'Atendidos', value: fin, color: '#38B000', pct: ((fin / total) * 100).toFixed(1) },
    { label: 'Cancelados', value: canc, color: '#F59E0B', pct: ((canc / total) * 100).toFixed(1) },
    { label: 'No Asistió', value: noAs, color: '#EF4444', pct: ((noAs / total) * 100).toFixed(1) },
  ];

  return (
    <div className="space-y-1.5 py-1">
      {steps.map((step, i) => {
        const widthPct = Math.max((step.value / total) * 100, 8);
        return (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[8px] text-slate-500 w-14 text-right truncate">{step.label}</span>
            <div className="flex-1 relative h-4 rounded overflow-hidden" style={{ backgroundColor: '#f1f5f9' }}>
              <div
                className="absolute inset-y-0 left-0 rounded transition-all duration-500"
                style={{ width: `${widthPct}%`, backgroundColor: step.color }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold text-slate-700 z-10">
                {step.value} ({step.pct}%)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function PatientKpiTab({ selectedCentro }) {
  const [data, setData] = useState(null);
  const [servicios, setServicios] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = {};
      if (selectedCentro && selectedCentro !== 'general') {
        params.centro = selectedCentro;
      }
      const [pacRes, servRes] = await Promise.all([
        axiosClient.get('/dashboard/pacientes', { params }),
        axiosClient.get('/dashboard/servicios-centros', { params: { centro_id: selectedCentro || 'general' } }),
      ]);
      setData(pacRes.data);
      setServicios(servRes.data);
    } catch {
      setData(null);
      setServicios(null);
    } finally {
      setCargando(false);
    }
  }, [selectedCentro]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return (
    <div className="py-10 text-center" role="status" aria-label="Cargando datos de pacientes">
      <Loader2 className="w-4 h-4 mx-auto animate-spin text-brand-primary" />
      <span className="sr-only">Cargando...</span>
    </div>
  );

  const d = data || {};
  const s = servicios || {};

  // Datos para barras de ruta
  const rutaData = (d.por_ruta || []).map((r) => ({ name: r.ruta, total: r.total }));

  // Datos para barras por clínica
  const clinicaData = (d.por_clinica || []).map((c) => ({ name: c.clinica, total: c.total }));

  // Resumen eficiencia
  const ef = d.eficiencia_asistencia || [];
  const fin = ef.find((e) => e.estado === 'FINALIZADO')?.total || 0;
  const noAs = ef.find((e) => e.estado === 'NO_ASISTIO')?.total || 0;
  const canc = ef.find((e) => e.estado === 'CANCELADO')?.total || 0;
  const totalEf = fin + noAs + canc;
  const tasaAsist = totalEf > 0 ? ((fin / totalEf) * 100).toFixed(1) : '0';
  const tasaNoShow = totalEf > 0 ? ((noAs / totalEf) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-2" role="region" aria-label="Gráficos de pacientes y flujo">
      {/* Fila 1: Ruta + Eficiencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <ChartCard titulo="Ruta de Atención">
          {rutaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={rutaData} margin={{ bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Pacientes" radius={[3, 3, 0, 0]} aria-label="Pacientes por ruta">
                  {rutaData.map((entry, i) => (
                    <Cell key={i} fill={entry.name === 'EMERGENCIA' ? '#EF4444' : '#3B98D4'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-400 text-[9px] py-4">Sin datos</p>
          )}
        </ChartCard>

        <ChartCard titulo="Eficiencia de Asistencia">
          <FunnelCompacto data={d.eficiencia_asistencia} />
        </ChartCard>
      </div>

      {/* Fila 2: Por Clínica + Resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <ChartCard titulo="Pacientes por Clínica">
          {clinicaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={clinicaData} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={8} width={70} tickFormatter={(v) => v?.length > 10 ? v.slice(0, 10) + '…' : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Pacientes" fill="#3B98D4" radius={[0, 3, 3, 0]} aria-label="Pacientes por clínica" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-400 text-[9px] py-4">Sin datos</p>
          )}
        </ChartCard>

        {/* Resumen compacto */}
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <p className="text-[10px] font-semibold text-slate-600 mb-2">Resumen de Eficiencia</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 rounded-lg py-1.5">
              <p className="text-sm font-bold text-emerald-600">{tasaAsist}%</p>
              <p className="text-[8px] text-slate-500">Asistencia</p>
            </div>
            <div className="bg-amber-50 rounded-lg py-1.5">
              <p className="text-sm font-bold text-amber-600">{canc}</p>
              <p className="text-[8px] text-slate-500">Cancelados</p>
            </div>
            <div className="bg-red-50 rounded-lg py-1.5">
              <p className="text-sm font-bold text-red-600">{tasaNoShow}%</p>
              <p className="text-[8px] text-slate-500">No-Show</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

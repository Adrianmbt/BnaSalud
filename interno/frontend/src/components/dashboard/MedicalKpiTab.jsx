import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import axiosClient from '../../api/axiosClient';

const COLORS = ['#3B98D4', '#1A4B7C', '#38B000', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899'];

const ChartCard = ({ titulo, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
    <div className="px-3 py-2 border-b border-slate-100">
      <h3 className="text-[11px] font-semibold text-slate-600">{titulo}</h3>
    </div>
    <div className="p-3">{children}</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-lg">
      <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[11px] font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={600}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

// Truncar texto largo para motivos de consulta
const truncate = (text, max = 40) => {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
};

export default function MedicalKpiTab({ selectedCentro }) {
  const [medicos, setMedicos] = useState(null);
  const [servicios, setServicios] = useState(null);
  const [cargando, setCargando] = useState(true);

  const esGeneral = !selectedCentro || selectedCentro === 'general';

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = {};
      if (selectedCentro && selectedCentro !== 'general') {
        params.centro = selectedCentro;
      }
      const [medRes, servRes] = await Promise.all([
        axiosClient.get('/dashboard/medicos', { params }),
        axiosClient.get('/dashboard/servicios-centros', { params: { centro_id: selectedCentro || 'general' } }),
      ]);
      setMedicos(medRes.data);
      setServicios(servRes.data);
    } catch {
      setMedicos(null);
      setServicios(null);
    } finally {
      setCargando(false);
    }
  }, [selectedCentro]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return (
    <div className="py-12 text-center" role="status" aria-label="Cargando datos médicos">
      <Loader2 className="w-4 h-4 mx-auto animate-spin text-brand-primary" />
      <span className="sr-only">Cargando...</span>
    </div>
  );

  const m = medicos || {};
  const s = servicios || {};

  // Datos para donut de especialidad
  const especialidadData = (m.por_especialidad || []).map((d) => ({
    name: d.especialidad,
    value: d.total,
  }));

  // Datos para tasa de remisión por especialidad (barras)
  const remisionEspData = (m.remision_por_especialidad || []).map((d) => ({
    name: d.especialidad,
    consultas: d.total_consultas,
    remitidos: d.remitidos,
    tasa: parseFloat(d.tasa_remision) || 0,
  }));

  // Datos para motivos de consulta (top 5 por centro)
  const motivosData = (s.top_motivos_por_centro || []).map((d) => ({
    motivo: truncate(d.motivo, 35),
    total: d.total,
  }));

  // Datos para pacientes por tipo (donut)
  const cobertura = s.cobertura_por_centro || [];
  const totalTrabajadores = cobertura.reduce((acc, c) => acc + (c.trabajadores || 0), 0);
  const totalBeneficiarios = cobertura.reduce((acc, c) => acc + (c.beneficiarios || 0), 0);
  const totalPublico = cobertura.reduce((acc, c) => acc + (c.publico_general || 0), 0);
  const pacientesTipoData = [
    { name: 'Trabajadores', value: totalTrabajadores },
    { name: 'Beneficiarios', value: totalBeneficiarios },
    { name: 'Público General', value: totalPublico },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-3" role="region" aria-label="Gráficos de rendimiento médico">
      {esGeneral ? (
        /* ═══ VISTA GENERAL ═══ */
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Consultas por Especialidad (donut) */}
            <ChartCard titulo="Consultas por Especialidad">
              {especialidadData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={especialidadData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={3}
                      label={CustomPieLabel}
                      aria-label="Distribución por especialidad"
                    >
                      {especialidadData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      formatter={(value) => value?.length > 15 ? value.slice(0, 15) + '…' : value}
                      wrapperStyle={{ fontSize: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 text-[10px] py-8">Sin datos</p>
              )}
            </ChartCard>

            {/* Tasa de Remisión por Especialidad (barras) */}
            <ChartCard titulo="Tasa de Remisión por Especialidad">
              {remisionEspData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={remisionEspData} layout="vertical" margin={{ left: 5, right: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={9} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={9}
                      width={110}
                      tickFormatter={(v) => v?.length > 15 ? v.slice(0, 15) + '…' : v}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      formatter={(value, name, props) => [`${value}%`, `${props.payload.name}: ${props.payload.remitidos}/${props.payload.consultas} remitidos`]}
                    />
                    <Bar dataKey="tasa" name="Tasa %" radius={[0, 3, 3, 0]} aria-label="Tasa de remisión por especialidad">
                      {remisionEspData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 text-[10px] py-8">Sin datos</p>
              )}
            </ChartCard>

            {/* Pacientes por Tipo (donut) */}
            <ChartCard titulo="Pacientes por Tipo">
              {pacientesTipoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pacientesTipoData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={3}
                      label={CustomPieLabel}
                      aria-label="Distribución de pacientes por tipo"
                    >
                      {pacientesTipoData.map((_, i) => (
                        <Cell key={i} fill={['#3B98D4', '#38B000', '#F59E0B'][i % 3]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      formatter={(value) => value?.length > 15 ? value.slice(0, 15) + '…' : value}
                      wrapperStyle={{ fontSize: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 text-[10px] py-8">Sin datos</p>
              )}
            </ChartCard>
          </div>
        </>
      ) : (
        /* ═══ VISTA POR CENTRO ═══ */
        <>
          {/* Fila 1: 3 gráficas alineadas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Motivos de Consulta (barras top 5) */}
            <ChartCard titulo="Motivos de Consulta Más Frecuentes">
              {motivosData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={motivosData} layout="vertical" margin={{ left: 5, right: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                    <YAxis
                      type="category"
                      dataKey="motivo"
                      stroke="#94a3b8"
                      fontSize={9}
                      width={100}
                      tickFormatter={(v) => v?.length > 15 ? v.slice(0, 15) + '…' : v}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Consultas" radius={[0, 3, 3, 0]} aria-label="Consultas por motivo">
                      {motivosData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 text-[10px] py-8">Sin datos</p>
              )}
            </ChartCard>

            {/* Consultas por Especialidad (donut) */}
            <ChartCard titulo="Consultas por Especialidad">
              {especialidadData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={especialidadData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={3}
                      label={CustomPieLabel}
                      aria-label="Distribución por especialidad"
                    >
                      {especialidadData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      formatter={(value) => value?.length > 12 ? value.slice(0, 12) + '…' : value}
                      wrapperStyle={{ fontSize: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 text-[10px] py-8">Sin datos</p>
              )}
            </ChartCard>

            {/* Tasa de Remisión por Especialidad */}
            <ChartCard titulo="Tasa de Remisión por Especialidad">
              {remisionEspData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={remisionEspData} layout="vertical" margin={{ left: 5, right: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={9} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={9}
                      width={100}
                      tickFormatter={(v) => v?.length > 15 ? v.slice(0, 15) + '…' : v}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      formatter={(value, name, props) => [`${value}%`, `${props.payload.name}: ${props.payload.remitidos}/${props.payload.consultas} remitidos`]}
                    />
                    <Bar dataKey="tasa" name="Tasa %" radius={[0, 3, 3, 0]} aria-label="Tasa de remisión por especialidad">
                      {remisionEspData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 text-[10px] py-8">Sin datos</p>
              )}
            </ChartCard>
          </div>

          {/* Fila 2: Datos de médicos por centro (compactos) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Médicos activos */}
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Médicos</p>
              <p className="text-lg font-bold text-brand-primary mt-0.5">
                {s.medicos_por_centro?.[0]?.total_medicos ?? 0}
              </p>
              <p className="text-[8px] text-slate-400">Asignados al centro</p>
            </div>
            {/* Consultas por médico */}
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Consultas / Médico</p>
              <p className="text-lg font-bold text-brand-deep mt-0.5">
                {s.medicos_por_centro?.[0]?.total_medicos > 0
                  ? Math.round((s.medicos_por_centro?.[0]?.total_consultas ?? 0) / s.medicos_por_centro[0].total_medicos)
                  : 0}
              </p>
              <p className="text-[8px] text-slate-400">Promedio</p>
            </div>
            {/* Tasa de Remisión */}
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Tasa de Remisión</p>
              <p className="text-lg font-bold text-brand-primary mt-0.5">
                {m.tasa_remision ?? 0}%
              </p>
              <p className="text-[8px] text-slate-400">Derivados a especialista</p>
            </div>
            {/* Duración Promedio */}
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Duración Prom.</p>
              <p className="text-lg font-bold text-brand-deep mt-0.5">
                {m.duracion_promedio_min ?? 0} <span className="text-[10px] font-normal">min</span>
              </p>
              <p className="text-[8px] text-slate-400">Por consulta</p>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

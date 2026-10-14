import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarClock, Clock, Loader2, Menu, Package, Pill, TrendingDown, TrendingUp, Users } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import DirectorSidebar from '../components/dashboard/DirectorSidebar';
import MedicalKpiTab from '../components/dashboard/MedicalKpiTab';
import PatientKpiTab from '../components/dashboard/PatientKpiTab';
import InventoryKpiTab from '../components/dashboard/InventoryKpiTab';
import WhatsAppPanel from '../components/dashboard/WhatsAppPanel';
import CentroConstruccion from '../components/dashboard/CentroConstruccion';

const CENTROS_SALUD = [
  { id: 'general', label: 'General (Todas las Sedes)' },
  { id: 'citab', label: 'CITAB' },
  { id: 'clinica_mujer', label: 'Clínica Integral de la Mujer' },
  { id: 'clinica_ninos', label: 'Clínica Integral de los Niños' },
  { id: 'oncologico', label: 'Oncológico Maruja Clavier' },
  { id: 'adulto_mayor', label: 'Casa del Adulto Mayor' },
  { id: 'jornadas', label: 'Jornadas Médico Asistencial' },
];

const CENTROS_CON_DATOS = ['general', 'citab'];

function KpiCard({ icon: Icon, label, value, color, sub, trend }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    amber: 'bg-amber-50 border-amber-200 text-amber-600',
    red: 'bg-red-50 border-red-200 text-red-600',
    violet: 'bg-violet-50 border-violet-200 text-violet-600',
  };
  return (
    <div className={`${colorMap[color]} border rounded-lg px-3 py-2 flex items-center gap-2`}>
      <div className="p-1.5 rounded-md bg-white/60">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
        <p className="text-sm font-bold font-display leading-tight">{value}</p>
        {sub && <p className="text-[9px] opacity-50 leading-tight">{sub}</p>}
      </div>
      {trend != null && (
        <span className={`ml-auto text-[8px] font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
  );
}

export default function ExecutiveAdminDashboard({ userName = 'Director General', onLogout }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [activeSection, setActiveSection] = useState('medicos');
  const [selectedCentro, setSelectedCentro] = useState('general');
  const [summary, setSummary] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarSummary = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await axiosClient.get('/dashboard/summary');
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarSummary(); }, [cargarSummary]);

  const s = summary || {};
  const stockBajo = (s.meds_stock_bajo ?? 0) + (s.ins_stock_bajo ?? 0);

  const centroActual = CENTROS_SALUD.find((c) => c.id === selectedCentro);
  const tieneDatos = CENTROS_CON_DATOS.includes(selectedCentro);

  const renderSection = () => {
    if (!tieneDatos) {
      return <CentroConstruccion nombre={centroActual?.label} />;
    }

    switch (activeSection) {
      case 'medicos':
        return <MedicalKpiTab selectedCentro={selectedCentro} />;
      case 'pacientes':
        return <PatientKpiTab selectedCentro={selectedCentro} />;
      case 'inventario':
        return <InventoryKpiTab selectedCentro={selectedCentro} />;
      case 'whatsapp':
        return <WhatsAppPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-brand-surface">
      <DirectorSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        selectedCentro={selectedCentro}
        onCentroChange={setSelectedCentro}
        userName={userName}
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={sidebarAbierto}
        onCloseMobile={() => setSidebarAbierto(false)}
      />

      <div
        className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        }`}
      >
        {/* Header with KPIs */}
        <header className="safe-top bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30" role="banner">
          <div className="px-4 sm:px-6 py-2.5 safe-x">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setSidebarAbierto(true)}
                  className="lg:hidden tap-target -ml-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                  aria-label="Abrir menu"
                  aria-expanded={sidebarAbierto}
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="font-display font-bold text-sm text-brand-deep leading-tight">
                    Dashboard Ejecutivo
                  </h1>
                  <p className="text-[10px] text-slate-500 truncate">
                    {centroActual?.label} · Panel de Control en Tiempo Real
                  </p>
                </div>
              </div>
              <button
                onClick={cargarSummary}
                className="tap-target shrink-0 px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:text-brand-primary bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:ring-offset-2"
                aria-label="Actualizar datos del dashboard"
              >
                Actualizar
              </button>
            </div>

            {cargando ? (
              <div className="flex items-center justify-center py-4" role="status" aria-label="Cargando datos">
                <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
                <span className="sr-only">Cargando...</span>
              </div>
            ) : (
              <div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
                role="region"
                aria-label="Indicadores principales"
              >
                <KpiCard icon={Activity} label="Consultas Hoy" value={s.consultas_hoy ?? 0} color="blue" sub={`promedio: ${s.promedio_diario_mes ?? 0}/día`} trend={s.variacion_vs_promedio_diario ?? 0} />
                <KpiCard icon={Users} label="Total Atendidos" value={s.total_atenciones_mes ?? 0} color="emerald" sub={`${s.variacion_atenciones_pct ?? 0}% vs mes anterior`} trend={s.variacion_atenciones_pct ?? 0} />
                <KpiCard icon={Pill} label="Stock Bajo" value={stockBajo} color="amber" sub={`${s.meds_stock_bajo ?? 0} meds · ${s.ins_stock_bajo ?? 0} ins`} />
                <KpiCard icon={CalendarClock} label="Lotes por Vencer" value={s.lotes_por_vencer ?? 0} color="red" sub="próximos 30 días" />
                <KpiCard icon={Package} label="Días Autonomía" value={`${s.dias_autonomia_inventario_promedio ?? 0} días`} color="violet" sub="inventario promedio" />
                <KpiCard icon={TrendingDown} label="Insumos Críticos" value={`${s.porcentaje_insumos_criticos ?? 0}%`} color="red" sub="por debajo del mínimo" />
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 sm:px-6 py-6" role="main" aria-label={`Sección: ${activeSection}`}>
          <div className="animate-fade-in">
            {renderSection()}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white/80 backdrop-blur-sm" role="contentinfo">
          <div className="px-4 sm:px-6 py-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>BnaSalud CITAB · Dashboard Ejecutivo v2.0</span>
            <span>Zona horaria: America/Caracas</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

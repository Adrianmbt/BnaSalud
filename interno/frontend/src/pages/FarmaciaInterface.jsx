import React, { useState } from 'react';
import { Menu, Clock } from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';
import FarmaciaSidebar from '../components/farmacia/FarmaciaSidebar';
import CentroDashboard from '../components/farmacia/CentroDashboard';
import MedicamentosSection from '../components/farmacia/MedicamentosSection';
import InsumosSection from '../components/farmacia/InsumosSection';
import AplicacionSection from '../components/farmacia/AplicacionSection';

const SECTIONS = {
  dashboard: { title: 'Panel del Centro', subtitle: 'Resumen de inventario del centro' },
  medicamentos: { title: 'Medicamentos', subtitle: 'Catalogo de medicamentos' },
  insumos: { title: 'Insumos', subtitle: 'Catalogo de insumos medicos' },
  aplicacion: { title: 'Aplicacion', subtitle: 'Medicamentos aplicados a pacientes' },
};

const SECTION_COMPONENTS = {
  dashboard: CentroDashboard,
  medicamentos: MedicamentosSection,
  insumos: InsumosSection,
  aplicacion: AplicacionSection,
};

export default function FarmaciaInterface({ userName = 'Farmaceutico', clinicaNombre = '', clinicaId = null, onLogout }) {
  const { centerFullName, centerLogo, centerName } = useTheme();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  const [now] = useState(new Date());
  const dateStr = now.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen flex bg-brand-surface">
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>

      <FarmaciaSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        userName={userName}
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={sidebarAbierto}
        onCloseMobile={() => setSidebarAbierto(false)}
      />

      <div className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
      }`}>
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 safe-top bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
          <div className="flex items-center justify-between gap-4 px-5 sm:px-8 py-3 safe-x">
            <button
              onClick={() => setSidebarAbierto(true)}
              className="lg:hidden tap-target -ml-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Abrir menu"
              aria-expanded={sidebarAbierto}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 flex-1 min-w-0">
              {centerLogo && (
                <div className="h-8 w-8 rounded-lg overflow-hidden ring-1 ring-slate-200 bg-white flex items-center justify-center shrink-0">
                  <img src={centerLogo} alt={`Logo ${centerName}`} className="h-full w-full object-contain" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="font-display font-bold text-base sm:text-lg text-brand-deep tracking-tight truncate">
                  {SECTIONS[activeSection].title}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium hidden sm:block truncate">
                  {centerFullName || 'Farmacia'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-right">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <div>
                  <span className="font-display font-semibold text-sm tabular-nums text-slate-700 block leading-tight">{timeStr}</span>
                  <span className="text-[10px] text-slate-400 capitalize block leading-tight">{dateStr}</span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 ring-1 ring-emerald-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                <span className="text-[10px] font-semibold text-emerald-700">En linea</span>
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main id="main-content" className="flex-1 px-5 sm:px-8 py-5">
          <div className="animate-fade-in" key={activeSection}>
            {React.createElement(SECTION_COMPONENTS[activeSection], { clinicaId })}
          </div>
        </main>

        {/* FOOTER */}
        <footer className="border-t border-slate-200/60 bg-white/50 backdrop-blur-sm">
          <div className="px-5 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md overflow-hidden ring-1 ring-slate-200 bg-white flex items-center justify-center shrink-0">
                <img src="/instituto-salud.jpeg" alt="Logo del Instituto de Salud" className="h-full w-full object-contain" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                Instituto de Salud &middot; Gobierno de Anzoategui &middot; Barcelona
              </span>
            </div>
            <span className="text-[10px] text-slate-300">
              &copy; {new Date().getFullYear()} BnaSalud &mdash; {centerFullName || 'Red de Salud'}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

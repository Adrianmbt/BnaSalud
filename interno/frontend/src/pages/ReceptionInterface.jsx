import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, X, CheckCircle2, Menu, Clock } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { useTheme } from '../components/ThemeProvider';
import ReceptionSidebar from '../components/reception/ReceptionSidebar';
import ReceptionDashboard from '../components/reception/ReceptionDashboard';
import ReceptionCola from '../components/reception/ReceptionCola';
import GuardiaPanel from '../components/GuardiaPanel';

export default function ReceptionInterface({ userName = 'Recepcionista', clinicaId: clinicaIdProp, clinicaNombre = '', onLogout }) {
  const { centerFullName, centerLogo, centerName } = useTheme();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  const [queue, setQueue] = useState({ recepcion: [], triaje: [], espera: [], consulta: [], finalizado: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(new Date());
  const [clinicaId] = useState(clinicaIdProp || null);
  const [guardiasActivas, setGuardiasActivas] = useState([]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (clinicaId) params.clinica_id = clinicaId;
      const { data } = await axiosClient.get('/cola', { params });
      setQueue({
        recepcion: data.recepcion || [],
        triaje: data.triaje || [],
        espera: data.espera || [],
        consulta: data.consulta || [],
        finalizado: data.finalizado || [],
      });
    } catch {
      setError('No se pudo conectar con el servidor de cola.');
    } finally {
      setLoading(false);
    }
  }, [clinicaId]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const SECTIONS = {
    dashboard: { title: 'Dashboard', subtitle: 'Vista general del sistema de atencion' },
    guardias: { title: 'Guardias de Emergencia', subtitle: 'Gestion de turnos para medicos de emergencia' },
    cola: { title: 'Cola de Pacientes', subtitle: 'Registro y seguimiento de pacientes en tiempo real' },
  };

  return (
    <div className="min-h-screen flex bg-brand-surface overflow-x-clip">
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>

      {/* SIDEBAR */}
      <ReceptionSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        userName={userName}
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={sidebarAbierto}
        onCloseMobile={() => setSidebarAbierto(false)}
      />

      {/* MAIN CONTENT */}
      {/* min-w-0: sin esto flex-1 no baja del min-content de los hijos y la pagina
          scrollea en horizontal. overflow-x-clip evita que algo se escape sin
          romper el header sticky (a diferencia de overflow-hidden). */}
      <div className={`flex-1 min-w-0 flex flex-col min-h-screen overflow-x-clip transition-[margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
      }`}>
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 safe-top bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
          <div className="flex items-center justify-between gap-3 px-3 sm:px-8 py-3 safe-x">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarAbierto(true)}
              className="lg:hidden ml-1 shrink-0 inline-flex items-center justify-center h-12 w-12 rounded-xl text-brand-deep bg-brand-deep/10 ring-1 ring-brand-deep/15 active:bg-brand-deep/20 transition-colors"
              aria-label="Abrir menu"
              aria-expanded={sidebarAbierto}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Section title */}
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
                  {centerFullName || 'Recepción'}
                </p>
              </div>
            </div>

            {/* Clock + Status */}
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
        <main id="main-content" className="flex-1 px-3 sm:px-8 py-4 sm:py-5">
          {/* Alerts */}
          <div role="alert" aria-live="polite">
            {error && (
              <div className="animate-fade-up flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3.5 py-2.5 text-[13px] mb-4 shadow-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
                <button className="ml-auto text-rose-400 hover:text-rose-600" onClick={() => setError('')} aria-label="Cerrar aviso">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {success && (
              <div className="animate-fade-up flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-brand-success px-3.5 py-2.5 text-[13px] mb-4 shadow-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
                <button className="ml-auto text-emerald-500 hover:text-emerald-700" onClick={() => setSuccess('')} aria-label="Cerrar aviso">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Section content with fade transition */}
          <div className="animate-fade-in" key={activeSection}>
            {activeSection === 'dashboard' && (
              <ReceptionDashboard queue={queue} />
            )}

            {activeSection === 'guardias' && (
              <GuardiaPanel clinicaId={clinicaId} onGuardiasActualizadas={setGuardiasActivas} />
            )}

            {activeSection === 'cola' && (
              <ReceptionCola
                queue={queue}
                fetchQueue={fetchQueue}
                clinicaId={clinicaId}
                loading={loading}
                setLoading={setLoading}
                error={error}
                setError={setError}
                success={success}
                setSuccess={setSuccess}
              />
            )}
          </div>
        </main>

        {/* FOOTER */}
        <footer className="border-t border-slate-200/60 bg-white/50 backdrop-blur-sm">
          <div className="px-3 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-8 rounded-md overflow-hidden ring-1 ring-slate-200 bg-white flex items-center justify-center shrink-0">
                <img src="/identidad/InstitutoSalud.jpeg" alt="Logo del Instituto de Salud" className="h-full w-full object-contain" />
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

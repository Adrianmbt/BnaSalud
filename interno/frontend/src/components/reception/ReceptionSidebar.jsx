import React from 'react';
import { LayoutDashboard, ShieldCheck, Users, LogOut, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTheme } from '../ThemeProvider';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'guardias', label: 'Guardias', icon: ShieldCheck },
  { id: 'cola', label: 'Cola de Pacientes', icon: Users },
];

export default function ReceptionSidebar({ activeSection, onSectionChange, userName, onLogout, collapsed, mobileOpen, onToggleCollapse, onCloseMobile }) {
  const { centerLogo, centerName, centerFullName, isGlobal } = useTheme();
  const logoSrc = centerLogo || '/identidad/InstitutoSalud.jpeg';
  const logoAlt = centerName || 'Instituto de Salud';
  const subtitle = isGlobal ? 'CITAB Sistema' : centerFullName || centerName;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* ponytail: en movil el drawer es siempre rail de 72px (solo iconos) y se cierra con X o
          tocando el overlay. El ancho completo se reserva a lg+ para no comer pantalla. */}
      <aside
        className={`
          fixed top-0 left-0 h-screen z-50 flex flex-col safe-top safe-bottom safe-x
          transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          w-[72px] ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'}
          ${mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
          lg:translate-x-0
        `}
        style={{
          background: 'linear-gradient(180deg, #0d1b2a 0%, #0f2333 40%, #122a3d 100%)',
        }}
      >
        {/* Noise overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 opacity-80" />

        {/* Close (solo movil) */}
        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            aria-label="Cerrar menú"
            className="lg:hidden absolute top-2 right-1.5 z-10 h-11 w-11 flex items-center justify-center rounded-xl text-white/60 active:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Logo */}
        <div className={`relative flex items-center gap-2.5 pt-5 pb-4 max-lg:justify-center max-lg:px-2 ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
          <div className="h-10 w-10 rounded-lg overflow-hidden ring-1 ring-white/15 bg-white flex items-center justify-center shrink-0 shadow-lg">
            <img src={logoSrc} alt={logoAlt} className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="hidden lg:block leading-tight overflow-hidden min-w-0">
              <h1 className="font-display font-bold text-[13px] text-white tracking-tight whitespace-nowrap">Recepcion</h1>
              <p className="text-[9px] text-emerald-300/70 uppercase tracking-[0.15em] font-semibold truncate" title={subtitle}>
                {subtitle}
              </p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-white/[0.07]" />

        {/* Nav */}
        <nav className="relative flex-1 px-2 lg:px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Secciones principales">
          {!collapsed && (
            <p className="hidden lg:block px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
              Secciones
            </p>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onSectionChange(item.id); onCloseMobile(); }}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  group relative flex items-center gap-3 w-full min-h-11 min-w-11 rounded-xl
                  transition-colors duration-200 ease-out
                  max-lg:justify-center max-lg:w-11 max-lg:mx-auto max-lg:px-0 max-lg:py-3
                  ${collapsed ? 'justify-center px-0 py-3 mx-auto w-11' : 'px-3 py-2.5'}
                  ${isActive
                    ? 'bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_-6px_rgba(16,185,129,0.25)]'
                    : 'text-white/50 active:bg-white/10 hover:text-white/80 hover:bg-white/[0.04]'
                  }
                `}
              >
                {/* Active indicator pill */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                )}
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 transition-colors duration-200 ${
                    isActive ? 'text-emerald-400' : 'text-white/40 group-hover:text-white/70'
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className="hidden lg:block text-[13px] font-semibold tracking-wide whitespace-nowrap overflow-hidden">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="relative px-2 lg:px-3 pb-4 space-y-2">
          {/* Collapse toggle - desktop only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-full py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors duration-200"
            title={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
            aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Divider */}
          <div className="mx-1 h-px bg-white/[0.07]" />

          {/* User + Logout */}
          <div className={`flex items-center gap-2.5 max-lg:flex-col max-lg:gap-1 ${collapsed ? 'justify-center' : 'lg:px-2'}`}>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20 flex items-center justify-center font-display font-bold text-[11px] text-emerald-300 uppercase shrink-0">
              {userName?.trim()?.charAt(0) || 'R'}
            </div>
            {!collapsed && (
              <div className="hidden lg:block flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white/80 truncate">{userName}</p>
                <p className="text-[10px] text-white/35">Recepcionista</p>
              </div>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-white/40 active:bg-rose-500/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors duration-200 shrink-0"
                title="Cerrar sesion"
                aria-label="Cerrar sesion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
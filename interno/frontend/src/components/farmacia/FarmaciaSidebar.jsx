import React from 'react';
import { LayoutDashboard, Pill, Package, ClipboardList, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Panel del Centro', icon: LayoutDashboard },
  { id: 'medicamentos', label: 'Medicamentos', icon: Pill },
  { id: 'insumos', label: 'Insumos', icon: Package },
  { id: 'aplicacion', label: 'Aplicacion', icon: ClipboardList },
];

export default function FarmaciaSidebar({ activeSection, onSectionChange, userName, onLogout, collapsed, mobileOpen, onToggleCollapse, onCloseMobile }) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-screen z-50 flex flex-col safe-top safe-bottom safe-x
          transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${collapsed ? 'w-[72px]' : 'w-64'}
          max-lg:${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
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

        {/* Logo */}
        <div className={`relative flex items-center gap-3 px-4 pt-5 pb-4 ${collapsed ? 'justify-center' : ''}`}>
          <div className="h-9 w-9 rounded-xl overflow-hidden ring-2 ring-white/10 bg-white flex items-center justify-center shrink-0 shadow-lg">
            <img src="/citab.jpeg" alt="CITAB" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="leading-tight overflow-hidden">
              <h1 className="font-display font-bold text-[13px] text-white tracking-tight whitespace-nowrap">Farmacia</h1>
              <p className="text-[9px] text-emerald-300/60 uppercase tracking-[0.2em] font-semibold">CITAB Sistema</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-white/[0.07]" />

        {/* Nav */}
        <nav className="relative flex-1 px-3 py-4 space-y-1" role="navigation" aria-label="Secciones principales">
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
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
                title={collapsed ? item.label : undefined}
                className={`
                  group relative flex items-center gap-3 w-full min-h-11 min-w-11 rounded-xl
                  transition-all duration-200 ease-out
                  ${collapsed ? 'justify-center px-0 py-3 mx-auto w-11' : 'px-3 py-2.5'}
                  ${isActive
                    ? 'bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_-6px_rgba(16,185,129,0.25)]'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                )}
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 transition-colors duration-200 ${
                    isActive ? 'text-emerald-400' : 'text-white/40 group-hover:text-white/70'
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                {!collapsed && (
                  <span className="text-[13px] font-semibold tracking-wide whitespace-nowrap overflow-hidden">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="relative px-3 pb-4 space-y-2">
          {/* Collapse toggle - desktop only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-full py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-200"
            title={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div className="mx-1 h-px bg-white/[0.07]" />

          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : 'px-2'}`}>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20 flex items-center justify-center font-display font-bold text-[11px] text-emerald-300 uppercase shrink-0">
              {userName?.trim()?.charAt(0) || 'F'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white/80 truncate">{userName}</p>
                <p className="text-[10px] text-white/35">Farmaceutico</p>
              </div>
            )}
            {!collapsed && onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
                title="Cerrar sesion"
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

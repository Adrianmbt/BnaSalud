import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  LogOut,
  MessageSquare,
  Stethoscope,
  Users,
} from 'lucide-react';

const CENTROS_SALUD = [
  { id: 'general', label: 'General (Todas las Sedes)' },
  { id: 'citab', label: 'CITAB' },
  { id: 'clinica_mujer', label: 'Clínica Integral de la Mujer' },
  { id: 'clinica_ninos', label: 'Clínica Integral de los Niños' },
  { id: 'oncologico', label: 'Oncológico Maruja Clavier' },
  { id: 'adulto_mayor', label: 'Casa del Adulto Mayor' },
  { id: 'jornadas', label: 'Jornadas Médico Asistencial' },
];

const SECCIONES = [
  { id: 'medicos', label: 'Rendimiento Médico', icon: Stethoscope },
  { id: 'pacientes', label: 'Pacientes & Flujo', icon: Users },
  { id: 'inventario', label: 'Inventario & Stock', icon: Database },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
];

export default function DirectorSidebar({
  activeSection,
  onSectionChange,
  selectedCentro,
  onCentroChange,
  userName,
  onLogout,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (sectionId) => {
    setExpandedSection((prev) => (prev === sectionId ? null : sectionId));
  };

  const handleSectionClick = (sectionId) => {
    onSectionChange(sectionId);
    setExpandedSection(sectionId);
    onCloseMobile();
  };

  const handleCentroClick = (sectionId, centroId) => {
    onSectionChange(sectionId);
    onCentroChange(centroId);
    setExpandedSection(null);
    onCloseMobile();
  };

  const isActive = (sectionId, centroId) => {
    return activeSection === sectionId && selectedCentro === centroId;
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
          role="button"
          tabIndex={-1}
          aria-label="Cerrar menú lateral"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-screen z-50 flex flex-col safe-top safe-bottom safe-x
          bg-white border-r border-slate-200
          transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${collapsed ? 'w-[72px]' : 'w-64'}
          max-lg:${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
        role="navigation"
        aria-label="Menú principal"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 opacity-60" />

        {/* Logo */}
        <div className={`pt-4 pb-3 ${collapsed ? 'flex flex-col items-center px-2' : 'px-4'}`}>
          <div className="flex items-center gap-3">
            <img
              src="/instituto-salud.jpeg"
              alt="Logo Instituto de Salud"
              className="h-9 w-auto max-w-[100px] rounded-lg object-contain ring-1 ring-slate-200 shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-display font-bold text-sm text-brand-deep leading-tight truncate">
                  Panel Director
                </h1>
                <p className="text-[10px] text-slate-400 truncate">BnaSalud · Dashboard Ejecutivo</p>
              </div>
            )}
          </div>
        </div>

        <div className={`h-px bg-slate-200 ${collapsed ? 'mx-3' : 'mx-4'}`} />

        {/* Secciones con submenús */}
        <div className={`flex-1 overflow-y-auto py-3 ${collapsed ? 'px-2' : 'px-4'}`}>
          {!collapsed && (
            <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Secciones
            </p>
          )}
          <div className="space-y-0.5">
            {SECCIONES.map((sec) => {
              const Icon = sec.icon;
              const isExpanded = expandedSection === sec.id;
              const hasActiveChild = CENTROS_SALUD.some((c) => isActive(sec.id, c.id));

              return (
                <div key={sec.id}>
                  {/* Section button */}
                  <button
                    onClick={() => {
                      if (collapsed) {
                        onSectionChange(sec.id);
                        setExpandedSection(sec.id);
                      } else {
                        toggleSection(sec.id);
                      }
                    }}
                    title={collapsed ? sec.label : undefined}
                    className={`
                      group relative flex items-center gap-2.5 w-full min-h-11 min-w-11 rounded-lg transition-all duration-200
                      ${collapsed ? 'justify-center px-0 py-2.5 mx-auto w-11' : 'px-3 py-2'}
                      ${hasActiveChild
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }
                    `}
                    aria-expanded={!collapsed ? isExpanded : undefined}
                    aria-current={hasActiveChild ? 'page' : undefined}
                  >
                    {hasActiveChild && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-blue-500" />
                    )}
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        hasActiveChild
                          ? 'text-blue-600'
                          : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                      strokeWidth={hasActiveChild ? 2.2 : 1.8}
                    />
                    {!collapsed && (
                      <>
                        <span className="text-[12px] font-medium flex-1 text-left">{sec.label}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </>
                    )}
                  </button>

                  {/* Submenu */}
                  {!collapsed && isExpanded && (
                    <div
                      className="ml-4 mt-0.5 space-y-0.5 pl-3 border-l-2 border-slate-100"
                      role="menu"
                      aria-label={`Subsecciones de ${sec.label}`}
                    >
                      {CENTROS_SALUD.map((centro) => (
                        <button
                          key={centro.id}
                          onClick={() => handleCentroClick(sec.id, centro.id)}
                          className={`
                            w-full text-left px-3 py-1.5 rounded-md text-[11px] transition-all duration-150
                            ${isActive(sec.id, centro.id)
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }
                          `}
                          role="menuitem"
                          aria-current={isActive(sec.id, centro.id) ? 'page' : undefined}
                        >
                          {centro.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom */}
        <div className={`border-t border-slate-200 ${collapsed ? 'px-2 py-3' : 'px-4 py-3'}`}>
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-full py-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200 mb-2"
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
            <div
              className="h-8 w-8 rounded-lg bg-blue-50 ring-1 ring-blue-200 flex items-center justify-center font-display font-bold text-[11px] text-blue-600 uppercase shrink-0"
              aria-hidden="true"
            >
              {userName?.trim()?.charAt(0) || 'D'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-700 truncate">{userName}</p>
                <p className="text-[10px] text-slate-400">Director Ejecutivo</p>
              </div>
            )}
            {!collapsed && onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
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

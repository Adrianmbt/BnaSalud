import React from 'react';
import { useTheme } from './ThemeProvider';

/**
 * Badge que muestra la identidad del centro de salud actual.
 * Muestra logo + nombre del centro con los colores de la marca.
 *
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} showFullName - Mostrar nombre completo en vez del corto
 * @param {string} className - Clases adicionales
 */
export default function CenterBadge({ size = 'md', showFullName = false, className = '' }) {
  const { centerName, centerFullName, centerLogo, colors } = useTheme();

  const displayName = showFullName ? centerFullName : centerName;

  const sizeClasses = {
    sm: 'h-7 text-[11px] px-2 gap-1.5',
    md: 'h-9 text-xs px-3 gap-2',
    lg: 'h-11 text-sm px-4 gap-2.5',
  };

  const logoSizes = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={`inline-flex items-center rounded-xl font-bold tracking-wide ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: colors.surface,
        color: colors.primary,
        border: `1.5px solid ${colors.border}`,
      }}
    >
      {centerLogo ? (
        <img
          src={centerLogo}
          alt={centerName}
          className={`${logoSizes[size]} rounded-md object-contain`}
        />
      ) : (
        <div
          className={`${logoSizes[size]} rounded-md flex items-center justify-center text-white font-extrabold`}
          style={{ backgroundColor: colors.primary }}
        >
          {centerName?.charAt(0) || 'S'}
        </div>
      )}
      <span>{displayName}</span>
    </div>
  );
}

/**
 * Header con gradiente de identidad del centro.
 * Usa los colores del tema activo para crear un header dinámico.
 */
export function CenterHeader({ children, className = '' }) {
  const { gradient, colors, centerName, centerLogo } = useTheme();

  return (
    <header
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.via} 50%, ${gradient.to} 100%)`,
      }}
    >
      {/* Patrón de fondo decorativo */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, ${colors.accent} 0, transparent 50%), radial-gradient(circle at 80% 70%, ${colors.secondary} 0, transparent 45%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 20px)',
        }}
      />

      <div className="relative flex items-center gap-3 px-5 py-4">
        {centerLogo && (
          <img
            src={centerLogo}
            alt={centerName}
            className="h-10 w-10 rounded-lg object-contain bg-white/90 p-0.5 shadow-md"
          />
        )}
        <div className="text-white">
          <h1 className="text-lg font-extrabold tracking-tight leading-tight">
            {centerName}
          </h1>
        </div>
        <div className="ml-auto">
          {children}
        </div>
      </div>
    </header>
  );
}

/**
 * Indicador visual del centro en la esquina inferior del sidebar.
 */
export function CenterFooter() {
  const { centerName, centerTagline, colors } = useTheme();

  return (
    <div
      className="px-4 py-3 border-t text-center"
      style={{
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: colors.primary }}>
        {centerName}
      </p>
      {centerTagline && (
        <p className="text-[9px] mt-0.5" style={{ color: colors.textMuted }}>
          {centerTagline}
        </p>
      )}
    </div>
  );
}

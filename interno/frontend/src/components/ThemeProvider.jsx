import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react';
import {
  HEALTH_CENTERS_THEME,
  getThemeForCenter,
  applyThemeToDOM,
  resetThemeDOM,
} from '../config/healthCentersTheme';

const ThemeContext = createContext(null);

/**
 * ThemeProvider completo para BnaSalud Multi-Centro.
 *
 * Resuelve el tema por centro_id o centro_code, aplica CSS variables
 * dinámicamente y provee acceso al tema activo vía useTheme().
 *
 * @param {number|string|null} centerId - ID numérico del centro (ej: 13) o código (ej: 'CITAB')
 * @param {string|null} centerCode - Código del centro (ej: 'CITAB')
 * @param {object} children
 */
export function ThemeProvider({ centerId, centerCode, children }) {
  const theme = useMemo(() => {
    // Prioridad: centerCode > centerId > default
    if (centerCode) return getThemeForCenter(centerCode);
    if (centerId) return getThemeForCenter(centerId);
    return HEALTH_CENTERS_THEME.general;
  }, [centerId, centerCode]);

  // Aplicar variables CSS al DOM cuando cambia el tema
  useEffect(() => {
    applyThemeToDOM(theme);
    return () => resetThemeDOM();
  }, [theme]);

  // Valor del contexto con datos útiles para los componentes
  const value = useMemo(() => ({
    // Datos del tema
    theme,
    colors: theme.colors,
    gradient: theme.gradient,
    fonts: theme.fonts,

    // Datos del centro
    centerId,
    centerCode: theme.code || centerCode,
    centerName: theme.name,
    centerFullName: theme.fullName,
    centerTagline: theme.tagline,
    centerLogo: theme.logo,

    // Utilidades
    isGlobal: !centerId && !centerCode,
  }), [theme, centerId, centerCode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook para acceder al tema activo del centro.
 * Returns: { theme, colors, gradient, fonts, centerName, centerLogo, ... }
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback al tema general si no hay provider
    const fallback = HEALTH_CENTERS_THEME.general;
    return {
      theme: fallback,
      colors: fallback.colors,
      gradient: fallback.gradient,
      fonts: fallback.fonts,
      centerId: null,
      centerCode: 'general',
      centerName: fallback.name,
      centerFullName: fallback.fullName,
      centerTagline: fallback.tagline,
      centerLogo: fallback.logo,
      isGlobal: true,
    };
  }
  return ctx;
}

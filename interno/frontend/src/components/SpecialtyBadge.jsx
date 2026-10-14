import React from 'react';
import {
  Stethoscope,
  HeartPulse,
  Baby,
  Heart,
  HeartCrack,
  Scissors,
  Hand,
  Scan,
  Cross,
  Bug,
  Pill,
  Bone,
  Activity,
  Users,
  Droplets,
  Eye,
  Ribbon,
  Brain,
  Siren,
} from 'lucide-react';
import { getSpecialtyConfig, EMERGENCY_CONFIG } from '../config/specialties';

const ICON_MAP = {
  Stethoscope,
  HeartPulse,
  Baby,
  Heart,
  HeartCrack,
  Scissors,
  Hand,
  Scan,
  Cross,
  Bug,
  Pill,
  Bone,
  Activity,
  Users,
  Droplets,
  Eye,
  Ribbon,
  Brain,
  Siren,
};

/**
 * SpecialtyBadge �?" Icono + nombre de especialidad con color distintivo.
 * @param {boolean} light - Forzar color blanco (para fondos oscuros como headers)
* @param {boolean} ocultarTexto - Solo el icono en movil. En el header de 360px
     *   el nombre completo ("Medicina General") empuja al wordmark y lo solapa;
     *   desde `sm` hay sitio de sobra y el nombre vuelve a mostrarse.
 */
export default function SpecialtyBadge({
  specialty = '',
  isEmergency = false,
  size = 'md',
  light = false,
  className = '',
  ocultarTexto = false,
}) {
  const config = getSpecialtyConfig(specialty, isEmergency);
  const IconComponent = ICON_MAP[config.icon] || Stethoscope;

  const iconSizes = { sm: 14, md: 16, lg: 20 };
  const textSizes = { sm: 'text-[11px]', md: 'text-xs', lg: 'text-sm' };
  const color = light ? 'rgba(255,255,255,0.9)' : config.color;

  return (
    <span
      className={`items-center gap-1.5 font-semibold ${textSizes[size]} ${ocultarTexto ? 'shrink-0' : ''} ${className}`}
      style={{ color, display: 'inherit' }}
      title={ocultarTexto ? config.label : undefined}
      aria-label={ocultarTexto ? config.label : undefined}
    >
      <IconComponent size={iconSizes[size]} strokeWidth={2.5} style={{ verticalAlign: '-2px' }} />
      {ocultarTexto ? (
            <>
              <span className="hidden sm:inline">{config.label}</span>
              <span className="sr-only sm:hidden">{config.label}</span>
            </>
          ) : (
            config.label
          )}
    </span>
  );
}

/**
 * EmergencyBadge — Icono de sirena + "EMERGENCIA" con pulso.
 */
export function EmergencyBadge({ size = 'md', light = false, className = '' }) {
  const config = EMERGENCY_CONFIG;
  const iconSizes = { sm: 14, md: 16, lg: 20 };
  const textSizes = { sm: 'text-[11px]', md: 'text-xs', lg: 'text-sm' };
  const color = light ? 'rgba(255,255,255,0.9)' : config.color;

  return (
    <span
      className={`items-center gap-1.5 font-bold ${textSizes[size]} ${className}`}
      style={{ color, display: 'inherit' }}
    >
      <Siren size={iconSizes[size]} strokeWidth={2.5} className="animate-pulse-soft" style={{ verticalAlign: '-2px' }} />
      EMERGENCIA
    </span>
  );
}

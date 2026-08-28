import React from 'react';
import Icon from './Icon';

/**
 * Componente para visualizar el cupo y límite de pacientes por médico / consultorio / turno.
 * Diseñado bajo las especificaciones de capacidad máxima (10-15 pacientes por turno).
 * 
 * @param {{
 *   ocupados: number,
 *   maximo?: number,
 *   nombreTurno?: string,
 *   compacto?: boolean,
 *   mostrarAvisoUrgencia?: boolean,
 *   className?: string
 * }} props
 */
export default function CapacityIndicator({
  ocupados = 0,
  maximo = 15,
  nombreTurno = 'Turno Actual',
  compacto = false,
  mostrarAvisoUrgencia = true,
  className = '',
}) {
  const conteo = Math.max(0, Number(ocupados) || 0);
  const limite = Math.max(1, Number(maximo) || 15);
  const porcentaje = Math.min(Math.round((conteo / limite) * 100), 100);
  const disponibles = Math.max(0, limite - conteo);

  const esLleno = conteo >= limite;
  const esCasiLleno = !esLleno && conteo >= limite - 3;

  // Esquema de colores según nivel de ocupación
  const configColor = esLleno
    ? {
        barra: 'bg-rose-600',
        texto: 'text-rose-700',
        fondo: 'bg-rose-50 border-rose-200',
        badge: 'bg-rose-100 text-rose-800 border-rose-300',
        estado: 'Cupos Agotados',
        icono: 'error',
      }
    : esCasiLleno
      ? {
          barra: 'bg-amber-500',
          texto: 'text-amber-700',
          fondo: 'bg-amber-50 border-amber-200',
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          estado: 'Alta Ocupación',
          icono: 'warning',
        }
      : {
          barra: 'bg-emerald-600',
          texto: 'text-emerald-700',
          fondo: 'bg-emerald-50/50 border-emerald-200/60',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          estado: 'Cupos Disponibles',
          icono: 'check_circle',
        };

  if (compacto) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${configColor.fondo} ${className}`}
        role="status"
        aria-label={`Capacidad: ${conteo} de ${limite} pacientes`}
      >
        <span className={`w-2 h-2 rounded-full ${configColor.barra}`} />
        <span className="text-slate-800 font-bold">
          {conteo}/{limite} pac.
        </span>
        <span className={`text-[10px] font-mono uppercase tracking-wider ${configColor.texto}`}>
          ({disponibles} libres)
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-3 transition-all ${configColor.fondo} ${className}`}
      role="region"
      aria-label="Indicador de capacidad del turno médico"
    >
      {/* Cabecera del aforo */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`p-1.5 rounded-lg ${configColor.badge} flex items-center justify-center`}>
            <Icon name={configColor.icono} className="text-sm" />
          </span>
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold leading-tight">
              {nombreTurno}
            </p>
            <p className="text-sm font-extrabold text-slate-900 leading-tight">
              Capacidad de Consulta
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className={`text-base font-black ${configColor.texto}`}>
            {conteo} <span className="text-xs text-slate-500 font-normal">/ {limite}</span>
          </span>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            {disponibles === 1 ? '1 cupo libre' : `${disponibles} cupos libres`}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div
        className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden relative"
        role="progressbar"
        aria-valuenow={conteo}
        aria-valuemin={0}
        aria-valuemax={limite}
      >
        <div
          className={`h-full transition-all duration-500 rounded-full ${configColor.barra}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {/* Alerta contextual en caso de saturación */}
      {esLleno && mostrarAvisoUrgencia && (
        <div className="mt-3 pt-2.5 border-t border-rose-200/70 flex items-start gap-2 text-rose-800 text-xs font-medium">
          <Icon name="emergency" className="text-base text-rose-600 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong>Límite de turno alcanzado (máx. {limite} pacientes).</strong> Para atención no
            programada, diríjase a la sección de <em>Triaje de Emergencia</em> o seleccione el
            siguiente turno disponible.
          </p>
        </div>
      )}
    </div>
  );
}

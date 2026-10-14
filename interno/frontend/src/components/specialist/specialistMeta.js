import { useEffect, useRef } from 'react';
import { Siren, Stethoscope, BellRing } from 'lucide-react';

export function useModalFocus(activo, onClose, autofocusId) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!activo) return undefined;
    const prev = document.activeElement;
    const panel = document.getElementById(autofocusId)?.closest('[role="dialog"]');
    const foco = () => {
      if (autofocusId && document.getElementById(autofocusId)) {
        document.getElementById(autofocusId).focus();
        return;
      }
      const f = panel?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      f?.[0]?.focus();
    };
    const tecla = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const f = panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const primero = f[0];
      const ultimo = f[f.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    foco();
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      prev?.focus?.();
    };
  }, [activo, autofocusId]);
}

export const ESTADO_LABEL = {
  RECEPCION: { t: 'Recepción', cls: 'bg-slate-100 text-slate-600' },
  TRIAJE: { t: 'Triaje', cls: 'bg-amber-100 text-amber-700' },
  EN_ESPERA_CONSULTA: { t: 'En espera', cls: 'bg-sky-100 text-sky-700' },
  EN_CONSULTA: { t: 'En consulta', cls: 'bg-emerald-100 text-emerald-700' },
  FINALIZADO: { t: 'Finalizado', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELADO: { t: 'Cancelado', cls: 'bg-red-100 text-red-700' },
  NO_ASISTIO: { t: 'No asistió', cls: 'bg-slate-100 text-slate-500' },
};

export const RUTA_META = {
  EMERGENCIA: { t: 'Emergencia', Icono: Siren, cls: 'bg-red-100 text-red-700 ring-red-200' },
  CITA: { t: 'Especialista', Icono: Stethoscope, cls: 'bg-sky-100 text-sky-700 ring-sky-200' },
  ESPECIALISTA: { t: 'Especialista', Icono: Stethoscope, cls: 'bg-sky-100 text-sky-700 ring-sky-200' },
  default: { t: '—', Icono: BellRing, cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

export function rutaMeta(ruta) {
  return RUTA_META[ruta] || RUTA_META.default;
}

export const ESPECIALIDAD_EMERGENCIA = 'Medicina de Emergencias';

export function esRegistroEmergencia(especialidad) {
  return String(especialidad || '').toLowerCase() === ESPECIALIDAD_EMERGENCIA.toLowerCase();
}

export function n2num(valor) {
  const n = parseFloat(String(valor || '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function formatearFecha(cadena) {
  if (!cadena) return '—';
  const fecha = new Date(cadena);
  if (Number.isNaN(fecha.getTime())) return cadena;
  return fecha.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function horaCorta(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
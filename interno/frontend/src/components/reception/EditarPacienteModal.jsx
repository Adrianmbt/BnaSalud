import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Pencil, Save, X } from 'lucide-react';
import {
  actualizarContactoPaciente,
  obtenerPaciente,
} from '../../api/historiasMedicas';
import { confirmar, exitoRapido } from '../../utils/alertas';

// Campos editables. La cédula no se toca: identifica al paciente en la nómina
// (trabajadores/beneficiarios) y en el resto de los módulos.
const CAMPOS = [
  { name: 'nombre_completo', label: 'Nombre completo', tipo: 'text' },
  { name: 'telefono', label: 'Teléfono', tipo: 'tel', placeholder: 'Ej. 04141234567' },
  { name: 'direccion', label: 'Dirección', tipo: 'text', placeholder: 'Sin dirección registrada' },
];

function normalizar(valor) {
  return String(valor || '').trim();
}

export default function EditarPacienteModal({
  paciente,
  onClose,
  onGuardado,
  // Desplaza el modal fuera del sidebar de 256 px (lg) para que no lo tape.
  offsetConSidebar = false,
}) {
  const [form, setForm] = useState({
    nombre_completo: paciente?.nombre_completo || '',
    telefono: paciente?.telefono || '',
    direccion: '',
  });
  const [inicial, setInicial] = useState({
    nombre_completo: paciente?.nombre_completo || '',
    telefono: paciente?.telefono || '',
    direccion: '',
  });
  const [cargando, setCargando] = useState(Boolean(paciente?.id));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!paciente?.id) {
      setCargando(false);
      return undefined;
    }
    let vivo = true;
    obtenerPaciente(paciente.id)
      .then((data) => {
        if (!vivo) return;
        const p = data?.paciente || {};
        const cargado = {
          nombre_completo: p.nombre_completo || paciente.nombre_completo || '',
          telefono: p.telefono || '',
          direccion: p.direccion || '',
        };
        setForm(cargado);
        setInicial(cargado);
      })
      .catch(() => {
        if (vivo) setError('No se pudieron cargar los datos actuales del paciente.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
    // Solo se recarga cuando cambia el paciente abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente?.id]);

  const cambios = useMemo(() => {
    const payload = {};
    CAMPOS.forEach(({ name }) => {
      if (normalizar(form[name]) !== normalizar(inicial[name])) {
        payload[name] = normalizar(form[name]);
      }
    });
    return payload;
  }, [form, inicial]);

  const hayCambios = Object.keys(cambios).length > 0;

  const cambiar = (name, valor) => {
    setError('');
    setForm((prev) => ({ ...prev, [name]: valor }));
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!hayCambios) {
      setError('No hay cambios para guardar.');
      return;
    }
    if ('nombre_completo' in cambios && !cambios.nombre_completo) {
      setError('El nombre del paciente no puede quedar vacío.');
      return;
    }
    const confirmado = await confirmar({
      titulo: '¿Guardar los cambios del paciente?',
      texto: `Se actualizarán los datos de ${
        inicial.nombre_completo || 'este paciente'
      } en todos sus registros.`,
      confirmar: 'Sí, guardar',
    });
    if (!confirmado) return;

    setGuardando(true);
    setError('');
    try {
      await actualizarContactoPaciente(paciente.id, cambios);
      setGuardando(false);
      exitoRapido('Datos del paciente actualizados');
      onGuardado?.();
      onClose?.();
    } catch (err) {
      setGuardando(false);
      setError(err?.response?.data?.detail || 'No se pudieron guardar los datos.');
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm ${
        offsetConSidebar ? 'lg:pl-64' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Editar datos del paciente"
    >
      <form
        onSubmit={guardar}
        className="relative w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-7 w-7 rounded-lg bg-brand-deep/10 text-brand-deep flex items-center justify-center shrink-0">
              <Pencil className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-brand-deep text-sm leading-tight">
                Editar datos del paciente
              </h3>
              {paciente?.cedula && (
                <p className="text-[10px] text-slate-500 font-mono">
                  V-{paciente.cedula} · la cédula no se modifica
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {cargando ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 text-brand-deep animate-spin mx-auto" />
              <p className="text-[11px] text-slate-500 mt-2 font-medium">
                Cargando datos del paciente…
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {CAMPOS.map(({ name, label, tipo, placeholder }) => (
                <label key={name} className="block">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    {label}
                  </span>
                  <input
                    type={tipo}
                    value={form[name]}
                    onChange={(e) => cambiar(name, e.target.value)}
                    placeholder={placeholder}
                    className="w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-brand-deep focus:border-brand-deep"
                  />
                </label>
              ))}

              <p className="text-[10px] text-slate-400 leading-relaxed">
                Se corrigen los datos del paciente en todos sus registros. Si el teléfono
                cambió, actualícelo aquí antes de notificar la cita por WhatsApp.
              </p>
            </>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || cargando || !hayCambios}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-brand-deep text-white hover:bg-brand-deep/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}

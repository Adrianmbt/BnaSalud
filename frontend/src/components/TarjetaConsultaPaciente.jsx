import React from 'react';
import Icon from './Icon';

/**
 * Mapeo de estados de receta médica con estilo visual y textos en español.
 */
const ESTADOS_RECETA_UI = {
  PENDIENTE: {
    etiqueta: 'Pendiente en farmacia',
    clase: 'bg-amber-50 text-amber-800 border-amber-300',
    icono: 'schedule',
  },
  DESPACHADA: {
    etiqueta: 'Despachada · Lista para retirar',
    clase: 'bg-sky-50 text-sky-800 border-sky-300',
    icono: 'local_shipping',
  },
  ENTREGADA: {
    etiqueta: 'Entregada · Confirma tu recepción',
    clase: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    icono: 'assignment_turned_in',
  },
  RECIBIDA: {
    etiqueta: 'Recibida · Cerrada',
    clase: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    icono: 'check_circle',
  },
};

/**
 * Formatea una fecha ISO a formato local legible en español.
 */
function formatoFecha(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || '—';
    return d.toLocaleDateString('es-VE', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso || '—';
  }
}

/**
 * Componente modular para mostrar la tarjeta individual de una consulta clínica
 * o estado de atención médica del paciente, con diagnóstico CIE-10 y botón de
 * confirmación de medicamentos.
 *
 * @param {{
 *   consulta: object,
 *   onConfirmarRecepcion?: (receta: object) => void,
 *   confirmandoId?: string | number | null,
 *   className?: string
 * }} props
 */
export default function TarjetaConsultaPaciente({
  consulta,
  onConfirmarRecepcion,
  confirmandoId = null,
  className = '',
}) {
  if (!consulta) return null;

  const {
    consulta_id,
    fecha,
    especialidad,
    medico_nombre,
    cie10_codigo,
    cie10_descripcion,
    motivo_consulta,
    examen_fisico,
    tratamiento,
    recomendaciones,
    recetas = [],
    estudios = [],
    laboratorios = [],
    estado,
  } = consulta;

  const tieneRecetas = Array.isArray(recetas) && recetas.length > 0;
  const tieneEstudios = (Array.isArray(estudios) && estudios.length > 0) || (Array.isArray(laboratorios) && laboratorios.length > 0);

  return (
    <article
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all hover:border-slate-300 ${className}`}
      aria-labelledby={`consulta-titulo-${consulta_id || Math.random()}`}
    >
      {/* Cabecera de la Consulta */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-slate-50/80 to-teal-50/20 border-b border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Icon name="stethoscope" className="text-xl" />
          </div>
          <div>
            <h3
              id={`consulta-titulo-${consulta_id || Math.random()}`}
              className="text-base font-extrabold text-slate-900 leading-snug"
            >
              {medico_nombre || 'Médico Tratante'}
            </h3>
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-2">
              <span>{especialidad || 'Medicina General'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-400 capitalize">{formatoFecha(fecha)}</span>
            </p>
          </div>
        </div>

        {/* Badge de Estado */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            {estado === 'en_consulta'
              ? 'En Consulta'
              : estado === 'en_espera'
                ? 'En Espera'
                : 'Consulta Registrada'}
          </span>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="p-4 sm:p-6 space-y-4">
        {/* Motivo de Consulta si existe */}
        {motivo_consulta && (
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1">
              Motivo de Atención
            </p>
            <p className="text-sm text-slate-800 font-medium leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
              {motivo_consulta}
            </p>
          </div>
        )}

        {/* Diagnóstico CIE-10 */}
        {cie10_codigo ? (
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="assignment" className="text-base" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-blue-700 font-bold">
                Diagnóstico Clínico (CIE-10)
              </p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                <span className="font-mono text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded mr-1.5 font-extrabold">
                  {cie10_codigo}
                </span>
                {cie10_descripcion || 'Sin descripción'}
              </p>
            </div>
          </div>
        ) : null}

        {/* Plan de Tratamiento */}
        {tratamiento && (
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1">
              Plan Terapéutico y Conducta
            </p>
            <p className="text-sm text-slate-800 font-medium leading-relaxed">{tratamiento}</p>
          </div>
        )}

        {/* Prescripciones Médicas con Flujo de Doble Confirmación */}
        {tieneRecetas && (
          <div className="pt-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold mb-2.5 flex items-center gap-1.5">
              <Icon name="prescriptions" className="text-sm text-teal-700" />
              Recetas y Medicamentos Digitales ({recetas.length})
            </p>
            <div className="space-y-2.5">
              {recetas.map((rx, idx) => {
                const nombreRx = rx.nombre || rx.nombre_medicamento || 'Medicamento';
                const posologiaRx = rx.posologia || rx.indicaciones || 'Según indicación médica';
                const estadoRx = String(rx.estado || 'PENDIENTE').toUpperCase();
                const estadoConf = ESTADOS_RECETA_UI[estadoRx] || ESTADOS_RECETA_UI.PENDIENTE;

                const puedeConfirmar = estadoRx === 'ENTREGADA';
                const yaRecibido = estadoRx === 'RECIBIDA';
                const estaConfirmando = confirmandoId === rx.id;

                return (
                  <div
                    key={rx.id || `${rx.nombre}-${idx}`}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all hover:bg-white"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{nombreRx}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${estadoConf.clase}`}
                        >
                          <Icon name={estadoConf.icono} className="text-xs" />
                          {estadoConf.etiqueta}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium mt-1">{posologiaRx}</p>
                    </div>

                    {/* Botón de Acción para el Paciente */}
                    <div className="shrink-0 flex items-center">
                      {yaRecibido ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-300">
                          <Icon name="task_alt" className="text-sm" /> Medicamento Recibido
                        </span>
                      ) : puedeConfirmar ? (
                        <button
                          type="button"
                          onClick={() => onConfirmarRecepcion && onConfirmarRecepcion(rx)}
                          disabled={estaConfirmando}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50"
                        >
                          {estaConfirmando ? (
                            <>
                              <Icon name="sync" className="text-sm animate-spin" /> Confirmando...
                            </>
                          ) : (
                            <>
                              <Icon name="inventory" className="text-sm" /> Confirmar Medicamento Recibido
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Órdenes de Estudios y Laboratorios */}
        {tieneEstudios && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-1.5">
              <Icon name="science" className="text-sm text-teal-700" />
              Órdenes de Exámenes y Laboratorio
            </p>
            <div className="flex flex-wrap gap-2">
              {[...estudios, ...laboratorios].map((est, idx) => (
                <span
                  key={est.id || idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200"
                >
                  <Icon name="monitor_heart" className="text-xs text-teal-700" />
                  {est.nombre || est.parametro || 'Estudio Clínico'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

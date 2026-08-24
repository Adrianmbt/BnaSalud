import React from 'react';
import Icon from './Icon';
import { usePharmacyStock } from '../hooks/usePharmacyStock';

/**
 * Componente modular para el ingreso dinámico de prescripciones médicas con
 * verificación en tiempo real del inventario de farmacia.
 *
 * @param {{
 *   recetas: Array<{ nombre: string, posologia: string }>,
 *   onChange: (index: number, campo: string, valor: string) => void,
 *   onAdd: () => void,
 *   onRemove: (index: number) => void,
 *   soloLectura?: boolean,
 *   className?: string
 * }} props
 */
export default function PrescripcionInput({
  recetas = [],
  onChange,
  onAdd,
  onRemove,
  soloLectura = false,
  className = '',
}) {
  const { verificarDisponibilidad, resumirPrescripciones } = usePharmacyStock();

  const resumen = resumirPrescripciones(recetas);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Listado de Medicamentos */}
      {recetas.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-200/80 text-slate-500 mx-auto flex items-center justify-center mb-2">
            <Icon name="medication" className="text-xl" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No hay medicamentos prescritos</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Presione &quot;+ Agregar Medicamento&quot; para indicar fármacos con validación de existencias.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recetas.map((receta, idx) => {
            const nombre = receta.nombre || '';
            const posologia = receta.posologia || '';
            const infoStock = verificarDisponibilidad(nombre);

            return (
              <div
                key={idx}
                className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 transition-all hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-800 text-xs font-mono font-bold flex items-center justify-center border border-teal-200">
                      {idx + 1}
                    </span>
                    <label
                      htmlFor={`receta-nombre-${idx}`}
                      className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold"
                    >
                      Medicamento / Presentación
                    </label>
                  </div>

                  {!soloLectura && (
                    <button
                      type="button"
                      onClick={() => onRemove(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Eliminar este medicamento"
                      aria-label={`Eliminar medicamento ${idx + 1}`}
                    >
                      <Icon name="delete" className="text-lg" />
                    </button>
                  )}
                </div>

                {/* Input de Nombre */}
                <div>
                  <input
                    id={`receta-nombre-${idx}`}
                    type="text"
                    value={nombre}
                    readOnly={soloLectura}
                    onChange={(e) => onChange(idx, 'nombre', e.target.value)}
                    placeholder="Ej: Amoxicilina 500mg, Losartán 50mg, Ibuprofeno 400mg..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>

                {/* Semáforo de Disponibilidad en Farmacia */}
                {nombre.trim().length >= 2 && (
                  <div className="pt-0.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${infoStock.claseEstilo}`}
                      role="status"
                    >
                      <Icon
                        name={
                          infoStock.estado === 'ok'
                            ? 'check_circle'
                            : infoStock.estado === 'bajo'
                              ? 'warning'
                              : 'error'
                        }
                        className="text-xs"
                      />
                      {infoStock.mensaje}
                    </span>
                  </div>
                )}

                {/* Input de Posología */}
                <div>
                  <label
                    htmlFor={`receta-posologia-${idx}`}
                    className="block text-xs font-mono uppercase tracking-wider text-slate-500 font-bold mb-1"
                  >
                    Posología e Indicaciones Clínicas
                  </label>
                  <input
                    id={`receta-posologia-${idx}`}
                    type="text"
                    value={posologia}
                    readOnly={soloLectura}
                    onChange={(e) => onChange(idx, 'posologia', e.target.value)}
                    placeholder="Ej: 1 tableta vía oral cada 8 horas por 7 días después de las comidas"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Barra de Acciones y Resumen */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {!soloLectura && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-teal-600/40 text-teal-800 hover:bg-teal-50/60 active:scale-[0.98] text-xs font-bold transition-all"
          >
            <Icon name="add" className="text-base" /> + Agregar Medicamento
          </button>
        )}

        {/* Resumen de Disponibilidad */}
        {resumen.total > 0 && (
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 bg-slate-100 px-3.5 py-2 rounded-xl">
            <span>
              Total: <strong>{resumen.total}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700">
              Disponibles: <strong>{resumen.disponibles}</strong>
            </span>
            {resumen.compraExterna > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-rose-700">
                  Compra Externa: <strong>{resumen.compraExterna}</strong>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

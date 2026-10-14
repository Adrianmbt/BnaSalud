import React from 'react';
import { FlaskConical, CheckCircle2, XCircle, MessageSquareText, Save } from 'lucide-react';
import PanelModal from './PanelModal';

export default function ExamenesPreviosModal({
  abierto,
  onClose,
  examenesPrevios = [],
  revisionExamenes,
  onRevisionExamenes,
  onGuardar,
}) {
  const examenes = examenesPrevios;

  const toggleRevision = (idx, valor) => {
    const copia = [...(revisionExamenes || [])];
    while (copia.length <= idx) copia.push({ revisado: null, observacion: '' });
    copia[idx] = { ...copia[idx], revisado: valor };
    onRevisionExamenes?.(copia);
  };

  const setObservacion = (texto) => {
    const copia = [...(revisionExamenes || [])];
    if (copia.length === 0) return;
    const ultima = { ...copia[copia.length - 1], observacion: texto };
    copia[copia.length - 1] = ultima;
    onRevisionExamenes?.(copia);
  };

  const observacion = revisionExamenes?.[revisionExamenes.length - 1]?.observacion || '';
  const revisados = (revisionExamenes || []).filter((r) => r.revisado === true).length;
  const noRevisados = (revisionExamenes || []).filter((r) => r.revisado === false).length;

  return (
    <PanelModal
      abierto={abierto}
      onClose={onClose}
      id="sp-examenes-previos-modal"
      titulo="Exámenes anteriores del paciente"
      subtitulo={`${examenes.length} examen(es) · ${revisados} revisado(s)${noRevisados > 0 ? ` · ${noRevisados} no revisado(s)` : ''}`}
      icono={<FlaskConical className="w-5 h-5 text-violet-600" />}
      maxW="max-w-2xl"
    >
      {examenes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8 italic">No hay exámenes previos registrados.</p>
      ) : (
        <div className="space-y-3">
          {examenes.map((examen, idx) => {
            const datos = revisionExamenes?.[idx] || { revisado: null, observacion: '' };
            const activoSi = datos.revisado === true;
            const activoNo = datos.revisado === false;

            return (
              <div
                key={idx}
                className={`rounded-xl ring-1 p-3.5 transition-colors ${
                  activoSi
                    ? 'bg-emerald-50/60 ring-emerald-200'
                    : activoNo
                    ? 'bg-red-50/60 ring-red-200'
                    : 'bg-slate-50 ring-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {examen.estudio || examen.nombre}
                    </p>
                    {examen.indicacion && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{examen.indicacion}</p>
                    )}
                    {examen.resultado && (
                      <p className="text-xs text-slate-600 mt-1.5 bg-white rounded-lg px-2.5 py-1.5 ring-1 ring-slate-100 leading-relaxed">
                        {examen.resultado}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleRevision(idx, true)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                        activoSi
                          ? 'bg-emerald-600 border-emerald-700 text-white'
                          : 'border-slate-300 text-slate-600 hover:bg-emerald-50'
                      }`}
                      aria-pressed={activoSi}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleRevision(idx, false)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                        activoNo
                          ? 'bg-red-600 border-red-700 text-white'
                          : 'border-slate-300 text-slate-600 hover:bg-red-50'
                      }`}
                      aria-pressed={activoNo}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      No
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Observación general */}
          <div className="rounded-xl bg-white ring-1 ring-slate-200 p-3.5 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <MessageSquareText className="w-4 h-4 text-slate-400" />
              Observación general
            </label>
            <textarea
              rows="3"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Observación sobre los exámenes revisados (resultados, conclusiones, plan a seguir)..."
              className="cp-input resize-none text-xs"
            />
          </div>

          {/* Guardar */}
          <button
            type="button"
            onClick={onGuardar}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            Guardar y cerrar
          </button>
        </div>
      )}
    </PanelModal>
  );
}

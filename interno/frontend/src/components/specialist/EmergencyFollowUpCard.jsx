import React from 'react';
import { Siren, Pill, CheckCircle2, XCircle, MessageSquareText, Save } from 'lucide-react';

export default function EmergencyFollowUpCard({ consulta, cumplimiento, onCumplimiento, onGuardar }) {
  if (!consulta) return null;

  const { cumple, nota } = cumplimiento || {};

  const opciones = [
    { valor: 'si', etiqueta: 'Sí', icono: CheckCircle2, active: 'bg-emerald-600 border-emerald-700 text-white', idle: 'text-slate-600 hover:bg-emerald-50' },
    { valor: 'no', etiqueta: 'No', icono: XCircle, active: 'bg-red-600 border-red-700 text-white', idle: 'text-slate-600 hover:bg-red-50' },
  ];

  return (
    <section className="rounded-2xl border-2 border-red-200 bg-red-50/60 p-4 space-y-3 animate-fade-up">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 ring-1 ring-red-200 text-[11px] font-bold">
          <Siren className="w-3.5 h-3.5" /> Tratamiento de Emergencia
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-slate-600 ring-1 ring-slate-200 text-[11px] font-semibold">
          <Pill className="w-3.5 h-3.5" /> Prescrito por Medicina de Emergencias
        </span>
        <span className="ml-auto font-mono text-[10px] text-slate-400">{consulta.fecha}</span>
      </div>

      <div className="rounded-xl bg-white ring-1 ring-slate-200 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Tratamiento ordenado</p>
        {consulta.tratamiento ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{consulta.tratamiento}</p>
        ) : (
          <p className="text-xs text-slate-400 italic">Sin tratamiento indicado</p>
        )}
      </div>

      {Array.isArray(consulta.recetas) && consulta.recetas.filter((r) => r?.nombre).length > 0 && (
        <div className="rounded-xl bg-white ring-1 ring-violet-200 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500 mb-2 flex items-center gap-1">
            <Pill className="w-3 h-3" /> Recetas prescritas
          </p>
          <div className="space-y-1.5">
            {consulta.recetas.filter((r) => r?.nombre).map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold shrink-0 mt-0.5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <span className="font-medium text-slate-700">{r.nombre}</span>
                  {r.posologia && <span className="ml-2 text-slate-500">— {r.posologia}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[12px] font-bold text-slate-700">
          ¿El paciente siguió el tratamiento indicado por emergencias?
        </p>
        <div className="flex gap-2">
          {opciones.map((o) => {
            const Icono = o.icono;
            const activa =
              (cumple === 'si' && o.valor === 'si') || (cumple === 'no' && o.valor === 'no');
            return (
              <button
                key={o.valor}
                type="button"
                onClick={() => onCumplimiento({ cumple: o.valor, nota })}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                  activa ? o.active : `border-slate-300 ${o.idle}`
                }`}
                aria-pressed={activa}
              >
                <Icono className="w-4 h-4" />
                {o.etiqueta}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <MessageSquareText className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <textarea
            rows="2"
            value={nota || ''}
            onChange={(e) => onCumplimiento({ cumple, nota: e.target.value })}
            placeholder="Nota sobre el cumplimiento (dosis, efectos, razones de no cumplimiento…)"
            className="cp-input !pl-9 resize-none"
          />
        </div>
      </div>

      {onGuardar && (
        <button
          type="button"
          onClick={onGuardar}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          Guardar y cerrar
        </button>
      )}
    </section>
  );
}
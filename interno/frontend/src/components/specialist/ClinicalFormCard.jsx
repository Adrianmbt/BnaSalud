import React from 'react';
import { Stethoscope } from 'lucide-react';

export default function ClinicalFormCard({ form, setForm }) {
  const set = (k) => (e) => setForm(k, e.target.value);

  return (
    <section aria-label="Ficha clínica" className="flex flex-col rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden h-full">
      <div className="px-4 py-2 flex items-center gap-2.5 border-b border-slate-100 shrink-0">
        <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center ring-1 ring-sky-500/20 shrink-0">
          <Stethoscope className="w-3.5 h-3.5" />
        </div>
        <h3 className="font-display font-bold text-xs text-brand-deep">Ficha clínica</h3>
      </div>
      <div className="flex-1 px-4 py-3 space-y-3">
        <div>
          <label htmlFor="sp-motivo" className="block text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
            Motivo de consulta
          </label>
          <textarea
            id="sp-motivo"
            className="cp-input !text-xs"
            rows={2}
            placeholder="Motivo por el cual el paciente acude"
            value={form.motivo}
            onChange={set('motivo')}
          />
        </div>
        <div>
          <label htmlFor="sp-examen" className="block text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
            Examen físico
          </label>
          <textarea
            id="sp-examen"
            className="cp-input !text-xs"
            rows={2}
            placeholder="Hallazgos del examen físico"
            value={form.examenFisico}
            onChange={set('examenFisico')}
          />
        </div>
        <div>
          <label htmlFor="sp-diagnostico" className="block text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
            Diagnóstico *
          </label>
          <input
            id="sp-diagnostico"
            className="cp-input !text-xs"
            placeholder="Ej: Hipertensión arterial esencial"
            value={form.diagnostico}
            onChange={set('diagnostico')}
          />
        </div>
      </div>
    </section>
  );
}

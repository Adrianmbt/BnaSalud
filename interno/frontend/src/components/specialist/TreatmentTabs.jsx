import React, { useState } from 'react';
import { Syringe, Pill, FileText } from 'lucide-react';
import MedicationPanel from './MedicationPanel';

const TABS = [
  { id: 'aplicados', label: 'Aplicados', icon: Syringe },
  { id: 'recetas', label: 'Recetas', icon: Pill },
  { id: 'indicaciones', label: 'Indicaciones', icon: FileText },
];

export default function TreatmentTabs({
  form,
  setForm,
  recetas,
  onRecetas,
  aplicados,
  onAplicados,
}) {
  const [activeTab, setActiveTab] = useState('aplicados');
  const set = (k) => (e) => setForm(k, e.target.value);

  return (
    <section aria-label="Plan de tratamiento" className="flex flex-col rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden h-full">
      {/* Tab bar */}
      <div className="px-3 py-1.5 flex items-center gap-1 border-b border-slate-100 shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                isActive
                  ? 'bg-brand-deep text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 px-4 py-3 overflow-y-auto">
        {activeTab === 'aplicados' && (
          <div className="rounded-xl ring-1 ring-amber-200 bg-amber-50/40 overflow-hidden h-full flex flex-col">
            <div className="px-3 py-1.5 flex items-center gap-2 border-b border-amber-100 shrink-0">
              <Syringe className="w-3 h-3 text-amber-600" />
              <p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Aplicados</p>
              <span className="ml-auto text-[8px] text-amber-500 font-semibold">descuenta stock</span>
            </div>
            <div className="flex-1 p-2 overflow-y-auto">
              <MedicationPanel recetas={aplicados} onRecetas={onAplicados} variant="aplicado" />
            </div>
          </div>
        )}

        {activeTab === 'recetas' && (
          <div className="rounded-xl ring-1 ring-violet-200 bg-violet-50/40 overflow-hidden h-full flex flex-col">
            <div className="px-3 py-1.5 flex items-center gap-2 border-b border-violet-100 shrink-0">
              <Pill className="w-3 h-3 text-violet-600" />
              <p className="text-[9px] font-bold uppercase tracking-wide text-violet-700">Recetas</p>
              <span className="ml-auto text-[8px] text-violet-500 font-semibold">sin descuento</span>
            </div>
            <div className="flex-1 p-2 overflow-y-auto">
              <MedicationPanel recetas={recetas} onRecetas={onRecetas} variant="receta" />
            </div>
          </div>
        )}

        {activeTab === 'indicaciones' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="sp-tratamiento" className="block text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                Tratamiento
              </label>
              <textarea
                id="sp-tratamiento"
                className="cp-input !text-xs"
                rows={3}
                placeholder="Plan terapéutico, medicamentos y dosis"
                value={form.tratamiento}
                onChange={set('tratamiento')}
              />
            </div>
            <div>
              <label htmlFor="sp-indicaciones" className="block text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                Indicaciones
              </label>
              <textarea
                id="sp-indicaciones"
                className="cp-input !text-xs"
                rows={3}
                placeholder="Controles, signos de alarma, recomendaciones"
                value={form.indicaciones}
                onChange={set('indicaciones')}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

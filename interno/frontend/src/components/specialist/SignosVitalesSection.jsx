import React, { useState } from 'react';
import {
  Heart, Siren, Gauge, HeartPulse, Wind, Thermometer, Droplets, Scale, Ruler,
} from 'lucide-react';
import { formatearFecha } from './specialistMeta';

const SIGNOS = [
  { key: 'presion_arterial', label: 'P.A.', unidad: 'mmHg', icon: Gauge, ph: '120/80' },
  { key: 'frecuencia_cardiaca', label: 'F.C.', unidad: 'lpm', icon: HeartPulse, ph: '72' },
  { key: 'frecuencia_respiratoria', label: 'F.R.', unidad: 'rpm', icon: Wind, ph: '16' },
  { key: 'temperatura', label: 'T°', unidad: '°C', icon: Thermometer, ph: '37.0' },
  { key: 'saturacion_oxigeno', label: 'SpO₂', unidad: '%', icon: Droplets, ph: '98' },
  { key: 'peso_kg', label: 'Peso', unidad: 'kg', icon: Scale, ph: '70' },
  { key: 'talla_cm', label: 'Talla', unidad: 'cm', icon: Ruler, ph: '168' },
];

export const SIGNOS_VACIOS = {
  presion_arterial: '',
  frecuencia_cardiaca: '',
  frecuencia_respiratoria: '',
  temperatura: '',
  saturacion_oxigeno: '',
  peso_kg: '',
  talla_cm: '',
};

const limpio = (v) => String(v ?? '').trim();

export default function SignosVitalesSection({ signos, setSigno, referencia = null, referenciaFecha = null }) {
  const [abierto, setAbierto] = useState(false);
  const tieneRef = referencia && SIGNOS.some((s) => limpio(referencia[s.key]));
  const llenos = SIGNOS.filter((s) => limpio(signos?.[s.key])).length;

  return (
    <section
      aria-label="Signos vitales actuales"
      className="animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-slate-50/60 transition-colors"
        aria-expanded={abierto}
      >
        <span className="h-8 w-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center ring-1 ring-sky-500/20 shrink-0">
          <Heart className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0 text-left">
          <h3 className="font-display font-bold text-sm text-brand-deep">Signos vitales</h3>
          {tieneRef && (
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                <Siren className="w-2.5 h-2.5" /> Emergencia
              </span>
              {`· ref. ${formatearFecha(referenciaFecha)}`}
            </p>
          )}
        </div>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 rounded-lg px-2 py-0.5 shrink-0">{llenos}/7</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${abierto ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {abierto && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
            {SIGNOS.map((s) => {
              const Icono = s.icon;
              const refVal = tieneRef ? limpio(referencia?.[s.key]) : '';
              const actual = limpio(signos?.[s.key]);
              const difiere = Boolean(refVal && actual && refVal !== actual);
              return (
                <label key={s.key} className={`block rounded-lg border p-2 space-y-1 transition-all ${difiere ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200'}`}>
                  <span className="flex items-center justify-between gap-0.5">
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                      <Icono className="w-2.5 h-2.5" /> {s.label}
                    </span>
                    {tieneRef && (
                      <span
                        className={`font-mono text-[8px] font-bold px-1 rounded ${difiere ? 'bg-amber-100 text-amber-700' : 'bg-red-50 text-red-500'}`}
                        title="Valor registrado en la consulta de emergencia"
                      >
                        {refVal || '—'}
                      </span>
                    )}
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={signos?.[s.key] || ''}
                      onChange={(e) => setSigno(s.key, e.target.value)}
                      placeholder={s.ph}
                      aria-label={`${s.label} en ${s.unidad}`}
                      className="cp-input !px-2 !py-1.5 pr-5 text-center font-mono text-[12px] font-semibold"
                    />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-mono text-slate-400">{s.unidad}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

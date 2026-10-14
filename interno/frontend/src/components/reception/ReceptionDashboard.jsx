import React from 'react';
import { Users, Stethoscope, Clock3, ShieldCheck } from 'lucide-react';

const stats = [
  { key: 'recepcion', icon: Users, label: 'En recepcion', tint: 'from-brand-primary/25 to-brand-primary/5 text-brand-primary' },
  { key: 'consulta', icon: Stethoscope, label: 'En consulta', tint: 'from-indigo-400/25 to-indigo-400/5 text-indigo-500' },
  { key: 'espera', icon: Clock3, label: 'Triaje / Espera', tint: 'from-amber-400/25 to-amber-400/5 text-amber-500' },
  { key: 'finalizado', icon: ShieldCheck, label: 'Atendidos', tint: 'from-emerald-400/25 to-emerald-400/5 text-brand-success' },
];

export default function ReceptionDashboard({ queue }) {
  const values = {
    recepcion: queue.recepcion.length,
    consulta: queue.consulta.length,
    espera: queue.triaje.length + queue.espera.length,
    finalizado: queue.finalizado.length,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {stats.map((s, i) => (
        <div
          key={s.key}
          className="animate-fade-up bg-white rounded-xl p-2.5 ring-1 ring-slate-200/70 shadow-sm flex items-center gap-2.5 hover:shadow-md hover:-translate-y-0.5 transition-all"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <div className={`shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br ${s.tint} ring-1 flex items-center justify-center`}>
            <s.icon className="w-4 h-4" />
          </div>
          <div>
            <div className="font-display font-bold text-lg text-brand-deep tabular-nums leading-none">{values[s.key]}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

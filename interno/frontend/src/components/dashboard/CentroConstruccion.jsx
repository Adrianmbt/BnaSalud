import React from 'react';
import { Construction, Building2, Clock } from 'lucide-react';

const CENTRO_INFO = {
  clinica_mujer: {
    nombre: 'Clínica Integral de la Mujer',
    descripcion: 'Atención médica integral especializada en salud femenina. Consultas ginecológicas, preventivas y de control.',
    icono: '🏥',
  },
  clinica_ninos: {
    nombre: 'Clínica Integral de los Niños',
    descripcion: 'Pediatría integral, vacunación, control de crecimiento y desarrollo. Atención especializada para niños y adolescentes.',
    icono: '👶',
  },
  oncologico: {
    nombre: 'Oncológico Maruja Clavier',
    descripcion: 'Centro de atención oncológica con quimioterapia, radioterapia y seguimiento integral de pacientes.',
    icono: '🎗️',
  },
  adulto_mayor: {
    nombre: 'Casa del Adulto Mayor',
    descripcion: 'Atención geriátrica, rehabilitación, programas de bienestar y acompañamiento para adultos mayores.',
    icono: '🤲',
  },
  jornadas: {
    nombre: 'Jornadas Médico Asistencial',
    descripcion: 'Jornadas de salud comunitaria en diversas parroquias del municipio. Atención primaria y preventiva.',
    icono: '🩺',
  },
};

export default function CentroConstruccion({ nombre }) {
  const centroId = Object.keys(CENTRO_INFO).find((k) => CENTRO_INFO[k].nombre === nombre);
  const info = centroId ? CENTRO_INFO[centroId] : { nombre: nombre || 'Centro de Salud', descripcion: 'Información próximamente disponible.', icono: '🏥' };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 animate-fade-in" role="region" aria-label={`Centro en construcción: ${info.nombre}`}>
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="relative mb-8">
          <div className="w-28 h-28 mx-auto rounded-3xl bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-dashed border-blue-200 flex items-center justify-center" aria-hidden="true">
            <span className="text-5xl">{info.icono}</span>
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center" aria-hidden="true">
            <Construction className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        {/* Name */}
        <h2 className="font-display font-bold text-2xl text-brand-deep mb-3">{info.nombre}</h2>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold mb-6">
          <Clock className="w-4 h-4" aria-hidden="true" />
          Centro en Construcción
        </div>

        {/* Description */}
        <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-md mx-auto">{info.descripcion}</p>

        {/* Feature placeholders */}
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto" aria-hidden="true">
          {['Consultas', 'Especialistas', 'Reportes'].map((item) => (
            <div key={item} className="px-3 py-4 rounded-xl bg-slate-50 border border-slate-200 border-dashed">
              <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-slate-200 animate-pulse" />
              <p className="text-[11px] font-medium text-slate-400">{item}</p>
            </div>
          ))}
        </div>

        {/* Message */}
        <p className="mt-8 text-[11px] text-slate-300">
          Este centro de salud está en proceso de integración al sistema.
        </p>
      </div>
    </div>
  );
}

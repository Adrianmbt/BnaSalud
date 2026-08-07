import Icon from './Icon';

const ESPECIALIDADES = [
  { icono: 'child_care', nombre: 'Pediatría', descripcion: 'Cuidado integral para los más pequeños.' },
  { icono: 'dentistry', nombre: 'Odontología', descripcion: 'Salud bucodental avanzada y estética.' },
  { icono: 'female', nombre: 'Ginecología', descripcion: 'Atención ginecológica y obstetricia.' },
  { icono: 'stethoscope', nombre: 'General', descripcion: 'Medicina de familia y prevención.' },
  { icono: 'cardiology', nombre: 'Cardiología', descripcion: 'Diagnóstico y tratamiento cardiovascular.' },
];

export default function Specialties() {
  return (
    <section id="servicios" className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14" data-aos="fade-up">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary mb-4 border border-secondary/20">Especialidades</span>
          <h2 className="text-3xl md:text-4xl font-bold text-primary">Especialidades Médicas</h2>
          <p className="text-lg text-on-surface-variant mt-3 max-w-2xl mx-auto">Contamos con equipos especializados y tecnología de última generación.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {ESPECIALIDADES.map((esp, i) => (
            <div
              key={esp.nombre}
              className="group bg-white p-8 rounded-3xl border border-outline-variant/20 shadow-lg card-hover cursor-pointer"
              data-aos="fade-up"
              data-aos-delay={100 + i * 80}
            >
              <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-secondary group-hover:text-white transition-all duration-300 text-secondary">
                <Icon name={esp.icono} className="text-3xl" />
              </div>
              <h4 className="text-xl font-bold text-primary mb-2">{esp.nombre}</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">{esp.descripcion}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

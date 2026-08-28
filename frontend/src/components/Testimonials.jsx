import Icon from './Icon';

const TESTIMONIOS = [
  {
    texto: '"Excelente atención en la Clínica de la Mujer. El proceso de cita digital es muy rápido y el personal es increíblemente profesional. La red de salud del municipio es un acierto."',
    nombre: 'María García',
    detalle: 'Paciente • Clínica de la Mujer',
    color: 'from-secondary to-secondary-container',
    estrellas: 5,
  },
  {
    texto: '"Gracias a la red municipal pude atenderme en CITAB sin tener que viajar al centro. La salud pública funciona cuando está organizada."',
    nombre: 'Carlos Mendoza',
    detalle: 'Paciente • CITAB',
    color: 'from-primary to-primary-container',
    estrellas: 5,
  },
  {
    texto: '"Pude agendar la cita de mi hija en la Clínica del Niño por internet. El sistema de referencia a especialistas funciona muy bien."',
    nombre: 'Ana Rodríguez',
    detalle: 'Paciente • Clínica del Niño',
    color: 'from-tertiary-fixed-dim to-tertiary-fixed',
    estrellas: 4.5,
  },
];

function Estrellas({ valor }) {
  return (
    <div className="flex gap-1 mb-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={i <= Math.floor(valor) ? 'star' : valor > i - 1 ? 'star_half' : 'star'} filled={i <= Math.floor(valor)} className="text-secondary" />
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section id="testimonios" className="py-16 md:py-24 bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14" data-aos="fade-up">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary mb-4 border border-secondary/20">Testimonios</span>
          <h2 className="text-3xl md:text-4xl font-bold text-primary">Lo que dicen nuestros pacientes</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIOS.map((t, i) => (
            <div key={t.nombre} className="bg-white p-8 rounded-3xl shadow-xl border border-outline-variant/20" data-aos="fade-up" data-aos-delay={100 + i * 100}>
              <Estrellas valor={t.estrellas} />
              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">{t.texto}</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color}`}></div>
                <div>
                  <p className="text-sm font-bold text-primary">{t.nombre}</p>
                  <p className="text-xs text-on-surface-variant">{t.detalle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

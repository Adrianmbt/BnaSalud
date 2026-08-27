import Icon from './Icon';
import HeroCarousel from './HeroCarousel';

export default function Hero({ onSolicitarCita }) {
  return (
    <section id="inicio" className="relative pt-24 pb-16 md:pt-32 md:pb-20 overflow-hidden" aria-label="Hero principal">
      <div className="hero-gradient absolute inset-0 pointer-events-none"></div>
      <div className="absolute top-40 right-20 w-72 h-72 bg-secondary/5 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-tertiary-fixed-dim/5 rounded-full blur-3xl" style={{ animation: 'float 8s ease-in-out infinite reverse' }}></div>

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-8 items-center">
        <div data-aos="fade-right" data-aos-duration="800">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-primary leading-[1.15] tracking-tight mb-4">
            Un solo sistema de salud para todo el municipio: públicos, aliados y cerca de ti
          </h1>
          <p className="text-base text-on-surface-variant leading-relaxed max-w-lg mb-6">
            El <strong className="text-primary">Instituto de Salud del Municipio Simón Bolívar</strong> articula una red de centros de salud públicos y aliados para garantizar atención médica gratuita, digna y oportuna a cada familia barcelonesa.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={onSolicitarCita} className="btn-primary text-white px-6 py-3 rounded-xl font-semibold text-xs shadow-2xl active:scale-95">
              <span className="flex items-center gap-2">
                Solicitar Cita Ahora
                <Icon name="arrow_forward" />
              </span>
            </button>
            <a href="#sedes" className="btn-outline px-6 py-3 rounded-xl font-semibold text-xs active:scale-95 inline-flex items-center">
              Conoce Nuestra Red
            </a>
          </div>
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-outline-variant/30">
            <div className="flex -space-x-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary to-secondary-container border-2 border-white"></div>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-container border-2 border-white"></div>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-tertiary-fixed-dim to-tertiary-fixed border-2 border-white"></div>
            </div>
            <p className="text-xs text-on-surface-variant">+<span className="font-bold text-primary">12,000</span> ciudadanos atendidos este mes</p>
          </div>
        </div>

        <div data-aos="fade-left" data-aos-duration="800" data-aos-delay="200" className="relative">
          <HeroCarousel />
          <div className="absolute -bottom-6 -left-6 bg-white p-5 rounded-2xl shadow-xl border border-outline-variant/10 hidden md:block" data-aos="fade-up" data-aos-delay="500">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
                <Icon name="verified" filled />
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Red de Salud Municipal</p>
                <p className="text-xl font-bold text-primary">6 Centros</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

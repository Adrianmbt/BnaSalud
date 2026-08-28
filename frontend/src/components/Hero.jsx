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
            Un solo sistema de salud para todo el municipio Simón Bolívar
          </h1>
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
        </div>

        <div data-aos="fade-left" data-aos-duration="800" data-aos-delay="200" className="relative">
          <HeroCarousel />
        </div>
      </div>
    </section>
  );
}

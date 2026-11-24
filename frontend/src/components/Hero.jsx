import HeroCarrusel from './HeroCarrusel';

export default function Hero({ onSolicitarCita }) {
  return (
    <section
      id="inicio"
      className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden"
      aria-label="Hero principal"
    >
      {/* Una sola mancha de color de fondo, sin elementos flotantes en movimiento. */}
      <div className="hero-gradient absolute inset-[-20%] pointer-events-none" aria-hidden="true" />
      <div
        className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-secondary/8 rounded-full blur-[80px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-display font-black text-primary leading-[1.1] tracking-tight mb-6">
              Una sola red de salud para todo el municipio
            </h1>
            <p className="text-lg text-on-surface-variant leading-relaxed max-w-md mb-8">
              Pide tu cita en cualquiera de los centros de la red municipal, consulta tu historial
              clínico y sigue tus estudios y recetas desde el mismo lugar.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSolicitarCita}
                className="btn btn-primary"
                aria-label="Solicitar cita ahora"
              >
                <span className="flex items-center gap-2">
                  Solicitar cita ahora
                </span>
              </button>
              <a href="#servicios" className="btn btn-outline">
                Conoce nuestra red
              </a>
            </div>
          </div>

          <div className="relative">
            <HeroCarrusel />
          </div>
        </div>
      </div>
    </section>
  );
}

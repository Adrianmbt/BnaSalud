import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';

/* ════════════════════════════════════════════════════════════════
   Carrusel de fachadas de los centros de salud.
   Función: ayudar al paciente a reconocer el centro por su edificio.
   Movimiento: una sola pieza orquestada (rotación automática), pausa al
   hover/foco y respeta prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════ */

const CENTROS = [
  { nombre: 'CITAB', archivo: '/centros/citab.jpeg' },
  { nombre: 'Clínica de la Mujer', archivo: '/centros/clinica de la mujer.jpeg' },
  { nombre: 'Clínica del Niño', archivo: '/centros/cinica del niño.jpeg' },
  { nombre: 'Centro Oncológico', archivo: '/centros/oncologico.jpeg' },
  { nombre: 'Casa del Abuelo', archivo: '/centros/casa del abuelo.jpeg' },
  { nombre: 'Clínica Municipal', archivo: '/centros/clinica municipal.jpeg' },
];

const INTERVALO = 4000;

export default function HeroCarrusel() {
  const [activa, setActiva] = useState(0);
  const [pausado, setPausado] = useState(false);
  const timerRef = useRef(null);

  const avanzar = useCallback(() => {
    if (!pausado) setActiva((p) => (p + 1) % CENTROS.length);
  }, [pausado]);

  useEffect(() => {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducido) return;
    timerRef.current = setInterval(avanzar, INTERVALO);
    return () => clearInterval(timerRef.current);
  }, [avanzar, pausado]);

  const ir = (i) => setActiva(i);

  return (
    <section
      aria-label="Fachadas de los centros de salud de la red municipal"
      className="relative"
    >
      <div
        className="relative aspect-[4/3] sm:aspect-[16/9] overflow-hidden rounded-3xl border border-white/40 bg-white/80 backdrop-blur-xl shadow-2xl"
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onFocusIn={() => setPausado(true)}
        onFocusOut={() => setPausado(false)}
      >
        {CENTROS.map((centro, i) => (
          <div
            key={centro.nombre}
            className="absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              opacity: i === activa ? 1 : 0,
              transform: `scale(${i === activa ? 1 : 1.05})`,
              zIndex: i === activa ? 1 : 0,
            }}
          >
            <img
              src={centro.archivo}
              alt={`Fachada del ${centro.nombre}`}
              className="w-full h-full object-cover"
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/60 via-black/20 to-transparent z-10" />
            <div className="absolute bottom-4 left-5 right-5 z-20">
              <p className="text-sm sm:text-base font-bold flex items-center gap-2 drop-shadow-lg text-white">
                <span className="w-2 h-2 rounded-full bg-health animate-pulse" />
                {centro.nombre}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Indicadores y navegación */}
      <div className="flex flex-col items-center gap-2 mt-4">
        <div className="flex gap-1.5">
          {CENTROS.map((centro, i) => (
            <button
              key={centro.nombre}
              type="button"
              onClick={() => ir(i)}
              className="p-1.5 tab-interactive"
              aria-label={`Ver ${centro.nombre}`}
              aria-current={i === activa ? 'true' : undefined}
            >
              <span
                className="block rounded-full transition-all duration-300"
                style={{
                  width: i === activa ? 24 : 8,
                  height: 8,
                  background: i === activa ? '#00677d' : '#c3c7cd',
                }}
              />
            </button>
          ))}
        </div>

        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => ir((activa - 1 + CENTROS.length) % CENTROS.length)}
            aria-label="Centro anterior"
            className="p-1.5 rounded-lg border border-outline-variant/60 bg-white text-on-surface-variant hover:bg-surface-container hover:text-secondary transition-colors focus-visible:outline-2 focus-visible:outline-secondary"
          >
            <Icon name="chevron_left" className="text-base" />
          </button>
          <span className="text-on-surface-variant/60 hidden sm:inline">
            {activa + 1} de {CENTROS.length}
          </span>
          <button
            type="button"
            onClick={() => ir((activa + 1) % CENTROS.length)}
            aria-label="Centro siguiente"
            className="p-1.5 rounded-lg border border-outline-variant/60 bg-white text-on-surface-variant hover:bg-surface-container hover:text-secondary transition-colors focus-visible:outline-2 focus-visible:outline-secondary"
          >
            <Icon name="chevron_right" className="text-base" />
          </button>
        </div>
      </div>
    </section>
  );
}

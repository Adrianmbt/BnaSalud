import { useState, useEffect, useCallback } from 'react';

const CENTROS = [
  { nombre: 'Clínica del Niño', logo: '/identidad visual/CliNiño.jpeg', color: '#00b4d8' },
  { nombre: 'CITAB', logo: '/identidad visual/Citab.jpeg', color: '#1d52d8' },
  { nombre: 'Clínica de la Mujer', logo: '/identidad visual/CliMujer.jpeg', color: '#541e8c' },
  { nombre: 'Centro Oncológico', logo: '/identidad visual/Oncologico.jpeg', color: '#6f42c1' },
  { nombre: 'Jornadas de Salud', logo: '/identidad visual/JornadasSaludBna.jpeg', color: '#0d9488' },
  { nombre: 'Clínica Municipal', logo: '/identidad visual/ClinicaMunicipalJosePerezFernandez.jpeg', color: '#059669' },
];

const INTERVALO = 3200;

export default function HeroCarousel() {
  const [activa, setActiva] = useState(0);
  const [dir, setDir] = useState(1);

  const avanzar = useCallback(() => {
    setDir(1);
    setActiva((p) => (p + 1) % CENTROS.length);
  }, []);

  useEffect(() => {
    const id = setInterval(avanzar, INTERVALO);
    return () => clearInterval(id);
  }, [avanzar]);

  const ir = (i) => {
    setDir(i > activa ? 1 : -1);
    setActiva(i);
  };

  const c = CENTROS[activa];

  return (
    <div className="relative w-full">
      {/* Contenedor principal */}
      <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        {/* Imagen activa con transición */}
        <div className="relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden">
          {CENTROS.map((centro, i) => (
            <div
              key={centro.nombre}
              className="absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                opacity: i === activa ? 1 : 0,
                transform: `scale(${i === activa ? 1 : 1.08}) translateX(${i === activa ? 0 : (i > activa ? 30 : -30)}px)`,
                zIndex: i === activa ? 1 : 0,
              }}
            >
              <img
                src={centro.logo}
                alt={centro.nombre}
                className="w-full h-full object-contain p-6 sm:p-8"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}

          {/* Gradiente inferior */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 via-black/20 to-transparent z-10" />

          {/* Nombre del centro activo */}
          <div className="absolute bottom-4 left-5 right-5 z-20">
            <p className="text-white text-sm sm:text-base font-bold flex items-center gap-2 drop-shadow-lg">
              <span
                className="inline-block w-2 h-2 rounded-full animate-pulse"
                style={{ background: c.color }}
              />
              {c.nombre}
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="relative h-1 bg-surface-container z-10">
          {CENTROS.map((centro, i) => (
            <button
              key={centro.nombre}
              onClick={() => ir(i)}
              className="absolute inset-y-0 cursor-pointer group"
              style={{ left: `${(i / CENTROS.length) * 100}%`, width: `${100 / CENTROS.length}%` }}
              aria-label={`Ver ${centro.nombre}`}
            >
              <div className="h-full bg-outline-variant/40 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 transition-[width] duration-300"
                  style={{
                    background: centro.color,
                    width: i === activa ? '100%' : '0%',
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Dots indicadores */}
      <div className="flex justify-center gap-2 mt-4">
        {CENTROS.map((centro, i) => (
          <button
            key={centro.nombre}
            onClick={() => ir(i)}
            className="group relative p-1"
            aria-label={`Centro ${i + 1}: ${centro.nombre}`}
          >
            <span
              className="block rounded-full transition-all duration-300"
              style={{
                width: i === activa ? 20 : 8,
                height: 8,
                background: i === activa ? centro.color : '#c3c7cd',
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

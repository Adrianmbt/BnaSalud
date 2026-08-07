import { useCallback, useEffect, useState } from 'react';
import { API } from '../api';
import Icon from './Icon';

const CENTRO_THEMES = {
  'CLN-NINO': {
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #06b6d4 50%, #0891b2 100%)',
    shadow: 'rgba(6, 182, 212, 0.5)',
  },
  'CLN-CITAB': {
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #1e3a8a 100%)',
    shadow: 'rgba(29, 78, 216, 0.5)',
  },
  'CLN-MUJER': {
    gradient: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 50%, #4c1d95 100%)',
    shadow: 'rgba(107, 33, 168, 0.5)',
  },
  'CLN-ONCO': {
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #581c87 100%)',
    shadow: 'rgba(124, 58, 237, 0.5)',
  },
  'CLN-JORNADAS': {
    gradient: 'linear-gradient(135deg, #2dd4bf 0%, #0d9488 50%, #115e59 100%)',
    shadow: 'rgba(13, 148, 136, 0.5)',
  },
};

function getCentroTheme(c) {
  if (c.codigo && CENTRO_THEMES[c.codigo]) {
    return CENTRO_THEMES[c.codigo];
  }
  const name = (c.nombre || '').toLowerCase();
  if (name.includes('niño') || name.includes('nino')) return CENTRO_THEMES['CLN-NINO'];
  if (name.includes('trabajador') || name.includes('citab')) return CENTRO_THEMES['CLN-CITAB'];
  if (name.includes('mujer')) return CENTRO_THEMES['CLN-MUJER'];
  if (name.includes('oncológico') || name.includes('oncologico')) return CENTRO_THEMES['CLN-ONCO'];
  if (name.includes('jornada')) return CENTRO_THEMES['CLN-JORNADAS'];

  const base = c.fondoColor || '#00677d';
  return {
    gradient: `linear-gradient(135deg, ${base} 0%, ${base}e6 50%, #0f172a 100%)`,
    shadow: 'rgba(0, 0, 0, 0.4)',
  };
}

function CounterStat({ target, label }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let current = 0;
    const increment = Math.ceil(target / 40);
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      setValue(current);
    }, 30);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <div className="bg-white rounded-2xl p-5 text-center shadow-lg border border-outline-variant/10">
      <p className="text-3xl font-extrabold text-primary tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs text-on-surface-variant font-medium mt-1">{label}</p>
    </div>
  );
}

export default function Centros({ onPedirCita }) {
  const [centros, setCentros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await API.getCentros();
      setCentros(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <section id="sedes" className="py-16 md:py-24 bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14" data-aos="fade-up">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary mb-4 border border-secondary/20">Red Asistencial</span>
          <h2 className="text-3xl md:text-4xl font-bold text-primary">Centros de Salud</h2>
          <p className="text-lg text-on-surface-variant mt-3 max-w-3xl mx-auto">
            El Instituto articula una red de centros de salud públicos y conveniados de Barcelona. Todos operan bajo un mismo sistema de historial clínico, referencia de especialistas y farmacia municipal.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14" data-aos="fade-up">
          <CounterStat target={centros.length || 5} label="Centros Activos" />
          <CounterStat target={5} label="Servicios Especializados" />
          <CounterStat target={48} label="Especialistas" />
          <CounterStat target={98} label="Cobertura (%)" />
        </div>

        <div id="centros-grid" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-aos="fade-up">
          {cargando && (
            <div className="col-span-full flex justify-center py-12">
              <div className="flex items-center gap-3 text-on-surface-variant">
                <Icon name="sync" className="animate-spin text-secondary" />
                <span className="text-sm font-medium">Cargando centros de salud aliados desde la API...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 gap-3">
              <Icon name="cloud_off" className="text-4xl text-error" />
              <p className="text-sm font-medium text-on-surface-variant">No se pudieron cargar los centros: {error}</p>
              <button
                onClick={cargar}
                className="mt-2 text-sm font-semibold text-secondary border-2 border-secondary/30 rounded-xl px-6 py-2 hover:bg-secondary hover:text-white transition-all"
              >
                Reintentar
              </button>
            </div>
          )}

          {!cargando && !error && centros.length === 0 && (
            <div className="col-span-full flex justify-center py-12">
              <p className="text-sm font-medium text-on-surface-variant">No hay centros disponibles en este momento.</p>
            </div>
          )}

          {!cargando && !error && centros.map((c) => {
            const theme = getCentroTheme(c);
            return (
              <div key={c.id} className="group bg-white rounded-3xl overflow-hidden shadow-xl border border-outline-variant/20 card-hover flex flex-col">
                <div
                  className="relative h-48 md:h-54 overflow-hidden flex items-center justify-between p-4"
                  style={{ background: theme.gradient }}
                >
                  {/* Destellos de iluminación ambiental */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3),transparent_65%)] pointer-events-none" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.15),transparent_65%)] pointer-events-none" />

                  {/* Etiquetas superiores */}
                  <span className="absolute top-3.5 left-3.5 text-white uppercase tracking-[0.18em] text-[10px] font-extrabold bg-black/35 backdrop-blur-md rounded-full px-3 py-1 border border-white/20 z-10 shadow-sm">
                    {c.parroquia}
                  </span>
                  <span className="absolute top-3.5 right-3.5 bg-white/25 backdrop-blur-md text-white rounded-full px-3 py-1 text-[10px] font-bold shadow-sm border border-white/30 z-10">
                    {c.tipo}
                  </span>

                  {/* Logo 3D con bordes suaves redondeados */}
                  <div className="relative w-full h-full flex items-center justify-end pr-2 pt-6 z-0">
                    <div className="relative transition-all duration-300 group-hover:scale-[1.06] group-hover:-translate-y-1">
                      {/* Sombra 3D difuminada posterior */}
                      <div
                        className="absolute -inset-1.5 rounded-2xl opacity-60 blur-md transition-all duration-300 group-hover:opacity-90 group-hover:blur-lg"
                        style={{ backgroundColor: theme.shadow }}
                      />

                      {/* Tarjeta contenedora del logo 3D */}
                      <div className="relative rounded-full p-1.5 bg-white/20 backdrop-blur-md border-2 border-white/90 shadow-[0_14px_28px_-6px_rgba(0,0,0,0.4),0_6px_12px_-4px_rgba(0,0,0,0.25)] ring-1 ring-black/10 overflow-hidden">
                        <img
                          src={c.logo}
                          alt={`Logo ${c.nombre}`}
                          className="h-20 md:h-24 w-auto object-contain rounded-full transition-transform duration-300 group-hover:rotate-1"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-3 flex-1 flex flex-col">
                  <div>
                    <h3 className="text-xl font-extrabold text-primary leading-tight">{c.nombre}</h3>
                    <p className="text-xs font-semibold text-secondary mt-0.5">{c.subtitulo}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <Icon name="location_on" filled className="text-sm text-secondary" />
                    {c.direccion}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <Icon name="schedule" filled className="text-sm text-secondary" />
                    {c.horario}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {c.servicios.map((s) => (
                      <span key={s} className="px-2.5 py-1 bg-secondary/10 text-secondary rounded-full text-[10px] font-semibold">{s}</span>
                    ))}
                  </div>
                  <button
                    disabled={c.disabled}
                    onClick={() => onPedirCita(c)}
                    className={`w-full mt-auto pt-2 text-sm font-semibold text-secondary border-2 border-secondary/30 rounded-xl py-2.5 hover:bg-secondary hover:text-white transition-all flex items-center justify-center gap-1.5 ${c.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {c.disabled ? (
                      <>
                        <Icon name="construction" className="text-sm" /> Próximamente
                      </>
                    ) : (
                      <>
                        <Icon name="calendar_month" className="text-sm" /> Pedir Cita
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}


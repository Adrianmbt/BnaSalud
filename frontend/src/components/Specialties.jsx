import { useEffect, useState } from 'react';
import Icon from './Icon';

const COLORES = {
  'CLN-CITAB': '#1d52d8',
  'CLN-MUJER': '#541e8c',
  'CLN-NINO': '#00b4d8',
  'CLN-ONCO': '#6f42c1',
  'CLN-JORNADAS': '#0d9488',
  'CLN-MUNICIPAL': '#059669',
};

const FALLBACK = [
  { id: 2, nombre: 'Clínica de los Trabajadores (CITAB)', codigo: 'CLN-CITAB', servicios: [] },
  { id: 3, nombre: 'Clínica de la Mujer', codigo: 'CLN-MUJER', servicios: [] },
  { id: 1, nombre: 'Clínica del Niño', codigo: 'CLN-NINO', servicios: [] },
  { id: 4, nombre: 'Centro Oncológico Municipal', codigo: 'CLN-ONCO', servicios: [] },
  { id: 5, nombre: 'Jornadas de Salud Móviles', codigo: 'CLN-JORNADAS', servicios: [] },
  { id: 6, nombre: 'Clínica Municipal José Pérez Fernández', codigo: 'CLN-MUNICIPAL', servicios: [] },
];

export default function Specialties() {
  const [centros, setCentros] = useState([]);
  const [activo, setActivo] = useState(null);

  useEffect(() => {
    fetch('/api/v1/centros')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length) {
          setCentros(data);
          setActivo(data[0].id);
        } else {
          setCentros(FALLBACK);
          setActivo(FALLBACK[0].id);
        }
      })
      .catch(() => {
        setCentros(FALLBACK);
        setActivo(FALLBACK[0].id);
      });
  }, []);

  const centroActual = centros.find((c) => c.id === activo);
  const servicios = centroActual?.servicios || [];
  const color = COLORES[centroActual?.codigo] || '#00677d';

  return (
    <section id="servicios" className="py-14 md:py-20 bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto px-5">
        {/* Encabezado */}
        <div className="text-center mb-8" data-aos="fade-up">
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary/10 text-secondary mb-3 border border-secondary/20">
            Red de Salud
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-primary">
            Especialidades Médicas
          </h2>
          <p className="text-sm text-on-surface-variant mt-2 max-w-xl mx-auto">
            Selecciona un centro para ver sus especialidades disponibles.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-8" data-aos="fade-up" data-aos-delay="80">
          {centros.map((c) => {
            const cColor = COLORES[c.codigo] || '#00677d';
            const esActivo = activo === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActivo(c.id)}
                className="relative px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                style={{
                  background: esActivo ? cColor : '#fff',
                  color: esActivo ? '#fff' : cColor,
                  border: `2px solid ${esActivo ? cColor : `${cColor}25`}`,
                  boxShadow: esActivo ? `0 2px 10px ${cColor}30` : 'none',
                }}
              >
                <span className="flex items-center gap-1.5">
                  <img
                    src={c.logo || '/identidad visual/SBna.jpeg'}
                    alt=""
                    className="w-4 h-4 rounded object-contain"
                    loading="lazy"
                  />
                  <span className="hidden sm:inline">{c.nombre}</span>
                  <span className="sm:hidden">{c.nombre.split(' ')[0]}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid de servicios del centro activo */}
        {centroActual && (
          <div data-aos="fade-up" data-aos-delay="120">
            {/* Encabezado del centro */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${color}15` }}
              >
                <span style={{ color }}>
                  <Icon name="medical_services" className="text-base" />
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">{centroActual.nombre}</h3>
                <p className="text-[10px] text-on-surface-variant">
                  {servicios.length} especialidades disponibles
                </p>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {servicios.map((serv, i) => (
                <div
                  key={`${centroActual.id}-${serv}`}
                  className="group bg-white rounded-xl p-3 border border-outline-variant/15 hover:shadow-md transition-all duration-200"
                  style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${color}12`, color }}
                    >
                      <Icon name="check" className="text-[10px]" />
                    </span>
                    <p className="text-[11px] font-semibold text-primary leading-tight">
                      {serv}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {servicios.length === 0 && (
              <p className="text-center text-sm text-on-surface-variant py-8">
                No hay servicios registrados para este centro.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

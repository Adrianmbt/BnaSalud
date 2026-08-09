import { useCallback, useEffect, useState } from 'react';
import { API } from '../api';
import Icon from './Icon';
import LogoPlate from './LogoPlate';
import { getCentroTheme } from '../centroTheme';

const BADGE_PARROQUIA =
  'absolute top-4 left-4 z-10 text-white uppercase tracking-[0.18em] text-[10px] font-extrabold bg-black/35 backdrop-blur-md rounded-full px-3 py-1 border border-white/20 shadow-sm';
const BADGE_TIPO =
  'absolute top-4 right-4 z-10 bg-white/25 backdrop-blur-md text-white rounded-full px-3 py-1 text-[10px] font-bold shadow-sm border border-white/30';

function CentroCTA({ centro, onPedirCita, variante = 'outline' }) {
  const base =
    variante === 'solid'
      ? 'btn-primary text-white'
      : 'text-secondary border-2 border-secondary/30 hover:bg-secondary hover:text-white';
  return (
    <button
      disabled={centro.disabled}
      onClick={() => onPedirCita(centro)}
      aria-label={centro.disabled ? `Cita en ${centro.nombre} próximamente` : `Pedir cita en ${centro.nombre}`}
      className={`w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 ${base} ${centro.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {centro.disabled ? (
        <>
          <Icon name="construction" className="text-sm" /> Próximamente
        </>
      ) : (
        <>
          <Icon name="calendar_month" className="text-sm" /> Pedir Cita
        </>
      )}
    </button>
  );
}

function CentroMeta({ icono, texto }) {
  return (
    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
      <Icon name={icono} filled className="text-sm text-secondary" />
      {texto}
    </div>
  );
}

function Servicios({ servicios, limite }) {
  const lista = limite ? servicios.slice(0, limite) : servicios;
  return (
    <div className="flex flex-wrap gap-1.5">
      {lista.map((s) => (
        <span key={s} className="px-2.5 py-1 bg-secondary/10 text-secondary rounded-full text-[10px] font-semibold">
          {s}
        </span>
      ))}
      {limite && servicios.length > limite && (
        <span className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant rounded-full text-[10px] font-semibold">
          +{servicios.length - limite} más
        </span>
      )}
    </div>
  );
}

function TarjetaDestacada({ centro, onPedirCita }) {
  const theme = getCentroTheme(centro);
  const piloto = centro.codigo === 'CLN-CITAB' && !centro.disabled;

  return (
    <article
      className="group relative overflow-hidden rounded-4xl bg-white border border-outline-variant/20 shadow-2xl card-hover"
      data-aos="fade-up"
    >
      <div className="grid lg:grid-cols-5">
        <div
          className="lg:col-span-2 relative h-64 md:h-auto min-h-[280px] overflow-hidden p-6 md:p-10 flex items-center justify-center"
          style={{ background: theme.gradient }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.35),transparent_60%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_85%,rgba(0,0,0,0.18),transparent_60%)] pointer-events-none" />

          <span className={BADGE_PARROQUIA}>{centro.parroquia}</span>
          <span className={BADGE_TIPO}>{centro.tipo}</span>
          {piloto && (
            <span className="absolute bottom-4 left-4 z-10 inline-flex items-center gap-1.5 bg-secondary text-white rounded-full px-3 py-1 text-[10px] font-extrabold shadow-lg">
              <Icon name="flash_on" filled className="text-xs" /> Reserva en línea habilitada
            </span>
          )}

          <LogoPlate src={centro.logo} alt={centro.nombre} theme={theme} size="lg" />
        </div>

        <div className="lg:col-span-3 p-7 md:p-10 flex flex-col">
          <h3 className="text-2xl md:text-3xl font-extrabold text-primary leading-tight">{centro.nombre}</h3>
          <p className="text-sm font-semibold text-secondary mt-1">{centro.subtitulo}</p>

          <div className="grid sm:grid-cols-2 gap-2.5 mt-5">
            <CentroMeta icono="location_on" texto={centro.direccion} />
            <CentroMeta icono="schedule" texto={centro.horario} />
          </div>

          <div className="mt-5">
            <Servicios servicios={centro.servicios} />
          </div>

          <div className="mt-auto pt-7 flex flex-wrap items-center gap-4">
            <CentroCTA centro={centro} onPedirCita={onPedirCita} variante="solid" />
            {piloto && (
              <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
                <Icon name="verified" filled className="text-sm text-secondary" />
                Proceso 100% digital, sin filas
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function TarjetaCentro({ centro, indice, onPedirCita }) {
  const theme = getCentroTheme(centro);

  return (
    <article
      className="group relative overflow-hidden rounded-4xl bg-white border border-outline-variant/20 shadow-xl card-hover flex flex-col"
      data-aos="fade-up"
      data-aos-delay={100 + indice * 80}
    >
      <div
        className="relative h-40 overflow-hidden"
        style={{ background: theme.gradient }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.15),transparent_60%)] pointer-events-none" />

        <span className={BADGE_PARROQUIA}>{centro.parroquia}</span>
        <span className={BADGE_TIPO}>{centro.tipo}</span>
        <span className="absolute bottom-2.5 left-4 z-0 text-4xl font-extrabold text-white/25 select-none">
          {String(indice).padStart(2, '0')}
        </span>

        <div className="absolute inset-0 flex items-center justify-center">
          <LogoPlate src={centro.logo} alt={centro.nombre} theme={theme} size="md" />
        </div>
      </div>

      <div className="p-6 space-y-3 flex-1 flex flex-col">
        <div>
          <h3 className="text-lg font-extrabold text-primary leading-tight">{centro.nombre}</h3>
          <p className="text-xs font-semibold text-secondary mt-0.5">{centro.subtitulo}</p>
        </div>
        <CentroMeta icono="location_on" texto={centro.direccion} />
        <CentroMeta icono="schedule" texto={centro.horario} />
        <div className="mt-1">
          <Servicios servicios={centro.servicios} limite={3} />
        </div>
        <div className="mt-auto pt-3">
          <CentroCTA centro={centro} onPedirCita={onPedirCita} />
        </div>
      </div>
    </article>
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

  const featured =
    centros.find((c) => c.codigo === 'CLN-CITAB' && !c.disabled) ||
    centros.find((c) => !c.disabled) ||
    centros[0];
  const resto = centros.filter((c) => c !== featured);

  return (
    <section id="sedes" className="py-16 md:py-24 bg-surface-container-lowest relative overflow-hidden">
      <div className="absolute -top-20 right-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 -left-24 w-80 h-80 bg-tertiary-fixed-dim/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 relative">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14" data-aos="fade-up">
          <div className="max-w-2xl">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary mb-4 border border-secondary/20">
              Red Asistencial · {centros.length || 5} Centros
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-primary tracking-tight leading-tight">
              Una red completa de salud, <span className="text-secondary">cerca de ti</span>
            </h2>
            <p className="text-lg text-on-surface-variant mt-4 leading-relaxed">
              El Instituto articula una red de centros de salud públicos y conveniados de Barcelona. Todos operan bajo un mismo sistema de historial clínico, referencia de especialistas y farmacia municipal.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 pb-2 shrink-0">
            <div className="flex -space-x-2">
              {centros.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="w-9 h-9 rounded-full ring-2 ring-white shadow-md"
                  style={{ background: getCentroTheme(c).gradient }}
                />
              ))}
            </div>
            <p className="text-sm font-semibold text-on-surface-variant max-w-[10rem]">
              Cinco sedes integradas al municipio
            </p>
          </div>
        </div>

        {cargando && (
          <div className="flex justify-center py-16">
            <div className="flex items-center gap-3 text-on-surface-variant">
              <Icon name="sync" className="animate-spin text-secondary" />
              <span className="text-sm font-medium">Cargando centros de salud aliados desde la API...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
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
          <div className="flex justify-center py-16">
            <p className="text-sm font-medium text-on-surface-variant">No hay centros disponibles en este momento.</p>
          </div>
        )}

        {!cargando && !error && centros.length > 0 && (
          <>
            {featured && <TarjetaDestacada centro={featured} onPedirCita={onPedirCita} />}

            {resto.length > 0 && (
              <div className="grid md:grid-cols-2 gap-6 mt-6">
                {resto.map((c, i) => (
                  <TarjetaCentro key={c.id} centro={c} indice={i + 1} onPedirCita={onPedirCita} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

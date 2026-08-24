import { useCallback, useEffect, useState } from 'react';
import { API } from '../api';
import Icon from './Icon';
import LogoPlate from './LogoPlate';
import { getCentroTheme } from '../centroTheme';

/* ============================================================
   Red de Centros · selección de sede y entrada al agendado.
   Grid uniforme y responsive: la identidad de cada centro vive
   en una barra de acento y en el color del CTA (centroTheme),
   sin bloques de gradiente que rompan el ritmo visual.
   ============================================================ */

const CARD_BASE =
  'group relative flex flex-col overflow-hidden rounded-3xl bg-white border border-outline-variant/40 shadow-sm transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-[color:var(--centro-accent)] hover:shadow-xl focus-within:border-secondary';

function ChipEstado({ centro }) {
  if (centro.disabled) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
        <Icon name="construction" filled className="text-xs" /> Próximamente
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
      </span>
      Reserva en línea
    </span>
  );
}

function CentroMeta({ icono, texto }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px] leading-snug text-on-surface-variant">
      <Icon name={icono} className="mt-px shrink-0 text-base text-secondary" />
      <span>{texto}</span>
    </div>
  );
}

function Servicios({ servicios, limite = 3 }) {
  if (!servicios?.length) return null;
  const lista = servicios.slice(0, limite);
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`Servicios: ${servicios.join(', ')}`}>
      {lista.map((s) => (
        <span key={s} className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
          {s}
        </span>
      ))}
      {servicios.length > limite && (
        <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
          +{servicios.length - limite} más
        </span>
      )}
    </div>
  );
}

function TarjetaCentro({ centro, indice, onPedirCita }) {
  const theme = getCentroTheme(centro);

  return (
    <article
      className={`${CARD_BASE} w-full sm:w-[calc(50%-0.75rem)] xl:w-[calc(33.333%-1rem)]`}
      style={{ '--centro-accent': theme.accent }}
      data-aos="fade-up"
      data-aos-delay={(indice % 3) * 90}
    >
      {/* Barra de identidad del centro */}
      <div className="h-1.5 w-full shrink-0" style={{ background: theme.gradient }} aria-hidden="true" />

      <div className="flex flex-1 flex-col gap-4 p-6">
        {/* Encabezado: logo compacto + estado */}
        <div className="flex items-start justify-between gap-3">
          <LogoPlate src={centro.logo} alt={centro.nombre} theme={theme} size="sm" />
          <ChipEstado centro={centro} />
        </div>

        <div>
          <h3 className="text-lg font-extrabold leading-tight text-primary">{centro.nombre}</h3>
          <p className="mt-0.5 text-xs font-semibold text-secondary">{centro.subtitulo}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            <Icon name={centro.codigo === 'CLN-JORNADAS' ? 'directions_bus' : 'local_hospital'} className="text-xs" />
            {centro.tipo}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            <Icon name="location_on" className="text-xs" />
            {centro.parroquia}
          </span>
        </div>

        <div className="space-y-2 border-t border-outline-variant/30 pt-4">
          <CentroMeta icono="location_on" texto={centro.direccion} />
          <CentroMeta icono="schedule" texto={centro.horario} />
        </div>

        <Servicios servicios={centro.servicios} />

        <div className="mt-auto pt-2">
          {centro.disabled ? (
            <span
              className="flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant/60 px-4 py-2.5 text-sm font-semibold text-on-surface-variant/70"
              aria-disabled="true"
            >
              <Icon name="hourglass_empty" className="text-base" /> Muy pronto podrás agendar aquí
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onPedirCita(centro)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-200 ease-out hover:shadow-lg active:scale-[0.98]"
              style={{ background: theme.gradient }}
              aria-label={`Pedir cita en ${centro.nombre}`}
            >
              Pedir cita
              <Icon name="arrow_forward" className="text-base transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function TarjetaEsqueleto() {
  return (
    <div className="w-full animate-pulse sm:w-[calc(50%-0.75rem)] xl:w-[calc(33.333%-1rem)]" aria-hidden="true">
      <div className="flex flex-col gap-4 rounded-3xl border border-outline-variant/30 bg-white p-6">
        <div className="h-1.5 -mx-6 -mt-6 mb-1 rounded-t-3xl bg-surface-container-high" />
        <div className="h-14 w-16 rounded-xl bg-surface-container-high" />
        <div className="space-y-2">
          <div className="h-5 w-3/4 rounded bg-surface-container-high" />
          <div className="h-3 w-1/2 rounded bg-surface-container" />
        </div>
        <div className="space-y-2 border-t border-outline-variant/20 pt-4">
          <div className="h-3 w-full rounded bg-surface-container" />
          <div className="h-3 w-2/3 rounded bg-surface-container" />
        </div>
        <div className="min-h-11 rounded-xl bg-surface-container-high" />
      </div>
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

  const activos = centros.filter((c) => !c.disabled).length;
  const parroquias = [...new Set(centros.map((c) => c.parroquia).filter(Boolean))].length;

  return (
    <section id="sedes" className="relative overflow-hidden bg-surface-container-lowest py-16 md:py-24" aria-labelledby="sedes-titulo">
      <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-secondary/5 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Encabezado */}
        <div className="mb-10 max-w-3xl md:mb-12" data-aos="fade-up">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/10 px-4 py-1.5 text-xs font-semibold text-secondary">
            <Icon name="domain" className="text-sm" />
            Red Asistencial Municipal
          </span>
          <h2 id="sedes-titulo" className="text-3xl font-extrabold leading-tight tracking-tight text-primary md:text-5xl">
            Elige tu centro de salud, <span className="text-secondary">agenda en minutos</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-on-surface-variant md:text-lg">
            Todos los centros comparten un mismo sistema de historia clínica, referencia a
            especialistas y farmacia municipal. Elige el más cercano y pide tu cita en línea.
          </p>

          {/* Resumen de la red */}
          <dl className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
            {[
              { icono: 'apartment', valor: centros.length || '—', etiqueta: 'Centros' },
              { icono: 'location_on', valor: parroquias || '—', etiqueta: 'Parroquias' },
              { icono: 'volunteer_activism', valor: `${activos}`, etiqueta: 'Con cita en línea' },
            ].map((s) => (
              <div key={s.etiqueta} className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <Icon name={s.icono} filled className="text-base" />
                </span>
                <div>
                  <dd className="text-lg font-extrabold leading-none text-primary tabular-nums">{s.valor}</dd>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">{s.etiqueta}</dt>
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/* Estados */}
        {cargando && (
          <div className="flex flex-wrap justify-center gap-6" role="status" aria-label="Cargando centros">
            {[...Array(6)].map((_, i) => (
              <TarjetaEsqueleto key={i} />
            ))}
          </div>
        )}

        {error && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-error/20 bg-error-container/50 px-6 py-12 text-center">
            <Icon name="cloud_off" className="text-4xl text-error" />
            <p className="text-sm font-medium text-on-surface-variant">No se pudieron cargar los centros: {error}</p>
            <button
              type="button"
              onClick={cargar}
              className="btn-outline mt-2 min-h-11 rounded-xl px-6 py-2.5 text-sm font-semibold"
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && centros.length === 0 && (
          <p className="py-16 text-center text-sm font-medium text-on-surface-variant">
            No hay centros disponibles en este momento.
          </p>
        )}

        {/* Grid uniforme: última fila centrada en escritorio */}
        {!cargando && !error && centros.length > 0 && (
          <div className="flex flex-wrap justify-center gap-6">
            {centros.map((c, i) => (
              <TarjetaCentro key={c.id ?? c.codigo ?? i} centro={c} indice={i} onPedirCita={onPedirCita} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

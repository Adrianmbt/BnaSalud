import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API } from '../api';
import Icon from './Icon';
import { getCentroTheme } from '../centroTheme';


// Normaliza para comparar sin depender de tildes ni mayúsculas
// (la base mezcla "Cardiologia" y "Cardiología").
const sinTildes = (texto = '') =>
  String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Icono por familia de especialidad. Solo símbolos de Material Symbols
// garantizados: si no coincide ninguno, se usa el genérico.
const ICONOS = [
  ['cardiolog', 'favorite'],
  ['pediatr', 'child_care'],
  ['nino sano', 'child_care'],
  ['ginecolog', 'pregnant_woman'],
  ['obstetr', 'pregnant_woman'],
  ['parto', 'pregnant_woman'],
  ['cervico', 'pregnant_woman'],
  ['matern', 'pregnant_woman'],
  ['traumatolog', 'healing'],
  ['fisiatr', 'healing'],
  ['fisioterapia', 'healing'],
  ['cirugia', 'healing'],
  ['ortoped', 'healing'],
  ['oftalmolog', 'visibility'],
  ['odontolog', 'dentistry'],
  ['laboratorio', 'science'],
  ['patolog', 'science'],
  ['biopsia', 'science'],
  ['citolog', 'science'],
  ['ecograf', 'image'],
  ['mamograf', 'image'],
  ['imagen', 'image'],
  ['inmuniz', 'vaccines'],
  ['vacun', 'vaccines'],
  ['psiquiatr', 'psychology'],
  ['psicolog', 'psychology'],
  ['psicopedagog', 'psychology'],
  ['terapia', 'psychology'],
  ['oncolog', 'monitor_heart'],
  ['quimioterapia', 'monitor_heart'],
  ['paliativ', 'monitor_heart'],
  ['radioterapia', 'monitor_heart'],
  ['nefrolog', 'water_drop'],
  ['urolog', 'water_drop'],
  ['endocrin', 'bloodtype'],
  ['neumolog', 'air'],
  ['respirat', 'air'],
  ['alergolog', 'masks'],
  ['epidemiolog', 'public'],
  ['despistaje', 'public'],
  ['emergencia', 'emergency'],
  ['atencion primaria', 'medical_services'],
  ['nutricion', 'bloodtype'],
];

function iconoDe(nombre) {
  const clave = sinTildes(nombre);
  const encontrado = ICONOS.find(([fragmento]) => clave.includes(fragmento));
  return encontrado ? encontrado[1] : 'medical_services';
}

function Estadisticas({ centros, total }) {
  const parroquias = new Set(centros.map((c) => c.parroquia).filter(Boolean)).size;
  const datos = [
    { icono: 'apartment', valor: centros.length, etiqueta: 'Centros' },
    { icono: 'medical_services', valor: total, etiqueta: 'Especialidades' },
    { icono: 'location_on', valor: parroquias, etiqueta: 'Parroquias' },
  ];
  return (
    <dl className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
      {datos.map((d) => (
        <div key={d.etiqueta} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-health-soft text-health-dark">
            <Icon name={d.icono} filled className="text-sm" />
          </span>
          <div>
            <dd className="text-base font-extrabold leading-none text-primary tabular-nums">
              {d.valor || '—'}
            </dd>
            <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              {d.etiqueta}
            </dt>
          </div>
        </div>
      ))}
    </dl>
  );
}

function Esqueleto() {
  return (
    <div role="status" aria-label="Cargando especialidades de la red de salud" className="py-8">
      <div className="mt-8 flex flex-wrap justify-center gap-2" aria-hidden="true">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-12 w-40 rounded-xl" />
        ))}
      </div>
      <div
        className="mt-6 overflow-hidden rounded-3xl border border-outline-variant/40 bg-white"
        aria-hidden="true"
      >
        <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-lowest p-5">
          <div className="skeleton h-11 w-11 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-2/5" />
            <div className="skeleton h-2.5 w-1/4" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-xl" />
          ))}
        </div>
      </div>
      <span className="sr-only">Cargando especialidades…</span>
    </div>
  );
}

export default function Specialties() {
  const [centros, setCentros] = useState([]);
  const [activo, setActivo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const tabsRef = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await API.getCentros();
      const lista = (Array.isArray(data) ? data : []).filter(Boolean);
      setCentros(lista);
      setActivo((previo) =>
        lista.some((c) => c.id === previo) ? previo : (lista[0]?.id ?? null),
      );
    } catch (err) {
      setCentros([]);
      setActivo(null);
      setError(err?.message || 'No se pudo consultar la red de salud.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totalEspecialidades = useMemo(() => {
    const unicas = new Set();
    centros.forEach((c) => (c.servicios || []).forEach((s) => unicas.add(sinTildes(s).trim())));
    return unicas.size;
  }, [centros]);

  const centroActual = centros.find((c) => c.id === activo) || null;
  const servicios = centroActual?.servicios || [];
  const tema = getCentroTheme(centroActual || {});
  const indiceActivo = centros.findIndex((c) => c.id === activo);

  // Navegación por teclado del tablist (patrón WAI-ARIA de pestañas).
  const navegarTabs = (evento) => {
    if (!centros.length) return;
    const total = centros.length;
    let destino = null;
    if (evento.key === 'ArrowRight') destino = (indiceActivo + 1) % total;
    else if (evento.key === 'ArrowLeft') destino = (indiceActivo - 1 + total) % total;
    else if (evento.key === 'Home') destino = 0;
    else if (evento.key === 'End') destino = total - 1;
    if (destino === null) return;
    evento.preventDefault();
    const siguiente = centros[destino];
    setActivo(siguiente.id);
    const boton = tabsRef.current?.querySelector(`#tab-${siguiente.id}`);
    boton?.focus();
    boton?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <section
      id="servicios"
      className="relative overflow-hidden bg-surface-container-lowest py-14 md:py-20"
      aria-labelledby="especialidades-titulo"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-secondary/5 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-health/10 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-health/30 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center" data-aos="fade-up">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-health/25 bg-health-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-health-dark">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-health opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-health" />
            </span>
            Red de Salud Municipal
          </span>

          <h2
            id="especialidades-titulo"
            className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-primary md:text-4xl"
          >
            Especialidades médicas{' '}
            <span className="bg-gradient-to-r from-secondary to-health bg-clip-text text-transparent">
              cerca de ti
            </span>
          </h2>

          <p className="mx-auto mt-2.5 max-w-xl text-xs leading-relaxed text-on-surface-variant md:text-sm">
            Explora qué atiende cada centro de la red municipal y elige dónde cuidarte.
            Sin filas ni llamadas: la cita se gestiona desde el portal.
          </p>

          {!error && <Estadisticas centros={centros} total={totalEspecialidades} />}
        </div>

        <p className="sr-only" aria-live="polite">
          {cargando
            ? 'Cargando especialidades'
            : centroActual
              ? `${servicios.length} especialidades en ${centroActual.nombre}`
              : ''}
        </p>

        {cargando && <Esqueleto />}

        {!cargando && error && (
          <div
            role="alert"
            className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-error/20 bg-error-container/40 px-6 py-10 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-error shadow-sm">
              <Icon name="cloud_off" className="text-2xl" />
            </span>
            <div>
              <p className="text-sm font-bold text-primary">
                No pudimos cargar las especialidades
              </p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                Revisa tu conexión e inténtalo de nuevo. La información clínica no se ve
                afectada.
              </p>
            </div>
            <button
              type="button"
              onClick={cargar}
              className="btn-outline min-h-9 rounded-lg px-5 text-[11px] font-bold"
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && centros.length === 0 && (
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-outline-variant/50 bg-white px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <Icon name="apartment" className="text-2xl" />
            </span>
            <div>
              <p className="text-sm font-bold text-primary">No hay centros activos</p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                Estamos actualizando la red de salud municipal. Vuelve en un rato.
              </p>
            </div>
          </div>
        )}

        {!cargando && !error && centros.length > 0 && (
          <>
            <div
              className="-mx-4 mt-7 overflow-x-auto px-4 pb-1 scrollbar-hide sm:mx-0 sm:overflow-visible sm:px-0"
              data-aos="fade-up"
              data-aos-delay="60"
            >
              <div
                ref={tabsRef}
                role="tablist"
                aria-label="Centros de salud de la red municipal"
                onKeyDown={navegarTabs}
                className="flex snap-x snap-mandatory items-stretch gap-2 sm:flex-wrap sm:justify-center sm:gap-2.5"
              >
                {centros.map((centro) => {
                  const temaTab = getCentroTheme(centro);
                  const esActivo = centro.id === activo;
                  const cantidad = (centro.servicios || []).length;
                  return (
                    <button
                      key={centro.id}
                      type="button"
                      role="tab"
                      id={`tab-${centro.id}`}
                      aria-selected={esActivo}
                      aria-controls={`panel-${centro.id}`}
                      tabIndex={esActivo ? 0 : -1}
                      onClick={() => setActivo(centro.id)}
                      title={centro.nombre}
                      className={`group flex shrink-0 snap-start items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 tab-interactive ${
                        esActivo ? 'bg-white' : 'bg-white/50 hover:bg-white'
                      }`}
                      style={{
                        borderColor: esActivo ? temaTab.accent : 'transparent',
                        boxShadow: esActivo
                          ? `0 10px 24px -16px ${temaTab.accent}`
                          : 'inset 0 0 0 1px rgba(195, 199, 205, 0.5)',
                      }}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 ring-1 ring-black/5">
                        <img
                          src={centro.logo || '/identidad visual/SBna.jpeg'}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[10rem] truncate text-[11px] font-bold leading-tight text-primary">
                          {centro.nombre}
                        </span>
                        <span
                          className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.1em]"
                          style={{ color: esActivo ? temaTab.accentDark : 'var(--color-on-surface-variant)' }}
                        >
                          {cantidad} {cantidad === 1 ? 'especialidad' : 'especialidades'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {centroActual && (
              <div
                key={centroActual.id}
                role="tabpanel"
                id={`panel-${centroActual.id}`}
                aria-labelledby={`tab-${centroActual.id}`}
                tabIndex={0}
                className="tab-fade mt-6 overflow-hidden rounded-3xl border border-outline-variant/40 bg-white shadow-sm"
              >
                <div
                  className="relative flex flex-wrap items-center gap-3 border-b border-outline-variant/40 p-4 sm:p-5"
                  style={{
                    background: `linear-gradient(120deg, ${tema.softLow || '#f8f9ff'} 0%, #ffffff 65%)`,
                  }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
                    <img
                      src={centroActual.logo || '/identidad visual/SBna.jpeg'}
                      alt={`Logo de ${centroActual.nombre}`}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-extrabold leading-tight text-primary sm:text-base">
                      {centroActual.nombre}
                    </h3>
                    <p
                      className="mt-0.5 text-[11px] font-semibold"
                      style={{ color: tema.accentDark }}
                    >
                      {centroActual.subtitulo}
                    </p>
                  </div>

                  <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                    {centroActual.tipo && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant/60 bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
                        <Icon
                          name={centroActual.codigo === 'CLN-JORNADAS' ? 'directions_bus' : 'local_hospital'}
                          className="text-[10px]"
                        />
                        {centroActual.tipo}
                      </span>
                    )}
                    {centroActual.parroquia && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant/60 bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
                        <Icon name="location_on" className="text-[10px]" />
                        {centroActual.parroquia}
                      </span>
                    )}
                    {centroActual.disabled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
                        <Icon name="construction" filled className="text-[10px]" />
                        Próximamente
                      </span>
                    )}
                  </div>
                </div>

                {servicios.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                      <Icon name="stethoscope" className="text-2xl" />
                    </span>
                    <p className="text-sm font-bold text-primary">
                      Aún no hay especialidades publicadas
                    </p>
                    <p className="max-w-xs text-xs leading-relaxed text-on-surface-variant">
                      Este centro está actualizando su oferta médica. Consulta otro centro de
                      la red o acércate a recepción.
                    </p>
                  </div>
                ) : (
                  <>
                    <ul
                      className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4"
                      aria-label={`Especialidades de ${centroActual.nombre}`}
                    >
                      {servicios.map((servicio) => (
                        <li
                          key={servicio}
                          className="group flex items-start gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest/70 p-2.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[color:var(--acento)] hover:bg-white hover:shadow-sm card-hover-effect"
                          style={{ '--acento': tema.accent }}
                        >
                          <span
                            className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                            style={{ background: tema.soft, color: tema.accentDark }}
                          >
                            <Icon name={iconoDe(servicio)} className="text-[15px]" />
                          </span>
                          <span className="min-w-0 text-[11px] font-bold leading-snug text-primary">
                            {servicio}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/40 bg-surface-container-lowest/60 px-4 py-2.5 sm:px-5">
                      <p className="text-[10px] font-medium text-on-surface-variant">
                        {servicios.length} especialidades en {centroActual.nombre}
                      </p>
                      <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-health-dark">
                        <Icon name="calendar_month" className="text-[12px]" />
                        agenda disponible desde el portal
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

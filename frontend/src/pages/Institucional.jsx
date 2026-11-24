import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { EsqueletoKpi, EsqueletoPanelBarras, EsqueletoTablaCentros } from '../components/Skeletons';
import { EstadoVacio } from '../components/Estado';
import { PanelSoporte } from './Soporte';
import {
  API,
  guardarSesionInstitucional,
  leerSesionInstitucional,
  cerrarSesionInstitucional,
} from '../api';

const ROLES = {
  admin_sistemas: {
    etiqueta: 'Encargado de Sistemas',
    icono: 'admin_panel_settings',
    descripcion: 'Acceso total al panel y a los indicadores de la red.',
  },
  director: {
    etiqueta: 'Administración Ejecutiva',
    insignia: 'Administración General',
    icono: 'shield_person',
    descripcion: 'Indicadores globales de todos los centros de salud.',
  },
};

const formatoNumero = new Intl.NumberFormat('es-VE');

function numero(valor) {
  return formatoNumero.format(Number(valor) || 0);
}

function iniciales(nombre = '') {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');
}

function fechaHora(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' });
}

/* ═════════════════════════════════════════════════════════════════
   Sesión
   ═════════════════════════════════════════════════════════════════ */

function useSesionInstitucional() {
  const [sesion, setSesion] = useState(() => leerSesionInstitucional());

  const entrar = useCallback((respuesta) => {
    guardarSesionInstitucional(respuesta.token, respuesta.usuario);
    setSesion({ token: respuesta.token, usuario: respuesta.usuario });
  }, []);

  const salir = useCallback(() => {
    cerrarSesionInstitucional();
    setSesion(null);
  }, []);

  return { sesion, entrar, salir };
}

/* ═════════════════════════════════════════════════════════════════
   Piezas de interfaz
   ═════════════════════════════════════════════════════════════════ */

function Marca({ compacta = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-white/20">
        <img
          src="/identidad visual/InstitutoSalud.jpeg"
          alt="Instituto de Salud del Municipio Simón Bolívar"
          className="h-full w-full object-contain p-1"
        />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-semibold text-white">
          Panel Institucional
        </span>
        {!compacta && (
          <span className="block text-[11px] uppercase tracking-[0.18em] text-white/55">
            Instituto de Salud · BnaSalud
          </span>
        )}
      </span>
    </div>
  );
}

/* ── Paleta de datos: solo tokens institucionales ya definidos ── */
const COLOR_ESTADO = {
  confirmada: 'var(--color-secondary)',
  pendiente: 'var(--color-amber)',
  completada: 'var(--color-health)',
  finalizada: 'var(--color-health)',
  en_consulta: 'var(--color-secondary-light)',
  cancelada: 'var(--color-blood)',
  no_asistio: 'var(--color-outline)',
};

const ETIQUETA_ESTADO = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  completada: 'Completada',
  finalizada: 'Finalizada',
  en_consulta: 'En consulta',
  no_asistio: 'No asistió',
  sin_estado: 'Sin estado',
};

const COLORES_CARGO = [
  'var(--color-secondary)',
  'var(--color-health)',
  'var(--color-secondary-light)',
  'var(--color-amber)',
  'var(--color-mint)',
  'var(--color-outline)',
  'var(--color-primary-light)',
  'var(--color-secondary-container)',
];

function sinTildes(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function porcentaje(parte, total) {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/* Los cargos llegan con etiquetas libres ("Médico Integral", "Médico Especialista"…).
   Se agrupan los que son médicos para que el total coincida con el KPI de Personal. */
function agruparCargos(filas) {
  const mapa = new Map();
  for (const fila of filas) {
    const esMedico = sinTildes(fila.nombre).includes('medic');
    const etiqueta = esMedico ? 'Médicos' : String(fila.nombre || 'Sin dato');
    const previo = mapa.get(etiqueta);
    mapa.set(etiqueta, {
      etiqueta,
      esMedico,
      total: (previo?.total || 0) + (Number(fila.total) || 0),
    });
  }
  const orden = [...mapa.values()].sort((a, b) => b.total - a.total);
  if (orden.length <= 8) return orden;
  const resto = orden.slice(7).reduce((suma, c) => suma + c.total, 0);
  return [...orden.slice(0, 7), { etiqueta: 'Otros cargos', esMedico: false, total: resto }];
}

function TarjetaKpi({ icono, etiqueta, valor, detalle }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/60 bg-white px-3 py-2.5 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-secondary">
        <Icon name={icono} className="text-xl" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-2xl font-semibold leading-none text-primary">{valor}</p>
          <p className="truncate text-[11px] font-semibold text-on-surface-variant">{etiqueta}</p>
        </div>
        <p className="mt-1 truncate text-[10px] text-on-surface-variant" title={detalle}>
          {detalle}
        </p>
      </div>
    </div>
  );
}

function DonaEstados({ datos, alcance, vacio }) {
  const [resaltado, setResaltado] = useState(null);
  const total = datos.reduce((suma, d) => suma + d.total, 0);
  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  let acumulado = 0;

  return (
    <section className="h-full rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h3 className="font-display text-base font-semibold text-primary">Citas por estado</h3>
        <p className="text-[11px] text-on-surface-variant">
          {alcance} · {numero(total)} citas
        </p>
      </header>
      {datos.length ? (
        <div className="flex flex-col items-center gap-4 xl:flex-row">
          <div className="relative h-32 w-32 shrink-0">
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full"
              role="img"
              aria-label={`Distribución de ${numero(total)} citas por estado`}
            >
              <g transform="rotate(-90 50 50)">
                <circle cx="50" cy="50" r={radio} fill="none" strokeWidth="11" stroke="var(--color-surface-container)" />
                {datos.map((d) => {
                  const largo = total > 0 ? (d.total / total) * circunferencia : 0;
                  const activo = resaltado === d.etiqueta;
                  const segmento = (
                    <circle
                      key={d.etiqueta}
                      cx="50"
                      cy="50"
                      r={radio}
                      fill="none"
                      stroke={d.color}
                      strokeWidth={activo ? 14 : 11}
                      strokeDasharray={`${largo} ${circunferencia - largo}`}
                      strokeDashoffset={-acumulado}
                      opacity={resaltado && !activo ? 0.35 : 1}
                      className="transition-all duration-200"
                    >
                      <title>{`${d.etiqueta}: ${numero(d.total)} citas`}</title>
                    </circle>
                  );
                  acumulado += largo;
                  return segmento;
                })}
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-semibold leading-none text-primary">{numero(total)}</span>
              <span className="mt-1 text-[10px] text-on-surface-variant">citas</span>
            </div>
          </div>

          <ul className="w-full min-w-0 flex-1 space-y-1">
            {datos.map((d) => (
              <li key={d.etiqueta}>
                <button
                  type="button"
                  onMouseEnter={() => setResaltado(d.etiqueta)}
                  onMouseLeave={() => setResaltado(null)}
                  onFocus={() => setResaltado(d.etiqueta)}
                  onBlur={() => setResaltado(null)}
                  aria-label={`${d.etiqueta}: ${numero(d.total)} citas, ${porcentaje(d.total, total)}%`}
                  className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors ${
                    resaltado === d.etiqueta ? 'bg-surface-container-low' : ''
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-on-surface">{d.etiqueta}</span>
                  <span className="font-mono text-[11px] font-semibold text-on-surface">{numero(d.total)}</span>
                  <span className="w-8 text-right text-[10px] text-on-surface-variant">
                    {porcentaje(d.total, total)}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="py-8 text-center text-xs text-on-surface-variant">{vacio}</p>
      )}
    </section>
  );
}

function BarrasEspecialidades({ datos, vacio }) {
  const maximo = Math.max(...datos.map((d) => d.total), 0);

  return (
    <section className="h-full rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-primary">Especialidades con más citas</h3>
          <p className="text-[11px] text-on-surface-variant">Acumulado de la red</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-container-low px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
          máx. {numero(maximo)}
        </span>
      </header>
      {datos.length ? (
        <ul className="space-y-2">
          {datos.map((d) => (
            <li
              key={d.etiqueta}
              title={`${d.etiqueta}: ${numero(d.total)} citas`}
              className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2.25rem] items-center gap-2"
            >
              <span className="truncate text-[11px] text-on-surface">{d.etiqueta}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface-container">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${maximo > 0 ? Math.max((d.total / maximo) * 100, 2) : 0}%`,
                    background: 'var(--color-health)',
                  }}
                />
              </span>
              <span className="text-right font-mono text-[11px] font-semibold text-on-surface">
                {numero(d.total)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-xs text-on-surface-variant">{vacio}</p>
      )}
    </section>
  );
}

function DesglosePersonal({ datos, registrados, medicos, vacio }) {
  const total = datos.reduce((suma, d) => suma + d.total, 0);

  return (
    <section className="rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h3 className="font-display text-base font-semibold text-primary">Personal por cargo</h3>
        <p className="text-[11px] text-on-surface-variant">
          Toda la red · {numero(registrados)} registrados · {numero(medicos)} médicos
        </p>
      </header>
      {datos.length ? (
        <>
          <div
            className="flex h-3 overflow-hidden rounded-full bg-surface-container"
            role="img"
            aria-label={`Personal por cargo: ${datos
              .map((d) => `${d.etiqueta} ${porcentaje(d.total, total)}%`)
              .join(', ')}`}
          >
            {datos.map((d, indice) => (
              <span
                key={d.etiqueta}
                className="h-full"
                style={{
                  width: `${(d.total / total) * 100}%`,
                  background: COLORES_CARGO[indice % COLORES_CARGO.length],
                }}
                title={`${d.etiqueta}: ${numero(d.total)} (${porcentaje(d.total, total)}%)`}
              />
            ))}
          </div>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {datos.map((d, indice) => (
              <li key={d.etiqueta} className="flex items-center gap-2 text-[11px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: COLORES_CARGO[indice % COLORES_CARGO.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-on-surface" title={d.etiqueta}>
                  {d.etiqueta}
                </span>
                <span className="font-mono font-semibold text-on-surface">{numero(d.total)}</span>
                <span className="w-8 text-right text-on-surface-variant">
                  {porcentaje(d.total, total)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="py-8 text-center text-xs text-on-surface-variant">{vacio}</p>
      )}
    </section>
  );
}

function ComparativaCentros({ centros }) {
  const orden = [...centros].sort((a, b) => (b.citas + b.consultas) - (a.citas + a.consultas));
  const maximo = Math.max(...orden.map((c) => Math.max(c.citas, c.consultas)), 0);

  return (
    <section className="rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-sm">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-primary">Demanda por centro de salud</h3>
          <p className="text-[11px] text-on-surface-variant">
            Citas y consultas acumuladas · ordenado por demanda
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-secondary)' }} />
            Citas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-health)' }} />
            Consultas
          </span>
        </div>
      </header>

      {orden.length ? (
        <ul className="divide-y divide-outline-variant/40">
          {orden.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-3 py-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"
              title={`${c.nombre}: ${numero(c.citas)} citas, ${numero(c.consultas)} consultas`}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-on-surface">{c.nombre}</p>
                <p className="font-mono text-[10px] text-on-surface-variant">{c.codigo || '—'}</p>
              </div>
              <div className="space-y-1">
                {[
                  { clave: 'citas', valor: c.citas, color: 'var(--color-secondary)' },
                  { clave: 'consultas', valor: c.consultas, color: 'var(--color-health)' },
                ].map((serie) => (
                  <div key={serie.clave} className="flex items-center gap-2">
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-container">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${maximo > 0 ? (serie.valor / maximo) * 100 : 0}%`,
                          background: serie.color,
                        }}
                      />
                    </span>
                    <span className="w-10 text-right font-mono text-[11px] font-semibold text-on-surface">
                      {numero(serie.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-xs text-on-surface-variant">
          Todavía no hay centros registrados.
        </p>
      )}
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Sidebar del director (colapsable, abre con botón)
   ════════════════════════════════════════════════════════════════ */

const ITEMS_SIDEBAR = [
  { id: 'atencion', etiqueta: 'Alcance y atención', icono: 'monitoring' },
  { id: 'stock', etiqueta: 'Stock e inventario', icono: 'inventory_2' },
  { id: 'laboral', etiqueta: 'Datos laborales', icono: 'work', nota: 'En construcción' },
];

function SidebarDirector({ seccionActiva, setSeccionActiva, sidebarAbierta, setSidebarAbierta }) {
  return (
    <>
      <aside
        id="sidebar-director"
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-outline-variant flex flex-col w-64 shadow-xl transition-transform duration-300 ${
          sidebarAbierta ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        } lg:pointer-events-auto lg:translate-x-0 lg:static lg:z-auto lg:h-auto lg:self-start lg:shadow-none lg:border lg:border-outline-variant/60 lg:rounded-2xl lg:w-60 lg:shrink-0`}
        aria-label="Navegación del panel ejecutivo"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant bg-surface-container-low shrink-0 lg:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-white shrink-0">
              <Icon name="dashboard" className="text-sm" />
            </span>
            <span className="font-display text-sm font-semibold text-primary leading-tight">Panel Ejecutivo</span>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="p-2 rounded-lg hover:bg-surface-container transition-colors lg:hidden"
            onClick={() => setSidebarAbierta(false)}
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" role="navigation">
          {ITEMS_SIDEBAR.map((item) => {
            const activado = seccionActiva === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={activado}
                onClick={() => {
                  setSeccionActiva(item.id);
                  setSidebarAbierta(false);
                }}
                className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  activado
                    ? 'bg-secondary text-white shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-secondary'
                }`}
              >
                <Icon name={item.icono} className={`text-lg ${activado ? 'text-white' : ''}`} />
                <span className="font-semibold text-sm leading-tight">{item.etiqueta}</span>
                {item.nota && (
                  <span
                    className={`ml-auto text-[10px] font-medium uppercase tracking-wider ${
                      activado ? 'text-white/80' : 'text-on-surface-variant/60'
                    }`}
                  >
                    {item.nota}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-outline-variant/40 px-5 py-4">
          <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-wider">
            Instituto de Salud · BnaSalud
          </p>
        </div>
      </aside>

      {sidebarAbierta && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarAbierta(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   Selector de sede: tabs con wrap, nunca se cortan
   ═══════════════════════════════════════════════════════════════ */

function TabCentro({ activo, onClick, citas, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition tab-interactive ${
        activo
          ? 'border-secondary bg-secondary text-white'
          : 'border-outline-variant/70 bg-white text-on-surface-variant hover:border-secondary/50 hover:text-secondary'
      }`}
    >
      {children}
      <span
        className={`rounded-full px-1.5 font-mono text-[10px] font-semibold ${
          activo ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
        }`}
      >
        {numero(citas)}
      </span>
    </button>
  );
}

function PillsFiltroCentro({ centros, centroId, setCentroId }) {
  const totalRed = centros.reduce((suma, c) => suma + (Number(c.citas) || 0), 0);

  return (
    <nav aria-label="Filtrar por centro de salud" className="mb-5 flex flex-wrap items-center gap-2">
      <span className="mr-0.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant">
        <Icon name="local_hospital" className="text-base text-secondary" />
        Vista
      </span>
      <TabCentro
        activo={centroId === 'general'}
        onClick={() => setCentroId('general')}
        citas={totalRed}
      >
        Datos generales
      </TabCentro>
      {centros.map((c) => (
        <TabCentro
          key={c.id}
          activo={String(c.id) === centroId}
          onClick={() => setCentroId(String(c.id))}
          citas={c.citas}
        >
          {c.nombre}
        </TabCentro>
      ))}
    </nav>
  );
}

/* ════════════════════════════════════════════════════════════════
   Panel: Alcance y atención (KPIs + gráficas)
   ═══════════════════════════════════════════════════════════════ */

function PanelAlcanceAtencion({
  actual,
  alcance,
  citasPorEstado,
  especialidades,
  cargos,
  centros,
  medicos,
  medicosRed,
  mostrarComparativa,
}) {
  const kpis = [
    {
      icono: 'event_available',
      etiqueta: 'Citas',
      valor: numero(actual.citas),
      detalle: `${numero(actual.citas_hoy)} hoy · ${numero(actual.citas_pendientes)} pendientes`,
    },
    {
      icono: 'clinical_notes',
      etiqueta: 'Consultas',
      valor: numero(actual.consultas),
      detalle: 'Registradas en el período',
    },
    {
      icono: 'groups',
      etiqueta: 'Pacientes',
      valor: numero(actual.pacientes),
      detalle: 'Atendidos o citados',
    },
    {
      icono: 'badge',
      etiqueta: 'Personal',
      valor: numero(actual.personal || actual.personal_activos),
      detalle: `${numero(actual.personal_activos)} activos · ${numero(medicos)} médicos`,
    },
  ];

  return (
    <div className="space-y-5">
      <section aria-label="Indicadores principales">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <TarjetaKpi key={kpi.etiqueta} {...kpi} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DonaEstados
            datos={citasPorEstado}
            alcance={alcance}
            vacio="Todavía no hay citas registradas."
          />
        </div>
        <div className="lg:col-span-3">
          <BarrasEspecialidades
            datos={especialidades}
            vacio="Todavía no hay especialidades con citas."
          />
        </div>
      </div>

      <DesglosePersonal
        datos={cargos}
        registrados={cargos.reduce((suma, c) => suma + c.total, 0)}
        medicos={medicosRed}
        vacio="Todavía no hay personal registrado."
      />

      {mostrarComparativa && <ComparativaCentros centros={centros} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Panel: Stock e inventario por centro
   ═══════════════════════════════════════════════════════════════ */

function PanelStockInventario({ centros, centroId, totales }) {
  const centro =
    centroId === 'general' ? null : centros.find((c) => String(c.id) === centroId);
  const actual = centro || totales;
  const nombreVista = centroId === 'general' ? 'Toda la red' : (centro?.nombre || '');

  const [stock, setStock] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modal, setModal] = useState(null);
  const [centroModal, setCentroModal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [nuevo, setNuevo] = useState(null);
  const [guardandoItem, setGuardandoItem] = useState(false);
  const modalAbierto = Boolean(modal);

  const cargar = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([
        API.almacenStock(centro?.id),
        API.almacenOrdenes(centro?.id),
      ]);
      setStock(s.items || []);
      setOrdenes(o.items || []);
      setError('');
    } catch (e) {
      setError(e.message || 'No se pudo cargar el inventario.');
    } finally {
      setCargando(false);
    }
  }, [centro?.id]);

  // Refresco automático: el sistema interno empuja cada recepción o consumo.
  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 20000);
    return () => clearInterval(id);
  }, [cargar]);

  // Autocompletado del catálogo: 300 ms de espera para no golpear la API.
  useEffect(() => {
    const texto = busqueda.trim();
    if (!modalAbierto || texto.length < 2) {
      setResultados([]);
      return undefined;
    }
    let vigente = true;
    const id = setTimeout(async () => {
      setBuscando(true);
      try {
        const data = await API.catalogoInsumos({ q: texto });
        if (vigente) setResultados(data.items || []);
      } catch {
        if (vigente) setResultados([]);
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(id);
    };
  }, [busqueda, modalAbierto]);

  const abrirOrden = () => {
    setCentroModal(centro ? String(centro.id) : String(centros[0]?.id || ''));
    setModal({ observacion: '', items: [] });
    setBusqueda('');
    setResultados([]);
    setNuevo(null);
    setAviso('');
  };

  const cambiarItem = (indice, cambios) => {
    setModal((prev) => ({
      ...prev,
      items: prev.items.map((linea, i) => (i === indice ? { ...linea, ...cambios } : linea)),
    }));
  };

  const agregarAlCarrito = (producto) => {
    setModal((prev) => {
      if (!prev || prev.items.some((l) => l.insumo.id === producto.id)) return prev;
      return {
        ...prev,
        items: [
          ...prev.items,
          { insumo: producto, cantidad: 1, lote: '', fecha_vencimiento: '' },
        ],
      };
    });
    setBusqueda('');
    setResultados([]);
  };

  const guardarNuevo = async (evento) => {
    evento.preventDefault();
    if (!nuevo?.nombre.trim()) {
      setError('Escriba el nombre del nuevo ítem.');
      return;
    }
    setGuardandoItem(true);
    setError('');
    try {
      const data = await API.crearInsumoCatalogo({
        codigo: nuevo.codigo.trim() || null,
        nombre: nuevo.nombre.trim(),
        categoria: nuevo.categoria,
        presentacion: nuevo.presentacion.trim() || null,
        unidad_medida: nuevo.unidad_medida.trim() || null,
      });
      agregarAlCarrito(data.item);
      setNuevo(null);
      setAviso(`«${data.item.nombre}» agregado al catálogo y al carrito.`);
    } catch (e) {
      setError(e.message || 'No se pudo agregar el ítem al catálogo.');
    } finally {
      setGuardandoItem(false);
    }
  };

  const enviarOrden = async (evento) => {
    evento.preventDefault();
    const items = (modal?.items || []).filter((l) => Number(l.cantidad) > 0);
    if (!centroModal || items.length === 0) {
      setError('Seleccione el centro de salud y al menos un producto con cantidad.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await API.crearOrdenEntrega({
        centro_id: Number(centroModal),
        observacion: modal.observacion.trim() || null,
        items: items.map((linea) => ({
          insumo_id: linea.insumo.id,
          cantidad: Number(linea.cantidad),
          lote: linea.lote.trim() || null,
          fecha_vencimiento: linea.fecha_vencimiento || null,
        })),
      });
      setAviso('Orden de entrega creada. El Jefe de Almacén puede verla en el sistema interno.');
      setModal(null);
      await cargar();
    } catch (e) {
      setError(e.message || 'No se pudo crear la orden de entrega.');
    } finally {
      setGuardando(false);
    }
  };

  const pendientes = ordenes.filter((o) => o.estado === 'pendiente_recepcion');

  return (
    <div className="space-y-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-primary sm:text-3xl">
            {nombreVista}
          </h2>
          <p className="text-xs text-on-surface-variant">
            {centro
              ? `Detalle del centro · ${centro.codigo || 'sin código'}`
              : 'Inventario consolidado de todos los centros'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              actual.stock_agotados > 0 ? 'bg-blood-soft text-blood' : 'bg-mint-soft text-mint'
            }`}
          >
            {actual.stock_agotados > 0 ? 'Requiere reposición' : 'Sin agotados'}
          </span>
          <button
            type="button"
            onClick={abrirOrden}
            disabled={centros.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
          >
            <Icon name="local_shipping" className="text-sm" />
            Nueva orden de entrega
          </button>
        </div>
      </div>

      {aviso && (
        <div className="rounded-xl border border-mint/30 bg-mint-soft px-3 py-2 text-[11px] text-mint">
          {aviso}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-blood/30 bg-blood-soft px-3 py-2 text-[11px] text-blood">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-sm">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-primary">Existencias por centro</h3>
            <p className="text-[11px] text-on-surface-variant">
              {nombreVista} · se actualiza con cada recepción o consumo del Jefe de Almacén
            </p>
          </div>
          <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-[10px] font-semibold text-on-surface-variant">
            {stock.length} producto(s)
          </span>
        </header>

        {cargando ? (
          <p className="py-6 text-center text-xs text-on-surface-variant">Cargando inventario…</p>
        ) : stock.length === 0 ? (
          <p className="py-6 text-center text-xs text-on-surface-variant">
            Todavía no hay existencias registradas. Se llenan cuando el centro recibe una orden de entrega.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="py-1.5">Producto</th>
                  <th className="py-1.5">Tipo</th>
                  {centroId === 'general' && <th className="py-1.5">Centro</th>}
                  <th className="py-1.5 text-right">Cantidad</th>
                  <th className="py-1.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((item) => {
                  const nombreCentro =
                    centros.find((c) => String(c.id) === String(item.clinica_id))?.nombre || '—';
                  return (
                    <tr key={`${item.clinica_id}-${item.item_key}`} className="border-t border-outline-variant/40">
                      <td className="py-1.5 font-medium text-primary">{item.nombre}</td>
                      <td className="py-1.5 capitalize text-on-surface-variant">{item.tipo}</td>
                      {centroId === 'general' && (
                        <td className="py-1.5 text-on-surface-variant">{nombreCentro}</td>
                      )}
                      <td className="py-1.5 text-right font-semibold text-primary">{numero(item.cantidad)}</td>
                      <td className="py-1.5 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            item.bajo_minimo ? 'bg-blood-soft text-blood' : 'bg-mint-soft text-mint'
                          }`}
                        >
                          {item.bajo_minimo ? 'Stock bajo' : 'Disponible'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-sm">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-primary">Órdenes de entrega</h3>
            <p className="text-[11px] text-on-surface-variant">
              Pendientes de recepción: {pendientes.length}
            </p>
          </div>
        </header>
        {ordenes.length === 0 ? (
          <p className="py-4 text-center text-xs text-on-surface-variant">No hay órdenes de entrega.</p>
        ) : (
          <ul className="divide-y divide-outline-variant/40">
            {ordenes.slice(0, 12).map((orden) => (
              <li key={orden.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">
                    {orden.numero || String(orden.id).slice(0, 8)} ·{' '}
                    {centros.find((c) => String(c.id) === String(orden.centro_id))?.nombre || 'Centro'}
                  </p>
                  <p className="text-[10px] text-on-surface-variant">
                    {fechaHora(orden.creada_en)} · {(orden.items || []).length} producto(s)
                    {orden.recibida_por ? ` · recibida por ${orden.recibida_por}` : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    orden.estado === 'recibida'
                      ? 'bg-mint-soft text-mint'
                      : 'bg-amber/15 text-amber'
                  }`}
                >
                  {orden.estado === 'recibida' ? 'Recibida' : 'Pendiente de recepción'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-sm">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-primary">Alertas de stock</h3>
            <p className="text-[11px] text-on-surface-variant">{nombreVista}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              actual.stock_agotados > 0 ? 'bg-blood-soft text-blood' : 'bg-mint-soft text-mint'
            }`}
          >
            {actual.stock_agotados > 0 ? 'Requiere reposición' : 'Sin agotados'}
          </span>
        </header>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-container-low py-2.5">
            <dt className="text-[10px] uppercase tracking-wide text-on-surface-variant">Agotados</dt>
            <dd className="font-display text-xl font-semibold text-blood">{numero(actual.stock_agotados)}</dd>
          </div>
          <div className="rounded-xl bg-surface-container-low py-2.5">
            <dt className="text-[10px] uppercase tracking-wide text-on-surface-variant">Stock bajo</dt>
            <dd className="font-display text-xl font-semibold text-amber">{numero(actual.stock_bajos)}</dd>
          </div>
          <div className="rounded-xl bg-surface-container-low py-2.5">
            <dt className="text-[10px] uppercase tracking-wide text-on-surface-variant">Unidades</dt>
            <dd className="font-display text-xl font-semibold text-primary">{numero(actual.stock_unidades)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-on-surface-variant">
          Las existencias provienen de las órdenes de entrega recibidas por el Jefe de Almacén de cada centro.
        </p>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={enviarOrden}
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-primary">Nueva orden de entrega</h3>
              <button type="button" onClick={() => setModal(null)} aria-label="Cerrar">
                <Icon name="close" className="text-base text-on-surface-variant" />
              </button>
            </div>

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Centro de salud destino
            </label>
            <select
              value={centroModal}
              onChange={(e) => setCentroModal(e.target.value)}
              className="mb-3 w-full rounded-lg border border-outline-variant px-3 py-2 text-xs"
            >
              <option value="">Seleccione un centro…</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>

            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                Buscar en el catálogo
              </label>
              <button
                type="button"
                onClick={() =>
                  setNuevo(
                    nuevo
                      ? null
                      : {
                          nombre: '',
                          codigo: '',
                          categoria: 'Medicamento',
                          presentacion: '',
                          unidad_medida: '',
                        },
                  )
                }
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary"
              >
                <Icon name="add" className="text-sm" /> Nuevo ítem al catálogo
              </button>
            </div>

            <div className="relative mb-3">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o código (ej. paracetamol, MED-001)"
                autoComplete="off"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-xs"
              />
              {busqueda.trim().length >= 2 && (
                <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-outline-variant bg-white shadow-lg">
                  {buscando ? (
                    <p className="px-3 py-2 text-[11px] text-on-surface-variant">Buscando…</p>
                  ) : resultados.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-on-surface-variant">
                      Sin coincidencias. Use «Nuevo ítem al catálogo».
                    </p>
                  ) : (
                    resultados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => agregarAlCarrito(p)}
                        className="block w-full px-3 py-2 text-left hover:bg-surface-container-low"
                      >
                        <span className="block text-xs font-semibold text-primary">{p.nombre}</span>
                        <span className="block text-[10px] text-on-surface-variant">
                          {[p.codigo, p.categoria, p.presentacion].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {nuevo && (
              <div className="mb-3 rounded-xl border border-outline-variant/60 bg-surface-container-low p-3">
                <p className="mb-2 text-[11px] font-semibold text-primary">Nuevo ítem del catálogo</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={nuevo.nombre}
                    onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                    placeholder="Nombre * (ej. Paracetamol 500mg)"
                    className="rounded-lg border border-outline-variant px-2 py-1.5 text-xs"
                    aria-label="Nombre del ítem"
                  />
                  <input
                    type="text"
                    value={nuevo.codigo}
                    onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value })}
                    placeholder="Código (ej. MED-001)"
                    className="rounded-lg border border-outline-variant px-2 py-1.5 text-xs"
                    aria-label="Código del ítem"
                  />
                  <select
                    value={nuevo.categoria}
                    onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}
                    className="rounded-lg border border-outline-variant px-2 py-1.5 text-xs"
                    aria-label="Categoría del ítem"
                  >
                    {['Medicamento', 'Insumo Médico', 'Material Quirúrgico', 'Otro'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={nuevo.presentacion}
                    onChange={(e) => setNuevo({ ...nuevo, presentacion: e.target.value })}
                    placeholder="Presentación (ej. Caja x 20 tabletas)"
                    className="rounded-lg border border-outline-variant px-2 py-1.5 text-xs"
                    aria-label="Presentación del ítem"
                  />
                  <input
                    type="text"
                    value={nuevo.unidad_medida}
                    onChange={(e) => setNuevo({ ...nuevo, unidad_medida: e.target.value })}
                    placeholder="Unidad de medida (ej. tabletas)"
                    className="rounded-lg border border-outline-variant px-2 py-1.5 text-xs"
                    aria-label="Unidad de medida del ítem"
                  />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNuevo(null)}
                    className="rounded-lg border border-outline-variant px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={guardarNuevo}
                    disabled={guardandoItem}
                    className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    {guardandoItem ? 'Guardando…' : 'Guardar y agregar'}
                  </button>
                </div>
              </div>
            )}

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Carrito de despacho
            </label>
            {modal.items.length === 0 ? (
              <p className="mb-3 rounded-lg border border-dashed border-outline-variant px-3 py-4 text-center text-[11px] text-on-surface-variant">
                Busque un producto arriba y agréguelo al carrito.
              </p>
            ) : (
              <div className="mb-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-on-surface-variant">
                    <tr>
                      <th className="py-1.5 pr-2">Producto</th>
                      <th className="w-16 py-1.5 pr-2">Cant.</th>
                      <th className="w-28 py-1.5 pr-2">Lote</th>
                      <th className="w-36 py-1.5 pr-2">Vence</th>
                      <th className="py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {modal.items.map((linea, indice) => (
                      <tr key={linea.insumo.id} className="border-t border-outline-variant/40">
                        <td className="py-1.5 pr-2">
                          <span className="block font-medium text-primary">{linea.insumo.nombre}</span>
                          <span className="block text-[10px] text-on-surface-variant">
                            {[linea.insumo.codigo, linea.insumo.presentacion].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min="1"
                            value={linea.cantidad}
                            onChange={(e) => cambiarItem(indice, { cantidad: e.target.value })}
                            className="w-full rounded-lg border border-outline-variant px-2 py-1.5 text-xs"
                            aria-label={`Cantidad de ${linea.insumo.nombre}`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="text"
                            value={linea.lote}
                            onChange={(e) => cambiarItem(indice, { lote: e.target.value })}
                            placeholder="Opcional"
                            className="w-full rounded-lg border border-outline-variant px-2 py-1.5 text-xs"
                            aria-label={`Lote de ${linea.insumo.nombre}`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="date"
                            value={linea.fecha_vencimiento}
                            onChange={(e) => cambiarItem(indice, { fecha_vencimiento: e.target.value })}
                            className="w-full rounded-lg border border-outline-variant px-2 py-1.5 text-xs"
                            aria-label={`Vencimiento de ${linea.insumo.nombre}`}
                          />
                        </td>
                        <td className="py-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setModal((prev) => ({
                                ...prev,
                                items: prev.items.filter((_, i) => i !== indice),
                              }))
                            }
                            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low"
                            aria-label={`Quitar ${linea.insumo.nombre}`}
                          >
                            <Icon name="delete" className="text-sm" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Observación (opcional)
            </label>
            <input
              type="text"
              value={modal.observacion}
              onChange={(e) => setModal((prev) => ({ ...prev, observacion: e.target.value }))}
              placeholder="Ej: reposición mensual"
              className="mb-4 w-full rounded-lg border border-outline-variant px-3 py-2 text-xs"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-outline-variant px-3 py-2 text-[11px] font-semibold text-on-surface-variant"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-lg bg-primary px-3.5 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {guardando ? 'Generando…' : 'Generar orden'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PanelLaboralEnConstruccion() {
  return (
    <div className="py-10">
      <EstadoVacio
        icono="construction"
        titulo="Datos laborales en construcción"
        clase="bg-surface-container-low rounded-3xl border border-outline-variant"
      >
        <p className="text-xs mt-1">
          Los datos de reposos médicos emitidos a trabajadores estarán disponibles
          una vez los doctores alcancen un consenso. Este módulo estará listo para
          su cotejo con Recursos Humanos.
        </p>
      </EstadoVacio>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Login
   ═════════════════════════════════════════════════════════════════ */

function AccesoInstitucional({ onEntrar }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const respuesta = await API.loginInstitucional(username.trim(), password);
      onEntrar(respuesta);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-primary lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative order-2 flex flex-col justify-between overflow-hidden px-6 py-8 lg:order-none lg:px-12 lg:py-12">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(circle at 18% 12%, rgba(80,217,254,0.20), transparent 46%), radial-gradient(circle at 88% 82%, rgba(13,159,122,0.24), transparent 48%)',
          }}
        />
        <div className="relative">
          <Marca />
        </div>

        <div className="relative mt-10 max-w-xl lg:mt-0">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
            <Icon name="lock" className="text-sm text-health-light" />
            Acceso restringido
          </p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            Todos los números de la red de salud, en un solo lugar.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/70">
            Citas, consultas, pacientes, personal, recetas y stock de cada centro,
            actualizados desde la nube. Sin depender de la red interna del instituto.
          </p>
          <ul className="mt-6 grid gap-2.5 text-sm text-white/80 sm:grid-cols-2">
            {[
              'Resumen por centro y global',
              'Citas por estado y especialidad',
              'Personal activo y por cargo',
              'Stock crítico y recetas pendientes',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Icon name="check_circle" className="mt-0.5 text-base text-health-light" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 text-[11px] text-white/45 lg:mt-0">
          Instituto de Salud del Municipio Simón Bolívar · Barcelona, Anzoátegui
        </p>
      </section>

      <section className="order-1 flex items-center justify-center bg-surface px-5 py-10 sm:px-8 lg:order-none">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-outline-variant/60 bg-white p-6 shadow-xl shadow-primary/10 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                <Icon name="badge" className="text-2xl" />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold text-primary">
                  Iniciar sesión
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Cuentas de dirección y sistemas
                </p>
              </div>
            </div>

            <form onSubmit={enviar} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="institucional-usuario"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
                >
                  Usuario
                </label>
                <div className="relative">
                  <Icon
                    name="person"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-outline"
                  />
                  <input
                    id="institucional-usuario"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-white py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/25"
                    placeholder="usuario"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="institucional-clave"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Icon
                    name="key"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-outline"
                  />
                  <input
                    id="institucional-clave"
                    name="password"
                    type={verClave ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-white py-2.5 pl-10 pr-11 text-sm text-on-surface outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/25"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setVerClave((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-outline transition hover:bg-surface-container hover:text-secondary"
                    aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={verClave}
                  >
                    <Icon name={verClave ? 'visibility_off' : 'visibility'} className="text-lg" />
                  </button>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-error/25 bg-error-container px-3 py-2 text-xs text-error"
                >
                  <Icon name="error" className="mt-0.5 text-base" />
                  <span>{error}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className={`flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-white transition hover:bg-secondary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-60 btn-hover-effect ${enviando ? 'btn-loading' : ''}`}
              >
                {enviando ? 'Verificando…' : 'Entrar al panel'}
                <Icon name="arrow_forward" className="text-lg" />
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between border-t border-outline-variant/60 pt-4 text-xs">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-on-surface-variant transition hover:text-secondary"
              >
                <Icon name="arrow_back" className="text-base" />
                Volver al portal
              </Link>
              <span className="text-on-surface-variant/70">Solo personal autorizado</span>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-on-surface-variant">
            Si olvidó su contraseña, solicite el restablecimiento al encargado de
            sistemas del instituto.
          </p>
        </div>
      </section>
    </main>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Tabla de centros (compartida)
   ═══════════════════════════════════════════════════════════════ */

function TablaCentros({ centros, seleccionado, onSeleccionar, totales }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-white shadow-sm">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-outline-variant/50 px-4 py-3">
        <div>
          <h3 className="font-display text-base font-semibold text-primary">
            Resumen por centro de salud
          </h3>
          <p className="text-[11px] text-on-surface-variant">
            Seleccione una fila para ver el detalle del centro.
          </p>
        </div>
        <p className="text-[11px] text-on-surface-variant">
          {numero(totales.centros_activos)} de {numero(totales.centros)} centros activos
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <caption className="sr-only">
            Citas, consultas, pacientes, personal, recetas y stock por centro de salud
          </caption>
          <thead>
            <tr className="bg-surface-container-low text-[10px] uppercase tracking-wider text-on-surface-variant">
              <th scope="col" className="px-4 py-2.5 font-semibold">Centro</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Citas</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Consultas</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Pacientes</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Personal</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Recetas</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Stock</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Alertas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {centros.map((centro) => {
              const activo = String(seleccionado) === String(centro.id);
              const alertas = centro.stock_agotados + centro.stock_bajos;
              return (
                <tr
                  key={centro.id}
                  className={`cursor-pointer transition list-item-interactive ${
                    activo ? 'bg-secondary/10' : 'hover:bg-surface-container-low/60'
                  }`}
                  onClick={() => onSeleccionar(String(centro.id))}
                >
                  <th scope="row" className="px-4 py-2.5 font-normal">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeleccionar(String(centro.id));
                      }}
                      className={`text-left text-xs font-semibold transition ${
                        activo ? 'text-secondary-dark' : 'text-on-surface hover:text-secondary'
                      }`}
                    >
                      {centro.nombre}
                      <span className="mt-0.5 block font-mono text-[10px] font-normal text-on-surface-variant">
                        {centro.codigo || '—'}
                      </span>
                    </button>
                  </th>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">{numero(centro.citas)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">{numero(centro.consultas)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">{numero(centro.pacientes)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">
                    {numero(centro.personal_activos)}
                    <span className="text-on-surface-variant"> / {numero(centro.personal)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">
                    {numero(centro.recetas)}
                    {centro.recetas_pendientes > 0 && (
                      <span className="ml-1 rounded-full bg-amber-soft px-1.5 py-0.5 text-[10px] font-semibold text-amber">
                        {numero(centro.recetas_pendientes)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">
                    {numero(centro.stock_unidades)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {alertas > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blood-soft px-2 py-0.5 text-[10px] font-semibold text-blood">
                        <Icon name="warning" className="text-xs" />
                        {numero(alertas)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-[10px] font-semibold text-mint">
                        <Icon name="check" className="text-xs" />
                        Al día
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-surface-container-low text-xs font-semibold text-primary">
              <th scope="row" className="px-4 py-2.5 text-left">Total de la red</th>
              <td className="px-3 py-2.5 text-right font-mono">{numero(totales.citas)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{numero(totales.consultas)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{numero(totales.pacientes)}</td>
              <td className="px-3 py-2.5 text-right font-mono">
                {numero(totales.personal_activos)} / {numero(totales.personal)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">{numero(totales.recetas)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{numero(totales.stock_unidades)}</td>
              <td className="px-4 py-2.5 text-right font-mono">
                {numero(totales.stock_agotados + totales.stock_bajos)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Panel principal (rol director)
   ════════════════════════════════════════════════════════════════ */

function Panel({ sesion, onSalir }) {
  const { usuario } = sesion;
  const rol = ROLES[usuario.rol] || ROLES.director;
  const [datos, setDatos] = useState(null);
  const [centroId, setCentroId] = useState('general');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seccionActiva, setSeccionActiva] = useState('atencion');
  const [sidebarAbierta, setSidebarAbierta] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const respuesta = await API.resumenPanel();
      setDatos(respuesta);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onSalir();
        return;
      }
      setError(err.message || 'No se pudo cargar el resumen.');
    } finally {
      setCargando(false);
    }
  }, [onSalir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const centros = datos?.por_centro || [];
  const t = datos?.totales || {};
  const centro =
    centroId === 'general' ? null : centros.find((c) => String(c.id) === centroId);
  const actual = centro || t;

  const citasPorEstado = (actual.citas_por_estado || datos?.citas_por_estado || []).map((e) => ({
    etiqueta:
      ETIQUETA_ESTADO[sinTildes(e.estado)] ||
      e.estado.charAt(0).toUpperCase() + e.estado.slice(1).replace(/_/g, ' '),
    total: e.total,
    color: COLOR_ESTADO[sinTildes(e.estado)] || 'var(--color-outline)',
  }));

  const especialidades = (datos?.especialidades || []).map((e) => ({
    etiqueta: e.nombre,
    total: e.total,
  }));

  const cargos = agruparCargos(datos?.personal_por_cargo || []);
  const medicosRed = cargos.find((c) => c.esMedico)?.total ?? (t.medicos || 0);
  const medicosKpi = centroId === 'general' ? medicosRed : (actual.medicos || 0);
  const alcance = centro?.nombre || 'Toda la red';

  return (
    <div className="min-h-screen bg-surface">
      <header className="relative overflow-hidden bg-primary text-white">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(circle at 12% 10%, rgba(80,217,254,0.18), transparent 42%), radial-gradient(circle at 90% 90%, rgba(13,159,122,0.22), transparent 46%)',
          }}
        />
        <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              aria-label={sidebarAbierta ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={sidebarAbierta}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors"
              onClick={() => setSidebarAbierta((v) => !v)}
            >
              <Icon name={sidebarAbierta ? 'close' : 'menu'} className="text-xl" />
            </button>
            <Marca compacta />
            <span className="hidden h-8 w-px bg-white/15 sm:block" aria-hidden="true" />
            <span className="hidden items-center gap-1.5 rounded-full border border-health-light/30 bg-health/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-health-light sm:inline-flex">
              <Icon name={rol.icono} className="text-sm" />
              {rol.insignia || rol.etiqueta}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cargar}
              disabled={cargando}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-50"
            >
              <Icon name="refresh" className={`text-base ${cargando ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-health/25 font-display text-[11px] font-semibold text-health-light"
                aria-hidden="true"
              >
                {iniciales(usuario.nombre || usuario.username)}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-xs font-semibold text-white">
                  {usuario.nombre || usuario.username}
                </span>
                <span className="block text-[10px] text-white/55">{rol.etiqueta}</span>
              </span>
              <button
                type="button"
                onClick={onSalir}
                className="ml-1 rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <Icon name="logout" className="text-base" />
              </button>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-4 sm:px-6">
          <p className="text-[11px] text-white/50">
            Última actualización: {datos ? fechaHora(datos.generado_en) : '—'} · Zona horaria{' '}
            {datos?.zona_horaria || 'America/Caracas'}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        {error && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-error/25 bg-error-container px-4 py-3 text-sm text-error"
          >
            <span className="flex items-center gap-2">
              <Icon name="error" className="text-lg" />
              {error}
            </span>
            <button
              type="button"
              onClick={cargar}
              className="rounded-lg border border-error/30 px-3 py-1 text-xs font-semibold transition hover:bg-error/10"
            >
              Reintentar
            </button>
          </div>
        )}

        {cargando && !datos ? (
          <div className="space-y-5">
            <section aria-label="Indicadores principales">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <EsqueletoKpi key={i} />
                ))}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <EsqueletoPanelBarras />
              </div>
              <div className="lg:col-span-3">
                <EsqueletoPanelBarras />
              </div>
            </div>

            <EsqueletoPanelBarras />

            <EsqueletoTablaCentros />
          </div>
        ) : datos ? (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <SidebarDirector
              seccionActiva={seccionActiva}
              setSeccionActiva={setSeccionActiva}
              sidebarAbierta={sidebarAbierta}
              setSidebarAbierta={setSidebarAbierta}
            />

            <div className="flex-1 min-w-0 w-full">
              <PillsFiltroCentro centros={centros} centroId={centroId} setCentroId={setCentroId} />

              <div className="space-y-5" aria-busy={cargando}>
                {seccionActiva === 'laboral' ? (
                  <PanelLaboralEnConstruccion />
                ) : seccionActiva === 'stock' ? (
                  <PanelStockInventario centros={centros} centroId={centroId} totales={t} />
                ) : (
                  <PanelAlcanceAtencion
                    actual={actual}
                    alcance={alcance}
                    citasPorEstado={citasPorEstado}
                    especialidades={especialidades}
                    cargos={cargos}
                    centros={centros}
                    medicos={medicosKpi}
                    medicosRed={medicosRed}
                    mostrarComparativa={centroId === 'general'}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}

        <p className="mt-8 text-center text-[11px] text-on-surface-variant">
          Panel institucional · Instituto de Salud del Municipio Simón Bolívar ·{' '}
          {new Date().getFullYear()}
        </p>
      </main>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Página
   ════════════════════════════════════════════════════════════════ */

export default function Institucional() {
  const { sesion, entrar, salir } = useSesionInstitucional();
  const esSoporte = sesion?.usuario?.rol === 'admin_sistemas';

  useEffect(() => {
    if (!sesion) {
      document.title = 'Acceso institucional · Salud Barcelona';
    } else {
      document.title = esSoporte
        ? 'Soporte técnico · Salud Barcelona'
        : 'Panel Institucional · Salud Barcelona';
    }
    return () => {
      document.title = 'Salud Barcelona - Instituto de Salud Municipal';
    };
  }, [sesion, esSoporte]);

  if (!sesion) return <AccesoInstitucional onEntrar={entrar} />;
  if (esSoporte) return <PanelSoporte sesion={sesion} onSalir={salir} />;
  return <Panel sesion={sesion} onSalir={salir} />;
}

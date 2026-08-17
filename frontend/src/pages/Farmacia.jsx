import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon';
import ClinicalShell from '../clinical/ClinicalShell';
import { Stamp, LedgerCard, SectionLabel, Code, ToneButton } from '../clinical/ui';
import { API } from '../api';
import { DEMO, nivelStock } from '../clinical/demo';

const USUARIO_FARMACIA = { id: 2071, clinica_id: 2 };
const CLAVE_REPOSICIONES = 'bna_farmacia_reposiciones';

const VISTAS = [
  {
    id: 'despacho',
    numero: 'I',
    etiqueta: 'Despacho de recetas',
    detalle: 'Órdenes de los médicos',
    icono: 'prescriptions',
  },
  {
    id: 'inventario',
    numero: 'II',
    etiqueta: 'Inventario de medicamentos',
    detalle: 'Listado y existencias',
    icono: 'inventory_2',
  },
  {
    id: 'alertas',
    numero: 'III',
    etiqueta: 'Alertas de stock',
    detalle: 'Agotados y bajo mínimo',
    icono: 'warning',
  },
];

const ESTADO_MED = {
  SIN_STOCK: { etiqueta: 'Sin stock', tone: 'blood', color: 'var(--color-blood)' },
  BAJO: { etiqueta: 'Bajo mínimo', tone: 'amber', color: 'var(--color-amber)' },
  OK: { etiqueta: 'Disponible', tone: 'mint', color: 'var(--color-mint)' },
};

function formatearFecha(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return (
    d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  );
}

function infoVencimiento(v) {
  if (!v) return null;
  let fecha = null;
  const iso = new Date(v);
  if (!Number.isNaN(iso.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(String(v))) {
    fecha = iso;
  } else {
    const m = String(v).match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
    if (m) {
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const idx = meses.indexOf(m[1].toLowerCase().slice(0, 3));
      if (idx >= 0) fecha = new Date(+m[2], idx, 1);
    }
  }
  if (!fecha) return null;
  const hoy = new Date();
  const meses =
    (fecha.getFullYear() - hoy.getFullYear()) * 12 + (fecha.getMonth() - hoy.getMonth());
  if (meses < 0) return { tipo: 'vencido' };
  if (meses <= 3) return { tipo: 'proximo', meses };
  return null;
}

export default function Farmacia() {
  const [vista, setVista] = useState('despacho');

  /* === Capítulo I · Despacho === */
  const [busqueda, setBusqueda] = useState('');
  const [receta, setReceta] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [pendientesDemo, setPendientesDemo] = useState(false);
  const [origen, setOrigen] = useState('api');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [seleccion, setSeleccion] = useState(new Set());
  const [despachando, setDespachando] = useState(false);
  const [despachado, setDespachado] = useState(false);
  const [resultadoDespacho, setResultadoDespacho] = useState('');
  const [cedulaEntrega, setCedulaEntrega] = useState('');
  const [entregando, setEntregando] = useState(false);
  const [entregaHecha, setEntregaHecha] = useState(false);

  /* === Capítulo II · Inventario y Capítulo III · Alertas === */
  const [inventario, setInventario] = useState([]);
  const [invBusqueda, setInvBusqueda] = useState('');
  const [invCategoria, setInvCategoria] = useState('');
  const [invEstado, setInvEstado] = useState('todos');

  /* Solicitudes de reposición (locales hasta el módulo de administración) */
  const [reposiciones, setReposiciones] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CLAVE_REPOSICIONES) || '[]'));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    API.recetasPendientes()
      .then((d) => {
        setPendientes(d);
        setPendientesDemo(false);
      })
      .catch(async () => {
        try {
          setPendientes(await DEMO.recetasPendientes());
          setPendientesDemo(true);
        } catch {
          setPendientes([]);
        }
      });
  }, []);

  useEffect(() => {
    API.getInventario()
      .then((d) => setInventario(d || []))
      .catch(async () => {
        try {
          setInventario(await DEMO.getInventario());
        } catch {
          setInventario([]);
        }
      });
  }, []);

  function guardarReposiciones(conjunto) {
    try {
      localStorage.setItem(CLAVE_REPOSICIONES, JSON.stringify([...conjunto]));
    } catch {
      /* sin almacenamiento */
    }
  }

  function solicitarReposicion(id) {
    const n = new Set(reposiciones);
    n.add(id);
    setReposiciones(n);
    guardarReposiciones(n);
  }

  function cancelarReposicion(id) {
    const n = new Set(reposiciones);
    n.delete(id);
    setReposiciones(n);
    guardarReposiciones(n);
  }

  const nivelDe = (m) => nivelStock(m.stock_actual, m.stock_minimo);
  const alertas = useMemo(
    () => inventario.filter((m) => nivelStock(m.stock_actual, m.stock_minimo) !== 'OK'),
    [inventario]
  );
  const sinStock = useMemo(() => alertas.filter((m) => nivelDe(m) === 'SIN_STOCK'), [alertas]);
  const bajos = useMemo(() => alertas.filter((m) => nivelDe(m) === 'BAJO'), [alertas]);

  /* === Capítulo I · lógica de despacho === */

  async function abrirPendiente(rx) {
    setReceta(rx);
    setOrigen(pendientesDemo ? 'demo' : 'api');
    setSeleccion(new Set());
    setError('');
    setDespachado(false);
    setEntregaHecha(false);
    setCedulaEntrega('');
    setBusqueda(rx.codigo_receta);
  }

  async function buscar(texto) {
    const v = texto.trim();
    setBusqueda(texto);
    if (!v) {
      setReceta(null);
      setError('');
      return;
    }
    setCargando(true);
    setError('');
    setDespachado(false);
    setEntregaHecha(false);
    setCedulaEntrega('');
    try {
      const datos = await API.buscarReceta(v);
      setReceta(datos);
      setOrigen('api');
      setSeleccion(new Set());
    } catch {
      try {
        const datos = await DEMO.buscarReceta(v);
        setReceta(datos);
        setOrigen('demo');
        setSeleccion(new Set());
      } catch (e) {
        setReceta(null);
        setError(e.message);
      }
    } finally {
      setCargando(false);
    }
  }

  function cargarEjemplo() {
    setBusqueda('0912345678');
    buscar('0912345678');
  }

  function toggleMed(id) {
    setSeleccion((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function despachar() {
    if (!receta) return;
    const items = receta.detalles
      .filter((d) => seleccion.has(d.medicamento_id))
      .map((d) => ({
        medicamento_id: d.medicamento_id,
        nombre_medicamento: d.nombre_medicamento,
        cantidad_despachada: d.cantidad_prescrita - d.cantidad_despachada,
      }));
    if (items.length === 0) {
      setError('Marque al menos un medicamento para confirmar el despacho.');
      return;
    }
    setDespachando(true);
    setError('');
    try {
      const payload = {
        receta_id: receta.id,
        clinica_id: USUARIO_FARMACIA.clinica_id,
        despachado_por_id: USUARIO_FARMACIA.id,
        items: items.map((i) => ({
          medicamento_id: i.medicamento_id,
          cantidad_despachada: i.cantidad_despachada,
        })),
      };
      try {
        await API.despacharReceta(payload);
        setOrigen('api');
      } catch {
        await DEMO.despacharReceta(payload);
        setOrigen('demo');
      }
      setReceta((r) => ({
        ...r,
        estado: 'DESPACHADA',
        detalles: r.detalles.map((d) =>
          seleccion.has(d.medicamento_id)
            ? { ...d, cantidad_despachada: d.cantidad_prescrita, stock: (d.stock ?? 0) - d.cantidad_prescrita }
            : d
        ),
      }));
      setInventario((prev) =>
        prev.map((m) => {
          const it = items.find((i) => i.nombre_medicamento === m.nombre);
          return it
            ? { ...m, stock_actual: Math.max((m.stock_actual ?? 0) - it.cantidad_despachada, 0) }
            : m;
        })
      );
      setDespachado(true);
      setResultadoDespacho(items.reduce((a, i) => a + i.cantidad_despachada, 0));
      setPendientes((prev) => prev.filter((p) => p.id !== receta.id));
      setTimeout(() => setDespachado(false), 4200);
    } finally {
      setDespachando(false);
    }
  }

  async function entregar() {
    if (!receta || receta.estado !== 'DESPACHADA') return;
    const cedula = String(cedulaEntrega || '').replace(/[^\d]/g, '');
    if (cedula.length < 4) {
      setError('Ingrese la cédula de quien recibe los medicamentos (conformidad de entrega).');
      return;
    }
    setEntregando(true);
    setError('');
    try {
      try {
        await API.entregarReceta(receta.id, { cedula_paciente: cedula });
        setOrigen('api');
      } catch {
        await DEMO.entregarReceta(receta.id, { cedula_paciente: cedula });
        setOrigen('demo');
      }
      setReceta((r) => ({
        ...r,
        estado: 'ENTREGADA',
        entregada_por: 'Farmacia',
        entregada_at: new Date().toISOString(),
      }));
      setCedulaEntrega('');
      setEntregaHecha(true);
      setTimeout(() => setEntregaHecha(false), 4200);
    } finally {
      setEntregando(false);
    }
  }

  /* === Capítulo II · filtros del inventario === */

  const categorias = useMemo(() => {
    const s = new Set(inventario.map((m) => m.categoria).filter(Boolean));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [inventario]);

  const inventarioFiltrado = useMemo(() => {
    const q = invBusqueda.trim().toLowerCase();
    return inventario.filter((m) => {
      if (q && !m.nombre.toLowerCase().includes(q)) return false;
      if (invCategoria && m.categoria !== invCategoria) return false;
      if (invEstado !== 'todos' && nivelStock(m.stock_actual, m.stock_minimo) !== invEstado)
        return false;
      return true;
    });
  }, [inventario, invBusqueda, invCategoria, invEstado]);

  const agrupado = useMemo(() => {
    const mapa = new Map();
    inventarioFiltrado.forEach((m) => {
      const cat = m.categoria || 'Sin categoría';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat).push(m);
    });
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [inventarioFiltrado]);

  const fecha = new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const columnaGrid = 'md:grid-cols-[56px_minmax(0,1fr)_150px_170px_130px_104px]';
  const cabeceraCelda =
    'font-mono text-[9px] uppercase tracking-widest text-ink-faint';

  const filaAlerta = (m) => {
    const nivel = nivelDe(m);
    const est = ESTADO_MED[nivel];
    const min = m.stock_minimo ?? 0;
    const faltante = Math.max(min - (m.stock_actual ?? 0), 0);
    const venc = infoVencimiento(m.vencimiento);
    const enReposicion = reposiciones.has(m.id);
    return (
      <LedgerCard key={m.id} className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <p className="font-display font-semibold text-lg text-ink leading-tight">
                {m.nombre}
              </p>
              {nivel === 'SIN_STOCK' && <Stamp tone="blood">Urgente</Stamp>}
              {enReposicion && <Stamp tone="mint">En reposición</Stamp>}
            </div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint mt-1">
              {m.presentacion}
              {m.concentracion ? ` · ${m.concentracion}` : ''} · mín {min}{' '}
              {m.unidad || 'unidad'}
            </p>
            {venc && (
              <p
                className={`font-mono text-[10px] mt-1.5 flex items-center gap-1 ${
                  venc.tipo === 'vencido' ? 'text-blood' : 'text-amber'
                }`}
              >
                <Icon
                  name={venc.tipo === 'vencido' ? 'skull' : 'hourglass_top'}
                  className="text-xs"
                />
                {venc.tipo === 'vencido'
                  ? `Vencido · ${m.vencimiento}`
                  : `Vence en ${venc.meses} mes${venc.meses === 1 ? '' : 'es'} · ${m.vencimiento}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-6 shrink-0 sm:pl-5 sm:border-l border-ink-line">
            <div className="text-right">
              <p
                className="font-display italic text-3xl font-semibold leading-none"
                style={{ color: est.color }}
              >
                {m.stock_actual}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint mt-1">
                actual
              </p>
            </div>
            {faltante > 0 && (
              <div className="text-right">
                <p className="font-display italic text-3xl font-semibold leading-none text-blood">
                  −{faltante}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint mt-1">
                  faltante
                </p>
              </div>
            )}
          </div>
          <div className="shrink-0">
            {enReposicion ? (
              <button
                onClick={() => cancelarReposicion(m.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-ink-soft border border-ink-line hover:bg-paper-2 transition-colors"
              >
                <Icon name="undo" className="text-sm" /> Deshacer
              </button>
            ) : (
              <ToneButton
                tone="fx"
                onClick={() => solicitarReposicion(m.id)}
                className="!px-4 !py-2 !text-xs"
              >
                <Icon name="add_shopping_cart" className="text-base" /> Solicitar reposición
              </ToneButton>
            )}
          </div>
        </div>
      </LedgerCard>
    );
  };

  return (
    <ClinicalShell module="farmacia" sinSidebar>
      <main className="h-full overflow-y-auto ledger-scroll px-5 md:px-8 py-6 md:py-8 pb-20 max-w-[1440px] mx-auto">
        {/* ===== Encabezado del libro ===== */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint mb-1">
                Unidad de farmacia · Libro de la jornada
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink">
                Farmacia <span className="italic text-fx">Central</span>
              </h2>
            </div>
            <div className="hidden lg:flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-faint capitalize">
              <Icon name="auto_stories" className="text-base text-fx" />
              {fecha}
            </div>
          </div>

          {/* Índice del libro: tres capítulos operativos */}
          <nav
            aria-label="Secciones de la farmacia"
            className="mt-5 rounded-lg bg-ink text-paper shadow-xl relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                background:
                  'radial-gradient(120% 90% at 0% 0%, rgba(29,78,216,0.55), transparent 55%)',
              }}
            />
            <ul className="relative flex overflow-x-auto ledger-scroll">
              {VISTAS.map((v) => {
                const activa = vista === v.id;
                const conteo =
                  v.id === 'despacho'
                    ? pendientes.length
                    : v.id === 'alertas'
                      ? alertas.length
                      : inventario.length;
                return (
                  <li key={v.id} className="flex-1 min-w-[210px]">
                    <button
                      onClick={() => setVista(v.id)}
                      aria-current={activa ? 'page' : undefined}
                      className={`w-full text-left px-5 py-4 transition-colors border-r border-white/10 last:border-r-0 ${
                        activa ? 'bg-paper text-ink' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`font-mono text-[10px] tracking-[0.2em] ${
                            activa ? 'text-fx' : 'text-paper/40'
                          }`}
                        >
                          {v.numero}
                        </span>
                        {conteo > 0 && (
                          <Stamp tone={v.id === 'alertas' ? 'blood' : 'fx'} soft={!activa}>
                            {v.id === 'alertas' ? `${conteo} alerta${conteo === 1 ? '' : 's'}` : conteo}
                          </Stamp>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <p
                          className={`font-display font-semibold text-[15px] leading-tight ${
                            activa ? 'text-ink' : 'text-paper/85'
                          }`}
                        >
                          {v.etiqueta}
                        </p>
                        <p
                          className={`font-mono text-[9px] uppercase tracking-widest mt-0.5 ${
                            activa ? 'text-ink-faint' : 'text-paper/40'
                          }`}
                        >
                          {v.detalle}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </header>

        {/* ============================================================
            CAPÍTULO I · DESPACHO DE RECETAS
        ============================================================ */}
        {vista === 'despacho' && (
          <div className="rise-in">
            {pendientes.length > 0 && (
              <section className="mb-7" aria-label="Recetas pendientes de los médicos">
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel index="R" tone="fx" className="!mb-0">
                    Recibidas de los médicos
                  </SectionLabel>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint shrink-0">
                    {pendientes.length} en espera
                  </span>
                </div>
                <div className="flex gap-3 overflow-x-auto ledger-scroll pb-2 -mx-1 px-1">
                  {pendientes.map((rx) => {
                    const activa = receta && receta.id === rx.id;
                    return (
                      <button
                        key={rx.id}
                        onClick={() => abrirPendiente(rx)}
                        className={`shrink-0 w-64 text-left p-4 rounded-md border transition-all ${
                          activa
                            ? 'bg-fx text-paper border-fx shadow-lg'
                            : 'bg-card border-ink-line hover:border-fx/60 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <Code className={activa ? 'text-mint' : 'text-fx'}>
                            {rx.codigo_receta}
                          </Code>
                          <Stamp tone={activa ? 'mint' : 'amber'} soft={!activa}>
                            Pendiente
                          </Stamp>
                        </div>
                        <p
                          className={`font-display font-semibold text-[15px] leading-tight truncate ${activa ? 'text-paper' : 'text-ink'}`}
                        >
                          {rx.paciente_nombre}
                        </p>
                        <div
                          className={`flex items-center justify-between mt-1.5 font-mono text-[10px] ${activa ? 'text-paper/60' : 'text-ink-faint'}`}
                        >
                          <span className="truncate">{rx.medico}</span>
                          <span className="shrink-0 ml-2">{rx.detalles?.length || 0} Rx</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
              {/* Búsqueda + receta activa */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <label className="relative block group">
                    <Icon
                      name={cargando ? 'sync' : 'search'}
                      className={`absolute left-4 top-1/2 -translate-y-1/2 text-lg text-ink-faint ${cargando ? 'animate-spin text-fx' : ''}`}
                    />
                    <input
                      type="text"
                      value={busqueda}
                      onChange={(e) => buscar(e.target.value)}
                      placeholder="Código RX o cédula del paciente..."
                      aria-label="Buscar receta por código o cédula"
                      className="field-input !pl-11 pr-3"
                    />
                  </label>
                  <p className="font-mono text-[10px] text-ink-faint mt-1.5 px-1">
                    Ej. RX-2026-0892 · cédula 0912345678
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 bg-blood-soft border border-blood/30 rounded-lg px-4 py-3"
                  >
                    <Icon name="warning" className="text-blood text-lg mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blood">Registro no encontrado</p>
                      <p className="text-xs text-ink-soft mt-0.5">{error}</p>
                      {!receta && (
                        <button
                          onClick={cargarEjemplo}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-fx underline underline-offset-2"
                        >
                          Cargar receta de ejemplo <Icon name="arrow_forward" className="text-sm" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!receta ? (
                  <LedgerCard className="p-8 md:p-12 text-center relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
                      <Icon name="prescriptions" className="text-[16rem] -rotate-12" />
                    </div>
                    <div className="relative">
                      <div className="mx-auto w-16 h-16 rounded-full bg-fx-soft text-fx flex items-center justify-center mb-5">
                        <Icon name="prescriptions" filled className="text-3xl" />
                      </div>
                      <h3 className="font-display text-2xl font-semibold text-ink mb-2">
                        Inicie un despacho
                      </h3>
                      <p className="text-sm text-ink-soft max-w-sm mx-auto mb-6">
                        Busque una receta por su código o por la cédula del paciente para verificar
                        medicamentos, existencias y confirmar la entrega.
                      </p>
                      <ToneButton tone="fx" onClick={cargarEjemplo}>
                        Ver receta de ejemplo
                      </ToneButton>
                    </div>
                  </LedgerCard>
                ) : (
                  <LedgerCard className="relative overflow-hidden">
                    {/* Cabecera del paciente */}
                    <div className="p-6 md:p-8 border-b border-ink-line">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-full bg-fx text-paper flex items-center justify-center shrink-0 shadow-md">
                            <Icon name="person" className="text-3xl" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2.5 flex-wrap mb-1">
                              <h3 className="font-display text-2xl md:text-3xl font-semibold text-ink">
                                {receta.paciente_nombre}
                              </h3>
                              {origen === 'demo' && (
                                <span className="font-mono text-[9px] uppercase tracking-widest bg-amber-soft text-amber px-2 py-0.5 rounded">
                                  Demo
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-ink-soft">
                              Cédula{' '}
                              <Code className="text-ink font-medium">{receta.paciente_cedula}</Code>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center md:flex-col md:items-end gap-3 md:gap-1.5">
                          {receta.estado === 'RECIBIDA' ? (
                            <Stamp tone="mint">Recibida</Stamp>
                          ) : receta.estado === 'ENTREGADA' ? (
                            <Stamp tone="fx">Entregada</Stamp>
                          ) : receta.estado === 'DESPACHADA' ? (
                            <Stamp tone="mint">Despachada</Stamp>
                          ) : (
                            <Stamp tone="doc" soft>
                              Válida · Pendiente
                            </Stamp>
                          )}
                          <Code className="text-ink-faint">{formatearFecha(receta.fecha_emision)}</Code>
                        </div>
                      </div>

                      {/* Médico referente */}
                      <div className="mt-5 flex items-center gap-3 bg-fx-soft/60 border border-fx/15 rounded-md px-4 py-3">
                        <Icon name="stethoscope" className="text-fx text-xl" />
                        <div className="flex-1">
                          <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                            Médico referente
                          </p>
                          <p className="text-sm font-semibold text-ink">{receta.medico}</p>
                        </div>
                        <Icon name="open_in_new" className="text-ink-faint text-lg" />
                      </div>
                    </div>

                    {/* Medicamentos */}
                    <div className="p-6 md:p-8">
                      <SectionLabel index="A" tone="fx" className="mb-5">
                        Medicamentos prescritos
                      </SectionLabel>
                      <ol className="divide-y divide-ink-line/70">
                        {receta.detalles.map((d, i) => {
                          const marcado = seleccion.has(d.medicamento_id);
                          const despachadoItem = d.cantidad_despachada > 0;
                          return (
                            <li
                              key={d.medicamento_id}
                              className={`py-4 flex items-start gap-4 transition-colors ${marcado ? 'bg-mint-soft/40' : ''}`}
                            >
                              <span className="row-no pt-1.5 w-6">
                                {(i + 1).toString().padStart(2, '0')}
                              </span>
                              <input
                                type="checkbox"
                                id={`med-${d.medicamento_id}`}
                                className="stamp-check mt-1.5"
                                checked={marcado}
                                disabled={despachadoItem}
                                onChange={() => toggleMed(d.medicamento_id)}
                              />
                              <label
                                htmlFor={`med-${d.medicamento_id}`}
                                className={`flex-1 min-w-0 ${despachadoItem ? 'opacity-50' : 'cursor-pointer'}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-display text-lg font-semibold text-ink">
                                      {d.nombre_medicamento}
                                    </p>
                                    <p className="text-sm text-ink-soft mt-0.5">{d.posologia}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="font-display italic text-xl font-semibold text-ink leading-none">
                                      {despachadoItem
                                        ? d.cantidad_despachada
                                        : d.cantidad_prescrita}
                                    </p>
                                    <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint mt-1">
                                      {d.categoria || 'unidades'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Stamp tone={d.categoria ? 'fx' : 'ink'} soft>
                                    {d.categoria || 'Medicamento'}
                                  </Stamp>
                                  {typeof d.stock === 'number' && (
                                    <span
                                      className={`font-mono text-[10px] flex items-center gap-1 ${
                                        d.stock < 50 ? 'text-blood' : 'text-ink-faint'
                                      }`}
                                    >
                                      <Icon name="inventory_2" className="text-xs" />
                                      Stock: {d.stock} cajas
                                    </span>
                                  )}
                                  {despachadoItem && <Stamp tone="mint">Entregado</Stamp>}
                                </div>
                              </label>
                            </li>
                          );
                        })}
                      </ol>

                      {/* Conformidad de entrega: segunda verificación del ciclo */}
                      {receta.estado === 'DESPACHADA' && (
                        <div className="mt-6 rounded-md border border-fx/25 bg-fx-soft/40 px-4 py-4">
                          <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint mb-2 flex items-center gap-1.5">
                            <Icon name="handshake" className="text-sm text-fx" /> Conformidad de entrega
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <label className="flex-1 relative block">
                              <Icon
                                name="badge"
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-ink-faint"
                              />
                              <input
                                type="text"
                                value={cedulaEntrega}
                                onChange={(e) => {
                                  setCedulaEntrega(e.target.value);
                                  setError('');
                                }}
                                placeholder="Cédula de quien recibe los medicamentos..."
                                aria-label="Cédula de quien recibe los medicamentos"
                                className="field-input !pl-11 pr-3"
                              />
                            </label>
                            <ToneButton
                              tone="fx"
                              onClick={entregar}
                              loading={entregando}
                              disabled={!String(cedulaEntrega).trim()}
                            >
                              {entregando ? 'Registrando...' : 'Entregar al paciente'}
                              {!entregando && <Icon name="local_shipping" filled className="text-base" />}
                            </ToneButton>
                          </div>
                          <p className="font-mono text-[10px] text-ink-faint mt-2">
                            El paciente confirmará la recepción desde su portal para cerrar la receta.
                          </p>
                        </div>
                      )}

                      {receta.estado === 'ENTREGADA' && (
                        <div className="mt-6 rounded-md border border-fx/25 bg-fx-soft/40 px-4 py-4 flex items-start gap-3">
                          <Icon name="local_shipping" className="text-fx text-xl mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-ink">Entregada al paciente</p>
                            <p className="text-xs text-ink-soft mt-0.5">
                              Registrada por {receta.entregada_por || 'farmacia'} el{' '}
                              {formatearFecha(receta.entregada_at)}. Pendiente de la confirmación
                              del paciente en su portal.
                            </p>
                          </div>
                        </div>
                      )}

                      {receta.estado === 'RECIBIDA' && (
                        <div className="mt-6 rounded-md border border-mint/30 bg-mint-soft/50 px-4 py-4 flex items-start gap-3">
                          <Icon name="verified" className="text-mint text-xl mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-ink">Recibida por el paciente</p>
                            <p className="text-xs text-ink-soft mt-0.5">
                              Confirmada el {formatearFecha(receta.recibida_at)}. Receta cerrada
                              con la doble conformidad (farmacia y paciente).
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="mt-6 pt-5 border-t border-ink-line flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2 text-xs text-ink-faint">
                          {receta.estado === 'PENDIENTE' ? (
                            <>
                              <Icon name="info" className="text-base" />
                              <span>
                                {seleccion.size} de {receta.detalles.length} medicamentos marcados
                              </span>
                            </>
                          ) : (
                            <>
                              <Icon name="check_circle" className="text-mint text-base" />
                              <span>
                                {receta.estado === 'RECIBIDA'
                                  ? 'Receta cerrada con doble conformidad'
                                  : receta.estado === 'ENTREGADA'
                                    ? 'Entrega registrada · falta la confirmación del paciente'
                                    : 'Despacho completado · registre la entrega al paciente'}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setReceta(null);
                              setBusqueda('');
                              setError('');
                            }}
                            className="px-5 py-2.5 rounded-md text-sm font-semibold text-ink-soft border border-ink-line hover:bg-paper-2 transition-colors"
                          >
                            Descartar
                          </button>
                          {receta.estado === 'PENDIENTE' && (
                            <ToneButton
                              tone="fx"
                              onClick={despachar}
                              loading={despachando}
                              disabled={seleccion.size === 0}
                            >
                              {despachando ? 'Procesando...' : 'Confirmar despacho'}
                              {!despachando && <Icon name="check_circle" filled className="text-base" />}
                            </ToneButton>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sello de despacho/entrega confirmado */}
                    {(despachado || entregaHecha) && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                        <span
                          className="font-display italic font-black text-[64px] md:text-[88px] tracking-tight border-[5px] rounded-md px-8 py-2"
                          style={{
                            borderColor: despachado ? 'var(--color-mint)' : 'var(--color-fx)',
                            color: despachado ? 'var(--color-mint)' : 'var(--color-fx)',
                            background: 'rgba(251,247,238,0.7)',
                            animation: 'var(--animate-stamp)',
                            transform: 'rotate(-8deg)',
                            opacity: 0.92,
                          }}
                        >
                          {despachado ? 'Despachado' : 'Entregado'}
                        </span>
                      </div>
                    )}
                  </LedgerCard>
                )}

                {resultadoDespacho > 0 && !despachado && (
                  <div className="flex items-center gap-3 bg-mint-soft border border-mint/30 rounded-md px-4 py-3 text-sm">
                    <Icon name="verified" className="text-mint text-xl" />
                    <p className="text-ink">
                      <strong className="text-mint">Despacho registrado.</strong>{' '}
                      {resultadoDespacho} unidades entregadas y deducidas del inventario.
                    </p>
                  </div>
                )}
              </div>

              {/* Atajos operativos (sin métricas: el consolidado lo verá administración) */}
              <div className="space-y-6">
                <LedgerCard>
                  <div className="p-6">
                    <SectionLabel index="B" tone="fx" className="mb-4">
                      Existencias del día
                    </SectionLabel>
                    {inventario.length === 0 ? (
                      <p className="text-sm text-ink-faint italic py-4 text-center">
                        Cargando inventario…
                      </p>
                    ) : (
                      <ol className="divide-y divide-ink-line/70">
                        {[...inventario]
                          .sort((a, b) => a.nombre.localeCompare(b.nombre))
                          .slice(0, 5)
                          .map((m) => (
                            <li key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink truncate">{m.nombre}</p>
                                <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                                  {m.presentacion}
                                  {m.concentracion ? ` · ${m.concentracion}` : ''}
                                </p>
                              </div>
                              <span
                                className="font-mono text-sm font-semibold shrink-0"
                                style={{ color: ESTADO_MED[nivelDe(m)].color }}
                              >
                                {m.stock_actual}
                              </span>
                            </li>
                          ))}
                      </ol>
                    )}
                    <button
                      onClick={() => setVista('inventario')}
                      className="w-full mt-4 py-2.5 rounded-md border border-ink-line text-fx font-semibold text-xs hover:bg-fx-soft/40 transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      Ver inventario completo <Icon name="arrow_forward" className="text-sm" />
                    </button>
                  </div>
                </LedgerCard>

                <LedgerCard>
                  <div className="p-6">
                    <SectionLabel index="C" tone="blood" className="mb-4">
                      Alertas de stock
                    </SectionLabel>
                    {alertas.length === 0 ? (
                      <div className="text-center py-4">
                        <Icon name="verified" filled className="text-mint text-2xl mx-auto mb-2" />
                        <p className="text-sm font-semibold text-ink">Sin alertas activas</p>
                        <p className="text-xs text-ink-faint mt-0.5">
                          Todas las existencias sobre el mínimo.
                        </p>
                      </div>
                    ) : (
                      <>
                        <ol className="divide-y divide-ink-line/70">
                          {alertas.slice(0, 3).map((m) => {
                            const est = ESTADO_MED[nivelDe(m)];
                            const min = m.stock_minimo ?? 0;
                            const faltante = Math.max(min - (m.stock_actual ?? 0), 0);
                            return (
                              <li key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-ink truncate">{m.nombre}</p>
                                  <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                                    {nivelDe(m) === 'SIN_STOCK'
                                      ? 'Sin existencias'
                                      : `Faltan ${faltante} para el mínimo`}
                                  </p>
                                </div>
                                <Stamp tone={est.tone} soft>
                                  {est.etiqueta}
                                </Stamp>
                              </li>
                            );
                          })}
                        </ol>
                        <button
                          onClick={() => setVista('alertas')}
                          className="w-full mt-4 py-2.5 rounded-md border border-blood/30 text-blood font-semibold text-xs hover:bg-blood-soft/60 transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          Gestionar {alertas.length} alerta{alertas.length === 1 ? '' : 's'}{' '}
                          <Icon name="arrow_forward" className="text-sm" />
                        </button>
                      </>
                    )}
                  </div>
                </LedgerCard>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            CAPÍTULO II · INVENTARIO DE MEDICAMENTOS
        ============================================================ */}
        {vista === 'inventario' && (
          <div className="rise-in">
            {/* Filtros */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-3">
              <div className="w-full lg:w-96">
                <label className="relative block group">
                  <Icon
                    name="search"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-ink-faint"
                  />
                  <input
                    type="text"
                    value={invBusqueda}
                    onChange={(e) => setInvBusqueda(e.target.value)}
                    placeholder="Buscar medicamento..."
                    aria-label="Buscar en el inventario"
                    className="field-input !pl-11 pr-3"
                  />
                </label>
              </div>
              <div className="flex gap-3 flex-wrap">
                <label className="block">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint mb-1.5">
                    Categoría
                  </span>
                  <select
                    value={invCategoria}
                    onChange={(e) => setInvCategoria(e.target.value)}
                    aria-label="Filtrar por categoría"
                    className="field-input !py-2.5 clinic-select"
                  >
                    <option value="">Todas</option>
                    {categorias.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint mb-1.5">
                    Existencias
                  </span>
                  <select
                    value={invEstado}
                    onChange={(e) => setInvEstado(e.target.value)}
                    aria-label="Filtrar por nivel de existencias"
                    className="field-input !py-2.5 clinic-select"
                  >
                    <option value="todos">Todos</option>
                    <option value="OK">Disponible</option>
                    <option value="BAJO">Bajo mínimo</option>
                    <option value="SIN_STOCK">Sin stock</option>
                  </select>
                </label>
              </div>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint mb-5">
              {inventarioFiltrado.length} registro{inventarioFiltrado.length === 1 ? '' : 's'} ·{' '}
              {agrupado.length} categoría{agrupado.length === 1 ? '' : 's'} ·{' '}
              {inventarioFiltrado.filter((m) => nivelDe(m) !== 'OK').length} con alerta
            </p>

            {/* Registro del inventario */}
            <LedgerCard className="overflow-hidden">
              <div className={`hidden md:grid ${columnaGrid} gap-x-5 px-5 py-2.5 border-b border-ink-line bg-paper-2/70`}>
                <span className={cabeceraCelda}>Cód</span>
                <span className={cabeceraCelda}>Medicamento</span>
                <span className={cabeceraCelda}>Categoría</span>
                <span className={cabeceraCelda}>Existencia</span>
                <span className={cabeceraCelda}>Vence</span>
                <span className={`${cabeceraCelda} text-right`}>Estado</span>
              </div>

              {inventarioFiltrado.length === 0 ? (
                <div className="p-10 text-center">
                  <Icon name="inventory_2" className="text-4xl text-ink-faint/50 mx-auto mb-3" />
                  <p className="font-display text-lg font-semibold text-ink">
                    Sin coincidencias
                  </p>
                  <p className="text-sm text-ink-soft mt-1 mb-5">
                    Ajuste la búsqueda o los filtros para ver más registros.
                  </p>
                  <ToneButton
                    tone="fx"
                    onClick={() => {
                      setInvBusqueda('');
                      setInvCategoria('');
                      setInvEstado('todos');
                    }}
                  >
                    Limpiar filtros
                  </ToneButton>
                </div>
              ) : (
                agrupado.map(([categoria, items], idx) => (
                  <section key={categoria}>
                    <div className="sticky top-0 z-10 bg-paper-2/95 backdrop-blur px-5 py-2 flex items-center gap-3 border-b border-ink-line/60">
                      <span className="row-no">{String(idx + 1).padStart(2, '0')}</span>
                      <h4 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft font-semibold">
                        {categoria}
                      </h4>
                      <span className="flex-1 h-px bg-ink-line" />
                      <span className="font-mono text-[9px] text-ink-faint">
                        {items.length} registro{items.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    {items.map((m) => {
                      const nivel = nivelDe(m);
                      const est = ESTADO_MED[nivel];
                      const min = m.stock_minimo ?? 0;
                      const venc = infoVencimiento(m.vencimiento);
                      const porcentaje = Math.min(
                        ((m.stock_actual ?? 0) / Math.max(min * 2, 1)) * 100,
                        100
                      );
                      return (
                        <div
                          key={m.id}
                          className={`grid grid-cols-2 ${columnaGrid} gap-x-5 gap-y-2 px-5 py-4 border-b border-ink-line/40 last:border-b-0 hover:bg-card-hover transition-colors ${nivel === 'SIN_STOCK' ? 'bg-blood-soft/25' : nivel === 'BAJO' ? 'bg-amber-soft/20' : ''}`}
                        >
                          <span className="row-no hidden md:block self-start pt-1.5">
                            #{String(m.id).padStart(3, '0')}
                          </span>
                          <div className="col-span-2 md:col-span-1 min-w-0">
                            <p className="font-display font-semibold text-[15px] text-ink leading-tight truncate">
                              {m.nombre}
                            </p>
                            <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint mt-0.5">
                              {m.presentacion}
                              {m.concentracion ? ` · ${m.concentracion}` : ''} · {m.unidad || 'unidad'}
                            </p>
                          </div>
                          <div className="self-center min-w-0">
                            <Stamp tone="fx" soft className="max-w-full overflow-hidden text-ellipsis">
                              {m.categoria || 'Sin categoría'}
                            </Stamp>
                          </div>
                          <div className="self-center">
                            <div className="flex items-baseline gap-2">
                              <span
                                className="font-display italic text-xl font-semibold leading-none"
                                style={{ color: est.color }}
                              >
                                {m.stock_actual}
                              </span>
                              <span className="font-mono text-[9px] text-ink-faint">
                                mín {min}
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-ink-line/40 mt-1.5 overflow-hidden max-w-[110px]">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${porcentaje}%`, background: est.color }}
                              />
                            </div>
                          </div>
                          <div className="self-center">
                            <p
                              className={`font-mono text-[10px] ${
                                venc
                                  ? venc.tipo === 'vencido'
                                    ? 'text-blood'
                                    : 'text-amber'
                                  : 'text-ink-faint'
                              }`}
                            >
                              {m.vencimiento || '—'}
                            </p>
                            {venc && (
                              <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint mt-0.5">
                                {venc.tipo === 'vencido' ? 'vencido' : `en ${venc.meses} mes${venc.meses === 1 ? '' : 'es'}`}
                              </p>
                            )}
                          </div>
                          <div className="self-center justify-self-start md:justify-self-end">
                            <Stamp tone={est.tone} soft={nivel === 'OK'}>
                              {est.etiqueta}
                            </Stamp>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ))
              )}
            </LedgerCard>
          </div>
        )}

        {/* ============================================================
            CAPÍTULO III · ALERTAS DE STOCK
        ============================================================ */}
        {vista === 'alertas' && (
          <div className="rise-in space-y-8">
            {sinStock.length > 0 && (
              <section aria-label="Medicamentos sin existencias">
                <SectionLabel index="I" tone="blood" className="mb-4">
                  Sin existencias · acción inmediata
                </SectionLabel>
                <div className="space-y-3">{sinStock.map(filaAlerta)}</div>
              </section>
            )}

            {bajos.length > 0 && (
              <section aria-label="Medicamentos bajo el mínimo de seguridad">
                <SectionLabel index="II" tone="amber" className="mb-4">
                  Bajo el mínimo de seguridad
                </SectionLabel>
                <div className="space-y-3">{bajos.map(filaAlerta)}</div>
              </section>
            )}

            {alertas.length === 0 && (
              <LedgerCard className="p-10 md:p-14 text-center relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
                  <Icon name="verified" className="text-[14rem] -rotate-12" />
                </div>
                <div className="relative">
                  <div className="mx-auto w-16 h-16 rounded-full bg-mint-soft text-mint flex items-center justify-center mb-5">
                    <Icon name="verified" filled className="text-3xl" />
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-ink mb-2">
                    Inventario en orden
                  </h3>
                  <p className="text-sm text-ink-soft max-w-sm mx-auto mb-6">
                    Todos los medicamentos están por encima de su mínimo de seguridad. Aquí
                    aparecerán los avisos de stock bajo cuando existan.
                  </p>
                  <ToneButton tone="fx" onClick={() => setVista('inventario')}>
                    Ver inventario completo
                  </ToneButton>
                </div>
              </LedgerCard>
            )}

            {alertas.length > 0 && (
              <LedgerCard>
                <div className="p-5 flex items-start gap-3">
                  <Icon name="link" className="text-fx text-xl mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Consolidación administrativa
                    </p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      Las solicitudes de reposición marcadas aquí quedan registradas en el libro
                      local y serán consolidadas por el módulo de administración cuando esté
                      disponible, junto con el resto de los datos de la farmacia.
                    </p>
                  </div>
                </div>
              </LedgerCard>
            )}
          </div>
        )}
      </main>
    </ClinicalShell>
  );
}

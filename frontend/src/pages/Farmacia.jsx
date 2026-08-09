import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import ClinicalShell from '../clinical/ClinicalShell';
import { Stamp, LedgerCard, SectionLabel, Code, ToneButton } from '../clinical/ui';
import { API } from '../api';
import { DEMO, INVENTARIO_DEMO } from '../clinical/demo';

const USUARIO_FARMACIA = { id: 2071, clinica_id: 2 };

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

export default function Farmacia() {
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

  async function abrirPendiente(rx) {
    setReceta(rx);
    setOrigen(pendientesDemo ? 'demo' : 'api');
    setSeleccion(new Set());
    setError('');
    setDespachado(false);
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
        items,
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
      setDespachado(true);
      setResultadoDespacho(items.reduce((a, i) => a + i.cantidad_despachada, 0));
      setPendientes((prev) => prev.filter((p) => p.id !== receta.id));
      setTimeout(() => setDespachado(false), 4200);
    } finally {
      setDespachando(false);
    }
  }

  const criticos = INVENTARIO_DEMO.filter((m) => m.estado === 'CRITICO').length;
  const bajos = INVENTARIO_DEMO.filter((m) => m.estado === 'BAJO').length;
  const salud = Math.round(
    ((INVENTARIO_DEMO.length - criticos - bajos) / INVENTARIO_DEMO.length) * 100
  );

  return (
    <ClinicalShell module="farmacia">
      <main className="h-full overflow-y-auto ledger-scroll px-5 md:px-8 py-6 md:py-8 pb-20 max-w-[1440px] mx-auto">
        {/* Bandeja de recetas que llegan de los médicos */}
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
                    <p className={`font-display font-semibold text-[15px] leading-tight truncate ${activa ? 'text-paper' : 'text-ink'}`}>
                      {rx.paciente_nombre}
                    </p>
                    <div className={`flex items-center justify-between mt-1.5 font-mono text-[10px] ${activa ? 'text-paper/60' : 'text-ink-faint'}`}>
                      <span className="truncate">{rx.medico}</span>
                      <span className="shrink-0 ml-2">{rx.detalles?.length || 0} Rx</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Encabezado + búsqueda */}
        <header className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint mb-1">
                Libro de despacho · Registro activo
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink">
                {receta ? (
                  <>
                    Receta <span className="italic text-fx">{receta.codigo_receta}</span>
                  </>
                ) : (
                  'Despacho de recetas'
                )}
              </h2>
            </div>
            <div className="w-full md:w-96">
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
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 bg-blood-soft border border-blood/30 rounded-lg px-4 py-3"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
          {/* ===== Columna izquierda: receta activa ===== */}
          <div className="lg:col-span-2 space-y-6">
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
                      {receta.estado === 'DESPACHADA' ? (
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
                          <span className="row-no pt-1.5 w-6">{(i + 1).toString().padStart(2, '0')}</span>
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

                  {/* Acciones */}
                  <div className="mt-6 pt-5 border-t border-ink-line flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-ink-faint">
                      <Icon name="info" className="text-base" />
                      {receta.estado === 'DESPACHADA' ? (
                        <span>Despacho completado en este registro.</span>
                      ) : (
                        <span>
                          {seleccion.size} de {receta.detalles.length} medicamentos marcados
                        </span>
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
                      {receta.estado !== 'DESPACHADA' && (
                        <ToneButton tone="fx" onClick={despachar} loading={despachando} disabled={seleccion.size === 0}>
                          {despachando ? 'Procesando...' : 'Confirmar despacho'}
                          {!despachando && <Icon name="check_circle" filled className="text-base" />}
                        </ToneButton>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sello de despacho confirmado */}
                {despachado && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                    <span
                      className="font-display italic font-black text-[64px] md:text-[88px] tracking-tight border-[5px] rounded-md px-8 py-2 text-mint"
                      style={{
                        borderColor: 'var(--color-mint)',
                        color: 'var(--color-mint)',
                        background: 'rgba(251,247,238,0.7)',
                        animation: 'var(--animate-stamp)',
                        transform: 'rotate(-8deg)',
                        opacity: 0.92,
                      }}
                    >
                      Despachado
                    </span>
                  </div>
                )}
              </LedgerCard>
            )}

            {resultadoDespacho > 0 && !despachado && (
              <div className="flex items-center gap-3 bg-mint-soft border border-mint/30 rounded-md px-4 py-3 text-sm">
                <Icon name="verified" className="text-mint text-xl" />
                <p className="text-ink">
                  <strong className="text-mint">Despacho registrado.</strong> {resultadoDespacho}{' '}
                  unidades entregadas y deducidas del inventario.
                </p>
              </div>
            )}
          </div>

          {/* ===== Columna derecha: inventario ===== */}
          <div className="space-y-6">
            <div className="rounded-lg overflow-hidden shadow-xl bg-ink text-paper relative">
              <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(120% 80% at 90% 0%, rgba(13,92,71,0.85), transparent 60%)' }} />
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-paper/50">
                    Estado del inventario
                  </p>
                  <Icon name="monitoring" className="text-paper/60 text-xl" />
                </div>
                <div className="flex items-end gap-3 mb-6">
                  <span className="font-display italic font-semibold text-5xl text-paper leading-none">
                    {salud}%
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-mint pb-1">
                    Nivel óptimo
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between font-mono text-[10px] mb-1.5 text-paper/60">
                      <span>Disponibilidad general</span>
                      <span className="text-paper font-semibold">{salud}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-paper/15 overflow-hidden">
                      <div className="h-full rounded-full bg-mint" style={{ width: `${salud}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-[10px] mb-1.5 text-paper/60">
                      <span>Insumos críticos</span>
                      <span className="text-amber font-semibold">{criticos + bajos}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-paper/15 overflow-hidden">
                      <div className="h-full rounded-full bg-amber" style={{ width: `${((criticos + bajos) / INVENTARIO_DEMO.length) * 100}%` }} />
                    </div>
                    <p className="flex items-center gap-1.5 font-mono text-[9px] text-amber mt-1.5">
                      <Icon name="warning" className="text-xs" /> Requiere reabastecimiento
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <LedgerCard>
              <div className="p-6">
                <SectionLabel index="B" tone="fx" className="mb-4">
                  Inventario rápido
                </SectionLabel>
                <ol className="divide-y divide-ink-line/70">
                  {INVENTARIO_DEMO.slice(0, 5).map((m) => (
                    <li key={m.nombre} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{m.nombre}</p>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                          Vence {m.vencimiento}
                        </p>
                      </div>
                      <span
                        className={`font-mono text-sm font-semibold ${
                          m.estado === 'CRITICO'
                            ? 'text-blood'
                            : m.estado === 'BAJO'
                              ? 'text-amber'
                              : 'text-mint'
                        }`}
                      >
                        {m.stock.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
                <button
                  onClick={cargarEjemplo}
                  className="w-full mt-4 py-2.5 rounded-md border border-ink-line text-fx font-semibold text-xs hover:bg-fx-soft/40 transition-colors"
                >
                  Ver inventario completo
                </button>
              </div>
            </LedgerCard>
          </div>
        </div>
      </main>
    </ClinicalShell>
  );
}

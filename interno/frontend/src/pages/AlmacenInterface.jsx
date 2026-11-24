import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  CheckCircle2,
  Clock,
  PackageCheck,
  RefreshCw,
  Truck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

/* ─── Utilidades ───────────────────────────────────────────────── */

function fecha(valor) {
  if (!valor) return '—';
  const d = new Date(String(valor).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(valor).slice(0, 16);
  return d.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' });
}

function Badge({ children, color = 'slate' }) {
  const colores = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-rose-50 text-rose-700 ring-rose-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${colores[color]}`}>
      {children}
    </span>
  );
}

const TABS = [
  { id: 'ordenes', label: 'Órdenes de entrega', icon: Truck },
  { id: 'inventario', label: 'Inventario', icon: Boxes },
  { id: 'movimientos', label: 'Movimientos', icon: Clock },
];

export default function AlmacenInterface({ userName, clinicaNombre, onLogout }) {
  const [tab, setTab] = useState('ordenes');
  const [resumen, setResumen] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [stock, setStock] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [recibiendo, setRecibiendo] = useState(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [filtroOrden, setFiltroOrden] = useState('pendiente_recepcion');
  const [salida, setSalida] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [r, o, s, m] = await Promise.all([
        axiosClient.get('/almacen/resumen'),
        axiosClient.get('/almacen/ordenes'),
        axiosClient.get('/almacen/stock'),
        axiosClient.get('/almacen/movimientos'),
      ]);
      setResumen(r.data);
      setOrdenes(o.data.items || []);
      setStock(s.data.items || []);
      setMovimientos(m.data.items || []);
      setError('');
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo cargar el almacén.');
    } finally {
      setCargando(false);
    }
  }, []);

  const sincronizar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      const { data } = await axiosClient.post('/almacen/sincronizar');
      setSinConexion(false);
      if (!silencioso) {
        setAviso(
          `Sincronizado: ${data.enviados || 0} cambio(s) enviado(s), ${data.ordenes_nuevas || 0} orden(es) nueva(s).`
        );
      }
      await cargar();
    } catch {
      setSinConexion(true);
      if (!silencioso) {
        setAviso('Sin conexión con el portal. Los movimientos quedaron guardados y se enviarán al reconectar.');
      }
      await cargar().catch(() => {});
    }
  }, [cargar]);

  useEffect(() => {
    (async () => {
      await sincronizar({ silencioso: true });
      await cargar();
    })();
    const id = setInterval(() => sincronizar({ silencioso: true }), 45000);
    return () => clearInterval(id);
  }, [sincronizar, cargar]);

  const pendientes = useMemo(
    () => ordenes.filter((o) => o.estado === 'pendiente_recepcion'),
    [ordenes]
  );
  const visibles = useMemo(
    () => ordenes.filter((o) => o.estado === filtroOrden),
    [ordenes, filtroOrden]
  );
  const recibir = async (orden) => {
    const ok = window.confirm(
      `¿Marcar como recibida la orden ${orden.numero || orden.id.slice(0, 8)}? ` +
        'Las cantidades se sumarán al inventario del centro.'
    );
    if (!ok) return;
    setRecibiendo(orden.id);
    setError('');
    try {
      const { data } = await axiosClient.post(`/almacen/ordenes/${orden.id}/recibir`);
      setAviso(`Orden recibida: ${data.items} producto(s) sumados al inventario.`);
      await sincronizar({ silencioso: true });
      await cargar();
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo recibir la orden.');
    } finally {
      setRecibiendo(null);
    }
  };

  const registrarSalida = async (evento) => {
    evento.preventDefault();
    if (!salida) return;
    const cantidad = Number(salida.cantidadInput);
    if (!cantidad || cantidad <= 0) {
      setError('Indique una cantidad mayor a cero.');
      return;
    }
    try {
      await axiosClient.post('/almacen/salidas', {
        item_key: salida.item_key,
        cantidad,
        motivo: salida.motivo || 'Consumo diario',
      });
      setAviso(`Salida registrada: ${cantidad} ${salida.unidad || 'unidad(es)'} de ${salida.nombre}.`);
      setSalida(null);
      await sincronizar({ silencioso: true });
      await cargar();
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo registrar la salida.');
    }
  };

  const sync = resumen?.sync || {};
  const pendientesSync = sync.pendientes ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Encabezado */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="font-display text-base font-bold text-slate-800">Almacén del centro</h1>
              <p className="text-[11px] text-slate-500">
                {clinicaNombre || 'Centro de salud'} · {userName || 'Jefe de Almacén'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pendientesSync > 0 ? (
              <Badge color="amber">
                <Clock className="h-3 w-3" /> {pendientesSync} por enviar
              </Badge>
            ) : (
              <Badge color="green">
                <CheckCircle2 className="h-3 w-3" /> Todo sincronizado
              </Badge>
            )}
            <button
              onClick={() => sincronizar()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-100"
              >
                Salir
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        {sinConexion && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Sin conexión con el portal web. Puede seguir recibiendo y descontando insumos:
              todo queda guardado y se enviará automáticamente al restablecerse la conexión.
            </p>
          </div>
        )}
        {aviso && (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12px] text-emerald-800">
            <span className="flex items-start gap-2">
              <Wifi className="mt-0.5 h-4 w-4 shrink-0" /> {aviso}
            </span>
            <button onClick={() => setAviso('')} aria-label="Cerrar aviso">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {error && (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] text-rose-800">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </span>
            <button onClick={() => setError('')} aria-label="Cerrar error">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi titulo="Órdenes pendientes" valor={resumen?.ordenes_pendientes ?? pendientes.length} tono="amber" />
          <Kpi titulo="Productos" valor={resumen?.productos ?? stock.length} tono="slate" />
          <Kpi titulo="Unidades en stock" valor={resumen?.unidades ?? 0} tono="green" />
          <Kpi titulo="Bajo mínimo" valor={resumen?.bajo_minimo ?? 0} tono="red" />
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
                tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === 'ordenes' && pendientes.length > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950">
                  {pendientes.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {cargando ? (
          <p className="py-10 text-center text-[12px] text-slate-500">Cargando almacén…</p>
        ) : (
          <>
            {tab === 'ordenes' && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Filtro activo={filtroOrden === 'pendiente_recepcion'} onClick={() => setFiltroOrden('pendiente_recepcion')}>
                    Por recibir ({pendientes.length})
                  </Filtro>
                  <Filtro activo={filtroOrden === 'recibida'} onClick={() => setFiltroOrden('recibida')}>
                    Recibidas
                  </Filtro>
                </div>

                {visibles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center">
                    <Truck className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-[12px] text-slate-500">
                      {filtroOrden === 'pendiente_recepcion'
                        ? 'No hay órdenes pendientes para este centro.'
                        : 'Todavía no hay órdenes recibidas.'}
                    </p>
                  </div>
                ) : (
                  visibles.map((orden) => (
                    <article key={orden.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                        <div>
                          <p className="text-[13px] font-bold text-slate-800">
                            Orden {orden.numero || orden.id.slice(0, 8)}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Enviada {fecha(orden.creada_en)} {orden.creada_por ? `· ${orden.creada_por}` : ''}
                          </p>
                        </div>
                        {orden.estado === 'pendiente_recepcion' ? (
                          <Badge color="amber">
                            <Clock className="h-3 w-3" /> Pendiente de recepción
                          </Badge>
                        ) : (
                          <Badge color="green">
                            <CheckCircle2 className="h-3 w-3" /> Recibida {fecha(orden.recibida_en)}
                          </Badge>
                        )}
                      </header>

                      {orden.observacion && (
                        <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
                          {orden.observacion}
                        </p>
                      )}

                      <div className="overflow-x-auto px-4 py-2">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                              <th className="py-1.5">Producto</th>
                              <th className="py-1.5">Tipo</th>
                              <th className="py-1.5 text-right">Cantidad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(orden.items || []).map((it) => (
                              <tr key={`${orden.id}-${it.item_key}`} className="border-t border-slate-100">
                                <td className="py-1.5 font-medium text-slate-700">{it.nombre}</td>
                                <td className="py-1.5 text-slate-500 capitalize">{it.tipo}</td>
                                <td className="py-1.5 text-right font-bold text-slate-800">
                                  {it.cantidad} {it.unidad || ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {orden.estado === 'pendiente_recepcion' && (
                        <div className="flex justify-end border-t border-slate-100 px-4 py-3">
                          <button
                            onClick={() => recibir(orden)}
                            disabled={recibiendo === orden.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <ArrowDownToLine className="h-4 w-4" />
                            {recibiendo === orden.id ? 'Procesando…' : 'Marcar como recibido'}
                          </button>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </section>
            )}

            {tab === 'inventario' && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2 text-right">Disponible</th>
                        <th className="px-3 py-2 text-right">Mínimo</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                        <th className="px-3 py-2 text-right">Salida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                            El inventario está vacío. Se llenará al recibir una orden de entrega.
                          </td>
                        </tr>
                      ) : (
                        stock.map((item) => (
                          <tr key={item.item_key} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-800">{item.nombre}</td>
                            <td className="px-3 py-2 capitalize text-slate-500">{item.tipo}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-800">{item.cantidad}</td>
                            <td className="px-3 py-2 text-right text-slate-500">{item.stock_minimo}</td>
                            <td className="px-3 py-2 text-center">
                              {item.bajo_minimo ? (
                                <Badge color="red">Bajo mínimo</Badge>
                              ) : (
                                <Badge color="green">Disponible</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() =>
                                setSalida({ ...item, stock: item.cantidad, cantidadInput: 1, motivo: 'Consumo diario' })
                              }
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                              >
                                <ArrowDownToLine className="h-3.5 w-3.5" /> Descontar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === 'movimientos' && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2 text-right">Cantidad</th>
                        <th className="px-3 py-2">Referencia</th>
                        <th className="px-3 py-2">Usuario</th>
                        <th className="px-3 py-2 text-center">Portal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                            Sin movimientos registrados.
                          </td>
                        </tr>
                      ) : (
                        movimientos.map((m, idx) => (
                          <tr key={`${m.item_key}-${m.created_at}-${idx}`} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-500">{fecha(m.created_at)}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{m.nombre}</td>
                            <td className="px-3 py-2">
                              {m.tipo === 'ENTRADA' ? (
                                <Badge color="green">Entrada</Badge>
                              ) : m.tipo === 'SALIDA' ? (
                                <Badge color="blue">Salida</Badge>
                              ) : (
                                <Badge color="violet">Ajuste</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-800">{m.cantidad}</td>
                            <td className="px-3 py-2 text-slate-500">{m.referencia || '—'}</td>
                            <td className="px-3 py-2 text-slate-500">{m.usuario || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              {m.sincronizado ? <Badge color="green">Sí</Badge> : <Badge color="amber">Pendiente</Badge>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {sync?.ultimo_error && (
                  <p className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    Último error de sincronización: {sync.ultimo_error}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Modal de salida rápida */}
      {salida && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={registrarSalida}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Registrar salida</h3>
              <button type="button" onClick={() => setSalida(null)} aria-label="Cerrar">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <p className="mb-3 text-[12px] text-slate-600">
              {salida.nombre} — disponible: <strong>{salida.stock}</strong>
            </p>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Cantidad a descontar</label>
            <input
              type="number"
              min="1"
              max={salida.stock}
              value={salida.cantidadInput ?? 1}
              onChange={(e) => setSalida({ ...salida, cantidadInput: e.target.value })}
              className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Motivo</label>
            <input
              type="text"
              value={salida.motivo}
              onChange={(e) => setSalida({ ...salida, motivo: e.target.value })}
              placeholder="Consulta, curación, emergencia…"
              className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSalida(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-emerald-700"
              >
                Descontar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Kpi({ titulo, valor, tono = 'slate' }) {
  const tonos = {
    slate: 'text-slate-800',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-rose-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className={`font-display text-2xl font-bold ${tonos[tono]}`}>{valor}</p>
    </div>
  );
}

function Filtro({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
        activo
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { API } from '../api';

const ROLES = {
  admin_sistemas: 'Encargado de Sistemas',
  director: 'Director del Instituto',
};

const PESTANAS = [
  { id: 'estado', etiqueta: 'Estado', icono: 'monitor_heart' },
  { id: 'bitacora', etiqueta: 'Bitácora', icono: 'history' },
  { id: 'personal', etiqueta: 'Personal', icono: 'groups' },
  { id: 'cuentas', etiqueta: 'Cuentas', icono: 'manage_accounts' },
];

const ORIGENES = {
  web: { etiqueta: 'Web', clase: 'bg-secondary/10 text-secondary' },
  interno: { etiqueta: 'Interno', clase: 'bg-mint-soft text-mint' },
  sistema: { etiqueta: 'Sistema', clase: 'bg-amber-soft text-amber' },
};

function fechaHora(valor) {
  if (!valor) return '—';
  const f = new Date(valor);
  if (Number.isNaN(f.getTime())) return '—';
  return f.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
}

function fechaCorta(valor) {
  if (!valor) return '—';
  const f = new Date(valor);
  if (Number.isNaN(f.getTime())) return '—';
  return f.toLocaleDateString('es-VE', { dateStyle: 'medium' });
}

function hace(segundos) {
  if (segundos == null) return 'sin registro';
  if (segundos < 90) return 'hace segundos';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

function Aviso({ tono = 'error', children, onReintentar }) {
  const clases =
    tono === 'ok'
      ? 'border-health/30 bg-mint-soft text-mint'
      : 'border-error/25 bg-error-container text-error';
  return (
    <p
      role={tono === 'ok' ? 'status' : 'alert'}
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${clases}`}
    >
      <span className="flex items-center gap-2">
        <Icon name={tono === 'ok' ? 'check_circle' : 'error'} className="text-base" />
        {children}
      </span>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="rounded-lg border border-error/30 px-2 py-1 font-semibold"
        >
          Reintentar
        </button>
      )}
    </p>
  );
}

function Tarjeta({ icono, etiqueta, valor, detalle, acento = 'text-secondary' }) {
  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          {etiqueta}
        </p>
        <Icon name={icono} className={`text-lg ${acento}`} />
      </div>
      <p className="mt-2 font-display text-2xl font-semibold leading-none text-primary">{valor}</p>
      <p className="mt-1.5 text-[11px] text-on-surface-variant">{detalle}</p>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Estado del sistema
   ═════════════════════════════════════════════════════════════════ */

function SeccionEstado() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setDatos(await API.estadoSoporte());
    } catch (err) {
      setError(err.message || 'No se pudo consultar el estado.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando && !datos) {
    return <p className="py-10 text-center text-xs text-on-surface-variant">Consultando estado…</p>;
  }
  if (error && !datos) {
    return <Aviso onReintentar={cargar}>{error}</Aviso>;
  }

  const web = datos?.web || {};
  const sincro = datos?.sincronizacion || {};
  const instalaciones = datos?.instalaciones || [];
  const sinSincronizar = sincro.personal === null || sincro.personal === undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-primary">Estado del sistema</h2>
          <p className="text-[11px] text-on-surface-variant">
            Última consulta: {fechaHora(datos?.web?.hora)} · Zona horaria America/Caracas
          </p>
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant transition hover:border-secondary hover:text-secondary disabled:opacity-50"
        >
          <Icon name="refresh" className={`text-base ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && <Aviso onReintentar={cargar}>{error}</Aviso>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta
          icono={web.ok ? 'cloud_done' : 'cloud_off'}
          etiqueta="Web y base de datos"
          valor={web.ok ? 'En línea' : 'Sin conexión'}
          detalle={`${web.latencia_ms ?? '—'} ms de respuesta · ${web.entorno || '—'}`}
          acento={web.ok ? 'text-health' : 'text-error'}
        />
        <Tarjeta icono="verified" etiqueta="Versión" valor={web.version || '—'} detalle="Backend del portal público" />
        <Tarjeta
          icono="badge"
          etiqueta="Nómina sincronizada"
          valor={sincro.personal ?? '—'}
          detalle={sinSincronizar ? 'Sin datos: falta ejecutar el agente' : 'Fichas del sistema interno'}
        />
        <Tarjeta
          icono="history"
          etiqueta="Logs disponibles"
          valor={(sincro.bitacora ?? 0) + (sincro.logs ?? 0)}
          detalle={`${sincro.portada ?? 0} acciones de la web`}
          acento="text-health-dark"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-white shadow-sm">
        <header className="border-b border-outline-variant/50 px-4 py-3">
          <h3 className="font-display text-base font-semibold text-primary">Instalaciones internas</h3>
          <p className="text-[11px] text-on-surface-variant">
            Cada instalación avisa cada pocos minutos. Sin señal tras 15 minutos.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <caption className="sr-only">Estado de las instalaciones internas</caption>
            <thead>
              <tr className="bg-surface-container-low text-[10px] uppercase tracking-wider text-on-surface-variant">
                <th scope="col" className="px-4 py-2.5 font-semibold">Instalación</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Último aviso</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Base local</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Versión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {instalaciones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-on-surface-variant">
                    Sin instalaciones registradas. Aplique la migración 0026 y ejecute
                    <code className="mx-1 rounded bg-surface-container px-1">scripts/sincronizar_interno.py</code>
                    en el servidor interno.
                  </td>
                </tr>
              ) : (
                instalaciones.map((i) => (
                  <tr key={i.id}>
                    <th scope="row" className="px-4 py-2.5 font-normal">
                      <span className="block text-xs font-semibold text-on-surface">{i.nombre}</span>
                      <span className="block font-mono text-[10px] text-on-surface-variant">{i.id}</span>
                    </th>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          i.estado === 'en_linea' ? 'bg-mint-soft text-mint' : 'bg-blood-soft text-blood'
                        }`}
                      >
                        <Icon name={i.estado === 'en_linea' ? 'check' : 'block'} className="text-xs" />
                        {i.estado === 'en_linea' ? 'En línea' : 'Sin señal'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-on-surface-variant">
                      {hace(i.segundos_desde_ping)}
                      <span className="block text-[10px]">{fechaHora(i.ultimo_ping)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <span className={i.db_ok ? 'text-mint' : 'text-error'}>
                        {i.db_ok ? 'Responde' : 'Sin respuesta'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-on-surface-variant">{i.version || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-on-surface-variant">
        La web y la base se miden en vivo. Lo interno llega por el agente de sincronización:
        nómina, cuentas y logs, nunca datos clínicos.
      </p>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Bitácora
   ═════════════════════════════════════════════════════════════════ */

function SeccionBitacora() {
  const [origen, setOrigen] = useState('todo');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setDatos(await API.logsSoporte({ origen, texto: busqueda }));
    } catch (err) {
      setError(err.message || 'No se pudo consultar la bitácora.');
    } finally {
      setCargando(false);
    }
  }, [origen, busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function filtrar(evento) {
    evento.preventDefault();
    setBusqueda(texto.trim());
  }

  const registros = datos?.registros || [];
  const disponible = datos?.disponible || {};

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-primary">Bitácora</h2>
        <p className="text-[11px] text-on-surface-variant">
          Acciones de la web, del sistema interno y logs del sistema. {datos?.total_filtrado ?? 0} coincidencias.
        </p>
      </div>

      <form onSubmit={filtrar} className="flex flex-wrap items-end gap-2 rounded-2xl border border-outline-variant/60 bg-white p-3 shadow-sm">
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="bitacora-texto" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Buscar
          </label>
          <input
            id="bitacora-texto"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="usuario, acción, entidad…"
            className="w-full rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25"
          />
        </div>
        <div>
          <label htmlFor="bitacora-origen" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Origen
          </label>
          <select
            id="bitacora-origen"
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            className="rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25"
          >
            <option value="todo">Todo</option>
            <option value="web">Web</option>
            <option value="interno">Interno</option>
            <option value="sistema">Sistema</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-white transition hover:bg-secondary-dark"
        >
          Filtrar
        </button>
      </form>

      {error && <Aviso onReintentar={cargar}>{error}</Aviso>}
      {disponible.interno === false && (
        <p className="rounded-xl border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-[11px] text-on-surface-variant">
          El espejo del sistema interno aún no existe: aplique la migración 0026 y ejecute el agente en CITAB.
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <caption className="sr-only">Registros de bitácora</caption>
            <thead>
              <tr className="bg-surface-container-low text-[10px] uppercase tracking-wider text-on-surface-variant">
                <th scope="col" className="px-4 py-2.5 font-semibold">Fecha</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Origen</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Usuario</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Acción</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Entidad</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {cargando && !registros.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-on-surface-variant">Cargando…</td>
                </tr>
              ) : registros.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-on-surface-variant">
                    Sin registros para este filtro.
                  </td>
                </tr>
              ) : (
                registros.map((r) => {
                  const tono = ORIGENES[r.origen] || ORIGENES.web;
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-on-surface-variant">{fechaHora(r.fecha)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${tono.clase}`}>
                          {tono.etiqueta}
                        </span>
                        {r.origen === 'sistema' && r.nivel !== 'INFO' && (
                          <span className={`ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${r.nivel === 'ERROR' ? 'bg-blood-soft text-blood' : 'bg-amber-soft text-amber'}`}>
                            {r.nivel}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="block font-semibold text-on-surface">{r.username || '—'}</span>
                        {r.rol && <span className="block text-[10px] text-on-surface-variant">{r.rol}</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-on-surface">{r.mensaje || r.accion}</td>
                      <td className="px-3 py-2.5 text-[11px] text-on-surface-variant">{r.entidad || '—'}</td>
                      <td className="max-w-[22rem] px-4 py-2.5 text-[11px] text-on-surface-variant">
                        <span className="line-clamp-2" title={r.detalle || ''}>{r.detalle || '—'}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Personal (nómina y usuarios internos, solo lectura)
   ═════════════════════════════════════════════════════════════════ */

function SeccionPersonal() {
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [nomina, setNomina] = useState(null);
  const [usuarios, setUsuarios] = useState(null);
  const [centros, setCentros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [n, u] = await Promise.all([
        API.nominaInterna(busqueda),
        API.usuariosInternos(busqueda),
      ]);
      setNomina(n);
      setUsuarios(u);
    } catch (err) {
      setError(err.message || 'No se pudo consultar el personal.');
    } finally {
      setCargando(false);
    }
  }, [busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    API.getCentros()
      .then((c) => setCentros(Array.isArray(c) ? c : []))
      .catch(() => setCentros([]));
  }, []);

  function buscar(evento) {
    evento.preventDefault();
    setBusqueda(texto.trim());
  }

  const nombreCentro = (id) => {
    const centro = centros.find((c) => Number(c.id) === Number(id));
    return centro ? centro.nombre : id ? `Centro ${id}` : '—';
  };

  const personal = nomina?.personal || [];
  const cuentas = usuarios?.usuarios || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-primary">Personal del sistema interno</h2>
        <p className="text-[11px] text-on-surface-variant">
          Solo lectura. Se actualiza con el agente de sincronización.
          {nomina?.actualizado_en ? ` Última sincronización: ${fechaHora(nomina.actualizado_en)}.` : ''}
        </p>
      </div>

      <form onSubmit={buscar} className="flex flex-wrap items-end gap-2 rounded-2xl border border-outline-variant/60 bg-white p-3 shadow-sm">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="personal-texto" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Buscar
          </label>
          <input
            id="personal-texto"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="cédula, nombre, cargo…"
            className="w-full rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25"
          />
        </div>
        <button type="submit" className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-white transition hover:bg-secondary-dark">
          Filtrar
        </button>
      </form>

      {error && <Aviso onReintentar={cargar}>{error}</Aviso>}
      {nomina && nomina.disponible === false && (
        <p className="rounded-xl border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-[11px] text-on-surface-variant">
          Sin datos sincronizados. Aplique la migración 0026 y ejecute el agente en CITAB.
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-white shadow-sm">
        <header className="flex items-end justify-between gap-2 border-b border-outline-variant/50 px-4 py-3">
          <div>
            <h3 className="font-display text-base font-semibold text-primary">Nómina</h3>
            <p className="text-[11px] text-on-surface-variant">Fichas del personal registradas en el sistema interno.</p>
          </div>
          <p className="text-[11px] text-on-surface-variant">{personal.length} fichas</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">Nómina del sistema interno</caption>
            <thead>
              <tr className="bg-surface-container-low text-[10px] uppercase tracking-wider text-on-surface-variant">
                <th scope="col" className="px-4 py-2.5 font-semibold">Cédula</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Nombre</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Cargo</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Especialidad</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Centro</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {cargando && !personal.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-on-surface-variant">Cargando…</td>
                </tr>
              ) : personal.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-on-surface-variant">Sin fichas para este filtro.</td>
                </tr>
              ) : (
                personal.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] font-normal text-on-surface">
                      {p.cedula || '—'}
                    </th>
                    <td className="px-3 py-2.5 text-xs text-on-surface">
                      {[p.nombre, p.apellido].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-on-surface-variant">{p.cargo || '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-on-surface-variant">{p.especialidad || '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-on-surface-variant">{nombreCentro(p.clinica_id)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${String(p.estado).toUpperCase() === 'ACTIVO' ? 'bg-mint-soft text-mint' : 'bg-surface-container text-on-surface-variant'}`}>
                        {p.estado || '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-white shadow-sm">
        <header className="flex items-end justify-between gap-2 border-b border-outline-variant/50 px-4 py-3">
          <div>
            <h3 className="font-display text-base font-semibold text-primary">Cuentas del sistema interno</h3>
            <p className="text-[11px] text-on-surface-variant">
              Directorio sin contraseñas. Se administran desde el sistema interno.
            </p>
          </div>
          <p className="text-[11px] text-on-surface-variant">{cuentas.length} cuentas</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <caption className="sr-only">Cuentas del sistema interno</caption>
            <thead>
              <tr className="bg-surface-container-low text-[10px] uppercase tracking-wider text-on-surface-variant">
                <th scope="col" className="px-4 py-2.5 font-semibold">Usuario</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Nombre</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Rol</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Centro</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {cuentas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-on-surface-variant">Sin cuentas sincronizadas.</td>
                </tr>
              ) : (
                cuentas.map((u) => (
                  <tr key={u.username}>
                    <th scope="row" className="px-4 py-2.5 font-mono text-[11px] font-normal text-on-surface">{u.username}</th>
                    <td className="px-3 py-2.5 text-xs text-on-surface">{u.nombre}</td>
                    <td className="px-3 py-2.5 text-[11px] text-on-surface-variant">{u.rol}</td>
                    <td className="px-3 py-2.5 text-[11px] text-on-surface-variant">{nombreCentro(u.clinica_id)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.activo ? 'bg-mint-soft text-mint' : 'bg-blood-soft text-blood'}`}>
                        {u.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Cuentas globales (admin_sistemas / director)
   ═════════════════════════════════════════════════════════════════ */

function FormularioAlta({ onCreada }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('admin_sistemas');
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);

  async function crear(evento) {
    evento.preventDefault();
    setError('');
    setCreando(true);
    try {
      await API.crearUsuario({ username: username.trim(), password, rol });
      setUsername('');
      setPassword('');
      onCreada();
    } catch (err) {
      setError(err.message || 'No se pudo crear la cuenta.');
    } finally {
      setCreando(false);
    }
  }

  return (
    <form onSubmit={crear} className="rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-sm">
      <h3 className="font-display text-base font-semibold text-primary">Nueva cuenta institucional</h3>
      <p className="mb-3 text-[11px] text-on-surface-variant">
        Elija el rol: soporte técnico o dirección del instituto.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label htmlFor="alta-usuario" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Usuario
          </label>
          <input
            id="alta-usuario"
            type="text"
            required
            minLength={3}
            maxLength={40}
            pattern="[A-Za-z0-9._\-]+"
            autoCapitalize="none"
            spellCheck="false"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25"
          />
        </div>
        <div>
          <label htmlFor="alta-clave" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Contraseña inicial
          </label>
          <input
            id="alta-clave"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25"
          />
        </div>
        <div>
          <label htmlFor="alta-rol" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Rol
          </label>
          <select
            id="alta-rol"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="w-full rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25"
          >
            {Object.entries(ROLES).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creando}
          className="self-end rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-white transition hover:bg-secondary-dark disabled:opacity-60"
        >
          {creando ? 'Creando…' : 'Crear'}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-error"><Icon name="error" className="text-base" />{error}</p>}
    </form>
  );
}

function DialogoClave({ cuenta, onCerrar, onGuardada }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento) {
    evento.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await API.actualizarUsuario(cuenta.id, { password });
      onGuardada();
    } catch (err) {
      setError(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="clave-titulo">
      <form onSubmit={guardar} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="clave-titulo" className="font-display text-base font-semibold text-primary">
          Nueva contraseña para {cuenta.username}
        </h2>
        <p className="mb-4 text-[11px] text-on-surface-variant">La contraseña anterior dejará de funcionar de inmediato.</p>
        <label htmlFor="clave-nueva" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Contraseña (8 caracteres o más)
        </label>
        <input
          id="clave-nueva"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25"
        />
        {error && <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-error"><Icon name="error" className="text-base" />{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant transition hover:bg-surface-container">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-white transition hover:bg-secondary-dark disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SeccionCuentas({ usuario }) {
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [editandoClave, setEditandoClave] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setCuentas(await API.listarUsuarios());
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las cuentas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(''), 4000);
    return () => clearTimeout(id);
  }, [aviso]);

  async function cambiarEstado(cuenta) {
    const accion = cuenta.activo ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Confirma ${accion} la cuenta "${cuenta.username}"?`)) return;
    try {
      await API.actualizarUsuario(cuenta.id, { activo: !cuenta.activo });
      setAviso(`Cuenta ${cuenta.activo ? 'desactivada' : 'activada'}: ${cuenta.username}.`);
      cargar();
    } catch (err) {
      setError(err.message || `No se pudo ${accion} la cuenta.`);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-primary">Cuentas institucionales</h2>
        <p className="text-[11px] text-on-surface-variant">
          Acceso al panel institucional. Puede restablecer contraseñas y activar o desactivar
          cualquier cuenta, salvo la suya.
        </p>
      </div>

      {aviso && <Aviso tono="ok">{aviso}</Aviso>}
      {error && <Aviso onReintentar={cargar}>{error}</Aviso>}

      <FormularioAlta
        onCreada={() => {
          setAviso('Cuenta creada.');
          cargar();
        }}
      />

      <section className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-white shadow-sm">
        <header className="flex items-end justify-between gap-2 border-b border-outline-variant/50 px-4 py-3">
          <h3 className="font-display text-base font-semibold text-primary">Cuentas globales</h3>
          <p className="text-[11px] text-on-surface-variant">
            {cuentas.filter((c) => c.activo).length} activas de {cuentas.length}
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <caption className="sr-only">Cuentas globales del portal</caption>
            <thead>
              <tr className="bg-surface-container-low text-[10px] uppercase tracking-wider text-on-surface-variant">
                <th scope="col" className="px-4 py-2.5 font-semibold">Usuario</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Rol</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Creada</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {cargando && !cuentas.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-on-surface-variant">Cargando cuentas…</td>
                </tr>
              ) : cuentas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-on-surface-variant">No hay cuentas globales registradas.</td>
                </tr>
              ) : (
                cuentas.map((cuenta) => {
                  const propia = cuenta.username === usuario.username;
                  return (
                    <tr key={cuenta.id} className={cuenta.activo ? '' : 'opacity-60'}>
                      <th scope="row" className="px-4 py-2.5 font-normal">
                        <span className="block text-xs font-semibold text-on-surface">
                          {cuenta.username}
                          {propia && (
                            <span className="ml-1.5 rounded-full bg-secondary/10 px-1.5 py-0.5 text-[10px] font-medium text-secondary">usted</span>
                          )}
                        </span>
                        <span className="block text-[11px] text-on-surface-variant">{cuenta.nombre}</span>
                      </th>
                      <td className="px-3 py-2.5 text-xs text-on-surface-variant">{ROLES[cuenta.rol] || cuenta.rol}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cuenta.activo ? 'bg-mint-soft text-mint' : 'bg-blood-soft text-blood'}`}>
                          <Icon name={cuenta.activo ? 'check' : 'block'} className="text-xs" />
                          {cuenta.activo ? 'Activa' : 'Desactivada'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-on-surface-variant">{fechaCorta(cuenta.created_at)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditandoClave(cuenta)}
                            className="rounded-lg border border-outline-variant px-2 py-1 text-[11px] font-semibold text-on-surface-variant transition hover:border-secondary hover:text-secondary"
                          >
                            Contraseña
                          </button>
                          {!propia && (
                            <button
                              type="button"
                              onClick={() => cambiarEstado(cuenta)}
                              className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                                cuenta.activo ? 'border-error/30 text-error hover:bg-error/5' : 'border-health/30 text-mint hover:bg-mint-soft'
                              }`}
                            >
                              {cuenta.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-on-surface-variant">
        Las cuentas no se eliminan: se desactivan y el cambio queda en la bitácora.
        No es posible desactivar la última cuenta activa de un rol.
      </p>

      {editandoClave && (
        <DialogoClave
          cuenta={editandoClave}
          onCerrar={() => setEditandoClave(null)}
          onGuardada={() => {
            setEditandoClave(null);
            setAviso('Contraseña actualizada.');
          }}
        />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Panel de soporte
   ═════════════════════════════════════════════════════════════════ */

export function PanelSoporte({ sesion, onSalir }) {
  const { usuario } = sesion;
  const [pestana, setPestana] = useState('estado');

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-outline-variant/60 bg-primary text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <Icon name="support_agent" className="text-xl text-health-light" />
            </span>
            <div>
              <h1 className="font-display text-lg font-semibold">Soporte técnico</h1>
              <p className="text-[11px] text-white/60">
                {usuario.nombre || usuario.username} · {ROLES[usuario.rol]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSalir}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
          >
            <Icon name="logout" className="text-base" />
            Salir
          </button>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav role="tablist" aria-label="Secciones de soporte" className="flex gap-1 overflow-x-auto">
            {PESTANAS.map((p) => {
              const activa = pestana === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setPestana(p.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-t-xl px-3 py-2 text-xs font-semibold transition ${
                    activa ? 'bg-surface text-primary' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon name={p.icono} className="text-base" />
                  {p.etiqueta}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {pestana === 'estado' && <SeccionEstado />}
        {pestana === 'bitacora' && <SeccionBitacora />}
        {pestana === 'personal' && <SeccionPersonal />}
        {pestana === 'cuentas' && <SeccionCuentas usuario={usuario} />}
      </main>
    </div>
  );
}


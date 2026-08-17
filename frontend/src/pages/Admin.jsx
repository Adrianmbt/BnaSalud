import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { LedgerCard, SectionLabel, Code, ToneButton, EstadoPunto, StatNum } from '../clinical/ui';
import { API, cerrarSesion } from '../api';

const TONOS_ESTADO = {
  PENDIENTE: 'amber',
  DESPACHADA: 'mint',
  ENTREGADA: 'fx',
  RECIBIDA: 'mint',
  CANCELADA: 'blood',
};

const ETIQUETAS_ESTADO = {
  PENDIENTE: 'Pendiente',
  DESPACHADA: 'Despachada',
  ENTREGADA: 'Entregada',
  RECIBIDA: 'Cerrada',
  CANCELADA: 'Cancelada',
};

function formatoFecha(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return (
    d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  );
}

export default function Admin() {
  const [sesion, setSesion] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginEntrando, setLoginEntrando] = useState(false);

  const [resumen, setResumen] = useState(null);
  const [recetas, setRecetas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [res, traz] = await Promise.all([API.resumenAdmin(), API.trazabilidadRecetas()]);
      setResumen(res);
      setRecetas(traz.recetas || []);
    } catch (e) {
      setError(
        'No se pudieron cargar los datos de trazabilidad. El panel requiere el backend activo ' +
          `(${e.message})`
      );
      setResumen(null);
      setRecetas([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (sesion) cargar();
  }, [sesion, cargar]);

  useEffect(() => {
    try {
      const guardada = localStorage.getItem('bna_sesion_admin');
      if (guardada) setSesion(JSON.parse(guardada));
    } catch {
      /* sin sesión guardada */
    }
  }, []);

  async function iniciarSesion(e) {
    e.preventDefault();
    setLoginEntrando(true);
    setLoginError('');
    try {
      const res = await API.login(loginForm.username, loginForm.password);
      if (res.usuario.rol !== 'superusuario') {
        setLoginError('Este panel es exclusivo para el rol de administración.');
        return;
      }
      try {
        localStorage.setItem('bna_token', res.token);
        localStorage.setItem('bna_sesion_admin', JSON.stringify(res.usuario));
      } catch {
        /* sin almacenamiento */
      }
      setSesion(res.usuario);
    } catch (err) {
      setLoginError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoginEntrando(false);
    }
  }

  function salir() {
    cerrarSesion('staff');
    try {
      localStorage.removeItem('bna_sesion_admin');
    } catch {
      /* sin almacenamiento */
    }
    setSesion(null);
  }

  const filtradas =
    filtroEstado === 'TODOS' ? recetas : recetas.filter((r) => r.estado === filtroEstado);

  /* ================= PANTALLA DE LOGIN ================= */
  if (!sesion) {
    return (
      <div className="min-h-screen bg-paper paper-noise text-ink font-ui">
        <header className="border-b border-ink-line bg-paper/90 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center justify-between px-5 md:px-8 h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-11 h-10 rounded-lg overflow-hidden bg-white shadow-md ring-1 ring-ink-line flex items-center justify-center px-1">
                <img src="/identidad visual/SBna.jpeg" alt="Logo Salud Barcelona" className="h-full w-auto object-contain" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-ink leading-none">Salud Barcelona</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint mt-1">
                  Panel de Administración
                </p>
              </div>
            </Link>
            <Link to="/" className="text-xs font-semibold text-ink-soft hover:text-ink transition-colors">
              Volver al portal
            </Link>
          </div>
        </header>

        <main className="max-w-md mx-auto px-5 pt-16">
          <LedgerCard tick className="p-7">
            <SectionLabel index="ACCESO">Trazabilidad clínica</SectionLabel>
            <p className="text-xs text-ink-faint mt-3 leading-relaxed">
              Consolida citas, consultas, cola, despacho, entrega y confirmación de recetas
              para supervisión administrativa.
            </p>
            <form onSubmit={iniciarSesion} className="mt-6 space-y-4">
              <label className="block">
                <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint mb-1.5">
                  Usuario
                </span>
                <input
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-md bg-paper border border-ink-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-fx/40"
                  placeholder="usuario_admin"
                  autoComplete="username"
                />
              </label>
              <label className="block">
                <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint mb-1.5">
                  Contraseña
                </span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-md bg-paper border border-ink-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-fx/40"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </label>
              {loginError && (
                <p className="text-xs font-semibold text-blood bg-blood-soft rounded-lg px-3 py-2">
                  {loginError}
                </p>
              )}
              <ToneButton type="submit" loading={loginEntrando} className="w-full justify-center">
                <Icon name="admin_panel_settings" className="text-base" />
                Entrar al panel
              </ToneButton>
            </form>
          </LedgerCard>
        </main>
      </div>
    );
  }

  /* ================= PANEL ================= */
  const porEstado = resumen?.recetas_por_estado || {};

  return (
    <div className="min-h-screen bg-paper paper-noise text-ink font-ui">
      <header className="border-b border-ink-line bg-paper/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center justify-between gap-3 px-5 md:px-8 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-fx text-paper flex items-center justify-center font-display font-semibold text-sm shadow-sm shrink-0">
              {sesion.nombre ? sesion.nombre.trim()[0] : 'A'}
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-ink-faint">
                Panel de Administración · Supervisión
              </p>
              <h1 className="font-display text-lg font-semibold text-ink leading-tight truncate">
                {sesion.nombre} · {sesion.rol}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={cargar}
              disabled={cargando}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-ink-soft border border-ink-line hover:bg-paper-2 transition-colors disabled:opacity-60"
            >
              <Icon name="refresh" className={`text-base ${cargando ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              onClick={salir}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-ink-soft border border-ink-line hover:bg-paper-2 transition-colors"
            >
              <Icon name="logout" className="text-base" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-8 space-y-8">
        {error && (
          <p className="text-xs font-semibold text-blood bg-blood-soft rounded-lg px-4 py-3">{error}</p>
        )}

        {/* Indicadores del día */}
        <section>
          <SectionLabel index="I">Operación del día</SectionLabel>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icono: 'event', etiqueta: 'Citas hoy', valor: resumen?.citas_hoy ?? '—', tone: 'fx' },
              { icono: 'stethoscope', etiqueta: 'Consultas hoy', valor: resumen?.consultas_hoy ?? '—', tone: 'doc' },
              { icono: 'groups', etiqueta: 'Pacientes en espera', valor: resumen?.cola_espera ?? '—', tone: 'amber' },
              { icono: 'prescriptions', etiqueta: 'Recetas registradas', valor: recetas.length, tone: 'mint' },
            ].map((c) => (
              <LedgerCard key={c.etiqueta} className="p-4">
                <div className="flex items-center gap-2 text-ink-faint">
                  <Icon name={c.icono} className="text-lg" />
                  <p className="font-mono text-[9px] uppercase tracking-widest">{c.etiqueta}</p>
                </div>
                <p className="mt-2">
                  <StatNum tone={c.tone}>{c.valor}</StatNum>
                </p>
              </LedgerCard>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.keys(ETIQUETAS_ESTADO).map((estado) => (
              <LedgerCard key={estado} className="p-3.5 flex items-center justify-between">
                <EstadoPunto tone={TONOS_ESTADO[estado] || 'ink'}>{ETIQUETAS_ESTADO[estado]}</EstadoPunto>
                <StatNum tone={TONOS_ESTADO[estado] || 'ink'}>{porEstado[estado] || 0}</StatNum>
              </LedgerCard>
            ))}
          </div>

          {resumen?.top_medicamentos?.length > 0 && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <LedgerCard className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint mb-3">
                  Top medicamentos despachados
                </p>
                <ul className="space-y-2">
                  {resumen.top_medicamentos.map(([nombre, cantidad], i) => (
                    <li key={nombre} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <Code className="text-ink-faint">#{i + 1}</Code>
                        <span className="truncate">{nombre}</span>
                      </span>
                      <StatNum tone="fx">{cantidad}</StatNum>
                    </li>
                  ))}
                </ul>
              </LedgerCard>
            </div>
          )}
        </section>

        {/* Trazabilidad */}
        <section>
          <SectionLabel index="II">Trazabilidad de recetas</SectionLabel>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {['TODOS', ...Object.keys(ETIQUETAS_ESTADO)].map((estado) => (
              <button
                key={estado}
                onClick={() => setFiltroEstado(estado)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filtroEstado === estado
                    ? 'bg-fx text-paper border-fx shadow-md'
                    : 'text-ink-soft border-ink-line hover:bg-paper-2'
                }`}
              >
                {estado === 'TODOS' ? 'Todos' : ETIQUETAS_ESTADO[estado]}
              </button>
            ))}
          </div>

          <LedgerCard tick className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[860px]">
                <thead>
                  <tr className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint border-b border-ink-line">
                    <th className="px-4 py-3 font-medium">Receta</th>
                    <th className="px-4 py-3 font-medium">Paciente</th>
                    <th className="px-4 py-3 font-medium">Médico</th>
                    <th className="px-4 py-3 font-medium">Consulta</th>
                    <th className="px-4 py-3 font-medium">Despacho</th>
                    <th className="px-4 py-3 font-medium">Entrega</th>
                    <th className="px-4 py-3 font-medium">Recepción</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-ink-faint text-xs">
                        Sin recetas {filtroEstado !== 'TODOS' ? `en estado ${filtroEstado}` : 'registradas'}.
                      </td>
                    </tr>
                  )}
                  {filtradas.map((r) => (
                    <tr key={r.id} className="border-b border-ink-line/60 hover:bg-paper-2/50 transition-colors">
                      <td className="px-4 py-3">
                        <Code className="text-fx font-bold">{r.codigo_receta}</Code>
                        <p className="font-mono text-[9px] text-ink-faint mt-0.5">{formatoFecha(r.fecha_emision)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{r.paciente_nombre}</p>
                        <Code className="text-ink-faint">{r.paciente_cedula}</Code>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{r.medico || '—'}</td>
                      <td className="px-4 py-3">
                        <Code className="text-ink">{r.consulta_comprobante || '—'}</Code>
                        {r.consulta_fecha && (
                          <p className="font-mono text-[9px] text-ink-faint mt-0.5">{formatoFecha(r.consulta_fecha)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-soft">{r.despachado_por || '—'}</p>
                        <p className="font-mono text-[9px] text-ink-faint">{formatoFecha(r.despachado_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-soft">{r.entregado_por || '—'}</p>
                        <p className="font-mono text-[9px] text-ink-faint">{formatoFecha(r.entregado_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-[9px] text-ink-faint">
                          {r.recibido_at ? (
                            <>
                              <Icon name="verified" className="text-mint align-[-2px]" /> {formatoFecha(r.recibido_at)}
                            </>
                          ) : (
                            '—'
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <EstadoPunto tone={TONOS_ESTADO[r.estado] || 'ink'}>
                          {ETIQUETAS_ESTADO[r.estado] || r.estado}
                        </EstadoPunto>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LedgerCard>
        </section>
      </main>
    </div>
  );
}

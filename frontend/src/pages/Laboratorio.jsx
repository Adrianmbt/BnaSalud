import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon';
import ClinicalShell from '../clinical/ClinicalShell';
import { LedgerCard, SectionLabel, Code, ToneButton, Stamp } from '../clinical/ui';
import { API, cerrarSesion } from '../api';

const CLAVE_SESION_LAB = 'bna_sesion_laboratorio';
const ROLES_LAB = ['medico', 'enfermero', 'superusuario'];

const FILTROS_ESTADO = [
  { id: '', etiqueta: 'Todas' },
  { id: 'solicitada', etiqueta: 'Por procesar' },
  { id: 'con_resultados', etiqueta: 'Con resultados' },
];

const TONOS_ORDEN = {
  solicitada: { etiqueta: 'Por procesar', tone: 'amber' },
  con_resultados: { etiqueta: 'Con resultados', tone: 'mint' },
};

const TIPOS_ESTUDIO = [
  { id: 'laboratorio', etiqueta: 'Laboratorio', icono: 'biotech' },
  { id: 'imagen', etiqueta: 'Imagen', icono: 'radiology' },
  { id: 'funcional', etiqueta: 'Funcional', icono: 'monitor_heart' },
];

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

function nombresEstudios(orden) {
  const lista = Array.isArray(orden?.estudios) ? orden.estudios : [];
  return lista
    .map((e) => (typeof e === 'string' ? e : e?.nombre || ''))
    .filter(Boolean);
}

export default function Laboratorio() {
  const [sesion, setSesion] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginEntrando, setLoginEntrando] = useState(false);

  const [ordenes, setOrdenes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('solicitada');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [seleccionada, setSeleccionada] = useState(null);
  const [bloques, setBloques] = useState([]);
  const [medicoNombre, setMedicoNombre] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const datos = await API.ordenesTodas(filtroEstado);
      setOrdenes(datos || []);
    } catch (e) {
      setError(
        'No se pudieron cargar las órdenes. Verifica que el servidor esté activo y que tu rol ' +
          `tenga acceso (${e.message})`
      );
      setOrdenes([]);
    } finally {
      setCargando(false);
    }
  }, [filtroEstado]);

  useEffect(() => {
    if (sesion) cargar();
  }, [sesion, cargar]);

  useEffect(() => {
    try {
      const guardada = localStorage.getItem(CLAVE_SESION_LAB);
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
      if (!ROLES_LAB.includes(res.usuario.rol)) {
        setLoginError('Este módulo es para médicos, enfermería o administración.');
        return;
      }
      try {
        localStorage.setItem('bna_token', res.token);
        localStorage.setItem(CLAVE_SESION_LAB, JSON.stringify(res.usuario));
      } catch {
        /* sin almacenamiento */
      }
      setMedicoNombre(res.usuario.nombre || '');
      setEspecialidad(res.usuario.especialidad || '');
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
      localStorage.removeItem(CLAVE_SESION_LAB);
    } catch {
      /* sin almacenamiento */
    }
    setSesion(null);
    setSeleccionada(null);
    setBloques([]);
  }

  function elegirOrden(orden) {
    if (orden.estado === 'con_resultados') return;
    setSeleccionada(orden);
    setAviso('');
    setBloques(
      nombresEstudios(orden).map((nombre) => ({
        nombre,
        tipo: 'laboratorio',
        parametros: [],
        descripcion: '',
        conclusion: '',
      }))
    );
  }

  function actualizarBloque(idx, cambios) {
    setBloques((prev) => prev.map((b, i) => (i === idx ? { ...b, ...cambios } : b)));
  }

  function agregarParametro(idx) {
    const bloque = bloques[idx];
    actualizarBloque(idx, {
      parametros: [...bloque.parametros, { parametro: '', valor: '', unidad: '', rango: '' }],
    });
  }

  function actualizarParametro(idx, pIdx, campo, valor) {
    const bloque = bloques[idx];
    actualizarBloque(idx, {
      parametros: bloque.parametros.map((p, i) => (i === pIdx ? { ...p, [campo]: valor } : p)),
    });
  }

  async function guardar() {
    if (!seleccionada) return;
    const estudios = bloques.map((b) =>
      b.tipo === 'laboratorio'
        ? {
            tipo: 'laboratorio',
            nombre: b.nombre,
            parametros: b.parametros.filter((p) => p.parametro.trim() && p.valor.trim()),
          }
        : {
            tipo: b.tipo,
            nombre: b.nombre,
            descripcion: b.descripcion.trim(),
            conclusion: b.conclusion.trim(),
          }
    );
    if (estudios.some((e) => e.tipo === 'laboratorio' && !e.parametros.length)) {
      setError('Cada estudio de laboratorio necesita al menos un parámetro con valor.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await API.registrarResultadosOrden(seleccionada.id, {
        estudios,
        medico_nombre: medicoNombre || undefined,
        especialidad: especialidad || undefined,
      });
      setAviso('Resultados registrados. El paciente recibirá el aviso automáticamente.');
      setSeleccionada(null);
      setBloques([]);
      cargar();
    } catch (e) {
      setError(e.message || 'No se pudieron registrar los resultados.');
    } finally {
      setGuardando(false);
    }
  }

  /* ================= PANTALLA DE LOGIN ================= */
  if (!sesion) {
    return (
      <ClinicalShell module="laboratorio" sinSidebar navbarMinimo>
        <main className="h-full overflow-y-auto ledger-scroll">
          <div className="max-w-md mx-auto px-5 pt-14 pb-20">
            <LedgerCard tick className="p-7">
              <SectionLabel index="ACCESO">Módulo de laboratorio</SectionLabel>
              <p className="text-xs text-ink-faint mt-3 leading-relaxed">
                Consulta las órdenes de estudios emitidas por los médicos y registra sus
                resultados. El paciente recibe un aviso al quedar disponibles.
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
                    placeholder="usuario.lab"
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
                  <Icon name="science" className="text-base" />
                  Entrar al laboratorio
                </ToneButton>
              </form>
            </LedgerCard>
          </div>
        </main>
      </ClinicalShell>
    );
  }

  /* ================= PANEL ================= */
  return (
    <ClinicalShell module="laboratorio" sinSidebar navbarMinimo usuario={sesion} onSalir={salir}>
      <main className="h-full overflow-y-auto ledger-scroll px-5 md:px-8 py-6 md:py-8 pb-20 max-w-[1440px] mx-auto">
        <section>
          <SectionLabel index="I">Órdenes de estudios</SectionLabel>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {FILTROS_ESTADO.map((f) => (
              <button
                key={f.id || 'todas'}
                onClick={() => setFiltroEstado(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filtroEstado === f.id
                    ? 'bg-fx text-paper border-fx shadow-md'
                    : 'text-ink-soft border-ink-line hover:bg-paper-2'
                }`}
              >
                {f.etiqueta}
              </button>
            ))}
            <button
              onClick={cargar}
              disabled={cargando}
              className="sm:ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-ink-soft border border-ink-line hover:bg-paper-2 transition-colors disabled:opacity-60"
            >
              <Icon name="refresh" className={`text-base ${cargando ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {(error || aviso) && (
            <p
              className={`mt-3 text-xs font-semibold rounded-lg px-4 py-3 ${
                error ? 'text-blood bg-blood-soft' : 'text-mint bg-mint-soft'
              }`}
            >
              {error || aviso}
            </p>
          )}

          {/* Libro de órdenes: grilla en escritorio, tarjetas apiladas en móvil */}
          <LedgerCard tick className="mt-4 overflow-hidden">
            <div className="hidden md:grid grid-cols-[150px_minmax(0,1.2fr)_minmax(0,1fr)_100px_150px_130px] gap-x-3 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint border-b border-ink-line">
              <span>Comprobante</span>
              <span>Paciente</span>
              <span>Estudios</span>
              <span>Origen</span>
              <span>Estado</span>
              <span className="text-right">Acción</span>
            </div>

            {ordenes.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Icon name="biotech" filled className="text-mint text-3xl mb-2" />
                <p className="text-sm font-semibold text-ink">Sin órdenes pendientes</p>
                <p className="text-xs text-ink-faint mt-0.5">
                  No hay órdenes {filtroEstado ? 'en este estado' : 'registradas'}.
                </p>
              </div>
            )}

            {ordenes.map((o) => {
              const tono = TONOS_ORDEN[o.estado] || { etiqueta: o.estado, tone: 'ink' };
              const lista = nombresEstudios(o);
              const accion =
                o.estado === 'solicitada' ? (
                  <ToneButton onClick={() => elegirOrden(o)} className="!px-4 !py-2 !text-xs">
                    <Icon name="edit_note" className="text-base" />
                    Registrar
                  </ToneButton>
                ) : (
                  <span className="font-mono text-[9px] text-ink-faint whitespace-nowrap">
                    {formatoFecha(o.resultados_at)}
                  </span>
                );
              return (
                <div
                  key={o.id}
                  className="border-b border-ink-line/60 last:border-b-0 hover:bg-paper-2/50 transition-colors md:grid md:grid-cols-[150px_minmax(0,1.2fr)_minmax(0,1fr)_100px_150px_130px] md:gap-x-3 md:items-center md:px-4 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div>
                    <Code className="text-fx font-bold">{o.comprobante_orden}</Code>
                    <p className="font-mono text-[9px] text-ink-faint mt-0.5">
                      {formatoFecha(o.created_at)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{o.paciente_nombre || '—'}</p>
                    <Code className="text-ink-faint">{o.paciente_cedula || ''}</Code>
                  </div>
                  <p className="text-sm text-ink-soft min-w-0">{lista.join(', ') || '—'}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    {o.origen || '—'}
                  </p>
                  <Stamp tone={tono.tone} soft>
                    {tono.etiqueta}
                  </Stamp>
                  <div className="md:text-right shrink-0">{accion}</div>
                </div>
              );
            })}
          </LedgerCard>
        </section>

        {seleccionada && (
          <section>
            <SectionLabel index="II">
              Resultados · {seleccionada.comprobante_orden}
            </SectionLabel>
            <p className="mt-2 text-xs text-ink-faint">
              Paciente: <strong className="text-ink">{seleccionada.paciente_nombre}</strong>{' '}
              ({seleccionada.paciente_cedula}) · Los avisos por correo son automáticos.
            </p>

            <div className="mt-4 space-y-4">
              {bloques.map((b, idx) => (
                <LedgerCard key={`${idx}-${b.nombre}`} className="p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="font-display font-semibold text-ink">{b.nombre}</p>
                    <div className="flex items-center gap-1.5">
                      {TIPOS_ESTUDIO.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => actualizarBloque(idx, { tipo: t.id })}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                            b.tipo === t.id
                              ? 'bg-doc text-paper border-doc shadow-sm'
                              : 'text-ink-soft border-ink-line hover:bg-paper-2'
                          }`}
                        >
                          <Icon name={t.icono} className="text-sm" />
                          {t.etiqueta}
                        </button>
                      ))}
                    </div>
                  </div>

                  {b.tipo === 'laboratorio' ? (
                    <div className="mt-4 space-y-2">
                      <div className="hidden sm:grid grid-cols-[1.4fr_1fr_0.7fr_1fr] gap-2 font-mono text-[9px] uppercase tracking-widest text-ink-faint px-1">
                        <span>Parámetro</span>
                        <span>Resultado</span>
                        <span>Unidad</span>
                        <span>Rango ref.</span>
                      </div>
                      {b.parametros.map((p, pIdx) => (
                        <div
                          key={pIdx}
                          className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_0.7fr_1fr_auto] gap-2 items-center"
                        >
                          {['parametro', 'valor', 'unidad', 'rango'].map((campo) => (
                            <input
                              key={campo}
                              value={p[campo]}
                              onChange={(e) => actualizarParametro(idx, pIdx, campo, e.target.value)}
                              className="px-2.5 py-2 rounded-md bg-paper border border-ink-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-doc/30"
                              placeholder={
                                {
                                  parametro: 'Parámetro · Hemoglobina',
                                  valor: 'Resultado',
                                  unidad: 'Unidad',
                                  rango: 'Rango ref.',
                                }[campo]
                              }
                              aria-label={campo}
                            />
                          ))}
                          <button
                            onClick={() =>
                              actualizarBloque(idx, {
                                parametros: b.parametros.filter((_, i) => i !== pIdx),
                              })
                            }
                            className="justify-self-end sm:justify-self-auto p-2 rounded-md text-blood hover:bg-blood-soft transition-colors"
                            aria-label="Quitar parámetro"
                          >
                            <Icon name="close" className="text-base" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => agregarParametro(idx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-ink-line text-ink-soft hover:bg-paper-2 transition-colors"
                      >
                        <Icon name="add" className="text-base" />
                        Añadir parámetro
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={b.descripcion}
                        onChange={(e) => actualizarBloque(idx, { descripcion: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-md bg-paper border border-ink-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-doc/30 resize-y"
                        placeholder="Descripción del hallazgo…"
                      />
                      <textarea
                        value={b.conclusion}
                        onChange={(e) => actualizarBloque(idx, { conclusion: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-md bg-paper border border-ink-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-doc/30 resize-y"
                        placeholder="Conclusión…"
                      />
                    </div>
                  )}
                </LedgerCard>
              ))}

              <div className="flex items-center gap-3">
                <ToneButton onClick={guardar} loading={guardando}>
                  <Icon name="task_alt" className="text-base" />
                  Registrar resultados
                </ToneButton>
                <button
                  onClick={() => {
                    setSeleccionada(null);
                    setBloques([]);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold text-ink-soft border border-ink-line hover:bg-paper-2 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </ClinicalShell>
  );
}

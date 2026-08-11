import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Icon from '../components/Icon';
import { API, parseCedula } from '../api';
import { DEMO, CENTROS_DEMO } from '../clinical/demo';
import { getCentroTheme } from '../centroTheme';
import CitaModal from '../components/CitaModal';

const SECCIONES = [
  { id: 'dashboard', etiqueta: 'Dashboard', detalle: 'Resumen de salud', icono: 'grid_view' },
  { id: 'citas', etiqueta: 'Citas', detalle: 'Agenda y confirmación', icono: 'calendar_month' },
  { id: 'estudios', etiqueta: 'Estudios', detalle: 'Órdenes y resultados', icono: 'monitor_heart' },
  { id: 'misalud', etiqueta: 'Mi Salud', detalle: 'Perfil y datos clínicos', icono: 'favorite' },
];

const TIPOS_SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#fbfbfd',
    borderRadius: 2,
    fontSize: '0.9rem',
    '& fieldset': { borderColor: 'var(--color-outline-variant)' },
    '&:hover fieldset': { borderColor: 'var(--color-secondary)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--color-secondary)', borderWidth: 2 },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: 'var(--color-secondary)' },
};

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function formatoFecha(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso || '';
  }
}

function formatoFechaLarga(iso) {
  try {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    return d.toLocaleDateString('es-VE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso || '';
  }
}

function horaCorta(h) {
  if (!h) return '';
  const [hh, mm] = String(h).slice(0, 5).split(':');
  return `${hh}:${mm}`;
}

function calcularEdad(fechaNac) {
  if (!fechaNac) return '';
  const nac = new Date(fechaNac);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad -= 1;
  return `${edad} años`;
}

const ESTADOS_CITA = {
  pendiente: { tono: 'amber', etiqueta: 'Pendiente' },
  confirmada: { tono: 'success', etiqueta: 'Confirmada' },
  en_espera: { tono: 'info', etiqueta: 'En espera' },
  en_consulta: { tono: 'secondary', etiqueta: 'En consulta' },
  completada: { tono: 'success', etiqueta: 'Completada' },
  finalizada: { tono: 'success', etiqueta: 'Finalizada' },
  cancelada: { tono: 'error', etiqueta: 'Cancelada' },
};

const ESTADOS_ORDEN = {
  solicitada: { tono: 'amber', etiqueta: 'Solicitada' },
  con_resultados: { tono: 'success', etiqueta: 'Con resultados' },
  en_proceso: { tono: 'info', etiqueta: 'En proceso' },
};

function EtiquetaEstado({ estado, mapa }) {
  const conf = (mapa || ESTADOS_CITA)[estado] || { tono: 'info', etiqueta: estado || '—' };
  const colorMap = {
    amber: 'var(--color-amber)',
    success: 'var(--color-success)',
    info: 'var(--color-secondary)',
    secondary: 'var(--color-secondary)',
    error: 'var(--color-error)',
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold capitalize"
      style={{ color: colorMap[conf.tono], background: `${colorMap[conf.tono]}14` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colorMap[conf.tono] }} />
      {conf.etiqueta}
    </span>
  );
}

export default function Paciente() {
  const [cedulaEntrada, setCedulaEntrada] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [errorEntrada, setErrorEntrada] = useState('');
  const [paciente, setPaciente] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [citas, setCitas] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(false);

  const [seccion, setSeccion] = useState('dashboard');
  const [navAbierta, setNavAbierta] = useState(false);
  const [citaModal, setCitaModal] = useState(null);
  const [aviso, setAviso] = useState('');
  const [recetaAbierta, setRecetaAbierta] = useState(null);

  const [perfilForm, setPerfilForm] = useState(null);
  const [perfilGuardando, setPerfilGuardando] = useState(false);
  const [perfilError, setPerfilError] = useState('');
  const [perfilAbierto, setPerfilAbierto] = useState(false);

  const temaCentro = useMemo(() => getCentroTheme({ codigo: 'CLN-CITAB', nombre: '' }), []);

  const varsCentro = useMemo(
    () => ({
      '--color-primary': temaCentro.primary,
      '--color-primary-light': temaCentro.primaryLight,
      '--color-primary-dark': temaCentro.primaryDark,
      '--color-secondary': temaCentro.accent,
      '--color-secondary-light': temaCentro.accentLight,
      '--color-secondary-dark': temaCentro.accentDark,
      '--color-secondary-container': temaCentro.soft,
      '--color-on-secondary': '#ffffff',
      '--color-on-secondary-container': temaCentro.primary,
      '--color-surface': temaCentro.surface,
      '--color-surface-container': temaCentro.container,
      '--color-surface-container-low': temaCentro.containerLow,
      '--color-surface-container-high': temaCentro.containerHigh,
      '--color-surface-container-highest': temaCentro.containerHigh,
      '--color-on-surface-variant': temaCentro.onSurfaceVariant,
      '--color-outline': temaCentro.outline,
      '--color-outline-variant': temaCentro.outlineVariant,
      '--color-doc': temaCentro.accent,
      '--color-doc-deep': temaCentro.accentDark,
      '--color-doc-soft': temaCentro.soft,
    }),
    [temaCentro]
  );

  const entrar = useCallback(async (cedula) => {
    setEntrando(true);
    setErrorEntrada('');
    try {
      let datos;
      try {
        datos = await API.buscarPaciente(cedula);
      } catch {
        datos = await DEMO.buscarPaciente(cedula);
      }
      setPaciente(datos);
      setSeccion('dashboard');
      setNavAbierta(false);
    } catch (err) {
      setErrorEntrada(err.message || 'No se encontró el paciente. Verifique la cédula.');
    } finally {
      setEntrando(false);
    }
  }, []);

  const cargarTodo = useCallback(async () => {
    if (!paciente) return;
    setCargando(true);
    const cedula = String(paciente.cedula || '').replace(/\D/g, '');
    const promesas = [
      API.historialPaciente(cedula).catch(async () => DEMO.historialPaciente(cedula)),
      API.citasPaciente(cedula).catch(async () => DEMO.citasPaciente(cedula)),
      API.ordenesPaciente(paciente.id).catch(async () => DEMO.ordenesPaciente(paciente.id || cedula)),
    ];
    try {
      const [h, c, o] = await Promise.all(promesas);
      setHistorial(h && h.historial ? h : null);
      setCitas(Array.isArray(c) ? c : []);
      setOrdenes(Array.isArray(o) ? o : []);
    } catch {
      setHistorial(null);
      setCitas([]);
      setOrdenes([]);
    } finally {
      setCargando(false);
    }
  }, [paciente]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const proximaCita = useMemo(() => {
    const hoy = new Date();
    return (
      citas
        .filter((c) => c.estado !== 'cancelada' && new Date(`${String(c.fecha_cita).slice(0, 10)}T00:00:00`) >= hoy)
        .sort((a, b) => new Date(a.fecha_cita) - new Date(b.fecha_cita))[0] || null
    );
  }, [citas]);

  const ultimaConsulta = useMemo(
    () => (historial && historial.historial && historial.historial.length > 0 ? historial.historial[0] : null),
    [historial]
  );

  const abrirPerfil = () => {
    setPerfilForm({
      nombre_completo: paciente.nombre_completo || '',
      fecha_nacimiento: (paciente.fecha_nacimiento || '').slice(0, 10),
      telefono: paciente.telefono || '',
      email: paciente.email || '',
      tipo_sangre: paciente.tipo_sangre || '',
      alergias: Array.isArray(paciente.alergias) ? paciente.alergias.join(', ') : '',
      antecedentes: Array.isArray(paciente.antecedentes_medicos) ? paciente.antecedentes_medicos.join(', ') : '',
    });
    setPerfilError('');
    setPerfilAbierto(true);
  };

  function guardarPerfil(e) {
    e.preventDefault();
    if (!perfilForm) return;
    setPerfilGuardando(true);
    setPerfilError('');
    const cedula = String(paciente.cedula || '').replace(/\D/g, '');
    const payload = {
      nombre_completo: perfilForm.nombre_completo.trim(),
      telefono: perfilForm.telefono.trim(),
      email: perfilForm.email.trim(),
      tipo_sangre: perfilForm.tipo_sangre,
      alergias: perfilForm.alergias
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      antecedentes_medicos: perfilForm.antecedentes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (perfilForm.fecha_nacimiento) payload.fecha_nacimiento = perfilForm.fecha_nacimiento;

    const hacer = async () => {
      try {
        return await API.actualizarPaciente(cedula, payload);
      } catch {
        return await DEMO.actualizarPaciente(cedula, payload);
      }
    };

    hacer()
      .then((actualizado) => {
        setPaciente(actualizado);
        setPerfilAbierto(false);
        setAviso('Datos de salud actualizados correctamente.');
      })
      .catch((err) => setPerfilError(err.message || 'No se pudo actualizar el perfil.'))
      .finally(() => setPerfilGuardando(false));
  }

  const centroCITAB = CENTROS_DEMO.find((c) => c.id === 2) || CENTROS_DEMO[0];

  const contenidoNav = (
    <>
      <div className="relative overflow-hidden px-5 py-4 text-white shrink-0" style={{ background: temaCentro.gradient }}>
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, rgba(255,255,255,0.35) 0 10px, transparent 10px 26px)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <img src={centroCITAB.logo} alt="" className="w-9 h-9 rounded-xl bg-white/90 object-contain p-1 shadow" />
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold leading-tight truncate">Portal del Paciente</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/75 truncate">
              {temaCentro.lema}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 pb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mb-3 px-1">
          Navegación
        </p>
        <ul className="space-y-1.5">
          {SECCIONES.map((s) => {
            const activado = seccion === s.id;
            return (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setSeccion(s.id);
                    setNavAbierta(false);
                  }}
                  aria-current={activado ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    activado
                      ? 'bg-surface-container-high text-primary shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${activado ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
                    <Icon name={s.icono} filled={activado} className="text-lg" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold leading-tight ${activado ? 'text-primary' : ''}`}>
                      {s.etiqueta}
                    </span>
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-on-surface-variant/70 mt-0.5">
                      {s.detalle}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-5 py-4">
        <button
          onClick={() => {
            setCitaModal(centroCITAB);
            setNavAbierta(false);
          }}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-md active:scale-[0.98] transition-all"
          style={{ background: temaCentro.gradient }}
        >
          <Icon name="add_circle" className="text-lg" /> Nueva Consulta
        </button>
      </div>

      <div className="mt-auto px-5 py-5 space-y-1.5 border-t border-outline-variant">
        <Link
          to="/"
          onClick={() => setNavAbierta(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors text-sm font-medium"
        >
          <Icon name="home" className="text-xl" /> Portal de la Comunidad
        </Link>
        <Link
          to="/"
          onClick={() => setNavAbierta(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors text-sm font-medium"
        >
          <Icon name="logout" className="text-xl" /> Cerrar sesión
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-surface text-primary font-ui" style={varsCentro}>
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant">
        <div className="flex items-center gap-4 px-4 md:px-6 h-16">
          <button
            onClick={() => setNavAbierta((v) => !v)}
            className="p-2 -ml-2 rounded-full text-on-surface-variant hover:bg-surface-container lg:ring-1 lg:ring-outline-variant transition-colors"
            aria-label={navAbierta ? 'Cerrar navegación' : 'Abrir navegación'}
            aria-expanded={navAbierta}
          >
            <Icon name={navAbierta ? 'close' : 'menu'} />
          </button>

          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
              {paciente ? 'Portal del Paciente' : 'Acceso'}
            </p>
            <h1 className="font-display text-xl font-semibold text-primary leading-tight truncate">
              {paciente ? `¡Hola, ${paciente.nombre_completo.split(' ')[0]}!` : 'Portal del Paciente'}
            </h1>
          </div>

          <div className="flex-1" />

          {paciente && (
            <>
              <IconButton aria-label="Notificaciones" sx={{ color: 'var(--color-on-surface-variant)' }}>
                <Badge badgeContent={citas.filter((c) => c.estado === 'pendiente').length} color="error">
                  <Icon name="notifications" className="text-xl" />
                </Badge>
              </IconButton>
              <div className="flex items-center gap-2.5 pl-1">
                <Avatar sx={{ bgcolor: 'var(--color-secondary)', width: 38, height: 38, fontWeight: 700, fontSize: '0.8rem' }}>
                  {iniciales(paciente.nombre_completo)}
                </Avatar>
                <div className="hidden xl:block">
                  <p className="text-sm font-bold text-primary leading-tight">{paciente.nombre_completo}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">
                    {paciente.tipo_cedula || 'V'}-{paciente.cedula}
                  </p>
                </div>
              </div>
              <div className="w-px h-8 bg-outline-variant/70 hidden sm:block" aria-hidden="true" />
              <Link
                to="/"
                className="flex items-center justify-center w-10 h-10 rounded-full text-on-surface-variant hover:text-error hover:bg-error/5 transition-colors"
                aria-label="Cerrar sesión y volver al portal"
                title="Cerrar sesión"
              >
                <Icon name="logout" className="text-xl" />
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        <aside
          className={`shrink-0 w-[min(320px,85vw)] bg-surface border-r border-outline-variant flex flex-col transition-all duration-300 ease-out ${
            navAbierta ? 'ml-0' : '-ml-[min(320px,85vw)]'
          }`}
          aria-label="Navegación del portal"
        >
          {contenidoNav}
        </aside>

        <main className="flex-1 min-w-0 flex flex-col bg-surface overflow-hidden">
          {!paciente ? (
            <div className="flex-1 overflow-y-auto ledger-scroll flex items-center justify-center p-6">
              <div className="w-full max-w-md">
                <div className="bg-surface-container-low border border-outline-variant rounded-3xl p-8 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-secondary-container/20 rounded-full pointer-events-none" />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg mb-5" style={{ background: temaCentro.gradient }}>
                      <Icon name="badge" filled className="text-2xl" />
                    </div>
                    <h2 className="font-display text-2xl font-bold text-primary">Bienvenido</h2>
                    <p className="text-sm text-on-surface-variant mt-1">
                      Ingresa tu cédula de identidad para acceder a tu historial clínico, citas y estudios.
                    </p>

                    {errorEntrada && (
                      <div className="mt-5 p-3 bg-error-container rounded-xl border border-error/20 flex items-center gap-2" role="alert">
                        <Icon name="error" className="text-error text-lg" />
                        <p className="text-xs font-semibold text-error">{errorEntrada}</p>
                      </div>
                    )}

                    <form
                      className="mt-5 space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const ident = parseCedula(cedulaEntrada);
                        if (!ident.cedula) {
                          setErrorEntrada('Ingrese su cédula.');
                          return;
                        }
                        entrar(ident.cedula);
                      }}
                    >
                      <TextField
                        fullWidth
                        label="Cédula de Identidad"
                        placeholder="V-12345678"
                        value={cedulaEntrada}
                        onChange={(e) => setCedulaEntrada(e.target.value)}
                        sx={fieldSx}
                        autoFocus
                      />
                      <Button
                        type="submit"
                        fullWidth
                        disabled={entrando}
                        variant="contained"
                        sx={{
                          background: temaCentro.gradient,
                          borderRadius: 2,
                          py: 1.4,
                          fontWeight: 700,
                          textTransform: 'none',
                        }}
                      >
                        {entrando ? 'Verificando...' : 'Entrar al portal'}
                      </Button>
                    </form>

                    <div className="mt-5 pt-4 border-t border-outline-variant/40">
                      <p className="text-[11px] text-on-surface-variant text-center">
                        ¿No tienes cuenta? <span className="font-semibold text-secondary">Reserva tu cita primero</span> y el sistema te registra.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ====== DASHBOARD ====== */}
              {seccion === 'dashboard' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-6 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div>
                      <h2 className="font-display text-2xl md:text-3xl font-bold text-primary">
                        ¡Hola, {paciente.nombre_completo.split(' ')[0]}!
                      </h2>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mt-1">
                        C.I. {paciente.tipo_cedula || 'V'}-{paciente.cedula} · {calcularEdad(paciente.fecha_nacimiento) || 'Edad no registrada'}
                      </p>
                    </div>
                    <Button
                      onClick={abrirPerfil}
                      variant="outlined"
                      startIcon={<Icon name="edit" className="text-lg" />}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: 'var(--color-outline-variant)',
                        color: 'var(--color-secondary)',
                        '&:hover': { borderColor: 'var(--color-secondary)', bgcolor: 'var(--color-secondary-container)/10' },
                      }}
                    >
                      Editar Perfil
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                    {/* Hero: Próxima cita */}
                    <section className="xl:col-span-2 relative overflow-hidden rounded-3xl text-white p-6 md:p-7 shadow-lg min-h-[220px] flex flex-col justify-between" style={{ background: temaCentro.gradient }}>
                      <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.35) 0 10px, transparent 10px 26px)' }} />
                      <div className="relative flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                            <Icon name="calendar_month" filled className="text-2xl" />
                          </div>
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/75">Próxima Cita</p>
                            <p className="text-lg font-extrabold leading-tight">
                              {proximaCita ? proximaCita.especialidad : 'Sin citas programadas'}
                            </p>
                          </div>
                        </div>
                        {proximaCita && (
                          <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur text-[11px] font-bold uppercase tracking-wider">
                            {proximaCita.estado}
                          </span>
                        )}
                      </div>

                      {proximaCita ? (
                        <div className="relative grid sm:grid-cols-2 gap-4 mt-6">
                          <div className="space-y-1">
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/70">Fecha</p>
                            <p className="text-sm font-bold capitalize">{formatoFechaLarga(proximaCita.fecha_cita)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/70">Hora</p>
                            <p className="text-sm font-bold">{horaCorta(proximaCita.hora_inicio)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/70">Centro</p>
                            <p className="text-sm font-bold leading-snug">{proximaCita.centro_salud}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/70">Confirmación</p>
                            <p className="font-mono text-sm font-bold tracking-wider">{proximaCita.codigo_confirmacion}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="relative mt-6">
                          <p className="text-sm text-white/85">
                            Reserva tu próxima consulta médica y mantenla al día desde tu portal.
                          </p>
                          <button
                            onClick={() => setCitaModal(centroCITAB)}
                            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-primary font-bold text-sm shadow hover:shadow-lg transition-shadow"
                          >
                            <Icon name="event_available" className="text-lg" /> Agendar Cita
                          </button>
                        </div>
                      )}
                    </section>

                    {/* Accesos rápidos */}
                    <section className="space-y-4">
                      <button
                        onClick={() => setCitaModal(centroCITAB)}
                        className="w-full flex items-center gap-4 p-5 bg-surface-container-low border border-outline-variant rounded-3xl text-left hover:border-secondary/50 hover:shadow-md transition-all group"
                      >
                        <span className="w-11 h-11 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                          <Icon name="event_repeat" filled className="text-xl" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-primary">Reagendar Cita</span>
                          <span className="block text-[11px] text-on-surface-variant mt-0.5">Cambia fecha u horario</span>
                        </span>
                        <Icon name="chevron_right" className="ml-auto text-on-surface-variant" />
                      </button>

                      <button
                        onClick={() => setSeccion('misalud')}
                        className="w-full flex items-center gap-4 p-5 bg-surface-container-low border border-outline-variant rounded-3xl text-left hover:border-secondary/50 hover:shadow-md transition-all group"
                      >
                        <span className="w-11 h-11 rounded-xl bg-fx-soft text-fx flex items-center justify-center group-hover:bg-fx group-hover:text-paper transition-colors">
                          <Icon name="favorite" filled className="text-xl" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-primary">Mi Salud</span>
                          <span className="block text-[11px] text-on-surface-variant mt-0.5">
                            Sangre, alergias y antecedentes
                          </span>
                        </span>
                        <Icon name="chevron_right" className="ml-auto text-on-surface-variant" />
                      </button>

                      <button
                        onClick={() => setSeccion('estudios')}
                        className="w-full flex items-center gap-4 p-5 bg-surface-container-low border border-outline-variant rounded-3xl text-left hover:border-secondary/50 hover:shadow-md transition-all group"
                      >
                        <span className="w-11 h-11 rounded-xl bg-doc-soft text-doc flex items-center justify-center group-hover:bg-doc group-hover:text-paper transition-colors">
                          <Icon name="monitor_heart" filled className="text-xl" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-primary">Mis Estudios</span>
                          <span className="block text-[11px] text-on-surface-variant mt-0.5">
                            Órdenes y resultados de laboratorio
                          </span>
                        </span>
                        <Icon name="chevron_right" className="ml-auto text-on-surface-variant" />
                      </button>
                    </section>

                    {/* Historial de consultas */}
                    <section className="xl:col-span-2 bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-display text-lg font-bold text-primary">Historial de Consultas</h3>
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                            {historial ? `${historial.total_consultas} consultas registradas` : 'Historial clínico'}
                          </p>
                        </div>
                        <button
                          onClick={() => setSeccion('citas')}
                          className="flex items-center gap-1 text-xs font-bold text-secondary hover:text-secondary-light transition-colors"
                        >
                          Ver todas <Icon name="arrow_forward" className="text-sm" />
                        </button>
                      </div>

                      {cargando ? (
                        <div className="py-10 text-center text-on-surface-variant text-sm animate-pulse">
                          Cargando historial...
                        </div>
                      ) : !historial || historial.historial.length === 0 ? (
                        <div className="py-10 text-center text-on-surface-variant space-y-2">
                          <Icon name="history" className="text-5xl opacity-40" />
                          <p className="text-sm font-medium">Aún no tienes consultas registradas.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-outline-variant text-left">
                                <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Fecha</th>
                                <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Especialidad</th>
                                <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Diagnóstico (CIE-10)</th>
                                <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Médico</th>
                                <th className="py-2 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historial.historial.slice(0, 5).map((c) => (
                                <tr key={c.consulta_id} className="border-b border-outline-variant/50 hover:bg-surface transition-colors">
                                  <td className="py-3 pr-4 text-on-surface-variant whitespace-nowrap">{formatoFecha(c.fecha)}</td>
                                  <td className="py-3 pr-4 font-semibold text-primary">{c.especialidad}</td>
                                  <td className="py-3 pr-4">
                                    <span className="font-mono text-[11px] font-bold text-secondary">{c.cie10_codigo}</span>
                                    <span className="text-on-surface-variant"> · {c.cie10_descripcion}</span>
                                  </td>
                                  <td className="py-3 pr-4 text-on-surface-variant">{c.medico_nombre}</td>
                                  <td className="py-3 text-right">
                                    <button
                                      onClick={() => setRecetaAbierta(c)}
                                      className="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:text-secondary-light transition-colors"
                                      aria-label={`Ver detalle de consulta ${c.consulta_id}`}
                                    >
                                      <Icon name="visibility" className="text-base" /> Ver
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>

                    {/* Resumen de perfil clínico */}
                    <section className="bg-card border border-ink-line rounded-3xl p-5 md:p-6">
                      <h3 className="font-display text-lg font-bold text-primary mb-4">Ficha de Salud</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-on-surface-variant">Tipo de sangre</span>
                          <span className="px-3 py-1 rounded-lg font-mono font-bold text-xs text-blood" style={{ background: 'var(--color-blood-soft)' }}>
                            {paciente.tipo_sangre || '—'}
                          </span>
                        </div>
                        <Divider sx={{ borderColor: 'var(--color-outline-variant)' }} />
                        <div>
                          <p className="text-xs text-on-surface-variant mb-1.5">Alergias</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.isArray(paciente.alergias) && paciente.alergias.length > 0 ? (
                              paciente.alergias.map((a) => (
                                <Chip key={a} size="small" label={a} sx={{ fontSize: '0.68rem', fontWeight: 700, bgcolor: 'var(--color-error-container)', color: 'var(--color-error)' }} />
                              ))
                            ) : (
                              <span className="text-xs text-on-surface-variant/60 italic">Sin alergias registradas</span>
                            )}
                          </div>
                        </div>
                        <Divider sx={{ borderColor: 'var(--color-outline-variant)' }} />
                        <div>
                          <p className="text-xs text-on-surface-variant mb-1.5">Antecedentes</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.isArray(paciente.antecedentes_medicos) && paciente.antecedentes_medicos.length > 0 ? (
                              paciente.antecedentes_medicos.map((a) => (
                                <Chip key={a} size="small" label={a} sx={{ fontSize: '0.68rem', fontWeight: 700, bgcolor: 'var(--color-amber-soft)', color: 'var(--color-amber)' }} />
                              ))
                            ) : (
                              <span className="text-xs text-on-surface-variant/60 italic">Sin antecedentes registrados</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={abrirPerfil}
                          className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-secondary border border-secondary/40 hover:bg-secondary/5 transition-colors"
                        >
                          <Icon name="edit" className="text-base" /> Editar ficha
                        </button>
                      </div>
                    </section>

                    {/* Última consulta detalle */}
                    {ultimaConsulta && (
                      <section className="xl:col-span-2 bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-display text-lg font-bold text-primary">Detalles de Última Consulta</h3>
                            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                              {formatoFechaLarga(ultimaConsulta.fecha)} · {ultimaConsulta.especialidad}
                            </p>
                          </div>
                          {ultimaConsulta.comprobante_ref && (
                            <span className="font-mono text-[11px] font-bold text-on-surface-variant px-3 py-1.5 rounded-lg bg-surface-container-high">
                              Ref. {ultimaConsulta.comprobante_ref}
                            </span>
                          )}
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">Motivo de consulta</p>
                            <p className="text-sm text-primary">{ultimaConsulta.motivo_consulta || '—'}</p>
                          </div>
                          <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">Diagnóstico</p>
                            <p className="text-sm text-primary">
                              <span className="font-mono font-bold text-secondary">{ultimaConsulta.cie10_codigo}</span> · {ultimaConsulta.cie10_descripcion}
                            </p>
                          </div>
                          {ultimaConsulta.tratamiento && (
                            <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
                              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">Tratamiento</p>
                              <p className="text-sm text-primary">{ultimaConsulta.tratamiento}</p>
                            </div>
                          )}
                          {ultimaConsulta.recomendaciones && (
                            <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
                              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">Indicaciones Médicas</p>
                              <p className="text-sm text-primary">{ultimaConsulta.recomendaciones}</p>
                            </div>
                          )}
                        </div>

                        {ultimaConsulta.recetas && ultimaConsulta.recetas.length > 0 && (
                          <div className="mt-4 bg-surface rounded-2xl border border-outline-variant/40 p-4">
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">Recetas Emitidas</p>
                            <div className="space-y-2">
                              {ultimaConsulta.recetas.map((r, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                  <Icon name="medication" className="text-base text-fx mt-0.5" />
                                  <div>
                                    <p className="text-sm font-semibold text-primary">{r.nombre}</p>
                                    {r.posologia && <p className="text-xs text-on-surface-variant">{r.posologia}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    {/* Comprobante oficial */}
                    {ultimaConsulta && (
                      <section className="relative overflow-hidden bg-card border border-ink-line rounded-3xl p-5 md:p-6 flex flex-col">
                        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: temaCentro.gradient }} />
                        <div className="flex items-center gap-3 mb-4">
                          <img src={centroCITAB.logo} alt="" className="w-9 h-9 rounded-lg object-contain p-1 bg-white border border-ink-line" />
                          <div>
                            <p className="text-sm font-extrabold text-primary leading-tight">Comprobante Oficial</p>
                            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">Consulta médica</p>
                          </div>
                        </div>

                        <dl className="space-y-2 text-xs">
                          {[
                            ['Paciente', paciente.nombre_completo],
                            ['Cédula', `${paciente.tipo_cedula || 'V'}-${paciente.cedula}`],
                            ['Especialidad', ultimaConsulta.especialidad],
                            ['Fecha', formatoFecha(ultimaConsulta.fecha)],
                          ].map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-4">
                              <dt className="text-on-surface-variant">{k}</dt>
                              <dd className="font-semibold text-primary text-right">{v}</dd>
                            </div>
                          ))}
                        </dl>

                        <div className="my-4 border-t border-dashed border-ink-line-strong relative">
                          <span className="absolute -left-2 -top-2 w-4 h-4 rounded-full bg-surface" />
                          <span className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-surface" />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant">Referencia</p>
                            <p className="font-mono text-sm font-bold text-primary tracking-wider">
                              {ultimaConsulta.comprobante_ref || 'ABH-00000'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white border border-ink-line rounded-lg flex items-center justify-center">
                              <Icon name="qr_code_2" className="text-3xl text-ink" />
                            </div>
                            <button
                              onClick={() => setRecetaAbierta(ultimaConsulta)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm active:scale-[0.98] transition-all"
                              style={{ background: temaCentro.gradient }}
                            >
                              <Icon name="download" className="text-base" /> Descargar Comprobante
                            </button>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              )}

              {/* ====== CITAS ====== */}
              {seccion === 'citas' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-6 py-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-primary">Mis Citas</h2>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mt-1">
                        Agenda y estado de tus consultas
                      </p>
                    </div>
                    <Button
                      onClick={() => setCitaModal(centroCITAB)}
                      variant="contained"
                      startIcon={<Icon name="add" className="text-lg" />}
                      sx={{ background: temaCentro.gradient, borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                    >
                      Agendar cita
                    </Button>
                  </div>

                  {cargando ? (
                    <div className="py-10 text-center text-on-surface-variant text-sm animate-pulse">Cargando citas...</div>
                  ) : citas.length === 0 ? (
                    <div className="py-16 text-center text-on-surface-variant space-y-2 bg-surface-container-low rounded-3xl border border-outline-variant">
                      <Icon name="event_busy" className="text-6xl opacity-40" />
                      <p className="text-sm font-medium">No tienes citas registradas.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {citas.map((c) => (
                        <div key={c.id} className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex items-center gap-4 sm:w-56 shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                              <Icon name="event" filled className="text-xl" />
                            </div>
                            <div>
                              <p className="text-sm font-extrabold text-primary capitalize">{formatoFechaLarga(c.fecha_cita)}</p>
                              <p className="font-mono text-[11px] font-bold text-secondary">{horaCorta(c.hora_inicio)}</p>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-primary">{c.especialidad}</p>
                            <p className="text-xs text-on-surface-variant truncate">{c.centro_salud}</p>
                            {c.motivo && <p className="text-xs text-on-surface-variant mt-0.5 italic">"{c.motivo}"</p>}
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <EtiquetaEstado estado={c.estado} mapa={ESTADOS_CITA} />
                            <span className="hidden md:block font-mono text-[10px] text-on-surface-variant">
                              {c.codigo_confirmacion}
                            </span>
                            {c.estado !== 'cancelada' && c.estado !== 'completada' && (
                              <Button
                                size="small"
                                onClick={() => setCitaModal(centroCITAB)}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'var(--color-secondary)' }}
                              >
                                Reagendar
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ====== ESTUDIOS ====== */}
              {seccion === 'estudios' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-6 py-5 space-y-5">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-primary">Mis Estudios</h2>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mt-1">
                      Órdenes de laboratorio, imágenes y estudios funcionales
                    </p>
                  </div>

                  {cargando ? (
                    <div className="py-10 text-center text-on-surface-variant text-sm animate-pulse">Cargando estudios...</div>
                  ) : ordenes.length === 0 ? (
                    <div className="py-16 text-center text-on-surface-variant space-y-2 bg-surface-container-low rounded-3xl border border-outline-variant">
                      <Icon name="science" className="text-6xl opacity-40" />
                      <p className="text-sm font-medium">No tienes órdenes de estudios.</p>
                      <p className="text-xs">Cuando tu médico emita una orden, aparecerá aquí.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {ordenes.map((o) => (
                        <div key={o.id} className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
                          <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-doc-soft text-doc flex items-center justify-center">
                                <Icon name="lab_profile" filled className="text-xl" />
                              </div>
                              <div>
                                <p className="font-mono text-xs font-bold text-primary tracking-wide">
                                  {o.comprobante_orden || o.id}
                                </p>
                                <p className="text-[11px] text-on-surface-variant">
                                  {o.especialidad} · {formatoFecha(o.created_at)}
                                </p>
                              </div>
                            </div>
                            <EtiquetaEstado estado={o.estado} mapa={ESTADOS_ORDEN} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(o.estudios || []).map((e, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-xs font-semibold text-primary">
                                <Icon
                                  name={e.tipo === 'laboratorio' ? 'bloodtype' : e.tipo === 'imagen' ? 'image' : 'monitor_heart'}
                                  className="text-sm text-doc"
                                />
                                {e.nombre}
                                {e.estado === 'completado' && <Icon name="check_circle" className="text-sm text-success" />}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ====== MI SALUD ====== */}
              {seccion === 'misalud' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-6 py-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-primary">Mi Salud</h2>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mt-1">
                        Datos que tu médico ve en cada consulta
                      </p>
                    </div>
                    <Button
                      onClick={abrirPerfil}
                      variant="contained"
                      startIcon={<Icon name="edit" className="text-lg" />}
                      sx={{ background: temaCentro.gradient, borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                    >
                      Actualizar mis datos
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <section className="md:col-span-2 bg-surface-container-low border border-outline-variant rounded-3xl p-6">
                      <h3 className="font-display text-lg font-bold text-primary mb-4">Información del paciente</h3>
                      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                        {[
                          ['Nombre completo', paciente.nombre_completo],
                          ['Cédula', `${paciente.tipo_cedula || 'V'}-${paciente.cedula}`],
                          ['N° Historia', paciente.numero_historia],
                          ['Fecha de nacimiento', formatoFecha(paciente.fecha_nacimiento)],
                          ['Edad', calcularEdad(paciente.fecha_nacimiento)],
                          ['Teléfono', paciente.telefono || '—'],
                          ['Correo', paciente.email || '—'],
                          ['Tipo de sangre', paciente.tipo_sangre || '—'],
                        ].map(([k, v]) => (
                          <div key={k} className="border-b border-outline-variant/40 pb-3">
                            <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-on-surface-variant mb-1">{k}</dt>
                            <dd className="font-semibold text-primary">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>

                    <section className="bg-card border border-ink-line rounded-3xl p-6">
                      <h3 className="font-display text-lg font-bold text-primary mb-4">Datos clínicos</h3>
                      <div className="space-y-4">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mb-2">Tipo de sangre</p>
                          <span className="px-4 py-2 rounded-xl font-mono font-bold text-base text-blood" style={{ background: 'var(--color-blood-soft)' }}>
                            {paciente.tipo_sangre || '—'}
                          </span>
                        </div>
                        <Divider sx={{ borderColor: 'var(--color-outline-variant)' }} />
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mb-2">Alergias</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.isArray(paciente.alergias) && paciente.alergias.length > 0 ? (
                              paciente.alergias.map((a) => (
                                <Chip key={a} size="small" label={a} sx={{ fontSize: '0.7rem', fontWeight: 700, bgcolor: 'var(--color-error-container)', color: 'var(--color-error)' }} />
                              ))
                            ) : (
                              <span className="text-xs text-on-surface-variant/60 italic">Sin alergias</span>
                            )}
                          </div>
                        </div>
                        <Divider sx={{ borderColor: 'var(--color-outline-variant)' }} />
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mb-2">Antecedentes</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.isArray(paciente.antecedentes_medicos) && paciente.antecedentes_medicos.length > 0 ? (
                              paciente.antecedentes_medicos.map((a) => (
                                <Chip key={a} size="small" label={a} sx={{ fontSize: '0.7rem', fontWeight: 700, bgcolor: 'var(--color-amber-soft)', color: 'var(--color-amber)' }} />
                              ))
                            ) : (
                              <span className="text-xs text-on-surface-variant/60 italic">Sin antecedentes</span>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-on-surface-variant italic flex items-start gap-1.5 pt-1">
                          <Icon name="info" className="text-sm text-secondary shrink-0 mt-0.5" />
                          Estos datos son compartidos con tu médico durante la consulta. Mantenlos actualizados.
                        </p>
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal de cita (CITAB) */}
      {citaModal && <CitaModal centro={citaModal} onClose={() => setCitaModal(null)} />}

      {/* Diálogo: detalle de consulta / comprobante */}
      <Dialog open={!!recetaAbierta} onClose={() => setRecetaAbierta(null)} maxWidth="sm" fullWidth>
        {recetaAbierta && (
          <>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span className="font-display text-xl font-bold text-primary">Detalle de Consulta</span>
              <IconButton onClick={() => setRecetaAbierta(null)} aria-label="Cerrar">
                <Icon name="close" />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3 pb-4 border-b border-outline-variant">
                  <img src={centroCITAB.logo} alt="" className="w-9 h-9 rounded-lg object-contain p-1 bg-white border border-outline-variant" />
                  <div>
                    <p className="font-extrabold text-primary">{recetaAbierta.especialidad}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                      {recetaAbierta.medico_nombre} · {formatoFecha(recetaAbierta.fecha)}
                    </p>
                  </div>
                </div>
                {[
                  ['Motivo de consulta', recetaAbierta.motivo_consulta],
                  ['Examen físico', recetaAbierta.examen_fisico],
                  ['Diagnóstico', recetaAbierta.cie10_codigo ? `${recetaAbierta.cie10_codigo} · ${recetaAbierta.cie10_descripcion}` : ''],
                  ['Tratamiento', recetaAbierta.tratamiento],
                  ['Indicaciones médicas', recetaAbierta.recomendaciones],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-1">{k}</p>
                      <p className="text-primary font-medium">{v}</p>
                    </div>
                  ))}
                {recetaAbierta.recetas && recetaAbierta.recetas.length > 0 && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">Recetas Emitidas</p>
                    <div className="space-y-2">
                      {recetaAbierta.recetas.map((r, i) => (
                        <div key={i} className="p-3 bg-surface-container-low rounded-xl flex items-start gap-2.5">
                          <Icon name="medication" className="text-base text-fx mt-0.5" />
                          <div>
                            <p className="font-semibold text-primary">{r.nombre}</p>
                            {r.posologia && <p className="text-xs text-on-surface-variant">{r.posologia}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {recetaAbierta.estudios && recetaAbierta.estudios.length > 0 && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">Estudios solicitados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recetaAbierta.estudios.map((e, i) => (
                        <Chip key={i} size="small" label={e.nombre} sx={{ fontSize: '0.7rem', fontWeight: 600 }} />
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-3 flex items-center justify-between border-t border-dashed border-ink-line-strong">
                  <span className="font-mono text-[10px] text-on-surface-variant">Comprobante</span>
                  <span className="font-mono text-xs font-bold text-primary">{recetaAbierta.comprobante_ref || '—'}</span>
                </div>
              </div>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setRecetaAbierta(null)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'var(--color-secondary)' }}>
                Cerrar
              </Button>
              <Button
                variant="contained"
                startIcon={<Icon name="print" className="text-lg" />}
                sx={{ background: temaCentro.gradient, borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                onClick={() => window.print()}
              >
                Imprimir
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Diálogo: editar perfil */}
      <Dialog open={perfilAbierto} onClose={() => setPerfilAbierto(false)} maxWidth="sm" fullWidth>
        {perfilForm && (
          <>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span className="font-display text-xl font-bold text-primary">Actualizar Mi Salud</span>
              <IconButton onClick={() => setPerfilAbierto(false)} aria-label="Cerrar">
                <Icon name="close" />
              </IconButton>
            </DialogTitle>
            <form onSubmit={guardarPerfil}>
              <DialogContent dividers>
                {perfilError && (
                  <div className="mb-4 p-3 bg-error-container rounded-xl border border-error/20 flex items-center gap-2" role="alert">
                    <Icon name="error" className="text-error" />
                    <p className="text-xs font-semibold text-error">{perfilError}</p>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-1.5">Tipo de sangre</p>
                    <div className="flex flex-wrap gap-2">
                      {TIPOS_SANGRE.map((ts) => (
                        <button
                          key={ts}
                          type="button"
                          onClick={() => setPerfilForm({ ...perfilForm, tipo_sangre: ts })}
                          className={`px-4 py-2 rounded-xl font-mono font-bold text-sm border transition-all ${
                            perfilForm.tipo_sangre === ts
                              ? 'text-white border-transparent shadow-md'
                              : 'border-outline-variant text-primary hover:border-secondary'
                          }`}
                          style={perfilForm.tipo_sangre === ts ? { background: 'var(--color-blood)' } : undefined}
                        >
                          {ts}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextField
                    fullWidth
                    label="Alergias"
                    placeholder="Penicilina, Polen, ..."
                    helperText="Separa cada alergia con comas"
                    value={perfilForm.alergias}
                    onChange={(e) => setPerfilForm({ ...perfilForm, alergias: e.target.value })}
                    sx={fieldSx}
                  />
                  <TextField
                    fullWidth
                    label="Antecedentes médicos"
                    placeholder="Hipertensión, Diabetes, ..."
                    helperText="Separa cada antecedente con comas"
                    value={perfilForm.antecedentes}
                    onChange={(e) => setPerfilForm({ ...perfilForm, antecedentes: e.target.value })}
                    sx={fieldSx}
                  />
                  <Divider sx={{ borderColor: 'var(--color-outline-variant)' }} />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <TextField
                      fullWidth
                      label="Nombre completo"
                      value={perfilForm.nombre_completo}
                      onChange={(e) => setPerfilForm({ ...perfilForm, nombre_completo: e.target.value })}
                      sx={fieldSx}
                    />
                    <TextField
                      fullWidth
                      type="date"
                      label="Fecha de nacimiento"
                      InputLabelProps={{ shrink: true }}
                      value={perfilForm.fecha_nacimiento}
                      onChange={(e) => setPerfilForm({ ...perfilForm, fecha_nacimiento: e.target.value })}
                      sx={fieldSx}
                    />
                    <TextField
                      fullWidth
                      label="Teléfono"
                      placeholder="0414-1234567"
                      value={perfilForm.telefono}
                      onChange={(e) => setPerfilForm({ ...perfilForm, telefono: e.target.value })}
                      sx={fieldSx}
                    />
                    <TextField
                      fullWidth
                      type="email"
                      label="Correo electrónico"
                      placeholder="ejemplo@correo.com"
                      value={perfilForm.email}
                      onChange={(e) => setPerfilForm({ ...perfilForm, email: e.target.value })}
                      sx={fieldSx}
                    />
                  </div>
                  <p className="text-[11px] text-on-surface-variant italic flex items-start gap-1.5">
                    <Icon name="info" className="text-sm text-secondary shrink-0 mt-0.5" />
                    Al guardar, estos datos quedan disponibles para tu médico en la próxima consulta.
                  </p>
                </div>
              </DialogContent>
              <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={() => setPerfilAbierto(false)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'var(--color-secondary)' }}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={perfilGuardando}
                  startIcon={perfilGuardando ? <Icon name="sync" className="text-lg animate-spin" /> : <Icon name="save" className="text-lg" />}
                  sx={{ background: temaCentro.gradient, borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                >
                  {perfilGuardando ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </DialogActions>
            </form>
          </>
        )}
      </Dialog>

      <Snackbar
        open={!!aviso}
        autoHideDuration={4000}
        onClose={() => setAviso('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setAviso('')} severity="success" variant="filled">
          {aviso}
        </Alert>
      </Snackbar>
    </div>
  );
}

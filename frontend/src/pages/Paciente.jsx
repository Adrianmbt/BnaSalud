import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Icon from '../components/Icon';
import { API, parseCedula, cerrarSesion, marcarUltimaSesion } from '../api';
import { getCentroTheme } from '../centroTheme';
import {
  EstadoVacio,
  EsqueletoPagina,
  EsqueletoLista,
} from '../components/Estado';

const SECCIONES = [
  { id: 'dashboard', etiqueta: 'Dashboard', detalle: 'Resumen de salud', icono: 'grid_view' },
  { id: 'citas', etiqueta: 'Citas', detalle: 'Agenda y confirmación', icono: 'calendar_month' },
  { id: 'historial', etiqueta: 'Historial', detalle: 'Consultas y evolución', icono: 'timeline' },
  { id: 'estudios', etiqueta: 'Estudios', detalle: 'Órdenes y resultados', icono: 'monitor_heart' },
  { id: 'notificaciones', etiqueta: 'Notificaciones', detalle: 'Correos del sistema', icono: 'notifications' },
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

const accessFieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: '0.85rem',
    fontSize: '0.95rem',
    transition: 'box-shadow 200ms ease, border-color 200ms ease, background-color 200ms ease',
    '&:hover': { backgroundColor: '#ffffff' },
    '& fieldset': { borderColor: 'var(--color-outline-variant)', transition: 'border-color 200ms ease' },
    '&:hover fieldset': { borderColor: 'var(--color-secondary)' },
    '&.Mui-focused': {
      backgroundColor: '#ffffff',
      boxShadow: '0 0 0 4px rgba(59,152,212,0.14)',
    },
    '&.Mui-focused fieldset': { borderColor: 'var(--color-secondary)', borderWidth: 2 },
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.9rem',
    '&.Mui-focused': { color: 'var(--color-secondary)', fontWeight: 600 },
  },
  '& .MuiFormHelperText-root': { marginTop: 6 },
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
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return 'Por asignar';
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatoFechaLarga(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (!iso || Number.isNaN(d.getTime())) return 'Por asignar';
  return d.toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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

const ESTADOS_NOTIFICACION = {
  enviado: { tono: 'success', etiqueta: 'Enviado' },
  demo: { tono: 'info', etiqueta: 'Registrado' },
  error: { tono: 'error', etiqueta: 'Error de envío' },
  pendiente: { tono: 'amber', etiqueta: 'Pendiente' },
};

const TIPOS_NOTIFICACION = {
  bienvenida: { icono: 'waving_hand', etiqueta: 'Bienvenida' },
  receta_entregada: { icono: 'local_shipping', etiqueta: 'Receta entregada' },
  recordatorio_cita: { icono: 'event_available', etiqueta: 'Recordatorio de cita' },
  aviso_personal: { icono: 'campaign', etiqueta: 'Aviso del personal' },
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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize"
      style={{ color: colorMap[conf.tono], background: `${colorMap[conf.tono]}14` }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: colorMap[conf.tono] }} />
      {conf.etiqueta}
    </span>
  );
}

export default function Paciente() {
  const [cedulaEntrada, setCedulaEntrada] = useState('');
  const [passwordEntrada, setPasswordEntrada] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [errorEntrada, setErrorEntrada] = useState('');
  const [infoEntrada, setInfoEntrada] = useState('');
  const [flujoAcceso, setFlujoAcceso] = useState('login'); // login | registro | recuperar | reset
  const [recuperarForm, setRecuperarForm] = useState({ cedula: '', email: '', codigo: '', password: '' });
  const [recuperando, setRecuperando] = useState(false);
  const [registroForm, setRegistroForm] = useState({
    tipo_cedula: 'V',
    cedula: '',
    nombre_completo: '',
    fecha_nacimiento: '',
    telefono: '',
    email: '',
    tipo_sangre: '',
    alergias: '',
    password: '',
    consentimiento: false,
  });
  const [registrando, setRegistrando] = useState(false);
  const [buscandoEmpleado, setBuscandoEmpleado] = useState(false);
  const [autollenadoInfo, setAutollenadoInfo] = useState('');
  const [paciente, setPaciente] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [citas, setCitas] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [avisoError, setAvisoError] = useState('');

  const [seccion, setSeccion] = useState('dashboard');
  const [navAbierta, setNavAbierta] = useState(false);
  const [solicitudAbierta, setSolicitudAbierta] = useState(false);
  const [solicitudForm, setSolicitudForm] = useState({
    centro_id: '',
    especialidad_id: '',
    motivo: '',
  });
  const [centrosSolicitud, setCentrosSolicitud] = useState([]);
  const [especialidadesSolicitud, setEspecialidadesSolicitud] = useState([]);
  const [cargandoEspecialidades, setCargandoEspecialidades] = useState(false);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [solicitudError, setSolicitudError] = useState('');
  const [aviso, setAviso] = useState('');
  const [recetaAbierta, setRecetaAbierta] = useState(null);
  const [anchorNotif, setAnchorNotif] = useState(null);

  const [citaAPosponer, setCitaAPosponer] = useState(null);
  const [nuevaFechaPosponer, setNuevaFechaPosponer] = useState('');
  const [nuevaHoraPosponer, setNuevaHoraPosponer] = useState('');
  const [motivoPosponer, setMotivoPosponer] = useState('');
  const [posponiendo, setPosponiendo] = useState(false);
  const [posponerError, setPosponerError] = useState('');

  const [citaACancelar, setCitaACancelar] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [cancelarError, setCancelarError] = useState('');
  const [motivoCancelar, setMotivoCancelar] = useState('');

  async function handlePosponerSubmit(e) {
    e.preventDefault();
    if (!citaAPosponer || !nuevaFechaPosponer || !nuevaHoraPosponer) {
      setPosponerError('Debe seleccionar una fecha y un horario disponible.');
      return;
    }
    setPosponiendo(true);
    setPosponerError('');
    try {
      const resp = await API.posponerCita(citaAPosponer.id, {
        nueva_fecha: nuevaFechaPosponer,
        nueva_hora: nuevaHoraPosponer.length === 5 ? `${nuevaHoraPosponer}:00` : nuevaHoraPosponer,
        motivo: motivoPosponer || 'Solicitud de postergación desde el portal del paciente',
      });
      setCitas((prev) => prev.map((c) => (c.id === resp.id ? resp : c)));
      setCitaAPosponer(null);
      setNuevaFechaPosponer('');
      setNuevaHoraPosponer('');
      setMotivoPosponer('');
      setSlotsPosponer([]);
      setAviso('Cita reprogramada exitosamente.');
    } catch (err) {
      setPosponerError(err.message || 'No se pudo reprogramar la cita.');
    } finally {
      setPosponiendo(false);
    }
  }

  async function handleCancelarCita(e) {
    e.preventDefault();
    if (!citaACancelar) return;
    setCancelando(true);
    setCancelarError('');
    try {
      const resp = await API.cancelarCita(citaACancelar.id, {
        motivo: motivoCancelar || 'Cancelación solicitada desde el portal del paciente',
      });
      setCitas((prev) => prev.map((c) => (c.id === resp.id ? resp : c)));
      setCitaACancelar(null);
      setMotivoCancelar('');
      setAviso('Cita cancelada. Tu cupo quedó liberado.');
    } catch (err) {
      setCancelarError(err.message || 'No se pudo cancelar la cita.');
    } finally {
      setCancelando(false);
    }
  }

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

  const instVars = {
    '--color-primary': '#3B98D4',
    '--color-primary-light': '#6BB6E4',
    '--color-primary-dark': '#2174A6',
    '--color-secondary': '#1A4B7C',
    '--color-secondary-light': '#2E6BA8',
    '--color-secondary-dark': '#0F2F4D',
    '--color-secondary-container': '#E3EEF7',
    '--color-on-secondary': '#ffffff',
    '--color-on-secondary-container': '#1A4B7C',
    '--color-surface': '#F8FAFC',
    '--color-surface-container': '#EAF2F9',
    '--color-surface-container-low': '#FFFFFF',
    '--color-surface-container-high': '#DCE8F2',
    '--color-surface-container-highest': '#DCE8F2',
    '--color-on-surface-variant': '#4A6478',
    '--color-outline': '#9DB8CC',
    '--color-outline-variant': '#D3E2EE',
    '--color-doc': '#3B98D4',
    '--color-doc-deep': '#1A4B7C',
    '--color-doc-soft': '#E8F3FB',
    '--color-accent': '#38B000',
    '--color-error': '#D90429',
    '--color-error-container': '#FDE8E8',
  };

  const entrar = useCallback(async (cedula, password) => {
    setEntrando(true);
    setErrorEntrada('');
    setInfoEntrada('');
    const ident = parseCedula(cedula);
    const cedulaLimpia = ident.cedula || cedula.replace(/\D/g, '');
    try {
      const res = await API.loginPaciente(cedulaLimpia, password);
      try {
        localStorage.setItem('bna_token_paciente', res.token);
        localStorage.setItem('bna_sesion_paciente', JSON.stringify({ cedula: cedulaLimpia }));
        marcarUltimaSesion('paciente');
      } catch {
        /* sin almacenamiento */
      }
      setPaciente(res.paciente);
      setSeccion('dashboard');
      setNavAbierta(false);
    } catch (err) {
      setErrorEntrada(err.message || 'No se pudo iniciar sesión. Verifique su cédula y su contraseña.');
    } finally {
      setEntrando(false);
    }
  }, []);

  const cerrarSesionPaciente = useCallback(() => {
    cerrarSesion('paciente');
    try {
      localStorage.removeItem('bna_sesion_paciente');
    } catch {
      /* sin almacenamiento */
    }
    setPaciente(null);
    setCedulaEntrada('');
    setPasswordEntrada('');
    setErrorEntrada('');
    setInfoEntrada('');
    setFlujoAcceso('login');
    setSeccion('dashboard');
  }, []);

  const abrirSolicitud = useCallback(() => {
    setSolicitudError('');
    setSolicitudForm({
      centro_id: '',
      especialidad_id: '',
      motivo: '',
    });
    setEspecialidadesSolicitud([]);
    setSolicitudAbierta(true);
    setNavAbierta(false);
  }, []);

  useEffect(() => {
    if (!solicitudAbierta || centrosSolicitud.length > 0) return undefined;
    let activo = true;
    API.getCentros()
      .then((data) => {
        if (activo) {
          setCentrosSolicitud(
            (Array.isArray(data) ? data : []).filter((c) => !c.disabled),
          );
        }
      })
      .catch(() => {
        if (activo) setCentrosSolicitud([]);
      });
    return () => {
      activo = false;
    };
  }, [solicitudAbierta, centrosSolicitud.length]);

  useEffect(() => {
    if (!solicitudAbierta || !solicitudForm.centro_id) {
      setEspecialidadesSolicitud([]);
      return undefined;
    }
    let activo = true;
    setCargandoEspecialidades(true);
    API.getEspecialidades(solicitudForm.centro_id)
      .then((data) => {
        if (activo) setEspecialidadesSolicitud(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (activo) setEspecialidadesSolicitud([]);
      })
      .finally(() => {
        if (activo) setCargandoEspecialidades(false);
      });
    return () => {
      activo = false;
    };
  }, [solicitudAbierta, solicitudForm.centro_id]);

  const enviarSolicitud = async (e) => {
    e.preventDefault();
    setSolicitudError('');
    if (!solicitudForm.centro_id || !solicitudForm.especialidad_id) {
      setSolicitudError('Selecciona el centro de salud y la especialidad.');
      return;
    }
    setEnviandoSolicitud(true);
    try {
      const nueva = await API.solicitarCita({
        centro_id: Number(solicitudForm.centro_id),
        especialidad_id: Number(solicitudForm.especialidad_id),
        motivo: solicitudForm.motivo.trim() || null,
      });
      setCitas((prev) => [nueva, ...prev]);
      setSolicitudAbierta(false);
      setAviso(
        'Solicitud enviada. La recepción del centro te confirmará la fecha y la hora.',
      );
    } catch (err) {
      setSolicitudError(err.message || 'No se pudo enviar la solicitud.');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const solicitarRecuperacion = async (e) => {
    e.preventDefault();
    setRecuperando(true);
    setErrorEntrada('');
    setInfoEntrada('');
    const ident = parseCedula(recuperarForm.cedula);
    if (!ident.cedula) {
      setErrorEntrada('Ingrese su cédula.');
      setRecuperando(false);
      return;
    }
    try {
      const res = await API.recuperarContrasena(ident.cedula, recuperarForm.email);
      setInfoEntrada(res.mensaje || 'Se envió el código a su correo.');
      setRecuperarForm((f) => ({ ...f, cedula: ident.cedula }));
      setFlujoAcceso('reset');
    } catch (err) {
      setErrorEntrada(err.message || 'No se pudo generar el código de recuperación.');
    } finally {
      setRecuperando(false);
    }
  };

  const restablecerContrasena = async (e) => {
    e.preventDefault();
    setRecuperando(true);
    setErrorEntrada('');
    setInfoEntrada('');
    const password = String(recuperarForm.password || '');
    if (password.length < 6 || password.length > 64) {
      setErrorEntrada('La contraseña nueva debe tener entre 6 y 64 caracteres.');
      setRecuperando(false);
      return;
    }
    try {
      await API.restablecerContrasena(recuperarForm.cedula, recuperarForm.codigo, password);
      setFlujoAcceso('login');
      setRecuperarForm({ cedula: '', email: '', codigo: '', password: '' });
      setInfoEntrada('¡Contraseña restablecida! Inicia sesión con tu cédula y la nueva contraseña.');
    } catch (err) {
      setErrorEntrada(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setRecuperando(false);
    }
  };

  const autollenarEmpleado = async () => {
    const ident = parseCedula(registroForm.cedula);
    if (!ident.cedula || ident.cedula.length < 5) return;
    setBuscandoEmpleado(true);
    setAutollenadoInfo('');
    try {
      const res = await API.buscarEmpleado(ident.cedula);
      if (res && res.encontrado) {
        setRegistroForm((f) => ({
          ...f,
          nombre_completo: res.nombre_completo || f.nombre_completo,
          telefono: res.telefono || f.telefono,
          email: res.email || f.email,
        }));
        setAutollenadoInfo(
          `Datos cargados desde el sistema de personal${
            res.cargo ? ` (${res.cargo})` : ''
          }. Revisa que estén correctos.`,
        );
      }
    } catch {
      /* El autollenado es opcional: si falla, el paciente llena sus datos. */
    } finally {
      setBuscandoEmpleado(false);
    }
  };

  const registrarCuenta = async (e) => {
    e.preventDefault();
    setErrorEntrada('');
    setInfoEntrada('');
    const ident = parseCedula(registroForm.cedula);
    if (!ident.cedula || ident.cedula.length < 5) {
      setErrorEntrada('Ingrese una cédula válida.');
      return;
    }
    if (registroForm.nombre_completo.trim().length < 3) {
      setErrorEntrada('Ingrese su nombre completo.');
      return;
    }
    const password = String(registroForm.password || '');
    if (password.length < 6 || password.length > 64) {
      setErrorEntrada('La contraseña debe tener entre 6 y 64 caracteres.');
      return;
    }
    if (!registroForm.consentimiento) {
      setErrorEntrada('Debe aceptar el tratamiento de sus datos de salud.');
      return;
    }

    setRegistrando(true);
    try {
      const res = await API.registrarPaciente({
        tipo_cedula: ident.tipo_cedula || registroForm.tipo_cedula,
        cedula: ident.cedula,
        nombre_completo: registroForm.nombre_completo.trim(),
        fecha_nacimiento: registroForm.fecha_nacimiento || null,
        telefono: registroForm.telefono.trim() || null,
        email: registroForm.email.trim() || null,
        tipo_sangre: registroForm.tipo_sangre || null,
        alergias: registroForm.alergias
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        antecedentes_medicos: [],
        password,
        consentimiento_datos: true,
      });
      try {
        localStorage.setItem('bna_token_paciente', res.token);
        localStorage.setItem('bna_sesion_paciente', JSON.stringify({ cedula: ident.cedula }));
        marcarUltimaSesion('paciente');
      } catch {
        /* sin almacenamiento */
      }
      setPaciente(res.paciente);
      setCedulaEntrada(ident.cedula);
      setPasswordEntrada(password);
      setSeccion('dashboard');
      setFlujoAcceso('login');
      setAviso('¡Bienvenido! Tu cuenta fue creada correctamente.');
    } catch (err) {
      setErrorEntrada(err.message || 'No se pudo crear la cuenta.');
    } finally {
      setRegistrando(false);
    }
  };

  // Restaurar sesión al montar (pantalla de login por defecto si no hay sesión real)
  useEffect(() => {
    let activo = true;
    (async () => {
      let sesion = null;
      let token = null;
      try {
        sesion = JSON.parse(localStorage.getItem('bna_sesion_paciente') || 'null');
        token = localStorage.getItem('bna_token_paciente');
      } catch {
        sesion = null;
        token = null;
      }

      if (sesion && sesion.cedula && token) {
        try {
          const datos = await API.buscarPaciente(sesion.cedula);
          if (activo) {
            marcarUltimaSesion('paciente');
            setPaciente(datos);
            return;
          }
        } catch (err) {
          if (err && err.status === 401) {
            cerrarSesion('paciente');
            try {
              localStorage.removeItem('bna_sesion_paciente');
            } catch {}
          }
        }
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const cargarTodo = useCallback(async () => {
    if (!paciente) return;
    setCargando(true);
    const cedula = String(paciente.cedula || '').replace(/\D/g, '');

    const promesas = (() => {
      const sinDatos = (err) => {
        if (err && err.status === 401) throw err;
        return null;
      };
      const sinLista = (err) => {
        if (err && err.status === 401) throw err;
        return [];
      };
      return [
        API.historialPaciente(cedula).catch(sinDatos),
        API.citasPaciente(cedula).catch(sinLista),
        API.notificacionesPaciente(cedula).catch(sinLista),
      ];
    })();
    try {
      const [h, c, n] = await Promise.all(promesas);
      setHistorial(h && h.historial ? h : null);
      setCitas(Array.isArray(c) ? c : []);
      setNotificaciones(Array.isArray(n) ? n : []);
    } catch (err) {
      if (err && err.status === 401) {
        cerrarSesionPaciente();
        setAvisoError('Su sesión ha expirado. Por favor ingrese de nuevo.');
      } else {
        setHistorial(null);
        setCitas([]);
        setNotificaciones([]);
      }
    } finally {
      setCargando(false);
    }
  }, [paciente, cerrarSesionPaciente]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const proximaCita = useMemo(() => {
    const hoy = new Date();
    return (
      citas
        .filter(
          (c) =>
            c.estado !== 'cancelada' &&
            c.estado !== 'pendiente' &&
            new Date(`${String(c.fecha_cita).slice(0, 10)}T00:00:00`) >= hoy,
        )
        .sort((a, b) => new Date(a.fecha_cita) - new Date(b.fecha_cita))[0] || null
    );
  }, [citas]);

  const centroCITAB = {
    id: 2,
    nombre: 'Centro Integral de Salud CITAB',
    subtitulo: 'Centro de Especialidades Médicas Municipal',
    tipo: 'Especializado',
    parroquia: 'El Carmen',
    direccion: 'Av. Caracas, Sector Tronconal III, Barcelona',
    horario: 'Lunes a Viernes 7:00 AM - 5:30 PM',
    servicios: ['Consulta Especializada', 'Laboratorio', 'Imágenes', 'Farmacia'],
    logo: '/identidad visual/InstitutoSalud.jpeg',
  };

  const contenidoNav = (
    <>
      <div
        className="relative overflow-hidden px-4 py-3 text-white shrink-0 border-b border-white/10"
        style={{ background: temaCentro.gradient }}
      >
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-14 -left-10 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, rgba(255,255,255,0.35) 0 10px, transparent 10px 26px)',
          }}
        />
        <div className="relative">
          <div className="bg-white/95 rounded-lg px-3 py-1.5 shadow-md ring-1 ring-black/5 mb-3">
            <img
              src={centroCITAB.logo}
              alt="Instituto de Salud"
              loading="lazy"
              className="h-7 w-full object-contain mx-auto"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex w-8 h-8 rounded-lg bg-white/15 border border-white/25 items-center justify-center shrink-0">
              <Icon name="badge" filled className="text-base" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold leading-tight truncate">Portal del Paciente</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/75 truncate">
                {temaCentro.lema}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <ul className="space-y-1">
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
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition-colors ${
                    activado
                      ? 'bg-surface-container-high text-primary shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${activado ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
                    <Icon name={s.icono} filled={activado} className="text-base" />
                  </span>
                  <span className={`block text-sm font-semibold leading-tight truncate ${activado ? 'text-primary' : ''}`}>
                    {s.etiqueta}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => {
            abrirSolicitud();
            setNavAbierta(false);
          }}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all btn-hover-effect"
          style={{ background: temaCentro.gradient }}
        >
          <Icon name="add_circle" className="text-base" /> Solicitar cita
        </button>
      </div>

      <div className="mt-auto px-4 py-3 border-t border-outline-variant">
        <Link
          to="/"
          onClick={() => setNavAbierta(false)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors text-sm font-medium"
        >
          <Icon name="home" className="text-lg" /> Portal de la Comunidad
        </Link>
      </div>
    </>
  );

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-surface text-primary font-ui" style={varsCentro}>
      {paciente && (
      <header className="relative z-40 shrink-0 bg-surface/90 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 md:px-6 h-14 border-b border-outline-variant">
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
            <h1 className="text-lg font-semibold text-primary leading-tight truncate">
              {paciente ? `¡Hola, ${paciente.nombre_completo.split(' ')[0]}!` : 'Portal del Paciente'}
            </h1>
          </div>

          <div className="flex-1" />

          {paciente && (
            <>
              <IconButton
                aria-label="Notificaciones"
                aria-haspopup="true"
                aria-expanded={Boolean(anchorNotif)}
                onClick={(e) => setAnchorNotif(e.currentTarget)}
                sx={{ color: 'var(--color-on-surface-variant)' }}
              >
                <Badge badgeContent={notificaciones.length} color="error">
                  <Icon name="notifications" className="text-xl" />
                </Badge>
              </IconButton>
              <div className="flex items-center gap-2.5 pl-1">
                <Avatar sx={{ bgcolor: 'var(--color-secondary)', width: 32, height: 32, fontWeight: 700, fontSize: '0.75rem' }}>
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
                onClick={cerrarSesionPaciente}
                className="flex items-center justify-center w-9 h-9 rounded-full text-on-surface-variant hover:text-error hover:bg-error/5 transition-colors"
                aria-label="Cerrar sesión y volver al portal"
                title="Cerrar sesión"
              >
                <Icon name="logout" className="text-xl" />
              </Link>
            </>
          )}
        </div>
      </header>
      )}

      <Popover
        open={Boolean(anchorNotif)}
        anchorEl={anchorNotif}
        onClose={() => setAnchorNotif(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: { sx: { borderRadius: '0.9rem', boxShadow: '0 18px 50px -12px rgba(0,0,0,0.25)', mt: 1, width: 380, maxWidth: '92vw' } },
        }}
      >
        <div className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant">
            <div>
              <p className="text-sm font-bold text-primary">Notificaciones</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                Últimas {Math.min(notificaciones.length, 5)}
              </p>
            </div>
            <button
              onClick={() => {
                setSeccion('notificaciones');
                setAnchorNotif(null);
              }}
              className="flex items-center gap-1 text-xs font-bold text-secondary hover:text-secondary-light transition-all btn-hover-effect"
            >
              Ver todas <Icon name="arrow_forward" className="text-sm" />
            </button>
          </div>

          <div className="max-h-[340px] overflow-y-auto ledger-scroll">
            {notificaciones.length === 0 ? (
              <EstadoVacio
                icono="notifications_off"
                titulo="No tienes notificaciones"
                clase="py-8 text-center text-on-surface-variant space-y-3 bg-surface-container-low rounded-xl border border-outline-variant"
              >
                <p className="text-xs mt-1">Revisa esta sección para actualizaciones de tus citas y recetas</p>
              </EstadoVacio>
            ) : (
              notificaciones.slice(0, 5).map((n) => {
                const conf = TIPOS_NOTIFICACION[n.tipo] || { icono: 'notifications', etiqueta: n.tipo };
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      setSeccion('notificaciones');
                      setAnchorNotif(null);
                    }}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-container transition-colors border-b border-outline-variant/40 last:border-b-0"
                  >
                    <span className="w-8 h-8 rounded-lg bg-doc-soft text-doc flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name={conf.icono} className="text-base" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-primary leading-snug line-clamp-1">{n.asunto}</span>
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant mt-0.5">
                        {conf.etiqueta}
                      </span>
                      {n.detalle && (
                        <span className="block text-[11px] text-on-surface-variant mt-1 line-clamp-2">{n.detalle}</span>
                      )}
                      <span className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="font-mono text-[10px] text-on-surface-variant/70">
                          {n.enviado_en
                            ? `${formatoFecha(n.enviado_en)} ${String(n.enviado_en).slice(11, 16)}`
                            : String(n.creado_en || '').slice(0, 10)}
                        </span>
                        <EtiquetaEstado estado={n.estado} mapa={ESTADOS_NOTIFICACION} />
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Popover>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {paciente && (
          <>
            {navAbierta && (
              <div
                className="fixed inset-0 z-30 bg-black/25 lg:hidden"
                onClick={() => setNavAbierta(false)}
                aria-hidden="true"
              />
            )}
            <aside
              className={`shrink-0 w-[min(280px,85vw)] bg-surface border-r border-outline-variant flex flex-col z-40 transition-all duration-300 ease-out ${
                navAbierta ? 'ml-0' : '-ml-[min(280px,85vw)]'
              }`}
              aria-label="Navegación del portal"
            >
              {contenidoNav}
            </aside>
          </>
        )}

        <main className="flex-1 min-w-0 flex flex-col bg-surface overflow-hidden">
          {!paciente ? (
            <div className="flex-1 overflow-y-auto ledger-scroll flex items-center justify-center p-6" style={{ background: '#F8FAFC', ...instVars }}>
              {entrando ? (
                <div className="w-full max-w-sm">
                  <EsqueletoPagina avatar lineas={4} />
                  <p className="mt-6 text-center text-sm text-on-surface-variant">
                    Verificando tus datos…
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-md">
                  <div className="bg-surface-container-low border border-outline-variant rounded-3xl p-8 relative overflow-hidden shadow-xl">
                    <div
                      className="absolute top-0 inset-x-0 h-1.5"
                      style={{ background: 'linear-gradient(90deg, #3B98D4 0%, #1A4B7C 45%, #38B000 78%, #D90429 100%)' }}
                      aria-hidden="true"
                    />
                    <div className="absolute -top-20 -right-20 w-56 h-56 bg-primary/10 rounded-full pointer-events-none" />
                    <div className="absolute -bottom-24 -left-16 w-48 h-48 bg-secondary/10 rounded-full pointer-events-none" />
                    <div className="relative">
                      <div className="w-full max-w-[240px] mx-auto mb-5 rounded-2xl bg-white border border-outline-variant shadow-md px-3 py-2.5 flex items-center justify-center overflow-hidden">
                        <img src="/identidad visual/InstitutoSalud.jpeg" alt="Logo Instituto de Salud Barcelona" loading="lazy" className="w-full h-auto max-h-16 object-contain" />
                      </div>
                      <h2 className="font-display text-2xl font-bold text-center text-secondary">Portal del Paciente</h2>
                      <p className="text-sm text-on-surface-variant text-center mt-1.5">
                        Ingresa tu cédula y tu contraseña para consultar tu historial clínico, citas y estudios.
                      </p>

                      {errorEntrada && (
                        <div className="mt-5 p-3 rounded-xl border border-error/20 bg-error-container flex items-center gap-2" role="alert">
                          <Icon name="error" className="text-error text-lg" />
                          <p className="text-xs font-semibold text-error">{errorEntrada}</p>
                        </div>
                      )}
                      {infoEntrada && (
                        <div className="mt-5 p-3 rounded-xl border border-doc/20 bg-doc-soft flex items-start gap-2" role="status">
                          <Icon name="info" className="text-doc text-lg shrink-0" />
                          <p className="text-xs font-semibold text-doc-deep">{infoEntrada}</p>
                        </div>
                      )}

                      {flujoAcceso === 'login' && (
                      <form
                        className="mt-6 flex flex-col gap-6"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const ident = parseCedula(cedulaEntrada);
                          if (!ident.cedula) {
                            setErrorEntrada('Ingrese su cédula.');
                            return;
                          }
                          if (String(passwordEntrada).length < 4) {
                            setErrorEntrada('Ingrese su contraseña.');
                            return;
                          }
                          entrar(ident.cedula, passwordEntrada);
                        }}
                      >
                        <TextField
                          fullWidth
                          label="Cédula de Identidad"
                          placeholder="V-12345678"
                          value={cedulaEntrada}
                          onChange={(e) => {
                            setCedulaEntrada(e.target.value);
                            setErrorEntrada('');
                          }}
                          sx={accessFieldSx}
                          autoFocus
                        />
                        <TextField
                          fullWidth
                          type="password"
                          label="Contraseña"
                          placeholder="Tu contraseña"
                          value={passwordEntrada}
                          onChange={(e) => {
                            setPasswordEntrada(e.target.value);
                            setErrorEntrada('');
                          }}
                          sx={accessFieldSx}
                          slotProps={{ htmlInput: { autoComplete: 'current-password' } }}
                          helperText="La contraseña que elegiste al crear tu cuenta."
                        />
                        <Button
                          type="submit"
                          fullWidth
                          disabled={entrando}
                          variant="contained"
                          sx={{
                            background: 'linear-gradient(135deg, #3B98D4 0%, #1A4B7C 100%)',
                            borderRadius: 2,
                            py: 1.4,
                            fontWeight: 700,
                            textTransform: 'none',
                            boxShadow: '0 8px 20px -8px rgba(26, 75, 124, 0.5)',
                          }}
                        >
                          {entrando ? 'Verificando...' : 'Entrar al portal'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setFlujoAcceso('registro');
                            setErrorEntrada('');
                            setInfoEntrada('');
                          }}
                          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-secondary/25 text-sm font-bold text-secondary transition-colors duration-200 hover:border-secondary hover:bg-secondary/5"
                        >
                          <Icon name="person_add" className="text-base" />
                          Crear mi cuenta
                        </button>
                      </form>
                    )}

                    {flujoAcceso === 'recuperar' && (
                      <form
                        className="mt-5 flex flex-col gap-5"
                        onSubmit={solicitarRecuperacion}
                      >
                        <div className="flex items-center gap-2">
                          <Icon name="lock_reset" className="text-doc" />
                          <p className="text-sm font-bold text-primary">Recuperar mi contraseña</p>
                        </div>
                        <p className="text-xs text-on-surface-variant -mt-2">
                          Ingrese su cédula y el correo con el que se registró. Le enviaremos un código de 6 dígitos.
                        </p>
                        <TextField
                          fullWidth
                          label="Cédula de Identidad"
                          placeholder="V-12345678"
                          value={recuperarForm.cedula}
                          onChange={(e) =>
                            setRecuperarForm((f) => ({ ...f, cedula: e.target.value }))
                          }
                          sx={accessFieldSx}
                          autoFocus
                        />
                        <TextField
                          fullWidth
                          type="email"
                          label="Correo registrado"
                          placeholder="usted@correo.com"
                          value={recuperarForm.email}
                          onChange={(e) =>
                            setRecuperarForm((f) => ({ ...f, email: e.target.value }))
                          }
                          sx={accessFieldSx}
                        />
                        <Button
                          type="submit"
                          fullWidth
                          disabled={recuperando}
                          variant="contained"
                          sx={{
                            backgroundColor: 'var(--color-doc)',
                            borderRadius: 2,
                            py: 1.3,
                            fontWeight: 700,
                            textTransform: 'none',
                            '&:hover': { backgroundColor: 'var(--color-doc-deep)' },
                          }}
                        >
                          {recuperando ? 'Enviando...' : 'Enviar código por correo'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setFlujoAcceso('login');
                            setErrorEntrada('');
                          }}
                          className="w-full text-xs font-bold text-secondary hover:underline"
                        >
                          Volver al acceso
                        </button>
                      </form>
                    )}

                    {flujoAcceso === 'reset' && (
                      <form className="mt-5 flex flex-col gap-5" onSubmit={restablecerContrasena}>
                        <div className="flex items-center gap-2">
                          <Icon name="password" className="text-doc" />
                          <p className="text-sm font-bold text-primary">Crear una contraseña nueva</p>
                        </div>
                        <p className="text-xs text-on-surface-variant -mt-2">
                          Ingresa el código recibido y elige tu nueva contraseña (mínimo 6 caracteres).
                        </p>
                        <TextField
                          fullWidth
                          label="Cédula"
                          value={recuperarForm.cedula}
                          disabled
                          sx={accessFieldSx}
                        />
                        <TextField
                          fullWidth
                          label="Código de 6 dígitos"
                          slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
                          value={recuperarForm.codigo}
                          onChange={(e) =>
                            setRecuperarForm((f) => ({
                              ...f,
                              codigo: e.target.value.replace(/\D/g, '').slice(0, 6),
                            }))
                          }
                          sx={accessFieldSx}
                          autoFocus
                        />
                        <TextField
                          fullWidth
                          type="password"
                          label="Contraseña nueva"
                          placeholder="Mínimo 6 caracteres"
                          slotProps={{ htmlInput: { maxLength: 64, autoComplete: 'new-password' } }}
                          value={recuperarForm.password}
                          onChange={(e) =>
                            setRecuperarForm((f) => ({
                              ...f,
                              password: e.target.value,
                            }))
                          }
                          sx={accessFieldSx}
                        />
                        <Button
                          type="submit"
                          fullWidth
                          disabled={recuperando}
                          variant="contained"
                          sx={{
                            backgroundColor: 'var(--color-doc)',
                            borderRadius: 2,
                            py: 1.3,
                            fontWeight: 700,
                            textTransform: 'none',
                            '&:hover': { backgroundColor: 'var(--color-doc-deep)' },
                          }}
                        >
                          {recuperando ? 'Guardando...' : 'Restablecer mi contraseña'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setFlujoAcceso('login');
                            setErrorEntrada('');
                          }}
                          className="w-full text-xs font-bold text-secondary hover:underline"
                        >
                          Volver al acceso
                        </button>
                      </form>
                    )}

                    {flujoAcceso === 'registro' && (
                      <form className="mt-5 flex flex-col gap-4" onSubmit={registrarCuenta}>
                        <div className="flex items-center gap-2">
                          <Icon name="person_add" className="text-doc" />
                          <p className="text-sm font-bold text-primary">Crear mi cuenta</p>
                        </div>
                        <p className="text-xs text-on-surface-variant -mt-2">
                          Registra tus datos una sola vez. Podrás reservar y consultar tus citas.
                        </p>
                        <div className="grid grid-cols-[92px_1fr] gap-3">
                          <TextField
                            select
                            label="Tipo"
                            value={registroForm.tipo_cedula}
                            onChange={(e) =>
                              setRegistroForm((f) => ({ ...f, tipo_cedula: e.target.value }))
                            }
                            sx={accessFieldSx}
                          >
                            <MenuItem value="V">V</MenuItem>
                            <MenuItem value="E">E</MenuItem>
                            <MenuItem value="P">P</MenuItem>
                          </TextField>
                          <TextField
                            label="Cédula de Identidad"
                            placeholder="12345678"
                            value={registroForm.cedula}
                            onChange={(e) => {
                              setRegistroForm((f) => ({ ...f, cedula: e.target.value }));
                              setAutollenadoInfo('');
                            }}
                            onBlur={autollenarEmpleado}
                            sx={accessFieldSx}
                            autoFocus
                            slotProps={{
                              htmlInput: { inputMode: 'numeric' },
                              input: {
                                endAdornment: buscandoEmpleado ? (
                                  <Icon name="sync" className="text-base animate-spin text-secondary" />
                                ) : null,
                              },
                            }}
                            helperText="Si eres trabajador de la Alcaldía, al salir del campo cargamos tus datos."
                          />
                        </div>
                        {autollenadoInfo && (
                          <div className="p-2.5 bg-doc-soft rounded-xl border border-doc/20 flex items-start gap-2" role="status">
                            <Icon name="badge" className="text-doc text-base shrink-0" />
                            <p className="text-[11px] font-semibold text-doc-deep">{autollenadoInfo}</p>
                          </div>
                        )}
                        <TextField
                          fullWidth
                          label="Nombre completo"
                          placeholder="María Rodríguez"
                          value={registroForm.nombre_completo}
                          onChange={(e) =>
                            setRegistroForm((f) => ({ ...f, nombre_completo: e.target.value }))
                          }
                          sx={accessFieldSx}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <TextField
                            label="Fecha de nacimiento"
                            type="date"
                            value={registroForm.fecha_nacimiento}
                            onChange={(e) =>
                              setRegistroForm((f) => ({ ...f, fecha_nacimiento: e.target.value }))
                            }
                            sx={accessFieldSx}
                            slotProps={{ inputLabel: { shrink: true } }}
                          />
                          <TextField
                            select
                            label="Tipo de sangre"
                            value={registroForm.tipo_sangre}
                            onChange={(e) =>
                              setRegistroForm((f) => ({ ...f, tipo_sangre: e.target.value }))
                            }
                            sx={accessFieldSx}
                          >
                            <MenuItem value="">No sé</MenuItem>
                            {TIPOS_SANGRE.map((t) => (
                              <MenuItem key={t} value={t}>
                                {t}
                              </MenuItem>
                            ))}
                          </TextField>
                        </div>
                        <TextField
                          fullWidth
                          label="Teléfono de contacto"
                          placeholder="04141234567"
                          value={registroForm.telefono}
                          onChange={(e) =>
                            setRegistroForm((f) => ({
                              ...f,
                              telefono: e.target.value.replace(/[^\d+]/g, '').slice(0, 15),
                            }))
                          }
                          sx={accessFieldSx}
                          helperText="Para que la recepción pueda contactarte por tu cita."
                        />
                        <TextField
                          fullWidth
                          type="email"
                          label="Correo electrónico"
                          placeholder="usted@correo.com"
                          value={registroForm.email}
                          onChange={(e) =>
                            setRegistroForm((f) => ({ ...f, email: e.target.value }))
                          }
                          sx={accessFieldSx}
                        />
                        <TextField
                          fullWidth
                          label="Alergias (separadas por coma)"
                          placeholder="Penicilina, mariscos"
                          value={registroForm.alergias}
                          onChange={(e) =>
                            setRegistroForm((f) => ({ ...f, alergias: e.target.value }))
                          }
                          sx={accessFieldSx}
                        />
                        <TextField
                          fullWidth
                          type="password"
                          label="Contraseña"
                          placeholder="Mínimo 6 caracteres"
                          value={registroForm.password}
                          onChange={(e) =>
                            setRegistroForm((f) => ({
                              ...f,
                              password: e.target.value,
                            }))
                          }
                          sx={accessFieldSx}
                          slotProps={{ htmlInput: { autoComplete: 'new-password' } }}
                          helperText="La usarás junto a tu cédula para entrar al portal."
                        />
                        <label className="flex items-start gap-2 text-[11px] text-on-surface-variant">
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-current"
                            checked={registroForm.consentimiento}
                            onChange={(e) =>
                              setRegistroForm((f) => ({
                                ...f,
                                consentimiento: e.target.checked,
                              }))
                            }
                          />
                          <span>
                            Acepto el tratamiento de mis datos personales y de salud para la
                            gestión de mis citas en BnaSalud.
                          </span>
                        </label>
                        <Button
                          type="submit"
                          fullWidth
                          disabled={registrando}
                          variant="contained"
                          sx={{
                            background: 'linear-gradient(135deg, #3B98D4 0%, #1A4B7C 100%)',
                            borderRadius: 2,
                            py: 1.3,
                            fontWeight: 700,
                            textTransform: 'none',
                          }}
                        >
                          {registrando ? 'Creando cuenta...' : 'Crear mi cuenta'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setFlujoAcceso('login');
                            setErrorEntrada('');
                            setInfoEntrada('');
                          }}
                          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-secondary/25 text-sm font-bold text-secondary transition-colors duration-200 hover:border-secondary hover:bg-secondary/5"
                        >
                          <Icon name="login" className="text-base" />
                          ¿Ya tienes cuenta? Inicia sesión
                        </button>
                      </form>
                    )}

                    <div className="mt-5 pt-4 border-t border-outline-variant/40">
                      <p className="text-[11px] text-on-surface-variant text-center">
                        {flujoAcceso === 'login' ? (
                          <>
                            ¿Olvidaste tu contraseña?{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setFlujoAcceso('recuperar');
                                setErrorEntrada('');
                              }}
                              className="font-semibold text-secondary hover:underline"
                            >
                              Recupérala por correo
                            </button>
                          </>
                        ) : null}
                        {(flujoAcceso === 'recuperar' || flujoAcceso === 'reset') && (
                          <span className="block mt-1">
                            ¿Ya tienes cuenta?{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setFlujoAcceso('login');
                                setErrorEntrada('');
                                setInfoEntrada('');
                              }}
                              className="font-semibold text-secondary hover:underline"
                            >
                              Inicia sesión
                            </button>
                            .
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
            }
            </div>
          ) : (
            <>
              {/* ====== DASHBOARD ====== */}
              {seccion === 'dashboard' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-primary">
                        Resumen de salud, {paciente.nombre_completo.split(' ')[0]}
                      </h2>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mt-0.5">
                        C.I. {paciente.tipo_cedula || 'V'}-{paciente.cedula} · {calcularEdad(paciente.fecha_nacimiento) || 'Edad no registrada'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Hero: Próxima cita */}
                    <section className="xl:col-span-1 relative overflow-hidden rounded-3xl text-white p-5 shadow-lg min-h-[150px] flex flex-col justify-between" style={{ background: temaCentro.gradient }}>
                      <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.35) 0 10px, transparent 10px 26px)' }} />
                      <div className="relative flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                            <Icon name="calendar_month" filled className="text-lg" />
                          </div>
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/75">Próxima Cita</p>
                            <p className="text-base font-extrabold leading-tight">
                              {proximaCita ? proximaCita.especialidad : 'Sin citas programadas'}
                            </p>
                          </div>
                        </div>
                        {proximaCita && (
                          <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur text-[10px] font-bold uppercase tracking-wider">
                            {proximaCita.estado}
                          </span>
                        )}
                      </div>

                      {proximaCita ? (
                        <div className="relative grid sm:grid-cols-2 gap-4 mt-4">
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
                        <div className="relative mt-4">
                          <p className="text-sm text-white/85">
                            Reserva tu próxima consulta médica y mantenla al día desde tu portal.
                          </p>
                          <button
                            onClick={abrirSolicitud}
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-primary font-bold text-sm shadow hover:shadow-lg transition-shadow"
                          >
                            <Icon name="event_available" className="text-base" /> Solicitar cita
                          </button>
                        </div>
                      )}
                    </section>

                    {/* Historial de consultas */}
                    <section className="xl:col-span-1 bg-surface-container-low border border-outline-variant rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-base font-bold text-primary">Historial de Consultas</h3>
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                            {historial ? `${historial.total_consultas} consultas registradas` : 'Historial clínico'}
                          </p>
                        </div>
                        <button
                          onClick={() => setSeccion('historial')}
                          className="flex items-center gap-1 text-xs font-bold text-secondary hover:text-secondary-light transition-all btn-hover-effect"
                        >
                          Ver todas <Icon name="arrow_forward" className="text-sm" />
                        </button>
                      </div>

                      {cargando ? (
                        <EsqueletoLista n={4} clase="space-y-4" />
                      ) : !historial || historial.historial.length === 0 ? (
                        <div className="py-10 text-center text-on-surface-variant space-y-3 bg-surface-container-low rounded-3xl border border-outline-variant empty-state">
                          <Icon name="history" className="text-5xl opacity-40" />
                          <div>
                            <p className="text-sm font-bold text-primary">Aún no tienes consultas registradas</p>
                            <p className="text-xs mt-1">Tus registros médicos aparecerán aquí cuando te atiendas</p>
                          </div>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-outline-variant text-left">
                                <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Fecha</th>
                                <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Especialidad</th>
                                <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Diagnóstico (CIE-10)</th>
                                <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Médico</th>
                                <th className="py-1.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historial.historial.slice(0, 5).map((c) => (
                                <tr key={c.consulta_id} className="border-b border-outline-variant/50 hover:bg-surface transition-colors">
                                  <td className="py-2 pr-3 text-on-surface-variant whitespace-nowrap">{formatoFecha(c.fecha)}</td>
                                  <td className="py-2 pr-3 font-semibold text-primary">{c.especialidad}</td>
                                  <td className="py-2 pr-3">
                                    <span className="font-mono text-[11px] font-bold text-secondary">{c.cie10_codigo}</span>
                                    <span className="text-on-surface-variant"> · {c.cie10_descripcion}</span>
                                  </td>
                                  <td className="py-2 pr-3 text-on-surface-variant">{c.medico_nombre}</td>
                                  <td className="py-2 text-right">
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

                  </div>
                </div>
              )}

              {/* ====== CITAS ====== */}
              {seccion === 'citas' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-5 py-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl font-bold text-primary">Mis Citas</h2>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mt-1">
                        Agenda y estado de tus consultas
                      </p>
                    </div>
                    <Button
                      onClick={abrirSolicitud}
                      variant="contained"
                      startIcon={<Icon name="add" className="text-lg" />}
                      sx={{ background: temaCentro.gradient, borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                    >
                      Solicitar cita
                    </Button>
                  </div>

                  {cargando ? (
                    <EsqueletoLista n={3} clase="space-y-3" />
                  ) : citas.length === 0 ? (
                    <EstadoVacio
                      icono="event_busy"
                      titulo="No tienes citas registradas"
                      clase="py-10 text-on-surface-variant space-y-3 bg-surface-container-low rounded-3xl border border-outline-variant"
                    >
                      <p className="text-xs mt-1">Planifica tu salud y solicita una cita hoy</p>
                    </EstadoVacio>
                  ) : (
                    <div className="space-y-3">
                      {citas.map((c) => (
                        <div key={c.id} className="bg-surface-container-low border border-outline-variant rounded-xl p-3 md:p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex items-center gap-4 sm:w-56 shrink-0">
                            <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                              <Icon name="event" filled className="text-xl" />
                            </div>
                            <div>
                              <p className="text-sm font-extrabold text-primary capitalize">
                                {c.estado === 'pendiente'
                                  ? 'Por confirmar'
                                  : formatoFechaLarga(c.fecha_cita)}
                              </p>
                              <p className="font-mono text-[11px] font-bold text-secondary">
                                {c.estado === 'pendiente'
                                  ? 'Recepción asignará la hora'
                                  : horaCorta(c.hora_inicio)}
                              </p>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-primary">{c.especialidad}</p>
                            <p className="text-xs text-on-surface-variant truncate">{c.centro_salud}</p>
                            {c.medico_nombre && (
                              <p className="text-[11px] font-semibold text-secondary truncate mt-0.5">
                                <Icon name="stethoscope" className="text-[11px] text-secondary mr-1 align-[-1px]" />
                                {c.medico_nombre}
                              </p>
                            )}
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
                                onClick={() => {
                                  setCitaACancelar(c);
                                  setMotivoCancelar('');
                                  setCancelarError('');
                                }}
                                startIcon={<Icon name="close" className="text-sm" />}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'var(--color-error)' }}
                                className="btn-hover-effect"
                              >
                                {c.estado === 'pendiente' ? 'Cancelar solicitud' : 'Cancelar cita'}
                              </Button>
                            )}
                            {c.estado === 'confirmada' && (
                              <Button
                                size="small"
                                onClick={() => {
                                  setCitaAPosponer(c);
                                  setNuevaFechaPosponer('');
                                  setNuevaHoraPosponer('');
                                  setMotivoPosponer('');
                                  setPosponerError('');
                                }}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'var(--color-secondary)' }}
                                className="btn-hover-effect"
                              >
                                Posponer cita
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ====== ESTUDIOS (en construcción) ====== */}
              {seccion === 'estudios' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-5 py-4">
                  <EstadoVacio
                    icono="construction"
                    titulo="Estudios en construcción"
                    clase="py-10 text-on-surface-variant space-y-3 bg-surface-container-low rounded-3xl border border-outline-variant"
                  >
                    <p className="text-xs mt-1">Pronto podrás consultar tus órdenes de estudios desde aquí.</p>
                  </EstadoVacio>
                </div>
              )}

              {/* ====== MIS MEDICAMENTOS ====== */}

              {/* ====== NOTIFICACIONES (Fase 5) ====== */}
              {seccion === 'notificaciones' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-5 py-4 space-y-4">
                  <div>
                    <h2 className="font-display text-xl font-bold text-primary">Notificaciones</h2>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mt-1">
                      Historial de correos enviados a tu correo registrado
                    </p>
                  </div>

                  {cargando ? (
                    <EsqueletoLista n={3} clase="space-y-3" />
                  ) : notificaciones.length === 0 ? (
                    <EstadoVacio
                      icono="notifications_off"
                      titulo="No tienes notificaciones"
                      clase="py-10 text-on-surface-variant space-y-3 bg-surface-container-low rounded-3xl border border-outline-variant"
                    >
                      <p className="text-xs mt-1">Los avisos de recetas y recordatorios de citas aparecerán aquí.</p>
                    </EstadoVacio>
                  ) : (
                    <div className="space-y-3">
                      {notificaciones.map((n) => {
                        const conf = TIPOS_NOTIFICACION[n.tipo] || {
                          icono: 'notifications',
                          etiqueta: n.tipo,
                        };
                        return (
                          <div
                            key={n.id}
                            className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 flex items-start gap-4"
                          >
                            <div className="w-9 h-9 rounded-xl bg-doc-soft text-doc flex items-center justify-center shrink-0">
                              <Icon name={conf.icono} className="text-xl" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 justify-between mb-1">
                                <p className="text-sm font-bold text-primary leading-snug">{n.asunto}</p>
                                <EtiquetaEstado estado={n.estado} mapa={ESTADOS_NOTIFICACION} />
                              </div>
                              <p className="text-[11px] text-on-surface-variant flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-semibold uppercase tracking-wide">{conf.etiqueta}</span>
                                <span>·</span>
                                <span className="font-mono">{n.destinatario || 'sin correo'}</span>
                                {n.enviado_en && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono">
                                      {formatoFecha(n.enviado_en)} {String(n.enviado_en).slice(11, 16)}
                                    </span>
                                  </>
                                )}
                              </p>
                              {n.detalle && (
                                <p className="mt-1.5 text-xs text-on-surface-variant bg-surface rounded-lg border border-outline-variant/40 px-3 py-2">
                                  {n.detalle}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ====== HISTORIAL MÉDICO (en construcción) ====== */}
              {seccion === 'historial' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-5 py-4">
                  <EstadoVacio
                    icono="construction"
                    titulo="Historial médico en construcción"
                    clase="py-10 text-on-surface-variant space-y-3 bg-surface-container-low rounded-3xl border border-outline-variant"
                  >
                    <p className="text-xs mt-1">Pronto podrás consultar tu historial clínico desde aquí.</p>
                  </EstadoVacio>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Diálogo: solicitud de cita (centro + especialidad) */}
      <Dialog
        open={solicitudAbierta}
        onClose={() => !enviandoSolicitud && setSolicitudAbierta(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
              <Icon name="calendar_month" filled className="text-base" />
            </span>
            <span className="font-display text-xl font-bold text-primary">Solicitar cita</span>
          </div>
          <IconButton
            onClick={() => setSolicitudAbierta(false)}
            disabled={enviandoSolicitud}
            aria-label="Cerrar"
          >
            <Icon name="close" />
          </IconButton>
        </DialogTitle>
        <form onSubmit={enviarSolicitud}>
          <DialogContent dividers>
            <div className="space-y-6">
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Elige el centro de salud y la especialidad. No necesitas elegir
                fecha: la recepción del centro revisará tu solicitud y te asignará
                el médico, la fecha y la hora según su disponibilidad.
              </p>

              {solicitudError && (
                <div className="p-3 bg-error-container rounded-xl border border-error/20 flex items-center gap-2" role="alert">
                  <Icon name="error" className="text-error text-lg" />
                  <p className="text-xs font-semibold text-error">{solicitudError}</p>
                </div>
              )}

              <div className="space-y-3">
                <TextField
                  select
                  fullWidth
                  label="Centro de salud"
                  value={solicitudForm.centro_id}
                  onChange={(e) =>
                    setSolicitudForm((f) => ({
                      ...f,
                      centro_id: e.target.value,
                      especialidad_id: '',
                    }))
                  }
                  sx={fieldSx}
                >
                {centrosSolicitud.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.nombre}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                fullWidth
                label="Especialidad"
                value={solicitudForm.especialidad_id}
                onChange={(e) =>
                  setSolicitudForm((f) => ({ ...f, especialidad_id: e.target.value }))
                }
                disabled={!solicitudForm.centro_id || cargandoEspecialidades}
                sx={{ ...fieldSx, mt: 2.5 }}
                helperText={
                  solicitudForm.centro_id && !cargandoEspecialidades && especialidadesSolicitud.length === 0
                    ? 'Este centro no tiene especialidades con médicos asignados.'
                    : ' '
                }
              >
                {especialidadesSolicitud.map((esp) => (
                  <MenuItem key={esp.id} value={esp.id}>
                    {esp.nombre}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Motivo de la consulta (opcional)"
                placeholder="Describe brevemente qué te ocurre"
                value={solicitudForm.motivo}
                onChange={(e) =>
                  setSolicitudForm((f) => ({ ...f, motivo: e.target.value }))
                }
                sx={fieldSx}
              />
              </div>
            </div>
          </DialogContent>
          <DialogActions className="p-4">
            <Button
              onClick={() => setSolicitudAbierta(false)}
              disabled={enviandoSolicitud}
              sx={{ textTransform: 'none', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={enviandoSolicitud}
              startIcon={
                enviandoSolicitud ? (
                  <Icon name="sync" className="text-lg animate-spin" />
                ) : (
                  <Icon name="send" className="text-lg" />
                )
              }
              sx={{ background: temaCentro.gradient, borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
            >
              {enviandoSolicitud ? 'Enviando...' : 'Enviar solicitud'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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
                  <img src={centroCITAB.logo} alt="Instituto de Salud" className="h-8 w-auto max-w-[168px] rounded-lg object-contain p-1 bg-white border border-outline-variant" />
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
                  ['Medicinas e insumos aplicados', recetaAbierta.tratamiento],
                  ['Indicaciones médicas', recetaAbierta.recomendaciones],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-1">{k}</p>
                      <p className="text-primary font-medium">{v}</p>
                    </div>
                  ))}
                {recetaAbierta.insumos && recetaAbierta.insumos.length > 0 && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">
                      Detalle de aplicación
                    </p>
                    <div className="space-y-2">
                      {recetaAbierta.insumos.map((i, idx) => (
                        <div key={idx} className="p-3 bg-surface-container-low rounded-xl flex items-start gap-2.5">
                          <Icon name="vaccines" className="text-base text-doc mt-0.5" />
                          <div>
                            <p className="font-semibold text-primary">
                              {i.nombre}
                              <span className="font-mono text-[10px] uppercase tracking-widest text-secondary ml-1.5">
                                {i.tipo}
                              </span>
                            </p>
                            {(i.cantidad || i.unidad) && (
                              <p className="text-xs text-on-surface-variant">
                                Cantidad: {i.cantidad || '—'}
                                {i.unidad ? ` ${i.unidad}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

      {/* ====== DIÁLOGO POSPONER CITA ====== */}
      <Dialog open={!!citaAPosponer} onClose={() => setCitaAPosponer(null)} maxWidth="xs" fullWidth>
        {citaAPosponer && (
          <form onSubmit={handlePosponerSubmit}>
            <DialogTitle className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Icon name="update" className="text-secondary text-2xl" />
                <div>
                  <h3 className="text-base font-bold text-primary">Posponer Cita</h3>
                  <p className="text-xs text-on-surface-variant font-normal">
                    {citaAPosponer.especialidad} · {citaAPosponer.centro_salud}
                  </p>
                  <p className="text-[11px] font-semibold text-secondary mt-0.5">
                    <Icon name="stethoscope" className="text-[11px] mr-1 align-[-1px]" />
                    {citaAPosponer.medico_nombre || 'Asignación automática de médico'}
                  </p>
                </div>
              </div>
              <IconButton onClick={() => setCitaAPosponer(null)} size="small">
                <Icon name="close" />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers className="space-y-4">
              {posponerError && (
                <Alert severity="error" className="mb-2">
                  {posponerError}
                </Alert>
              )}
              {citaAPosponer.medico_nombre && (
                <Alert severity="info" variant="outlined" sx={{ fontSize: '0.8rem' }}>
                  Solo puedes posponer dentro del horario de consulta de{' '}
                  <strong>{citaAPosponer.medico_nombre}</strong>. Si la hora no está
                  disponible, el sistema te lo indicará.
                </Alert>
              )}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  Nueva Fecha Solicitada
                </label>
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  value={nuevaFechaPosponer}
                  onChange={(e) => setNuevaFechaPosponer(e.target.value)}
                  slotProps={{ htmlInput: { min: new Date().toISOString().split('T')[0] } }}
                  required
                  sx={fieldSx}
                />
              </div>
              {nuevaFechaPosponer && (
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    Nueva Hora Solicitada
                  </label>
                  <TextField
                    type="time"
                    fullWidth
                    size="small"
                    value={nuevaHoraPosponer}
                    onChange={(e) => setNuevaHoraPosponer(e.target.value)}
                    required
                    sx={fieldSx}
                  />
                  <p className="text-[11px] text-on-surface-variant mt-1">
                    El sistema verificará que esté dentro del horario de consulta del médico.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  Motivo de la Postergación (Opcional)
                </label>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  placeholder="Ej: Compromiso laboral imprevisto"
                  value={motivoPosponer}
                  onChange={(e) => setMotivoPosponer(e.target.value)}
                  sx={fieldSx}
                />
              </div>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button
                onClick={() => setCitaAPosponer(null)}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'var(--color-secondary)' }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={posponiendo}
                startIcon={posponiendo ? <Icon name="sync" className="text-lg animate-spin" /> : <Icon name="schedule" className="text-lg" />}
                sx={{ background: temaCentro.gradient, borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              >
                {posponiendo ? 'Solicitando...' : 'Confirmar Posposición'}
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* ====== DIÁLOGO CANCELAR CITA ====== */}
      <Dialog open={!!citaACancelar} onClose={() => setCitaACancelar(null)} maxWidth="xs" fullWidth>
        {citaACancelar && (
          <form onSubmit={handleCancelarCita}>
            <DialogTitle className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Icon name="event_busy" className="text-error text-2xl" />
                <div>
                  <h3 className="text-base font-bold text-primary">Cancelar Cita</h3>
                  <p className="text-xs text-on-surface-variant font-normal">
                    {citaACancelar.especialidad} · {citaACancelar.centro_salud}
                  </p>
                </div>
              </div>
              <IconButton onClick={() => setCitaACancelar(null)} size="small">
                <Icon name="close" />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers className="space-y-3">
              {cancelarError && (
                <Alert severity="error" className="mb-2">
                  {cancelarError}
                </Alert>
              )}
              <Alert severity="warning" variant="outlined" sx={{ fontSize: '0.82rem' }}>
                Esta acción no se puede deshacer.{' '}
                {citaACancelar.fecha_cita ? (
                  <>
                    Se cancelará tu cita del{' '}
                    <strong>{formatoFechaLarga(citaACancelar.fecha_cita)}</strong> a las{' '}
                    <strong>{horaCorta(citaACancelar.hora_inicio)}</strong> y tu cupo se liberará.
                  </>
                ) : (
                  <>
                    Se cancelará tu solicitud, que sigue en espera de que recepción le asigne
                    fecha y hora.
                  </>
                )}
              </Alert>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  Motivo de la Cancelación (Opcional)
                </label>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  placeholder="Ej: No podré asistir ese día"
                  value={motivoCancelar}
                  onChange={(e) => setMotivoCancelar(e.target.value)}
                  sx={fieldSx}
                />
              </div>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button
                onClick={() => setCitaACancelar(null)}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}
              >
                Volver
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={cancelando}
                startIcon={cancelando ? <Icon name="sync" className="text-lg animate-spin" /> : <Icon name="close" className="text-lg" />}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', bgcolor: 'var(--color-error)', '&:hover': { bgcolor: 'var(--color-error-dark, var(--color-error))' } }}
                className="btn-hover-effect"
              >
                {cancelando ? 'Cancelando...' : 'Sí, cancelar cita'}
              </Button>
            </DialogActions>
          </form>
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

      <Snackbar
        open={!!avisoError}
        autoHideDuration={5000}
        onClose={() => setAvisoError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setAvisoError('')} severity="error" variant="filled">
          {avisoError}
        </Alert>
      </Snackbar>
    </div>
  );
}

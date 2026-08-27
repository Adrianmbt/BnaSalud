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
import HistorialLinea from '../components/HistorialLinea';
import { API, parseCedula, cerrarSesion, marcarUltimaSesion } from '../api';
import { getCentroTheme } from '../centroTheme';
import CitaModal from '../components/CitaModal';

const SECCIONES = [
  { id: 'dashboard', etiqueta: 'Dashboard', detalle: 'Resumen de salud', icono: 'grid_view' },
  { id: 'citas', etiqueta: 'Citas', detalle: 'Agenda y confirmación', icono: 'calendar_month' },
  { id: 'historial', etiqueta: 'Historial', detalle: 'Consultas y evolución', icono: 'timeline' },
  { id: 'estudios', etiqueta: 'Estudios', detalle: 'Órdenes y resultados', icono: 'monitor_heart' },
  { id: 'medicamentos', etiqueta: 'Mis Medicamentos', detalle: 'Recetas y farmacia', icono: 'medication' },
  { id: 'notificaciones', etiqueta: 'Notificaciones', detalle: 'Correos del sistema', icono: 'notifications' },
  { id: 'misalud', etiqueta: 'Mi Salud', detalle: 'Perfil y datos clínicos', icono: 'favorite' },
];

const VISTAS_HISTORIAL = [
  { id: 'general', etiqueta: 'Historial General', detalle: 'Todas tus consultas', icono: 'timeline' },
  { id: 'actual', etiqueta: 'Actual', detalle: 'Cita y tratamiento vigente', icono: 'schedule' },
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

const ESTADOS_RECETA = {
  PENDIENTE: { tono: 'amber', etiqueta: 'Pendiente en farmacia' },
  DESPACHADA: { tono: 'info', etiqueta: 'Despachada · lista para retirar' },
  ENTREGADA: { tono: 'secondary', etiqueta: 'Entregada · confirma tu recepción' },
  RECIBIDA: { tono: 'success', etiqueta: 'Recibida · cerrada' },
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
  const [pinEntrada, setPinEntrada] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [errorEntrada, setErrorEntrada] = useState('');
  const [infoEntrada, setInfoEntrada] = useState('');
  const [flujoAcceso, setFlujoAcceso] = useState('login'); // login | recuperar | reset
  const [recuperarForm, setRecuperarForm] = useState({ cedula: '', email: '', codigo: '', pinNuevo: '' });
  const [recuperando, setRecuperando] = useState(false);
  const [codigoDemo, setCodigoDemo] = useState('');
  const [modoDemo, setModoDemo] = useState(false);
  const [paciente, setPaciente] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [citas, setCitas] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [medico, setMedico] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [confirmandoReceta, setConfirmandoReceta] = useState(null);
  const [avisoError, setAvisoError] = useState('');

  const [seccion, setSeccion] = useState('dashboard');
  const [historialVista, setHistorialVista] = useState('general');
  const [navAbierta, setNavAbierta] = useState(false);
  const [citaModal, setCitaModal] = useState(null);
  const [aviso, setAviso] = useState('');
  const [recetaAbierta, setRecetaAbierta] = useState(null);

  const [perfilForm, setPerfilForm] = useState(null);
  const [perfilGuardando, setPerfilGuardando] = useState(false);
  const [perfilError, setPerfilError] = useState('');
  const [perfilAbierto, setPerfilAbierto] = useState(false);

  const [citaAPosponer, setCitaAPosponer] = useState(null);
  const [nuevaFechaPosponer, setNuevaFechaPosponer] = useState('');
  const [nuevaHoraPosponer, setNuevaHoraPosponer] = useState('');
  const [motivoPosponer, setMotivoPosponer] = useState('');
  const [posponiendo, setPosponiendo] = useState(false);
  const [posponerError, setPosponerError] = useState('');
  const [slotsPosponer, setSlotsPosponer] = useState([]);
  const [consultandoSlotsPosponer, setConsultandoSlotsPosponer] = useState(false);
  const [slotMsgPosponer, setSlotMsgPosponer] = useState('');

  useEffect(() => {
    if (!citaAPosponer || !nuevaFechaPosponer) {
      setSlotsPosponer([]);
      setSlotMsgPosponer('');
      return;
    }
    let activo = true;
    setConsultandoSlotsPosponer(true);
    setNuevaHoraPosponer('');
    setSlotMsgPosponer('');
    API.getDisponibilidad({
      centro_id: citaAPosponer.centro_id || 2,
      especialidad_id: citaAPosponer.especialidad_id,
      medico_id: citaAPosponer.medico_id,
      fecha: nuevaFechaPosponer,
    })
      .then((data) => {
        if (!activo) return;
        if (data.slots && data.slots.length > 0) {
          setSlotsPosponer(data.slots);
          setSlotMsgPosponer('');
        } else {
          setSlotsPosponer([]);
          setSlotMsgPosponer(data.mensaje || 'No hay horarios disponibles para esta fecha con este médico.');
        }
      })
      .catch(() => {
        if (activo) {
          setSlotsPosponer([]);
          setSlotMsgPosponer('Error al consultar horarios disponibles.');
        }
      })
      .finally(() => {
        if (activo) setConsultandoSlotsPosponer(false);
      });
    return () => {
      activo = false;
    };
  }, [citaAPosponer, nuevaFechaPosponer]);

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
      setAviso('Cita reprogramada exitosamente. Se envió la notificación de confirmación por WhatsApp.');
    } catch (err) {
      setPosponerError(err.message || 'No se pudo reprogramar la cita.');
    } finally {
      setPosponiendo(false);
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

  const entrar = useCallback(async (cedula, pin) => {
    setEntrando(true);
    setErrorEntrada('');
    setInfoEntrada('');
    const ident = parseCedula(cedula);
    const cedulaLimpia = ident.cedula || cedula.replace(/\D/g, '');
    try {
      const res = await API.loginPaciente(cedulaLimpia, pin);
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
      setErrorEntrada(err.message || 'No se pudo iniciar sesión. Verifique su cédula y su PIN.');
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
    setPinEntrada('');
    setErrorEntrada('');
    setInfoEntrada('');
    setFlujoAcceso('login');
    setSeccion('dashboard');
  }, []);

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
      const res = await API.recuperarPin(ident.cedula, recuperarForm.email);
      setInfoEntrada(res.mensaje || 'Se envió el código a su correo.');
      setRecuperarForm((f) => ({ ...f, cedula: ident.cedula }));
      setFlujoAcceso('reset');
    } catch (err) {
      setErrorEntrada(err.message || 'No se pudo generar el código de recuperación.');
    } finally {
      setRecuperando(false);
    }
  };

  const restablecerPin = async (e) => {
    e.preventDefault();
    setRecuperando(true);
    setErrorEntrada('');
    setInfoEntrada('');
    const pinNuevo = String(recuperarForm.pinNuevo || '');
    if (pinNuevo.length < 4) {
      setErrorEntrada('El PIN nuevo debe tener al menos 4 dígitos.');
      setRecuperando(false);
      return;
    }
    try {
      await API.resetPin(recuperarForm.cedula, recuperarForm.codigo, pinNuevo);
      setFlujoAcceso('login');
      setRecuperarForm({ cedula: '', email: '', codigo: '', pinNuevo: '' });
      setInfoEntrada('¡PIN restablecido! Ingrese con su cédula y el nuevo PIN.');
    } catch (err) {
      setErrorEntrada(err.message || 'No se pudo restablecer el PIN.');
    } finally {
      setRecuperando(false);
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
        API.ordenesPaciente(paciente.id).catch(sinLista),
        API.medicoTratante(cedula).catch(sinDatos),
        API.recetasPaciente(cedula).catch(sinLista),
        API.notificacionesPaciente(cedula).catch(sinLista),
      ];
    })();
    try {
      const [h, c, o, m, r, n] = await Promise.all(promesas);
      setHistorial(h && h.historial ? h : null);
      setCitas(Array.isArray(c) ? c : []);
      setOrdenes(Array.isArray(o) ? o : []);
      setMedico(m && m.nombre ? m : null);
      setRecetas(Array.isArray(r) ? r : []);
      setNotificaciones(Array.isArray(n) ? n : []);
    } catch (err) {
      if (err && err.status === 401) {
        cerrarSesionPaciente();
        setAvisoError('Su sesión ha expirado. Por favor ingrese de nuevo.');
      } else {
        setHistorial(null);
        setCitas([]);
        setOrdenes([]);
        setMedico(null);
        setRecetas([]);
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
        .filter((c) => c.estado !== 'cancelada' && new Date(`${String(c.fecha_cita).slice(0, 10)}T00:00:00`) >= hoy)
        .sort((a, b) => new Date(a.fecha_cita) - new Date(b.fecha_cita))[0] || null
    );
  }, [citas]);

  const ultimaConsulta = useMemo(
    () => (historial && historial.historial && historial.historial.length > 0 ? historial.historial[0] : null),
    [historial]
  );

  const medicoTratante = useMemo(() => {
    if (medico) return medico;
    if (ultimaConsulta && ultimaConsulta.medico_nombre) {
      return { nombre: ultimaConsulta.medico_nombre, especialidad: ultimaConsulta.especialidad, tipo: 'seguimiento' };
    }
    return null;
  }, [medico, ultimaConsulta]);

  const evolucionTratamientos = useMemo(() => {
    const h = (historial && historial.historial) || [];
    return [...h]
      .filter((c) => c.tratamiento)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }, [historial]);

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

  async function confirmarRecepcion(rx) {
    if (!rx) return;
    setConfirmandoReceta(rx.id);
    try {
      try {
        await API.recibirReceta(rx.id);
      } catch {
        await DEMO.recibirReceta(rx.id, String(paciente.cedula || '').replace(/\D/g, ''));
      }
      setRecetas((prev) =>
        prev.map((r) =>
          r.id === rx.id
            ? { ...r, estado: 'RECIBIDA', recibida_at: new Date().toISOString() }
            : r
        )
      );
      setAviso('¡Gracias! Confirmamos que recibiste tus medicamentos.');
    } catch (err) {
      setAvisoError(err.message || 'No se pudo confirmar la recepción.');
    } finally {
      setConfirmandoReceta(null);
    }
  }

  const centroCITAB = {
    id: 2,
    nombre: 'Centro Integral de Salud CITAB',
    subtitulo: 'Centro de Especialidades Médicas Municipal',
    tipo: 'Especializado',
    parroquia: 'El Carmen',
    direccion: 'Av. Caracas, Sector Tronconal III, Barcelona',
    horario: 'Lunes a Viernes 7:00 AM - 5:30 PM',
    servicios: ['Consulta Especializada', 'Laboratorio', 'Imágenes', 'Farmacia'],
    logo: '/maquetas/citab_logo.png',
  };

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
    <div className="h-dvh overflow-hidden flex flex-col bg-surface text-primary font-ui" style={varsCentro}>
      <header className="relative z-40 shrink-0 bg-surface/90 backdrop-blur-md">
        <div className="flex items-center gap-4 px-4 md:px-6 h-16 border-b border-outline-variant">
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
              {modoDemo && (
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-amber/10 text-amber border border-amber/30 hidden sm:inline">
                  Demo
                </span>
              )}
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
                onClick={cerrarSesionPaciente}
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

      <div className="flex flex-1 min-h-0 overflow-hidden">
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
                    {infoEntrada && (
                      <div className="mt-5 p-3 bg-doc-soft rounded-xl border border-doc/20 flex items-start gap-2" role="status">
                        <Icon name="info" className="text-doc text-lg shrink-0" />
                        <p className="text-xs font-semibold text-doc-deep">{infoEntrada}</p>
                      </div>
                    )}

                    {flujoAcceso === 'login' && (
                      <form
                        className="mt-5 space-y-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const ident = parseCedula(cedulaEntrada);
                          if (!ident.cedula) {
                            setErrorEntrada('Ingrese su cédula.');
                            return;
                          }
                          if (String(pinEntrada).length < 4) {
                            setErrorEntrada('Ingrese su PIN de 4 dígitos.');
                            return;
                          }
                          entrar(ident.cedula, pinEntrada);
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
                          sx={fieldSx}
                          autoFocus
                        />
                        <TextField
                          fullWidth
                          type="password"
                          label="PIN de acceso"
                          placeholder="4 dígitos"
                          value={pinEntrada}
                          onChange={(e) => {
                            setPinEntrada(e.target.value.replace(/\D/g, '').slice(0, 8));
                            setErrorEntrada('');
                          }}
                          sx={fieldSx}
                          slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'current-password' } }}
                          helperText="Tu PIN fue creado al registrarte en tu primera cita."
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
                    )}

                    {flujoAcceso === 'recuperar' && (
                      <form
                        className="mt-5 space-y-4"
                        onSubmit={solicitarRecuperacion}
                      >
                        <div className="flex items-center gap-2">
                          <Icon name="lock_reset" className="text-doc" />
                          <p className="text-sm font-bold text-primary">Recuperar mi PIN</p>
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
                          sx={fieldSx}
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
                          sx={fieldSx}
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
                      <form className="mt-5 space-y-4" onSubmit={restablecerPin}>
                        <div className="flex items-center gap-2">
                          <Icon name="password" className="text-doc" />
                          <p className="text-sm font-bold text-primary">Crear un PIN nuevo</p>
                        </div>
                        <p className="text-xs text-on-surface-variant -mt-2">
                          Ingrese el código recibido y elija su nuevo PIN de 4 dígitos.
                        </p>
                        <TextField
                          fullWidth
                          label="Cédula"
                          value={recuperarForm.cedula}
                          disabled
                          sx={fieldSx}
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
                          sx={fieldSx}
                          autoFocus
                        />
                        <TextField
                          fullWidth
                          type="password"
                          label="PIN nuevo (4 dígitos)"
                          slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 8 } }}
                          value={recuperarForm.pinNuevo}
                          onChange={(e) =>
                            setRecuperarForm((f) => ({
                              ...f,
                              pinNuevo: e.target.value.replace(/\D/g, '').slice(0, 8),
                            }))
                          }
                          sx={fieldSx}
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
                          {recuperando ? 'Guardando...' : 'Restablecer mi PIN'}
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

                    <div className="mt-5 pt-4 border-t border-outline-variant/40">
                      <p className="text-[11px] text-on-surface-variant text-center">
                        {flujoAcceso === 'login' ? (
                          <>
                            ¿Olvidaste tu PIN?{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setFlujoAcceso('recuperar');
                                setErrorEntrada('');
                              }}
                              className="font-semibold text-secondary hover:underline"
                            >
                              Recupéralo por correo
                            </button>
                          </>
                        ) : null}
                        {flujoAcceso === 'login' && (
                          <span className="block mt-1">
                            ¿No tienes cuenta?{' '}
                            <span className="font-semibold text-secondary">
                              Reserva tu cita primero
                            </span>{' '}
                            y el sistema te registra con tu PIN.
                          </span>
                        )}
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
                        onClick={() => {
                          setSeccion('historial');
                          setHistorialVista('actual');
                        }}
                        className="w-full flex items-center gap-4 p-5 bg-surface-container-low border border-outline-variant rounded-3xl text-left hover:border-secondary/50 hover:shadow-md transition-all group"
                      >
                        <span className="w-11 h-11 rounded-xl bg-doc-soft text-doc flex items-center justify-center group-hover:bg-doc group-hover:text-paper transition-colors">
                          <Icon name="schedule" filled className="text-xl" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-primary">Cita y Tratamiento Actual</span>
                          <span className="block text-[11px] text-on-surface-variant mt-0.5">
                            {proximaCita
                              ? `${formatoFecha(proximaCita.fecha_cita)} · ${horaCorta(proximaCita.hora_inicio)}`
                              : 'Tu próxima cita y tratamiento vigente'}
                          </span>
                        </span>
                        <Icon name="chevron_right" className="ml-auto text-on-surface-variant" />
                      </button>

                      <button
                        onClick={() => setSeccion('historial')}
                        className="w-full flex items-center gap-4 p-5 bg-surface-container-low border border-outline-variant rounded-3xl text-left hover:border-secondary/50 hover:shadow-md transition-all group"
                      >
                        <span className="w-11 h-11 rounded-xl bg-fx-soft text-fx flex items-center justify-center group-hover:bg-fx group-hover:text-paper transition-colors">
                          <Icon name="timeline" filled className="text-xl" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-primary">Historial Médico</span>
                          <span className="block text-[11px] text-on-surface-variant mt-0.5">
                            {historial ? `${historial.total_consultas} consultas · evolución de tratamientos` : 'Todas tus consultas'}
                          </span>
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

                      <button
                        onClick={() => setSeccion('medicamentos')}
                        className="w-full flex items-center gap-4 p-5 bg-surface-container-low border border-outline-variant rounded-3xl text-left hover:border-secondary/50 hover:shadow-md transition-all group"
                      >
                        <span className="w-11 h-11 rounded-xl bg-fx-soft text-fx flex items-center justify-center group-hover:bg-fx group-hover:text-paper transition-colors">
                          <Icon name="medication" filled className="text-xl" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-primary">Mis Medicamentos</span>
                          <span className="block text-[11px] text-on-surface-variant mt-0.5">
                            {recetas.some((r) => r.estado === 'ENTREGADA')
                              ? 'Tienes una receta por confirmar'
                              : 'Recetas y estado en farmacia'}
                          </span>
                        </span>
                        {recetas.some((r) => r.estado === 'ENTREGADA') && (
                          <Badge color="error" variant="dot" sx={{ mr: 1 }} />
                        )}
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
                          onClick={() => setSeccion('historial')}
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
                                onClick={() => {
                                  setCitaAPosponer(c);
                                  setNuevaFechaPosponer('');
                                  setNuevaHoraPosponer('');
                                  setMotivoPosponer('');
                                  setPosponerError('');
                                }}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'var(--color-secondary)' }}
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

              {/* ====== MIS MEDICAMENTOS ====== */}
              {seccion === 'medicamentos' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-6 py-5 space-y-5">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-primary">Mis Medicamentos</h2>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mt-1">
                      Recetas emitidas y su estado en la farmacia
                    </p>
                  </div>

                  {cargando ? (
                    <div className="py-10 text-center text-on-surface-variant text-sm animate-pulse">
                      Cargando recetas...
                    </div>
                  ) : recetas.length === 0 ? (
                    <div className="py-16 text-center text-on-surface-variant space-y-2 bg-surface-container-low rounded-3xl border border-outline-variant">
                      <Icon name="medication" className="text-6xl opacity-40" />
                      <p className="text-sm font-medium">No tienes recetas registradas.</p>
                      <p className="text-xs">Cuando tu médico emita una receta, aparecerá aquí con su estado.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recetas.map((rx) => {
                        const estado = rx.estado || 'PENDIENTE';
                        const porConfirmar = estado === 'ENTREGADA';
                        return (
                          <div key={rx.id} className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
                            <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-fx-soft text-fx flex items-center justify-center">
                                  <Icon name="prescriptions" filled className="text-xl" />
                                </div>
                                <div>
                                  <p className="font-mono text-xs font-bold text-primary tracking-wide">
                                    {rx.codigo_receta}
                                  </p>
                                  <p className="text-[11px] text-on-surface-variant">
                                    {rx.medico} · {formatoFecha(rx.fecha_emision)}
                                  </p>
                                </div>
                              </div>
                              <EtiquetaEstado estado={estado} mapa={ESTADOS_RECETA} />
                            </div>

                            <div className="space-y-2">
                              {(rx.detalles || []).map((d, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2.5 bg-surface rounded-xl border border-outline-variant/40 p-3"
                                >
                                  <Icon name="medication" className="text-base text-fx mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-primary">{d.nombre_medicamento}</p>
                                    {d.posologia && <p className="text-xs text-on-surface-variant">{d.posologia}</p>}
                                  </div>
                                  <span className="font-mono text-[10px] text-on-surface-variant shrink-0">
                                    {d.cantidad_despachada > 0
                                      ? `${d.cantidad_despachada} entregadas`
                                      : `${d.cantidad_prescrita} prescritas`}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {porConfirmar && (
                              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-doc-soft border border-doc/25 rounded-xl px-4 py-3">
                                <p className="text-xs font-semibold text-doc-deep flex items-center gap-1.5">
                                  <Icon name="handshake" className="text-base" />
                                  La farmacia ya te entregó estos medicamentos. Confirma la recepción
                                  para cerrar la receta.
                                </p>
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={confirmandoReceta === rx.id}
                                  startIcon={
                                    confirmandoReceta === rx.id ? (
                                      <Icon name="sync" className="text-base animate-spin" />
                                    ) : (
                                      <Icon name="verified" className="text-base" />
                                    )
                                  }
                                  onClick={() => confirmarRecepcion(rx)}
                                  sx={{
                                    background: 'var(--color-doc)',
                                    borderRadius: 2,
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    '&:hover': { backgroundColor: 'var(--color-doc-deep)' },
                                  }}
                                >
                                  {confirmandoReceta === rx.id
                                    ? 'Confirmando...'
                                    : 'Confirmo que recibí los medicamentos'}
                                </Button>
                              </div>
                            )}

                            {(estado === 'ENTREGADA' || estado === 'RECIBIDA') && rx.entregada_at && (
                              <p className="mt-3 font-mono text-[10px] text-on-surface-variant flex items-center gap-1.5 flex-wrap">
                                <Icon name="local_shipping" className="text-sm text-doc" />
                                Entregada por {rx.entregada_por || 'farmacia'} ·{' '}
                                {formatoFecha(rx.entregada_at)}
                                {estado === 'RECIBIDA' && rx.recibida_at && (
                                  <>
                                    <span className="mx-1">·</span>
                                    <Icon name="verified" className="text-sm text-success" />
                                    Confirmada · {formatoFecha(rx.recibida_at)}
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ====== NOTIFICACIONES (Fase 5) ====== */}
              {seccion === 'notificaciones' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-6 py-5 space-y-5">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-primary">Notificaciones</h2>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mt-1">
                      Historial de correos enviados a tu correo registrado
                    </p>
                  </div>

                  {cargando ? (
                    <div className="py-10 text-center text-on-surface-variant text-sm animate-pulse">
                      Cargando notificaciones...
                    </div>
                  ) : notificaciones.length === 0 ? (
                    <div className="py-16 text-center text-on-surface-variant space-y-2 bg-surface-container-low rounded-3xl border border-outline-variant">
                      <Icon name="notifications_off" className="text-6xl opacity-40" />
                      <p className="text-sm font-medium">No tienes notificaciones todavía.</p>
                      <p className="text-xs">
                        Los avisos de recetas y recordatorios de citas aparecerán aquí.
                      </p>
                    </div>
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
                            <div className="w-10 h-10 rounded-xl bg-doc-soft text-doc flex items-center justify-center shrink-0">
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

              {/* ====== HISTORIAL MÉDICO ====== */}
              {seccion === 'historial' && (
                <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-6 py-5 space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-primary">Historial Médico</h2>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mt-1">
                        {historial ? `${historial.total_consultas} consultas registradas · Cédula ${paciente.tipo_cedula || 'V'}-${paciente.cedula}` : 'Consultas y atenciones'}
                      </p>
                    </div>
                    <div className="flex bg-surface-container rounded-full p-1" role="tablist" aria-label="Vista del historial">
                      {VISTAS_HISTORIAL.map((v) => {
                        const activado = historialVista === v.id;
                        return (
                          <button
                            key={v.id}
                            role="tab"
                            aria-selected={activado}
                            onClick={() => setHistorialVista(v.id)}
                            className={`flex-1 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                              activado ? 'bg-surface text-secondary shadow-sm' : 'text-on-surface-variant hover:text-secondary'
                            }`}
                          >
                            <Icon name={v.icono} className="text-sm" />
                            {v.etiqueta}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {historialVista === 'general' ? (
                    <>
                      {/* Resumen del expediente */}
                      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { etiqueta: 'Consultas registradas', valor: historial ? historial.total_consultas : '—', icono: 'clinical_notes' },
                          { etiqueta: 'Médicos que te han atendido', valor: historial ? new Set(historial.historial.map((c) => c.medico_nombre).filter(Boolean)).size : '—', icono: 'stethoscope' },
                          { etiqueta: 'Tratamientos registrados', valor: historial ? historial.historial.filter((c) => c.tratamiento).length : '—', icono: 'medication' },
                          { etiqueta: 'Estudios solicitados', valor: historial ? historial.historial.reduce((a, c) => a + ((c.estudios || []).length || 0), 0) : '—', icono: 'monitor_heart' },
                        ].map((s) => (
                          <div key={s.etiqueta} className="bg-surface-container-low border border-outline-variant rounded-2xl p-4">
                            <span className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center mb-2">
                              <Icon name={s.icono} filled className="text-base" />
                            </span>
                            <p className="font-display text-2xl font-bold text-primary leading-none">{s.valor}</p>
                            <p className="text-[11px] text-on-surface-variant mt-1">{s.etiqueta}</p>
                          </div>
                        ))}
                      </section>

                      {cargando ? (
                        <div className="py-10 text-center text-on-surface-variant text-sm animate-pulse">
                          Cargando historial...
                        </div>
                      ) : (
                        <section className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6">
                          <div className="flex items-center justify-between gap-3 mb-5">
                            <div>
                              <h3 className="font-display text-lg font-bold text-primary">Todas tus consultas</h3>
                              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                                De la más reciente a la más antigua · la primera es tu estado actual
                              </p>
                            </div>
                          </div>
                          <HistorialLinea consultas={(historial && historial.historial) || []} marcarActual />
                        </section>
                      )}
                    </>
                  ) : (
                    <>
                      {/* ===== VISTA ACTUAL: cita + tratamiento vigente + médico tratante ===== */}
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                        {/* Cita médica actual */}
                        <section className="xl:col-span-2 relative overflow-hidden rounded-3xl text-white p-6 md:p-7 shadow-lg min-h-[220px] flex flex-col justify-between" style={{ background: temaCentro.gradient }}>
                          <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.35) 0 10px, transparent 10px 26px)' }} />
                          <div className="relative flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                                <Icon name="event_available" filled className="text-2xl" />
                              </div>
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/75">Cita Médica Actual</p>
                                <p className="text-lg font-extrabold leading-tight">
                                  {proximaCita ? proximaCita.especialidad : 'Sin citas programadas'}
                                </p>
                              </div>
                            </div>
                            {proximaCita && (
                              <EtiquetaEstado estado={proximaCita.estado} mapa={ESTADOS_CITA} />
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
                              {proximaCita.motivo && (
                                <div className="sm:col-span-2 space-y-1">
                                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/70">Motivo</p>
                                  <p className="text-sm font-semibold leading-snug">"{proximaCita.motivo}"</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="relative mt-6">
                              <p className="text-sm text-white/85">
                                No tienes citas próximas. Reserva tu consulta y mantenla al día desde tu portal.
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

                        {/* Médico tratante */}
                        <section className="bg-card border border-ink-line rounded-3xl p-6 flex flex-col relative overflow-hidden">
                          <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: temaCentro.gradient }} />
                          <div className="flex items-center gap-3 mb-5">
                            <span className="w-10 h-10 rounded-xl bg-doc-soft text-doc flex items-center justify-center">
                              <Icon name="stethoscope" filled className="text-xl" />
                            </span>
                            <div>
                              <h3 className="font-display text-lg font-bold text-primary leading-tight">Médico Tratante</h3>
                              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">
                                El médico que registra tu evolución
                              </p>
                            </div>
                          </div>

                          {medicoTratante ? (
                            <>
                              <div className="flex items-center gap-3 pb-4 border-b border-ink-line">
                                <Avatar sx={{ bgcolor: 'var(--color-secondary)', width: 46, height: 46, fontWeight: 800, fontSize: '0.9rem' }}>
                                  {iniciales(medicoTratante.nombre)}
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-extrabold text-primary leading-tight">{medicoTratante.nombre}</p>
                                  <p className="text-xs text-on-surface-variant">{medicoTratante.especialidad || 'Médico'}</p>
                                </div>
                                <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded-md bg-fx-soft text-fx font-bold">
                                  {medicoTratante.tipo === 'principal' ? 'Principal' : 'Seguimiento'}
                                </span>
                              </div>
                              <div className="mt-4 space-y-2.5 flex-1">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-on-surface-variant">Consultas registradas por él</span>
                                  <span className="font-mono font-bold text-primary">
                                    {historial ? historial.historial.filter((c) => c.medico_nombre === medicoTratante.nombre).length : '—'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-on-surface-variant">Tratamientos en curso</span>
                                  <span className="font-mono font-bold text-primary">
                                    {ultimaConsulta && ultimaConsulta.medico_nombre === medicoTratante.nombre && ultimaConsulta.tratamiento ? '1' : '—'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-on-surface-variant italic flex items-start gap-1.5 pt-1">
                                  <Icon name="sync_alt" className="text-sm text-doc shrink-0 mt-0.5" />
                                  Tu médico ve esta misma historia en su módulo de consultas.
                                </p>
                              </div>
                            </>
                          ) : (
                            <div className="py-8 text-center text-on-surface-variant space-y-2">
                              <Icon name="stethoscope" className="text-5xl opacity-40" />
                              <p className="text-sm font-medium">Aún no tienes médico asignado.</p>
                              <p className="text-xs">Se asignará automáticamente en tu próxima consulta.</p>
                            </div>
                          )}
                        </section>

                        {/* Tratamiento actual */}
                        {ultimaConsulta && (
                          <section className="xl:col-span-2 bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6 relative overflow-hidden">
                            <div className="absolute -top-14 -right-14 w-44 h-44 bg-fx-soft/50 rounded-full pointer-events-none" />
                            <div className="relative flex items-start justify-between gap-3 mb-4">
                              <div>
                                <h3 className="font-display text-lg font-bold text-primary">Tratamiento Actual</h3>
                                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                                  Registrado el {formatoFechaLarga(ultimaConsulta.fecha)} · {ultimaConsulta.especialidad}
                                </p>
                              </div>
                              <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold px-3 py-1.5 rounded-lg bg-fx text-white shadow-sm">
                                Vigente
                              </span>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
                                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-fx font-bold mb-2 flex items-center gap-1.5">
                                  <Icon name="medication" className="text-sm" /> Tratamiento
                                </p>
                                <p className="text-sm text-primary leading-snug">{ultimaConsulta.tratamiento}</p>
                              </div>
                              <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
                                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">Diagnóstico</p>
                                <p className="text-sm text-primary">
                                  <span className="font-mono font-bold text-secondary">{ultimaConsulta.cie10_codigo}</span> · {ultimaConsulta.cie10_descripcion}
                                </p>
                              </div>
                              {ultimaConsulta.recomendaciones && (
                                <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
                                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber font-bold mb-2 flex items-center gap-1.5">
                                    <Icon name="tips_and_updates" className="text-sm" /> Indicaciones médicas
                                  </p>
                                  <p className="text-sm text-primary leading-snug">{ultimaConsulta.recomendaciones}</p>
                                </div>
                              )}
                              {ultimaConsulta.recetas && ultimaConsulta.recetas.length > 0 && (
                                <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
                                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">Recetas vigentes</p>
                                  <div className="space-y-2">
                                    {ultimaConsulta.recetas.map((r, i) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <Icon name="prescriptions" className="text-base text-fx mt-0.5" />
                                        <div>
                                          <p className="text-sm font-semibold text-primary">{r.nombre}</p>
                                          {r.posologia && <p className="text-xs text-on-surface-variant">{r.posologia}</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </section>
                        )}

                        {/* Evolución de tratamientos */}
                        <section className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6">
                          <div className="flex items-center gap-2.5 mb-4">
                            <span className="w-9 h-9 rounded-xl bg-amber-soft text-amber flex items-center justify-center">
                              <Icon name="history_edu" filled className="text-lg" />
                            </span>
                            <div>
                              <h3 className="font-display text-lg font-bold text-primary leading-tight">Evolución de Tratamientos</h3>
                              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                                Anteriores y presente
                              </p>
                            </div>
                          </div>

                          {evolucionTratamientos.length === 0 ? (
                            <div className="py-8 text-center text-on-surface-variant space-y-2">
                              <Icon name="medication" className="text-5xl opacity-40" />
                              <p className="text-sm font-medium">Sin tratamientos registrados.</p>
                            </div>
                          ) : (
                            <ol className="relative">
                              <span className="absolute left-[9px] top-2 bottom-2 w-px bg-ink-line-strong" aria-hidden="true" />
                              {evolucionTratamientos.map((c, i) => {
                                const esUltimo = i === evolucionTratamientos.length - 1;
                                return (
                                  <li key={c.consulta_id} className="relative pl-8 pb-4 last:pb-0">
                                    <span
                                      className={`absolute left-0 top-1 w-[19px] h-[19px] rounded-full border-2 ${
                                        esUltimo ? 'bg-fx border-fx' : 'bg-surface border-ink-line-strong'
                                      }`}
                                      aria-hidden="true"
                                    />
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-[10px] font-bold text-on-surface-variant uppercase">
                                        {formatoFecha(c.fecha)}
                                      </span>
                                      {esUltimo && (
                                        <span className="font-mono text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-fx text-white">
                                          Vigente
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-semibold text-primary mt-0.5">{c.tratamiento}</p>
                                    <p className="font-mono text-[9px] text-on-surface-variant mt-0.5">
                                      {c.especialidad} · {c.medico_nombre}
                                    </p>
                                  </li>
                                );
                              })}
                            </ol>
                          )}
                        </section>
                      </div>
                    </>
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
                          ['Cédula de Identidad', `${paciente.tipo_cedula || 'V'}-${paciente.cedula}`],
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
      {citaModal && <CitaModal centro={citaModal} paciente={paciente} onClose={() => setCitaModal(null)} />}

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
                    Horario Disponible del Médico
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {consultandoSlotsPosponer && (
                      <span className="text-xs text-secondary animate-pulse flex items-center gap-1 py-1">
                        <Icon name="sync" className="text-sm animate-spin" /> Verificando disponibilidad del médico...
                      </span>
                    )}
                    {!consultandoSlotsPosponer && slotsPosponer.length === 0 && (
                      <span className="text-xs italic text-error font-medium py-1">
                        {slotMsgPosponer || 'Seleccione una fecha para consultar horarios.'}
                      </span>
                    )}
                    {!consultandoSlotsPosponer &&
                      slotsPosponer.map((slot) => {
                        const slotFinal = slot.length === 5 ? `${slot}:00` : slot;
                        const activo = nuevaHoraPosponer === slotFinal;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setNuevaHoraPosponer(slotFinal)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                              activo
                                ? 'bg-secondary text-white border-secondary shadow-md scale-105'
                                : 'border-outline-variant text-primary hover:border-secondary hover:bg-secondary/5'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                  </div>
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

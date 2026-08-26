import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import Icon from '../components/Icon';
import HistorialLinea from '../components/HistorialLinea';
import DemoSwitcher from '../components/DemoSwitcher';
import CapacityIndicator from '../components/CapacityIndicator';
import PrescripcionInput from '../components/PrescripcionInput';
import { API, cerrarSesion } from '../api';
import { DEMO, CIE10_DEMO, CATALOGO_EXAMENES, CATEGORIA_ESTILO, GRUPOS_ESTILO, CENTROS_DEMO, getPersonaDemo, PIN_POR_DEFECTO } from '../clinical/demo';
import { getCentroTheme } from '../centroTheme';

const MEDICO_DEFECTO = { nombre: 'Dra. Laura Fernández', id: 1043, especialidad: 'Medicina General' };

const TABS = [
  { id: 'espera', etiqueta: 'En Espera' },
  { id: 'consulta', etiqueta: 'En Consulta' },
  { id: 'finalizado', etiqueta: 'Finalizado' },
];

const SECCIONES_FORM = [
  { id: 'consulta', etiqueta: 'Consulta', icono: 'clinical_notes' },
  { id: 'recetas', etiqueta: 'Recetas', icono: 'prescriptions' },
  { id: 'estudios', etiqueta: 'Estudios', icono: 'monitor_heart' },
];

const GRADIENTES = [
  'linear-gradient(135deg, #00677d, #008ba3)',
  'linear-gradient(135deg, #0f2537, #1a3a52)',
  'linear-gradient(135deg, #0d5c47, #43ffbb)',
  'linear-gradient(135deg, #a8631b, #e09a4a)',
];

function gradientesTema(t) {
  return [
    `linear-gradient(135deg, ${t.accentLight} 0%, ${t.accent} 55%, ${t.accentDark} 100%)`,
    `linear-gradient(135deg, ${t.accentDark} 0%, ${t.primary} 60%, ${t.primaryLight} 100%)`,
    `linear-gradient(135deg, ${t.primary} 0%, ${t.accentDark} 60%, ${t.accent} 100%)`,
    `linear-gradient(135deg, ${t.accent} 0%, ${t.accentLight} 50%, ${t.primaryLight} 100%)`,
  ];
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'var(--color-card)',
    borderRadius: 2,
    fontSize: '0.9rem',
    '& fieldset': { borderColor: 'var(--color-ink-line)' },
    '&:hover fieldset': { borderColor: 'var(--color-secondary)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--color-secondary)', borderWidth: 2 },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: 'var(--color-secondary)' },
};

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

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function horaActual() {
  return new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

function gradiente(nombre = '', t = null) {
  const lista = t ? gradientesTema(t) : GRADIENTES;
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return lista[h % lista.length];
}

export default function Doctores() {
  const [sesion, setSesion] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginEntrando, setLoginEntrando] = useState(false);
  const [cola, setCola] = useState({ espera: [], consulta: [], finalizado: [] });
  const atendidosHoy = cola.finalizado.length;
  const MEDICO = sesion
    ? {
        nombre: sesion.nombre,
        especialidad: sesion.especialidad,
        id: sesion.personal_id,
        username: sesion.username,
      }
    : MEDICO_DEFECTO;

  const aItemCola = (x) => ({
    id: x.token,
    colaId: x.id,
    nombre: x.paciente_nombre,
    prioridad: x.prioridad <= 2 ? 'ALTA' : 'NORMAL',
    espera: 0,
    perfil: {
      cedula: x.paciente_cedula,
      edad: '—',
      alergia: null,
      antecedente: '—',
      motivo: x.motivo || '',
    },
    hora: x.creado_en,
  });

  const cargarCola = useCallback(async (username) => {
    try {
      const res = await API.colaClinica();
      setCola({
        espera: (res.espera || []).map(aItemCola),
        consulta: (res.consulta || []).map(aItemCola),
        finalizado: (res.finalizado || []).map(aItemCola),
      });
    } catch {
      try {
        const colaDemo = await DEMO.colaDoctor(username);
        setCola(colaDemo);
      } catch {
        setCola({ espera: [], consulta: [], finalizado: [] });
      }
    }
  }, []);

  const iniciarSesion = async (e) => {
    e.preventDefault();
    setLoginEntrando(true);
    setLoginError('');
    try {
      let res;
      try {
        res = await API.login(loginForm.username, loginForm.password);
      } catch {
        res = await DEMO.login({ username: loginForm.username, password: loginForm.password });
      }
      try {
        localStorage.setItem('bna_token', res.token);
        localStorage.setItem('bna_sesion_doctor', JSON.stringify(res.usuario));
      } catch {
        /* sin almacenamiento */
      }
      setSesion(res.usuario);
      cargarCola(res.usuario.username);
    } catch (err) {
      setLoginError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoginEntrando(false);
    }
  };

  const cerrarSesionDoctor = () => {
    cerrarSesion('staff');
    try {
      localStorage.removeItem('bna_sesion_doctor');
    } catch {
      /* sin almacenamiento */
    }
    setSesion(null);
    setActivoId(null);
    setHistorial(null);
    setLoginForm({ username: '', password: '' });
    setLoginError('');
  };

  // Restaurar sesión (o la persona activa del modo demo) al montar.
  useEffect(() => {
    let activo = true;
    (async () => {
      const persona = getPersonaDemo();
      if (persona && persona.tipo === 'doctor') {
        try {
          const res = await DEMO.login({ username: persona.username, password: PIN_POR_DEFECTO });
          if (activo) {
            try {
              localStorage.setItem('bna_token', res.token);
              localStorage.setItem('bna_sesion_doctor', JSON.stringify(res.usuario));
            } catch {
              /* sin almacenamiento */
            }
            setSesion(res.usuario);
            setCola(await DEMO.colaDoctor(persona.username));
          }
        } catch {
          /* persona inválida: seguir con la sesión normal */
        }
        return;
      }
      let guardada = null;
      try {
        guardada = JSON.parse(localStorage.getItem('bna_sesion_doctor') || 'null');
      } catch {
        guardada = null;
      }
      if (guardada && guardada.username) {
        if (activo) setSesion(guardada);
        cargarCola(guardada.username);
      }
    })();
    return () => {
      activo = false;
    };
  }, [cargarCola]);

  const [tab, setTab] = useState('espera');
  const [queueAbierta, setQueueAbierta] = useState(false);
  const [activoId, setActivoId] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [historialCargando, setHistorialCargando] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [medicoRel, setMedicoRel] = useState(null);
  const [recetaAbierto, setRecetaAbierto] = useState(false);
  const [formNuevo, setFormNuevo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [informePaciente, setInformePaciente] = useState(null);
  const [listadoAbierto, setListadoAbierto] = useState(false);

  const [centros, setCentros] = useState([]);
  const [centroId] = useState(() => {
    try {
      return localStorage.getItem('bna_centro_activo') || 'CLN-NINO';
    } catch {
      return 'CLN-NINO';
    }
  });
  const [seccion, setSeccion] = useState('consulta');

  const [form, setForm] = useState({
    motivo: '',
    examen: '',
    cie10_codigo: '',
    cie10_descripcion: '',
    tratamiento: '',
    recomendaciones: '',
  });
  const [cieBusqueda, setCieBusqueda] = useState('');
  const [cieAbierto, setCieAbierto] = useState(false);
  const [recetas, setRecetas] = useState([]);
  const [estudios, setEstudios] = useState([]);
  const [tabEstudio, setTabEstudio] = useState('laboratorio');
  const [procesandoEstudio, setProcesandoEstudio] = useState(null);
  const [errorEstudio, setErrorEstudio] = useState('');
  const [ordenAbierta, setOrdenAbierta] = useState(false);
  const [ordenCategoria, setOrdenCategoria] = useState('laboratorio');
  const [ordenBusqueda, setOrdenBusqueda] = useState('');
  const [ordenSeleccion, setOrdenSeleccion] = useState([]);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [errorOrden, setErrorOrden] = useState('');
  const [ordenesPaciente, setOrdenesPaciente] = useState([]);
  const [ordenesCargando, setOrdenesCargando] = useState(false);
  const [ordenesIdsConsulta, setOrdenesIdsConsulta] = useState([]);
  const [ordenCompletando, setOrdenCompletando] = useState(null);
  const [ordenEmitida, setOrdenEmitida] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [inventario, setInventario] = useState([]);
  const cieRef = useRef(null);

  const activo = useMemo(() => {
    const lista = [...cola.espera, ...cola.consulta];
    return lista.find((p) => p.id === activoId) || lista[0] || null;
  }, [cola, activoId]);

  const centro = useMemo(
    () => centros.find((c) => c.codigo === centroId) || centros[0] || null,
    [centros, centroId]
  );

  const temaCentro = useMemo(
    () => getCentroTheme(centro || { codigo: centroId, nombre: '' }),
    [centro, centroId]
  );

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
      '--color-tertiary': temaCentro.primary,
      '--color-tertiary-fixed': temaCentro.accentLight,
      '--color-tertiary-fixed-dim': temaCentro.accent,
    }),
    [temaCentro]
  );

  const perfilCedula = activo?.perfil?.cedula;
  const perfilMotivo = activo?.perfil?.motivo;

  const cargarOrdenesPaciente = useCallback(async () => {
    if (!perfilCedula) return;
    setOrdenesCargando(true);
    try {
      let ordenes;
      try {
        const paciente = await API.buscarPaciente(perfilCedula);
        ordenes = await API.ordenesPaciente(paciente.id);
      } catch {
        ordenes = await DEMO.ordenesPaciente(perfilCedula);
      }
      setOrdenesPaciente(ordenes || []);
    } catch {
      setOrdenesPaciente([]);
    } finally {
      setOrdenesCargando(false);
    }
  }, [perfilCedula]);

  useEffect(() => {
    if (activoId) setQueueAbierta(false);
  }, [activoId]);

  useEffect(() => {
    if (!activoId) return;
    setSeccion('consulta');
    setForm({
      motivo: perfilMotivo || '',
      examen: '',
      cie10_codigo: '',
      cie10_descripcion: '',
      tratamiento: '',
      recomendaciones: '',
    });
    setRecetas([]);
    setEstudios([]);
    setTabEstudio('laboratorio');
    setProcesandoEstudio(null);
    setErrorEstudio('');
    setOrdenAbierta(false);
    setOrdenBusqueda('');
    setOrdenSeleccion([]);
    setError('');
    setOrdenCompletando(null);
    setOrdenEmitida(null);
    setOrdenesIdsConsulta([]);
    setHistorial(null);
    setHistorialCargando(true);
    setMedicoRel(null);
    API.historialPaciente(perfilCedula)
      .then((h) => setHistorial(h))
      .catch(async () => {
        try {
          setHistorial(await DEMO.historialPaciente(perfilCedula));
        } catch {
          setHistorial(null);
        }
      })
      .finally(() => setHistorialCargando(false));
    API.medicoTratante(perfilCedula)
      .then(setMedicoRel)
      .catch(async () => {
        try {
          setMedicoRel(await DEMO.medicoTratante(perfilCedula));
        } catch {
          setMedicoRel(null);
        }
      });
    cargarOrdenesPaciente();
  }, [activoId, perfilCedula, perfilMotivo, cargarOrdenesPaciente]);

  useEffect(() => {
    let vivo = true;
    API.getCentros()
      .then((d) => {
        if (!vivo) return;
        setCentros(Array.isArray(d) && d.length ? d : CENTROS_DEMO);
      })
      .catch(() => {
        if (vivo) setCentros(CENTROS_DEMO);
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    function cerrar(e) {
      if (cieRef.current && !cieRef.current.contains(e.target)) setCieAbierto(false);
    }
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  useEffect(() => {
    API.getInventario()
      .then(setInventario)
      .catch(async () => {
        try {
          setInventario(await DEMO.getInventario());
        } catch {
          setInventario([]);
        }
      });
  }, []);

  const cieFiltrados = useMemo(() => {
    const q = cieBusqueda.trim().toLowerCase();
    if (!q) return CIE10_DEMO;
    return CIE10_DEMO.filter(
      (c) => c.codigo.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q)
    );
  }, [cieBusqueda]);

  function seleccionarCie(c) {
    setForm((f) => ({ ...f, cie10_codigo: c.codigo, cie10_descripcion: c.descripcion }));
    setCieBusqueda(`${c.codigo} · ${c.descripcion}`);
    setCieAbierto(false);
  }

  function agregarReceta() {
    setRecetas((r) => [...r, { nombre: '', posologia: '' }]);
  }
  function cambiarReceta(i, campo, valor) {
    setRecetas((r) => r.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
  }
  function quitarReceta(i) {
    setRecetas((r) => r.filter((_, j) => j !== i));
  }

  function agregarEstudio() {
    setEstudios((e) => [
      ...e,
      { id: `E-${Date.now()}`, tipo: tabEstudio, nombre: '', parametros: [], descripcion: '', conclusion: '' },
    ]);
  }
  function cambiarEstudio(id, campo, valor) {
    setEstudios((e) => e.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)));
  }
  function cambiarParametro(id, i, campo, valor) {
    setEstudios((e) =>
      e.map((x) =>
        x.id === id
          ? { ...x, parametros: x.parametros.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)) }
          : x
      )
    );
  }
  function agregarParametro(id) {
    setEstudios((e) =>
      e.map((x) =>
        x.id === id ? { ...x, parametros: [...x.parametros, { parametro: '', valor: '', unidad: '', rango: '' }] } : x
      )
    );
  }
  function quitarParametro(id, i) {
    setEstudios((e) =>
      e.map((x) => (x.id === id ? { ...x, parametros: x.parametros.filter((_, j) => j !== i) } : x))
    );
  }
  function quitarEstudio(id) {
    setEstudios((e) => e.filter((x) => x.id !== id));
  }
  function aplicarEstudio(id, extraido) {
    setEstudios((e) =>
      e.map((x) =>
        x.id === id
          ? {
              ...x,
              nombre: extraido.nombre || x.nombre,
              parametros:
                extraido.parametros?.length > 0
                  ? extraido.parametros.map((p) => ({ ...p }))
                  : x.parametros,
              descripcion: extraido.descripcion || x.descripcion,
              conclusion: extraido.conclusion || x.conclusion,
            }
          : x
      )
    );
  }
  async function procesarImagenEstudio(id, archivo) {
    if (!archivo) return;
    const estudio = estudios.find((x) => x.id === id);
    if (!estudio) return;
    setProcesandoEstudio(id);
    setErrorEstudio('');
    const lector = new FileReader();
    lector.onload = async () => {
      const base64 = String(lector.result).split(',')[1];
      try {
        let extraido;
        try {
          extraido = await API.procesarEstudio({
            imagen_base64: base64,
            tipo_estudio: estudio.tipo,
          });
        } catch {
          extraido = await DEMO.procesarEstudio({
            imagen_base64: base64,
            tipo_estudio: estudio.tipo,
          });
        }
        aplicarEstudio(id, extraido);
        setAviso('Resultados extraídos de la imagen. Revíselos antes de guardar.');
      } catch (e) {
        setErrorEstudio(e.message || 'No se pudo procesar la imagen.');
      } finally {
        setProcesandoEstudio(null);
      }
    };
    lector.readAsDataURL(archivo);
  }

  const ordenCatalog = useMemo(() => CATALOGO_EXAMENES[ordenCategoria] || [], [ordenCategoria]);
  const catEstilo = CATEGORIA_ESTILO[ordenCategoria] || {};
  const ordenGrupos = useMemo(() => {
    const q = ordenBusqueda.trim().toLowerCase();
    if (!q) return ordenCatalog;
    return ordenCatalog
      .map((g) => ({ ...g, estudios: g.estudios.filter((e) => e.toLowerCase().includes(q)) }))
      .filter((g) => g.estudios.length > 0);
  }, [ordenCatalog, ordenBusqueda]);

  function abrirOrden(categoria) {
    setOrdenCategoria(categoria);
    setOrdenBusqueda('');
    setOrdenSeleccion([]);
    setOrdenAbierta(true);
  }
  function toggleExamen(nombre) {
    setOrdenSeleccion((s) =>
      s.includes(nombre) ? s.filter((x) => x !== nombre) : [...s, nombre]
    );
  }
  function emitirOrden() {
    if (ordenSeleccion.length === 0) return;
    setGuardandoOrden(true);
    setErrorOrden('');
    const nuevos = ordenSeleccion.map((nombre) => ({
      id: `E-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tipo: ordenCategoria,
      nombre,
      parametros: [],
      descripcion: '',
      conclusion: '',
    }));
    const ordenGuardada = nuevos.map(({ id: _ignorado, ...rest }) => ({ ...rest, estado: 'solicitado' }));
    const persistir = async () => {
      try {
        const paciente = await API.buscarPaciente(activo.perfil.cedula);
        const orden = await API.crearOrdenEstudios({
          paciente_id: paciente.id,
          consulta_id: null,
          origen: 'consulta',
          prioridad: 'normal',
          medico_id: MEDICO.id,
          medico_nombre: MEDICO.nombre,
          especialidad: MEDICO.especialidad,
          estudios: ordenGuardada,
        });
        return orden;
      } catch {
        return DEMO.crearOrdenEstudios({
          paciente_id: activo.perfil.cedula,
          paciente_cedula: activo.perfil.cedula,
          origen: 'consulta',
          prioridad: 'normal',
          medico_nombre: MEDICO.nombre,
          especialidad: MEDICO.especialidad,
          estudios: ordenGuardada,
        });
      }
    };
    persistir()
      .then((orden) => {
        setOrdenEmitida(orden);
        if (orden?.id) setOrdenesIdsConsulta((ids) => [...ids, orden.id]);
        setEstudios((e) => [...e, ...nuevos]);
        setTabEstudio(ordenCategoria);
        setOrdenAbierta(false);
        setOrdenBusqueda('');
        setOrdenSeleccion([]);
        cargarOrdenesPaciente();
        setAviso(
          `Orden ${orden.comprobante_orden || ''} emitida: ${nuevos.length} estudio(s) de ${ordenCategoria} solicitado(s). Complete los resultados en la sección de estudios.`
        );
      })
      .catch((e) => setErrorOrden(e.message || 'No se pudo emitir la orden.'))
      .finally(() => setGuardandoOrden(false));
  }

  function completarOrden(orden) {
    setOrdenCompletando(orden);
    const cargados = (orden.estudios || []).map((est) => ({
      id: `O-${orden.id}-${est.nombre}-${Math.random().toString(36).slice(2, 6)}`,
      tipo: est.tipo || 'laboratorio',
      nombre: est.nombre || '',
      parametros: (est.parametros || []).map((p) => ({ ...p })),
      descripcion: est.descripcion || '',
      conclusion: est.conclusion || '',
      _orden_id: orden.id,
    }));
    setEstudios((e) => [...e, ...cargados]);
    setTabEstudio(cargados[0]?.tipo || 'laboratorio');
    setAviso(`Orden ${orden.comprobante_orden} cargada. Complete los resultados manualmente o escanee.`);
  }

  function quitarOrdenActiva() {
    setEstudios((e) => e.filter((x) => !x._orden_id));
    setOrdenCompletando(null);
  }

  async function guardarResultadosOrden() {
    if (!ordenCompletando) return;
    setGuardandoOrden(true);
    setErrorOrden('');
    const estudiosResultado = estudios
      .filter((x) => x._orden_id === ordenCompletando.id)
      .map(({ _orden_id: _o, id: _id, ...rest }) => ({ ...rest, estado: 'completado' }));
    if (estudiosResultado.length === 0) {
      setErrorOrden('No hay estudios cargados para esta orden.');
      setGuardandoOrden(false);
      return;
    }
    try {
      try {
        await API.registrarResultadosOrden(ordenCompletando.id, {
          estudios: estudiosResultado,
          medico_nombre: MEDICO.nombre,
          especialidad: MEDICO.especialidad,
        });
      } catch {
        await DEMO.registrarResultadosOrden(ordenCompletando.id, {
          estudios: estudiosResultado,
        });
      }
      setEstudios((e) => e.filter((x) => !x._orden_id));
      setOrdenCompletando(null);
      setAviso('Resultados de la orden guardados. Se actualizó el estado de la orden.');
      cargarOrdenesPaciente();
    } catch (e) {
      setErrorOrden(e.message || 'No se pudieron guardar los resultados.');
    } finally {
      setGuardandoOrden(false);
    }
  }

  function disponibilidad(nombre) {
    const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = norm(nombre);
    if (!target) return { estado: 'none', stock: null };
    const med =
      inventario.find((m) => norm(m.nombre) === target) ||
      inventario.find(
        (m) => norm(m.nombre).includes(target) || target.includes(norm(m.nombre))
      );
    if (!med) return { estado: 'no', stock: null };
    const minimo = med.stock_minimo ?? 30;
    return { estado: med.stock_actual <= minimo ? 'bajo' : 'ok', stock: med.stock_actual };
  }

  const recetasContables = recetas.filter((r) => r.nombre.trim());

  function seleccionarPaciente(p) {
    setTab('consulta');
    setActivoId(p.id);
    if (p.colaId) API.asignarPaciente(p.colaId).catch(() => {});
    setCola((c) => {
      if (c.consulta.some((x) => x.id === p.id)) return c;
      const enEspera = c.espera.some((x) => x.id === p.id);
      if (!enEspera) return c;
      return {
        ...c,
        espera: c.espera.filter((x) => x.id !== p.id),
        consulta: [...c.consulta, p],
      };
    });
  }

  async function agregarPaciente(e) {
    e.preventDefault();
    const datos = new FormData(e.target);
    const nombre = (datos.get('nombre') || '').trim();
    const cedula = (datos.get('cedula') || '').trim();
    if (!nombre || !cedula) return;
    try {
      const turno = await API.registrarTurno({
        cedula,
        nombre,
        motivo: 'consulta',
        prioridad: datos.get('prioridad') === 'ALTA' ? 1 : 3,
      });
      setCola((c) => ({ ...c, espera: [aItemCola(turno), ...c.espera] }));
      setFormNuevo(false);
      setActivoId(turno.token);
      return;
    } catch {
      /* sin backend: registro local (demo) */
    }
    const nuevo = {
      id: `P-${Math.floor(Math.random() * 90000) + 10000}`,
      nombre,
      prioridad: datos.get('prioridad') === 'ALTA' ? 'ALTA' : 'NORMAL',
      espera: 0,
      perfil: { cedula, edad: '—', alergia: null, antecedente: '—', motivo: '' },
    };
    setCola((c) => ({ ...c, espera: [nuevo, ...c.espera] }));
    setFormNuevo(false);
    setActivoId(nuevo.id);
  }

  const puedeGuardar =
    form.motivo.trim() && form.cie10_codigo.trim() && form.tratamiento.trim();

  async function guardarConsulta() {
    if (!activo || !puedeGuardar) return null;
    setGuardando(true);
    setError('');
    const payload = {
      motivo_consulta: form.motivo,
      examen_fisico: form.examen,
      cie10_codigo: form.cie10_codigo,
      cie10_descripcion: form.cie10_descripcion,
      tratamiento: form.tratamiento,
      recomendaciones: form.recomendaciones,
      recetas: recetas.filter((r) => r.nombre.trim()),
      paciente_cedula: activo.perfil.cedula,
      paciente_nombre: activo.nombre,
      laboratorios: [],
      estudios: estudios.map((e) => ({
        tipo: e.tipo,
        nombre: e.nombre,
        parametros: e.parametros.filter((p) => p.parametro.trim() || p.valor.trim()),
        descripcion: e.descripcion || null,
        conclusion: e.conclusion || null,
      })),
      ordenes_ids: ordenesIdsConsulta,
      especialidad: MEDICO.especialidad,
      medico_nombre: MEDICO.nombre,
    };
    try {
      let respuesta;
      try {
        const paciente = await API.buscarPaciente(activo.perfil.cedula);
        respuesta = await API.crearConsulta({ ...payload, paciente_id: paciente.id });
      } catch {
        respuesta = await DEMO.crearConsulta(payload);
      }
      setCola((c) => ({
        espera: c.espera.filter((x) => x.id !== activo.id),
        consulta: c.consulta.filter((x) => x.id !== activo.id),
        finalizado: [
          { id: activo.id, nombre: activo.nombre, prioridad: activo.prioridad, cedula: activo.perfil.cedula, hora: horaActual() },
          ...c.finalizado,
        ],
      }));
      if (activo.colaId) API.finalizarPaciente(activo.colaId).catch(() => {});
      return respuesta;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setGuardando(false);
    }
  }

  function cerrarInforme() {
    const proximo = informePaciente?.proximo || null;
    setInformePaciente(null);
    if (proximo) {
      setTab('espera');
      setAviso(`Consulta registrada · Siguiente: ${proximo.nombre}`);
      seleccionarPaciente(proximo);
    } else {
      setActivoId(null);
      setTab('espera');
    }
  }

  function finalizarSiguiente() {
    if (!activo || guardando) return;
    const siguiente =
      cola.espera.find((p) => p.id !== activo.id) ||
      cola.consulta.find((p) => p.id !== activo.id) ||
      null;
    const conContenido = Boolean(
      form.motivo.trim() ||
        form.examen.trim() ||
        form.cie10_codigo.trim() ||
        form.tratamiento.trim() ||
        form.recomendaciones.trim() ||
        recetas.some((r) => r.nombre.trim()) ||
        estudios.length > 0
    );
    if (conContenido && !puedeGuardar) {
      setSeccion('consulta');
      setError('La consulta tiene datos incompletos: complete motivo, diagnóstico CIE-10 y tratamiento para finalizar.');
      return;
    }
    if (conContenido) {
      guardarConsulta().then((respuesta) => {
        if (!respuesta) return;
        setInformePaciente({
          paciente: { ...activo, perfil: { ...activo.perfil } },
          comprobante: respuesta.comprobante_ref || respuesta.id,
          receta_codigo: respuesta.receta_codigo || null,
          fecha: new Date().toISOString(),
          registro: {
            motivo: form.motivo,
            examen: form.examen,
            cie10_codigo: form.cie10_codigo,
            cie10_descripcion: form.cie10_descripcion,
            tratamiento: form.tratamiento,
            recomendaciones: form.recomendaciones,
            recetas: recetas.filter((r) => r.nombre.trim()),
            estudios: estudios.map((e) => ({
              tipo: e.tipo,
              nombre: e.nombre,
              parametros: e.parametros.filter((p) => p.parametro.trim() || p.valor.trim()),
              descripcion: e.descripcion || null,
              conclusion: e.conclusion || null,
            })),
          },
          proximo: siguiente,
        });
      });
      return;
    }
    setCola((c) => ({
      espera: c.espera.filter((x) => x.id !== activo.id),
      consulta: c.consulta.filter((x) => x.id !== activo.id),
      finalizado: [
        { id: activo.id, nombre: activo.nombre, prioridad: activo.prioridad, cedula: activo.perfil.cedula, hora: horaActual() },
        ...c.finalizado,
      ],
    }));
    setAviso(siguiente ? `Llamando a ${siguiente.nombre}` : `${activo.nombre} fue retirado de la fila sin registro.`);
    if (siguiente) {
      seleccionarPaciente(siguiente);
    } else {
      setActivoId(null);
      setTab('espera');
    }
  }

  const listaTab = cola[tab] || [];
  const sinResultados = listaTab.length === 0;
  const notificaciones = 3;

  const contenidoCola = (
    <>
      {/* Identidad del centro de salud */}
      <div
        className="relative overflow-hidden px-5 py-4 text-white shrink-0"
        style={{ background: temaCentro.gradient }}
      >
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, rgba(255,255,255,0.35) 0 10px, transparent 10px 26px)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <img
            src={centro?.logo || '/identidad visual/SBna.jpeg'}
            alt=""
            className="w-9 h-9 rounded-xl bg-white/90 object-contain p-1 shadow"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold leading-tight truncate">
              {centro?.nombre || 'Salud Barcelona'}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/75 truncate">
              {temaCentro.lema}
            </p>
          </div>
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-white/15 border border-white/25 shrink-0">
            {centro?.codigo || 'BNA'}
          </span>
        </div>
      </div>

      {/* Cabecera de turnos */}
      <div className="px-4 md:px-5 pt-5 pb-4 border-b border-outline-variant bg-surface-container-low/60 shrink-0">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
              <Icon name="groups" filled className="text-base" />
            </span>
            <div>
              <h2 className="text-sm md:text-base font-bold text-primary leading-tight">Cola de Pacientes</h2>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">
                Gestión de Turnos Médicos
              </p>
            </div>
          </div>
          <button
            onClick={() => setQueueAbierta(false)}
            className="lg:hidden p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Cerrar cola"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Indicador de capacidad del turno del médico */}
        <div className="mb-3.5">
          <CapacityIndicator
            ocupados={(cola.espera || []).length + (cola.consulta || []).length + atendidosHoy}
            maximo={15}
            nombreTurno="Límite del Turno Médico"
            compacto={false}
          />
        </div>

        {/* Control segmentado */}
        <div className="flex bg-surface-container rounded-full p-1" role="tablist" aria-label="Filtro de cola">
          {TABS.map((t) => {
            const activado = tab === t.id;
            const contador = t.id === 'finalizado' ? atendidosHoy : (cola[t.id] || []).length;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={activado}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-1.5 px-1 rounded-full text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  activado ? 'bg-surface text-secondary shadow-sm' : 'text-on-surface-variant hover:text-secondary'
                }`}
              >
                <span>{t.etiqueta}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    activado ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {contador}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de pacientes */}
      <div className="flex-1 overflow-y-auto ledger-scroll px-3 md:px-4 py-3 space-y-2.5">
        {tab === 'finalizado' && atendidosHoy > 0 && (
          <button
            onClick={() => setListadoAbierto(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-secondary/40 bg-secondary/5 px-3 py-2 text-xs font-bold text-secondary hover:bg-secondary/10 transition-colors"
          >
            <Icon name="print" className="text-base" />
            Imprimir listado de atendidos
          </button>
        )}
        {sinResultados && (
          <div className="text-center py-10 text-on-surface-variant space-y-2">
            <Icon
              name={tab === 'finalizado' ? 'done_all' : 'groups'}
              className="text-4xl opacity-40"
            />
            <p className="text-xs font-medium">
              {tab === 'finalizado'
                ? 'Aún no se han atendido pacientes.'
                : 'No hay pacientes en esta fila.'}
            </p>
          </div>
        )}
        {listaTab.map((p, i) => {
          const esActivo = activo && activo.id === p.id;
          const esAlta = p.prioridad === 'ALTA';
          return (
            <div
              key={p.id}
              className={`rise-in flex items-center gap-2 rounded-2xl border transition-all ${
                esActivo
                  ? 'bg-secondary-container/30 border-secondary shadow-md'
                  : 'bg-surface border-outline-variant hover:border-secondary/50 hover:shadow-md'
              }`}
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              <button
                onClick={() => seleccionarPaciente(p)}
                className="flex-1 min-w-0 flex items-center gap-2.5 p-3 text-left"
              >
                <div className={`w-1 self-stretch rounded-full shrink-0 ${esAlta ? 'bg-error' : 'bg-success'}`} />
                <Avatar
                  sx={{
                    bgcolor: esActivo ? 'var(--color-secondary)' : 'transparent',
                    color: esActivo ? 'var(--color-on-secondary)' : 'var(--color-secondary)',
                    border: `1.5px solid ${esAlta ? 'var(--color-error)' : 'var(--color-secondary)'}`,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    width: 36,
                    height: 36,
                  }}
                >
                  {iniciales(p.nombre)}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-semibold text-xs md:text-sm leading-tight ${esActivo ? 'text-on-secondary-container' : 'text-primary'}`}>
                      {p.nombre}
                    </span>
                    {esAlta && (
                      <Chip
                        size="small"
                        icon={<Icon name="warning" className="text-xs !text-on-error-container" />}
                        label="Alta"
                        sx={{
                          height: 18,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          bgcolor: 'var(--color-error-container)',
                          color: 'var(--color-on-error-container)',
                          '& .MuiChip-icon': { color: 'var(--color-on-error-container)' },
                        }}
                      />
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 font-mono text-[10px] mt-0.5 ${esActivo ? 'text-on-secondary-container/70' : 'text-on-surface-variant'}`}>
                    <Icon name={tab === 'consulta' ? 'timer' : 'schedule'} className="text-xs" />
                    {tab === 'consulta'
                      ? `Sesión: ${String(Math.floor(p.espera * 0.3)).padStart(2, '0')}:${String((p.espera * 18) % 60).padStart(2, '0')} min`
                      : tab === 'finalizado'
                        ? `Atendido: ${p.hora || '—'}`
                        : `Espera: ${p.espera} min`}
                    <span className="opacity-60">· {p.cedula || p.id}</span>
                  </div>
                </div>
                {esActivo && (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-secondary font-semibold whitespace-nowrap">
                    En consulta
                  </span>
                )}
              </button>
              {esActivo && (
                <div className="pr-2.5 shrink-0">
                  <button
                    onClick={finalizarSiguiente}
                    disabled={guardando}
                    title="Finalizar consulta y llamar al siguiente paciente"
                    aria-label={`Finalizar consulta de ${p.nombre} y pasar al siguiente`}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-white text-[10px] font-bold shadow transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
                    style={{ background: temaCentro.gradient }}
                  >
                    <Icon name="skip_next" className="text-sm" />
                    Finalizar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Registrar paciente */}
      <div className="p-3 md:p-4 border-t border-outline-variant bg-surface-container-low/60 shrink-0">
        {formNuevo ? (
          <form onSubmit={agregarPaciente} className="space-y-2.5 bg-surface border border-outline-variant rounded-2xl p-3.5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">
              Registrar nuevo turno · Triaje
            </p>
            <TextField
              name="nombre"
              required
              fullWidth
              size="small"
              placeholder="Nombre y apellido"
              sx={fieldSx}
            />
            <TextField
              name="cedula"
              required
              fullWidth
              size="small"
              placeholder="Cédula"
              sx={fieldSx}
            />
            <select
              name="prioridad"
              className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-xs text-primary outline-none focus:border-secondary"
            >
              <option value="NORMAL">Prioridad normal</option>
              <option value="ALTA">Alta prioridad</option>
            </select>
            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                variant="contained"
                size="small"
                fullWidth
                sx={{
                  backgroundColor: 'var(--color-secondary)',
                  '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                Añadir a la cola
              </Button>
              <Button
                type="button"
                size="small"
                variant="outlined"
                onClick={() => setFormNuevo(false)}
                sx={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)', textTransform: 'none' }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button
            fullWidth
            variant="contained"
            onClick={() => setFormNuevo(true)}
            startIcon={<Icon name="add_circle" className="text-base" />}
            sx={{
              backgroundColor: 'var(--color-secondary)',
              '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 3,
              py: 1,
              fontSize: '0.82rem',
            }}
          >
            Registrar Paciente / Triaje
          </Button>
        )}
      </div>
    </>
  );

  if (!sesion) {
    return (
      <div className="min-h-screen bg-paper paper-noise text-ink font-ui" style={varsCentro}>
        <div className="min-h-screen flex items-center justify-center p-4 md:p-6">
          <div className="w-full max-w-md">
            <div className="bg-card border border-ink-line rounded-lg corner-tick shadow-[0_1px_2px_rgba(20,35,47,0.05)] p-6 md:p-8 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-secondary-container/20 rounded-full pointer-events-none" />
              <div className="relative">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-lg mb-5" style={{ background: temaCentro.gradient }}>
                  <Icon name="stethoscope" filled className="text-2xl" />
                </div>
                <h2 className="font-display text-2xl font-bold text-ink">Acceso del personal de salud</h2>
                <p className="text-sm text-ink-soft mt-1">
                  Ingresa con tu usuario y contraseña institucional para atender la cola y registrar consultas.
                </p>

                {loginError && (
                  <div className="mt-5 p-3 bg-blood-soft rounded-md border border-blood/30 flex items-center gap-2" role="alert">
                    <Icon name="error" className="text-blood text-lg" />
                    <p className="text-xs font-semibold text-blood">{loginError}</p>
                  </div>
                )}

                <form className="mt-5 space-y-4" onSubmit={iniciarSesion}>
                  <TextField
                    fullWidth
                    label="Usuario"
                    placeholder="lfernandez"
                    value={loginForm.username}
                    onChange={(e) => {
                      setLoginForm((f) => ({ ...f, username: e.target.value }));
                      setLoginError('');
                    }}
                    sx={fieldSx}
                    autoFocus
                    autoComplete="username"
                  />
                  <TextField
                    fullWidth
                    type="password"
                    label="Contraseña"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => {
                      setLoginForm((f) => ({ ...f, password: e.target.value }));
                      setLoginError('');
                    }}
                    sx={fieldSx}
                    autoComplete="current-password"
                  />
                  <Button
                    type="submit"
                    fullWidth
                    disabled={loginEntrando}
                    variant="contained"
                    sx={{
                      background: temaCentro.gradient,
                      borderRadius: 2,
                      py: 1.4,
                      fontWeight: 700,
                      textTransform: 'none',
                    }}
                  >
                    {loginEntrando ? 'Verificando...' : 'Iniciar sesión'}
                  </Button>
                </form>

                <div className="mt-5 pt-4 border-t border-ink-line">
                  <p className="text-[11px] text-ink-faint text-center">
                    Modo demostración: use cualquier usuario de la semilla con clave{' '}
                    <span className="font-mono font-bold text-doc">1234</span>
                    <br />
                    (ej. <span className="font-mono">lfernandez</span> ·{' '}
                    <span className="font-mono">avalera</span> ·{' '}
                    <span className="font-mono">mgonzalez</span> ·{' '}
                    <span className="font-mono">psanchez</span>)
                  </p>
                </div>
              </div>
            </div>
            <p className="text-center mt-4">
              <Link
                to="/"
                className="text-xs font-bold text-ink-faint hover:text-doc transition-colors"
              >
                ← Volver al sitio público
              </Link>
            </p>
          </div>
        </div>
        <DemoSwitcher />
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-paper paper-noise text-ink font-ui" style={varsCentro}>
      {/* ===== Barra superior ===== */}
      <header className="relative z-30 shrink-0 bg-paper/90 backdrop-blur-md">
        <div className="flex items-center gap-2 md:gap-4 px-3 md:px-6 h-16 border-b border-ink-line">
          {/* Menú: abre/cierra la cola de turnos con badge flotante de pacientes en espera */}
          <button
            onClick={() => setQueueAbierta((v) => !v)}
            className="flex items-center gap-2 p-2 -ml-1 rounded-xl text-ink hover:bg-paper-2 border border-ink-line transition-all active:scale-95 shrink-0"
            aria-label={queueAbierta ? 'Cerrar cola de turnos' : 'Abrir cola de turnos'}
            aria-expanded={queueAbierta}
          >
            <Icon name={queueAbierta ? 'close' : 'menu'} />
            <span className="text-xs font-bold hidden sm:inline">Cola de Turnos</span>
            {cola.espera.length > 0 && (
              <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-secondary text-on-secondary">
                {cola.espera.length}
              </span>
            )}
          </button>

          {/* Información rápida de paciente activo en header para móvil */}
          {activo ? (
            <div className="flex items-center gap-2 min-w-0 mx-1 flex-1 lg:flex-initial">
              <Avatar
                sx={{
                  width: 30,
                  height: 30,
                  background: gradiente(activo.nombre, temaCentro),
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  shrink: 0,
                }}
              >
                {iniciales(activo.nombre)}
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink truncate leading-tight">{activo.nombre}</p>
                <p className="font-mono text-[9px] text-ink-faint truncate">
                  C.I. {activo.perfil?.cedula} · <span className="text-secondary font-semibold">En consulta</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex-1 lg:block hidden" />

          <IconButton
            aria-label="Notificaciones"
            sx={{ color: 'var(--color-ink-soft)', padding: 1 }}
          >
            <Badge badgeContent={notificaciones} color="error">
              <Icon name="notifications" className="text-xl" />
            </Badge>
          </IconButton>

          <div className="flex items-center gap-2 pl-1">
            <Avatar sx={{ bgcolor: 'var(--color-secondary)', width: 36, height: 36, fontWeight: 700, fontSize: '0.78rem' }}>
              {iniciales(MEDICO.nombre)}
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-ink leading-tight">{MEDICO.nombre}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                {MEDICO.especialidad}
              </p>
            </div>
          </div>

          <div className="w-px h-8 bg-ink-line hidden sm:block" aria-hidden="true" />

          <Link
            to="/"
            onClick={cerrarSesionDoctor}
            className="flex items-center justify-center w-9 h-9 rounded-full text-ink-soft hover:text-blood hover:bg-blood-soft/60 transition-colors shrink-0"
            aria-label="Cerrar sesión y volver al portal"
            title="Cerrar sesión"
          >
            <Icon name="logout" className="text-xl" />
          </Link>
        </div>
      </header>

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* ===== Fondo de la cola en móvil (overlay) ===== */}
        {queueAbierta && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden transition-opacity"
            onClick={() => setQueueAbierta(false)}
            aria-hidden="true"
          />
        )}

        {/* ===== Cola de turnos (overlay en móvil z-50, panel empujado en escritorio) ===== */}
        <aside
          className={`fixed lg:relative z-50 lg:z-10 inset-y-0 left-0 shrink-0 w-[min(340px,88vw)] lg:w-80 bg-card border-r border-ink-line flex flex-col transition-all duration-300 ease-out shadow-2xl lg:shadow-none ${
            queueAbierta
              ? 'translate-x-0 ml-0'
              : '-translate-x-full lg:translate-x-0 lg:-ml-80'
          }`}
          aria-label="Cola de pacientes"
        >
          {contenidoCola}
        </aside>

        {/* ===== Área de consulta ===== */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {activo ? (
            <>
              <div className="flex-1 overflow-y-auto ledger-scroll px-3 md:px-6 py-4 md:py-5 space-y-4 md:space-y-5">
                {/* Cabecera paciente */}
                <section className="bg-card border border-ink-line rounded-lg corner-tick p-4 md:p-6 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-secondary-container/20 rounded-full pointer-events-none" />
                  <div className="relative flex flex-col md:flex-row gap-4 md:items-center">
                    <div className="flex items-center gap-3.5 md:gap-5 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar
                          sx={{
                            width: { xs: 60, md: 76 },
                            height: { xs: 60, md: 76 },
                            background: gradiente(activo.nombre, temaCentro),
                            fontWeight: 800,
                            fontSize: { xs: '1.2rem', md: '1.6rem' },
                            boxShadow: '0 12px 28px -10px rgba(15,37,55,0.4)',
                          }}
                        >
                          {iniciales(activo.nombre)}
                        </Avatar>
                        <span className="absolute -bottom-1 -right-1 bg-success text-on-secondary w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 border-surface shadow">
                          <Icon name="check" className="text-xs md:text-sm" />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h2 className="font-display text-lg md:text-[26px] font-bold text-primary tracking-tight truncate">
                            {activo.nombre}
                          </h2>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-surface border border-outline-variant text-on-surface-variant whitespace-nowrap">
                            HIS-V{activo.perfil.cedula}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <Chip
                            icon={<Icon name="cake" className="text-xs md:text-sm !text-secondary" />}
                            label={activo.perfil.edad}
                            sx={{ bgcolor: 'var(--color-surface)', color: 'var(--color-on-surface-variant)', fontWeight: 600, fontSize: '0.72rem', height: 26 }}
                          />
                          {activo.perfil.alergia && (
                            <Chip
                              icon={<Icon name="warning" className="text-xs md:text-sm !text-on-error-container" />}
                              label={`Alergia: ${activo.perfil.alergia}`}
                              sx={{ bgcolor: 'var(--color-error-container)', color: 'var(--color-on-error-container)', fontWeight: 700, fontSize: '0.72rem', height: 26 }}
                            />
                          )}
                          <Chip
                            icon={<Icon name="assignment_ind" className="text-xs md:text-sm !text-tertiary" />}
                            label={activo.perfil.antecedente}
                            sx={{ bgcolor: 'var(--color-surface)', color: 'var(--color-on-surface-variant)', fontWeight: 600, fontSize: '0.72rem', height: 26 }}
                          />
                          {medicoRel && medicoRel.nombre ? (
                            <Chip
                              icon={
                                <Icon
                                  name={medicoRel.nombre === MEDICO.nombre ? 'verified_user' : 'stethoscope'}
                                  className={`text-xs md:text-sm ${medicoRel.nombre === MEDICO.nombre ? '!text-on-secondary' : '!text-doc'}`}
                                />
                              }
                              label={
                                medicoRel.nombre === MEDICO.nombre
                                  ? 'Paciente asignado a ti'
                                  : `Médico: ${medicoRel.nombre}`
                              }
                              sx={{
                                bgcolor:
                                  medicoRel.nombre === MEDICO.nombre
                                    ? 'var(--color-fx)'
                                    : 'var(--color-doc-soft)',
                                color:
                                  medicoRel.nombre === MEDICO.nombre
                                    ? '#fff'
                                    : 'var(--color-doc-deep)',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                height: 26,
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-ink-line/60">
                      <Button
                        variant="outlined"
                        size="small"
                        className="flex-1 md:flex-initial"
                        startIcon={<Icon name="history" className="text-base" />}
                        onClick={() => setHistorialAbierto(true)}
                        sx={{
                          borderColor: 'var(--color-ink-line)',
                          color: 'var(--color-ink-soft)',
                          textTransform: 'none',
                          borderRadius: 2.5,
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          py: 0.8,
                        }}
                      >
                        Historial
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        className="flex-1 md:flex-initial"
                        startIcon={<Icon name="print" className="text-base" />}
                        onClick={() => setRecetaAbierto(true)}
                        sx={{
                          borderColor: 'var(--color-ink-line)',
                          color: 'var(--color-ink-soft)',
                          textTransform: 'none',
                          borderRadius: 2.5,
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          py: 0.8,
                        }}
                      >
                        Imprimir Receta
                      </Button>
                    </div>
                  </div>
                </section>

                {/* Secciones del registro clínico */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div
                    className="flex bg-surface-container rounded-full p-1 max-w-full overflow-x-auto ledger-scroll scrollbar-hide"
                    role="tablist"
                    aria-label="Sección del registro clínico"
                  >
                    {SECCIONES_FORM.map((s) => {
                      const activado = seccion === s.id;
                      const contador =
                        s.id === 'recetas'
                          ? recetasContables.length
                          : s.id === 'estudios'
                            ? estudios.length
                            : 0;
                      return (
                        <button
                          key={s.id}
                          role="tab"
                          aria-selected={activado}
                          onClick={() => setSeccion(s.id)}
                          className={`px-3.5 md:px-4 py-2 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                            activado ? 'bg-surface text-secondary shadow-sm' : 'text-on-surface-variant hover:text-secondary'
                          }`}
                        >
                          <Icon name={s.icono} className="text-sm" />
                          {s.etiqueta}
                          {contador > 0 && (
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                                activado ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant'
                              }`}
                            >
                              {contador}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant hidden md:inline">
                    {seccion === 'consulta' &&
                      (puedeGuardar
                        ? 'Diagnóstico completo · listo para registrar'
                        : 'Pendiente: motivo · CIE-10 · tratamiento')}
                    {seccion === 'recetas' && `${recetasContables.length} medicamento(s) para despacho`}
                    {seccion === 'estudios' &&
                      `${estudios.length} estudio(s) · ${ordenesPaciente.length} orden(es)`}
                  </span>
                </div>

                {seccion === 'consulta' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Motivo de consulta */}
                    <section className="bg-surface-container-low border border-outline-variant rounded-2xl p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="font-mono text-[10px] font-semibold text-on-surface-variant w-5">01</span>
                        <span className="w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                          <Icon name="description" filled className="text-sm" />
                        </span>
                        <h3 className="text-sm font-bold text-primary">Motivo de Consulta</h3>
                        <span className="flex-1 ledger-rule opacity-70" />
                      </div>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        value={form.motivo}
                        onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                        placeholder="Síntoma principal y duración..."
                        sx={fieldSx}
                      />
                    </section>

                    {/* Examen físico */}
                    <section className="bg-surface-container-low border border-outline-variant rounded-2xl p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="font-mono text-[10px] font-semibold text-on-surface-variant w-5">02</span>
                        <span className="w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                          <Icon name="stethoscope" filled className="text-sm" />
                        </span>
                        <h3 className="text-sm font-bold text-primary">Examen Físico</h3>
                        <span className="flex-1 ledger-rule opacity-70" />
                      </div>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        value={form.examen}
                        onChange={(e) => setForm((f) => ({ ...f, examen: e.target.value }))}
                        placeholder="Hallazgos en exploración física..."
                        sx={fieldSx}
                      />
                    </section>

                    {/* Diagnóstico CIE-10 */}
                    <section className="bg-surface-container-low border border-outline-variant rounded-2xl p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="font-mono text-[10px] font-semibold text-on-surface-variant w-5">03</span>
                        <span className="w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                          <Icon name="medical_information" filled className="text-sm" />
                        </span>
                        <h3 className="text-sm font-bold text-primary">Diagnóstico CIE-10</h3>
                        <span className="flex-1 ledger-rule opacity-70" />
                      </div>
                      <div className="relative" ref={cieRef}>
                        <TextField
                          fullWidth
                          size="small"
                          value={cieBusqueda}
                          onChange={(e) => {
                            setCieBusqueda(e.target.value);
                            setCieAbierto(true);
                            setForm((f) => ({ ...f, cie10_codigo: '', cie10_descripcion: '' }));
                          }}
                          onFocus={() => setCieAbierto(true)}
                          placeholder="Buscar código o descripción..."
                          InputProps={{
                            startAdornment: (
                              <span className="mr-2 text-on-surface-variant">
                                <Icon name="search" className="text-lg" />
                              </span>
                            ),
                          }}
                          sx={fieldSx}
                        />
                        {cieAbierto && (
                          <div className="absolute z-20 w-full mt-1.5 bg-surface border border-outline-variant rounded-2xl shadow-xl max-h-56 overflow-y-auto ledger-scroll">
                            {cieFiltrados.map((c) => (
                              <button
                                key={c.codigo}
                                onClick={() => seleccionarCie(c)}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary-container/30 border-b border-outline-variant/60 last:border-0 flex items-center gap-2.5"
                              >
                                <span className="font-mono text-xs font-semibold text-secondary w-12 shrink-0">{c.codigo}</span>
                                <span className="text-primary">{c.descripcion}</span>
                              </button>
                            ))}
                            {cieFiltrados.length === 0 && (
                              <p className="px-4 py-3 text-xs text-on-surface-variant">Sin coincidencias.</p>
                            )}
                          </div>
                        )}
                      </div>
                      {form.cie10_codigo && (
                        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-success font-semibold">
                          <Icon name="verified" className="text-sm" />
                          {form.cie10_codigo} · {form.cie10_descripcion}
                        </p>
                      )}
                    </section>

                    {/* Tratamiento / Indicaciones */}
                    <section className="bg-surface-container-low border border-outline-variant rounded-2xl p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="font-mono text-[10px] font-semibold text-on-surface-variant w-5">04</span>
                        <span className="w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                          <Icon name="medication" filled className="text-sm" />
                        </span>
                        <h3 className="text-sm font-bold text-primary">Tratamiento / Indicaciones</h3>
                        <span className="flex-1 ledger-rule opacity-70" />
                      </div>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        value={form.tratamiento}
                        onChange={(e) => setForm((f) => ({ ...f, tratamiento: e.target.value }))}
                        placeholder="Medicación, dosis y frecuencia..."
                        sx={fieldSx}
                      />
                    </section>

                    {/* Recomendaciones generales */}
                    <section className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 lg:col-span-2">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="font-mono text-[10px] font-semibold text-on-surface-variant w-5">05</span>
                        <span className="w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                          <Icon name="tips_and_updates" filled className="text-sm" />
                        </span>
                        <h3 className="text-sm font-bold text-primary">Recomendaciones Generales</h3>
                        <span className="flex-1 ledger-rule opacity-70" />
                      </div>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        value={form.recomendaciones}
                        onChange={(e) => setForm((f) => ({ ...f, recomendaciones: e.target.value }))}
                        placeholder="Estilo de vida, dieta o derivaciones..."
                        sx={fieldSx}
                      />
                    </section>
                  </div>
                )}

                {seccion === 'recetas' && (
                  <div className="space-y-4 tab-fade">
                    {/* Recetas a despachar */}
                    <section className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 md:p-5">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                            <Icon name="prescriptions" filled className="text-base" />
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-primary">Recetas a despachar en farmacia</h3>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                              Disponibilidad verificada contra el inventario del centro
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <PrescripcionInput
                          recetas={recetas}
                          onChange={cambiarReceta}
                          onAdd={agregarReceta}
                          onRemove={quitarReceta}
                        />
                      </div>
                    </section>
                  </div>
                )}

                {seccion === 'estudios' && (
                  <div className="space-y-4 tab-fade">
                    {/* Estudios y resultados */}
                    <section className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 md:p-5">
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                            <Icon name="monitor_heart" filled className="text-base" />
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-primary">Estudios y Resultados</h3>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                              Laboratorio · Imagen · Funcional — escanee para llenado automático
                            </p>
                          </div>
                        </div>
                        <div className="flex bg-surface-container rounded-full p-1" role="tablist" aria-label="Categoría de estudio">
                          {[
                            { id: 'laboratorio', etiqueta: 'Laboratorio', icono: 'biotech' },
                            { id: 'imagen', etiqueta: 'Imagen', icono: 'image_search' },
                            { id: 'funcional', etiqueta: 'Funcional', icono: 'monitor_heart' },
                          ].map((t) => {
                            const activado = tabEstudio === t.id;
                            const est = CATEGORIA_ESTILO[t.id] || {};
                            return (
                              <button
                                key={t.id}
                                role="tab"
                                aria-selected={activado}
                                onClick={() => setTabEstudio(t.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                                  activado ? 'text-white shadow-sm' : 'text-on-surface-variant hover:text-secondary'
                                }`}
                                style={activado ? { backgroundColor: est.color } : undefined}
                              >
                                <Icon name={t.icono} className="text-sm" />
                                {t.etiqueta}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {errorEstudio && (
                        <p className="mt-3 text-xs font-semibold text-error flex items-center gap-1.5">
                          <Icon name="error" className="text-sm" />
                          {errorEstudio}
                        </p>
                      )}

                      {/* Órdenes de estudios del paciente */}
                      <div className="mt-4 bg-surface-container-low/50 border border-outline-variant rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                            <Icon name="description" className="text-sm" />
                            Órdenes pendientes del paciente
                          </p>
                          <button
                            onClick={cargarOrdenesPaciente}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline underline-offset-4"
                          >
                            <Icon name="refresh" className="text-sm" />
                            Actualizar
                          </button>
                        </div>
                        {ordenesCargando && (
                          <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
                            <Icon name="sync" className="animate-spin text-sm" /> Cargando órdenes...
                          </p>
                        )}
                        {!ordenesCargando && ordenesPaciente.length === 0 && (
                          <p className="text-xs text-on-surface-variant italic">
                            Sin órdenes registradas para este paciente.
                          </p>
                        )}
                        {!ordenesCargando &&
                          ordenesPaciente.map((o) => {
                            const pendiente = o.estado === 'solicitada';
                            return (
                              <div
                                key={o.id}
                                className="flex items-center gap-2.5 flex-wrap bg-surface border border-outline-variant rounded-xl px-3 py-2"
                              >
                                <span className="font-mono text-[10px] font-semibold text-secondary">
                                  {o.comprobante_orden}
                                </span>
                                <span
                                  className={`font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                    pendiente ? 'bg-amber-soft text-amber' : 'bg-mint-soft text-mint'
                                  }`}
                                >
                                  {o.estado}
                                </span>
                                <span className="font-mono text-[10px] text-on-surface-variant">
                                  {o.estudios?.length || 0} estudio(s)
                                </span>
                                <span className="font-mono text-[10px] text-on-surface-variant capitalize">{o.prioridad}</span>
                                <div className="flex-1" />
                                <IconButton
                                  onClick={() => setOrdenEmitida(o)}
                                  sx={{ color: 'var(--color-on-surface-variant)', padding: 0.5 }}
                                  aria-label="Imprimir orden"
                                >
                                  <Icon name="print" className="text-lg" />
                                </IconButton>
                                {pendiente && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Icon name="edit_note" className="text-sm" />}
                                    onClick={() => completarOrden(o)}
                                    sx={{
                                      borderColor: 'var(--color-secondary)',
                                      color: 'var(--color-secondary)',
                                      textTransform: 'none',
                                      fontWeight: 600,
                                      borderRadius: 2,
                                    }}
                                  >
                                    Completar
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                      </div>

                      {/* Completando una orden emitida */}
                      {ordenCompletando && (
                        <div className="mt-3 border-2 border-secondary/40 bg-doc-soft/40 rounded-2xl p-3.5 space-y-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="w-7 h-7 rounded-full bg-secondary/15 text-secondary flex items-center justify-center">
                              <Icon name="clinical_notes" className="text-sm" />
                            </span>
                            <p className="text-xs font-bold text-primary">
                              Completando orden {ordenCompletando.comprobante_orden}
                            </p>
                            <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">
                              {ordenCompletando.estudios?.length || 0} estudio(s)
                            </span>
                          </div>
                          {errorOrden && (
                            <p className="text-xs font-semibold text-error flex items-center gap-1.5">
                              <Icon name="error" className="text-sm" />
                              {errorOrden}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              size="small"
                              variant="contained"
                              disabled={guardandoOrden}
                              startIcon={
                                guardandoOrden ? <Icon name="sync" className="animate-spin text-sm" /> : <Icon name="save" className="text-sm" />
                              }
                              onClick={guardarResultadosOrden}
                              sx={{
                                backgroundColor: 'var(--color-secondary)',
                                '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
                                textTransform: 'none',
                                fontWeight: 700,
                                borderRadius: 2,
                              }}
                            >
                              {guardandoOrden ? 'Guardando...' : 'Guardar resultados de la orden'}
                            </Button>
                            <Button
                              size="small"
                              onClick={quitarOrdenActiva}
                              sx={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', fontWeight: 600 }}
                            >
                              Descartar
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 mt-4">
                        {estudios.filter((e) => e.tipo === tabEstudio).length === 0 && (
                          <p className="text-sm text-on-surface-variant italic">
                            Sin estudios de {tabEstudio} registrados.
                          </p>
                        )}
                        {estudios.map((est) => {
                          if (est.tipo !== tabEstudio) return null;
                          const esLab = est.tipo === 'laboratorio';
                          const esImagen = est.tipo === 'imagen';
                          return (
                            <div
                              key={est.id}
                              className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3"
                              style={{
                                borderLeftWidth: 3,
                                borderLeftColor:
                                  esLab
                                    ? 'var(--color-fx)'
                                    : esImagen
                                      ? 'var(--color-doc)'
                                      : 'var(--color-amber)',
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <span className="font-mono text-xs pt-2.5 w-6 text-on-surface-variant">
                                  {(estudios.filter((e) => e.tipo === tabEstudio).indexOf(est) + 1).toString().padStart(2, '0')}
                                </span>
                                <div className="flex-1 min-w-0 space-y-2">
                                  <TextField
                                    size="small"
                                    fullWidth
                                    value={est.nombre}
                                    onChange={(e) => cambiarEstudio(est.id, 'nombre', e.target.value)}
                                    placeholder={
                                      esLab
                                        ? 'Nombre del examen (ej. Hemograma completo)'
                                        : esImagen
                                          ? 'Tipo de estudio (ej. Radiografía de tórax)'
                                          : 'Tipo de estudio (ej. Electrocardiograma de reposo)'
                                    }
                                    sx={fieldSx}
                                  />
                                  {esLab && (
                                    <div className="space-y-2">
                                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                        <TextField
                                          size="small"
                                          placeholder="Parámetro"
                                          value={est.parametros[0]?.parametro || ''}
                                          onChange={(e) => {
                                            if (est.parametros.length === 0) agregarParametro(est.id);
                                            cambiarParametro(est.id, 0, 'parametro', e.target.value);
                                          }}
                                          sx={fieldSx}
                                        />
                                        <TextField
                                          size="small"
                                          placeholder="Valor"
                                          value={est.parametros[0]?.valor || ''}
                                          onChange={(e) => {
                                            if (est.parametros.length === 0) agregarParametro(est.id);
                                            cambiarParametro(est.id, 0, 'valor', e.target.value);
                                          }}
                                          sx={fieldSx}
                                        />
                                        <TextField
                                          size="small"
                                          placeholder="Unidad"
                                          value={est.parametros[0]?.unidad || ''}
                                          onChange={(e) => {
                                            if (est.parametros.length === 0) agregarParametro(est.id);
                                            cambiarParametro(est.id, 0, 'unidad', e.target.value);
                                          }}
                                          sx={fieldSx}
                                        />
                                        <TextField
                                          size="small"
                                          placeholder="Rango ref."
                                          value={est.parametros[0]?.rango || ''}
                                          onChange={(e) => {
                                            if (est.parametros.length === 0) agregarParametro(est.id);
                                            cambiarParametro(est.id, 0, 'rango', e.target.value);
                                          }}
                                          sx={fieldSx}
                                        />
                                      </div>
                                      {est.parametros.slice(1).map((p, i) => (
                                        <div key={i} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 items-center">
                                          <span className="font-mono text-[10px] text-on-surface-variant w-6">{(i + 2).toString().padStart(2, '0')}</span>
                                          <TextField
                                            size="small"
                                            placeholder="Parámetro"
                                            value={p.parametro}
                                            onChange={(e) => cambiarParametro(est.id, i + 1, 'parametro', e.target.value)}
                                            sx={fieldSx}
                                          />
                                          <TextField
                                            size="small"
                                            placeholder="Valor"
                                            value={p.valor}
                                            onChange={(e) => cambiarParametro(est.id, i + 1, 'valor', e.target.value)}
                                            sx={fieldSx}
                                          />
                                          <TextField
                                            size="small"
                                            placeholder="Unidad"
                                            value={p.unidad}
                                            onChange={(e) => cambiarParametro(est.id, i + 1, 'unidad', e.target.value)}
                                            sx={fieldSx}
                                          />
                                          <TextField
                                            size="small"
                                            placeholder="Rango ref."
                                            value={p.rango}
                                            onChange={(e) => cambiarParametro(est.id, i + 1, 'rango', e.target.value)}
                                            sx={fieldSx}
                                          />
                                          <IconButton
                                            onClick={() => quitarParametro(est.id, i + 1)}
                                            sx={{ color: 'var(--color-error)', justifySelf: 'end' }}
                                            aria-label="Quitar parámetro"
                                          >
                                            <Icon name="delete" className="text-base" />
                                          </IconButton>
                                        </div>
                                      ))}
                                      <button
                                        onClick={() => agregarParametro(est.id)}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline underline-offset-4"
                                      >
                                        <Icon name="add" className="text-sm" />
                                        Agregar parámetro
                                      </button>
                                    </div>
                                  )}
                                  {esImagen && (
                                    <TextField
                                      size="small"
                                      fullWidth
                                      multiline
                                      minRows={2}
                                      value={est.descripcion}
                                      onChange={(e) => cambiarEstudio(est.id, 'descripcion', e.target.value)}
                                      placeholder="Descripción de los hallazgos..."
                                      sx={fieldSx}
                                    />
                                  )}
                                  {(esImagen || est.tipo === 'funcional') && (
                                    <TextField
                                      size="small"
                                      fullWidth
                                      multiline
                                      minRows={2}
                                      value={est.conclusion}
                                      onChange={(e) => cambiarEstudio(est.id, 'conclusion', e.target.value)}
                                      placeholder={esImagen ? 'Conclusión / impresión diagnóstica...' : 'Interpretación del estudio...'}
                                      sx={fieldSx}
                                    />
                                  )}
                                  {est.tipo === 'funcional' && est.parametros.length > 0 && (
                                    <div className="space-y-2">
                                      {est.parametros.map((p, i) => (
                                        <div key={i} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 items-center">
                                          <span className="font-mono text-[10px] text-on-surface-variant w-6">{(i + 1).toString().padStart(2, '0')}</span>
                                          <TextField
                                            size="small"
                                            placeholder="Parámetro"
                                            value={p.parametro}
                                            onChange={(e) => cambiarParametro(est.id, i, 'parametro', e.target.value)}
                                            sx={fieldSx}
                                          />
                                          <TextField
                                            size="small"
                                            placeholder="Valor"
                                            value={p.valor}
                                            onChange={(e) => cambiarParametro(est.id, i, 'valor', e.target.value)}
                                            sx={fieldSx}
                                          />
                                          <TextField
                                            size="small"
                                            placeholder="Unidad"
                                            value={p.unidad}
                                            onChange={(e) => cambiarParametro(est.id, i, 'unidad', e.target.value)}
                                            sx={fieldSx}
                                          />
                                          <TextField
                                            size="small"
                                            placeholder="Rango ref."
                                            value={p.rango}
                                            onChange={(e) => cambiarParametro(est.id, i, 'rango', e.target.value)}
                                            sx={fieldSx}
                                          />
                                          <IconButton
                                            onClick={() => quitarParametro(est.id, i)}
                                            sx={{ color: 'var(--color-error)', justifySelf: 'end' }}
                                            aria-label="Quitar parámetro"
                                          >
                                            <Icon name="delete" className="text-base" />
                                          </IconButton>
                                        </div>
                                      ))}
                                      <button
                                        onClick={() => agregarParametro(est.id)}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline underline-offset-4"
                                      >
                                        <Icon name="add" className="text-sm" />
                                        Agregar parámetro
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <IconButton
                                  onClick={() => quitarEstudio(est.id)}
                                  sx={{ color: 'var(--color-error)' }}
                                  aria-label="Quitar estudio"
                                >
                                  <Icon name="delete" className="text-lg" />
                                </IconButton>
                              </div>

                              {/* Escanear / foto */}
                              <div className="flex items-center gap-2.5 pl-9 flex-wrap">
                                <label
                                  className="inline-flex items-center gap-2 text-xs font-semibold text-secondary border border-secondary/40 rounded-lg px-3 py-2 hover:bg-secondary/5 cursor-pointer transition-colors"
                                >
                                  <Icon
                                    name={procesandoEstudio === est.id ? 'sync' : 'photo_camera'}
                                    className={`text-base ${procesandoEstudio === est.id ? 'animate-spin' : ''}`}
                                  />
                                  {procesandoEstudio === est.id ? 'Procesando...' : 'Escanear / tomar foto'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    disabled={procesandoEstudio === est.id}
                                    onChange={(e) => {
                                      procesarImagenEstudio(est.id, e.target.files?.[0]);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                <span className="font-mono text-[10px] text-on-surface-variant">
                                  El texto se extrae con IA y queda editable
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        <button
                          onClick={agregarEstudio}
                          className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline underline-offset-4"
                        >
                          <Icon name="add" className="text-lg" />
                          Agregar estudio de {tabEstudio}
                        </button>
                      </div>
                    </section>
                  </div>
                )}
              </div>

              {/* Barra de acciones inferior (desplazable en móvil, sin apilarse, con Finalizar destacado) */}
              <div className="shrink-0 border-t border-ink-line bg-paper/95 backdrop-blur-md px-3 md:px-6 py-2.5 md:py-3 z-30">
                <div className="flex items-center gap-2 md:gap-3 flex-nowrap overflow-x-auto ledger-scroll scrollbar-hide py-0.5">
                  {/* Botón Principal: Finalizar consulta y llamar al siguiente (Siempre visible y destacado con paciente activo) */}
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={
                      guardando ? (
                        <Icon name="sync" className="animate-spin text-base" />
                      ) : (
                        <Icon name="skip_next" className="text-base" />
                      )
                    }
                    onClick={finalizarSiguiente}
                    disabled={guardando}
                    className="shrink-0 font-extrabold shadow-md active:scale-95 transition-all"
                    sx={{
                      background: temaCentro.gradient,
                      color: '#ffffff',
                      textTransform: 'none',
                      borderRadius: 2.5,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      px: 2.5,
                      py: 1,
                      fontSize: '0.82rem',
                    }}
                  >
                    {guardando ? 'Guardando...' : 'Finalizar y Siguiente'}
                  </Button>

                  <div className="w-px h-6 bg-ink-line shrink-0" aria-hidden="true" />

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Icon name="science" className="text-base !text-fx" />}
                    onClick={() => abrirOrden('laboratorio')}
                    className="shrink-0"
                    sx={{
                      borderColor: 'var(--color-ink-line)',
                      color: 'var(--color-ink-soft)',
                      textTransform: 'none',
                      borderRadius: 2.5,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      fontSize: '0.8rem',
                      py: 0.9,
                    }}
                  >
                    Orden Laboratorio
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Icon name="image_search" className="text-base !text-doc" />}
                    onClick={() => abrirOrden('imagen')}
                    className="shrink-0"
                    sx={{
                      borderColor: 'var(--color-ink-line)',
                      color: 'var(--color-ink-soft)',
                      textTransform: 'none',
                      borderRadius: 2.5,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      fontSize: '0.8rem',
                      py: 0.9,
                    }}
                  >
                    Orden Imagen
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<Icon name="emergency" className="text-base" />}
                    onClick={() => setAviso('Alerta de urgencia notificada al equipo de emergencias.')}
                    className="shrink-0"
                    sx={{
                      borderColor: 'var(--color-error)',
                      color: 'var(--color-error)',
                      textTransform: 'none',
                      borderRadius: 2.5,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      fontSize: '0.8rem',
                      py: 0.9,
                    }}
                  >
                    Urgencia
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Icon name="print" className="text-base" />}
                    onClick={() => setRecetaAbierto(true)}
                    className="shrink-0"
                    sx={{
                      borderColor: 'var(--color-ink-line)',
                      color: 'var(--color-ink-soft)',
                      textTransform: 'none',
                      borderRadius: 2.5,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      fontSize: '0.8rem',
                      py: 0.9,
                    }}
                  >
                    Imprimir Receta
                  </Button>

                  {error && (
                    <span className="text-xs font-semibold text-error shrink-0 px-2 py-1 rounded bg-error-container/50">
                      {error}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-md space-y-4">
                <div
                  className="mx-auto w-20 h-20 rounded-2xl text-white flex items-center justify-center shadow-xl"
                  style={{ background: temaCentro.gradient }}
                >
                  <Icon name="stethoscope" className="text-4xl" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-primary mb-1.5">Seleccione un paciente</h2>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Elija un turno de la cola de {centro?.nombre || 'su centro'} para comenzar la
                    valoración clínica, el diagnóstico y el registro de la consulta.
                  </p>
                </div>
                <div className="pt-2 lg:hidden">
                  <Button
                    variant="contained"
                    onClick={() => setQueueAbierta(true)}
                    startIcon={<Icon name="groups" className="text-lg" />}
                    sx={{
                      background: temaCentro.gradient,
                      color: '#ffffff',
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 3,
                      px: 3,
                      py: 1.2,
                    }}
                  >
                    Ver Cola de Pacientes ({cola.espera.length} en espera)
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===== Diálogo: historial clínico ===== */}
      <Dialog
        open={historialAbierto && !!activo}
        onClose={() => setHistorialAbierto(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { ...varsCentro, borderRadius: { xs: 3, md: 4 }, margin: { xs: 2, md: 4 } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'var(--color-primary)' }}>
          <span className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Icon name="history" filled className="text-lg" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate">Historial clínico de {activo?.nombre}</p>
            <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-on-surface-variant mt-0.5 truncate">
              {historial ? `${historial.total_consultas} consulta(s) · ${historial.paciente.numero_historia || ''}` : 'Expediente del paciente'}
            </p>
          </div>
        </DialogTitle>
        <DialogContent dividers>
          {historialCargando && (
            <p className="text-sm text-on-surface-variant flex items-center gap-2">
              <Icon name="sync" className="animate-spin" /> Cargando historial...
            </p>
          )}
          {!historialCargando && !historial && (
            <p className="text-sm text-on-surface-variant italic">Sin registros previos.</p>
          )}
          {!historialCargando && historial && (
            <div className="space-y-4">
              {/* Estado actual del paciente */}
              {historial.historial.length > 0 && (
                <div className="rounded-2xl border border-fx/30 bg-fx-soft/50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-fx text-white flex items-center justify-center shrink-0">
                      <Icon name="medication" filled className="text-base" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-primary">Tratamiento actual</p>
                        <span className="font-mono text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-fx text-white">
                          Vigente
                        </span>
                        <span className="font-mono text-[10px] text-on-surface-variant">
                          {formatoFecha(historial.historial[0].fecha)} · {historial.historial[0].especialidad}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-primary mt-1 leading-snug">
                        {historial.historial[0].tratamiento || 'Sin tratamiento registrado'}
                      </p>
                      {historial.historial[0].cie10_codigo && (
                        <p className="font-mono text-[11px] text-secondary font-bold mt-1">
                          {historial.historial[0].cie10_codigo} · {historial.historial[0].cie10_descripcion}
                        </p>
                      )}
                      {Array.isArray(historial.historial[0].recetas) && historial.historial[0].recetas.length > 0 && (
                        <p className="font-mono text-[10px] text-on-surface-variant mt-1 truncate">
                          Rx: {historial.historial[0].recetas.map((r) => r.nombre).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {historial.historial.length === 0 && (
                <p className="text-sm text-on-surface-variant italic">
                  Paciente {historial.paciente.nombre_completo} · sin consultas registradas.
                </p>
              )}
              <HistorialLinea consultas={historial.historial} marcarActual />
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setHistorialAbierto(false)}
            sx={{ color: 'var(--color-secondary)', textTransform: 'none', fontWeight: 600 }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Diálogo: imprimir receta ===== */}
      <Dialog
        open={recetaAbierto}
        onClose={() => setRecetaAbierto(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { ...varsCentro, borderRadius: { xs: 3, md: 4 }, margin: { xs: 2, md: 4 } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'var(--color-primary)' }}>
          <span className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Icon name="print" filled className="text-lg" />
          </span>
          Receta médica
        </DialogTitle>
        <DialogContent dividers>
          {recetasContables.length === 0 ? (
            <p className="text-sm text-on-surface-variant italic">
              No hay medicamentos recetados todavía. Agregue medicamentos en la sección de recetas.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-outline-variant/60">
                <div>
                  <p className="text-sm font-bold text-primary">{activo?.nombre}</p>
                  <p className="font-mono text-[10px] text-on-surface-variant">C.I. {activo?.perfil?.cedula}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">{MEDICO.nombre}</p>
                  <p className="font-mono text-[10px] text-on-surface-variant">{MEDICO.especialidad} · ID {MEDICO.id}</p>
                </div>
              </div>
              {recetasContables.map((r, i) => {
                const disp = disponibilidad(r.nombre);
                return (
                  <div key={i} className="flex items-start gap-3 pb-3 border-b border-outline-variant/40 last:border-0">
                    <span className="font-mono text-xs pt-0.5 w-6 text-on-surface-variant">{(i + 1).toString().padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary">{r.nombre}</p>
                      <p className="text-sm text-on-surface-variant">{r.posologia}</p>
                      {disp.estado === 'no' && (
                        <p className="font-mono text-[10px] text-error mt-0.5">Sin stock en farmacia</p>
                      )}
                      {disp.estado === 'bajo' && (
                        <p className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--color-amber)' }}>
                          Stock bajo · {disp.stock} disponibles
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRecetaAbierto(false)}
            sx={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', fontWeight: 600 }}
          >
            Cerrar
          </Button>
          {recetasContables.length > 0 && (
            <Button
              variant="contained"
              startIcon={<Icon name="print" className="text-base" />}
              onClick={() => window.print()}
              sx={{
                backgroundColor: 'var(--color-secondary)',
                '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Imprimir
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ===== Diálogo: imprimir orden de estudios ===== */}
      <Dialog
        open={!!ordenEmitida && ordenEmitida.estudios?.length > 0}
        onClose={() => setOrdenEmitida(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { ...varsCentro, borderRadius: { xs: 3, md: 4 }, margin: { xs: 2, md: 4 } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'var(--color-primary)' }}>
          <span className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Icon name="print" filled className="text-lg" />
          </span>
          Orden de estudios
        </DialogTitle>
        <DialogContent dividers>
          {ordenEmitida && (
            <div className="print-area">
              <div className="space-y-3">
                <div className="flex items-start justify-between flex-wrap gap-2 pb-3 border-b border-outline-variant/60">
                  <div>
                    <p className="font-display font-black text-lg text-primary tracking-tight">BNA Salud</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                      Orden médica de estudios
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-secondary">{ordenEmitida.comprobante_orden}</p>
                    <p className="font-mono text-[10px] text-on-surface-variant">
                      {formatoFecha(ordenEmitida.created_at || new Date().toISOString())}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Paciente</p>
                    <p className="text-sm font-semibold text-primary">{activo?.nombre}</p>
                    <p className="font-mono text-[10px] text-on-surface-variant">C.I. {activo?.perfil?.cedula}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Médico tratante</p>
                    <p className="text-sm font-semibold text-primary">{ordenEmitida.medico_nombre || MEDICO.nombre}</p>
                    <p className="font-mono text-[10px] text-on-surface-variant">
                      {ordenEmitida.especialidad || MEDICO.especialidad}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      ordenEmitida.prioridad === 'urgente' ? 'bg-blood-soft text-blood' : 'bg-mint-soft text-mint'
                    }`}
                  >
                    {ordenEmitida.prioridad}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant capitalize">
                    {ordenEmitida.origen}
                  </span>
                </div>
                <div className="border-t border-outline-variant/60 pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
                    Estudios solicitados
                  </p>
                  <ol className="space-y-1.5">
                    {ordenEmitida.estudios.map((e, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span className="font-mono text-xs text-on-surface-variant w-5">{(i + 1).toString().padStart(2, '0')}</span>
                        <span className="text-sm text-primary">{e.nombre}</span>
                        <span className="flex-1 border-b border-dotted border-outline-variant" />
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="pt-3 border-t border-outline-variant/60 flex items-end justify-between flex-wrap gap-2">
                  <p className="font-mono text-[10px] text-on-surface-variant italic">
                    Firma y sello del médico
                  </p>
                  <p className="font-mono text-[10px] text-on-surface-variant italic text-right">
                    Original para el paciente · Copia para el expediente
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOrdenEmitida(null)}
            sx={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', fontWeight: 600 }}
          >
            Cerrar
          </Button>
          <Button
            variant="contained"
            startIcon={<Icon name="print" className="text-base" />}
            onClick={() => window.print()}
            sx={{
              backgroundColor: 'var(--color-secondary)',
              '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Imprimir
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Diálogo: orden médica de estudios ===== */}
      <Dialog
        open={ordenAbierta}
        onClose={() => setOrdenAbierta(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { ...varsCentro, borderRadius: { xs: 3, md: 4 }, margin: { xs: 2, md: 4 } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'var(--color-primary)' }}>
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: catEstilo.color || 'var(--color-secondary)' }}
          >
            <Icon name={catEstilo.icono || 'science'} filled className="text-lg" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate">Orden médica de estudios</p>
            <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-on-surface-variant mt-0.5 truncate">
              Seleccione los exámenes a solicitar para {activo?.nombre}
            </p>
          </div>
        </DialogTitle>
        <DialogContent dividers>
          <div className="space-y-3">
            {/* Categorías */}
            <div className="flex bg-surface-container rounded-full p-1 max-w-full overflow-x-auto ledger-scroll" role="tablist" aria-label="Categoría de la orden">
              {[
                { id: 'laboratorio', etiqueta: 'Laboratorio', icono: 'science' },
                { id: 'imagen', etiqueta: 'Imagen', icono: 'image_search' },
                { id: 'funcional', etiqueta: 'Funcional', icono: 'monitor_heart' },
              ].map((t) => {
                const activado = ordenCategoria === t.id;
                const tEstilo = CATEGORIA_ESTILO[t.id] || {};
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={activado}
                    onClick={() => {
                      setOrdenCategoria(t.id);
                      setOrdenBusqueda('');
                    }}
                    className={`flex-1 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                      activado ? 'text-white shadow-sm' : 'text-on-surface-variant hover:text-secondary'
                    }`}
                    style={activado ? { backgroundColor: tEstilo.color } : undefined}
                  >
                    <Icon name={t.icono} className="text-sm" />
                    {t.etiqueta}
                  </button>
                );
              })}
            </div>

            {/* Búsqueda */}
            <TextField
              size="small"
              fullWidth
              value={ordenBusqueda}
              onChange={(e) => setOrdenBusqueda(e.target.value)}
              placeholder={`Buscar examen de ${ordenCategoria}...`}
              InputProps={{
                startAdornment: (
                  <span className="mr-2 text-on-surface-variant">
                    <Icon name="search" className="text-lg" />
                  </span>
                ),
              }}
              sx={fieldSx}
            />

            {/* Selección */}
            <div className="max-h-[46vh] overflow-y-auto ledger-scroll border border-outline-variant rounded-2xl divide-y divide-outline-variant/50">
              {ordenGrupos.length === 0 && (
                <p className="px-4 py-6 text-sm text-on-surface-variant italic text-center">
                  Sin resultados para "{ordenBusqueda}".
                </p>
              )}
              {ordenGrupos.map((g) => {
                const gEstilo = GRUPOS_ESTILO[g.grupo] || {};
                const color = gEstilo.color || 'var(--color-secondary)';
                const elegidos = g.estudios.filter((e) => ordenSeleccion.includes(e)).length;
                return (
                  <div
                    key={g.grupo}
                    className="py-2"
                    style={gEstilo.rayas ? { backgroundColor: `${gEstilo.soft}66` } : undefined}
                  >
                    {gEstilo.rayas && (
                      <div className="hazard-stripes h-1.5 w-full" aria-hidden="true" />
                    )}
                    <div className="flex items-center gap-2.5 px-4 py-2">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      >
                        {gEstilo.sigla ? (
                          <span className="font-mono text-[10px] font-bold tracking-wide">{gEstilo.sigla}</span>
                        ) : (
                          <Icon name={g.icono} className="text-base" />
                        )}
                      </span>
                      <span className="text-xs font-bold text-primary uppercase tracking-wide">{g.grupo}</span>
                      {gEstilo.rayas && (
                        <span
                          className="font-mono text-[8px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded border hidden sm:inline"
                          style={{ color, borderColor: color }}
                        >
                          Radiación ionizante
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-on-surface-variant ml-auto">
                        {elegidos}/{g.estudios.length}
                      </span>
                    </div>
                    <div className="px-4 pb-1">
                      {g.estudios.map((estudio) => {
                        const marcado = ordenSeleccion.includes(estudio);
                        return (
                          <FormControlLabel
                            key={estudio}
                            control={
                              <Checkbox
                                size="small"
                                checked={marcado}
                                onChange={() => toggleExamen(estudio)}
                                sx={{
                                  color: 'var(--color-outline)',
                                  '&.Mui-checked': { color },
                                }}
                              />
                            }
                            label={<span className="text-sm text-primary">{estudio}</span>}
                            sx={{ marginLeft: 0, width: '100%', '& .MuiFormControlLabel-label': { flex: 1 } }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <Divider />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                {ordenSeleccion.length} estudio(s) seleccionado(s) · la orden se guardará en la consulta
              </p>
              {catEstilo.color && ordenSeleccion.length > 0 && (
                <span
                  className="font-mono text-[9px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-md text-white"
                  style={{ backgroundColor: catEstilo.color }}
                >
                  Orden de {catEstilo.etiqueta}
                </span>
              )}
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOrdenAbierta(false)}
            sx={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={ordenSeleccion.length === 0}
            startIcon={<Icon name="description" className="text-base" />}
            onClick={emitirOrden}
            sx={{
              backgroundColor: catEstilo.color || 'var(--color-secondary)',
              '&:hover': { backgroundColor: catEstilo.color || 'var(--color-secondary-dark)' },
              '&.Mui-disabled': { bgcolor: 'var(--color-secondary)/0.5', color: '#fff' },
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            Emitir orden ({ordenSeleccion.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Diálogo: informe de consulta registrada ===== */}
      <Dialog
        open={!!informePaciente}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { ...varsCentro, borderRadius: { xs: 3, md: 4 }, margin: { xs: 2, md: 4 } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'var(--color-primary)' }}>
          <span className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Icon name="check_circle" filled className="text-lg" />
          </span>
          Informe de consulta
        </DialogTitle>
        <DialogContent dividers>
          {informePaciente && (
            <div className="print-area">
              <div className="space-y-3">
                <div className="flex items-start justify-between flex-wrap gap-2 pb-3 border-b border-outline-variant/60">
                  <div>
                    <p className="font-display font-black text-lg text-primary tracking-tight">BNA Salud</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {centro?.nombre || 'Salud Barcelona'} · Informe de consulta médica
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-mono text-sm font-semibold text-secondary">{informePaciente.comprobante}</p>
                    {informePaciente.receta_codigo && (
                      <p className="font-mono text-[10px] font-bold text-fx">
                        Receta en farmacia: {informePaciente.receta_codigo}
                      </p>
                    )}
                    <p className="font-mono text-[10px] text-on-surface-variant">
                      {formatoFecha(informePaciente.fecha)} ·{' '}
                      {new Date(informePaciente.fecha).toLocaleTimeString('es-VE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className="inline-block font-display italic font-black text-base tracking-tight border-[4px] rounded px-3 py-1"
                  style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                >
                  Consulta registrada
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Paciente</p>
                    <p className="text-sm font-semibold text-primary">{informePaciente.paciente.nombre}</p>
                    <p className="font-mono text-[10px] text-on-surface-variant">
                      C.I. {informePaciente.paciente.perfil?.cedula}
                      {informePaciente.paciente.perfil?.edad ? ` · ${informePaciente.paciente.perfil.edad}` : ''}
                    </p>
                    {informePaciente.paciente.perfil?.alergia && (
                      <p className="font-mono text-[10px] text-error">Alergia: {informePaciente.paciente.perfil.alergia}</p>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Médico tratante</p>
                    <p className="text-sm font-semibold text-primary">{MEDICO.nombre}</p>
                    <p className="font-mono text-[10px] text-on-surface-variant">
                      {MEDICO.especialidad} · ID {MEDICO.id}
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5 pt-2 border-t border-outline-variant/60">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Motivo de consulta</p>
                    <p className="text-sm text-primary whitespace-pre-wrap">{informePaciente.registro.motivo}</p>
                  </div>
                  {informePaciente.registro.examen && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Examen físico</p>
                      <p className="text-sm text-primary whitespace-pre-wrap">{informePaciente.registro.examen}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Diagnóstico (CIE-10)</p>
                    <p className="text-sm font-semibold text-primary">
                      <span className="text-secondary">{informePaciente.registro.cie10_codigo}</span> ·{' '}
                      {informePaciente.registro.cie10_descripcion}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Tratamiento / Indicaciones</p>
                    <p className="text-sm text-primary whitespace-pre-wrap">{informePaciente.registro.tratamiento}</p>
                  </div>
                  {informePaciente.registro.recomendaciones && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Recomendaciones</p>
                      <p className="text-sm text-primary whitespace-pre-wrap">{informePaciente.registro.recomendaciones}</p>
                    </div>
                  )}
                </div>
                {informePaciente.registro.recetas.length > 0 && (
                  <div className="border-t border-outline-variant/60 pt-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1.5">Recetas</p>
                    <ol className="space-y-1.5">
                      {informePaciente.registro.recetas.map((r, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="font-mono text-xs text-on-surface-variant w-5">
                            {(i + 1).toString().padStart(2, '0')}
                          </span>
                          <span className="text-sm font-semibold text-primary">{r.nombre}</span>
                          <span className="text-sm text-on-surface-variant">{r.posologia}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {informePaciente.registro.estudios.length > 0 && (
                  <div className="border-t border-outline-variant/60 pt-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1.5">
                      Estudios solicitados
                    </p>
                    <ol className="space-y-1">
                      {informePaciente.registro.estudios.map((e, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <span className="font-mono text-xs text-on-surface-variant w-5">
                            {(i + 1).toString().padStart(2, '0')}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-secondary w-24">{e.tipo}</span>
                          <span className="text-sm font-semibold text-primary">{e.nombre}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="pt-3 border-t border-outline-variant/60 flex items-end justify-between flex-wrap gap-2">
                  <p className="font-mono text-[10px] text-on-surface-variant italic">Firma y sello del médico</p>
                  <p className="font-mono text-[10px] text-on-surface-variant italic text-right">
                    Original para el paciente · Copia para el expediente
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={cerrarInforme}
            sx={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', fontWeight: 600 }}
          >
            Cerrar
          </Button>
          <Button
            variant="contained"
            startIcon={<Icon name="print" className="text-base" />}
            onClick={() => window.print()}
            sx={{
              backgroundColor: 'var(--color-secondary)',
              '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Imprimir informe
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Diálogo: listado de pacientes atendidos hoy ===== */}
      <Dialog
        open={listadoAbierto}
        onClose={() => setListadoAbierto(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { ...varsCentro, borderRadius: { xs: 3, md: 4 }, margin: { xs: 2, md: 4 } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'var(--color-primary)' }}>
          <span className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Icon name="done_all" filled className="text-lg" />
          </span>
          Pacientes atendidos hoy
        </DialogTitle>
        <DialogContent dividers>
          <div className="print-area">
            <div className="space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-2 pb-3 border-b border-outline-variant/60">
                <div>
                  <p className="font-display font-black text-lg text-primary tracking-tight">BNA Salud</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                    {centro?.nombre || 'Salud Barcelona'} · Listado diario de atención
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-secondary">
                    {formatoFecha(new Date().toISOString())}
                  </p>
                  <p className="font-mono text-[10px] text-on-surface-variant">{atendidosHoy} pacientes atendidos</p>
                </div>
              </div>
              <ol className="divide-y divide-outline-variant/50 border border-outline-variant rounded-2xl">
                {cola.finalizado.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="font-mono text-xs text-on-surface-variant w-6">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="font-mono text-[11px] text-secondary font-semibold w-14">{p.hora || '—'}</span>
                    <span className="flex-1 text-sm font-semibold text-primary">{p.nombre}</span>
                    <span className="font-mono text-[10px] text-on-surface-variant">{p.cedula || ''}</span>
                    <span
                      className={`font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        p.prioridad === 'ALTA' ? 'bg-error/10 text-error' : 'bg-mint-soft text-mint'
                      }`}
                    >
                      {p.prioridad || 'NORMAL'}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="pt-3 border-t border-outline-variant/60 flex items-end justify-between flex-wrap gap-2">
                <p className="font-mono text-[10px] text-on-surface-variant italic">Firma y sello del responsable</p>
                <p className="font-mono text-[10px] text-on-surface-variant italic text-right">Total: {atendidosHoy} pacientes</p>
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setListadoAbierto(false)}
            sx={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', fontWeight: 600 }}
          >
            Cerrar
          </Button>
          <Button
            variant="contained"
            startIcon={<Icon name="print" className="text-base" />}
            onClick={() => window.print()}
            sx={{
              backgroundColor: 'var(--color-secondary)',
              '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Imprimir PDF
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Avisos ===== */}
      <Snackbar
        open={!!aviso}
        autoHideDuration={3500}
        onClose={() => setAviso('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setAviso('')} severity="info" variant="filled" sx={{ borderRadius: 3 }}>
          {aviso}
        </Alert>
      </Snackbar>

      <DemoSwitcher />
    </div>
  );
}

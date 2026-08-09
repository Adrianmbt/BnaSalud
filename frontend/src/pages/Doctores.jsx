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
import { API } from '../api';
import { DEMO, COLA_DEMO, CIE10_DEMO, CATALOGO_EXAMENES } from '../clinical/demo';

const MEDICO = { nombre: 'Dra. Laura Fernández', id: 1043, especialidad: 'Medicina General' };

const TABS = [
  { id: 'espera', etiqueta: 'En Espera' },
  { id: 'consulta', etiqueta: 'En Consulta' },
  { id: 'finalizado', etiqueta: 'Finalizado' },
];

const NAV = [
  { etiqueta: 'Portal de la Comunidad', to: '/', icono: 'home' },
  { etiqueta: 'Farmacia', to: '/farmacia', icono: 'prescriptions' },
  { etiqueta: 'Atención Médica', to: '/doctores', icono: 'stethoscope' },
];

const GRADIENTES = [
  'linear-gradient(135deg, #00677d, #008ba3)',
  'linear-gradient(135deg, #0f2537, #1a3a52)',
  'linear-gradient(135deg, #0d5c47, #43ffbb)',
  'linear-gradient(135deg, #a8631b, #e09a4a)',
];

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

function gradiente(nombre = '') {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADIENTES[h % GRADIENTES.length];
}

export default function Doctores() {
  const [cola, setCola] = useState({
    espera: COLA_DEMO.espera.map((p) => ({ ...p, perfil: { ...p.perfil } })),
    consulta: [],
    finalizado: [],
  });
  const [atendidosHoy, setAtendidosHoy] = useState(COLA_DEMO.finalizado);
  const [tab, setTab] = useState('espera');
  const [queueAbierta, setQueueAbierta] = useState(false);
  const [activoId, setActivoId] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [historialCargando, setHistorialCargando] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [recetaAbierto, setRecetaAbierto] = useState(false);
  const [formNuevo, setFormNuevo] = useState(false);
  const [aviso, setAviso] = useState('');

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
  const [registrada, setRegistrada] = useState(null);
  const [error, setError] = useState('');
  const [inventario, setInventario] = useState([]);
  const cieRef = useRef(null);

  const activo = useMemo(() => {
    const lista = [...cola.espera, ...cola.consulta];
    return lista.find((p) => p.id === activoId) || lista[0] || null;
  }, [cola, activoId]);

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
    setRegistrada(null);
    setError('');
    setOrdenCompletando(null);
    setOrdenEmitida(null);
    setOrdenesIdsConsulta([]);
    setHistorial(null);
    setHistorialCargando(true);
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
    cargarOrdenesPaciente();
  }, [activoId, perfilCedula, perfilMotivo, cargarOrdenesPaciente]);

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
  const disponibles = recetasContables.filter((r) => disponibilidad(r.nombre).estado === 'ok').length;
  const sinStock = recetasContables.filter((r) => disponibilidad(r.nombre).estado === 'no').length;

  function seleccionarPaciente(p) {
    setActivoId(p.id);
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

  function agregarPaciente(e) {
    e.preventDefault();
    const datos = new FormData(e.target);
    const nombre = (datos.get('nombre') || '').trim();
    const cedula = (datos.get('cedula') || '').trim();
    if (!nombre || !cedula) return;
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
    if (!activo || !puedeGuardar) return;
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
      setRegistrada(respuesta.comprobante_ref || respuesta.id);
      setAtendidosHoy((n) => n + 1);
      setCola((c) => ({
        espera: c.espera.filter((x) => x.id !== activo.id),
        consulta: c.consulta.filter((x) => x.id !== activo.id),
        finalizado: [{ id: activo.id, nombre: activo.nombre, prioridad: activo.prioridad }, ...c.finalizado],
      }));
      setTimeout(() => {
        setActivoId(null);
        setRegistrada(null);
        setTab('espera');
      }, 3400);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const listaTab = cola[tab] || [];
  const sinResultados = tab === 'finalizado' ? atendidosHoy === 0 && listaTab.length === 0 : listaTab.length === 0;

  const notificaciones = 3;

  const contenidoCola = (
    <>
      {/* Cabecera */}
      <div className="px-5 pt-6 pb-4 border-b border-outline-variant bg-surface-container-low/60">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
              <Icon name="groups" filled className="text-lg" />
            </span>
            <div>
              <h2 className="text-base font-bold text-primary leading-tight">Gestión de Turnos</h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                Cola del centro de salud
              </p>
            </div>
          </div>
          <button
            onClick={() => setQueueAbierta(false)}
            className="lg:hidden p-2 rounded-full text-on-surface-variant hover:bg-surface-container"
            aria-label="Cerrar cola"
          >
            <Icon name="close" />
          </button>
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
                className={`flex-1 py-2 px-1 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activado ? 'bg-surface text-secondary shadow-sm' : 'text-on-surface-variant hover:text-secondary'
                }`}
              >
                <span className="hidden sm:inline">{t.etiqueta}</span>
                <span className="sm:hidden text-[10px] truncate">
                  {t.etiqueta.replace('En ', '').replace('Finalizado', 'Fin')}
                </span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
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
      <div className="flex-1 overflow-y-auto ledger-scroll px-4 py-4 space-y-2.5">
        {sinResultados && (
          <div className="text-center py-12 text-on-surface-variant space-y-2">
            <Icon
              name={tab === 'finalizado' ? 'done_all' : 'groups'}
              className="text-5xl opacity-40"
            />
            <p className="text-sm font-medium">
              {tab === 'finalizado'
                ? 'Aún no se han atendido pacientes.'
                : 'No hay pacientes en esta fila.'}
            </p>
          </div>
        )}
        {listaTab.map((p) => {
          const esActivo = activo && activo.id === p.id;
          const esAlta = p.prioridad === 'ALTA';
          return (
            <button
              key={p.id}
              onClick={() => seleccionarPaciente(p)}
              className={`w-full text-left p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                esActivo
                  ? 'bg-secondary-container/30 border-secondary shadow-md'
                  : 'bg-surface border-outline-variant hover:border-secondary/50 hover:shadow-md'
              }`}
            >
              <div className={`w-1 self-stretch rounded-full shrink-0 ${esAlta ? 'bg-error' : 'bg-success'}`} />
              <Avatar
                sx={{
                  bgcolor: esActivo ? 'var(--color-secondary)' : 'transparent',
                  color: esActivo ? 'var(--color-on-secondary)' : 'var(--color-secondary)',
                  border: `1.5px solid ${esAlta ? 'var(--color-error)' : 'var(--color-secondary)'}`,
                  fontWeight: 700,
                  fontSize: '0.8rem',
                }}
              >
                {iniciales(p.nombre)}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold text-sm leading-tight ${esActivo ? 'text-on-secondary-container' : 'text-primary'}`}>
                    {p.nombre}
                  </span>
                  {esAlta && (
                    <Chip
                      size="small"
                      icon={<Icon name="warning" className="text-sm !text-on-error-container" />}
                      label="Alta prioridad"
                      sx={{
                        height: 20,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        bgcolor: 'var(--color-error-container)',
                        color: 'var(--color-on-error-container)',
                        '& .MuiChip-icon': { color: 'var(--color-on-error-container)' },
                      }}
                    />
                  )}
                </div>
                <div className={`flex items-center gap-1.5 font-mono text-[10px] mt-1 ${esActivo ? 'text-on-secondary-container/70' : 'text-on-surface-variant'}`}>
                  <Icon name={tab === 'consulta' ? 'timer' : 'schedule'} className="text-xs" />
                  {tab === 'consulta'
                    ? `Sesión: ${String(Math.floor(p.espera * 0.3)).padStart(2, '0')}:${String((p.espera * 18) % 60).padStart(2, '0')} min`
                    : `Espera: ${p.espera} min`}
                  <span className="opacity-60">· {p.id}</span>
                </div>
              </div>
              {esActivo && (
                <span className="font-mono text-[9px] uppercase tracking-widest text-secondary font-semibold whitespace-nowrap">
                  En consulta
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Registrar paciente */}
      <div className="p-4 border-t border-outline-variant bg-surface-container-low/60">
        {formNuevo ? (
          <form onSubmit={agregarPaciente} className="space-y-2.5 bg-surface border border-outline-variant rounded-2xl p-4">
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
              className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-secondary"
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
            startIcon={<Icon name="add_circle" className="text-lg" />}
            sx={{
              backgroundColor: 'var(--color-secondary)',
              '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 3,
              py: 1.1,
            }}
          >
            Registrar Paciente / Triaje
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-surface text-primary font-ui">
      {/* ===== Barra superior ===== */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant">
        <div className="flex items-center gap-4 px-4 md:px-6 h-16">
          {/* Móvil: menú */}
          <button
            onClick={() => setQueueAbierta(true)}
            className="lg:hidden p-2 -ml-2 rounded-full text-on-surface-variant hover:bg-surface-container"
            aria-label="Abrir cola de turnos"
          >
            <Icon name="menu" />
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group min-w-0">
            <div className="w-10 h-9 rounded-lg overflow-hidden bg-surface ring-1 ring-outline-variant flex items-center justify-center px-1 shrink-0">
              <img src="/identidad visual/SBna.jpeg" alt="Logo Salud Barcelona" className="h-full w-auto object-contain" />
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-[15px] font-extrabold text-primary leading-tight truncate">Salud Barcelona</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant leading-tight">
                Municipal · S. Bolívar
              </p>
            </div>
          </Link>

          {/* Navegación */}
          <nav className="hidden lg:flex items-center gap-1 ml-6" aria-label="Navegación principal">
            {NAV.map((n) => {
              const activado = n.to === '/doctores';
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-current={activado ? 'page' : undefined}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    activado
                      ? 'bg-secondary-container/40 text-secondary'
                      : 'text-on-surface-variant hover:text-secondary hover:bg-surface-container'
                  }`}
                >
                  {n.etiqueta}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          {/* Acciones */}
          <Button
            variant="contained"
            size="small"
            startIcon={<Icon name="calendar_month" className="text-base" />}
            className="hidden md:inline-flex"
            sx={{
              backgroundColor: 'var(--color-secondary)',
              '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 3,
            }}
          >
            Solicitar Cita
          </Button>

          <IconButton
            aria-label="Notificaciones"
            sx={{ color: 'var(--color-on-surface-variant)' }}
          >
            <Badge badgeContent={notificaciones} color="error">
              <Icon name="notifications" className="text-xl" />
            </Badge>
          </IconButton>

          <div className="flex items-center gap-2.5 pl-1">
            <Avatar sx={{ bgcolor: 'var(--color-secondary)', width: 38, height: 38, fontWeight: 700, fontSize: '0.8rem' }}>
              {iniciales(MEDICO.nombre)}
            </Avatar>
            <div className="hidden xl:block">
              <p className="text-sm font-bold text-primary leading-tight">{MEDICO.nombre}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">
                {MEDICO.especialidad} · ID {MEDICO.id}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* ===== Cola de turnos ===== */}
        <div
          className={`lg:hidden fixed inset-0 z-40 bg-primary/50 backdrop-blur-sm transition-opacity duration-300 ${queueAbierta ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setQueueAbierta(false)}
          aria-hidden="true"
        />
        <aside
          className={`lg:static lg:translate-x-0 fixed inset-y-0 left-0 z-40 w-[320px] max-w-[85vw] shrink-0 bg-surface border-r border-outline-variant flex flex-col transition-transform duration-300 ease-out ${
            queueAbierta ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-label="Cola de pacientes"
        >
          {contenidoCola}
        </aside>

        {/* ===== Área de consulta ===== */}
        <main className="flex-1 flex flex-col min-w-0 bg-surface overflow-hidden">
          {activo ? (
            <>
              <div className="flex-1 overflow-y-auto ledger-scroll px-4 md:px-6 py-5 space-y-5">
                {/* Botón móvil para abrir la cola */}
                <div className="lg:hidden">
                  <button
                    onClick={() => setQueueAbierta(true)}
                    className="w-full flex items-center justify-between gap-3 bg-secondary text-on-secondary rounded-xl px-4 py-3 shadow-md"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Icon name="groups" filled className="text-lg" />
                      Cola de turnos
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-on-secondary/80">
                      {cola.espera.length + cola.consulta.length} esperando
                      <Icon name="chevron_right" className="text-base" />
                    </span>
                  </button>
                </div>

                {/* Cabecera paciente */}
                <section className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-secondary-container/20 rounded-full pointer-events-none" />
                  <div className="relative flex flex-col md:flex-row gap-5 md:items-center">
                    <div className="relative shrink-0 self-start">
                      <Avatar
                        sx={{
                          width: 76,
                          height: 76,
                          background: gradiente(activo.nombre),
                          fontWeight: 800,
                          fontSize: '1.6rem',
                          boxShadow: '0 12px 28px -10px rgba(15,37,55,0.4)',
                        }}
                      >
                        {iniciales(activo.nombre)}
                      </Avatar>
                      <span className="absolute -bottom-1 -right-1 bg-success text-on-secondary w-7 h-7 rounded-full flex items-center justify-center border-2 border-surface shadow">
                        <Icon name="check" className="text-sm" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                        <h2 className="text-2xl font-extrabold text-primary tracking-tight">
                          {activo.nombre}
                        </h2>
                        <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-surface border border-outline-variant text-on-surface-variant whitespace-nowrap">
                          ID: HIS-V{activo.perfil.cedula}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Chip
                          icon={<Icon name="cake" className="text-sm !text-secondary" />}
                          label={activo.perfil.edad}
                          sx={{ bgcolor: 'var(--color-surface)', color: 'var(--color-on-surface-variant)', fontWeight: 600, fontSize: '0.78rem' }}
                        />
                        {activo.perfil.alergia && (
                          <Chip
                            icon={<Icon name="warning" className="text-sm !text-on-error-container" />}
                            label={`Alergia: ${activo.perfil.alergia}`}
                            sx={{ bgcolor: 'var(--color-error-container)', color: 'var(--color-on-error-container)', fontWeight: 700, fontSize: '0.78rem' }}
                          />
                        )}
                        <Chip
                          icon={<Icon name="assignment_ind" className="text-sm !text-tertiary" />}
                          label={activo.perfil.antecedente}
                          sx={{ bgcolor: 'var(--color-surface)', color: 'var(--color-on-surface-variant)', fontWeight: 600, fontSize: '0.78rem' }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Icon name="history" className="text-lg" />}
                        onClick={() => setHistorialAbierto(true)}
                        sx={{
                          borderColor: 'var(--color-outline-variant)',
                          color: 'var(--color-on-surface-variant)',
                          textTransform: 'none',
                          borderRadius: 3,
                          fontWeight: 600,
                        }}
                      >
                        Historial
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Icon name="print" className="text-lg" />}
                        onClick={() => setRecetaAbierto(true)}
                        sx={{
                          borderColor: 'var(--color-outline-variant)',
                          color: 'var(--color-on-surface-variant)',
                          textTransform: 'none',
                          borderRadius: 3,
                          fontWeight: 600,
                        }}
                      >
                        Imprimir
                      </Button>
                    </div>
                  </div>
                </section>

                {/* Formulario clínico */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Motivo de consulta */}
                  <section className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                        <Icon name="description" filled className="text-base" />
                      </span>
                      <h3 className="text-sm font-bold text-primary">Motivo de Consulta</h3>
                    </div>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      value={form.motivo}
                      onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                      placeholder="Síntoma principal y duración..."
                      sx={fieldSx}
                    />
                  </section>

                  {/* Examen físico */}
                  <section className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                        <Icon name="stethoscope" filled className="text-base" />
                      </span>
                      <h3 className="text-sm font-bold text-primary">Examen Físico</h3>
                    </div>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      value={form.examen}
                      onChange={(e) => setForm((f) => ({ ...f, examen: e.target.value }))}
                      placeholder="Hallazgos en exploración física..."
                      sx={fieldSx}
                    />
                  </section>

                  {/* Diagnóstico CIE-10 */}
                  <section className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                        <Icon name="medical_information" filled className="text-base" />
                      </span>
                      <h3 className="text-sm font-bold text-primary">Diagnóstico CIE-10</h3>
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
                  <section className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                        <Icon name="medication" filled className="text-base" />
                      </span>
                      <h3 className="text-sm font-bold text-primary">Tratamiento / Indicaciones</h3>
                    </div>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      value={form.tratamiento}
                      onChange={(e) => setForm((f) => ({ ...f, tratamiento: e.target.value }))}
                      placeholder="Medicación, dosis y frecuencia..."
                      sx={fieldSx}
                    />
                  </section>

                  {/* Recomendaciones generales */}
                  <section className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6 lg:col-span-2">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                        <Icon name="tips_and_updates" filled className="text-base" />
                      </span>
                      <h3 className="text-sm font-bold text-primary">Recomendaciones Generales</h3>
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

                  {/* Recetas a despachar */}
                  <section className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6 lg:col-span-2">
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
                      {recetasContables.length > 0 && (
                        <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-surface border border-outline-variant text-on-surface-variant">
                          {disponibles}/{recetasContables.length} disponibles{sinStock > 0 && ` · ${sinStock} sin stock`}
                        </span>
                      )}
                    </div>
                    <div className="space-y-3 mt-4">
                      {recetas.length === 0 && (
                        <p className="text-sm text-on-surface-variant italic">Sin medicamentos recetados.</p>
                      )}
                      {recetas.map((r, i) => {
                        const disp = disponibilidad(r.nombre);
                        return (
                          <div key={i} className="flex items-start gap-3">
                            <span className="font-mono text-xs pt-3 w-6 text-on-surface-variant">
                              {(i + 1).toString().padStart(2, '0')}
                            </span>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <TextField
                                  size="small"
                                  value={r.nombre}
                                  onChange={(e) => cambiarReceta(i, 'nombre', e.target.value)}
                                  placeholder="Medicamento y concentración (ej. Amoxicilina 500mg)"
                                  sx={fieldSx}
                                />
                                <TextField
                                  size="small"
                                  value={r.posologia}
                                  onChange={(e) => cambiarReceta(i, 'posologia', e.target.value)}
                                  placeholder="Posología (ej. 1 cáp. c/8 h por 7 días)"
                                  sx={fieldSx}
                                />
                              </div>
                              {r.nombre.trim() && (
                                <div className="flex items-center gap-2 pl-0">
                                  {disp.estado === 'ok' && (
                                    <Chip
                                      size="small"
                                      icon={<Icon name="check_circle" className="text-sm !text-success" />}
                                      label={`Disponible · ${disp.stock} en farmacia`}
                                      sx={{ bgcolor: 'var(--color-success)', color: '#fff', fontWeight: 600, fontSize: '0.68rem' }}
                                    />
                                  )}
                                  {disp.estado === 'bajo' && (
                                    <Chip
                                      size="small"
                                      icon={<Icon name="warning" className="text-sm" />}
                                      label={`Stock bajo · ${disp.stock} en farmacia`}
                                      sx={{ bgcolor: 'var(--color-amber)', color: '#fff', fontWeight: 600, fontSize: '0.68rem' }}
                                    />
                                  )}
                                  {disp.estado === 'no' && (
                                    <Chip
                                      size="small"
                                      icon={<Icon name="error" className="text-sm !text-on-error-container" />}
                                      label="No disponible"
                                      sx={{ bgcolor: 'var(--color-error-container)', color: 'var(--color-on-error-container)', fontWeight: 700, fontSize: '0.68rem' }}
                                    />
                                  )}
                                  {disp.estado === 'none' && (
                                    <span className="font-mono text-[10px] text-on-surface-variant">
                                      Escriba el medicamento para verificar disponibilidad
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <IconButton
                              onClick={() => quitarReceta(i)}
                              sx={{ color: 'var(--color-error)', mt: 0.5 }}
                              aria-label={`Quitar receta ${i + 1}`}
                            >
                              <Icon name="delete" className="text-lg" />
                            </IconButton>
                          </div>
                        );
                      })}
                      <button
                        onClick={agregarReceta}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline underline-offset-4"
                      >
                        <Icon name="add" className="text-lg" />
                        Agregar medicamento
                      </button>
                    </div>
                  </section>

                  {/* Estudios y resultados */}
                  <section className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 md:p-6 lg:col-span-2">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                          <Icon name="monitor_heart" filled className="text-base" />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-primary">Estudios y Resultados</h3>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                            Laboratorio · Imagen · Funcional — escanee o tome foto para llenado automático
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
                          return (
                            <button
                              key={t.id}
                              role="tab"
                              aria-selected={activado}
                              onClick={() => setTabEstudio(t.id)}
                              className={`flex-1 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                                activado ? 'bg-surface text-secondary shadow-sm' : 'text-on-surface-variant hover:text-secondary'
                              }`}
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
                          <div key={est.id} className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3">
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
                            <div className="flex items-center gap-2.5 pl-9">
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
              </div>

              {/* Barra de acciones inferior */}
              <div className="shrink-0 border-t border-outline-variant bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3">
                <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Icon name="science" className="text-base" />}
                    onClick={() => abrirOrden('laboratorio')}
                    sx={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)', textTransform: 'none', borderRadius: 2.5, fontWeight: 600 }}
                  >
                    Orden de Laboratorio
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Icon name="image_search" className="text-base" />}
                    onClick={() => abrirOrden('imagen')}
                    sx={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)', textTransform: 'none', borderRadius: 2.5, fontWeight: 600 }}
                  >
                    Orden de Imagen
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<Icon name="emergency" className="text-base" />}
                    onClick={() => setAviso('Alerta de urgencia notificada al equipo de emergencias.')}
                    sx={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', textTransform: 'none', borderRadius: 2.5, fontWeight: 700 }}
                  >
                    Urgencia
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Icon name="print" className="text-base" />}
                    onClick={() => setRecetaAbierto(true)}
                    className="order-last md:order-none flex-1 md:flex-none"
                    sx={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)', textTransform: 'none', borderRadius: 2.5, fontWeight: 600 }}
                  >
                    Imprimir Receta
                  </Button>
                  <div className="flex-1" />
                  {error && (
                    <span className="text-xs font-semibold text-error max-w-[240px] truncate order-2 w-full md:w-auto md:order-none">
                      {error}
                    </span>
                  )}
                  <Button
                    variant="contained"
                    onClick={guardarConsulta}
                    disabled={!puedeGuardar || guardando}
                    startIcon={
                      guardando ? <Icon name="sync" className="animate-spin text-base" /> : <Icon name="check_circle" className="text-base" />
                    }
                    className="flex-1 md:flex-none"
                    sx={{
                      backgroundColor: 'var(--color-secondary)',
                      '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
                      '&.Mui-disabled': { bgcolor: 'var(--color-secondary)/0.5', color: '#fff' },
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 3,
                      px: 3,
                    }}
                  >
                    {guardando ? 'Registrando...' : 'Finalizar Consulta'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-md">
                <div className="mx-auto w-20 h-20 rounded-full bg-secondary-container/30 text-secondary flex items-center justify-center mb-5">
                  <Icon name="stethoscope" className="text-4xl" />
                </div>
                <h2 className="text-2xl font-extrabold text-primary mb-2">Seleccione un paciente</h2>
                <p className="text-sm text-on-surface-variant">
                  Elija un turno de la cola para comenzar la valoración clínica, el diagnóstico
                  y el registro de la consulta.
                </p>
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
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'var(--color-primary)' }}>
          <span className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
            <Icon name="history" filled className="text-lg" />
          </span>
          Historial clínico de {activo?.nombre}
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
            <ol className="divide-y divide-outline-variant/60">
              {historial.historial.length === 0 && (
                <p className="text-sm text-on-surface-variant italic">
                  Paciente {historial.paciente.nombre_completo} · {historial.total_consultas} consultas registradas.
                </p>
              )}
              {historial.historial.map((c, i) => (
                <li key={c.consulta_id} className="py-3.5 flex items-start gap-4">
                  <span className="font-mono text-xs pt-1 w-6 text-on-surface-variant">{(i + 1).toString().padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                        {formatoFecha(c.fecha)}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-secondary font-semibold">
                        {c.especialidad}
                      </span>
                      <span className="font-mono text-[10px] text-on-surface-variant">{c.medico_nombre}</span>
                    </div>
                    <p className="text-sm text-primary mt-1">
                      <span className="font-semibold text-secondary">{c.cie10_codigo}</span>{' '}
                      {c.cie10_descripcion} — {c.motivo_consulta}
                    </p>
                    {c.recetas?.length > 0 && (
                      <p className="font-mono text-[10px] text-on-surface-variant mt-1 truncate">
                        Rx: {c.recetas.map((r) => r.nombre).join(' · ')}
                      </p>
                    )}
                    {c.estudios?.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {c.estudios.map((e, ei) => (
                          <p key={ei} className="font-mono text-[10px] text-on-surface-variant truncate">
                            <span className="uppercase tracking-widest text-secondary">{e.tipo}</span> · {e.nombre}
                            {e.parametros?.length > 0 && (
                              <> — {e.parametros.map((p) => `${p.parametro} ${p.valor}`).join(' · ')}</>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
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
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'var(--color-primary)' }}>
          <span className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
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
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'var(--color-primary)' }}>
          <span className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
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
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'var(--color-primary)' }}>
          <span className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
            <Icon name={ordenCategoria === 'laboratorio' ? 'science' : ordenCategoria === 'imagen' ? 'image_search' : 'monitor_heart'} filled className="text-lg" />
          </span>
          <div>
            Orden médica de estudios
            <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-on-surface-variant mt-0.5">
              Seleccione los exámenes a solicitar para {activo?.nombre}
            </p>
          </div>
        </DialogTitle>
        <DialogContent dividers>
          <div className="space-y-3">
            {/* Categorías */}
            <div className="flex bg-surface-container rounded-full p-1" role="tablist" aria-label="Categoría de la orden">
              {[
                { id: 'laboratorio', etiqueta: 'Laboratorio', icono: 'science' },
                { id: 'imagen', etiqueta: 'Imagen', icono: 'image_search' },
                { id: 'funcional', etiqueta: 'Funcional', icono: 'monitor_heart' },
              ].map((t) => {
                const activado = ordenCategoria === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={activado}
                    onClick={() => {
                      setOrdenCategoria(t.id);
                      setOrdenBusqueda('');
                    }}
                    className={`flex-1 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      activado ? 'bg-surface text-secondary shadow-sm' : 'text-on-surface-variant hover:text-secondary'
                    }`}
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
              {ordenGrupos.map((g) => (
                <div key={g.grupo} className="py-2">
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <span className="w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                      <Icon name={g.icono} className="text-sm" />
                    </span>
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">{g.grupo}</span>
                    <span className="font-mono text-[10px] text-on-surface-variant">
                      {g.estudios.filter((e) => ordenSeleccion.includes(e)).length}/{g.estudios.length}
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
                                '&.Mui-checked': { color: 'var(--color-secondary)' },
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
              ))}
            </div>

            <Divider />
            <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
              {ordenSeleccion.length} estudio(s) seleccionado(s) · la orden se guardará en la consulta
            </p>
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
              backgroundColor: 'var(--color-secondary)',
              '&:hover': { backgroundColor: 'var(--color-secondary-dark)' },
              '&.Mui-disabled': { bgcolor: 'var(--color-secondary)/0.5', color: '#fff' },
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            Emitir orden ({ordenSeleccion.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Sello: consulta registrada ===== */}
      <Dialog
        open={!!registrada}
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 4, textAlign: 'center', px: 2, py: 1 } }}
      >
        <DialogContent>
          <span
            className="block font-display italic font-black text-3xl tracking-tight border-[4px] rounded px-5 py-2 text-success"
            style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)', animation: 'var(--animate-stamp)' }}
          >
            Consulta registrada
          </span>
          <p className="text-sm text-on-surface-variant mt-5">
            Comprobante de referencia:
            <span className="block font-mono text-base font-semibold text-primary mt-1">{registrada}</span>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mt-3">
            Paciente notificado · Historial actualizado
          </p>
        </DialogContent>
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
    </div>
  );
}

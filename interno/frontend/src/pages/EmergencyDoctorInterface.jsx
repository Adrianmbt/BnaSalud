import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { compartirPdf } from '../utils/compartirPdf';
import { useCerrarConAtras } from '../components/ModalStack';
import {
  Activity,
  Thermometer,
  Gauge,
  Ruler,
  Droplets,
  Wind,
  Scale,
  Stethoscope,
  FileText,
  Pill,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  RefreshCw,
  Clock3,
  ArrowRight,
  User,
  X,
  Send,
  Save,
  Heart,
  History,
  Search,
  ShieldCheck,
  Phone,
  FileDown,
  ListChecks,
  Menu,
  Settings2,
  Microscope,
  CalendarCheck,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import AtendidosHoy from '../components/AtendidosHoy';
import { useTheme } from '../components/ThemeProvider';
import { EmergencyBadge } from '../components/SpecialtyBadge';
import { CATALOGO_EXAMENES, categoriaEstilo, grupoEstilo, CATEGORIAS_ORDEN } from '../clinical/catalogoExamenes';
import MedicalOrderSelector, { examenesASeleccionados, seleccionadosAExamenes } from '../components/specialist/MedicalOrderSelector';
import PanelModal from '../components/specialist/PanelModal';
import VerHistorial from '../components/specialist/VerHistorial';

const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const FRECUENCIAS_POSOLOGIA = ['c/6 h', 'c/8 h', 'c/12 h', 'c/24 h', 'SOS', 'PRN'];
const DURACIONES_POSOLOGIA = ['3 días', '5 días', '7 días', '10 días', '15 días'];

const posologiaBase = (med) => {
  if (!med) return '';
  const pres = (med.presentacion || '').toLowerCase().trim();
  if (/(ampolla|inyect|vial)/.test(pres)) return '1 ampolla';
  if (/(inhalador|aerosol|spray|inhalacion|puff)/.test(pres)) return '2 inhalaciones';
  if (/(gota|gotas)/.test(pres)) return '20 gotas';
  if (/(suspension|jarabe|solucion oral)/.test(pres)) return '1 medida';
  if (/(sobre)/.test(pres)) return '1 sobre';
  if (/(crema|unguento|ungüento|pomada)/.test(pres)) return 'aplicar en la zona';
  if (/(supositorio|óvulo|ovulo)/.test(pres)) return '1 unidad';
  if (/(comprimido)/.test(pres)) return '1 comprimido';
  if (/(tableta|píldora|grajea)/.test(pres)) return '1 tableta';
  if (/(cápsula|capsula|perla)/.test(pres)) return '1 cápsula';
  return '1 unidad';
};

const SIGNOS = [
  { key: 'presion_arterial', label: 'P.A.', unidad: 'mmHg', icon: Gauge, ph: '120/80' },
  { key: 'frecuencia_cardiaca', label: 'F.C.', unidad: 'lpm', icon: Heart, ph: '72' },
  { key: 'frecuencia_respiratoria', label: 'F.R.', unidad: 'rpm', icon: Wind, ph: '16' },
  { key: 'temperatura', label: 'T°', unidad: '°C', icon: Thermometer, ph: '37.0' },
  { key: 'saturacion_oxigeno', label: 'SpO₂', unidad: '%', icon: Droplets, ph: '98' },
  { key: 'peso_kg', label: 'Peso', unidad: 'kg', icon: Scale, ph: '70' },
  { key: 'talla_cm', label: 'Talla', unidad: 'cm', icon: Ruler, ph: '168' },
];

const SIGNOS_VACIOS = {
  presion_arterial: '',
  frecuencia_cardiaca: '',
  frecuencia_respiratoria: '',
  temperatura: '',
  saturacion_oxigeno: '',
  peso_kg: '',
  talla_cm: '',
};

const RANGOS_NORMALES = {
  presion_arterial: { sist: [90, 140], diast: [60, 90] },
  frecuencia_cardiaca: [60, 100],
  frecuencia_respiratoria: [12, 20],
  temperatura: [36, 37.5],
  saturacion_oxigeno: [95, 100],
};

function estadoSigno(key, valor) {
  const txt = (valor == null ? '' : String(valor)).trim();
  if (!txt) return null;
  const r = RANGOS_NORMALES[key];
  if (!r) return null;
  if (key === 'presion_arterial') {
    const m = txt.match(/^\s*(\d+)\s*[/-]\s*(\d+)/);
    if (!m) return null;
    return +m[1] >= r.sist[0] && +m[1] <= r.sist[1] && +m[2] >= r.diast[0] && +m[2] <= r.diast[1]
      ? 'ok'
      : 'alto';
  }
  const n = parseFloat(txt);
  if (Number.isNaN(n)) return null;
  return n >= r[0] && n <= r[1] ? 'ok' : 'alto';
}

function chipPrio(p) {
  if (p === 1) return 'bg-red-100 text-red-700';
  if (p === 2) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function tiempoEnEspera(p) {
  const base = p.fec_encolada || p.creado_en;
  if (!base) return '';
  return `${Math.max(0, Math.floor((new Date() - new Date(base)) / 60000))} min`;
}

function ColaSeleccion({ titulo, subtitulo, icon: Icono, items, acento, seleccion, onSeleccion, busy, onTomar }) {
  const elegido = items.find((p) => p.id === seleccion) || null;
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden animate-fade-up">
      <div className="px-5 py-3 flex items-center justify-between gap-3 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-9 w-9 shrink-0 rounded-xl ${acento.iconBg} ${acento.iconText} flex items-center justify-center`}>
            <Icono className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-sm text-brand-deep truncate">{titulo}</h3>
            <p className="text-[11px] text-slate-400 truncate">{subtitulo}</p>
          </div>
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${acento.badge}`}>
          {items.length} en espera
        </span>
      </div>
      <div className="px-5 py-3">
        {items.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-3">Sin pacientes en este grupo.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((p) => {
              const sel = seleccion === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSeleccion(p.id)}
                    aria-pressed={sel}
                    className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all ring-1 ${
                      sel ? `${acento.rowBg} ${acento.rowRing} shadow-sm` : 'bg-slate-50/80 ring-slate-100 active:bg-slate-100'
                    }`}
                  >
                    {sel ? <CheckCircle2 className={`w-4 h-4 shrink-0 ${acento.iconText}`} /> : null}
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{p.paciente_nombre}</p>
                      <p className="font-mono text-[10px] text-slate-400 truncate">
                        C.I. {p.paciente_cedula} · {p.token || `T-${p.id}`}
                      </p>
                    </div>
                    <span className={`ml-auto shrink-0 font-mono text-[10px] font-bold px-2 py-0.5 rounded ${chipPrio(p.prioridad)}`}>P{p.prioridad}</span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">{tiempoEnEspera(p)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          disabled={!elegido || !!busy}
          onClick={onTomar}
          className={`mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 ${acento.btn}`}
        >
          <ArrowRight className="w-4 h-4" />
          {busy ? 'Tomando paciente…' : elegido ? `Tomar a ${elegido.paciente_nombre.split(' ')[0]}` : 'Toca un paciente para elegirlo'}
        </button>
      </div>
    </div>
  );
}

const CONFIRM_CFG = {
  finalizar: {
    titulo: 'Finalizar consulta',
    desc: 'Se guardará la consulta completa en el expediente y el paciente saldrá de la cola de emergencias.',
    boton: 'Finalizar consulta',
    clase: 'bg-brand-success hover:bg-brand-success',
  },
  remitir: {
    titulo: 'Remitir paciente',
    desc: 'La consulta quedará registrada y el paciente será marcado como derivado al especialista indicado.',
    boton: 'Remitir y guardar',
    clase: 'bg-brand-primary hover:bg-brand-deep',
  },
};

const REMISION_NIVEL = {
  azul: {
    etiqueta: 'Azul',
    corto: 'Trabajador / beneficiario',
    desc: 'Cobertura completa. No requiere condición y tiene disponibilidad total de especialistas.',
    dot: 'bg-sky-500',
    softText: 'text-sky-700',
    softBg: 'bg-sky-50',
    ring: 'ring-sky-500',
    seleccionado: 'ring-2 ring-sky-500 bg-sky-500 text-white',
    chip: 'border-sky-300 bg-sky-50 text-sky-800 hover:border-sky-500 hover:bg-sky-100',
    chipSel: 'bg-sky-500 text-white border-sky-600',
  },
  verde: {
    etiqueta: 'Verde',
    corto: 'Público general · urgente',
    desc: 'Casos urgentes del público general según criterio del médico de emergencias. Ventana de 2 semanas según disponibilidad del especialista.',
    dot: 'bg-emerald-500',
    softText: 'text-emerald-700',
    softBg: 'bg-emerald-50',
    ring: 'ring-emerald-500',
    seleccionado: 'ring-2 ring-emerald-500 bg-emerald-500 text-white',
    chip: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500 hover:bg-emerald-100',
    chipSel: 'bg-emerald-500 text-white border-emerald-600',
  },
  amarillo: {
    etiqueta: 'Amarillo',
    corto: 'Público general · menos urgente',
    desc: 'Casos menos urgentes del público general. Prioridad baja de asignación de especialista.',
    dot: 'bg-amber-400',
    softText: 'text-amber-700',
    softBg: 'bg-amber-50',
    ring: 'ring-amber-400',
    seleccionado: 'ring-2 ring-amber-400 bg-amber-400 text-white',
    chip: 'border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400 hover:bg-amber-100',
    chipSel: 'bg-amber-400 text-white border-amber-500',
  },
};

function isoDe(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function CalendarioDisponibilidad({ dias, desde, hasta, seleccion, onSeleccion }) {
  const desdeDate = desde ? new Date(`${desde}T00:00:00`) : new Date();
  const [cursor, setCursor] = useState(() => new Date(desdeDate.getFullYear(), desdeDate.getMonth(), 1));

  const irMes = (delta) => {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    const ultimo = hasta ? new Date(`${hasta}T00:00:00`) : null;
    if (ultimo && d.getFullYear() * 12 + d.getMonth() > ultimo.getFullYear() * 12 + ultimo.getMonth()) return;
    if (d.getFullYear() * 12 + d.getMonth() < desdeDate.getFullYear() * 12 + desdeDate.getMonth()) return;
    setCursor(d);
  };

  const anio = cursor.getFullYear();
  const mes = cursor.getMonth();
  const primerDiaMes = isoDe(new Date(anio, mes, 1));
  const primerSemana = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const totalDias = new Date(anio, mes + 1, 0).getDate();

  const celdas = [];
  for (let i = 0; i < primerSemana; i++) celdas.push(null);
  for (let d = 1; d <= totalDias; d++) celdas.push(isoDe(new Date(anio, mes, d)));

  const hoyIso = isoDe(new Date());
  const puedoVolver = cursor.getFullYear() * 12 + cursor.getMonth() > desdeDate.getFullYear() * 12 + desdeDate.getMonth();
  const puedoAvanzar = hasta
    ? cursor.getFullYear() * 12 + cursor.getMonth() < new Date(`${hasta}T00:00:00`).getFullYear() * 12 + new Date(`${hasta}T00:00:00`).getMonth()
    : true;

  return (
    <div className="rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <button
          type="button"
          onClick={() => irMes(-1)}
          disabled={!puedoVolver}
          aria-label="Mes anterior"
          className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ‹
        </button>
        <span className="text-[13px] font-bold text-slate-700 capitalize">
          {cursor.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => irMes(1)}
          disabled={!puedoAvanzar}
          aria-label="Mes siguiente"
          className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase py-1.5">
        {DIAS_SEMANA.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 px-1.5 pb-2">
        {celdas.map((iso, idx) => {
          if (!iso) return <span key={`b-${idx}`} />;
          const enRango = (!desde || iso >= desde) && (!hasta || iso <= hasta);
          const disp = dias && dias[iso] && dias[iso].disponible;
          const pasado = iso < hoyIso;
          const activo = seleccion === iso;
          let cls = 'bg-slate-50 text-slate-300';
          if (pasado || !enRango) cls = 'bg-slate-50 text-slate-300 cursor-not-allowed';
          else if (disp) cls = 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer';
          else cls = 'bg-rose-100 text-rose-500 cursor-not-allowed';
          if (activo) cls = 'bg-brand-primary text-white shadow-sm cursor-pointer ring-2 ring-brand-primary';
          return (
            <button
              key={iso}
              type="button"
              disabled={pasado || !enRango || !disp}
              onClick={() => onSeleccion && onSeleccion(iso)}
              className={`aspect-square rounded-md text-[11px] font-semibold transition-colors ${cls}`}
              title={disp ? `${iso} · Disponible` : `${iso} · No disponible`}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-t border-slate-100 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-200 inline-block" /> Disponible</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-rose-100 inline-block" /> No disponible</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-slate-200 inline-block" /> Fuera de ventana</span>
      </div>
    </div>
  );
}

function parseLista(txt = '') {
  return String(txt)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function n2num(valor) {
  const n = parseFloat(String(valor || '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function formatearFecha(cadena) {
  if (!cadena) return '—';
  const fecha = new Date(cadena);
  if (Number.isNaN(fecha.getTime())) return cadena;
  return fecha.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useModalFocus(activo, onClose, autofocusId) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!activo) return undefined;
    const previamente = document.activeElement;
    const panel = document.getElementById(autofocusId)?.closest('[role="dialog"]');

    const focoInicial = () => {
      if (autofocusId && document.getElementById(autofocusId)) {
        document.getElementById(autofocusId).focus();
        return;
      }
      const foco = panel?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      foco?.[0]?.focus();
    };

    const tecla = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const foco = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const primero = foco[0];
      const ultimo = foco[foco.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    focoInicial();
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      previamente?.focus?.();
    };
  }, [activo, autofocusId]);
}

export default function EmergencyDoctorInterface({ userName = 'Médico de Emergencias', personalId = null, clinicaId = null, clinicaNombre = '', onLogout }) {
  const { centerFullName, centerLogo } = useTheme();
  const [pacienteActual, setPacienteActual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [esperaCola, setEsperaCola] = useState([]);
  const [tabCola, setTabCola] = useState('trab');
  const [seleccionId, setSeleccionId] = useState(null);

  const listaTrab = useMemo(() => esperaCola.filter((p) => p.categoria !== 'publico'), [esperaCola]);
  const listaPublico = useMemo(() => esperaCola.filter((p) => p.categoria === 'publico'), [esperaCola]);
  const [tomarBusy, setTomarBusy] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [destino, setDestino] = useState('');
  const [nivelRemision, setNivelRemision] = useState(null);
  const [esAfiliado, setEsAfiliado] = useState(false);
  const [analizandoRemision, setAnalizandoRemision] = useState(false);
  const [especialistas, setEspecialistas] = useState([]);
  const [especialistasCargando, setEspecialistasCargando] = useState(false);
  const [especialistaSel, setEspecialistaSel] = useState(null);
  const [availDias, setAvailDias] = useState({});
  const [availRango, setAvailRango] = useState(null);
  const [agendaCargando, setAgendaCargando] = useState(false);
  const [fechaSel, setFechaSel] = useState(null);
  const [horaSel, setHoraSel] = useState(null);
  const [turnosSel, setTurnosSel] = useState([]);
  const [turnosCargando, setTurnosCargando] = useState(false);
  const [citaInfo, setCitaInfo] = useState(null);
  const [agendaError, setAgendaError] = useState('');
  const [retomarAbierto, setRetomarAbierto] = useState(false);
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [now, setNow] = useState(new Date());

  const [busqueda, setBusqueda] = useState('');
  const [buscandoHistoria, setBuscandoHistoria] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [resultadoHistoria, setResultadoHistoria] = useState(null);

  const [signos, setSignos] = useState(SIGNOS_VACIOS);
  const [motivo, setMotivo] = useState('');
  const [examenFisico, setExamenFisico] = useState('');
  const [historia, setHistoria] = useState({ tipo_sangre: '', antecedentes: '', operatorios: '', alergias: '', telefono: '' });
  const [guardandoFicha, setGuardandoFicha] = useState(false);
  const [fichaGuardada, setFichaGuardada] = useState(false);
  const [fichaError, setFichaError] = useState('');
  const [historiaCargada, setHistoriaCargada] = useState(false);
  const [diagnostico, setDiagnostico] = useState('');
  const [tratamiento, setTratamiento] = useState('');
  const [indicaciones, setIndicaciones] = useState('');
  const [recetas, setRecetas] = useState([{ nombre: '', posologia: '' }]);
  const [examenes, setExamenes] = useState({
    laboratorio: { activo: false, items: [] },
    imagen: { activo: false, items: [] },
    funcional: { activo: false, items: [] },
    anatomia_patologica: { activo: false, items: [] },
  });
  const [insumos, setInsumos] = useState([]);
  const [insumosAbierto, setInsumosAbierto] = useState(false);
  const [inventario, setInventario] = useState([]);
  const [inventarioError, setInventarioError] = useState('');
  const [insumoBusqueda, setInsumoBusqueda] = useState('');
  const [insumosCargando, setInsumosCargando] = useState(false);

  // Catálogo de medicamentos para recetas
  const [catMedAbierto, setCatMedAbierto] = useState(null); // idx de la receta cuyo buscador está abierto
  const [catMedNuevoAbierto, setCatMedNuevoAbierto] = useState(false);
  const [catMedicamentos, setCatMedicamentos] = useState([]);
  const [catMedCargando, setCatMedCargando] = useState(false);
  const [catMedBusqueda, setCatMedBusqueda] = useState('');
  const [catMedError, setCatMedError] = useState('');
  const [catMedNuevo, setCatMedNuevo] = useState({ nombre: '', presentacion: '', concentracion: '', posologia_sugerida: '' });
  const [catMedGuardando, setCatMedGuardando] = useState(false);
  const [catMedMsg, setCatMedMsg] = useState('');

  const [vitalesAbierto, setVitalesAbierto] = useState(false);
  // En móvil la ficha se lee de a una sección (pills fijas bajo el header) en
  // vez de las cuatro apiladas. En lg: cada sección se ignora y se ven todas.
  const [seccion, setSeccion] = useState('motivo');
  const motivoRef = useRef(null);
  const diagnosticoRef = useRef(null);
  const [ordenAbierta, setOrdenAbierta] = useState(false);
  const [ordenCategoria, setOrdenCategoria] = useState('laboratorio');
  const [ordenBusqueda, setOrdenBusqueda] = useState('');
  const [ordenSeleccion, setOrdenSeleccion] = useState([]);
  const [examSeleccionados, setExamSeleccionados] = useState(new Map());
  const [pdfGenerando, setPdfGenerando] = useState(false);
  const [accionesAbierto, setAccionesAbierto] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  // Consulta del día que se está retomando/actualizando (siguiendo la regla de 1 por día).
  const [retomoInfo, setRetomoInfo] = useState(null); // { consultaId, comprobanteRef, remitido } | null

  // ---- Remisión de exámenes a centros adscritos ----
  const [exremAbierto, setExremAbierto] = useState(false);
  const [exremElegible, setExremElegible] = useState(null); // null | { elegible, tipo }
  const [exremBusqueda, setExremBusqueda] = useState('');
  const [exremCatalogo, setExremCatalogo] = useState([]);
  const [exremCatalogoCargando, setExremCatalogoCargando] = useState(false);

  // Boton atras de Android: cada overlay fijo se apila aqui para cerrarse con el
  // gesto en vez de sacar la app. Los que usan PanelModal ya van incluidos.
  useCerrarConAtras(accionesAbierto, () => setAccionesAbierto(false), 'Acciones de la consulta');
  useCerrarConAtras(insumosAbierto, () => setInsumosAbierto(false), 'Insumos y tratamientos');
  useCerrarConAtras(retomarAbierto, () => setRetomarAbierto(false), 'Retomar paciente');
  useCerrarConAtras(!!catMedAbierto, () => setCatMedAbierto(null), 'Catalogo de medicamentos');
  useCerrarConAtras(catMedNuevoAbierto, () => setCatMedNuevoAbierto(false), 'Nuevo medicamento');
  useCerrarConAtras(exremAbierto, () => setExremAbierto(false), 'Remision de examenes');
  const [exremSel, setExremSel] = useState(null);
  const [exremSelDias, setExremSelDias] = useState({});
  const [exremSelRango, setExremSelRango] = useState(null);
  const [exremFecha, setExremFecha] = useState('');
  const [exremHora, setExremHora] = useState('');
  const [exremAcepta, setExremAcepta] = useState(false);
  const [exremMotivo, setExremMotivo] = useState('');
  const [exremCita, setExremCita] = useState(null);
  const [exremError, setExremError] = useState('');
  const [exremCreando, setExremCreando] = useState(false);

  const formRef = useRef(null);

  const vaciarFormulario = useCallback(() => {
    setSignos(SIGNOS_VACIOS);
    setMotivo('');
    setExamenFisico('');
    setHistoria({ tipo_sangre: '', antecedentes: '', operatorios: '', alergias: '', telefono: '' });
    setHistoriaCargada(false);
    setDiagnostico('');
    setTratamiento('');
    setIndicaciones('');
    setRecetas([{ nombre: '', posologia: '' }]);
    setExamenes({
      laboratorio: { activo: false, items: [] },
      imagen: { activo: false, items: [] },
      funcional: { activo: false, items: [] },
      anatomia_patologica: { activo: false, items: [] },
    });
    setInsumos([]);
    setError('');
    setResultado(null);
    setRetomoInfo(null);
    setVitalesAbierto(false);
    resetExamenRem();
    setExremCita(null);
  }, []);

  const aplicarHistoria = useCallback((h) => {
    setHistoria({
      tipo_sangre: h.tipo_sangre || '',
      antecedentes: Array.isArray(h.antecedentes_medicos) ? h.antecedentes_medicos.join('\n') : '',
      operatorios: Array.isArray(h.antecedentes_operatorios) ? h.antecedentes_operatorios.join('\n') : '',
      alergias: Array.isArray(h.alergias) ? h.alergias.join('\n') : '',
      telefono: h.telefono || '',
    });
    setHistoriaCargada(true);
  }, []);

  const pacienteIdRef = useRef(null);
  const cargadoInicialRef = useRef(false);
  const pacienteActualRef = useRef(pacienteActual);

  useEffect(() => {
    pacienteActualRef.current = pacienteActual;
  }, [pacienteActual]);

  useEffect(() => {
    if (!pacienteActual?.paciente_cedula) {
      setExremElegible(null);
      return;
    }
    let activo = true;
    (async () => {
      try {
        const { data } = await axiosClient.get('/remision-examen/elegibilidad', {
          params: { cedula: pacienteActual.paciente_cedula },
        });
        if (activo) setExremElegible(data || { elegible: false, tipo: 'publico' });
      } catch {
        if (activo) setExremElegible({ elegible: false, tipo: 'publico' });
      }
    })();
    return () => { activo = false; };
  }, [pacienteActual?.paciente_cedula]);

  const fetchPacienteActual = useCallback(async () => {
    if (!cargadoInicialRef.current) {
      setLoading(true);
    }
    setError('');
    try {
      const params = { rol: 'medico_emergencia' };
      if (personalId) params.medico_id = personalId;
      if (clinicaId) params.clinica_id = clinicaId;
      const { data } = await axiosClient.get('/cola', { params });
      
      setEsperaCola(data.espera || []);
      
      // Primero buscar en consulta (pacientes ya atendidos)
      const enConsulta = (data.consulta || []).filter(
        (p) => !p.ruta_atencion || p.ruta_atencion === 'EMERGENCIA'
      );

      const primero = enConsulta[0] || null;

      if (primero) {
        // Si hay un paciente retomado activo, no sobreescribir automáticamente
        if (pacienteActualRef.current?._retomado) {
          return;
        }
        const cambioPaciente = pacienteIdRef.current !== primero.id;
        pacienteIdRef.current = primero.id;
        pacienteActualRef.current = primero;
        setPacienteActual(primero);
        if (cambioPaciente) {
          vaciarFormulario();
          if (primero.paciente_id && !primero._retomado) {
            try {
              const { data: h } = await axiosClient.get(`/historias-clinicas/${primero.paciente_cedula}`);
              aplicarHistoria(h);
            } catch {
              setHistoriaCargada(false);
            }
          }
        }
      } else {
        // Si no hay paciente en la cola, verificar si hay un paciente retomado activo
        if (pacienteActualRef.current?._retomado) {
          return;
        }
        pacienteIdRef.current = null;
        pacienteActualRef.current = null;
        setPacienteActual(null);
        setRetomoInfo(null);
        setHistoriaCargada(false);
      }
    } catch {
      setError('No se pudo contactar el servidor de cola. Verifica la conexión.');
    } finally {
      cargadoInicialRef.current = true;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaciarFormulario, aplicarHistoria, personalId, clinicaId]);

  const tomarPaciente = useCallback(
    async (paciente) => {
      const grupo = paciente.categoria === 'publico' ? 'publico' : 'trab';
      setTomarBusy(grupo);
      setError('');
      setAviso('');
      try {
        await axiosClient.patch(`/cola/${paciente.id}/transicion`, {
          nuevo_estado: 'EN_CONSULTA',
          cambiado_por: personalId,
        });
        const params = { rol: 'medico_emergencia' };
        if (personalId) params.medico_id = personalId;
        if (clinicaId) params.clinica_id = clinicaId;
        const { data } = await axiosClient.get('/cola', { params });
        setEsperaCola(data.espera || []);
        const cargado = (data.consulta || []).find((p) => p.id === paciente.id)
          || (data.consulta || [])[0]
          || null;
        const primero = cargado || null;
        pacienteIdRef.current = primero.id;
        pacienteActualRef.current = primero;
        setPacienteActual(primero);
        vaciarFormulario();
        if (primero.paciente_id && !primero._retomado) {
          try {
            const { data: h } = await axiosClient.get(`/historias-clinicas/${primero.paciente_cedula}`);
            aplicarHistoria(h);
          } catch {
            setHistoriaCargada(false);
          }
        }
      } catch (err) {
        const est = err?.response?.status;
        if (est === 400 || est === 409) {
          setAviso('Ese paciente ya fue tomado por otro médico. La cola se actualiza sola.');
          await fetchPacienteActual();
        } else {
          setError(err?.response?.data?.detail || 'No se pudo tomar el paciente de la cola.');
        }
      } finally {
        setTomarBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vaciarFormulario, aplicarHistoria, personalId, clinicaId]
  );

  useEffect(() => {
    fetchPacienteActual();
  }, [fetchPacienteActual]);

  useEffect(() => {
    const sondeo = setInterval(fetchPacienteActual, 9000);
    return () => clearInterval(sondeo);
  }, [fetchPacienteActual]);

  useEffect(() => {
    const reloj = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(reloj);
  }, []);

  useModalFocus(retomarAbierto, () => setRetomarAbierto(false), 'retomar-cedula');
  useModalFocus(!!confirm, () => setConfirm(null), null);
  useModalFocus(ordenAbierta, () => setOrdenAbierta(false), 'orden-busqueda');
  useModalFocus(fichaAbierta, () => setFichaAbierta(false), null);
  useModalFocus(insumosAbierto, () => setInsumosAbierto(false), 'insumo-busqueda');
  useModalFocus(accionesAbierto, () => setAccionesAbierto(false), null);
  useModalFocus(historialAbierto, () => setHistorialAbierto(false), null);
  useModalFocus(catMedAbierto !== null, () => setCatMedAbierto(null), 'catmed-busqueda');
  useModalFocus(catMedNuevoAbierto, () => setCatMedNuevoAbierto(false), 'catmed-nombre');

  const setSigno = (key) => (e) => setSignos((s) => ({ ...s, [key]: e.target.value }));

  const setReceta = (idx, campo) => (e) =>
    setRecetas((prev) => prev.map((r, i) => (i === idx ? { ...r, [campo]: e.target.value } : r)));

  const addReceta = () => setRecetas((prev) => [...prev, { nombre: '', posologia: '' }]);
  const delReceta = (idx) => () => setRecetas((prev) => prev.filter((_, i) => i !== idx));

  // ---------- Catálogo de medicamentos ----------
  const abrirCatMed = async (idx) => {
    setCatMedAbierto(idx);
    setCatMedBusqueda('');
    setCatMedError('');
    setCatMedicamentos([]);
    setCatMedCargando(true);
    try {
      const { data } = await axiosClient.get('/medicamentos');
      setCatMedicamentos(Array.isArray(data.items) ? data.items : []);
    } catch {
      setCatMedError('No se pudo cargar el catálogo de medicamentos.');
    } finally {
      setCatMedCargando(false);
    }
  };

  const seleccionarMedicamento = (item) => {
    if (catMedAbierto === null) return;
    const nombreCompleto = [item.nombre, item.presentacion, item.concentracion].filter(Boolean).join(' · ');
    setRecetas((prev) =>
      prev.map((r, i) =>
        i === catMedAbierto
          ? { nombre: nombreCompleto, posologia: r.posologia || posologiaBase(item) }
          : r
      )
    );
    setCatMedAbierto(null);
  };

  const resetCatMedNuevo = () => {
    setCatMedNuevo({ nombre: '', presentacion: '', concentracion: '', posologia_sugerida: '' });
    setCatMedMsg('');
    setCatMedError('');
  };

  const guardarMedicamentoNuevo = async (e) => {
    e.preventDefault();
    const nombre = catMedNuevo.nombre.trim();
    if (!nombre) {
      setCatMedError('El nombre del medicamento es obligatorio.');
      return;
    }
    setCatMedGuardando(true);
    setCatMedError('');
    setCatMedMsg('');
    try {
      const { data } = await axiosClient.post('/medicamentos', {
        nombre,
        presentacion: catMedNuevo.presentacion.trim(),
        concentracion: catMedNuevo.concentracion.trim(),
        posologia_sugerida: catMedNuevo.posologia_sugerida.trim(),
        creado_por: userName,
      });
      setCatMedicamentos((prev) => [data, ...prev.filter((m) => m.id !== data.id)]);
      setCatMedMsg(`"${data.nombre}" agregado al catálogo.`);
      setCatMedNuevo({ nombre: '', presentacion: '', concentracion: '', posologia_sugerida: '' });
      setCatMedNuevoAbierto(false);
      abrirCatMed(catMedAbierto);
    } catch (err) {
      const msg = err?.response?.data?.detail || 'No se pudo guardar el medicamento.';
      setCatMedError(typeof msg === 'string' ? msg : 'No se pudo guardar el medicamento.');
    } finally {
      setCatMedGuardando(false);
    }
  };

  const agregarPosologiaChip = (idx, chip) => {
    const grupo = FRECUENCIAS_POSOLOGIA.includes(chip) ? FRECUENCIAS_POSOLOGIA : DURACIONES_POSOLOGIA;
    const esFrecuencia = FRECUENCIAS_POSOLOGIA.includes(chip);
    const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tokenRx = (lista) => new RegExp(`(${lista.map(escapar).join('|')})(?![a-zA-Z0-9])`, 'i');
    setRecetas((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const base = (r.posologia || '').trim();
        let texto = base;
        let reemplazado = false;
        for (const tk of grupo) {
          const regex = new RegExp(`(^|[^a-zA-Z0-9])(${escapar(tk)})(?![a-zA-Z0-9])`, 'i');
          if (regex.test(base)) {
            texto = base.replace(regex, `$1${chip}`);
            reemplazado = true;
            break;
          }
        }
        if (reemplazado) return { ...r, posologia: texto };
        if (!base) return { ...r, posologia: chip };
        if (esFrecuencia) {
          const yaHayToken = tokenRx([...FRECUENCIAS_POSOLOGIA, ...DURACIONES_POSOLOGIA]).test(base);
          return { ...r, posologia: yaHayToken ? `${base} · ${chip}` : `${base} ${chip}` };
        }
        return { ...r, posologia: `${base} × ${chip}` };
      })
    );
  };

  const abrirInsumos = async () => {
    setInsumosAbierto(true);
    setInsumosCargando(true);
    setInsumoBusqueda('');
    setInventarioError('');
    try {
      const { data } = await axiosClient.get('/farmacia/inventario');
      setInventario(Array.isArray(data) ? data : []);
    } catch {
      setInventario([]);
      setInventarioError('No se pudo cargar el inventario de insumos y medicamentos.');
    } finally {
      setInsumosCargando(false);
    }
  };

  const agregarInsumo = (item) => {
    setInsumos((prev) => {
      const ya = prev.find((i) => String(i.insumo_id) === String(item.id) && i.tabla_origen === item.tabla_origen);
      if (ya) {
        return prev.map((i) =>
          i.insumo_id === item.id && i.tabla_origen === item.tabla_origen
            ? { ...i, cantidad: Math.min((i.cantidad || 0) + 1, item.stock_actual || 1) }
            : i
        );
      }
      return [...prev, {
        insumo_id: item.id,
        nombre: item.nombre,
        tipo: item.tipo === 'INSUMO' ? 'insumo' : 'medicamento',
        tabla_origen: item.tabla_origen || 'medicamentos_catalogo',
        cantidad: 1,
        unidad: item.unidad || 'unidad',
        stock_actual: item.stock_actual || 0,
      }];
    });
  };

  const quitarInsumo = (idx) => () => setInsumos((prev) => prev.filter((_, i) => i !== idx));
  const setInsumoCantidad = (idx, val) =>
    setInsumos((prev) => prev.map((i, j) => (j === idx ? { ...i, cantidad: Math.max(0, Math.min(Number(val) || 0, i.stock_actual || 9999)) } : i)));

  const resumen = useMemo(() => {
    const total = Object.values(SIGNOS).filter((s) => String(signos[s.key] || '').trim() !== '').length;
    const recetasOk = recetas.filter((r) => r.nombre.trim()).length;
    const examenesTotal = Object.keys(examenes).reduce(
      (acc, k) => (examenes[k].activo ? acc + examenes[k].items.filter((i) => i.estudio.trim()).length : acc),
      0
    );
    return {
      vitales: total,
      recetasOk,
      examenesTotal,
      completo: diagnostico.trim() !== '' && motivo.trim() !== '',
    };
  }, [signos, recetas, examenes, diagnostico, motivo]);

  // Secciones de la ficha en móvil. `hecho` alimenta el punto de completada de
  // cada pill; se anuncia en texto, no solo con color.
  const secciones = useMemo(
    () => [
      {
        id: 'motivo',
        etiqueta: 'Motivo',
        titulo: 'Motivo y diagnóstico',
        hecho: motivo.trim() !== '' && diagnostico.trim() !== '',
        resumen: `${motivo.trim() ? 1 : 0}/2 obligatorios`,
      },
      {
        id: 'tratamiento',
        etiqueta: 'Tratamiento',
        titulo: 'Tratamiento e indicaciones',
        hecho: tratamiento.trim() !== '' && indicaciones.trim() !== '',
        resumen: insumos.length > 0 ? `${insumos.length} insumos` : '',
      },
      {
        id: 'recetas',
        etiqueta: 'Recetas',
        titulo: 'Recetas médicas',
        hecho: resumen.recetasOk > 0,
        resumen: resumen.recetasOk > 0 ? `${resumen.recetasOk} receta(s)` : '',
      },
      {
        id: 'signos',
        etiqueta: 'Signos',
        titulo: 'Signos vitales',
        hecho: resumen.vitales > 0,
        resumen: `${resumen.vitales}/7`,
      },
    ],
    [motivo, diagnostico, tratamiento, indicaciones, insumos.length, resumen.recetasOk, resumen.vitales]
  );

  // Móvil: una sección a la vez. Al cambiar de pill se sube al inicio de la
  // ficha para que el header sticky no tape el campo enfocado.
  const irASeccion = useCallback((id) => {
    setSeccion(id);
    const main = document.getElementById('doc-main');
    if (main) main.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  const seccionVisible = useCallback((id) => `${seccion !== id ? 'hidden lg:block' : ''}`, [seccion]);

  const buscarPorCedula = async (e) => {
    e?.preventDefault();
    const cedula = busqueda.trim();
    if (!cedula) {
      setErrorBusqueda('Ingresa una cédula para buscar.');
      return;
    }
    setBuscandoHistoria(true);
    setErrorBusqueda('');
    setResultadoHistoria(null);
    try {
      const { data: historiaPaciente } = await axiosClient.get(`/historias-clinicas/${cedula}`);
      let ultimaConsulta = null;
      if (historiaPaciente.id) {
        try {
          const { data: consultas } = await axiosClient.get(`/consultas/${historiaPaciente.id}`);
          ultimaConsulta = Array.isArray(consultas) && consultas.length > 0 ? consultas[0] : null;
        } catch {
          ultimaConsulta = null;
        }
      }
      setResultadoHistoria({ ...historiaPaciente, ultimaConsulta });
    } catch (err) {
      const msg = err?.response?.data?.detail || 'No se encontró el paciente con esa cédula.';
      setErrorBusqueda(typeof msg === 'string' ? msg : 'No se encontró el paciente con esa cédula.');
    } finally {
      setBuscandoHistoria(false);
    }
  };

  const aplicarPrecarga = async () => {
    if (!resultadoHistoria) return;
    vaciarFormulario();
    setHistoria({
      tipo_sangre: resultadoHistoria.tipo_sangre || '',
      antecedentes: Array.isArray(resultadoHistoria.antecedentes_medicos)
        ? resultadoHistoria.antecedentes_medicos.join('\n')
        : '',
      operatorios: Array.isArray(resultadoHistoria.antecedentes_operatorios)
        ? resultadoHistoria.antecedentes_operatorios.join('\n')
        : '',
      alergias: Array.isArray(resultadoHistoria.alergias) ? resultadoHistoria.alergias.join('\n') : '',
      telefono: resultadoHistoria.telefono || '',
    });
    setHistoriaCargada(true);

    const ultima = resultadoHistoria.ultimaConsulta;
    if (ultima) {
      const sv = ultima.signos_vitales || {};
      setSignos({
        presion_arterial: sv.presion_arterial ?? '',
        frecuencia_cardiaca: sv.frecuencia_cardiaca != null ? String(sv.frecuencia_cardiaca) : '',
        frecuencia_respiratoria: sv.frecuencia_respiratoria != null ? String(sv.frecuencia_respiratoria) : '',
        temperatura: sv.temperatura != null ? String(sv.temperatura) : '',
        saturacion_oxigeno: sv.saturacion_oxigeno != null ? String(sv.saturacion_oxigeno) : '',
        peso_kg: sv.peso_kg != null ? String(sv.peso_kg) : '',
        talla_cm: sv.talla_cm != null ? String(sv.talla_cm) : '',
      });
      setMotivo(ultima.motivo_consulta || '');
      setExamenFisico(ultima.examen_fisico || '');
      setDiagnostico(ultima.cie10_descripcion || '');
      setTratamiento(ultima.tratamiento || '');
      setIndicaciones(ultima.recomendaciones || '');
      setRecetas(
        Array.isArray(ultima.recetas) && ultima.recetas.length
          ? ultima.recetas.map((r) => ({ nombre: r.nombre || '', posologia: r.posologia || '' }))
          : [{ nombre: '', posologia: '' }]
      );

      const laboratorio = Array.isArray(ultima.laboratorios) ? ultima.laboratorios : [];
      const estudios = Array.isArray(ultima.estudios) ? ultima.estudios : [];
      const imagen = estudios.filter((i) => (i.tipo || '').toUpperCase() === 'IMAGEN');
      const funcional = estudios.filter((i) => (i.tipo || '').toUpperCase() === 'FUNCIONAL');
      setExamenes({
        laboratorio: { activo: laboratorio.length > 0, items: laboratorio.map((i) => ({ estudio: i.nombre || i.estudio || '', indicacion: i.indicacion || '', resultado: i.resultado || '' })) },
        imagen: { activo: imagen.length > 0, items: imagen.map((i) => ({ estudio: i.nombre || i.estudio || '', indicacion: i.indicacion || '', resultado: i.resultado || '' })) },
        funcional: { activo: funcional.length > 0, items: funcional.map((i) => ({ estudio: i.nombre || i.estudio || '', indicacion: i.indicacion || '', resultado: i.resultado || '' })) },
      });

      // Si la última consulta es de HOY, retomar = actualizar esa consulta (regla 1 por día).
      const fechaUltima = ultima.fecha ? String(ultima.fecha) : '';
      const esHoy = !!fechaUltima && fechaUltima.slice(0, 10) === new Date().toISOString().slice(0, 10);
      if (esHoy && ultima.consulta_id) {
        let remitido = false;
        try {
          const { data: det } = await axiosClient.get(`/consultas/detalle/${ultima.consulta_id}`);
          remitido = !!(det?.remision && det.remision.remitido);
        } catch {
          remitido = false;
        }
        setRetomoInfo({ consultaId: ultima.consulta_id, comprobanteRef: ultima.comprobante_ref || null, remitido });
      } else {
        setRetomoInfo(null);
      }
    }

    setPacienteActual({
      id: null,
      cola_id: null,
      paciente_id: resultadoHistoria.id || null,
      paciente_cedula: resultadoHistoria.cedula,
      paciente_nombre: resultadoHistoria.nombre_completo || 'Paciente',
      apellido: '',
      token: 'RETOMADO',
      prioridad: '—',
      _retomado: true,
    });
    setRetomarAbierto(false);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const handleRetomarDesdeConsulta = async (consulta, detalleData) => {
    const cedula = consulta?.paciente_cedula || detalleData?.paciente_cedula;
    if (!cedula) return;

    setLoading(true);
    setError('');
    try {
      // 1. Obtener la historia clínica completa del paciente si existe
      let historiaPaciente = null;
      try {
        const { data } = await axiosClient.get(`/historias-clinicas/${cedula}`);
        historiaPaciente = data;
      } catch (e) {
        console.warn('Historia clínica no encontrada o error al buscar por cédula:', e);
      }

      // 2. Obtener el detalle completo de la consulta si aún no fue cargado
      let d = detalleData;
      if (!d || !d.motivo_consulta) {
        try {
          const { data } = await axiosClient.get(`/consultas/detalle/${consulta.consulta_id}`);
          d = data;
        } catch (e) {
          d = consulta;
        }
      }

      // 3. Vaciar formulario actual
      vaciarFormulario();

      // 4. Precargar datos de la historia clínica
      if (historiaPaciente) {
        setHistoria({
          tipo_sangre: historiaPaciente.tipo_sangre || '',
          antecedentes: Array.isArray(historiaPaciente.antecedentes_medicos)
            ? historiaPaciente.antecedentes_medicos.join('\n')
            : '',
          operatorios: Array.isArray(historiaPaciente.antecedentes_operatorios)
            ? historiaPaciente.antecedentes_operatorios.join('\n')
            : '',
          alergias: Array.isArray(historiaPaciente.alergias) ? historiaPaciente.alergias.join('\n') : '',
          telefono: historiaPaciente.telefono || '',
        });
        setHistoriaCargada(true);
      }

      // 5. Precargar datos clínicos de la consulta
      if (d) {
        const sv = d.signos_vitales || {};
        setSignos({
          presion_arterial: sv.presion_arterial ?? '',
          frecuencia_cardiaca: sv.frecuencia_cardiaca != null ? String(sv.frecuencia_cardiaca) : '',
          frecuencia_respiratoria: sv.frecuencia_respiratoria != null ? String(sv.frecuencia_respiratoria) : '',
          temperatura: sv.temperatura != null ? String(sv.temperatura) : '',
          saturacion_oxigeno: sv.saturacion_oxigeno != null ? String(sv.saturacion_oxigeno) : '',
          peso_kg: sv.peso_kg != null ? String(sv.peso_kg) : '',
          talla_cm: sv.talla_cm != null ? String(sv.talla_cm) : '',
        });

        setMotivo(d.motivo_consulta || '');
        setExamenFisico(d.examen_fisico || '');
        setDiagnostico(d.cie10_descripcion || d.cie10_codigo || '');
        setTratamiento(d.tratamiento || '');
        setIndicaciones(d.recomendaciones || '');

        if (Array.isArray(d.recetas) && d.recetas.length > 0) {
          setRecetas(d.recetas.map((r) => ({ nombre: r.nombre || '', posologia: r.posologia || '' })));
        } else {
          setRecetas([{ nombre: '', posologia: '' }]);
        }

        const laboratorio = Array.isArray(d.laboratorios) ? d.laboratorios : [];
        const estudios = Array.isArray(d.estudios) ? d.estudios : [];
        const imagen = estudios.filter((i) => (i.tipo || '').toUpperCase() === 'IMAGEN');
        const funcional = estudios.filter((i) => (i.tipo || '').toUpperCase() === 'FUNCIONAL');
        setExamenes({
          laboratorio: {
            activo: laboratorio.length > 0,
            items: laboratorio.map((i) => ({ estudio: i.nombre || i.estudio || '', indicacion: i.indicacion || '', resultado: i.resultado || '' })),
          },
          imagen: {
            activo: imagen.length > 0,
            items: imagen.map((i) => ({ estudio: i.nombre || i.estudio || '', indicacion: i.indicacion || '', resultado: i.resultado || '' })),
          },
          funcional: {
            activo: funcional.length > 0,
            items: funcional.map((i) => ({ estudio: i.nombre || i.estudio || '', indicacion: i.indicacion || '', resultado: i.resultado || '' })),
          },
        });
      }

      // 6. Configurar pacienteActual
      const nombreCompleto =
        historiaPaciente?.nombre_completo || d?.paciente_nombre || consulta?.paciente_nombre || 'Paciente';

      const retomadoObj = {
        id: null,
        cola_id: null,
        paciente_id: historiaPaciente?.id || d?.paciente_id || consulta?.paciente_id || null,
        paciente_cedula: cedula,
        paciente_nombre: nombreCompleto,
        apellido: '',
        token: 'RETOMADO',
        prioridad: '—',
        _retomado: true,
      };

      pacienteIdRef.current = `RETOMADO-${cedula}`;
      pacienteActualRef.current = retomadoObj;
      setPacienteActual(retomadoObj);

      setRetomoInfo({
        consultaId: consulta.consulta_id,
        comprobanteRef: d?.comprobante_ref || consulta.comprobante_ref || null,
        remitido: !!(d?.remision && d.remision.remitido),
      });

      setAviso(`Paciente ${nombreCompleto} retomado. Se han precargado sus datos e historia clínica.`);
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (err) {
      setError('Error al precargar los datos de la consulta retomada.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Selector de la orden de exámenes (catálogo) ----
  const ordenCatalog = useMemo(() => CATALOGO_EXAMENES[ordenCategoria] || [], [ordenCategoria]);
  const ordenGrupos = useMemo(() => {
    const q = ordenBusqueda.trim().toLowerCase();
    if (!q) return ordenCatalog;
    return ordenCatalog
      .map((g) => ({ ...g, estudios: g.estudios.filter((e) => e.toLowerCase().includes(q)) }))
      .filter((g) => g.estudios.length > 0);
  }, [ordenCatalog, ordenBusqueda]);

  const toggleExamen = (nombre, categoria) => {
    setOrdenSeleccion((s) => {
      const ya = s.find((x) => x.nombre === nombre && x.categoria === categoria);
      if (ya) return s.filter((x) => !(x.nombre === nombre && x.categoria === categoria));
      return [...s, { nombre, categoria }];
    });
  };

  const quitarExamenSeleccion = (nombre, categoria) =>
    setOrdenSeleccion((s) => s.filter((x) => !(x.nombre === nombre && x.categoria === categoria)));

  const confirmarOrden = () => {
    if (ordenSeleccion.length === 0) return;
    setExamenes((prev) => {
      const lab = ordenSeleccion.filter((x) => x.categoria === 'laboratorio').map((x) => ({ estudio: x.nombre, indicacion: '', resultado: '' }));
      const img = ordenSeleccion.filter((x) => x.categoria === 'imagen').map((x) => ({ estudio: x.nombre, indicacion: '', resultado: '' }));
      const fun = ordenSeleccion.filter((x) => x.categoria === 'funcional').map((x) => ({ estudio: x.nombre, indicacion: '', resultado: '' }));
      return {
        laboratorio: { activo: lab.length > 0, items: lab },
        imagen: { activo: img.length > 0, items: img },
        funcional: { activo: fun.length > 0, items: fun },
      };
    });
    setOrdenAbierta(false);
    setOrdenSeleccion([]);
    setOrdenBusqueda('');
    setAviso(`Orden de estudios registrada: ${ordenSeleccion.length} examen(es) seleccionado(s).`);
  };

  const totalSeleccionados = ordenSeleccion.length;

  const setResultadoExamen = (categoria, idx) => (e) => {
    setExamenes((prev) => ({
      ...prev,
      [categoria]: {
        ...prev[categoria],
        items: prev[categoria].items.map((it, i) => (i === idx ? { ...it, resultado: e.target.value } : it)),
      },
    }));
  };

  const examenesRetomables = retomoInfo && !retomoInfo.remitido && pacienteActual?._retomado
    ? Object.keys(examenes).filter((k) => examenes[k].activo && examenes[k].items.length > 0)
    : [];

  const signosListos = Object.values(SIGNOS).filter((s) => String(signos[s.key] || '').trim() !== '');

  // ---- PDF: ficha médica / diagnóstico ----
  const exportarPdfFicha = async () => {
    if (!pacienteActual) return;
    setPdfGenerando(true);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const ancho = doc.internal.pageSize.getWidth();
    const margen = 40;
    let y = 40;

    doc.setFillColor(26, 75, 124);
    doc.rect(0, 0, ancho, 120, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Centro Integral de Alta Tecnología de Barcelona (CITAB)', margen, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Servicio de Urgencias · Ficha Médica / Diagnóstico', margen, 72);
    doc.setFontSize(9);
    doc.text(
      `Fecha: ${new Date().toLocaleString('es-VE')} · Médico: ${userName}`,
      margen,
      88
    );

    y = 145;
    doc.setTextColor(26, 75, 124);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Datos del paciente', margen, y);
    y += 16;
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const nombre = `${pacienteActual.paciente_nombre} ${pacienteActual.apellido || ''}`.trim();
    doc.text(`Nombre: ${nombre}`, margen, y);
    y += 14;
    doc.text(`Cédula: ${pacienteActual.paciente_cedula}`, margen, y);
    y += 14;
    doc.text(`Tipo de sangre: ${historia.tipo_sangre || '—'}`, margen, y);
    y += 14;
    doc.text(`Teléfono: ${historia.telefono || '—'}`, margen, y);
    y += 14;
    if (parseLista(historia.alergias).length) {
      doc.text(`Alergias: ${parseLista(historia.alergias).join(', ')}`, margen, y);
      y += 14;
    }
    if (parseLista(historia.antecedentes).length) {
      doc.text(`Antecedentes de enfermedad: ${parseLista(historia.antecedentes).join(', ')}`, margen, y);
      y += 14;
    }
    if (parseLista(historia.operatorios).length) {
      doc.text(`Antecedentes operatorios: ${parseLista(historia.operatorios).join(', ')}`, margen, y);
      y += 14;
    }
    y += 18;

    const seccion = (titulo) => {
      if (y > 720) {
        doc.addPage();
        y = 40;
      }
      doc.setFillColor(232, 240, 248);
      doc.roundedRect(margen - 6, y - 12, ancho - 2 * margen + 12, 22, 4, 4, 'F');
      doc.setTextColor(26, 75, 124);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(titulo, margen, y);
      y += 26;
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
    };

    seccion('Motivo de consulta - síntomas');
    doc.text(doc.splitTextToSize(motivo.trim() || '—', ancho - 2 * margen), margen, y);
    y += 14 + (Math.ceil((motivo.trim().length || 1) / 90) * 12 || 0);

    seccion('Examen físico');
    doc.text(doc.splitTextToSize(examenFisico.trim() || '—', ancho - 2 * margen), margen, y);
    y += 14 + (Math.ceil((examenFisico.trim().length || 1) / 90) * 12 || 0);

    seccion('Diagnóstico');
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(diagnostico.trim() || '—', ancho - 2 * margen), margen, y);
    doc.setFont('helvetica', 'normal');
    y += 14 + (Math.ceil((diagnostico.trim().length || 1) / 90) * 12 || 0);

    seccion('Signos vitales');
    const svTxt = signosListos.length
      ? signosListos.map((s) => `${s.label}: ${signos[s.key]} ${s.unidad}`).join('   ')
      : '—';
    doc.text(doc.splitTextToSize(svTxt, ancho - 2 * margen), margen, y);
    y += 14 + (Math.ceil((svTxt.length || 1) / 110) * 12 || 0);

    seccion('Tratamiento');
    doc.text(doc.splitTextToSize(tratamiento.trim() || '—', ancho - 2 * margen), margen, y);
    y += 14 + (Math.ceil((tratamiento.trim().length || 1) / 90) * 12 || 0);

    if (recetas.filter((r) => r.nombre.trim()).length) {
      seccion('Recetas médicas');
      recetas
        .filter((r) => r.nombre.trim())
        .forEach((r) => {
          doc.text(`• ${r.nombre}${r.posologia ? ` — ${r.posologia}` : ''}`, margen, y);
          y += 14;
        });
      y += 6;
    }

    seccion('Indicaciones y recomendaciones');
    doc.text(doc.splitTextToSize(indicaciones.trim() || '—', ancho - 2 * margen), margen, y);
    y += 14 + (Math.ceil((indicaciones.trim().length || 1) / 90) * 12 || 0);

    seccion('Exámenes ordenados');
    const exTxt = Object.keys(examenes)
      .filter((k) => examenes[k].activo && examenes[k].items.length)
      .map((k) => `${k.toUpperCase()}: ${examenes[k].items.map((i) => i.estudio).join(', ')}`)
      .join('\n');
    doc.text(doc.splitTextToSize(exTxt || '—', ancho - 2 * margen), margen, y);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Documento generado por el sistema CITAB · Urgencias', margen, doc.internal.pageSize.getHeight() - 30);

    await compartirPdf(doc, `ficha-clinica-${pacienteActual.paciente_cedula}.pdf`);
    setPdfGenerando(false);
  };

  const especialistasPorEspecialidad = useMemo(() => {
    const mapa = {};
    especialistas.forEach((e) => {
      const esp = e.especialidad || 'Sin especialidad';
      if (!mapa[esp]) mapa[esp] = [];
      mapa[esp].push(e);
    });
    return mapa;
  }, [especialistas]);

  const resetAgenda = () => {
    setEspecialistaSel(null);
    setAvailDias({});
    setAvailRango(null);
    setFechaSel(null);
    setHoraSel(null);
    setTurnosSel([]);
    setCitaInfo(null);
    setAgendaError('');
  };

  const fetchEspecialistas = async () => {
    setEspecialistasCargando(true);
    try {
      const { data } = await axiosClient.get('/agenda/especialistas');
      setEspecialistas(Array.isArray(data) ? data : []);
    } catch {
      setEspecialistas([]);
    } finally {
      setEspecialistasCargando(false);
    }
  };

  const prepararRemision = async () => {
    setDestino('');
    setNivelRemision(null);
    resetAgenda();
    setConfirm('remitir');
    setError('');

    if (!pacienteActual || !pacienteActual.paciente_cedula) {
      setEsAfiliado(false);
      await fetchEspecialistas();
      return;
    }
    const cedula = pacienteActual.paciente_cedula;
    setAnalizandoRemision(true);
    try {
      let esTrabajador = false;
      try {
        await axiosClient.get('/busqueda/empleados', { params: { cedula } });
        esTrabajador = true;
      } catch {
        esTrabajador = false;
      }
      let esBeneficiario = false;
      if (!esTrabajador) {
        try {
          await axiosClient.get('/busqueda/beneficiarios', { params: { cedula } });
          esBeneficiario = true;
        } catch {
          esBeneficiario = false;
        }
      }
      const afiliado = esTrabajador || esBeneficiario;
      setEsAfiliado(afiliado);
      if (afiliado) setNivelRemision('azul');
    } finally {
      setAnalizandoRemision(false);
    }
    await fetchEspecialistas();
  };

  const elegirEspecialista = async (id) => {
    setEspecialistaSel(id);
    setFechaSel(null);
    setHoraSel(null);
    setTurnosSel([]);
    setCitaInfo(null);
    setAgendaError('');
    if (!id || !nivelRemision) return;
    setAgendaCargando(true);
    try {
      const { data } = await axiosClient.get('/agenda/disponibilidad', { params: { medico_id: id, nivel: nivelRemision } });
      const mapa = {};
      (data.dias || []).forEach((d) => {
        mapa[d.fecha] = { disponible: d.disponible, turnos: d.turnos_libres || [] };
      });
      setAvailDias(mapa);
      setAvailRango({ desde: data.fecha_desde, hasta: data.fecha_hasta });
    } catch (e) {
      setAgendaError(e?.response?.data?.detail || 'No se pudo cargar la disponibilidad.');
      setAvailDias({});
      setAvailRango(null);
    } finally {
      setAgendaCargando(false);
    }
  };

  const elegirFecha = async (fecha) => {
    setFechaSel(fecha);
    setHoraSel(null);
    setTurnosSel([]);
    setCitaInfo(null);
    if (!especialistaSel) return;
    setTurnosCargando(true);
    try {
      const { data } = await axiosClient.get('/agenda/turnos', { params: { medico_id: especialistaSel, fecha } });
      const d = Array.isArray(data) ? data[0] : data;
      setTurnosSel((d && d.turnos_libres) || []);
    } catch (e) {
      setAgendaError(e?.response?.data?.detail || 'No se pudo cargar los turnos.');
      setTurnosSel([]);
    } finally {
      setTurnosCargando(false);
    }
  };

  const ejecutar = async () => {
    if (!pacienteActual) return;
    // Al mobile la ficha es por secciones: si falta un obligatorio se salta a
    // la sección que lo contiene y se enfoca el campo, para no obligar a
    // buscarlo a mano.
    const pedirObligatorio = (mensaje, ref) => {
      setError(mensaje);
      setConfirm(null);
      setSeccion('motivo');
      requestAnimationFrame(() => ref?.current?.focus());
    };
    if (!motivo.trim()) {
      pedirObligatorio('Registra el motivo de consulta antes de continuar.', motivoRef);
      return;
    }
    if (!diagnostico.trim()) {
      pedirObligatorio('El diagnóstico es obligatorio para cerrar la consulta.', diagnosticoRef);
      return;
    }
    if (confirm === 'remitir' && !nivelRemision) {
      setError('Indica el nivel de prioridad de la remisión (verde o amarillo).');
      return;
    }
    if (confirm === 'remitir' && !destino) {
      setError('Selecciona la especialidad de destino de la remisión.');
      return;
    }
    if (confirm === 'remitir' && !especialistaSel) {
      setError('Selecciona el especialista de destino.');
      return;
    }
    if (confirm === 'remitir' && !fechaSel) {
      setError('Elige la fecha de la cita en el calendario.');
      return;
    }
    if (confirm === 'remitir' && !horaSel) {
      setError('Elige el turno (hora) de la cita.');
      return;
    }

    setBusy(true);
    setError('');
    let consultaRef = null;
    try {
      const esRemision = confirm === 'remitir';
      const esRetomado = !!pacienteActual._retomado;
      const examenRemCita = exremCita;

      const payload = {
        paciente_id: pacienteActual.paciente_id,
        cola_id: pacienteActual.cola_id || null,
        medico_id: null,
        medico_nombre: userName,
        especialidad: 'Medicina de Emergencias',
        enfermedad_actual: motivo.trim(),
        motivo_consulta: motivo.trim(),
        examen_fisico: examenFisico.trim() || null,
        signos_vitales: {
          presion_arterial: signos.presion_arterial.trim() || null,
          frecuencia_cardiaca: n2num(signos.frecuencia_cardiaca),
          frecuencia_respiratoria: n2num(signos.frecuencia_respiratoria),
          temperatura: n2num(signos.temperatura),
          saturacion_oxigeno: n2num(signos.saturacion_oxigeno),
          peso_kg: n2num(signos.peso_kg),
          talla_cm: n2num(signos.talla_cm),
        },
        diagnostico_principal: diagnostico.trim() || null,
        tratamiento: tratamiento.trim() || null,
        indicaciones_medicas: indicaciones.trim() || null,
        recetas: recetas
          .filter((r) => r.nombre.trim())
          .map((r) => ({ nombre: r.nombre.trim(), posologia: r.posologia.trim() })),
        laboratorios: examenes.laboratorio.activo
          ? examenes.laboratorio.items
              .filter((i) => i.estudio.trim())
              .map((i) => ({
                tipo: 'LABORATORIO',
                estudio: i.estudio.trim(),
                indicacion: i.indicacion.trim(),
                ...(i.resultado && i.resultado.trim() ? { resultado: i.resultado.trim() } : {}),
              }))
          : [],
        estudios: [
          ...(examenes.imagen.activo
            ? examenes.imagen.items
                .filter((i) => i.estudio.trim())
                .map((i) => ({
                  tipo: 'IMAGEN',
                  estudio: i.estudio.trim(),
                  indicacion: i.indicacion.trim(),
                  ...(i.resultado && i.resultado.trim() ? { resultado: i.resultado.trim() } : {}),
                }))
            : []),
          ...(examenes.funcional.activo
            ? examenes.funcional.items
                .filter((i) => i.estudio.trim())
                .map((i) => ({
                  tipo: 'FUNCIONAL',
                  estudio: i.estudio.trim(),
                  indicacion: i.indicacion.trim(),
                  ...(i.resultado && i.resultado.trim() ? { resultado: i.resultado.trim() } : {}),
                }))
            : []),
          ...(examenes.anatomia_patologica?.activo
            ? examenes.anatomia_patologica.items
                .filter((i) => i.estudio.trim())
                .map((i) => ({
                  tipo: 'ANATOMIA_PATOLOGICA',
                  estudio: i.estudio.trim(),
                  indicacion: i.indicacion.trim(),
                  ...(i.resultado && i.resultado.trim() ? { resultado: i.resultado.trim() } : {}),
                }))
            : []),
        ],
        insumos: insumos
          .filter((i) => i.nombre.trim() && i.cantidad > 0)
          .map((i) => ({
            insumo_id: i.insumo_id,
            nombre: i.nombre.trim(),
            tipo: i.tipo,
            tabla_origen: i.tabla_origen || 'medicamentos_catalogo',
            cantidad: Number(i.cantidad) || 1,
            unidad: i.unidad || 'unidad',
          })),
      };

      if (confirm === 'finalizar' && examenRemCita) {
        payload.remision_examen = {
          examen_ofrecido_id: examenRemCita.examen_ofrecido_id,
          cita_examen_id: examenRemCita.cita_id,
        };
      }

      let consulta = null;
      if (esRetomado) {
        let consultaId = retomoInfo?.consultaId || null;
        if (!consultaId) {
          // Fallback: buscar la consulta de hoy del paciente (regla 1 por día).
          try {
            const { data: lista } = await axiosClient.get(`/consultas/${pacienteActual.paciente_id}`);
            const hoyStr = new Date().toISOString().slice(0, 10);
            const objetivo = (Array.isArray(lista) ? lista : []).find(
              (c) => c.fecha && String(c.fecha).slice(0, 10) === hoyStr
            );
            consultaId = objetivo?.consulta_id || null;
          } catch {
            consultaId = null;
          }
        }
        if (consultaId) {
          const { data: actualizada } = await axiosClient.put(`/consultas/${consultaId}`, payload);
          consulta = actualizada;
        } else {
          const { data: nueva } = await axiosClient.post(`/consultas`, payload);
          consulta = nueva;
        }
      } else {
        const { data: nueva } = await axiosClient.post(`/consultas`, payload);
        consulta = nueva;
      }
      consultaRef = consulta?.comprobante_ref;

      let codigoCita = null;
      if (esRemision) {
        try {
          const { data: cita } = await axiosClient.post(`/agenda/citas`, {
            paciente_id: pacienteActual.paciente_id || null,
            medico_id: especialistaSel,
            especialidad: destino,
            fecha: fechaSel,
            hora_inicio: horaSel,
            nivel: nivelRemision,
            origen: 'remision',
            motivo: motivo.trim(),
          });
          codigoCita = cita?.codigo_confirmacion || null;
          setCitaInfo(cita || null);
        } catch (e) {
          setError(e?.response?.data?.detail || 'No se pudo agendar la cita de la remisión.');
          setBusy(false);
          return;
        }
      }

      const codigoExamen = confirm === 'finalizar' && examenRemCita ? examenRemCita.codigo_confirmacion : null;

      if (!esRetomado && pacienteActual.id) {
        await axiosClient.patch(`/cola/${pacienteActual.id}/transicion`, {
          nuevo_estado: 'FINALIZADO',
          cambiado_por: null,
          observacion: esRemision
            ? `Paciente finalizado y remitido a ${destino} · Nivel ${nivelRemision ? REMISION_NIVEL[nivelRemision].etiqueta : ''} (${REMISION_NIVEL[nivelRemision]?.corto || ''})${codigoCita ? ` · Cita ${codigoCita}` : ''}`
            : 'Consulta de emergencias finalizada',
          derivado_a_especialista: esRemision,
          especialidad_destino: esRemision ? destino : null,
          especialista_id: esRemision ? especialistaSel : null,
        });
      }

      setResultado({
        titulo: esRemision ? 'Paciente remitido' : esRetomado ? 'Consulta actualizada' : 'Consulta finalizada',
        comprobante: consultaRef,
        citaCodigo: codigoCita || codigoExamen,
        esExamenCita: !!codigoExamen,
        esRetomado,
      });
      setConfirm(null);
      setDestino('');
      setNivelRemision(null);
      setEsAfiliado(false);
      setCitaInfo(null);
      resetAgenda();
      vaciarFormulario();
      setPacienteActual(null);
      if (!esRetomado) await fetchPacienteActual();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'No se pudo completar la operación.';
      setError(typeof msg === 'string' ? msg : msg?.mensaje || 'Error al guardar la consulta.');
    } finally {
      setBusy(false);
    }
  };

  const horaStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fechaStr = now.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' });

  const minutosEnConsulta = pacienteActual
    ? Math.max(0, Math.floor((now.getTime() - new Date(pacienteActual.iniciado_en || pacienteActual.creado_en).getTime()) / 60000))
    : 0;

  const abrirRetomar = () => {
    setBusqueda('');
    setErrorBusqueda('');
    setResultadoHistoria(null);
    setRetomarAbierto(true);
  };

  const resetExamenRem = () => {
    setExremBusqueda('');
    setExremCatalogo([]);
    setExremSel(null);
    setExremSelDias({});
    setExremSelRango(null);
    setExremFecha('');
    setExremHora('');
    setExremAcepta(false);
    setExremMotivo('');
    setExremError('');
  };

  const abrirRemisionExamen = () => {
    resetExamenRem();
    setExremCita(null);
    setExremAbierto(true);
  };

  const buscarExamenRem = async () => {
    if (!exremBusqueda.trim()) return;
    setExremCatalogoCargando(true);
    try {
      const { data } = await axiosClient.get('/remision-examen/examenes-ofrecidos', {
        params: { texto: exremBusqueda.trim() },
      });
      setExremCatalogo(Array.isArray(data) ? data : []);
    } catch (e) {
      setExremError(e?.response?.data?.detail || 'No se pudo cargar el catálogo.');
      setExremCatalogo([]);
    } finally {
      setExremCatalogoCargando(false);
    }
  };

  const seleccionarOfrecido = async (ofr) => {
    setExremSel(ofr);
    setExremError('');
    try {
      const { data } = await axiosClient.get(`/remision-examen/examenes-ofrecidos/${ofr.id}/disponibilidad`, {
        params: { dias: 30 },
      });
      const mapa = {};
      (Array.isArray(data) ? data : []).forEach((d) => {
        mapa[d.fecha] = { cupo: d.cupo_restante, turnos: d.turnos_libres || [], disponible: d.disponible, motivo: d.motivo };
      });
      setExremSelDias(mapa);
    } catch (e) {
      setExremError(e?.response?.data?.detail || 'No se pudo cargar la disponibilidad.');
      setExremSelDias({});
    }
  };

  const guardarFicha = async () => {
    if (!pacienteActual?.paciente_cedula) {
      setFichaError('No hay paciente seleccionado.');
      return;
    }
    setGuardandoFicha(true);
    setFichaError('');
    setFichaGuardada(false);
    try {
      await axiosClient.post(`/historias-clinicas`, {
        cedula: pacienteActual.paciente_cedula,
        nombre_completo: pacienteActual.paciente_nombre,
        telefono: historia.telefono.trim() || null,
        tipo_sangre: historia.tipo_sangre || null,
        antecedentes_medicos: parseLista(historia.antecedentes),
        antecedentes_operatorios: parseLista(historia.operatorios),
        alergias: parseLista(historia.alergias),
      });
      setFichaGuardada(true);
    } catch (e) {
      setFichaError(e?.response?.data?.detail || 'No se pudo guardar la ficha médica.');
    } finally {
      setGuardandoFicha(false);
    }
  };

  const confirmarCitaExamen = async () => {
    if (!exremSel || !exremFecha || !exremHora) {
      setExremError('Selecciona centro/fecha/hora de la cita.');
      return;
    }
    if (!exremAcepta) {
      setExremError('Debes confirmar que el paciente acepta esperar y trasladarse al centro.');
      return;
    }
    setExremCreando(true);
    setExremError('');
    try {
      const { data } = await axiosClient.post('/remision-examen/citas', {
        examen_ofrecido_id: exremSel.id,
        paciente_id: pacienteActual.paciente_id,
        fecha: exremFecha,
        hora_inicio: exremHora,
        motivo: exremMotivo.trim() || null,
      });
      setExremCita(data);
    } catch (e) {
      setExremError(e?.response?.data?.detail || 'No se pudo agendar la cita del examen.');
    } finally {
      setExremCreando(false);
    }
  };

  const headerBtn = 'inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed';

  const cx = (nombre, cat) =>
    ordenSeleccion.some((x) => x.nombre === nombre && x.categoria === cat);

  const accionesContenido = (
    <>
      <button
        onClick={() => setFichaAbierta(true)}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white ring-1 ring-brand-deep/30 text-brand-deep hover:bg-brand-deep/5 font-bold text-sm transition-all"
      >
        <FileText className="w-4 h-4" />
        Llenar ficha médica
      </button>

      <button
        onClick={() => setHistorialAbierto(true)}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white ring-1 ring-brand-primary/40 text-brand-primary hover:bg-brand-primary/5 font-bold text-sm transition-all"
      >
        <History className="w-4 h-4" />
        Historial completo
      </button>

      <button
        onClick={() => { setExamSeleccionados(examenesASeleccionados(examenes)); setOrdenAbierta(true); }}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white ring-1 ring-asistencial-500/40 text-asistencial-600 hover:bg-asistencial-500/5 font-bold text-sm transition-all"
      >
        <ListChecks className="w-4 h-4" />
        {resumen.examenesTotal > 0 ? `Orden de exámenes (${resumen.examenesTotal})` : 'Orden de exámenes'}
      </button>

      {resumen.examenesTotal > 0 && (
        <div className="px-1 space-y-1">
          {Object.keys(examenes).map((k) => {
            if (!examenes[k].activo || !examenes[k].items.length) return null;
            const cat = categoriaEstilo(k);
            return (
              <div key={k} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ring-1" style={{ backgroundColor: cat.soft, borderColor: cat.color }}>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cat.color }}>
                  {cat.etiqueta} · {examenes[k].items.length}
                </span>
                <span className="text-[11px] text-slate-600 truncate max-w-[60%]">
                  {examenes[k].items.map((it) => it.estudio).join(', ')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setConfirm('finalizar')}
        disabled={busy}
        className={`w-full bg-brand-success hover:bg-brand-success group ${headerBtn}`}
      >
        <CheckCircle2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
        Finalizar consulta
      </button>

      <button
        onClick={prepararRemision}
        disabled={busy}
        className={`w-full bg-white text-brand-deep hover:bg-brand-primary/5 ring-1 ring-brand-primary/30 group ${headerBtn}`}
      >
        <Send className="w-4 h-4 group-hover:translate-x-0.5 -group-hover:translate-y-0.5 transition-transform" />
        Remitir paciente
      </button>

      {(!exremElegible || exremElegible.elegible) && (
        <button
          onClick={abrirRemisionExamen}
          disabled={busy}
          title={exremElegible?.elegible ? '' : 'Solo trabajadores y beneficiarios pueden ser remitidos para estudios. El público general solo recibe la orden de exámenes.'}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white ring-1 ring-violet-500/40 text-violet-700 hover:bg-violet-500/5 font-bold text-sm transition-all"
        >
          <Microscope className="w-4 h-4" />
          Remitir para examen
        </button>
      )}

      <button onClick={fetchPacienteActual} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 text-[13px] font-medium transition-colors ring-1 ring-slate-200">
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        Sincronizar cola
      </button>
    </>
  );

  // ===================================================================== RENDER
  return (
    <div className="emergency-scale min-h-screen flex flex-col bg-transparent font-sans">
      <a href="#doc-main" className="skip-link">Saltar al contenido principal</a>

      {/* ============================== HEADER ============================== */}
      {/* El <h1> es la marca, no el módulo: "Emergencias" ya lo da el badge de
          la derecha y el nombre del centro repetía la misma idea. El nombre
          accesible del landmark va en aria-label para no perder el contexto. */}
      <header aria-label="Emergencias · Salud Barcelona" className="safe-top sticky top-0 z-40 brand-orbit text-white shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-8 py-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg overflow-hidden ring-2 ring-white/25 shadow bg-white flex items-center justify-center shrink-0">
              {centerLogo ? (
                <img src={centerLogo} alt="" aria-hidden="true" className="h-full w-full object-contain" />
              ) : (
                <Stethoscope className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              )}
            </div>
            <h1 className="font-display font-extrabold text-[13px] sm:text-[15px] uppercase leading-[1.08] tracking-[0.14em] whitespace-nowrap">
              <span className="block">Salud</span>
              <span className="block font-semibold text-white/75">Barcelona</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <EmergencyBadge size="sm" light />
            <div className="hidden md:flex items-baseline gap-2 text-right mr-1">
              <span className="font-display font-semibold text-sm tabular-nums">{horaStr}</span>
              <span className="text-[9px] text-white/70 capitalize">{fechaStr}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/15">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
              <span className="text-[10px] font-medium text-white/90">En línea</span>
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-white/15">
              <div className="h-7 w-7 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center font-display font-semibold text-[11px] uppercase">
                {userName.trim().charAt(0) || 'M'}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-semibold">{userName}</div>
                <div className="text-[9px] text-white/70">Emergencias</div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="ml-1 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 ring-1 ring-white/15 transition-all"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden lg:inline">Salir</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ============================== MAIN ============================== */}
      <main id="doc-main" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 pb-32 lg:pb-8">
        {/* ---------- Alertas ---------- */}
        {(error || aviso) && (
          <div
            className={`mb-4 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] ring-1 animate-fade-up ${
              error ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-emerald-200 bg-emerald-50 text-brand-success'
            }`}
            role={error ? 'alert' : 'status'}
          >
            {error ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="flex-1">{error || aviso}</span>
            <button onClick={() => (error ? setError('') : setAviso(''))} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ---------- Resultado ---------- */}
        {resultado && (
          <div className="mb-5 rounded-2xl ring-1 ring-emerald-200 bg-emerald-50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-scale-in">
            <div className="h-11 w-11 rounded-xl bg-brand-success text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-lg text-brand-deep">{resultado.titulo}</h3>
              <p className="text-[13px] text-slate-500">
                {resultado.esRetomado
                  ? 'La consulta del paciente retomado se registró en su expediente.'
                  : 'El paciente fue retirado de la cola de emergencias. Consulta registrada en el expediente.'}
              </p>
            </div>
            {resultado.comprobante && (
              <span className="font-mono px-3 py-2 rounded-lg bg-white ring-1 ring-emerald-200 text-brand-success text-xs font-bold tracking-widest">
                COMP {resultado.comprobante}
              </span>
            )}
            {resultado.citaCodigo ? (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 ring-1 ring-brand-primary/30 px-3 py-1.5 text-[12px] font-bold text-brand-primary">
                {resultado.esExamenCita ? 'Examen agendado para centro adscrito' : 'Cita de remisión agendada'} · Código{' '}
                <span className="font-mono">{resultado.citaCodigo}</span>
              </p>
            ) : null}
            <button onClick={() => setResultado(null)} className="px-4 py-2 rounded-lg bg-white ring-1 ring-emerald-200 text-brand-deep text-sm font-medium hover:bg-slate-50 transition-colors">
              Entendido
            </button>
          </div>
        )}

        {loading && !pacienteActual ? (
          <div className="py-24 flex items-center justify-center">
            <div className="text-center">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-brand-primary/10 ring-1 ring-brand-primary/30 flex items-center justify-center animate-float">
                <Loader2 className="w-7 h-7 text-brand-primary animate-spin" />
              </div>
              <p className="mt-4 text-slate-500 text-sm">Sincronizando con la cola de urgencias…</p>
            </div>
          </div>
        ) : !pacienteActual ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 animate-fade-up">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-brand-danger/10 ring-1 ring-brand-danger/30 flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-brand-danger" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-bold text-lg text-brand-deep">Sin paciente en consulta</h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  Elige de qué cola pasar al paciente. Toca su ficha y toma al que corresponda.
                  {esperaCola.length > 0 && (
                    <span className="ml-1 font-semibold text-brand-danger">{esperaCola.length} en espera</span>
                  )}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  onClick={fetchPacienteActual}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-deep text-white font-semibold text-sm transition-all shadow-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar cola
                </button>
              </div>
            </div>

            {/* -------- Strip de tabs: dos colas + atendidos hoy -------- */}
            <div className="flex gap-1 bg-slate-100 rounded-full p-1 w-full sm:w-auto" role="tablist" aria-label="Cola de emergencias">
              {[
                { id: 'trab', etiqueta: 'Trabajadores', icono: ShieldCheck, n: listaTrab.length },
                { id: 'publico', etiqueta: 'Público', icono: User, n: listaPublico.length },
                { id: 'atendidos', etiqueta: 'Atendidos', icono: ListChecks, n: null },
              ].map((t) => {
                const I = t.icono;
                const activa = tabCola === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={activa}
                    onClick={() => {
                      setTabCola(t.id);
                      setSeleccionId(null);
                    }}
                    /* Movil: mismo patron probado en QueueTable de especialista -
                       apilado (icono+contador arriba, etiqueta abajo) cabe en 360. */
                    className="flex flex-1 sm:flex-none flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1.5 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all min-w-0"
                    style={activa ? { background: '#D90429', color: '#fff' } : { color: '#64748b' }}
                  >
                    <span className="flex items-center gap-1 shrink-0">
                      <I className="w-3 h-3" />
                      {t.n !== null && (
                        <span className={`font-mono text-[10px] font-bold leading-none px-1 py-0.5 rounded ${activa ? 'bg-white/20' : 'bg-slate-200/70'}`}>
                          {t.n}
                        </span>
                      )}
                    </span>
                    <span className="text-[8px] sm:text-xs uppercase sm:normal-case leading-tight truncate w-full">{t.etiqueta}</span>
                  </button>
                );
              })}
            </div>

            {tabCola !== 'atendidos' && (
              <ColaSeleccion
                titulo={tabCola === 'trab' ? 'Trabajadores y beneficiarios' : 'Público general'}
                subtitulo={tabCola === 'trab' ? 'Personal de la empresa y sus cargas familiares' : 'Pacientes sin vínculo laboral con la empresa'}
                icon={tabCola === 'trab' ? ShieldCheck : User}
                items={tabCola === 'trab' ? listaTrab : listaPublico}
                seleccion={seleccionId}
                onSeleccion={setSeleccionId}
                busy={tomarBusy !== null}
                onTomar={() => tomarPaciente(tabCola === 'trab' ? listaTrab.find((p) => p.id === seleccionId) : listaPublico.find((p) => p.id === seleccionId))}
                acento={
                  tabCola === 'trab'
                    ? {
                        iconBg: 'bg-brand-success/10',
                        iconText: 'text-brand-success',
                        badge: 'bg-brand-success/10 text-brand-success',
                        btn: 'bg-brand-success hover:bg-emerald-700 text-white shadow-sm',
                        rowBg: 'bg-brand-success/5',
                        rowRing: 'ring-brand-success/50',
                      }
                    : {
                        iconBg: 'bg-brand-primary/10',
                        iconText: 'text-brand-primary',
                        badge: 'bg-brand-primary/10 text-brand-primary',
                        btn: 'bg-brand-primary hover:bg-brand-deep text-white shadow-sm',
                        rowBg: 'bg-brand-primary/5',
                        rowRing: 'ring-brand-primary/50',
                      }
                }
              />
            )}

            {tabCola === 'atendidos' && (
              <AtendidosHoy userName={userName} onRetomar={handleRetomarDesdeConsulta} />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            {/* ============ COLUMNA PRINCIPAL ============ */}
            <div className="min-w-0">
              {/* ---------- Cabecera del paciente ---------- */}
              <section
                aria-label="Paciente en atención"
                className="animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden"
              >
                <div className="px-5 py-3 flex flex-col lg:flex-row lg:items-center gap-3 border-l-4 border-brand-danger">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <div className="h-11 w-11 rounded-xl bg-brand-danger/10 ring-2 ring-brand-danger/40 flex items-center justify-center">
                        <User className="w-6 h-6 text-brand-danger" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-brand-success ring-4 ring-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display font-bold text-lg text-brand-deep truncate">
                          {pacienteActual.paciente_nombre} <span className="text-slate-400 font-medium">{pacienteActual.apellido || ''}</span>
                        </h2>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-semibold tracking-widest">
                          {pacienteActual.token || `T-${pacienteActual.id}`}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-danger/10 ring-1 ring-brand-danger/30 text-[11px] font-bold text-brand-danger">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-danger animate-pulse-soft" />
                          {pacienteActual._retomado ? 'RETOMADO' : 'EN CONSULTA'}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                        C.I. {pacienteActual.paciente_cedula} · Prioridad {pacienteActual.prioridad}
                        {pacienteActual.especialidad ? ` · ${pacienteActual.especialidad}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 lg:pl-4 lg:border-l border-slate-100 flex-wrap">
                    <div className="text-center pr-4">
                      <Clock3 className="w-3.5 h-3.5 mx-auto text-amber-500 mb-0.5" />
                      <div className="font-display font-bold text-base text-brand-deep tabular-nums leading-none">
                        {pacienteActual._retomado ? '—' : `${String(Math.floor(minutosEnConsulta / 60)).padStart(2, '0')}:${String(minutosEnConsulta % 60).padStart(2, '0')}`}
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1 font-medium uppercase tracking-wide">En atención</p>
                    </div>
                    <div className="text-center">
                      <Droplets className="w-3.5 h-3.5 mx-auto text-brand-danger mb-0.5" />
                      <div className="font-display font-bold text-base text-brand-deep leading-none uppercase">
                        {historia.tipo_sangre || '—'}
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1 font-medium uppercase tracking-wide">Sangre</p>
                    </div>
                    {parseLista(historia.alergias).length > 0 && (
                      <div className="text-center pr-4">
                        <AlertCircle className="w-3.5 h-3.5 mx-auto text-rose-500 mb-0.5" />
                        <div className="font-display font-bold text-xs text-rose-600 leading-tight max-w-[120px] truncate" title={parseLista(historia.alergias).join(', ')}>
                          {parseLista(historia.alergias).join(', ')}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1 font-medium uppercase tracking-wide">Alergias</p>
                      </div>
                    )}
                    {parseLista(historia.antecedentes).length > 0 && (
                      <div className="text-center pr-4">
                        <ClipboardList className="w-3.5 h-3.5 mx-auto text-slate-400 mb-0.5" />
                        <div className="font-display font-bold text-xs text-slate-600 leading-tight max-w-[140px] truncate" title={parseLista(historia.antecedentes).join(', ')}>
                          {parseLista(historia.antecedentes).join(', ')}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1 font-medium uppercase tracking-wide">Antecedentes</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ============ PILLS DE SECCIÓN (móvil) ============
                  Van debajo de la ficha del paciente: primero se ve QUIÉN es y
                  después en qué parte de la ficha se está. Se quedan pegadas
                  bajo el header al hacer scroll. En lg se esconden y la grilla
                  muestra las cuatro secciones a la vez. */}
              {pacienteActual && (
                <nav
                  aria-label="Secciones de la atención"
                  className="lg:hidden sticky top-[calc(52px+var(--safe-top))] z-30 py-3"
                >
                  <div
                    role="tablist"
                    aria-label="Secciones de la ficha"
                    className="flex gap-1 overflow-x-auto rounded-2xl bg-white/85 backdrop-blur-sm ring-1 ring-slate-200 shadow-sm p-1"
                    onKeyDown={(e) => {
                      const salto = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
                      const i = secciones.findIndex(s => s.id === seccion);
                      let j = salto ? i + salto
                        : e.key === 'Home' ? 0
                        : e.key === 'End' ? secciones.length - 1
                        : -1;
                      if (j < 0) return;
                      e.preventDefault();
                      j = (j + secciones.length) % secciones.length;
                      irASeccion(secciones[j].id);
                      document.getElementById(`pill-${secciones[j].id}`)?.focus();
                    }}
                  >
                    {secciones.map((s) => {
                      const activa = seccion === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="tab"
                          id={`pill-${s.id}`}
                          tabIndex={activa ? 0 : -1}
                          aria-selected={activa}
                          aria-controls="doc-panel-ficha"
                          onClick={() => irASeccion(s.id)}
                          aria-label={`${s.etiqueta}${s.hecho ? ', completado' : ', pendiente'}${s.resumen ? `, ${s.resumen}` : ''}`}
                          className={`shrink-0 inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl text-[12px] font-bold transition-all ${
                            activa
                              ? 'bg-brand-deep text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {s.hecho ? (
                            <CheckCircle2 className={`w-3.5 h-3.5 ${activa ? 'text-emerald-300' : 'text-emerald-600'}`} aria-hidden="true" />
                          ) : (
                            <span className={`w-2 h-2 rounded-full ${activa ? 'bg-white/40' : 'bg-slate-300'}`} aria-hidden="true" />
                          )}
                          {s.etiqueta}
                          <span className="font-mono text-[10px] opacity-70">{s.resumen}</span>
                        </button>
                      );
                    })}
                  </div>
                </nav>
              )}

              <div id="doc-panel-ficha" role="tabpanel" aria-labelledby={`pill-${seccion}`} className="space-y-5" ref={formRef}>
                {/* ---------- Signos vitales (desplegable colapsado) ---------- */}
              <section aria-label="Signos vitales" className={`${seccionVisible('signos')} animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden scroll-mt-28`}>
                <div className="lg:hidden px-5 py-3 border-b border-slate-100">
                  <h2 className="font-display font-bold text-base text-brand-deep">Signos vitales</h2>
                  <p className="text-[11px] text-slate-400">{resumen.vitales} de 7 registrados</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVitalesAbierto((v) => !v)}
                  aria-expanded={vitalesAbierto}
                  aria-label="Desplegar signos vitales"
                  className="hidden lg:flex w-full px-5 py-3 items-center gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="h-8 w-8 rounded-xl bg-brand-danger/10 text-brand-danger flex items-center justify-center shrink-0 ring-1 ring-brand-danger/20">
                    <Heart className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-left font-display font-bold text-[15px] text-brand-deep">Signos vitales</span>
                  <span className="text-[11px] text-slate-400 mr-2">{resumen.vitales}/7</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${vitalesAbierto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {(vitalesAbierto || seccion === 'signos') && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-100 lg:border-t-0 lg:pt-2 animate-fade-in">
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {SIGNOS.map((s) => {
                        const Icon = s.icon;
                        const flag = estadoSigno(s.key, signos[s.key]);
                        const cls = flag === 'alto'
                          ? '!ring-2 !ring-red-300'
                          : flag === 'ok'
                            ? '!ring-1 !ring-emerald-300'
                            : '';
                        return (
                          <label key={s.key} className="block">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                              <span>{s.label}</span>
                              <Icon className={`w-2.5 h-2.5 ${flag === 'alto' ? 'text-red-500' : flag === 'ok' ? 'text-emerald-500' : ''}`} />
                            </span>
                            <div className="relative mt-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={signos[s.key]}
                                onChange={setSigno(s.key)}
                                placeholder={s.ph}
                                aria-label={`${s.label} en ${s.unidad}`}
                                className={`cp-input !px-2.5 !py-1.5 pr-6 text-center font-mono text-[13px] font-semibold ${cls}`}
                                title={flag === 'alto' ? 'Fuera de rango normal' : flag === 'ok' ? 'En rango normal' : ''}
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400">{s.unidad}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* ---------- Motivo · Examen físico · Diagnóstico (col-6) + Tratamiento e indicaciones (col-6) ---------- */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                <section aria-label="Motivo, examen físico y diagnóstico" className={`${seccionVisible('motivo')} animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden scroll-mt-28`} style={{ animationDelay: '60ms' }}>
                  <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-slate-100">
                    <div className="h-9 w-9 rounded-xl bg-asistencial-500/10 text-asistencial-600 flex items-center justify-center ring-1 ring-asistencial-500/20">
                      <Stethoscope className="w-[18px] h-[18px]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display font-bold text-base text-brand-deep">Motivo · Examen físico · Diagnóstico</h3>
                      <p className="text-[11px] text-slate-400">Ficha clínica básica del paciente</p>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <label htmlFor="doc-motivo" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Motivo de consulta - síntomas *
                      </label>
                      <textarea id="doc-motivo" ref={motivoRef} className="cp-input" rows={2} placeholder="Descripción del cuadro que motiva la consulta de emergencias…" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
                    </div>
                    <div>
                      <label htmlFor="doc-examen-fisico" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Examen físico
                      </label>
                      <textarea id="doc-examen-fisico" className="cp-input" rows={3} placeholder="Hallazgos: estado general, piel, cardio-pulmonar, abdomen…" value={examenFisico} onChange={(e) => setExamenFisico(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="doc-diagnostico" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Diagnóstico *
                      </label>
                      <input id="doc-diagnostico" ref={diagnosticoRef} className="cp-input" placeholder="Ej: Neumonía adquirida en la comunidad" value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} required />
                    </div>
                  </div>
                </section>

                <section aria-label="Tratamiento e indicaciones" className={`${seccionVisible('tratamiento')} animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden scroll-mt-28`} style={{ animationDelay: '120ms' }}>
                  <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-slate-100">
                    <div className="h-9 w-9 rounded-xl bg-brand-success/10 text-brand-success flex items-center justify-center ring-1 ring-brand-success/20">
                      <Pill className="w-[18px] h-[18px]" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-brand-deep">Tratamiento e indicaciones</h3>
                      <p className="text-[11px] text-slate-400">Farmacoterapia y cuidados</p>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="doc-tratamiento" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                          Tratamiento instaurado
                        </label>
                        <button
                          type="button"
                          onClick={abrirInsumos}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 text-xs font-bold transition-colors"
                        >
                          <Pill className="w-3.5 h-3.5" />
                          Aplicar insumos / medicamentos
                          {insumos.length > 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-danger" title={`${insumos.length} aplicado(s)`} />
                          )}
                        </button>
                      </div>
                      <textarea id="doc-tratamiento" className="cp-input" rows={2} placeholder="Fluidoterapia, oxigenoterapia, manejo analgésico…" value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} />
                      {insumos.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {insumos.map((it, idx) => (
                            <div key={it.insumo_id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-brand-primary/5 ring-1 ring-brand-primary/20 text-[12px]">
                              <Pill className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                              <span className="flex-1 min-w-0 truncate text-slate-700">{it.nombre}</span>
                              <span className="font-mono text-[11px] text-slate-500">{it.cantidad}× {it.unidad}</span>
                              <button type="button" onClick={quitarInsumo(idx)} aria-label={`Quitar ${it.nombre}`} className="p-1 rounded text-slate-400 hover:text-brand-danger transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label htmlFor="doc-indicaciones" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Indicaciones y recomendaciones
                      </label>
                      <textarea id="doc-indicaciones" className="cp-input" rows={3} placeholder="Reposo relativo, control ambulatorio en 48 h, signos de alarma…" value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} />
                    </div>
                  </div>
                </section>

                <section aria-label="Recetas médicas" className={`${seccionVisible('recetas')} animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden scroll-mt-28`} style={{ animationDelay: '120ms' }}>
                  <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-slate-100">
                    <div className="h-9 w-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center ring-1 ring-brand-primary/20">
                      <FileText className="w-[18px] h-[18px]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display font-bold text-base text-brand-deep">Recetas médicas</h3>
                      <p className="text-[11px] text-slate-400">
                        {resumen.recetasOk > 0 ? `${resumen.recetasOk} receta(s) con medicamento` : 'Agrega los medicamentos que se van a despachar'}
                      </p>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Medicamentos</span>
                        <button type="button" onClick={addReceta} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-success/10 text-brand-success hover:bg-brand-success/20 text-xs font-bold transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Agregar medicamento
                        </button>
                      </div>
                      <div className="space-y-2">
                        {recetas.map((r, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                              <button
                                type="button"
                                onClick={() => abrirCatMed(idx)}
                                className="flex-1 min-w-0 text-left inline-flex items-center gap-2 rounded-lg px-2.5 py-2 bg-brand-primary/5 ring-1 ring-brand-primary/20 hover:bg-brand-primary/10 hover:ring-brand-primary/40 transition-colors"
                              >
                                <Pill className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                                <span className={`flex-1 min-w-0 truncate text-[13px] ${r.nombre ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                                  {r.nombre || 'Seleccionar medicamento del catálogo…'}
                                </span>
                                <Search className="w-3.5 h-3.5 text-brand-primary/60 shrink-0" />
                              </button>
                              <button
                                type="button"
                                onClick={delReceta(idx)}
                                disabled={recetas.length === 1}
                                aria-label={`Quitar medicamento ${idx + 1}`}
                                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-brand-danger/70 hover:bg-brand-danger/10 hover:text-brand-danger transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="px-3 pb-3">
                              <input
                                className="cp-input"
                                placeholder="Posología (ej: 1 tableta c/8 h × 5 días)"
                                aria-label={`Posología del medicamento ${idx + 1}`}
                                value={r.posologia}
                                onChange={setReceta(idx, 'posologia')}
                              />
                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-0.5">Frecuencia</span>
                                {FRECUENCIAS_POSOLOGIA.map((f) => (
                                  <button
                                    key={f}
                                    type="button"
                                    onClick={() => agregarPosologiaChip(idx, f)}
                                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-brand-primary/10 hover:text-brand-primary text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 hover:ring-brand-primary/40 transition-colors"
                                  >
                                    {f}
                                  </button>
                                ))}
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-1 mr-0.5">· Duración</span>
                                {DURACIONES_POSOLOGIA.map((d) => (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => agregarPosologiaChip(idx, d)}
                                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-brand-success/10 hover:text-brand-success text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 hover:ring-brand-success/40 transition-colors"
                                  >
                                    {d}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] leading-snug text-slate-400 mt-1.5">
                        Al elegir el medicamento se precarga la dosis según su forma (1 tableta, 1 cápsula, 1 ampolla…); arma la posología con los accesos rápidos de frecuencia y duración.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
              </div>

              {/* ---------- Resultados de exámenes (retomar consulta no remitida del día) ---------- */}
              {examenesRetomables.length > 0 && (
                <section aria-label="Resultados de exámenes" className="animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden" style={{ animationDelay: '160ms' }}>
                  <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-slate-100">
                    <div className="h-9 w-9 rounded-xl bg-asistencial-500/10 text-asistencial-600 flex items-center justify-center ring-1 ring-asistencial-500/20 shrink-0">
                      <ClipboardList className="w-[18px] h-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-base text-brand-deep truncate">Resultados de exámenes</h3>
                      <p className="text-[11px] text-slate-400 truncate">
                        Consulta de hoy{retomoInfo?.comprobanteRef ? ` · ${retomoInfo.comprobanteRef}` : ''} — se actualiza el mismo comprobante
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30 px-2.5 py-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                      No remitido
                    </span>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    {examenesRetomables.map((k) => {
                      const cat = categoriaEstilo(k);
                      const esLab = k === 'laboratorio';
                      return (
                        <div key={k}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1" style={{ backgroundColor: cat.soft, color: cat.color, borderColor: cat.color }}>
                              {cat.etiqueta}
                            </span>
                            <span className="text-[10px] text-slate-400">Ingresa el resultado de cada estudio ordenado</span>
                          </div>
                          <div className="space-y-2.5">
                            {examenes[k].items.map((it, idx) => (
                              <div key={idx} className="rounded-xl ring-1 ring-slate-200 bg-slate-50/60 p-3">
                                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-slate-700">{it.estudio}</p>
                                    {it.indicacion ? (
                                      <p className="text-[11px] text-slate-400 mt-0.5">Indicación: {it.indicacion}</p>
                                    ) : null}
                                    {it.resultado ? (
                                      <p className="mt-1.5 inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                        Resultado registrado
                                      </p>
                                    ) : null}
                                  </div>
                                  {esLab ? (
                                    <input
                                      type="text"
                                      className="cp-input !py-2 sm:max-w-[280px] text-[13px]"
                                      placeholder="Resultado / valor (ej: 150 mg/dL)"
                                      aria-label={`Resultado de ${it.estudio}`}
                                      value={it.resultado || ''}
                                      onChange={setResultadoExamen(k, idx)}
                                    />
                                  ) : (
                                    <textarea
                                      className="cp-input !py-2 sm:max-w-[320px] text-[13px]"
                                      rows={2}
                                      placeholder="Informe / conclusión del estudio…"
                                      aria-label={`Informe de ${it.estudio}`}
                                      value={it.resultado || ''}
                                      onChange={setResultadoExamen(k, idx)}
                                    />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[10px] leading-snug text-slate-400">
                      Al guardar, los resultados quedarán anexados a la consulta de hoy ({retomoInfo?.comprobanteRef || 'mismo comprobante'}), sin generar un registro nuevo.
                    </p>
                  </div>
                </section>
              )}

            </div>

            {/* ============ COLUMNA LATERAL — acciones (solo escritorio) ============ */}
            <aside className="hidden xl:block xl:sticky xl:top-20 space-y-4">
              <div className="animate-fade-up rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-5 space-y-2.5" style={{ animationDelay: '90ms' }}>
                <h3 className="font-display font-bold text-lg text-brand-deep mb-3">Acciones sobre la consulta</h3>
                {accionesContenido}
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* ============ BARRA FIJA DE ACCIONES (móvil/tablet) ============
          Reemplaza al botón flotante: finalizar queda a un toque y siempre
          visible, sin importar qué sección de la ficha esté abierta. El
          footer del Instituto deja de ocupar la base en este modo. */}
      {pacienteActual && (
        <div className="thumb-bar xl:hidden bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-2 py-2">
            <button
              type="button"
              onClick={() => setAccionesAbierto(true)}
              aria-label="Abrir acciones sobre la consulta"
              aria-expanded={accionesAbierto}
              className="h-12 shrink-0 inline-flex items-center gap-2 px-4 rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200 active:scale-95 transition-all"
            >
              <Menu className="w-5 h-5" />
              <span className="font-bold text-[13px]">Más</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirm('finalizar')}
              disabled={busy}
              className="h-12 flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-success text-white font-bold text-sm shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-[18px] h-[18px]" />
              Finalizar consulta
            </button>
          </div>
        </div>
      )}

      {/* ============ SIDEBAR DESPLEGABLE DE ACCIONES (móvil/tablet) ============ */}
      {accionesAbierto && (
        <div className="fixed inset-0 z-40 xl:hidden" role="dialog" aria-modal="true" aria-labelledby="acciones-title">
          <button
            aria-label="Cerrar panel de acciones"
            onClick={() => setAccionesAbierto(false)}
            className="absolute inset-0 w-full h-full cursor-default bg-brand-deep/50 backdrop-blur-sm animate-fade-in"
          />
          <aside className="drawer-panel absolute top-0 right-0 h-full w-[78vw] max-w-[20rem] bg-slate-50 shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center gap-3 shrink-0">
              <div className="h-9 w-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center ring-1 ring-brand-primary/20 shrink-0">
                <Settings2 className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="acciones-title" className="font-display font-bold text-base text-brand-deep">Acciones sobre la consulta</h3>
                <p className="text-[11px] text-slate-400 truncate">{pacienteActual?.paciente_nombre}</p>
              </div>
              <button onClick={() => setAccionesAbierto(false)} aria-label="Cerrar acciones" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {accionesContenido}
            </div>
          </aside>
        </div>
      )}

      {/* ============================== MODAL: ORDEN DE EXÁMENES ============================== */}
      <PanelModal
        abierto={ordenAbierta}
        onClose={() => {
          setExamenes(seleccionadosAExamenes(examSeleccionados));
          setOrdenAbierta(false);
        }}
        id="edi-ordenes-modal"
        titulo="Orden médica de estudios"
        subtitulo={`Seleccione los exámenes a solicitar para ${pacienteActual?.paciente_nombre || ''}`}
        icono={<ListChecks className="w-5 h-5" />}
        maxW="max-w-3xl"
      >
        <MedicalOrderSelector
          seleccionados={examSeleccionados}
          onSeleccionados={setExamSeleccionados}
        />
      </PanelModal>

      {/* ============================== MODAL: HISTORIAL MULTICENTRO ============================== */}
      <PanelModal
        abierto={historialAbierto}
        onClose={() => setHistorialAbierto(false)}
        id="edi-historial-modal"
        titulo="Historial del paciente"
        subtitulo="Consultas registradas en todos los centros de la red"
        icono={<History className="w-5 h-5" />}
        maxW="max-w-3xl"
      >
        <VerHistorial pacienteId={pacienteActual?.paciente_id || null} />
      </PanelModal>

      {/* ============================== MODAL: FICHA MÉDICA / DIAGNÓSTICO ============================== */}
      {fichaAbierta && pacienteActual && (
        <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ficha-title" tabIndex={-1}>
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in">
            {/* Cabecera: ficha médica */}
            <div className="brand-orbit text-white px-6 py-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center font-display font-bold text-xl shrink-0">
                {(pacienteActual.paciente_nombre || 'P').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="ficha-title" className="font-display font-bold text-xl truncate">
                  {pacienteActual.paciente_nombre} {pacienteActual.apellido || ''}
                </h3>
                <p className="font-mono text-[11px] text-white/80 truncate">
                  C.I. {pacienteActual.paciente_cedula} · {historia.tipo_sangre ? `Sangre ${historia.tipo_sangre}` : 'Sin tipo de sangre'}
                </p>
              </div>
              <button onClick={() => setFichaAbierta(false)} aria-label="Cerrar ficha" className="p-1.5 rounded-lg text-white/80 hover:bg-white/15 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 flex-1 overflow-y-auto space-y-4 text-[13px]">
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Ficha médica del paciente</p>

                <div>
                  <span className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Tipo de sangre</span>
                  <div className="flex flex-wrap gap-1.5">
                    {TIPOS_SANGRE.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setHistoria((h) => ({ ...h, tipo_sangre: h.tipo_sangre === t ? '' : t }));
                          setFichaGuardada(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[13px] font-mono font-semibold ring-1 transition-all ${
                          historia.tipo_sangre === t
                            ? 'bg-brand-danger text-white ring-brand-danger shadow-sm -translate-y-0.5'
                            : 'bg-white text-slate-500 ring-slate-200 hover:ring-brand-danger/50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="fic-antecedentes" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                    Antecedentes de enfermedad <span className="normal-case font-normal text-slate-400">(una por línea)</span>
                  </label>
                  <textarea id="fic-antecedentes" className="cp-input" rows={3} placeholder={'Diabetes\nHipertensión arterial (HTA)\nAsma\n—'} value={historia.antecedentes} onChange={(e) => { setHistoria((h) => ({ ...h, antecedentes: e.target.value })); setFichaGuardada(false); }} />
                </div>

                <div>
                  <label htmlFor="fic-operatorios" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                    Antecedentes operatorios <span className="normal-case font-normal text-slate-400">(si fue operado, una por línea)</span>
                  </label>
                  <textarea id="fic-operatorios" className="cp-input" rows={3} placeholder={'Apendicectomía (2019)\nCesárea (2021)\nNinguno\n—'} value={historia.operatorios} onChange={(e) => { setHistoria((h) => ({ ...h, operatorios: e.target.value })); setFichaGuardada(false); }} />
                </div>

                <div>
                  <label htmlFor="fic-alergias" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                    Alergias <span className="normal-case font-normal text-slate-400">(una por línea)</span>
                  </label>
                  <textarea id="fic-alergias" className="cp-input" rows={2} placeholder={'Penicilina\nAspirina\n—'} value={historia.alergias} onChange={(e) => { setHistoria((h) => ({ ...h, alergias: e.target.value })); setFichaGuardada(false); }} />
                </div>

                <div>
                  <label htmlFor="fic-telefono" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                    Teléfono de contacto
                  </label>
                  <input id="fic-telefono" type="tel" className="cp-input" placeholder="04XX-XXXXXXX" value={historia.telefono} onChange={(e) => { setHistoria((h) => ({ ...h, telefono: e.target.value })); setFichaGuardada(false); }} />
                </div>

                {fichaError && (
                  <p className="text-[12px] font-medium text-rose-600 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{fichaError}</p>
                )}
                {fichaGuardada && (
                  <p className="text-[12px] font-medium text-brand-success bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Ficha médica guardada correctamente.
                  </p>
                )}
                <button
                  onClick={guardarFicha}
                  disabled={guardandoFicha}
                  className="w-full py-2.5 rounded-xl bg-brand-primary hover:bg-brand-deep text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                >
                  {guardandoFicha ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar ficha
                </button>
              </div>
            </div>

            <div className="px-6 pb-6 pt-1 flex gap-2.5 border-t border-slate-100">
              <button onClick={() => setFichaAbierta(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                Cerrar
              </button>
              <button
                onClick={exportarPdfFicha}
                disabled={pdfGenerando}
                className="flex-[1.8] py-2.5 rounded-xl bg-brand-danger hover:bg-brand-dangerDark text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {pdfGenerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Exportar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== MODAL: CATÁLOGO DE MEDICAMENTOS ============================== */}
      {catMedAbierto !== null && (
        <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="catmed-title" tabIndex={-1}>
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand-success/10 text-brand-success flex items-center justify-center">
                <Pill className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="catmed-title" className="font-display font-bold text-lg text-brand-deep truncate">Catálogo de medicamentos</h3>
                <p className="text-[11px] text-slate-400">Selecciona para la receta {catMedAbierto + 1} · la posología sugerida se precarga</p>
              </div>
              <div className="relative">
                <input
                  id="catmed-busqueda"
                  value={catMedBusqueda}
                  onChange={(e) => setCatMedBusqueda(e.target.value)}
                  placeholder="Buscar…"
                  className="pl-8 pr-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 w-44"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
              <button onClick={() => setCatMedAbierto(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 flex-1 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  resetCatMedNuevo();
                  setCatMedNuevoAbierto(true);
                }}
                className="w-full mb-3 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-success/40 text-brand-success hover:border-brand-success hover:bg-brand-success/5 font-bold text-sm py-2.5 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nuevo medicamento
              </button>

              {catMedCargando ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-primary" />
                  <p className="mt-2 text-sm">Cargando catálogo…</p>
                </div>
              ) : catMedError ? (
                <div className="py-10 text-center text-brand-danger">
                  <p className="text-sm font-semibold">{catMedError}</p>
                  <button type="button" onClick={() => abrirCatMed(catMedAbierto)} className="mt-3 text-xs font-bold text-brand-primary hover:underline">
                    Reintentar
                  </button>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {catMedicamentos
                    .filter((m) => {
                      const q = catMedBusqueda.trim().toLowerCase();
                      if (!q) return true;
                      return [m.nombre, m.presentacion, m.concentracion].filter(Boolean).join(' ').toLowerCase().includes(q);
                    })
                    .map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => seleccionarMedicamento(m)}
                          className="w-full text-left rounded-xl px-3.5 py-2.5 bg-slate-50 hover:bg-brand-success/10 ring-1 ring-slate-200 hover:ring-brand-success/40 transition-colors"
                        >
                          <span className="block text-sm font-semibold text-slate-700">
                            {m.nombre}
                            <span className="text-slate-400 font-normal"> · {[m.presentacion, m.concentracion].filter(Boolean).join(' · ')}</span>
                          </span>
                          <span className="block text-xs mt-0.5 text-brand-success font-semibold">
                            Se prellena: {posologiaBase(m)}
                          </span>
                          {m.posologia_sugerida && m.posologia_sugerida.toLowerCase() !== posologiaBase(m).toLowerCase() && (
                            <span className="block text-[11px] text-slate-400">
                              Ref. sugerida: {m.posologia_sugerida}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  {catMedicamentos.length === 0 && (
                    <p className="py-10 text-center text-sm text-slate-400">El catálogo está vacío. Agrega el primer medicamento.</p>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================== MODAL: NUEVO MEDICAMENTO ============================== */}
      {catMedNuevoAbierto && (
        <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="catmed-nuevo-title" tabIndex={-1}>
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand-success/10 text-brand-success flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="catmed-nuevo-title" className="font-display font-bold text-lg text-brand-deep truncate">Nuevo medicamento</h3>
                <p className="text-[11px] text-slate-400">Quedará disponible para todos los médicos</p>
              </div>
              <button onClick={() => setCatMedNuevoAbierto(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={guardarMedicamentoNuevo} className="px-6 py-5 space-y-3 overflow-y-auto">
              <div>
                <label htmlFor="catmed-nombre" className="block text-xs font-bold text-slate-500 mb-1">Nombre *</label>
                <input id="catmed-nombre" className="cp-input" placeholder="ej: Ibuprofeno" value={catMedNuevo.nombre} onChange={(e) => setCatMedNuevo({ ...catMedNuevo, nombre: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="catmed-presentacion" className="block text-xs font-bold text-slate-500 mb-1">Presentación</label>
                  <input id="catmed-presentacion" className="cp-input" placeholder="ej: tableta" value={catMedNuevo.presentacion} onChange={(e) => setCatMedNuevo({ ...catMedNuevo, presentacion: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="catmed-concentracion" className="block text-xs font-bold text-slate-500 mb-1">Concentración</label>
                  <input id="catmed-concentracion" className="cp-input" placeholder="ej: 400 mg" value={catMedNuevo.concentracion} onChange={(e) => setCatMedNuevo({ ...catMedNuevo, concentracion: e.target.value })} />
                </div>
              </div>
              <div>
                <label htmlFor="catmed-posologia" className="block text-xs font-bold text-slate-500 mb-1">Posología sugerida</label>
                <input id="catmed-posologia" className="cp-input" placeholder="ej: 1 tableta c/8 h × 5 días" value={catMedNuevo.posologia_sugerida} onChange={(e) => setCatMedNuevo({ ...catMedNuevo, posologia_sugerida: e.target.value })} />
              </div>

              {catMedMsg && (
                <div className="rounded-xl bg-brand-success/10 text-brand-success px-3 py-2 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {catMedMsg}
                </div>
              )}
              {catMedError && (
                <div className="rounded-xl bg-brand-danger/10 text-brand-danger px-3 py-2 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {catMedError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCatMedNuevoAbierto(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={catMedGuardando}
                  className="flex-[1.6] py-2.5 rounded-xl bg-brand-success hover:bg-brand-success/90 text-white font-bold text-sm transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {catMedGuardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Guardar en catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================== MODAL: RETOMAR PACIENTE ============================== */}
      {retomarAbierto && (
        <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="retomar-title" tabIndex={-1}>
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 id="retomar-title" className="font-display font-bold text-xl text-brand-deep">Retomar paciente</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Buscar por cédula y consultar la última historia clínica</p>
              </div>
              <button onClick={() => setRetomarAbierto(false)} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 flex-1 overflow-y-auto space-y-5">
              <form onSubmit={buscarPorCedula} className="flex flex-col sm:flex-row gap-2.5" noValidate>
                <label htmlFor="retomar-cedula" className="visually-hidden">Cédula del paciente</label>
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id="retomar-cedula" className="cp-input !pl-10" placeholder="Cédula (ej: 12345678)" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoComplete="off" />
                </div>
                <button type="submit" disabled={buscandoHistoria} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-deep text-white font-bold text-sm transition-all disabled:opacity-60">
                  {buscandoHistoria ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Buscar
                </button>
              </form>

              <div aria-live="polite" aria-atomic="true">
                {errorBusqueda && (
                  <div role="alert" className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] ring-1 border border-rose-200 bg-rose-50 text-rose-700 animate-fade-up">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorBusqueda}</span>
                  </div>
                )}
              </div>

              {resultadoHistoria && (
                <div className="space-y-4 animate-fade-up">
                  <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-brand-danger/10 ring-1 ring-brand-danger/30 flex items-center justify-center text-brand-danger font-display font-bold shrink-0">
                      {(resultadoHistoria.nombre_completo || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-base text-brand-deep truncate">{resultadoHistoria.nombre_completo}</p>
                      <p className="font-mono text-xs text-slate-400">
                        C.I. {resultadoHistoria.cedula}
                        {resultadoHistoria.tipo_sangre ? ` · Sangre ${resultadoHistoria.tipo_sangre}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {resultadoHistoria.telefono && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white ring-1 ring-slate-200 text-slate-500">
                          <Phone className="w-3 h-3" /> {resultadoHistoria.telefono}
                        </span>
                      )}
                      {resultadoHistoria.numero_historia && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white ring-1 ring-slate-200 text-slate-500">
                          <ShieldCheck className="w-3 h-3" /> {resultadoHistoria.numero_historia}
                        </span>
                      )}
                    </div>
                  </div>

                  {(resultadoHistoria.alergias?.length > 0 || resultadoHistoria.antecedentes_medicos?.length > 0) && (
                    <div className="rounded-xl ring-1 ring-slate-200 p-4">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Expediente
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-3 text-[13px]">
                        <div>
                          <p className="text-slate-400 font-medium mb-1">Alergias</p>
                          {resultadoHistoria.alergias?.length ? (
                            <p className="text-slate-700">{resultadoHistoria.alergias.join(', ')}</p>
                          ) : (
                            <p className="text-slate-400">Sin alergias registradas</p>
                          )}
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium mb-1">Antecedentes médicos</p>
                          {resultadoHistoria.antecedentes_medicos?.length ? (
                            <p className="text-slate-700">{resultadoHistoria.antecedentes_medicos.join(', ')}</p>
                          ) : (
                            <p className="text-slate-400">Sin antecedentes registrados</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-brand-primary text-white flex items-center gap-2.5">
                      <History className="w-4 h-4" />
                      <div>
                        <h4 className="font-display font-bold text-sm leading-tight">Última historia clínica</h4>
                        <p className="text-[10px] text-white/70">{formatearFecha(resultadoHistoria.ultimaConsulta?.fecha)}</p>
                      </div>
                    </div>
                    {resultadoHistoria.ultimaConsulta ? (
                      <div className="p-4 space-y-3 text-[13px]">
                        <div className="grid sm:grid-cols-2 gap-2">
                          <div>
                            <p className="text-slate-400 font-medium">Motivo de consulta</p>
                            <p className="text-slate-700">{resultadoHistoria.ultimaConsulta.motivo_consulta || '—'}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-medium">Diagnóstico</p>
                            <p className="text-slate-700 font-medium">
                              {resultadoHistoria.ultimaConsulta.cie10_descripcion || '—'}
                              {resultadoHistoria.ultimaConsulta.cie10_codigo ? (
                                <span className="text-slate-400 font-mono"> ({resultadoHistoria.ultimaConsulta.cie10_codigo})</span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                        {resultadoHistoria.ultimaConsulta.examen_fisico && (
                          <div>
                            <p className="text-slate-400 font-medium">Examen físico</p>
                            <p className="text-slate-700">{resultadoHistoria.ultimaConsulta.examen_fisico}</p>
                          </div>
                        )}
                        {resultadoHistoria.ultimaConsulta.signos_vitales && (
                          <div>
                            <p className="text-slate-400 font-medium mb-1">Signos vitales</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(() => {
                                const sv = resultadoHistoria.ultimaConsulta.signos_vitales;
                                const filas = [];
                                if (sv.presion_arterial) filas.push(`P.A. ${sv.presion_arterial} mmHg`);
                                if (sv.frecuencia_cardiaca != null) filas.push(`F.C. ${sv.frecuencia_cardiaca} lpm`);
                                if (sv.frecuencia_respiratoria != null) filas.push(`F.R. ${sv.frecuencia_respiratoria} rpm`);
                                if (sv.temperatura != null) filas.push(`T° ${sv.temperatura} °C`);
                                if (sv.saturacion_oxigeno != null) filas.push(`SpO₂ ${sv.saturacion_oxigeno} %`);
                                if (sv.peso_kg != null) filas.push(`Peso ${sv.peso_kg} kg`);
                                if (sv.talla_cm != null) filas.push(`Talla ${sv.talla_cm} cm`);
                                return filas.map((f) => (
                                  <span key={f} className="px-2 py-1 rounded-lg bg-slate-100 font-mono text-xs text-slate-600">{f}</span>
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                        {resultadoHistoria.ultimaConsulta.tratamiento && (
                          <div>
                            <p className="text-slate-400 font-medium">Tratamiento</p>
                            <p className="text-slate-700">{resultadoHistoria.ultimaConsulta.tratamiento}</p>
                          </div>
                        )}
                        {resultadoHistoria.ultimaConsulta.recetas?.length > 0 && (
                          <div>
                            <p className="text-slate-400 font-medium mb-1">Recetas</p>
                            <ul className="list-disc pl-5 text-slate-700 space-y-0.5">
                              {resultadoHistoria.ultimaConsulta.recetas.map((r, i) => (
                                <li key={i}>
                                  <span className="font-medium">{r.nombre}</span>
                                  {r.posologia ? <span className="text-slate-500"> — {r.posologia}</span> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {resultadoHistoria.ultimaConsulta.recomendaciones && (
                          <div>
                            <p className="text-slate-400 font-medium">Recomendaciones</p>
                            <p className="text-slate-700">{resultadoHistoria.ultimaConsulta.recomendaciones}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 text-[13px] text-slate-500">
                        No hay consultas previas registradas. Podrás iniciar una nueva ficha para este paciente.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 pt-1 flex gap-2.5 border-t border-slate-100">
              <button onClick={() => setRetomarAbierto(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                Cerrar
              </button>
              <button
                onClick={aplicarPrecarga}
                disabled={!resultadoHistoria || buscandoHistoria}
                className="flex-[1.8] py-2.5 rounded-xl bg-brand-primary hover:bg-brand-deep text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-4 h-4" /> Precargar en ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== MODAL: INSUMOS / TRATAMIENTOS ============================== */}
      {insumosAbierto && (
        <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="insumos-title" tabIndex={-1}>
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <Pill className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="insumos-title" className="font-display font-bold text-lg text-brand-deep truncate">Aplicar insumos / medicamentos</h3>
                <p className="text-[11px] text-slate-400">El stock se descuenta del inventario al finalizar la consulta</p>
              </div>
              <div className="relative">
                <input
                  id="insumo-busqueda"
                  value={insumoBusqueda}
                  onChange={(e) => setInsumoBusqueda(e.target.value)}
                  placeholder="Buscar…"
                  className="pl-8 pr-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 w-44"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
              <button onClick={() => setInsumosAbierto(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 flex-1 overflow-y-auto">
              {insumosCargando ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-primary" />
                  <p className="mt-2">Cargando inventario…</p>
                </div>
              ) : inventarioError ? (
                <div role="alert" className="py-10 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto text-brand-danger" />
                  <p className="mt-2 text-sm text-brand-danger">{inventarioError}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {inventario
                    .filter((m) => (m.stock_actual || 0) > 0)
                    .filter((m) => !insumoBusqueda.trim() || m.nombre.toLowerCase().includes(insumoBusqueda.trim().toLowerCase()))
                    .map((m) => {
                      const ya = insumos.find((i) => String(i.insumo_id) === String(m.id) && i.tabla_origen === m.tabla_origen);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => agregarInsumo(m)}
                          aria-pressed={!!ya}
                          className={`text-left rounded-xl px-3.5 py-2.5 ring-1 transition-colors ${
                            ya ? 'bg-brand-primary/5 ring-brand-primary/40' : 'bg-white ring-slate-200 hover:ring-brand-primary/40 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[13px] font-semibold text-slate-700 leading-snug">{m.nombre}</span>
                            <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${(m.stock_actual || 0) < (m.stock_minimo || 0) ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {m.stock_actual}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {[m.presentacion, m.concentracion, m.unidad].filter(Boolean).join(' · ') || m.categoria || '—'}
                          </p>
                          <p className="text-[10px] font-bold mt-1.5 text-brand-primary">
                            {ya ? `Aplicado (${ya.cantidad}) — tocar para sumar` : '+ Aplicar'}
                          </p>
                        </button>
                      );
                    })}
                  {inventario.filter((m) => (m.stock_actual || 0) > 0).length === 0 && (
                    <p className="col-span-full text-center text-slate-400 py-8 text-sm">No hay medicamentos/insumos con stock disponible.</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <p className="text-[12px] text-slate-500">
                {insumos.length > 0
                  ? `${insumos.length} tratamiento(s) aplicado(s) — se descontarán del stock al finalizar`
                  : 'Ninguno seleccionado'}
              </p>
              <button onClick={() => setInsumosAbierto(false)} className="px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-deep">
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== MODAL REMISIÓN DE EXÁMENES ============================== */}
      {exremAbierto && (
        <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="exrem-title" tabIndex={-1}>
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 id="exrem-title" className="font-display font-bold text-xl text-brand-deep">Remitir para examen</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Centros adscritos · Instituto de Salud de Simón Bolívar</p>
              </div>
              <button onClick={() => setExremAbierto(false)} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto min-h-0">
              {exremElegible && !exremElegible.elegible && (
                <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-[13px] text-slate-600">
                  Este paciente es <b>público general</b>: solo recibirá la <b>orden de exámenes</b> local. La remisión a
                  centros adscritos es exclusiva de <b>trabajadores y beneficiarios</b>.
                </div>
              )}
              {exremElegible && exremElegible.elegible && !exremCita && (
                <>
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3">
                    <div className="h-10 w-10 rounded-full bg-asistencial-500/10 ring-1 ring-asistencial-500/30 flex items-center justify-center text-asistencial-600 font-display font-bold">
                      {pacienteActual?.paciente_nombre?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{pacienteActual?.paciente_nombre}</p>
                      <p className="font-mono text-xs text-slate-400">C.I. {pacienteActual?.paciente_cedula}</p>
                    </div>
                  </div>

                  {/* Paso 1: buscar examen */}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">1. Buscar examen en los centros adscritos</p>
                    <div className="flex gap-2">
                      <input
                        className="cp-input"
                        placeholder="Ej: radiografía, glicemia, Papanicolaou…"
                        value={exremBusqueda}
                        onChange={(e) => setExremBusqueda(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') buscarExamenRem(); }}
                      />
                      <button onClick={buscarExamenRem} disabled={exremCatalogoCargando} className="px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 shrink-0 inline-flex items-center gap-1.5">
                        {exremCatalogoCargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
                      </button>
                    </div>
                    {exremCatalogo.length > 0 && (
                      <div className="mt-2 max-h-44 overflow-y-auto rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100">
                        {exremCatalogo.map((ofr) => (
                          <button
                            key={ofr.id}
                            type="button"
                            onClick={() => seleccionarOfrecido(ofr)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 ${exremSel?.id === ofr.id ? 'bg-violet-50 ring-2 ring-violet-300' : ''}`}
                          >
                            <span className="flex-1 min-w-0">
                              <span className="block text-[13px] font-semibold text-slate-700">{ofr.examen}</span>
                              <span className="block text-[11px] text-slate-400">{ofr.centro} · {ofr.horario_texto} · Cupo {ofr.cupo_diario}/día</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Paso 2: elegir fecha y hora */}
                  {exremSel && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">2. Elegir fecha y hora · {exremSel.examen}</p>
                      <p className="text-[11px] text-slate-400 mb-2">{exremSel.centro} · {exremSel.horario_texto}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Día</p>
                          <div className="max-h-40 overflow-y-auto rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100">
                            {Object.keys(exremSelDias).map((fecha) => {
                              const d = exremSelDias[fecha];
                              return (
                                <button
                                  key={fecha}
                                  type="button"
                                  disabled={!d.disponible}
                                  onClick={() => { setExremFecha(fecha); setExremHora(''); }}
                                  className={`w-full text-left px-3 py-2 transition-colors ${exremFecha === fecha ? 'bg-violet-50 ring-2 ring-violet-300' : 'hover:bg-slate-50'} ${!d.disponible ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                  <span className="block text-[12px] font-semibold text-slate-700">
                                    {new Date(fecha + 'T00:00:00').toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  </span>
                                  <span className="block text-[10px] text-slate-400">{d.disponible ? `Cupo ${d.cupo} · ${d.turnos.length} turnos` : d.motivo}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Hora</p>
                          <div className="max-h-40 overflow-y-auto rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100">
                            {(exremSelDias[exremFecha]?.turnos || []).map((t, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setExremHora(t.hora_inicio)}
                                className={`w-full text-left px-3 py-2 transition-colors ${exremHora === t.hora_inicio ? 'bg-violet-50 ring-2 ring-violet-300' : 'hover:bg-slate-50'}`}
                              >
                                <span className="text-[12px] font-semibold text-slate-700">{t.hora_inicio}–{t.hora_fin}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Paso 3: confirmar */}
                  {exremSel && exremFecha && exremHora && !exremCita && (
                    <div className="rounded-xl ring-1 ring-slate-200 p-4 space-y-3">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">3. Confirmar remisión</p>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exremAcepta}
                          onChange={(e) => setExremAcepta(e.target.checked)}
                          className="mt-0.5 accent-violet-600"
                        />
                        <span className="text-[12px] text-slate-600 leading-relaxed">
                          El paciente <b>acepta esperar</b> para realizarse el examen en el centro adscrito y se compromete a asistir a la cita.
                        </span>
                      </label>
                      <input
                        className="cp-input"
                        placeholder="Motivo clínico de la remisión (opcional)"
                        value={exremMotivo}
                        onChange={(e) => setExremMotivo(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}

              {exremCita && (
                <div className="text-center py-6">
                  <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  </div>
                  <p className="mt-3 font-display font-bold text-lg text-brand-deep">Cita de examen agendada</p>
                  <p className="text-[12px] text-slate-500 mt-1">{exremCita.examen} · {exremCita.centro}</p>
                  <p className="text-[12px] text-slate-500">
                    {new Date(exremCita.fecha_cita + 'T00:00:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })} a las {exremCita.hora_inicio}
                  </p>
                  <p className="mt-4 inline-flex flex-col items-center gap-1 rounded-xl ring-1 ring-brand-primary/40 bg-brand-primary/5 px-6 py-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Código de confirmación</span>
                    <span className="font-mono text-xl font-bold text-brand-deep">{exremCita.codigo_confirmacion}</span>
                  </p>
                  <p className="mt-4 text-[12px] text-slate-500">
                    Al finalizar la consulta, la remisión quedará registrada en el historial con este código.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2">
              {exremError ? <p className="flex-1 text-[12px] text-brand-danger">{exremError}</p> : <span className="flex-1 text-[11px] text-slate-400">Se generará una cita con código de confirmación, igual que la remisión a especialidad.</span>}
              {exremCita ? (
                <button
                  onClick={() => { setExremAbierto(false); setConfirm('finalizar'); }}
                  className="px-5 py-2.5 rounded-xl bg-brand-success text-white text-sm font-semibold hover:brightness-95"
                >
                  Finalizar y guardar consulta
                </button>
              ) : (
                <>
                  <button onClick={() => setExremAbierto(false)} disabled={exremCreando} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50">
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarCitaExamen}
                    disabled={exremCreando || !exremElegible?.elegible || !exremSel || !exremFecha || !exremHora || !exremAcepta}
                    className="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-deep disabled:opacity-40 inline-flex items-center gap-1.5"
                  >
                    {exremCreando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />} Confirmar cita
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================== MODAL DE CONFIRMACIÓN ============================== */}
      {confirm && (
        <div className="fixed inset-0 z-50 modal-backdrop flex items-end sm:items-center sm:justify-center sm:p-4 justify-center" role="dialog" aria-modal="true" aria-labelledby="doc-confirm-title" tabIndex={-1}>
          <div className={`w-full ${confirm === 'remitir' ? 'max-w-2xl' : 'max-w-md'} max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in`}>
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 id="doc-confirm-title" className="font-display font-bold text-xl text-brand-deep">{CONFIRM_CFG[confirm].titulo}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Confirmación de cierre · {fechaStr}</p>
              </div>
              <button onClick={() => setConfirm(null)} aria-label="Cerrar" className="h-11 w-11 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto min-h-0">
              <p className="text-sm leading-relaxed text-slate-500">{CONFIRM_CFG[confirm].desc}</p>

              {pacienteActual && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3">
                  <div className="h-10 w-10 rounded-full bg-brand-danger/10 ring-1 ring-brand-danger/30 flex items-center justify-center text-brand-danger font-display font-bold">
                    {pacienteActual.paciente_nombre?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">{pacienteActual.paciente_nombre}</p>
                    <p className="font-mono text-xs text-slate-400">C.I. {pacienteActual.paciente_cedula}</p>
                  </div>
                </div>
              )}

              {confirm === 'finalizar' && exremCita && (
                <div className="rounded-xl bg-violet-50 ring-1 ring-violet-200 px-4 py-3 text-[12px] text-violet-800 space-y-0.5">
                  <p className="font-bold">Remisión para exámenes incluida</p>
                  <p>{exremCita.examen} · {exremCita.centro}</p>
                  <p>Cita {exremCita.fecha_cita} {exremCita.hora_inicio} · Código <span className="font-mono font-bold">{exremCita.codigo_confirmacion}</span></p>
                </div>
              )}

              {confirm === 'remitir' && (
                <div className="space-y-4">
                  {/* ---- Nivel de prioridad (azul / verde / amarillo) ---- */}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                      Nivel de prioridad *
                    </p>
                    {analizandoRemision ? (
                      <div className="flex items-center gap-2 text-[12px] text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando afiliación del paciente…
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {(['azul', 'verde', 'amarillo']).map((n) => {
                          const c = REMISION_NIVEL[n];
                          const bloqueado = (n === 'azul' && !esAfiliado) || (n !== 'azul' && esAfiliado);
                          const activo = nivelRemision === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              disabled={bloqueado || analizandoRemision}
                              onClick={() => { setNivelRemision(n); setDestino(''); }}
                              title={bloqueado ? (esAfiliado ? 'Trabajador/beneficiario: aplica nivel Azul' : 'Nivel Azul solo para trabajadores/beneficiarios') : c.desc}
                              className={`relative rounded-xl border px-2.5 py-2.5 text-center transition-all ${
                                activo ? c.seleccionado + ' shadow-sm' : c.softBg + ' ' + c.ring + ' ' + c.softText + ' ring-1 hover:brightness-95'
                              } ${bloqueado ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span className={`mx-auto mb-1 block h-2.5 w-2.5 rounded-full ${c.dot}`} />
                              <span className="block text-[12px] font-bold leading-tight">{c.etiqueta}</span>
                              <span className="hidden sm:block text-[9px] font-medium opacity-75 leading-tight mt-0.5">{c.corto}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {nivelRemision && !analizandoRemision && (
                      <p className={`mt-2 text-[11px] leading-snug ${REMISION_NIVEL[nivelRemision].softText}`}>
                        {REMISION_NIVEL[nivelRemision].desc}
                      </p>
                    )}
                  </div>

                  {/* ---- Especialidad de destino ---- */}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                      Especialidad de destino *
                    </p>
                    {!nivelRemision ? (
                      <p className="text-[12px] text-slate-400 bg-slate-50 ring-1 ring-slate-200 rounded-xl px-3 py-2.5">
                        Selecciona primero el nivel de prioridad para habilitar las especialidades.
                      </p>
                    ) : especialistasCargando ? (
                      <div className="flex items-center gap-2 text-[12px] text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando especialistas…
                      </div>
                    ) : Object.keys(especialistasPorEspecialidad).length === 0 ? (
                      <p className="text-[12px] text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-xl px-3 py-2.5">
                        No hay especialistas disponibles para remitir en este momento.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.keys(especialistasPorEspecialidad)
                            .sort()
                            .map((esp) => {
                              const c = REMISION_NIVEL[nivelRemision];
                              const activo = destino === esp;
                              return (
                                <button
                                  key={esp}
                                  type="button"
                                  onClick={() => {
                                    setDestino(esp);
                                    resetAgenda();
                                    setError('');
                                  }}
                                  className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${
                                    activo ? c.chipSel : c.chip
                                  }`}
                                >
                                  {esp}
                                </button>
                              );
                            })}
                        </div>

                        {destino && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                Especialista {especialistasPorEspecialidad[destino].length > 1 ? '(elige uno)' : ''}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {especialistasPorEspecialidad[destino].map((esp) => {
                                  const esActivo = especialistaSel === esp.id;
                                  return (
                                    <button
                                      key={esp.id}
                                      type="button"
                                      onClick={() => elegirEspecialista(esp.id)}
                                      className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all ${
                                        esActivo
                                          ? REMISION_NIVEL[nivelRemision].chipSel
                                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      {esp.nombre}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {especialistaSel && agendaCargando && (
                              <div className="flex items-center gap-2 text-[12px] text-slate-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando disponibilidad del especialista…
                              </div>
                            )}
                            {especialistaSel && !agendaCargando && agendaError && (
                              <p role="alert" className="text-[12px] text-brand-danger bg-brand-danger/5 ring-1 ring-brand-danger/30 rounded-xl px-3 py-2.5">
                                {agendaError}
                              </p>
                            )}
                            {especialistaSel && !agendaCargando && !agendaError && availRango && (
                              <div>
                                <CalendarioDisponibilidad
                                  dias={availDias}
                                  desde={availRango.desde}
                                  hasta={availRango.hasta}
                                  seleccion={fechaSel}
                                  onSeleccion={elegirFecha}
                                />
                                <p className="mt-1 text-[10px] text-slate-400">
                                  Ventana según prioridad {REMISION_NIVEL[nivelRemision].etiqueta}: desde{' '}
                                  <span className="font-mono">{availRango.desde}</span> hasta{' '}
                                  <span className="font-mono">{availRango.hasta}</span>
                                </p>
                              </div>
                            )}

                            {fechaSel && (
                              <div>
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                    Turno (hora) para el {fechaSel}
                                  </p>
                                  <span
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${REMISION_NIVEL[nivelRemision].softBg} ${REMISION_NIVEL[nivelRemision].softText}`}
                                  >
                                    Nivel {REMISION_NIVEL[nivelRemision].etiqueta}
                                  </span>
                                </div>
                                {turnosCargando ? (
                                  <div className="flex items-center gap-2 text-[12px] text-slate-400">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando turnos…
                                  </div>
                                ) : turnosSel.length === 0 ? (
                                  <p className="text-[12px] text-slate-400 bg-slate-50 ring-1 ring-slate-200 rounded-xl px-3 py-2.5">
                                    No hay turnos libres ese día.
                                  </p>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {turnosSel.map((t) => {
                                      const esActivo = horaSel === t.hora_inicio;
                                      return (
                                        <button
                                          key={`${t.turno_id}-${t.hora_inicio}`}
                                          type="button"
                                          onClick={() => setHoraSel(t.hora_inicio)}
                                          className={`px-3 py-2 rounded-lg border text-[12px] font-mono font-semibold transition-all ${
                                            esActivo
                                              ? REMISION_NIVEL[nivelRemision].chipSel
                                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                          }`}
                                        >
                                          {t.hora_inicio}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {especialistaSel && fechaSel && horaSel && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2.5 text-[12px] text-slate-600">
                                <span className="font-semibold text-slate-700">
                                  {(especialistas.find((e) => e.id === especialistaSel) || {}).nombre}
                                </span>
                                <span className="text-slate-300">|</span>
                                <span className="font-mono">{fechaSel}</span>
                                <span className="text-slate-300">|</span>
                                <span className="font-mono font-bold">{horaSel}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {error && <p className="text-[13px] text-brand-danger font-medium">{error}</p>}
            </div>

            <div className="px-6 pb-6 pt-4 flex gap-2.5 shrink-0 border-t border-slate-100">
              <button onClick={() => setConfirm(null)} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                Volver
              </button>
              <button
                onClick={ejecutar}
                disabled={busy}
                className={`flex-[1.6] py-2.5 rounded-xl text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-px shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${CONFIRM_CFG[confirm].clase}`}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Procesando…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> {CONFIRM_CFG[confirm].boton}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== FOOTER ==============================
          En móvil la barra de acciones ocupa la base, así que el crédito
          institucional solo aparece desde xl, donde hay columna lateral. */}
      <footer className="hidden xl:block brand-orbit text-white fixed bottom-0 inset-x-0 z-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg overflow-hidden ring-1 ring-white/20 bg-white flex items-center justify-center p-px shrink-0">
                <img src="/instituto-salud.jpeg" alt="Logo del Instituto de Salud" className="h-full w-full object-contain" />
              </div>
              <div className="leading-tight">
                <div className="font-display font-semibold text-xs leading-tight">Instituto de Salud</div>
                <div className="text-[10px] text-white/60">Alcaldía del Municipio Simón Bolívar</div>
              </div>
            </div>
            <span className="text-[10px] text-white/50 text-center sm:text-right">
              © {new Date().getFullYear()} BnaSalud — {centerFullName || 'Red de Salud'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
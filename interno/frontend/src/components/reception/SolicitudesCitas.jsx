import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Droplets,
  FileText,
  Hash,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  UserRound,
  X,
  Send,
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import {
  listarCitas,
  listarEspecialidades,
  obtenerCalendarioMedico,
  obtenerFichaCita,
} from '../../api/reprogramaciones';
import AsignarCitaModal from './AsignarCitaModal';
import NuevaSolicitudCitaModal from './NuevaSolicitudCitaModal';

const ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'preasignada', label: 'Preasignadas (Esperando RRHH)' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'completada', label: 'Completadas' },
  { value: 'cancelada', label: 'Canceladas' },
];

const ORIGENES = [
  { value: '', label: 'Todos los orígenes' },
  { value: 'cita_web', label: 'Cita web' },
  { value: 'remision', label: 'Remisión' },
  { value: 'emergencia', label: 'Emergencia' },
  { value: 'recepcion_interna', label: 'Recepción interna' },
];

const FILTROS_INICIALES = {
  q: '',
  estado: 'pendiente',
  origen: '',
  especialidad: '',
  fecha_desde: '',
  fecha_hasta: '',
};

function fechaLarga(iso) {
  if (!iso) return 'Sin fecha';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('es-VE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function horaHumana(hhmm) {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (h === 12 && m === '00') return '12:00 m';
  const ampm = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function rangoTurnoHumano(inicio, fin) {
  if (!inicio || !fin) return '';
  return `${horaHumana(inicio)} – ${horaHumana(fin)}`;
}

function telefonoWa(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('58')) return digitos;
  if (digitos.startsWith('0')) return `58${digitos.slice(1)}`;
  if (digitos.length === 10) return `58${digitos}`;
  return `58${digitos}`;
}

function estadoMeta(estado) {
  if (estado === 'pendiente') {
    return { label: 'Pendiente', clase: 'bg-amber-50 text-amber-700 ring-amber-200' };
  }
  if (estado === 'preasignada') {
    return { label: 'Preasignada (RRHH)', clase: 'bg-amber-100 text-amber-800 ring-amber-300' };
  }
  if (estado === 'confirmada') {
    return { label: 'Confirmada', clase: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  }
  if (estado === 'completada') {
    return { label: 'Completada', clase: 'bg-sky-50 text-sky-700 ring-sky-200' };
  }
  if (estado === 'cancelada') {
    return { label: 'Cancelada', clase: 'bg-rose-50 text-rose-700 ring-rose-200' };
  }
  return { label: estado || 'Sin estado', clase: 'bg-slate-100 text-slate-600 ring-slate-200' };
}

function afiliacionMeta(tipo) {
  if (tipo === 'trabajador') {
    return { label: 'Trabajador Alcaldía', clase: 'bg-blue-600 text-white ring-blue-700' };
  }
  if (tipo === 'beneficiario') {
    return { label: 'Beneficiario', clase: 'bg-violet-100 text-violet-800 ring-violet-300' };
  }
  return { label: 'Público general', clase: 'bg-slate-100 text-slate-600 ring-slate-200' };
}

function origenLabel(origen) {
  if (origen === 'cita_web') return 'Cita web';
  if (origen === 'remision') return 'Remisión';
  if (origen === 'emergencia') return 'Emergencia';
  if (origen === 'recepcion_interna') return 'Recepción interna';
  return origen || '—';
}

function ChipLista({ items, vacio = 'Sin registrar' }) {
  if (!items || items.length === 0) {
    return <p className="text-[12px] text-slate-400">{vacio}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span
          key={`${it}-${i}`}
          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold"
        >
          {typeof it === 'string' ? it : JSON.stringify(it)}
        </span>
      ))}
    </div>
  );
}

function FichaPaciente({ citaId, onClose }) {
  const [data, setData] = useState(null);
  const [calendario, setCalendario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!citaId) return undefined;
    let vivo = true;
    setCargando(true);
    setError('');
    setData(null);
    setCalendario(null);

    obtenerFichaCita(citaId)
      .then((ficha) => {
        if (!vivo) return;
        setData(ficha);
        const medicoId = ficha?.cita?.medico_id;
        if (medicoId) {
          obtenerCalendarioMedico({ medico_id: medicoId, dias: 30 })
            .then((cal) => { if (vivo) setCalendario(cal); })
            .catch(() => { if (vivo) setCalendario([]); });
        } else {
          setCalendario([]);
        }
      })
      .catch((err) => {
        if (vivo) setError(err?.response?.data?.detail || 'No se pudo cargar la ficha del paciente.');
      })
      .finally(() => { if (vivo) setCargando(false); });

    return () => { vivo = false; };
  }, [citaId]);

  useEffect(() => {
    const alPresionar = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [onClose]);

  if (!citaId) return null;

  const paciente = data?.paciente;
  const cita = data?.cita;
  const historial = data?.historial;
  const diasLibres = (calendario?.dias || []).filter((d) => d.disponible);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar ficha"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ficha del paciente"
        className="relative h-full w-full sm:max-w-md bg-white shadow-2xl flex flex-col animate-fade-up"
      >
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ficha del paciente</p>
            <h3 className="font-display font-bold text-lg text-brand-deep truncate">
              {paciente?.nombre_completo || (cargando ? 'Cargando...' : 'Sin historia clínica')}
            </h3>
            <p className="font-mono text-[11px] text-slate-500">V-{paciente?.cedula || '—'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
          {cargando && (
            <div className="py-10 text-center">
              <Loader2 className="w-5 h-5 text-brand-primary animate-spin mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Cargando ficha...</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 text-rose-700 px-3 py-2.5 text-[12px] font-semibold ring-1 ring-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {!cargando && data && (
            <>
              <section className="rounded-xl ring-1 ring-slate-200/70 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contacto</p>
                <div className="grid grid-cols-1 gap-1.5 text-[12px]">
                  <p className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {paciente?.telefono || 'Sin teléfono'}
                  </p>
                  <p className="flex items-start gap-2 text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" /> {paciente?.direccion || 'Sin dirección'}
                  </p>
                  <p className="flex items-center gap-2 text-slate-700">
                    <Droplets className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Tipo de sangre: {paciente?.tipo_sangre || '—'}
                  </p>
                  <p className="flex items-center gap-2 text-slate-700">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Historia N. {paciente?.numero_historia || '—'}
                  </p>
                </div>
              </section>

              <section className="rounded-xl ring-1 ring-slate-200/70 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Alergias
                </p>
                <ChipLista items={paciente?.alergias} vacio="Sin alergias registradas" />
              </section>

              <section className="rounded-xl ring-1 ring-slate-200/70 p-3 space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Antecedentes</p>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Médicos</p>
                  <ChipLista items={paciente?.antecedentes_medicos} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Quirúrgicos</p>
                  <ChipLista items={paciente?.antecedentes_operatorios} />
                </div>
              </section>

              <section className="rounded-xl ring-1 ring-slate-200/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Historial de citas</p>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {[
                    ['Total', historial?.total_citas],
                    ['Próximas', historial?.proximas],
                    ['Hechas', historial?.completadas],
                    ['Canceladas', historial?.canceladas],
                  ].map(([label, valor]) => (
                    <div key={label} className="rounded-lg bg-slate-50 px-1 py-1.5">
                      <p className="font-display font-bold text-base text-brand-deep tabular-nums leading-tight">{valor ?? 0}</p>
                      <p className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">{label}</p>
                    </div>
                  ))}
                </div>
                {historial?.ultima_cita && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Última atención: {fechaLarga(historial.ultima_cita.fecha_cita)} · {historial.ultima_cita.hora_inicio} ·{' '}
                    {historial.ultima_cita.especialidad || '—'}
                  </p>
                )}
              </section>

              <section className="rounded-xl ring-1 ring-slate-200/70 p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Solicitud en curso</p>
                <p className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-brand-primary" />
                  <span className="capitalize">{fechaLarga(cita?.fecha_cita)}</span> · {horaHumana(cita?.hora_inicio)}
                </p>
                <p className="text-[12px] text-slate-600 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                  {cita?.medico_nombre || 'Sin médico asignado'} · {cita?.especialidad || '—'}
                </p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Registrada {cita?.created_at ? new Date(cita.created_at).toLocaleString('es-VE') : '—'}
                </p>
                {cita?.motivo && (
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 mt-1">
                    <span className="font-semibold text-slate-600">Motivo:</span> {cita.motivo}
                  </p>
                )}
              </section>

              <section className="rounded-xl ring-1 ring-slate-200/70 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Disponibilidad del médico
                  </p>
                  {calendario?.especialidad && (
                    <span className="text-[10px] font-semibold text-slate-500">{calendario.especialidad}</span>
                  )}
                </div>
                {!cita?.medico_id ? (
                  <p className="text-[12px] text-slate-400">La cita no tiene médico asignado.</p>
                ) : calendario === null ? (
                  <p className="text-[12px] text-slate-400">Consultando horario...</p>
                ) : diasLibres.length === 0 ? (
                  <p className="text-[12px] text-amber-600 font-semibold">
                    Sin días disponibles en los próximos 30 días según su horario.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-500">
                      {diasLibres.length} día(s) con turnos libres en los próximos 30 días
                    </p>
                    <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {diasLibres.map((d) => (
                        <li key={d.fecha} className="rounded-lg bg-emerald-50/60 ring-1 ring-emerald-100 px-2.5 py-1.5">
                          <p className="text-[11px] font-bold text-emerald-800 capitalize">{fechaLarga(d.fecha)}</p>
                          <p className="text-[10px] text-emerald-700">
                            {(d.turnos_libres || []).map((t) => {
                              const nombre = t.turno_nombre || 'Turno';
                              const horario = rangoTurnoHumano(t.hora_inicio, t.hora_fin);
                              return `${nombre} (${horario})`;
                            }).join(' · ')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function SolicitudesCitas({ clinicaId }) {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [especialidades, setEspecialidades] = useState([]);
  const [especialistas, setEspecialistas] = useState([]);
  const [fichaCitaId, setFichaCitaId] = useState(null);
  const [asignarCitaId, setAsignarCitaId] = useState(null);
  const [nuevaCitaAbierta, setNuevaCitaAbierta] = useState(false);

  // Cargar especialidades y especialistas una sola vez
  useEffect(() => {
    let vivo = true;
    listarEspecialidades()
      .then((data) => { if (vivo) setEspecialidades(data.items || []); })
      .catch(() => { if (vivo) setEspecialidades([]); });

    axiosClient
      .get('/agenda/especialistas')
      .then((r) => { if (vivo) setEspecialistas(r.data || []); })
      .catch(() => { if (vivo) setEspecialistas([]); });

    return () => { vivo = false; };
  }, []);

  const cargar = useCallback(async (pagina, datos) => {
    setCargando(true);
    setError('');
    try {
      const params = { page: pagina, limit };
      if (clinicaId) params.centro_id = clinicaId;
      Object.entries(datos).forEach(([clave, valor]) => {
        if (valor) params[clave] = valor;
      });
      const data = await listarCitas(params);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setPage(data.page || pagina);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err?.response?.data?.detail || 'No se pudieron cargar las solicitudes de citas.');
    } finally {
      setCargando(false);
    }
  }, [limit, clinicaId]);

  useEffect(() => {
    const timer = setTimeout(() => cargar(1, filtros), 320);
    return () => clearTimeout(timer);
  }, [filtros, cargar]);

  const paginas = Math.max(1, Math.ceil(total / limit));
  const conTelefono = useMemo(
    () => items.filter((c) => Boolean(telefonoWa(c.paciente_telefono))).length,
    [items],
  );

  const setFiltro = (clave, valor) => {
    setPage(1);
    setFiltros((prev) => ({ ...prev, [clave]: valor }));
  };

  const cambiarPagina = (nueva) => {
    const destino = Math.min(Math.max(1, nueva), paginas);
    cargar(destino, filtros);
  };

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Tarjetas KPI compactas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white ring-1 ring-slate-200/70 shadow-sm px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Solicitudes</p>
          <p className="font-display font-bold text-2xl text-brand-deep tabular-nums leading-tight">{total}</p>
          <p className="text-[11px] text-slate-500">Con los filtros actuales</p>
        </div>
        <div className="rounded-xl bg-white ring-1 ring-slate-200/70 shadow-sm px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">En esta página</p>
          <p className="font-display font-bold text-2xl text-brand-deep tabular-nums leading-tight">{items.length}</p>
          <p className="text-[11px] text-slate-500">Citas visibles</p>
        </div>
        <div className="rounded-xl bg-white ring-1 ring-slate-200/70 shadow-sm px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contactables</p>
          <p className="font-display font-bold text-2xl text-emerald-600 tabular-nums leading-tight">{conTelefono}</p>
          <p className="text-[11px] text-slate-500">Con teléfono registrado</p>
        </div>
        <div className="rounded-xl bg-white ring-1 ring-slate-200/70 shadow-sm px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sin teléfono</p>
          <p className="font-display font-bold text-2xl text-amber-600 tabular-nums leading-tight">{items.length - conTelefono}</p>
          <p className="text-[11px] text-slate-500">Revisar historia clínica</p>
        </div>
      </div>

      {/* Contenedor Principal: Tabla y Filtros */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
        {/* Cabecera */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-deep/10 text-brand-deep flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-brand-deep">Solicitudes de Citas</h3>
              <p className="text-xs text-slate-500">Citas pendientes por asignar y confirmar en el centro</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setNuevaCitaAbierta(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-deep text-white text-xs font-bold shadow-sm shadow-brand-deep/20 hover:bg-brand-primary active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" /> Nueva Solicitud / Asignar Cita
            </button>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="cp-input !py-1.5 text-xs w-auto"
              aria-label="Citas por página"
            >
              <option value={10}>10 por pág.</option>
              <option value={25}>25 por pág.</option>
              <option value={50}>50 por pág.</option>
              <option value={100}>100 por pág.</option>
            </select>
            <button
              type="button"
              onClick={() => cargar(page, filtros)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-brand-deep rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Barra de Filtros Responsive */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={filtros.q}
              onChange={(e) => setFiltro('q', e.target.value)}
              placeholder="Buscar por nombre, cédula o teléfono"
              className="cp-input !py-2 pl-9 text-sm w-full"
              aria-label="Buscar solicitudes"
            />
          </div>
          <select
            value={filtros.estado}
            onChange={(e) => setFiltro('estado', e.target.value)}
            className="cp-input !py-2 text-sm"
            aria-label="Filtrar por estado"
          >
            {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <select
            value={filtros.especialidad}
            onChange={(e) => setFiltro('especialidad', e.target.value)}
            className="cp-input !py-2 text-sm"
            aria-label="Filtrar por especialidad"
          >
            <option value="">Todas las especialidades</option>
            {especialidades.map((esp) => <option key={esp} value={esp}>{esp}</option>)}
          </select>
          <select
            value={filtros.origen}
            onChange={(e) => setFiltro('origen', e.target.value)}
            className="cp-input !py-2 text-sm"
            aria-label="Filtrar por origen"
          >
            {ORIGENES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(e) => setFiltro('fecha_desde', e.target.value)}
              className="cp-input !py-1.5 text-xs"
              aria-label="Fecha desde"
              title="Fecha desde"
            />
            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(e) => setFiltro('fecha_hasta', e.target.value)}
              className="cp-input !py-1.5 text-xs"
              aria-label="Fecha hasta"
              title="Fecha hasta"
            />
          </div>
        </div>

        {error && (
          <div className="m-4 sm:m-6 flex items-start gap-2 rounded-xl bg-rose-50 text-rose-700 px-3.5 py-2.5 text-xs font-semibold ring-1 ring-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {cargando ? (
          <div className="py-16 text-center">
            <Loader2 className="w-7 h-7 text-brand-primary animate-spin mx-auto" />
            <p className="text-xs text-slate-400 mt-2.5 font-medium">Cargando solicitudes...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center px-6">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
              <CalendarDays className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-700 text-sm">No hay solicitudes con esos filtros</p>
            <p className="text-xs text-slate-400 mt-1">Prueba con otro estado, especialidad o rango de fechas.</p>
          </div>
        ) : (
          <>
            {/* Tabla Desktop (bien espaciada, legible a 100% zoom) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-slate-50/60 font-bold">
                    <th scope="col" className="pl-6 pr-3 py-3">Paciente</th>
                    <th scope="col" className="px-3 py-3">Cita Solicitada</th>
                    <th scope="col" className="px-3 py-3">Médico / Especialidad</th>
                    <th scope="col" className="px-3 py-3">Origen</th>
                    <th scope="col" className="px-3 py-3">Estado</th>
                    <th scope="col" className="pr-6 pl-3 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((c) => {
                    const meta = estadoMeta(c.estado);
                    const afiliacion = afiliacionMeta(c.tipo_afiliacion);
                    return (
                      <tr key={c.id} className="hover:bg-brand-deep/[0.02] transition-colors align-middle">
                        <td className="pl-6 pr-3 py-3.5">
                          <button
                            type="button"
                            onClick={() => setFichaCitaId(c.id)}
                            className="font-bold text-slate-900 text-sm hover:text-brand-deep hover:underline text-left block"
                            title="Ver ficha del paciente"
                          >
                            {c.paciente_nombre || 'Paciente sin historia'}
                          </button>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono">V-{c.paciente_cedula || '—'}</span>
                            {c.paciente_telefono && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Phone className="w-3 h-3" /> {c.paciente_telefono}
                              </span>
                            )}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${afiliacion.clase}`}
                            title="Tipo de afiliación (nómina institucional)"
                          >
                            {afiliacion.label}
                          </span>
                        </td>

                        <td className="px-3 py-3.5">
                          <div className="text-xs font-semibold text-slate-800 capitalize flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-brand-deep" />
                            {fechaLarga(c.fecha_cita)}
                          </div>
                          {c.hora_inicio && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {horaHumana(c.hora_inicio)}
                            </div>
                          )}
                          {c.codigo_confirmacion && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              #{c.codigo_confirmacion}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3.5">
                          <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                            <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                            {c.medico_nombre ? `Dr(a). ${c.medico_nombre}` : (
                              <span className="text-amber-600 font-normal italic">Por asignar</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {c.especialidad || 'Sin especialidad'}
                          </div>
                        </td>

                        <td className="px-3 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                            {origenLabel(c.origen)}
                          </span>
                        </td>

                        <td className="px-3 py-3.5">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${meta.clase}`}>
                            {meta.label}
                          </span>
                        </td>

                        <td className="pr-6 pl-3 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setAsignarCitaId({
                              id: c.id,
                              pacienteData: {
                                nombre_completo: c.paciente_nombre || '',
                                cedula: c.paciente_cedula || '',
                                telefono: c.paciente_telefono || '',
                                direccion: '',
                                especialidad: c.especialidad || '',
                                motivo: c.motivo || '',
                                origen: c.origen || '',
                                cita_id: c.id,
                                medico_id: c.medico_id || null,
                              },
                            })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-deep text-white text-xs font-bold hover:bg-brand-primary active:scale-[0.98] transition-all shadow-sm shadow-brand-deep/20"
                            title="Asignar cita médica"
                          >
                            <Send className="w-3.5 h-3.5" /> Asignar Cita
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Lista Mobile */}
            <ul className="md:hidden divide-y divide-slate-100">
              {items.map((c) => {
                const meta = estadoMeta(c.estado);
                const afiliacion = afiliacionMeta(c.tipo_afiliacion);
                return (
                  <li key={c.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setFichaCitaId(c.id)}
                          className="font-bold text-slate-900 text-sm hover:underline text-left block truncate"
                        >
                          {c.paciente_nombre || 'Paciente sin historia'}
                        </button>
                        <p className="font-mono text-xs text-slate-500">V-{c.paciente_cedula || '—'}</p>
                        <span
                          className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${afiliacion.clase}`}
                        >
                          {afiliacion.label}
                        </span>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${meta.clase}`}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Fecha Cita</p>
                        <p className="font-semibold text-slate-800 capitalize mt-0.5">{fechaLarga(c.fecha_cita)}</p>
                        {c.hora_inicio && <p className="text-slate-500 text-[11px]">{horaHumana(c.hora_inicio)}</p>}
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Especialidad</p>
                        <p className="font-semibold text-slate-800 truncate mt-0.5">{c.especialidad || '—'}</p>
                        <p className="text-slate-500 text-[11px] truncate">{c.medico_nombre ? `Dr(a). ${c.medico_nombre}` : 'Por asignar'}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAsignarCitaId({
                        id: c.id,
                        pacienteData: {
                          nombre_completo: c.paciente_nombre || '',
                          cedula: c.paciente_cedula || '',
                          telefono: c.paciente_telefono || '',
                          direccion: '',
                          especialidad: c.especialidad || '',
                          motivo: c.motivo || '',
                          origen: c.origen || '',
                          cita_id: c.id,
                          medico_id: c.medico_id || null,
                        },
                      })}
                      className="w-full py-2.5 px-3 rounded-xl bg-brand-deep text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" /> Asignar Cita
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Paginación */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/60">
              <p className="text-xs text-slate-500">
                {total} solicitud{total !== 1 ? 'es' : ''} · Página {page} de {paginas}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => cambiarPagina(page - 1)}
                  disabled={page <= 1 || cargando}
                  aria-label="Página anterior"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-semibold text-slate-700 tabular-nums">
                  {page} / {paginas}
                </span>
                <button
                  type="button"
                  onClick={() => cambiarPagina(page + 1)}
                  disabled={page >= paginas || cargando}
                  aria-label="Página siguiente"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <FichaPaciente citaId={fichaCitaId} onClose={() => setFichaCitaId(null)} />

      {nuevaCitaAbierta && (
        <NuevaSolicitudCitaModal
          clinicaId={clinicaId}
          onClose={() => setNuevaCitaAbierta(false)}
          onCreada={() => {
            // La cita recién creada queda confirmada: se muestra en el listado.
            const actualizados = { ...filtros, estado: 'confirmada' };
            setFiltros(actualizados);
            setPage(1);
            cargar(1, actualizados);
          }}
        />
      )}

      <AsignarCitaModal
        citaId={asignarCitaId ? (asignarCitaId.id || asignarCitaId) : null}
        pacienteData={asignarCitaId ? (asignarCitaId.pacienteData || items.find(i => i.id === (asignarCitaId?.id || asignarCitaId))) : null}
        especialistasCache={especialistas}
        onClose={() => setAsignarCitaId(null)}
        onAsignada={() => cargar(page, filtros)}
      />
    </div>
  );
}

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
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  UserRound,
  X,
  Send,
} from 'lucide-react';
import {
  listarCitas,
  listarEspecialidades,
  obtenerCalendarioMedico,
  obtenerFichaCita,
} from '../../api/reprogramaciones';
import AsignarCitaModal from './AsignarCitaModal';

const ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'completada', label: 'Completadas' },
  { value: 'cancelada', label: 'Canceladas' },
];

const ORIGENES = [
  { value: '', label: 'Todos los origenes' },
  { value: 'cita_web', label: 'Cita web' },
  { value: 'remision', label: 'Remision' },
  { value: 'emergencia', label: 'Emergencia' },
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

function telefonoWa(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('58')) return digitos;
  if (digitos.startsWith('0')) return `58${digitos.slice(1)}`;
  if (digitos.length === 10) return `58${digitos}`;
  return `58${digitos}`;
}

function textoWhatsApp(c) {
  const nombre = c.paciente_nombre || 'Paciente';
  const centro = c.centro_salud || 'BnaSalud';
  const esp = c.especialidad || 'Consulta Médica';

  if (c.estado === 'confirmada' || c.fecha_cita) {
    const med = c.medico_nombre ? `👨‍⚕️ *Médico:* Dr(a). ${c.medico_nombre}\n` : '';
    const cod = c.codigo_confirmacion ? `🔖 *Código de cita:* ${c.codigo_confirmacion}\n` : '';
    return encodeURIComponent(
      `¡Hola ${nombre}! Le saludamos desde *${centro}*.\n\n` +
      `Le confirmamos los datos de su cita médica:\n\n` +
      `🩺 *Especialidad:* ${esp}\n` +
      `${med}` +
      `📅 *Fecha:* ${fechaLarga(c.fecha_cita)}\n` +
      `⏰ *Hora:* ${c.hora_inicio || 'Por definir'}\n` +
      `${cod}\n` +
      `Por favor acuda 15 minutos antes con su cédula de identidad. ¡Le esperamos!`
    );
  }

  return encodeURIComponent(
    `¡Hola ${nombre}! Le escribimos desde *${centro}* respecto a su solicitud de cita para *${esp}*. ` +
    `Estamos revisando la agenda médica para asignarle fecha y hora a la brevedad posible.`
  );
}

function estadoMeta(estado) {
  if (estado === 'pendiente') {
    return { label: 'Pendiente', clase: 'bg-amber-50 text-amber-700 ring-amber-200' };
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

function origenLabel(origen) {
  if (origen === 'cita_web') return 'Cita web';
  if (origen === 'remision') return 'Remision';
  if (origen === 'emergencia') return 'Emergencia';
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
              {paciente?.nombre_completo || (cargando ? 'Cargando...' : 'Sin historia clinica')}
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
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {paciente?.telefono || 'Sin telefono'}
                  </p>
                  <p className="flex items-start gap-2 text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" /> {paciente?.direccion || 'Sin direccion'}
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
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Medicos</p>
                  <ChipLista items={paciente?.antecedentes_medicos} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Quirurgicos</p>
                  <ChipLista items={paciente?.antecedentes_operatorios} />
                </div>
              </section>

              <section className="rounded-xl ring-1 ring-slate-200/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Historial de citas</p>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {[
                    ['Total', historial?.total_citas],
                    ['Proximas', historial?.proximas],
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
                    Ultima atencion: {fechaLarga(historial.ultima_cita.fecha_cita)} · {historial.ultima_cita.hora_inicio} ·{' '}
                    {historial.ultima_cita.especialidad || '—'}
                  </p>
                )}
              </section>

              <section className="rounded-xl ring-1 ring-slate-200/70 p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Solicitud en curso</p>
                <p className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-brand-primary" />
                  <span className="capitalize">{fechaLarga(cita?.fecha_cita)}</span> · {cita?.hora_inicio}
                </p>
                <p className="text-[12px] text-slate-600 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                  {cita?.medico_nombre || 'Sin medico asignado'} · {cita?.especialidad || '—'}
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
                    Disponibilidad del medico
                  </p>
                  {calendario?.especialidad && (
                    <span className="text-[10px] font-semibold text-slate-500">{calendario.especialidad}</span>
                  )}
                </div>
                {!cita?.medico_id ? (
                  <p className="text-[12px] text-slate-400">La cita no tiene medico asignado.</p>
                ) : calendario === null ? (
                  <p className="text-[12px] text-slate-400">Consultando horario...</p>
                ) : diasLibres.length === 0 ? (
                  <p className="text-[12px] text-amber-600 font-semibold">
                    Sin dias disponibles en los proximos 30 dias segun su horario.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-500">
                      {diasLibres.length} dia(s) con turnos libres en los proximos 30 dias
                    </p>
                    <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {diasLibres.map((d) => (
                        <li key={d.fecha} className="rounded-lg bg-emerald-50/60 ring-1 ring-emerald-100 px-2.5 py-1.5">
                          <p className="text-[11px] font-bold text-emerald-800 capitalize">{fechaLarga(d.fecha)}</p>
                          <p className="text-[10px] text-emerald-700">
                            {(d.turnos_libres || []).map((t) => `${t.turno_nombre || 'Turno'} ${t.hora_inicio}-${t.hora_fin}`).join(' · ')}
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
  const [fichaCitaId, setFichaCitaId] = useState(null);
  const [asignarCitaId, setAsignarCitaId] = useState(null);

  useEffect(() => {
    let vivo = true;
    listarEspecialidades()
      .then((data) => { if (vivo) setEspecialidades(data.items || []); })
      .catch(() => { if (vivo) setEspecialidades([]); });
    return () => { vivo = false; };
  }, []);

  const cargar = useCallback(async (pagina, datos) => {
    setCargando(true);
    setError('');
    try {
      const params = { page: pagina, limit };
      // Recepción solo ve las solicitudes de su propio centro de salud.
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white ring-1 ring-slate-200/70 shadow-sm px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Solicitudes</p>
          <p className="font-display font-bold text-2xl text-brand-deep tabular-nums leading-tight">{total}</p>
          <p className="text-[11px] text-slate-500">Con los filtros actuales</p>
        </div>
        <div className="rounded-xl bg-white ring-1 ring-slate-200/70 shadow-sm px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">En esta pagina</p>
          <p className="font-display font-bold text-2xl text-brand-deep tabular-nums leading-tight">{items.length}</p>
          <p className="text-[11px] text-slate-500">Citas visibles</p>
        </div>
        <div className="rounded-xl bg-white ring-1 ring-slate-200/70 shadow-sm px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contactables</p>
          <p className="font-display font-bold text-2xl text-emerald-600 tabular-nums leading-tight">{conTelefono}</p>
          <p className="text-[11px] text-slate-500">Con telefono registrado</p>
        </div>
        <div className="rounded-xl bg-white ring-1 ring-slate-200/70 shadow-sm px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sin telefono</p>
          <p className="font-display font-bold text-2xl text-amber-600 tabular-nums leading-tight">{items.length - conTelefono}</p>
          <p className="text-[11px] text-slate-500">Revisar historia clinica</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-brand-deep/10 text-brand-deep flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-brand-deep">Solicitudes de citas</h3>
              <p className="text-[11px] text-slate-500">Citas pendientes y confirmadas registradas en el sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="cp-input !py-1.5 text-xs w-auto"
              aria-label="Citas por pagina"
            >
              <option value={10}>10 por pagina</option>
              <option value={25}>25 por pagina</option>
              <option value={50}>50 por pagina</option>
              <option value={100}>100 por pagina</option>
            </select>
            <button
              type="button"
              onClick={() => cargar(page, filtros)}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-[12px] text-slate-600 hover:text-brand-deep rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="px-3 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2.5">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={filtros.q}
              onChange={(e) => setFiltro('q', e.target.value)}
              placeholder="Buscar por nombre, cedula o telefono"
              className="cp-input !py-2 pl-9 text-sm"
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
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(e) => setFiltro('fecha_desde', e.target.value)}
              className="cp-input !py-2 text-xs"
              aria-label="Fecha desde"
            />
            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(e) => setFiltro('fecha_hasta', e.target.value)}
              className="cp-input !py-2 text-xs"
              aria-label="Fecha hasta"
            />
          </div>
        </div>

        {error && (
          <div className="m-3 sm:m-5 flex items-start gap-2 rounded-xl bg-rose-50 text-rose-700 px-3.5 py-2.5 text-[12px] font-semibold ring-1 ring-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {cargando ? (
          <div className="py-14 text-center">
            <Loader2 className="w-6 h-6 text-brand-primary animate-spin mx-auto" />
            <p className="text-xs text-slate-400 mt-2">Cargando solicitudes...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center px-6">
            <div className="h-12 w-12 mx-auto rounded-xl bg-brand-surface flex items-center justify-center mb-3">
              <CalendarDays className="w-6 h-6 text-brand-primary/50" />
            </div>
            <p className="font-display font-semibold text-slate-700">No hay solicitudes con esos filtros</p>
            <p className="text-[13px] text-slate-400 mt-0.5">Prueba con otro estado, origen o rango de fechas.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="visually-hidden">Solicitudes de citas registradas</caption>
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-slate-50/60">
                    <th scope="col" className="pl-5 pr-3 py-2.5 font-semibold">Paciente</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Cita</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Medico</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Origen</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
                    <th scope="col" className="pr-5 pl-3 py-2.5 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => {
                    const meta = estadoMeta(c.estado);
                    const wa = telefonoWa(c.paciente_telefono);
                    const texto = textoWhatsApp(c);
                    return (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-brand-deep/[0.03] transition-colors align-top">
                        <td className="pl-5 pr-3 py-3">
                          <div className="font-semibold text-slate-800 text-[13px] flex items-center gap-1.5">
                            <UserRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {c.paciente_nombre || 'Paciente sin historia'}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5">V-{c.paciente_cedula || '—'}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.paciente_telefono || 'Sin telefono'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-[12px] font-semibold text-slate-700 capitalize flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-brand-primary" />
                            {fechaLarga(c.fecha_cita)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{c.hora_inicio}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Hash className="w-3 h-3" /> {c.codigo_confirmacion || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                            <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                            {c.medico_nombre || 'Sin medico asignado'}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{c.especialidad || '—'}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{c.centro_salud || '—'}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide">
                            {origenLabel(c.origen)}
                          </span>
                          {c.motivo && (
                            <p className="text-[10px] text-slate-400 mt-1 max-w-[160px] truncate" title={c.motivo}>{c.motivo}</p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${meta.clase}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="pr-5 pl-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setAsignarCitaId({ id: c.id, pacienteData: { nombre_completo: c.paciente_nombre || '', cedula: c.paciente_cedula || '', telefono: c.paciente_telefono || '', direccion: '', especialidad: c.especialidad || '', motivo: c.motivo || '', origen: c.origen || '', cita_id: c.id } })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-deep text-white ring-1 ring-brand-deep/15 hover:bg-brand-deep/90 text-[11px] font-bold transition-colors mb-1.5"
                            title="Asignar cita"
                          >
                            <Send className="w-3.5 h-3.5" /> Asignar cita
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden divide-y divide-slate-100">
              {items.map((c) => {
                const meta = estadoMeta(c.estado);
                const wa = telefonoWa(c.paciente_telefono);
                const texto = textoWhatsApp(c);
                return (
                  <li key={c.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{c.paciente_nombre || 'Paciente sin historia'}</p>
                        <p className="font-mono text-[11px] text-slate-500">V-{c.paciente_cedula || '—'}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${meta.clase}`}>{meta.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Fecha</p>
                        <p className="font-semibold text-slate-700 capitalize">{fechaLarga(c.fecha_cita)}</p>
                        <p className="text-slate-500">{c.hora_inicio}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Medico</p>
                        <p className="font-semibold text-slate-700 truncate">{c.medico_nombre || 'Sin asignar'}</p>
                        <p className="text-slate-500 truncate">{c.especialidad || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAsignarCitaId({ id: c.id, pacienteData: { nombre_completo: c.paciente_nombre || '', cedula: c.paciente_cedula || '', telefono: c.paciente_telefono || '', direccion: '', especialidad: c.especialidad || '', motivo: c.motivo || '', origen: c.origen || '', cita_id: c.id } })}
                        className="min-h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-deep/5 text-brand-deep text-xs font-bold ring-1 ring-brand-deep/15"
                      >
                        <Send className="w-4 h-4" /> Asignar cita
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 border-t border-slate-100 bg-slate-50/60">
              <p className="text-[11px] text-slate-500">
                {total} solicitud{total !== 1 ? 'es' : ''} · pagina {page} de {paginas}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => cambiarPagina(page - 1)}
                  disabled={page <= 1 || cargando}
                  aria-label="Pagina anterior"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-semibold text-slate-600 tabular-nums">{page} / {paginas}</span>
                <button
                  type="button"
                  onClick={() => cambiarPagina(page + 1)}
                  disabled={page >= paginas || cargando}
                  aria-label="Pagina siguiente"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <FichaPaciente citaId={fichaCitaId} onClose={() => setFichaCitaId(null)} />
      <AsignarCitaModal citaId={asignarCitaId ? asignarCitaId.id || asignarCitaId : null} pacienteData={asignarCitaId ? (asignarCitaId.pacienteData || items.find(i => i.id === (asignarCitaId?.id || asignarCitaId))) : null} onClose={() => setAsignarCitaId(null)} onAsignada={() => cargar(page, filtros)} />
    </div>
  );
}

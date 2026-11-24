import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  CreditCard,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react';
import {
  buscarPacientes,
  crearPaciente,
  listarColaHistorias,
} from '../../api/historiasMedicas';
import PacienteDetallePanel from './PacienteDetallePanel';

const VACIO = {
  tipo_cedula: 'V',
  cedula: '',
  nombres: '',
  apellidos: '',
  fecha_nacimiento: '',
  telefono: '',
  direccion: '',
  email: '',
};

const inputBase =
  'w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all';

function Campo({ label, value, onChange, tipo = 'text', requerido = false, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
        {label}
        {requerido && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        type={tipo}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
      />
    </div>
  );
}

function AltaPaciente({ cedulaInicial, onCreado, onCancelar }) {
  const [form, setForm] = useState({ ...VACIO, cedula: cedulaInicial || '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (valor) => setForm((prev) => ({ ...prev, [key]: valor }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.cedula.trim() || !form.nombres.trim()) {
      setError('La cédula y los nombres son obligatorios.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const paciente = await crearPaciente({
        tipo_cedula: form.tipo_cedula,
        cedula: form.cedula.trim(),
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        fecha_nacimiento: form.fecha_nacimiento || null,
        telefono: form.telefono || null,
        direccion: form.direccion || null,
        email: form.email || null,
      });
      onCreado?.(paciente);
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo crear el paciente.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-display font-bold text-sm text-slate-800">
            Alta básica de paciente
          </h3>
          <p className="text-[11px] text-slate-400">
            No se encontró la cédula. Complete los datos mínimos para abrir la historia.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancelar}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          title="Cancelar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold bg-rose-50 text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
            Tipo
          </label>
          <select
            value={form.tipo_cedula}
            onChange={(e) => set('tipo_cedula')(e.target.value)}
            className={inputBase}
          >
            <option value="V">V</option>
            <option value="E">E</option>
            <option value="J">J</option>
            <option value="P">P</option>
          </select>
        </div>
        <Campo
          label="Cédula"
          value={form.cedula}
          onChange={set('cedula')}
          requerido
        />
        <Campo
          label="Fecha de nacimiento"
          tipo="date"
          value={form.fecha_nacimiento}
          onChange={set('fecha_nacimiento')}
        />
        <Campo label="Nombres" value={form.nombres} onChange={set('nombres')} requerido />
        <Campo label="Apellidos" value={form.apellidos} onChange={set('apellidos')} />
        <Campo label="Teléfono" value={form.telefono} onChange={set('telefono')} />
        <Campo
          label="Dirección"
          value={form.direccion}
          onChange={set('direccion')}
          className="sm:col-span-2"
        />
        <Campo label="Correo" tipo="email" value={form.email} onChange={set('email')} />
      </div>

      <div className="flex justify-end mt-4">
        <button
          type="submit"
          disabled={guardando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
        >
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Crear paciente
        </button>
      </div>
    </form>
  );
}

const hoyLocal = () => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

const ETIQUETA_ESTADO = {
  EN_ESPERA_CONSULTA: { texto: 'En espera', clase: 'bg-slate-100 text-slate-600 ring-slate-200' },
  EN_CONSULTA: { texto: 'En consulta', clase: 'bg-sky-50 text-sky-700 ring-sky-200' },
  FINALIZADO: { texto: 'Atendido', clase: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

function PanelCola({
  items,
  fecha,
  onFecha,
  incluirEspera,
  onIncluirEspera,
  cargando,
  error,
  onAbrir,
  onRecargar,
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-primary/10 text-brand-deep flex items-center justify-center">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-slate-800">
              Pacientes de consulta médica
            </h3>
            <p className="text-[11px] text-slate-400">
              {items.length} paciente(s) para completar historia integral
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <CalendarDays className="w-3.5 h-3.5" />
            <input
              type="date"
              value={fecha}
              onChange={(e) => onFecha(e.target.value)}
              className="px-2 py-1.5 bg-white border border-slate-200 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <input
              type="checkbox"
              checked={incluirEspera}
              onChange={(e) => onIncluirEspera(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/30"
            />
            Incluir en espera
          </label>
          <button
            type="button"
            onClick={onRecargar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10"
            title="Recargar cola"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 text-xs font-semibold bg-amber-50 text-amber-700 border-b border-amber-100">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando cola de consulta…
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <History className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            No hay pacientes en consulta para esa fecha.
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            La lista se llena cuando recepción los pasa al médico de emergencia.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const estado = ETIQUETA_ESTADO[item.estado] || {
              texto: item.estado,
              clase: 'bg-slate-100 text-slate-600 ring-slate-200',
            };
            return (
              <button
                key={item.cola_id}
                type="button"
                onClick={() => onAbrir(item)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <UserRound className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {item.nombre_completo}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    <span className="font-mono">{item.cedula || 'sin cédula'}</span>
                    {item.medico_nombre ? ` · ${item.medico_nombre}` : ''}
                    {item.motivo_consulta ? ` · ${item.motivo_consulta}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1 shrink-0 max-w-[45%]">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ring-1 ${estado.clase}`}
                  >
                    {estado.texto}
                  </span>
                  {item.tiene_atencion_integral ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                      Historia completa
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                      Historia pendiente
                    </span>
                  )}
                  {item.reposos_vigentes > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                      Reposo vigente
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function PacientesSection({ personalId = null }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscado, setBuscado] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [cola, setCola] = useState([]);
  const [colaFecha, setColaFecha] = useState(hoyLocal());
  const [incluirEspera, setIncluirEspera] = useState(false);
  const [colaCargando, setColaCargando] = useState(true);
  const [colaError, setColaError] = useState('');
  const [colaSeleccionada, setColaSeleccionada] = useState(null);

  const cargarCola = useCallback(async () => {
    setColaCargando(true);
    setColaError('');
    try {
      const data = await listarColaHistorias({
        fecha: colaFecha,
        incluir_espera: incluirEspera,
      });
      setCola(Array.isArray(data) ? data : []);
    } catch (err) {
      setCola([]);
      setColaError(
        err?.response?.data?.detail || 'No se pudo cargar la cola de consulta.',
      );
    } finally {
      setColaCargando(false);
    }
  }, [colaFecha, incluirEspera]);

  useEffect(() => {
    cargarCola();
  }, [cargarCola]);

  const abrirDesdeCola = async (item) => {
    setColaSeleccionada(item);
    if (item.paciente_id) {
      setSeleccionado({
        id: item.paciente_id,
        cedula: item.cedula,
        nombre_completo: item.nombre_completo,
        tipo_cedula: 'V',
      });
      return;
    }
    if (!item.cedula) {
      setQ('');
      setResultados([]);
      setBuscado(false);
      setMostrarAlta(true);
      return;
    }
    setQ(item.cedula);
    try {
      const data = await buscarPacientes(item.cedula);
      const exacto = data.find((p) => p.cedula === item.cedula) || data[0];
      setResultados(data);
      setBuscado(true);
      if (exacto) {
        setSeleccionado(exacto);
      } else {
        setMostrarAlta(true);
      }
    } catch {
      setResultados([]);
      setBuscado(false);
      setMostrarAlta(true);
    }
  };

  const buscar = useCallback(async (termino) => {
    const limpio = termino.trim();
    if (limpio.length < 2) {
      setResultados([]);
      setBuscado(false);
      setError('Escriba al menos 2 caracteres (cédula o nombre).');
      return;
    }
    setBuscando(true);
    setError('');
    try {
      const data = await buscarPacientes(limpio);
      setResultados(data);
      setBuscado(true);
      setMostrarAlta(data.length === 0);
    } catch (err) {
      setResultados([]);
      setBuscado(true);
      setError(err?.response?.data?.detail || 'No se pudo realizar la búsqueda.');
    } finally {
      setBuscando(false);
    }
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    buscar(q);
  };

  if (seleccionado) {
    return (
      <PacienteDetallePanel
        historiaId={seleccionado.id}
        personalId={personalId}
        colaId={colaSeleccionada?.cola_id || null}
        medicoSugeridoId={colaSeleccionada?.medico_id || null}
        onVolver={() => {
          setSeleccionado(null);
          setColaSeleccionada(null);
          cargarCola();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PanelCola
        items={cola}
        fecha={colaFecha}
        onFecha={setColaFecha}
        incluirEspera={incluirEspera}
        onIncluirEspera={setIncluirEspera}
        cargando={colaCargando}
        error={colaError}
        onAbrir={abrirDesdeCola}
        onRecargar={cargarCola}
      />

      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <label
          htmlFor="busqueda-paciente"
          className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide"
        >
          Buscar paciente por cédula o nombre
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="busqueda-paciente"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej. 20345678 o Juan Pérez"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>
          <button
            type="submit"
            disabled={buscando}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
          >
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
          <button
            type="button"
            onClick={() => {
              setColaSeleccionada(null);
              setMostrarAlta(true);
              setError('');
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wide hover:bg-slate-200"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          La búsqueda prioriza la coincidencia exacta de cédula.
        </p>
        {error && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
            {error}
          </div>
        )}
      </form>

      {buscado && resultados.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-slate-800">Resultados</h3>
            <span className="text-[11px] text-slate-400">{resultados.length} coincidencia(s)</span>
          </div>
          <div className="divide-y divide-slate-100">
            {resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setColaSeleccionada(null);
                  setSeleccionado(p);
                }}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-brand-primary/10 text-brand-deep flex items-center justify-center shrink-0">
                  <UserRound className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {p.nombre_completo}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {p.tipo_cedula || 'V'}-{p.cedula}
                    {p.telefono ? ` · ${p.telefono}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                  {p.tiene_ficha ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                      Ficha
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                      Sin ficha
                    </span>
                  )}
                  {p.es_trabajador && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                      Trabajador
                    </span>
                  )}
                  {p.es_beneficiario && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                      Beneficiario
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {buscado && resultados.length === 0 && !mostrarAlta && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No se encontró ningún paciente con ese dato.</p>
          <button
            type="button"
            onClick={() => setMostrarAlta(true)}
            className="mt-3 text-xs font-bold uppercase tracking-wide text-brand-primary hover:underline"
          >
            Crear ficha básica
          </button>
        </div>
      )}

      {mostrarAlta && (
        <AltaPaciente
          cedulaInicial={/^\d+$/.test(q.trim()) ? q.trim() : ''}
          onCancelar={() => setMostrarAlta(false)}
          onCreado={(paciente) => {
            setMostrarAlta(false);
            setSeleccionado(paciente);
          }}
        />
      )}

      {!buscado && !mostrarAlta && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            Busque al paciente por cédula para abrir su historia clínica integral.
          </p>
        </div>
      )}
    </div>
  );
}

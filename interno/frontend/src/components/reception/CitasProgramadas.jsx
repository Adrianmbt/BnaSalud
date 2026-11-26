import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  UserRound,
  X,
} from 'lucide-react';
import {
  listarCitas,
  listarEspecialidades,
  listarSemanasCertificadas,
} from '../../api/reprogramaciones';
import AsignarCitaModal from './AsignarCitaModal';
import EditarPacienteModal from './EditarPacienteModal';

// Estados que cuentan como cita vigente de la semana (las canceladas y las ya
// atendidas no entran en el control de pacientes registrados).
const ESTADOS_ACTIVOS = ['preasignada', 'pendiente', 'confirmada'];

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

function fechaCorta(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
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

// La BD mezcla especialidades con y sin tilde ("Cardiologia"/"Cardiología");
// el filtro las compara sin tildes, igual que el backend.
function sinTildes(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function telefonoWa(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('58')) return digitos;
  if (digitos.startsWith('0')) return `58${digitos.slice(1)}`;
  return `58${digitos}`;
}

function estadoBadge(estado) {
  if (estado === 'preasignada') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 ring-1 ring-amber-300">
        Preasignada
      </span>
    );
  }
  if (estado === 'confirmada') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300">
        Programada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 ring-1 ring-slate-200">
      {estado}
    </span>
  );
}

function contar(items) {
  return items.reduce(
    (acc, c) => {
      acc.total += 1;
      if (c.tipo_afiliacion === 'trabajador') acc.trabajadores += 1;
      else if (c.tipo_afiliacion === 'beneficiario') acc.beneficiarios += 1;
      else acc.publico_general += 1;
      return acc;
    },
    { total: 0, trabajadores: 0, beneficiarios: 0, publico_general: 0 }
  );
}

function TarjetaConteo({ label, valor, detalle, tono }) {
  const tonos = {
    total: 'bg-brand-deep/5 ring-brand-deep/20 text-brand-deep',
    nomina: 'bg-sky-50 ring-sky-200 text-sky-800',
    trabajadores: 'bg-indigo-50 ring-indigo-200 text-indigo-800',
    beneficiarios: 'bg-teal-50 ring-teal-200 text-teal-800',
    general: 'bg-amber-50 ring-amber-200 text-amber-800',
  };
  return (
    <div className={`rounded-lg px-2.5 py-2 ring-1 ${tonos[tono] || tonos.total}`}>
      <div className="text-[9px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="font-display font-bold text-base leading-tight tabular-nums">{valor}</div>
      {detalle && <div className="text-[9px] opacity-60 leading-tight">{detalle}</div>}
    </div>
  );
}

export default function CitasProgramadas({ clinicaId }) {
  const [semanas, setSemanas] = useState([]);
  const [semanaActiva, setSemanaActiva] = useState(null);
  const [pestana, setPestana] = useState('por_asignar'); // 'por_asignar' | 'programadas'
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [especialidades, setEspecialidades] = useState([]);
  const [especialidadFiltro, setEspecialidadFiltro] = useState('');
  const [medicoFiltro, setMedicoFiltro] = useState('');

  // Modal de asignación (reusa AsignarCitaModal).
  const [citaEditar, setCitaEditar] = useState(null);

  // Modal para corregir los datos del paciente (teléfono mal capturado, etc.).
  const [pacienteEditar, setPacienteEditar] = useState(null);

  // Modal de notificación.
  const [abiertoNotificar, setAbiertoNotificar] = useState(false);
  const [citasNotificar, setCitasNotificar] = useState([]);

  const cargarSemanas = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const params = {};
      if (clinicaId) params.clinica_id = clinicaId;
      const data = await listarSemanasCertificadas(params);
      const lista = data.semanas || [];
      setSemanas(lista);
      setSemanaActiva((actual) => {
        const misma = actual && lista.find((s) => s.semana_desde === actual.semana_desde);
        if (misma) return misma;
        return (
          lista.find((s) => s.es_actual) ||
          lista.find((s) => s.es_ultima) ||
          lista[lista.length - 1] ||
          null
        );
      });
    } catch (err) {
      setError('No se pudieron cargar las semanas.');
    } finally {
      setCargando(false);
    }
  }, [clinicaId]);

  useEffect(() => {
    cargarSemanas();
  }, [cargarSemanas]);

  useEffect(() => {
    let vivo = true;
    listarEspecialidades()
      .then((data) => {
        if (vivo) setEspecialidades(data.items || []);
      })
      .catch(() => {
        if (vivo) setEspecialidades([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const cargarCitas = useCallback(async () => {
    if (!semanaActiva) {
      setItems([]);
      setTotal(0);
      return;
    }
    setCargando(true);
    setError('');
    try {
      const params = {
        centro_id: clinicaId,
        fecha_desde: semanaActiva.semana_desde,
        fecha_hasta: semanaActiva.semana_hasta,
        page: 1,
        limit: 200,
      };
      const data = await listarCitas(params);
      const lista = (data.items || []).map((c) => ({
        ...c,
        telefonoWa: telefonoWa(c.paciente_telefono),
      }));
      setItems(lista);
      setTotal(data.total || 0);
    } catch (err) {
      setError('No se pudieron cargar las citas de la semana.');
    } finally {
      setCargando(false);
    }
  }, [semanaActiva, clinicaId]);

  useEffect(() => {
    cargarCitas();
  }, [cargarCitas]);

  const indiceSemana = semanas.findIndex(
    (s) => s.semana_desde === semanaActiva?.semana_desde
  );

  const medicos = useMemo(() => {
    const mapa = new Map();
    items.forEach((c) => {
      if (c.medico_id && c.medico_nombre) mapa.set(String(c.medico_id), c.medico_nombre);
    });
    return Array.from(mapa, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }, [items]);

  // Si el médico filtrado no tiene citas en la semana elegida, se limpia el
  // filtro para no dejar una tabla vacía sin explicación.
  useEffect(() => {
    if (!medicoFiltro) return;
    const sigue = items.some((c) => String(c.medico_id || '') === String(medicoFiltro));
    if (!sigue) setMedicoFiltro('');
  }, [items, medicoFiltro]);

  const filtradas = useMemo(() => {
    const esp = sinTildes(especialidadFiltro);
    return items.filter((c) => {
      if (esp && sinTildes(c.especialidad) !== esp) return false;
      if (medicoFiltro && String(c.medico_id || '') !== String(medicoFiltro)) return false;
      return true;
    });
  }, [items, especialidadFiltro, medicoFiltro]);

  const vigentes = filtradas.filter((c) => ESTADOS_ACTIVOS.includes(c.estado));
  const resumen = contar(vigentes);
  const porAsignar = filtradas.filter((c) => c.estado === 'preasignada');
  const programadas = filtradas.filter((c) => c.estado === 'confirmada');
  const visibles = pestana === 'por_asignar' ? porAsignar : programadas;
  const conTelefono = programadas.filter((c) => c.telefonoWa);

  const hayFiltro = Boolean(especialidadFiltro || medicoFiltro);
  const sinAsignarSemana = semanaActiva?.total_citas ?? 0;

  const pacienteData = useCallback(
    (cita) => ({
      id: cita.paciente_id,
      nombre_completo: cita.paciente_nombre,
      cedula: cita.paciente_cedula,
      telefono: cita.paciente_telefono,
      medico_id: cita.medico_id,
      especialidad: cita.especialidad,
      motivo: cita.motivo || '',
      origen: cita.origen || 'remision',
      centro_salud: cita.centro_salud,
    }),
    []
  );

  const abrirAsignar = (cita) => {
    setCitaEditar(cita);
  };

  const cerrarAsignar = () => {
    setCitaEditar(null);
  };

  const manejarAsignada = () => {
    cerrarAsignar();
    cargarCitas();
    cargarSemanas();
  };

  const abrirNotificar = () => {
    setCitasNotificar(conTelefono);
    setAbiertoNotificar(true);
  };

  const cerrarNotificar = () => {
    setAbiertoNotificar(false);
    setCitasNotificar([]);
  };

  const copiarTexto = (texto) => {
    navigator.clipboard.writeText(texto || '');
  };

  const semanaLabel = semanaActiva
    ? `del ${fechaLarga(semanaActiva.semana_desde)} al ${fechaLarga(
        semanaActiva.semana_hasta
      )}`
    : '—';

  const estadoSemana = !semanaActiva
    ? '—'
    : semanaActiva.certificada
      ? semanaActiva.es_ultima
        ? 'Última verificada'
        : 'Verificada'
      : 'Sin verificar';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg text-brand-deep">
            Citas programadas
          </h2>
          <p className="text-[10px] text-slate-500 font-medium">
            Semana {semanaLabel} · {estadoSemana}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={abrirNotificar}
            disabled={conTelefono.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-brand-deep text-white hover:bg-brand-deep/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Notificar a todos ({conTelefono.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-[12px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Semana y pestañas */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500">Semana</span>
          <button
            onClick={() => {
              const anterior = semanas[indiceSemana - 1];
              if (anterior) setSemanaActiva(anterior);
            }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-40"
            aria-label="Semana anterior"
            disabled={indiceSemana <= 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select
            value={semanaActiva?.semana_desde || ''}
            onChange={(e) => {
              const elegida = semanas.find((s) => s.semana_desde === e.target.value);
              if (elegida) setSemanaActiva(elegida);
            }}
            className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white focus:ring-1 focus:ring-brand-deep max-w-[260px]"
          >
            {semanas.length === 0 && <option value="">Sin semanas</option>}
            {semanas.map((s) => (
              <option key={s.semana_desde} value={s.semana_desde}>
                {fechaCorta(s.semana_desde)} – {fechaCorta(s.semana_hasta)} ·{' '}
                {s.total_citas} cita(s) ·{' '}
                {s.certificada ? (s.es_ultima ? 'última verificada' : 'verificada') : 'sin verificar'}
              </option>
            ))}
          </select>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${
              semanaActiva?.certificada
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {estadoSemana}
          </span>
          <button
            onClick={() => {
              const siguiente = semanas[indiceSemana + 1];
              if (siguiente) setSemanaActiva(siguiente);
            }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-40"
            aria-label="Semana siguiente"
            disabled={indiceSemana < 0 || indiceSemana >= semanas.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
          <button
            onClick={() => setPestana('por_asignar')}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              pestana === 'por_asignar'
                ? 'bg-brand-deep text-white'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Por asignar ({porAsignar.length})
          </button>
          <button
            onClick={() => setPestana('programadas')}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              pestana === 'programadas'
                ? 'bg-brand-deep text-white'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Programadas ({programadas.length})
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
          <select
            value={especialidadFiltro}
            onChange={(e) => setEspecialidadFiltro(e.target.value)}
            className="w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-1 focus:ring-brand-deep"
            aria-label="Filtrar por especialidad"
          >
            <option value="">Todas las especialidades</option>
            {especialidades.map((esp) => (
              <option key={esp} value={esp}>
                {esp}
              </option>
            ))}
          </select>
          <select
            value={medicoFiltro}
            onChange={(e) => setMedicoFiltro(e.target.value)}
            className="w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-1 focus:ring-brand-deep"
            aria-label="Filtrar por médico"
          >
            <option value="">Todos los médicos</option>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Control de pacientes registrados en la semana */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <TarjetaConteo
          label="Registradas"
          valor={resumen.total}
          detalle={hayFiltro ? 'con filtros' : `semana: ${sinAsignarSemana}`}
          tono="total"
        />
        <TarjetaConteo label="Nómina" valor={resumen.trabajadores + resumen.beneficiarios} detalle="trabajadores + beneficiarios" tono="nomina" />
        <TarjetaConteo label="Trabajadores" valor={resumen.trabajadores} tono="trabajadores" />
        <TarjetaConteo label="Beneficiarios" valor={resumen.beneficiarios} tono="beneficiarios" />
        <TarjetaConteo label="Público general" valor={resumen.publico_general} tono="general" />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto relative">
        {cargando && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
          </div>
        )}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500">
                Paciente
              </th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500">
                Cédula
              </th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500">
                Teléfono
              </th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500">
                Afiliación
              </th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500">
                Especialidad
              </th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500">
                Médico
              </th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500">
                Día / Hora
              </th>
              <th className="text-center px-3 py-2 text-[11px] font-semibold text-slate-500">
                Estado
              </th>
              <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-500">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400 text-[12px]">
                  No hay citas {pestana === 'por_asignar' ? 'preasignadas' : 'programadas'} en esta semana.
                </td>
              </tr>
            ) : (
              visibles.map((cita) => {
                const asignada =
                  cita.fecha_cita && cita.hora_inicio && cita.hora_inicio !== '08:00';
                return (
                  <tr
                    key={cita.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">
                        {cita.paciente_nombre || 'Sin nombre'}
                      </div>
                      {cita.origen === 'cita_web' && (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                          <UserRound className="w-3 h-3" /> Web
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {cita.paciente_cedula || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {cita.paciente_telefono || (
                        <span className="text-rose-500">Sin teléfono</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 capitalize">
                      {cita.tipo_afiliacion === 'trabajador'
                        ? 'Trabajador'
                        : cita.tipo_afiliacion === 'beneficiario'
                          ? 'Beneficiario'
                          : 'Público general'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {cita.especialidad || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {cita.medico_nombre || 'Sin asignar'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {asignada
                        ? `${fechaLarga(cita.fecha_cita)} • ${horaHumana(cita.hora_inicio)}`
                        : 'Pendiente de asignar'}
                    </td>
                    <td className="px-3 py-2.5 text-center">{estadoBadge(cita.estado)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setPacienteEditar(cita)}
                          disabled={!cita.paciente_id}
                          title={
                            cita.paciente_id
                              ? 'Editar nombre y datos de contacto del paciente'
                              : 'La cita no tiene historia clínica asociada'
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Pencil className="w-3 h-3" /> Datos
                        </button>
                        {cita.estado === 'preasignada' ? (
                          <button
                            onClick={() => abrirAsignar(cita)}
                            className="px-2.5 py-1 rounded text-[10px] font-semibold bg-brand-deep text-white hover:bg-brand-deep/90"
                          >
                            Asignar
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setCitasNotificar([cita]);
                              setAbiertoNotificar(true);
                            }}
                            className="px-2.5 py-1 rounded text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            Notificar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-slate-400 mt-1">
        {total} cita(s) en la semana{' '}
        {pestana === 'por_asignar'
          ? `· ${porAsignar.length} por asignar`
          : `· ${programadas.length} programadas`}
        {hayFiltro && ' (filtros aplicados)'}
      </div>

      {/* Modal asignar */}
      {citaEditar && (
        <AsignarCitaModal
          citaId={citaEditar.id}
          pacienteData={pacienteData(citaEditar)}
          onClose={cerrarAsignar}
          onAsignada={manejarAsignada}
          centroId={clinicaId}
          offsetConSidebar
        />
      )}

      {/* Modal editar datos del paciente */}
      {pacienteEditar && (
        <EditarPacienteModal
          paciente={{
            id: pacienteEditar.paciente_id,
            nombre_completo: pacienteEditar.paciente_nombre,
            cedula: pacienteEditar.paciente_cedula,
            telefono: pacienteEditar.paciente_telefono,
          }}
          onClose={() => setPacienteEditar(null)}
          onGuardado={() => {
            setPacienteEditar(null);
            cargarCitas();
          }}
          offsetConSidebar
        />
      )}

      {/* Modal notificar */}
      {abiertoNotificar && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:pl-64 bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Notificar citas por WhatsApp"
          onClose={cerrarNotificar}
        >
        <div className="relative w-full max-w-2xl max-h-[80vh] flex flex-col bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-brand-deep">Notificar por WhatsApp</h3>
            <button
              onClick={cerrarNotificar}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-3 overflow-y-auto max-h-[60vh]">
            {citasNotificar.length === 0 ? (
              <p className="text-slate-500 text-[12px] text-center py-4">
                No hay citas con teléfono para notificar.
              </p>
            ) : (
              <div className="space-y-2">
                {citasNotificar.map((cita) => {
                  const tel = cita.telefonoWa || telefonoWa(cita.paciente_telefono);
                  const link = cita.link_whatsapp
                    ? cita.link_whatsapp
                    : tel
                      ? `https://wa.me/${tel}?text=${encodeURIComponent(
                          cita.mensaje_whatsapp ||
                            `¡Hola ${cita.paciente_nombre}! Le saludamos de CITAB. Su cita de ${cita.especialidad} con el Dr(a). ${cita.medico_nombre} está programada para el ${fechaLarga(cita.fecha_cita)} a las ${horaHumana(cita.hora_inicio)}.`
                        )}`
                      : null;
                  return (
                    <div
                      key={cita.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 text-sm">
                          {cita.paciente_nombre}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {cita.especialidad} · Dr(a). {cita.medico_nombre} ·{' '}
                          {fechaLarga(cita.fecha_cita)} {horaHumana(cita.hora_inicio)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {tel || 'Sin teléfono'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {link && tel ? (
                          <>
                            <button
                              onClick={() => window.open(link, '_blank')}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-green-500 text-white text-[10px] font-semibold hover:bg-green-600"
                              title="Abrir WhatsApp"
                            >
                              <Phone className="w-3 h-3" /> Abrir
                            </button>
                            <button
                              onClick={() => copiarTexto(link)}
                              className="p-1.5 rounded text-slate-500 hover:bg-slate-200"
                              title="Copiar enlace"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-rose-500">
                            Sin teléfono
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
            <button
              onClick={cerrarNotificar}
              className="w-full px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

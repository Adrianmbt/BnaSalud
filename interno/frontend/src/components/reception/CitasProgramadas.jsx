import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  Phone,
  Search,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import {
  listarCitas,
  listarSemanasCertificadas,
} from '../../api/reprogramaciones';
import AsignarCitaModal from './AsignarCitaModal';

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
  let h = parseInt(hStr, 10, 10);
  const m = mStr || '00';
  if (h === 12 && m === '00') return '12:00 m';
  const ampm = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function telefonoWa(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('58')) return digitos;
  if (digitos.startsWith('0')) return `58${digitos.slice(1)}`;
  if (digitos.length === 10) return `58${digitos}`;
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

export default function CitasProgramadas({ clinicaId }) {
  const [semanas, setSemanas] = useState([]);
  const [semanaActiva, setSemanaActiva] = useState(null);
  const [pestana, setPestana] = useState('por_asignar'); // 'por_asignar' | 'programadas'
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [especialidadFiltro, setEspecialidadFiltro] = useState('');

  // Modal de asignación (reusa AsignarCitaModal).
  const [citaEditar, setCitaEditar] = useState(null);

  // Modal de notificación.
  const [abiertoNotificar, setAbiertoNotificar] = useState(false);
  const [citasNotificar, setCitasNotificar] = useState([]);

  const semanasRef = useRef([]);

  const cargarSemanas = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const params = {};
      if (clinicaId) params.clinica_id = clinicaId;
      const data = await listarSemanasCertificadas(params);
      const lista = data.semanas || [];
      setSemanas(lista);
      semanasRef.current = lista;
      if (!semanaActiva && lista.length > 0) {
        const ultima = lista.find((s) => s.es_ultima) || lista[0];
        setSemanaActiva(ultima);
      }
    } catch (err) {
      setError('No se pudieron cargar las semanas certificadas.');
    } finally {
      setCargando(false);
    }
  }, [clinicaId, semanaActiva]);

  useEffect(() => {
    cargarSemanas();
  }, [cargarSemanas]);

  const cargarCitas = useCallback(async () => {
    if (!semanaActiva) return;
    setCargando(true);
    setError('');
    try {
      const params = {
        centro_id: clinicaId,
        fecha_desde: semanaActiva.semana_desde,
        fecha_hasta: semanaActiva.semana_hasta,
        estado: pestana === 'por_asignar' ? 'preasignada' : 'confirmada',
        page: 1,
        limit: 200,
      };
      if (especialidadFiltro) params.especialidad = especialidadFiltro;
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
  }, [semanaActiva, pestana, clinicaId, especialidadFiltro]);

  useEffect(() => {
    cargarCitas();
  }, [cargarCitas]);

  const especialidades = useMemo(
    () => {
      const set = new Set(items.map((c) => c.especialidad).filter(Boolean));
      return Array.from(set).sort();
    },
    [items]
  );

  const porAsignar = items.filter((c) => c.estado === 'preasignada');
  const programadas = items.filter((c) => c.estado === 'confirmada');
  const conTelefono = programadas.filter((c) => c.telefonoWa);

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
    ? `${fechaLarga(semanaActiva.semana_desde)} al ${fechaLarga(
        semanaActiva.semana_hasta
      )}`
    : '—';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg text-brand-deep">
            Citas programadas
          </h2>
          <p className="text-[10px] text-slate-500 font-medium">
            Semana certificada: {semanaLabel}
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
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-[12px]">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Semana y pestañas */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:items-start">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Semana</span>
          <button
            onClick={() => {
              const idx = semanasRef.current.findIndex(
                (s) => s.semana_desde === semanaActiva?.semana_desde
              );
              const anterior = semanasRef.current[idx + 1];
              if (anterior) setSemanaActiva(anterior);
            }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
            disabled={
              !semanaActiva ||
              semanasRef.current.length <= 1 ||
              semanasRef.current.indexOf(semanaActiva) ===
                semanasRef.current.length - 1
            }
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold border">
            {semanaActiva?.es_ultima ? 'Última verificada' : 'Verificada'}
          </span>
          <button
            onClick={() => {
              const idx = semanasRef.current.findIndex(
                (s) => s.semana_desde === semanaActiva?.semana_desde
              );
              const siguiente = semanasRef.current[idx - 1];
              if (siguiente) setSemanaActiva(siguiente);
            }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
            disabled={
              !semanaActiva ||
              semanasRef.current.length <= 1 ||
              semanasRef.current.indexOf(semanaActiva) === 0
            }
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

        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por especialidad"
              value={especialidadFiltro}
              onChange={(e) => setEspecialidadFiltro(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-deep bg-white"
            />
          </div>
          {especialidades.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              <button
                onClick={() => setEspecialidadFiltro('')}
                className="px-2 py-0.5 rounded text-[10px] text-slate-600 border border-slate-200 bg-white hover:bg-slate-100"
              >
                Todas
              </button>
              {especialidades.map((esp) => (
                <button
                  key={esp}
                  onClick={() => setEspecialidadFiltro(esp)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                    especialidadFiltro === esp
                      ? 'bg-brand-deep text-white border-brand-deep'
                      : 'text-slate-600 border-slate-200 bg-white hover:bg-slate-100'
                  }`}
                >
                  {esp}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
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
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400 text-[12px]">
                  No hay citas {pestana === 'por_asignar' ? 'preasignadas' : 'programadas'} en esta semana.
                </td>
              </tr>
            ) : (
              items.map((cita) => {
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-slate-400 mt-1">
        {total} cita(s) de la semana{' '}
        {pestana === 'por_asignar'
          ? `${porAsignar.length} por asignar`
          : `${programadas.length} programadas`}
      </div>

      {/* Modal asignar */}
      {citaEditar && (
        <AsignarCitaModal
          citaId={citaEditar.id}
          pacienteData={pacienteData(citaEditar)}
          onClose={cerrarAsignar}
          onAsignada={manejarAsignada}
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

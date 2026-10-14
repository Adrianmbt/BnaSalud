import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Loader2,
  AlertCircle,
  X,
  Pencil,
  Trash2,
  ArrowRight,
  Phone,
  MapPin,
  RefreshCw,
  UserPlus,
  Users,
  CheckCircle2,
  Cross,
  Search,
  Shield,
  Heart,
  User,
  Fingerprint,
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const emptyForm = {
  nombre: '',
  apellido: '',
  cedula: '',
  telefono: '',
  direccion: '',
  prioridad: '3',
  ruta_atencion: 'EMERGENCIA',
};

function priorityMeta(p) {
  if (p <= 1) return { label: 'Critico', pill: 'bg-brand-danger/15 text-brand-danger ring-1 ring-brand-danger/25', dot: 'bg-brand-danger', side: 'from-brand-danger/90 to-brand-danger' };
  if (p === 2) return { label: 'Urgente', pill: 'bg-amber-50 text-amber-600 ring-1 ring-amber-400/30', dot: 'bg-amber-500', side: 'from-amber-500/90 to-amber-600' };
  return { label: 'Normal', pill: 'bg-emerald-50 text-brand-success ring-1 ring-brand-success/25', dot: 'bg-brand-success', side: 'from-brand-success to-brand-success' };
}

const POR_PAGINA = 8;

export default function ReceptionCola({ queue, fetchQueue, clinicaId, loading, setLoading, error, setError, success, setSuccess }) {
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [cedulaBusqueda, setCedulaBusqueda] = useState('');
  const [buscandoCedula, setBuscandoCedula] = useState(false);
  const [afiliacion, setAfiliacion] = useState(null);
  const [parentescoInfo, setParentescoInfo] = useState(null);
  const [pacienteEncontrado, setPacienteEncontrado] = useState(false);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  const [cedulaError, setCedulaError] = useState('');
  const timerRef = useRef(null);

  const esCedulaValida = (v) => {
    if (!/^\d{6,8}$/.test(v)) return false;
    if (/^0+$/.test(v)) return false;
    return true;
  };

  const handleCedulaInput = (raw) => {
    const soloNumeros = raw.replace(/\D/g, '').slice(0, 8);
    setCedulaBusqueda(soloNumeros);
    setBusquedaRealizada(false);
    setPacienteEncontrado(false);
    setAfiliacion(null);
    setParentescoInfo(null);
    setCedulaError('');
    if (soloNumeros.length >= 6 && esCedulaValida(soloNumeros)) {
      setCedulaError('');
    } else if (soloNumeros.length > 0 && soloNumeros.length < 6) {
      setCedulaError('');
    } else if (soloNumeros.length === 0) {
      setCedulaError('');
    }
  };

  const filtrarNombre = (raw) => {
    return raw.replace(/[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ\s]/g, '');
  };

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const v = cedulaBusqueda.trim();
    if (v.length >= 6 && esCedulaValida(v)) {
      setCedulaError('');
      timerRef.current = setTimeout(() => {
        buscarPorCedula(v);
      }, 500);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [cedulaBusqueda]);

  const clearFlags = () => {
    if (error) setError('');
    if (success) setSuccess('');
  };

  const flashError = (err, fallback) => {
    const msg = err?.response?.data?.detail || fallback;
    setError(typeof msg === 'string' ? msg : fallback);
  };

  const buscarPorCedula = useCallback(async (ced) => {
    if (!ced) return;
    setBuscandoCedula(true);
    setAfiliacion(null);
    setParentescoInfo(null);
    setPacienteEncontrado(false);
    setBusquedaRealizada(true);
    try {
      const { data: historia } = await axiosClient.get(`/historias-clinicas/${ced}`);
      setForm((s) => ({
        ...s,
        cedula: historia.cedula || ced,
        nombre: historia.nombre_completo || '',
        apellido: historia.apellido || '',
        telefono: historia.telefono || '',
        direccion: historia.direccion || '',
      }));
      setPacienteEncontrado(true);
      let tipo = 'general';
      let pInfo = null;
      try {
        const { data: emp } = await axiosClient.get('/busqueda/empleados', { params: { cedula: ced } });
        tipo = 'trabajador';
      } catch {
        try {
          const { data: ben } = await axiosClient.get('/busqueda/beneficiarios', { params: { cedula: ced } });
          tipo = 'beneficiario';
          pInfo = { parentesco: ben.parentesco, empleado_nombre: ben.empleado_nombre };
        } catch {
          tipo = 'general';
        }
      }
      setAfiliacion(tipo);
      setParentescoInfo(pInfo);
    } catch {
      // No hay historia clinica — intentar autorellenar desde empleados/beneficiarios
      let tipo = 'general';
      let pInfo = null;
      let nombreParts = { nombre: '', apellido: '' };
      try {
        const { data: emp } = await axiosClient.get('/busqueda/empleados', { params: { cedula: ced } });
        tipo = 'trabajador';
        const partes = (emp.nombre_completo || '').trim().split(/\s+/);
        if (partes.length >= 3) {
          nombreParts.nombre = partes.slice(0, Math.ceil(partes.length / 2)).join(' ');
          nombreParts.apellido = partes.slice(Math.ceil(partes.length / 2)).join(' ');
        } else if (partes.length === 2) {
          nombreParts.nombre = partes[0];
          nombreParts.apellido = partes[1];
        } else if (partes.length === 1) {
          nombreParts.nombre = partes[0];
        }
      } catch {
        try {
          const { data: ben } = await axiosClient.get('/busqueda/beneficiarios', { params: { cedula: ced } });
          tipo = 'beneficiario';
          pInfo = { parentesco: ben.parentesco, empleado_nombre: ben.empleado_nombre };
          const partes = (ben.nombre_completo || '').trim().split(/\s+/);
          if (partes.length >= 3) {
            nombreParts.nombre = partes.slice(0, Math.ceil(partes.length / 2)).join(' ');
            nombreParts.apellido = partes.slice(Math.ceil(partes.length / 2)).join(' ');
          } else if (partes.length === 2) {
            nombreParts.nombre = partes[0];
            nombreParts.apellido = partes[1];
          } else if (partes.length === 1) {
            nombreParts.nombre = partes[0];
          }
        } catch {
          tipo = 'general';
        }
      }
      setForm((s) => ({
        ...s,
        cedula: ced,
        nombre: nombreParts.nombre,
        apellido: nombreParts.apellido,
        telefono: '',
        direccion: '',
      }));
      setAfiliacion(tipo);
      setParentescoInfo(pInfo);
      setPacienteEncontrado(false);
    } finally {
      setBuscandoCedula(false);
    }
  }, []);

  const sorted = useMemo(
    () => [...queue.recepcion].sort((a, b) => {
      const ta = a.creado_en ? new Date(a.creado_en).getTime() : 0;
      const tb = b.creado_en ? new Date(b.creado_en).getTime() : 0;
      return ta - tb;
    }),
    [queue.recepcion]
  );

  const totalPaginas = Math.max(1, Math.ceil(sorted.length / POR_PAGINA));
  const paginaActual = Math.min(page, totalPaginas);
  const visibles = sorted.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const handleRegister = async (e) => {
    e.preventDefault();
    const cedulaFinal = form.cedula.trim() || cedulaBusqueda.trim();
    if (!form.nombre.trim() || !cedulaFinal) {
      setError('Nombre y cedula son obligatorios.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await axiosClient.post('/cola', {
        cedula: cedulaFinal,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        motivo: 'Consulta / urgencia en recepcion',
        especialidad: 'Medicina General',
        prioridad: parseInt(form.prioridad, 10),
        clinica_id: clinicaId,
        ruta_atencion: form.ruta_atencion || 'EMERGENCIA',
      });
      setForm(emptyForm);
      setCedulaBusqueda('');
      setAfiliacion(null);
      setParentescoInfo(null);
      setPacienteEncontrado(false);
      setBusquedaRealizada(false);
      setCedulaError('');
      setSuccess('Paciente registrado correctamente en la cola.');
      setEditing(false);
      await fetchQueue();
    } catch (err) {
      flashError(err, 'No se pudo registrar el paciente.');
    } finally {
      setLoading(false);
    }
  };

  const pasarPaciente = async (p) => {
    setLoading(true);
    clearFlags();
    try {
      await axiosClient.patch(`/cola/${p.id}/transicion`, {
        nuevo_estado: 'EN_ESPERA_CONSULTA',
        observacion: 'Paciente en espera de atencion medica',
      });
      setSuccess(`${p.paciente_nombre} paso a cola de espera.`);
      await fetchQueue();
    } catch (err) {
      flashError(err, 'No se pudo pasar el paciente a espera.');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (p) => {
    setEditing(p);
    setEditForm({
      nombre: p.paciente_nombre || '',
      apellido: p.apellido || '',
      cedula: p.paciente_cedula || '',
      telefono: p.telefono || '',
      direccion: p.direccion || '',
      prioridad: String(p.prioridad || 3),
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setLoading(true);
    setError('');
    try {
      await axiosClient.patch(`/cola/${editing.id}`, {
        nombre: editForm.nombre.trim(),
        apellido: editForm.apellido.trim() || null,
        cedula: editForm.cedula.trim(),
        telefono: editForm.telefono.trim() || null,
        direccion: editForm.direccion.trim() || null,
        prioridad: parseInt(editForm.prioridad, 10),
      });
      setSuccess('Datos del paciente actualizados.');
      setEditing(null);
      await fetchQueue();
    } catch (err) {
      flashError(err, 'No se pudo actualizar el paciente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setError('');
    try {
      await axiosClient.delete(`/cola/${deleteTarget.id}`);
      setSuccess(`${deleteTarget.paciente_nombre} fue retirado de la cola.`);
      setDeleteTarget(null);
      await fetchQueue();
    } catch (err) {
      flashError(err, 'No se pudo eliminar el paciente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="animate-fade-up bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden" style={{ animationDelay: '120ms' }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-4 sm:px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-brand-deep/10 text-brand-deep flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-brand-deep">Pacientes en recepcion</h3>
            <p className="text-[11px] text-slate-500">Ordenados por orden de llegada</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchQueue} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-slate-600 hover:text-brand-deep rounded-lg hover:bg-slate-100 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => { clearFlags(); setForm(emptyForm); setEditing(true); setCedulaBusqueda(''); setAfiliacion(null); setPacienteEncontrado(false); setBusquedaRealizada(false); setCedulaError(''); }}
            className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-success hover:bg-brand-success text-white text-[12px] font-semibold transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Nuevo paciente
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="py-12 text-center px-6">
          <div className="h-12 w-12 mx-auto rounded-xl bg-brand-surface flex items-center justify-center mb-3 animate-float">
            <Cross className="w-6 h-6 text-brand-primary/50" />
          </div>
          <p className="font-display font-semibold text-slate-700">No hay pacientes en recepcion</p>
          <p className="text-[13px] text-slate-400 mt-0.5">Usa &laquo;Nuevo paciente&raquo; para registrar al primero.</p>
        </div>
      ) : (
        <>
          {/* Tabla solo desde sm; en movil se muestran las tarjetas de abajo. */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="visually-hidden">Listado de pacientes en la cola de recepcion, ordenados por orden de llegada.</caption>
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-slate-50/60">
                  <th scope="col" className="pl-5 pr-3 py-2.5 font-semibold">Prioridad</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Paciente</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold hidden sm:table-cell">Cedula</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold hidden md:table-cell">Contacto</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold hidden lg:table-cell">Llegada</th>
                  <th scope="col" className="pr-5 pl-3 py-2.5 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => {
                  const meta = priorityMeta(p.prioridad);
                  return (
                    <tr key={p.id} className="group border-b border-slate-50 hover:bg-brand-deep/[0.03] transition-colors">
                      <td className="pl-5 pr-3 py-3 relative">
                        <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${meta.side}`} />
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.pill}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800 text-[13px]">{p.paciente_nombre} {p.apellido}</div>
                        {p.direccion && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 max-w-[200px] truncate">
                            <MapPin className="w-3 h-3 shrink-0" /> {p.direccion}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-600 text-[13px] hidden sm:table-cell">{p.paciente_cedula}</td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        {p.telefono ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-600 text-[13px]">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {p.telefono}
                          </span>
                        ) : (
                          <span className="text-slate-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell text-slate-500 text-[13px]">
                        {p.creado_en
                          ? new Date(p.creado_en).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
                          : '--'}
                      </td>
                      <td className="pr-5 pl-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => pasarPaciente(p)} disabled={loading} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-deep hover:bg-brand-primary text-white text-[11px] font-semibold transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed" title="Pasar a cola de espera">
                            <ArrowRight className="w-3.5 h-3.5" /> Espera
                          </button>
                          <button onClick={() => openEdit(p)} aria-label={`Editar a ${p.paciente_nombre}`} className="inline-flex items-center gap-1 p-1.5 rounded-lg text-brand-deep hover:bg-brand-deep/10 active:bg-brand-deep/20 transition-colors" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} aria-label={`Eliminar a ${p.paciente_nombre}`} className="inline-flex items-center gap-1 p-1.5 rounded-lg text-brand-danger hover:bg-brand-danger/10 active:bg-brand-danger/20 transition-colors" title="Eliminar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tarjetas en movil: la tabla no cabe en 360dp y esconde las acciones. */}
          <ul className="sm:hidden divide-y divide-slate-100">
            {visibles.map((p) => {
              const meta = priorityMeta(p.prioridad);
              return (
                <li key={p.id} className="relative pl-3 pr-3 py-3">
                  <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${meta.side}`} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 text-[14px] leading-tight">{p.paciente_nombre} {p.apellido}</div>
                      <div className="font-mono text-slate-500 text-[11px] mt-0.5">{p.paciente_cedula}</div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button onClick={() => pasarPaciente(p)} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-1 min-h-11 px-3 rounded-xl bg-brand-deep active:bg-brand-primary text-white text-xs font-semibold transition-colors disabled:opacity-50" >
                      <ArrowRight className="w-3.5 h-3.5" /> A espera
                    </button>
                    <button onClick={() => openEdit(p)} aria-label={`Editar a ${p.paciente_nombre}`} className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-xl text-brand-deep bg-brand-deep/10 active:bg-brand-deep/25 transition-colors" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(p)} aria-label={`Eliminar a ${p.paciente_nombre}`} className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-xl text-brand-danger bg-brand-danger/10 active:bg-brand-danger/25 transition-colors" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 border-t border-slate-100 bg-slate-50/60">
              <p className="text-[11px] text-slate-500">{sorted.length} paciente{sorted.length !== 1 ? 's' : ''}</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={paginaActual === 1} aria-label="Pagina anterior" className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">&larr;</button>
                <span className="px-2 text-xs font-semibold text-slate-600 tabular-nums">{paginaActual} / {totalPaginas}</span>
                <button onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas} aria-label="Pagina siguiente" className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">&rarr;</button>
              </div>
            </div>
          )}
        </>
      )}

      </div>

      {/* NEW PATIENT MODAL */}
      {editing === true && (
        <div className="fixed inset-0 z-[9999] modal-backdrop flex items-center justify-center p-2 sm:p-6" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[90vh] overflow-hidden animate-scale-in">
            <div className="brand-orbit text-white px-4 sm:px-6 py-3 sm:py-4 relative overflow-hidden shrink-0">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
              <div className="absolute right-10 bottom-1 h-8 w-8 rounded-full bg-white/10" />
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-white/15 ring-1 ring-white/25 flex items-center justify-center"><UserPlus className="w-4 h-4" /></div>
                  <div>
                    <h3 className="font-display font-bold text-lg">Nuevo paciente</h3>
                    <p className="text-[11px] text-white/70">Registro en recepcion</p>
                  </div>
                </div>
                <button onClick={() => setEditing(false)} className="h-11 w-11 shrink-0 inline-flex items-center justify-center text-white/70 hover:text-white rounded-lg active:bg-white/20 transition-colors" aria-label="Cerrar"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Unico contenedor scrolleable: el header y el footer quedan fijos. */}
            <div className="p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1 overscroll-contain keyboard-safe">
              {/* Campo unico: Cedula */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Cedula del paciente</label>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cedulaBusqueda}
                    onChange={(e) => handleCedulaInput(e.target.value)}
                    placeholder="Ingrese 6 a 8 digitos"
                    maxLength={8}
                    className={`cp-input !py-2.5 pl-10 pr-10 text-base tracking-widest font-mono text-center ${cedulaError ? 'ring-2 ring-red-400' : ''}`}
                    autoFocus
                  />
                  {buscandoCedula && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-primary animate-spin" />
                  )}
                </div>
                {cedulaError && (
                  <p className="mt-1.5 text-[11px] text-red-500 font-medium">{cedulaError}</p>
                )}
                {cedulaBusqueda.length > 0 && cedulaBusqueda.length < 6 && (
                  <p className="mt-1.5 text-[11px] text-slate-400">Minimo 6 digitos para buscar</p>
                )}
              </div>

              {/* Badge de afiliacion + resultados */}
              {busquedaRealizada && (
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  afiliacion === 'trabajador' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' :
                  afiliacion === 'beneficiario' ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200' :
                  'bg-slate-50 text-slate-600 ring-1 ring-slate-200'
                }`}>
                  {afiliacion === 'trabajador' ? <Shield className="w-4 h-4 shrink-0" /> :
                   afiliacion === 'beneficiario' ? <Heart className="w-4 h-4 shrink-0" /> :
                   <User className="w-4 h-4 shrink-0" />}
                  <span className="flex-1">
                    {afiliacion === 'trabajador' ? 'Trabajador' :
                     afiliacion === 'beneficiario' && parentescoInfo
                       ? `${parentescoInfo.parentesco || 'Beneficiario'} de ${parentescoInfo.empleado_nombre || '—'}`
                     : afiliacion === 'beneficiario' ? 'Beneficiario' :
                     'Publico General'}
                  </span>
                  {pacienteEncontrado && (
                    <span className="text-[10px] font-normal opacity-70 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Registro encontrado
                    </span>
                  )}
                </div>
              )}

              {/* Formulario de datos - solo aparece despues de buscar */}
              {busquedaRealizada && (
                <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={form.nombre}
                        onChange={(e) => setForm((s) => ({ ...s, nombre: filtrarNombre(e.target.value) }))}
                        placeholder="Nombre"
                        className="cp-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Apellido</label>
                      <input type="text" value={form.apellido} onChange={(e) => setForm((s) => ({ ...s, apellido: filtrarNombre(e.target.value) }))} placeholder="Apellido" className="cp-input" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Telefono</label>
                      <input type="tel" inputMode="tel" value={form.telefono} onChange={(e) => setForm((s) => ({ ...s, telefono: e.target.value.replace(/\D/g, '') }))} placeholder="Telefono" className="cp-input" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Direccion</label>
                      <input type="text" value={form.direccion} onChange={(e) => setForm((s) => ({ ...s, direccion: e.target.value }))} placeholder="Direccion" className="cp-input" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <fieldset>
                      <legend className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Prioridad</legend>
                      <div className="grid grid-cols-3 gap-2">
                        {[{ v: '1', l: 'Critico', c: 'border-brand-danger/40 text-brand-danger bg-brand-danger/5 hover:bg-brand-danger/10' }, { v: '2', l: 'Urgente', c: 'border-amber-400/60 text-amber-600 bg-amber-50 hover:bg-amber-100' }, { v: '3', l: 'Normal', c: 'border-brand-success/40 text-brand-success bg-brand-success/5 hover:bg-brand-success/10' }].map((opt) => (
                          <button key={opt.v} type="button" onClick={() => setForm((s) => ({ ...s, prioridad: opt.v }))} className={`py-2 rounded-lg border text-[12px] font-semibold transition-all ${form.prioridad === opt.v ? opt.c + ' scale-[1.02] shadow-md ring-1 ring-black/5' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>{opt.l}</button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Ruta de atencion</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {[{ v: 'EMERGENCIA', l: 'Emergencia', c: 'border-brand-danger/40 text-brand-danger bg-brand-danger/5 hover:bg-brand-danger/10' }, { v: 'CITA', l: 'Cita / Especialista', c: 'border-brand-primary/40 text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10' }].map((opt) => (
                          <button key={opt.v} type="button" onClick={() => setForm((s) => ({ ...s, ruta_atencion: opt.v }))} className={`py-2 rounded-lg border text-[12px] font-semibold transition-all ${form.ruta_atencion === opt.v ? opt.c + ' scale-[1.02] shadow-md ring-1 ring-black/5' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>{opt.l}</button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <div className="flex gap-2.5 pt-3 border-t border-slate-100 sticky bottom-0 bg-white -mx-3 sm:mx-0 sm:static sm:bg-transparent">
                    <button type="button" onClick={() => setEditing(false)} className="px-4 py-3 min-h-11 rounded-xl border border-slate-200 text-slate-600 font-semibold active:bg-slate-50 hover:bg-slate-50 transition-colors">Cancelar</button>
                    <button type="submit" disabled={loading || !form.nombre.trim()} className="flex-1 py-3 min-h-11 px-4 rounded-xl bg-brand-success active:bg-brand-success text-white font-semibold shadow-glow-green inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {loading ? 'Registrando...' : 'Registrar paciente'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editing && editing !== true && (
        <div className="fixed inset-0 z-[9999] modal-backdrop flex items-center justify-center p-2 sm:p-6" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[90vh] overflow-hidden animate-scale-in">
            <div className="border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center"><Pencil className="w-4 h-4" /></div>
                <div>
                  <h3 className="font-display font-bold text-lg text-brand-deep">Editar paciente</h3>
                  <p className="text-[11px] text-slate-500">Actualiza los datos del registro</p>
                </div>
              </div>
              <button onClick={() => setEditing(null)} className="h-11 w-11 shrink-0 inline-flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg active:bg-slate-200 transition-colors" aria-label="Cerrar"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1 overscroll-contain keyboard-safe">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Nombre</label>
                  <input type="text" value={editForm.nombre} onChange={(e) => setEditForm((s) => ({ ...s, nombre: e.target.value }))} className="cp-input" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Apellido</label>
                  <input type="text" value={editForm.apellido} onChange={(e) => setEditForm((s) => ({ ...s, apellido: e.target.value }))} className="cp-input" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Cedula</label>
                  <input type="text" value={editForm.cedula} onChange={(e) => setEditForm((s) => ({ ...s, cedula: e.target.value }))} className="cp-input" required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Telefono</label>
                  <input type="text" value={editForm.telefono} onChange={(e) => setEditForm((s) => ({ ...s, telefono: e.target.value }))} className="cp-input" />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Direccion</label>
                  <input type="text" value={editForm.direccion} onChange={(e) => setEditForm((s) => ({ ...s, direccion: e.target.value }))} className="cp-input" />
                </div>
              </div>
              <fieldset>
                <legend className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Prioridad</legend>
                <div className="grid grid-cols-3 gap-2">
                  {[{ v: '1', l: 'Critico', c: 'border-brand-danger/40 text-brand-danger bg-brand-danger/5' }, { v: '2', l: 'Urgente', c: 'border-amber-400/60 text-amber-600 bg-amber-50' }, { v: '3', l: 'Normal', c: 'border-brand-success/40 text-brand-success bg-brand-success/5' }].map((opt) => (
                    <button key={opt.v} type="button" onClick={() => setEditForm((s) => ({ ...s, prioridad: opt.v }))} className={`py-2.5 rounded-lg border text-[13px] font-semibold transition-all ${editForm.prioridad === opt.v ? opt.c + ' scale-[1.02] shadow-md' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>{opt.l}</button>
                  ))}
                </div>
              </fieldset>
              <div className="flex gap-2.5 pt-3 border-t border-slate-100 sticky bottom-0 bg-white -mx-3 sm:mx-0 sm:static sm:bg-transparent">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-3 min-h-11 rounded-xl border border-slate-200 text-slate-600 font-semibold active:bg-slate-50 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 min-h-11 px-4 rounded-xl bg-brand-primary hover:bg-brand-deep text-white font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] modal-backdrop flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-4 sm:p-6 text-center animate-scale-in">
            <div className="h-12 w-12 mx-auto rounded-xl bg-brand-danger/10 flex items-center justify-center mb-3"><Trash2 className="w-6 h-6 text-brand-danger" /></div>
            <h3 className="font-display font-bold text-lg text-brand-deep mb-1.5">Retirar paciente</h3>
            <p className="text-[13px] text-slate-500 mb-5">
              Se quitara a <span className="font-semibold text-slate-700">{deleteTarget.paciente_nombre}</span> ({deleteTarget.paciente_cedula}) de la cola de recepcion.
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 min-h-11 rounded-xl border border-slate-200 text-slate-600 font-semibold active:bg-slate-50 hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={confirmDelete} disabled={loading} className="flex-1 py-3 min-h-11 rounded-xl bg-brand-danger hover:bg-brand-danger text-white font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Retirar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

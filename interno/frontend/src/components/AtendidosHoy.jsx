import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import { compartirPdf } from '../utils/compartirPdf';
import {
  Activity,
  ClipboardList,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  Microscope,
  Pencil,
  Pill,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { useTheme } from './ThemeProvider';
import {
  exportarPdf,
  obtenerLogotipos,
  dibujarCabeceraInstitucional,
  dibujarPiePdf,
  examenesPorCategoria,
  fechaCitaAmigable,
} from './specialist/pdfUtils';

const SIGNOS_LABEL = [
  ['presion_arterial', 'P.A.'],
  ['frecuencia_cardiaca', 'F.C.'],
  ['frecuencia_respiratoria', 'F.R.'],
  ['temperatura', 'T°'],
  ['saturacion_oxigeno', 'SpO₂'],
  ['peso_kg', 'Peso'],
  ['talla_cm', 'Talla'],
];

const horaDe = (fecha) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
};

const fechaLocalHoy = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
};

const fechaLE = (f) => {
  if (!f) return 'hoy';
  const parts = f.split('-');
  if (parts.length !== 3) return f;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const DetalleSeccion = ({ titulo, children }) => (
  <div>
    <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{titulo}</h4>
    {children}
  </div>
);

export default function AtendidosHoy({ userName = 'Médico de Emergencias', onRetomar, onRefresh }) {
  const { theme, centerName } = useTheme();
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ver, setVer] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [detalleError, setDetalleError] = useState('');
  const [editar, setEditar] = useState(null);
  const [eliminarId, setEliminarId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [pdfGenerando, setPdfGenerando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [fecha, setFecha] = useState(fechaLocalHoy);
  const POR_PAGINA = 10;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const q = fecha ? `?fecha=${fecha}` : '';
      const data = await axiosClient.get(`/consultas/hoy${q}`).then((r) => r.data);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo cargar el listado de pacientes atendidos.');
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setVer(null); setEditar(null); setEliminarId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtrados = items.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (c.paciente_nombre || '').toLowerCase().includes(q);
  });

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filtradosPaginados = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const abrirDetalle = async (c) => {
    setVer(c);
    setDetalle(null);
    setDetalleError('');
    setDetalleCargando(true);
    try {
      const d = await axiosClient.get(`/consultas/detalle/${c.consulta_id}`).then((r) => r.data);
      setDetalle(d);
    } catch (e) {
      setDetalleError(e?.response?.data?.detail || 'No se pudo cargar el detalle de la consulta.');
    } finally {
      setDetalleCargando(false);
    }
  };

  const exportarPdfDetalle = async (d, modo) => {
    setPdfGenerando(true);
    try {
      await exportarPdf(d, modo, { tema: theme, centroNombre: centerName, servicio: 'Urgencias' });
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.detail || 'No se pudo generar el PDF.');
    } finally {
      setPdfGenerando(false);
    }
  };


  const exportarCompleto = async (c) => {
    setPdfGenerando(true);
    try {
      const d = await axiosClient.get(`/consultas/detalle/${c.consulta_id}`).then((r) => r.data);
      exportarPdfDetalle(d, 'completo');
    } catch (e) {
      setPdfGenerando(false);
      setError(e?.response?.data?.detail || 'No se pudo generar el PDF de la consulta.');
    }
  };

  const exportarPdfGeneral = async () => {
    if (!filtrados.length) return;
    setPdfGenerando(true);
    try {
      const opcCabe = { centroNombre: centerName, servicio: 'Urgencias', colores: { primary: theme?.colors?.primary, accent: theme?.colors?.accent } };
      const logos = await obtenerLogotipos(theme?.logo);
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const ancho = doc.internal.pageSize.getWidth();
      const altura = doc.internal.pageSize.getHeight();
      const titulo = `LISTADO DE PACIENTES ATENDIDOS ${fecha} (${items.length})`;
      const { margen } = dibujarCabeceraInstitucional(doc, logos, titulo, ancho, opcCabe);
      let y = 100;
      const zonaMax = altura - 44;
      const saltoDePagina = () => {
        dibujarCabeceraInstitucional(doc, logos, titulo, ancho, opcCabe);
        y = 100;
      };
      const colY = y;
      doc.setFillColor(226, 232, 240);
      doc.rect(margen, colY, ancho - 2 * margen, 20, 'F');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('#', margen + 8, colY + 13);
      doc.text('Cédula', margen + 30, colY + 13);
      doc.text('Paciente', margen + 120, colY + 13);
      doc.text('Motivo', margen + 260, colY + 13);
      doc.text('CIE-10', margen + 430, colY + 13);
      doc.text('Hora', margen + 480, colY + 13);
      y = colY + 34;
      doc.setFont('helvetica', 'normal');
      filtrados.forEach((c, i) => {
        if (y > zonaMax - 24) saltoDePagina();
        doc.setTextColor(51, 65, 85);
        doc.text(String(i + 1), margen + 8, y);
        doc.text(c.paciente_cedula || '—', margen + 30, y);
        doc.text(doc.splitTextToSize(c.paciente_nombre || '—', 130), margen + 120, y);
        doc.text(doc.splitTextToSize(c.motivo_consulta || '—', 150), margen + 260, y);
        doc.text(c.cie10_codigo || '—', margen + 430, y);
        doc.text(horaDe(c.creado_en), margen + 480, y);
        y += 24;
      });
      dibujarPiePdf(doc);
      await compartirPdf(doc, `listado-pacientes-atendidos-${fecha || 'hoy'}.pdf`);
    } catch (e) {
      setError('No se pudo generar el PDF.');
    } finally {
      setPdfGenerando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!eliminarId) return;
    setGuardando(true);
    setError('');
    try {
      await axiosClient.delete(`/consultas/${eliminarId}`);
      setEliminarId(null);
      setItems((prev) => prev.filter((c) => c.consulta_id !== eliminarId));
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo eliminar la consulta.');
    } finally {
      setGuardando(false);
    }
  };

  const guardarEdicion = async () => {
    if (!editar) return;
    setGuardando(true);
    setError('');
    try {
      const payload = {
        motivo_consulta: editar.motivo_consulta,
        examen_fisico: editar.examen_fisico || null,
        cie10_codigo: editar.cie10_codigo,
        cie10_descripcion: editar.cie10_descripcion,
        tratamiento: editar.tratamiento,
        recomendaciones: editar.recomendaciones || null,
      };
      await axiosClient.patch(`/consultas/${editar.consulta_id}`, payload);
      setItems((prev) => prev.map((c) => (c.consulta_id === editar.consulta_id ? { ...c, ...payload } : c)));
      setEditar(null);
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo guardar la consulta.');
    } finally {
      setGuardando(false);
    }
  };

  const trAmigable = (c) => (
    <span className="text-slate-700">{c.paciente_nombre || '—'}
      {c.comprobante_ref ? <span className="ml-2 font-mono text-[10px] text-slate-400">{c.comprobante_ref}</span> : null}
    </span>
  );

  return (
    <div className="mt-5 space-y-4 animate-fade-up">
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h3 className="font-display font-bold text-lg text-brand-deep">Pacientes atendidos el {fechaLE(fecha)}</h3>
            <p className="text-[12px] text-slate-400">{items.length} consultas registradas para esta fecha</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fecha}
              max={fechaLocalHoy()}
              onChange={(e) => { setFecha(e.target.value || fechaLocalHoy()); setPagina(1); }}
              className="px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            />
            <input
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
              placeholder="Buscar por nombre del paciente…"
              className="px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            />
            <button
              onClick={cargar}
              className="inline-flex items-center justify-center p-2.5 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-slate-500 hover:text-brand-primary hover:ring-brand-primary/40 transition-colors"
              aria-label="Recargar listado"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportarPdfGeneral}
              disabled={pdfGenerando || !filtrados.length}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-danger text-white hover:bg-brand-danger/90 font-semibold text-sm transition-all disabled:opacity-50"
            >
              {pdfGenerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              PDF general
            </button>
          </div>
        </div>

        {error && (
          <div className="px-5 py-3 text-sm text-brand-danger bg-brand-danger/5 border-b border-brand-danger/20">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="p-3.5 pl-5">Hora</th>
                <th className="p-3.5">Cédula</th>
                <th className="p-3.5">Paciente</th>
                <th className="p-3.5">Motivo</th>
                <th className="p-3.5">Diagnóstico (CIE-10)</th>
                <th className="p-3.5 pr-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {cargando ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-primary" />
                    <p className="mt-2">Cargando pacientes atendidos…</p>
                  </td>
                </tr>
              ) : filtradosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="mt-2">Aún no hay pacientes atendidos el {fechaLE(fecha)}.</p>
                  </td>
                </tr>
              ) : (
                filtradosPaginados.map((c) => (
                  <tr key={c.consulta_id} className="hover:bg-slate-50">
                    <td className="p-3.5 pl-5 font-mono text-[12px] text-slate-500 whitespace-nowrap">{horaDe(c.creado_en)}</td>
                    <td className="p-3.5 font-mono text-[12px] text-slate-500 whitespace-nowrap">{c.paciente_cedula || '—'}</td>
                    <td className="p-3.5 font-medium text-slate-700 whitespace-nowrap">{trAmigable(c)}</td>
                    <td className="p-3.5 text-slate-500 max-w-[220px] truncate">{c.motivo_consulta || '—'}</td>
                    <td className="p-3.5 text-slate-500 max-w-[200px] truncate">
                      <span className="font-mono text-[11px] text-brand-primary">{c.cie10_codigo || '—'}</span>
                      {c.cie10_descripcion ? <span className="ml-1">{c.cie10_descripcion}</span> : null}
                    </td>
                    <td className="p-3.5 pr-5">
                      <div className="flex items-center justify-end gap-1.5">
                        {onRetomar && (
                          <button
                            onClick={() => onRetomar(c, null)}
                            className="p-2 rounded-lg text-slate-400 hover:text-brand-primary hover:bg-slate-100 transition-colors"
                            aria-label="Retomar paciente"
                            title="Retomar paciente"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => abrirDetalle(c)} className="p-2 rounded-lg text-slate-400 hover:text-brand-deep hover:bg-slate-100 transition-colors" aria-label="Ver detalle" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditar({ ...c })} className="p-2 rounded-lg text-slate-400 hover:text-brand-primary hover:bg-slate-100 transition-colors" aria-label="Editar" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEliminarId(c.consulta_id)} className="p-2 rounded-lg text-slate-400 hover:text-brand-danger hover:bg-slate-100 transition-colors" aria-label="Eliminar" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => exportarCompleto(c)} className="p-2 rounded-lg text-slate-400 hover:text-brand-danger hover:bg-slate-100 transition-colors" aria-label="PDF completo" title="PDF completo" disabled={pdfGenerando}>
                          {pdfGenerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[12px] text-slate-500">
            <span>{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''} · Página {paginaActual} de {totalPaginas}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaActual <= 1}
                className="px-2.5 py-1 rounded-lg ring-1 ring-slate-200 hover:ring-brand-primary/40 hover:text-brand-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaActual >= totalPaginas}
                className="px-2.5 py-1 rounded-lg ring-1 ring-slate-200 hover:ring-brand-primary/40 hover:text-brand-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- MODAL VER DETALLE ---------- */}
      {ver && createPortal(
        <div className="fixed inset-0 z-50 modal-backdrop overflow-y-auto p-4 sm:p-6 flex min-h-full items-center justify-center" role="dialog" aria-modal="true" tabIndex={-1}>
          <div className="relative w-full max-w-3xl my-auto flex flex-col rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in max-h-[88vh]">
            <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-brand-danger/10 text-brand-danger flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-bold text-lg text-brand-deep truncate">Detalle de la consulta</h3>
                  <p className="text-[11px] text-slate-400 truncate" title={`${ver.paciente_nombre || ''}${ver.comprobante_ref ? ` · ${ver.comprobante_ref}` : ''}`}>
                    {ver.paciente_nombre || ''} {ver.comprobante_ref ? `· ${ver.comprobante_ref}` : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setVer(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0 transition-colors" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 flex-1 overflow-y-auto">
              {detalleCargando ? (
                <div className="py-14 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-primary" />
                  <p className="mt-2 text-sm">Cargando detalle de la consulta…</p>
                </div>
              ) : detalleError ? (
                <div className="py-12 text-center text-brand-danger">
                  <p className="text-sm font-semibold">{detalleError}</p>
                  <button type="button" onClick={() => abrirDetalle(ver)} className="mt-3 text-xs font-bold text-brand-primary hover:underline">
                    Reintentar
                  </button>
                </div>
              ) : detalle ? (
                <div className="space-y-5">
                  {detalle.remision?.remitido ? (
                    <div className="rounded-xl bg-brand-success/10 ring-1 ring-brand-success/30 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-brand-success" />
                        <p className="text-sm font-bold text-brand-success">
                          Paciente remitido a {detalle.remision.especialidad_destino || 'especialista'}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Cita: {fechaCitaAmigable(detalle.remision.cita_fecha)} · {detalle.remision.cita_hora || '—'}
                        {' · '}Médico: {detalle.remision.medico_especialista || '—'}
                        {' · '}Código: {detalle.remision.codigo_cita || '—'}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <p className="text-sm font-bold text-emerald-700">Consulta finalizada</p>
                      </div>
                    </div>
                  )}

                  {detalle.remision_examen?.remitido ? (
                    <div className="flex items-start gap-3 rounded-xl bg-violet-50 ring-1 ring-violet-200 px-4 py-3">
                      <div className="h-9 w-9 rounded-full bg-violet-500/10 ring-1 ring-violet-500/30 flex items-center justify-center text-violet-700 shrink-0">
                        <Microscope className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-violet-900">
                          Paciente remitido para <b>{detalle.remision_examen.examen}</b>
                        </p>
                        <p className="text-xs text-violet-700">{detalle.remision_examen.centro}</p>
                        <p className="text-[11px] text-violet-500">
                          Cita: {fechaCitaAmigable(detalle.remision_examen.fecha_cita)} · {detalle.remision_examen.hora_inicio}
                          {' · '}Código: <span className="font-mono font-semibold">{detalle.remision_examen.codigo_confirmacion}</span>
                          {detalle.remision_examen.estado ? ` · ${detalle.remision_examen.estado}` : ''}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      ['Cédula', detalle.paciente_cedula || '—'],
                      ['Hora de registro', horaDe(detalle.fecha)],
                      ['Especialidad', detalle.especialidad || '—'],
                      ['Médico', detalle.medico_nombre || '—'],
                      ['Comprobante', detalle.comprobante_ref || '—'],
                      ['Registro', detalle.consulta_id || '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{k}</p>
                        <p className="text-[12px] font-semibold text-slate-700 truncate">{v}</p>
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const sv = detalle.signos_vitales || {};
                    const signos = SIGNOS_LABEL.map(([k, l]) => ({ l, v: sv[k] })).filter(
                      (s) => s.v !== undefined && s.v !== null && s.v !== ''
                    );
                    return signos.length ? (
                      <DetalleSeccion titulo="Signos vitales">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {signos.map((s) => (
                            <div key={s.l} className="rounded-xl bg-sky-50 ring-1 ring-sky-200 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600">{s.l}</p>
                              <p className="text-sm font-bold text-slate-700">{String(s.v)}</p>
                            </div>
                          ))}
                        </div>
                      </DetalleSeccion>
                    ) : null;
                  })()}

                  <DetalleSeccion titulo="Motivo de consulta y síntomas">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-2">{detalle.motivo_consulta || '—'}</p>
                  </DetalleSeccion>

                  <DetalleSeccion titulo="Examen físico">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-2">{detalle.examen_fisico || '—'}</p>
                  </DetalleSeccion>

                  <DetalleSeccion titulo="Diagnóstico (CIE-10)">
                    <p className="text-sm text-slate-700 rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
                      <span className="font-mono text-brand-primary">{detalle.cie10_codigo || '—'}</span>
                      {detalle.cie10_descripcion ? <span className="ml-1">{detalle.cie10_descripcion}</span> : null}
                    </p>
                    {detalle.diagnostico_secundario && (
                      <p className="text-sm text-slate-600 mt-1.5">
                        <span className="font-semibold text-slate-500">Secundario:</span> {detalle.diagnostico_secundario}
                      </p>
                    )}
                  </DetalleSeccion>

                  {(detalle.insumos_aplicados || []).length > 0 && (
                    <DetalleSeccion titulo="Tratamiento administrado (insumos y medicamentos)">
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {(detalle.insumos_aplicados || []).map((i, idx) => (
                          <li key={idx} className="rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-2 text-sm">
                            <span className="font-semibold text-slate-700">{i.nombre || '—'}</span>
                            <span className="text-slate-400"> × {i.cantidad || 1} {i.unidad || 'unidad'}</span>
                          </li>
                        ))}
                      </ul>
                    </DetalleSeccion>
                  )}

                  <DetalleSeccion titulo="Tratamiento">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-2">{detalle.tratamiento || '—'}</p>
                  </DetalleSeccion>

                  {(() => {
                    const cat = examenesPorCategoria(detalle);
                    const grupos = [
                      ['Laboratorio', cat.laboratorio, 'bg-sky-50 ring-sky-200 text-sky-700'],
                      ['Imagen', cat.imagen, 'bg-violet-50 ring-violet-200 text-violet-700'],
                      ['Funcional', cat.funcional, 'bg-amber-50 ring-amber-200 text-amber-700'],
                    ].filter(([, items]) => items.length);
                    return grupos.length ? (
                      <DetalleSeccion titulo="Órdenes de exámenes">
                        <div className="space-y-2.5">
                          {grupos.map(([nombre, items, chip]) => (
                            <div key={nombre}>
                              <span className={`inline-block px-2 py-0.5 rounded-md ring-1 text-[10px] font-bold uppercase tracking-wide mb-1 ${chip}`}>
                                {nombre} ({items.length})
                              </span>
                              <ul className="space-y-1">
                                {items.map((e, idx) => (
                                  <li key={idx} className="text-sm text-slate-600">
                                    <span className="font-semibold text-slate-700">{e.estudio || e.nombre || '—'}</span>
                                    {typeof e.indicacion === 'string' && e.indicacion.trim() ? (
                                      <span className="text-slate-400"> · {e.indicacion}</span>
                                    ) : null}
                                    {typeof e.resultado === 'string' && e.resultado.trim() ? (
                                      <span className="mt-0.5 block rounded-md bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 px-2 py-1 text-xs">
                                        Resultado: {e.resultado}
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </DetalleSeccion>
                    ) : null;
                  })()}

                  {(() => {
                    const recetas = (detalle.recetas || []).filter((r) => r && (r.nombre || '').trim());
                    return recetas.length ? (
                      <DetalleSeccion titulo="Recetas médicas">
                        <ul className="space-y-1.5">
                          {recetas.map((r, i) => (
                            <li key={i} className="rounded-lg bg-brand-success/5 ring-1 ring-brand-success/20 px-3 py-2">
                              <p className="text-sm font-semibold text-slate-700">{r.nombre}</p>
                              {r.posologia ? <p className="text-xs text-slate-500">{r.posologia}</p> : null}
                            </li>
                          ))}
                        </ul>
                      </DetalleSeccion>
                    ) : null;
                  })()}

                  {detalle.recomendaciones ? (
                    <DetalleSeccion titulo="Indicaciones y recomendaciones">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-2">{detalle.recomendaciones}</p>
                    </DetalleSeccion>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-slate-50/80 sticky bottom-0 z-10">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => detalle && exportarPdfDetalle(detalle, 'recetas')}
                  disabled={!detalle || pdfGenerando}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {pdfGenerando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pill className="w-3.5 h-3.5 text-brand-success" />}
                  PDF recetas
                </button>
                <button
                  onClick={() => detalle && exportarPdfDetalle(detalle, 'examenes')}
                  disabled={!detalle || pdfGenerando}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {pdfGenerando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5 text-brand-primary" />}
                  PDF exámenes
                </button>
                <button
                  onClick={() => detalle && exportarPdfDetalle(detalle, 'completo')}
                  disabled={!detalle || pdfGenerando}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-danger text-white text-xs font-bold hover:bg-brand-danger/90 disabled:opacity-50 transition-colors"
                >
                  {pdfGenerando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  PDF completo
                </button>
              </div>
              <div className="flex items-center gap-2">
                {onRetomar && (
                  <button
                    onClick={() => {
                      onRetomar(ver, detalle);
                      setVer(null);
                    }}
                    disabled={detalleCargando}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-deep transition-all shadow-sm disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retomar paciente
                  </button>
                )}
                <button onClick={() => { setEditar({ ...ver }); setVer(null); }} className="px-4 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors">Editar</button>
                <button onClick={() => setVer(null)} className="px-4 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">Cerrar</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ---------- MODAL EDITAR ---------- */}
      {editar && createPortal(
        <div className="fixed inset-0 z-50 modal-backdrop overflow-y-auto p-4 sm:p-6 flex min-h-full items-center justify-center" role="dialog" aria-modal="true" tabIndex={-1}>
          <div className="relative w-full max-w-2xl my-auto flex flex-col rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in max-h-[88vh]">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-bold text-lg text-brand-deep truncate">Editar consulta</h3>
                  <p className="text-[11px] text-slate-400 truncate">{editar.paciente_nombre || ''} {editar.comprobante_ref ? `· ${editar.comprobante_ref}` : ''}</p>
                </div>
              </div>
              <button onClick={() => setEditar(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0 transition-colors" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">Motivo de consulta</label>
                <textarea value={editar.motivo_consulta || ''} onChange={(e) => setEditar({ ...editar, motivo_consulta: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">Examen físico</label>
                <textarea value={editar.examen_fisico || ''} onChange={(e) => setEditar({ ...editar, examen_fisico: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">Código CIE-10</label>
                  <input value={editar.cie10_codigo || ''} onChange={(e) => setEditar({ ...editar, cie10_codigo: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">Descripción CIE-10</label>
                  <input value={editar.cie10_descripcion || ''} onChange={(e) => setEditar({ ...editar, cie10_descripcion: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">Tratamiento</label>
                <textarea value={editar.tratamiento || ''} onChange={(e) => setEditar({ ...editar, tratamiento: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">Recomendaciones</label>
                <textarea value={editar.recomendaciones || ''} onChange={(e) => setEditar({ ...editar, recomendaciones: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50" />
              </div>
            </div>
            {error && <div className="px-6 pb-2 text-sm text-brand-danger">{error}</div>}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end shrink-0 bg-slate-50/80 sticky bottom-0 z-10">
              <button onClick={() => setEditar(null)} className="px-4 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={guardarEdicion} disabled={guardando} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors">
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ---------- MODAL CONFIRMAR ELIMINAR ---------- */}
      {eliminarId && createPortal(
        <div className="fixed inset-0 z-50 modal-backdrop overflow-y-auto p-4 sm:p-6 flex min-h-full items-center justify-center" role="dialog" aria-modal="true" tabIndex={-1}>
          <div className="relative w-full max-w-md my-auto rounded-2xl bg-white text-slate-800 shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-3 shrink-0 bg-white">
              <div className="h-10 w-10 rounded-xl bg-brand-danger/10 text-brand-danger flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-brand-deep">Eliminar consulta</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600">¿Seguro que deseas eliminar esta consulta del registro de hoy? Esta acción no se puede deshacer.</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end shrink-0 bg-slate-50/80">
              <button onClick={() => setEliminarId(null)} className="px-4 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={confirmarEliminar} disabled={guardando} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-danger text-white text-sm font-semibold hover:bg-brand-danger/90 disabled:opacity-50 transition-colors">
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

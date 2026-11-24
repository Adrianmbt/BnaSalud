import React, { useCallback, useEffect, useState } from 'react';
import {
  Ban,
  FileText,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Search,
} from 'lucide-react';
import { anularReposo, crearReposo, listarMedicos, listarReposos } from '../../api/historiasMedicas';
import { exportarReposoPdf } from './reporteIntegralPdf';
import { useTheme } from '../ThemeProvider';

const hoyLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const fecha = (valor) => {
  if (!valor) return '—';
  const [a, m, d] = String(valor).split('T')[0].split('-');
  return d ? `${d}/${m}/${a}` : valor;
};

const DIAS = [1, 3, 5, 7];

export default function RepososPanel({ historiaId = null, paciente = null, personalId = null, onChanged }) {
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState({ q: '', estado: '', desde: '', hasta: '' });
  const [medicos, setMedicos] = useState([]);
  const [form, setForm] = useState({
    medico_id: personalId ? String(personalId) : '',
    medico_nombre: '',
    fecha_inicio: hoyLocal(),
    dias: 3,
    diagnostico: '',
    descripcion: '',
  });
  const [cargando, setCargando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [anulando, setAnulando] = useState(null);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    listarMedicos().then(setMedicos).catch(() => setMedicos([]));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = historiaId
        ? { historia_id: historiaId, per_page: 100 }
        : { ...filtros, page, per_page: 20 };
      const data = await listarReposos(params);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setCargando(false);
    }
  }, [historiaId, filtros, page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFormField = (key) => (valor) => setForm((prev) => ({ ...prev, [key]: valor }));

  const seleccionarMedico = (valor) => {
    const m = medicos.find((x) => String(x.id) === valor);
    setForm((prev) => ({
      ...prev,
      medico_id: valor,
      medico_nombre: m ? `${m.nombre || ''} ${m.apellido || ''}`.trim() : '',
    }));
  };

  const emitir = async (e) => {
    e.preventDefault();
    if (!historiaId) return;
    setCreando(true);
    setMensaje(null);
    try {
      const reposo = await crearReposo(historiaId, {
        medico_id: form.medico_id ? Number(form.medico_id) : null,
        medico_nombre: form.medico_nombre || null,
        fecha_inicio: form.fecha_inicio || null,
        dias: Number(form.dias),
        diagnostico: form.diagnostico || null,
        descripcion: form.descripcion || null,
      });
      setMensaje({ tipo: 'ok', texto: `Reposo emitido · folio ${reposo.folio}` });
      setForm((prev) => ({
        ...prev,
        fecha_inicio: hoyLocal(),
        dias: 3,
        diagnostico: '',
        descripcion: '',
      }));
      await cargar();
      onChanged?.();
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err?.response?.data?.detail || 'No se pudo emitir el reposo.',
      });
    } finally {
      setCreando(false);
    }
  };

  const confirmarAnulacion = async () => {
    if (!anulando || motivo.trim().length < 3) return;
    try {
      await anularReposo(anulando.id, motivo.trim());
      setAnulando(null);
      setMotivo('');
      await cargar();
      onChanged?.();
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err?.response?.data?.detail || 'No se pudo anular el reposo.',
      });
      setAnulando(null);
    }
  };

  const imprimir = async (reposo) => {
    await exportarReposoPdf({
      reposo,
      paciente: paciente || {
        nombre_completo: reposo.paciente_nombre,
        cedula: reposo.paciente_cedula,
      },
      tema: theme,
    });
  };

  return (
    <div className="space-y-4">
      {historiaId && (
        <form onSubmit={emitir} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-brand-primary" />
            <div>
              <h3 className="font-display font-bold text-sm text-slate-800">Emitir reposo médico</h3>
              <p className="text-[11px] text-slate-400">
                El vínculo con nómina se resuelve automáticamente por cédula.
              </p>
            </div>
          </div>

          {mensaje && (
            <div
              className={`mb-3 rounded-lg px-3 py-2 text-xs font-semibold ring-1 ${
                mensaje.tipo === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-rose-50 text-rose-700 ring-rose-200'
              }`}
            >
              {mensaje.texto}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                Médico
              </label>
              <select
                value={form.medico_id}
                onChange={(e) => seleccionarMedico(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              >
                <option value="">Sin asignar</option>
                {medicos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {[m.nombre, m.apellido].filter(Boolean).join(' ')}
                    {m.especialidad ? ` · ${m.especialidad}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                Desde
              </label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={(e) => setFormField('fecha_inicio')(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                Días
              </label>
              <div className="flex gap-1">
                {DIAS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFormField('dias')(d)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold ring-1 transition-all ${
                      Number(form.dias) === d
                        ? 'bg-brand-primary text-white ring-brand-primary'
                        : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'
                    }`}
                    aria-pressed={Number(form.dias) === d}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                Diagnóstico
              </label>
              <input
                value={form.diagnostico}
                onChange={(e) => setFormField('diagnostico')(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                Indicaciones
              </label>
              <textarea
                rows={2}
                value={form.descripcion}
                onChange={(e) => setFormField('descripcion')(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-y"
              />
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <button
              type="submit"
              disabled={creando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
            >
              {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Emitir reposo
            </button>
          </div>
        </form>
      )}

      {!historiaId && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px_150px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Buscar por cédula, nombre o folio…"
                value={filtros.q}
                onChange={(e) => {
                  setPage(1);
                  setFiltros((f) => ({ ...f, q: e.target.value }));
                }}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
            </div>
            <select
              value={filtros.estado}
              onChange={(e) => {
                setPage(1);
                setFiltros((f) => ({ ...f, estado: e.target.value }));
              }}
              className="px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            >
              <option value="">Todos los estados</option>
              <option value="vigente">Vigentes</option>
              <option value="anulado">Anulados</option>
            </select>
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => {
                setPage(1);
                setFiltros((f) => ({ ...f, desde: e.target.value }));
              }}
              className="px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              title="Emitido desde"
            />
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => {
                setPage(1);
                setFiltros((f) => ({ ...f, hasta: e.target.value }));
              }}
              className="px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              title="Emitido hasta"
            />
            <button
              type="button"
              onClick={cargar}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-display font-bold text-sm text-slate-800">
            {historiaId ? 'Reposos del paciente' : 'Reposos médicos'}
          </h3>
          <span className="text-[11px] text-slate-400">{total} registro(s)</span>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando…
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">Sin reposos registrados.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((r) => (
              <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-brand-deep">{r.folio}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ring-1 ${
                        r.estado === 'vigente'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-slate-100 text-slate-500 ring-slate-200'
                      }`}
                    >
                      {r.estado}
                    </span>
                    {r.empleado_id && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                        Trabajador
                      </span>
                    )}
                    {r.beneficiario_id && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                        Beneficiario
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 truncate">
                    {r.paciente_nombre} · {r.paciente_cedula}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {fecha(r.fecha_inicio)} → {fecha(r.fecha_fin)} · {r.dias} día(s) ·{' '}
                    {r.medico_nombre || 'Sin médico'}
                  </p>
                  {r.diagnostico && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{r.diagnostico}</p>
                  )}
                  {r.estado === 'anulado' && r.motivo_anulacion && (
                    <p className="text-[10px] text-rose-500 mt-0.5">
                      Anulado por {r.anulado_por}: {r.motivo_anulacion}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => imprimir(r)}
                    className="p-2 rounded-lg text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10"
                    title="Imprimir reposo"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  {r.estado === 'vigente' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnulando(r);
                        setMotivo('');
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Anular reposo"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!historiaId && total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs font-semibold text-slate-500 disabled:opacity-30"
            >
              Anterior
            </button>
            <span className="text-[11px] text-slate-400">
              Página {page} de {Math.max(1, Math.ceil(total / 20))}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / 20)}
              className="text-xs font-semibold text-slate-500 disabled:opacity-30"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {anulando && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <h3 className="font-display font-bold text-slate-800">Anular reposo {anulando.folio}</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              El reposo no se elimina: queda anulado con usuario y motivo.
            </p>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo de la anulación"
              className="mt-3 w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAnulando(null)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarAnulacion}
                disabled={motivo.trim().length < 3}
                className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-40"
              >
                Confirmar anulación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

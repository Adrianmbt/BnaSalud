import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Loader2,
  Pill,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  crearAtencion,
  listarCatalogoMedicamentos,
  listarMedicos,
} from '../../api/historiasMedicas';

const hoyLocal = () => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

const VACIO = {
  medico_id: '',
  medico_nombre: '',
  motivo_consulta: '',
  enfermedad_actual: '',
  examen_fisico: '',
  cie10_codigo: '',
  diagnostico_principal: '',
  diagnostico_secundario: '',
  tratamiento: '',
  recomendaciones: '',
  proxima_consulta: '',
  presion_arterial: '',
  frecuencia_cardiaca: '',
  frecuencia_respiratoria: '',
  temperatura: '',
  saturacion_oxigeno: '',
  peso_kg: '',
  talla_cm: '',
  recetas: [],
  reposo_activo: false,
  reposo_fecha_inicio: hoyLocal(),
  reposo_dias: '3',
  reposo_diagnostico: '',
  reposo_descripcion: '',
};

const Campo = ({ label, value, onChange, tipo = 'text', rows, className = '' }) => (
  <div className={className}>
    <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
      {label}
    </label>
    {rows ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all resize-y"
      />
    ) : (
      <input
        type={tipo}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
      />
    )}
  </div>
);

function RecetaFila({ receta, onChange, onQuitar }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_84px_auto] sm:items-end">
      <div>
        <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wide">
          Medicamento
        </label>
        <input
          list="recetas-catalogo"
          value={receta.nombre}
          onChange={(e) => onChange({ nombre: e.target.value })}
          placeholder="Catálogo o escribir libremente"
          className="w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wide">
          Posología / indicación
        </label>
        <input
          value={receta.posologia}
          onChange={(e) => onChange({ posologia: e.target.value })}
          placeholder="Ej. 1 tableta cada 8 h por 5 días"
          className="w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wide">
          Cantidad
        </label>
        <input
          type="number"
          min="1"
          value={receta.cantidad}
          onChange={(e) => onChange({ cantidad: e.target.value })}
          placeholder="—"
          className="w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        />
      </div>
      <button
        type="button"
        onClick={onQuitar}
        className="mb-0.5 p-2 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        title="Quitar receta"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function AtencionIntegralForm({
  paciente,
  personalId,
  colaId = null,
  medicoSugeridoId = null,
  onCreada,
}) {
  const [form, setForm] = useState(VACIO);
  const [medicos, setMedicos] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    listarMedicos()
      .then((lista) => {
        setMedicos(lista);
        const sugerido = personalId || medicoSugeridoId;
        if (sugerido) {
          const propio = lista.find((m) => m.id === Number(sugerido));
          setForm((prev) => ({
            ...prev,
            medico_id: String(sugerido),
            medico_nombre: propio
              ? `${propio.nombre || ''} ${propio.apellido || ''}`.trim()
              : prev.medico_nombre,
          }));
        }
      })
      .catch(() => setMedicos([]));
  }, [personalId, medicoSugeridoId]);

  useEffect(() => {
    listarCatalogoMedicamentos()
      .then(setCatalogo)
      .catch(() => setCatalogo([]));
  }, []);

  const catalogoPorNombre = useMemo(() => {
    const mapa = new Map();
    catalogo.forEach((m) => mapa.set((m.nombre || '').toLowerCase(), m));
    return mapa;
  }, [catalogo]);

  const set = (key) => (valor) => setForm((prev) => ({ ...prev, [key]: valor }));

  const setReceta = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      recetas: prev.recetas.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  };

  const agregarReceta = () => {
    setForm((prev) => ({
      ...prev,
      recetas: [...prev.recetas, { nombre: '', posologia: '', cantidad: '' }],
    }));
  };

  const quitarReceta = (idx) => {
    setForm((prev) => ({
      ...prev,
      recetas: prev.recetas.filter((_, i) => i !== idx),
    }));
  };

  const cambiarMedicamento = (idx, valor) => {
    const med = catalogoPorNombre.get(valor.trim().toLowerCase());
    setReceta(idx, {
      nombre: valor,
      ...(med && !form.recetas[idx]?.posologia
        ? { posologia: med.posologia_sugerida || '' }
        : {}),
    });
  };

  const seleccionarMedico = (valor) => {
    const medico = medicos.find((m) => String(m.id) === valor);
    setForm((prev) => ({
      ...prev,
      medico_id: valor,
      medico_nombre: medico ? `${medico.nombre || ''} ${medico.apellido || ''}`.trim() : '',
    }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!String(form.motivo_consulta || form.enfermedad_actual || '').trim()) {
      setMensaje({ tipo: 'error', texto: 'Registre al menos el motivo de consulta.' });
      return;
    }
    if (form.reposo_activo && !form.reposo_fecha_inicio) {
      setMensaje({ tipo: 'error', texto: 'Indique la fecha de inicio del reposo.' });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      const signos = {
        presion_arterial: form.presion_arterial || undefined,
        frecuencia_cardiaca: form.frecuencia_cardiaca || undefined,
        frecuencia_respiratoria: form.frecuencia_respiratoria || undefined,
        temperatura: form.temperatura || undefined,
        saturacion_oxigeno: form.saturacion_oxigeno || undefined,
        peso_kg: form.peso_kg || undefined,
        talla_cm: form.talla_cm || undefined,
      };
      const recetas = form.recetas
        .filter((r) => (r.nombre || '').trim())
        .map((r) => ({
          nombre: r.nombre.trim(),
          posologia: (r.posologia || '').trim(),
          cantidad: r.cantidad ? Number(r.cantidad) : null,
        }));
      const reposo = form.reposo_activo
        ? {
            fecha_inicio: form.reposo_fecha_inicio || null,
            dias: Number(form.reposo_dias),
            diagnostico:
              (form.reposo_diagnostico || form.diagnostico_principal || '').trim() || null,
            descripcion: (form.reposo_descripcion || '').trim() || null,
          }
        : null;
      const creada = await crearAtencion(paciente.id, {
        cola_id: colaId ? Number(colaId) : null,
        medico_id: form.medico_id ? Number(form.medico_id) : null,
        medico_nombre: form.medico_nombre || null,
        motivo_consulta: form.motivo_consulta || null,
        enfermedad_actual: form.enfermedad_actual || null,
        examen_fisico: form.examen_fisico || null,
        cie10_codigo: form.cie10_codigo || null,
        diagnostico_principal: form.diagnostico_principal || null,
        diagnostico_secundario: form.diagnostico_secundario || null,
        tratamiento: form.tratamiento || null,
        recetas,
        recomendaciones: form.recomendaciones || null,
        proxima_consulta: form.proxima_consulta || null,
        signos_vitales: signos,
        reposo,
      });
      const folio = creada.reposo?.folio ? ` · reposo ${creada.reposo.folio}` : '';
      setMensaje({
        tipo: 'ok',
        texto: `Atención registrada · comprobante ${creada.comprobante_ref || ''}${folio}`,
      });
      setForm((prev) => ({
        ...VACIO,
        reposo_fecha_inicio: hoyLocal(),
        medico_id: prev.medico_id,
        medico_nombre: prev.medico_nombre,
      }));
      onCreada?.(creada);
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err?.response?.data?.detail || 'No se pudo registrar la atención.',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="space-y-5">
      <datalist id="recetas-catalogo">
        {catalogo.map((m) => (
          <option key={m.id} value={m.nombre}>
            {[m.presentacion, m.concentracion].filter(Boolean).join(' · ')}
          </option>
        ))}
      </datalist>

      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-brand-primary" />
        <div>
          <h3 className="font-display font-bold text-sm text-slate-800">Registrar atención</h3>
          <p className="text-[11px] text-slate-400">
            Se guarda como consulta del paciente con origen «historia integral».
          </p>
        </div>
      </div>

      {mensaje && (
        <div
          className={`rounded-lg px-3 py-2 text-xs font-semibold ring-1 ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-rose-50 text-rose-700 ring-rose-200'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
            Médico tratante
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
        <Campo
          label="Próxima consulta"
          value={form.proxima_consulta}
          onChange={set('proxima_consulta')}
        />
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">
          Signos vitales
        </p>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Campo label="P.A." value={form.presion_arterial} onChange={set('presion_arterial')} />
          <Campo
            label="F.C."
            tipo="number"
            value={form.frecuencia_cardiaca}
            onChange={set('frecuencia_cardiaca')}
          />
          <Campo
            label="F.R."
            tipo="number"
            value={form.frecuencia_respiratoria}
            onChange={set('frecuencia_respiratoria')}
          />
          <Campo
            label="Temperatura"
            tipo="number"
            value={form.temperatura}
            onChange={set('temperatura')}
          />
          <Campo
            label="SpO₂"
            tipo="number"
            value={form.saturacion_oxigeno}
            onChange={set('saturacion_oxigeno')}
          />
          <Campo label="Peso (kg)" tipo="number" value={form.peso_kg} onChange={set('peso_kg')} />
          <Campo label="Talla (cm)" tipo="number" value={form.talla_cm} onChange={set('talla_cm')} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Motivo de consulta"
          value={form.motivo_consulta}
          onChange={set('motivo_consulta')}
          rows={2}
        />
        <Campo
          label="Enfermedad actual"
          value={form.enfermedad_actual}
          onChange={set('enfermedad_actual')}
          rows={2}
        />
        <Campo
          label="Examen físico"
          value={form.examen_fisico}
          onChange={set('examen_fisico')}
          rows={3}
          className="sm:col-span-2"
        />
        <Campo label="CIE-10 (código)" value={form.cie10_codigo} onChange={set('cie10_codigo')} />
        <Campo
          label="Diagnóstico principal"
          value={form.diagnostico_principal}
          onChange={set('diagnostico_principal')}
        />
        <Campo
          label="Diagnóstico secundario"
          value={form.diagnostico_secundario}
          onChange={set('diagnostico_secundario')}
          className="sm:col-span-2"
        />
        <Campo
          label="Tratamiento realizado / instaurado"
          value={form.tratamiento}
          onChange={set('tratamiento')}
          rows={3}
          className="sm:col-span-2"
        />
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-brand-primary" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Tratamiento médico / recetas
              </p>
              <p className="text-[11px] text-slate-400">
                Busque en el catálogo o escriba el medicamento y su posología.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={agregarReceta}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide hover:bg-slate-200"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>

        {form.recetas.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">
            Sin recetas. Use «Agregar» si el paciente requiere récipe médico.
          </p>
        ) : (
          <div className="space-y-3">
            {form.recetas.map((receta, idx) => (
              <RecetaFila
                key={idx}
                receta={receta}
                onChange={(patch) =>
                  patch.nombre !== undefined
                    ? cambiarMedicamento(idx, patch.nombre)
                    : setReceta(idx, patch)
                }
                onQuitar={() => quitarReceta(idx)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.reposo_activo}
            onChange={(e) => set('reposo_activo')(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/30"
          />
          <span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <CalendarDays className="w-3.5 h-3.5" /> Emitir reposo en las indicaciones
            </span>
            <span className="block text-[11px] text-slate-400">
              Se genera el folio automáticamente y queda vinculado a esta atención.
            </span>
          </span>
        </label>

        {form.reposo_activo && (
          <div className="grid gap-3 sm:grid-cols-3 mt-4">
            <Campo
              label="Fecha de inicio"
              tipo="date"
              value={form.reposo_fecha_inicio}
              onChange={set('reposo_fecha_inicio')}
            />
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                Días de reposo
              </label>
              <select
                value={form.reposo_dias}
                onChange={(e) => set('reposo_dias')(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              >
                <option value="1">1 día</option>
                <option value="3">3 días</option>
                <option value="5">5 días</option>
                <option value="7">7 días</option>
              </select>
            </div>
            <Campo
              label="Diagnóstico del reposo"
              value={form.reposo_diagnostico}
              onChange={set('reposo_diagnostico')}
            />
            <Campo
              label="Descripción / indicaciones del reposo"
              value={form.reposo_descripcion}
              onChange={set('reposo_descripcion')}
              rows={2}
              className="sm:col-span-3"
            />
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Recomendaciones generales"
          value={form.recomendaciones}
          onChange={set('recomendaciones')}
          rows={2}
          className="sm:col-span-2"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
        >
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Registrar atención
        </button>
      </div>
    </form>
  );
}

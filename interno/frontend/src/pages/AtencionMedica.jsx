import React, { useState } from 'react';
import {
  Activity,
  Stethoscope,
  Pill,
  FileText,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HeartPulse,
  Thermometer,
  Gauge,
  Weight,
  ArrowLeft,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function AtencionMedica({ pacienteSeleccionado, onFinalizarAtencion, onVolver }) {
  const [formData, setFormData] = useState({
    enfermedad_actual: '',
    // Signos Vitales
    presion_arterial: '',
    frecuencia_cardiaca: '',
    frecuencia_respiratoria: '',
    temperatura: '',
    saturacion_oxigeno: '',
    peso_kg: '',
    talla_cm: '',
    // Diagnóstico y Tratamiento
    diagnostico_principal: '',
    codigo_cie10: '',
    diagnostico_secundario: '',
    tratamiento: '',
    indicaciones_medicas: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Estructurar el payload conforme al esquema de FastAPI (POST /consultas)
    const payload = {
      paciente_id: pacienteSeleccionado.paciente_id,
      cola_id: pacienteSeleccionado.id,
      medico_id: null, // Asignar id si se maneja sesión con JWT
      enfermedad_actual: formData.enfermedad_actual.trim() || null,
      signos_vitales: {
        presion_arterial: formData.presion_arterial || null,
        frecuencia_cardiaca: formData.frecuencia_cardiaca ? parseInt(formData.frecuencia_cardiaca) : null,
        frecuencia_respiratoria: formData.frecuencia_respiratoria ? parseInt(formData.frecuencia_respiratoria) : null,
        temperatura: formData.temperatura ? parseFloat(formData.temperatura) : null,
        saturacion_oxigeno: formData.saturacion_oxigeno ? parseInt(formData.saturacion_oxigeno) : null,
        peso_kg: formData.peso_kg ? parseFloat(formData.peso_kg) : null,
        talla_cm: formData.talla_cm ? parseFloat(formData.talla_cm) : null,
      },
      diagnostico_principal: formData.diagnostico_principal.trim(),
      codigo_cie10: formData.codigo_cie10.trim() || null,
      diagnostico_secundario: formData.diagnostico_secundario.trim() || null,
      tratamiento: formData.tratamiento.trim(),
      indicaciones_medicas: formData.indicaciones_medicas.trim() || null,
    };

    try {
      await axiosClient.post('/consultas', payload);
      if (onFinalizarAtencion) {
        onFinalizarAtencion();
      }
    } catch (err) {
      console.error('Error al registrar consulta:', err);
      const msg = err.response?.data?.detail || 'No se pudo guardar la consulta médica.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!pacienteSeleccionado) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200">
        <p>No se ha seleccionado ningún paciente para consulta.</p>
        {onVolver && (
          <button
            onClick={onVolver}
            className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium"
          >
            Volver al Tablero
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Botón Volver y Encabezado Paciente */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          {onVolver && (
            <button
              onClick={onVolver}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-2.5 bg-asistencial-50 text-asistencial-600 rounded-xl">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{pacienteSeleccionado.paciente_nombre}</h2>
            <p className="text-xs text-slate-500 font-mono">C.I: {pacienteSeleccionado.paciente_cedula}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="text-right text-xs">
            <span className="text-slate-400 block uppercase font-medium">Motivo de Ingreso</span>
            <span className="font-semibold text-slate-700">{pacienteSeleccionado.motivo_consulta || 'Sin especificar'}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Bloque 1: Signos Vitales */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 text-slate-800 font-bold">
            <Activity className="w-5 h-5 text-asistencial-600" />
            <h3>Signos Vitales y Somatometría</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-slate-400" /> Presión Arterial
              </label>
              <input
                type="text"
                name="presion_arterial"
                placeholder="Ej: 120/80"
                value={formData.presion_arterial}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <HeartPulse className="w-3.5 h-3.5 text-slate-400" /> Frec. Cardíaca (ppm)
              </label>
              <input
                type="number"
                name="frecuencia_cardiaca"
                placeholder="75"
                value={formData.frecuencia_cardiaca}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-slate-400" /> Temp. (°C)
              </label>
              <input
                type="number"
                step="0.1"
                name="temperatura"
                placeholder="36.5"
                value={formData.temperatura}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-slate-400" /> Sat. O₂ (%)
              </label>
              <input
                type="number"
                name="saturacion_oxigeno"
                placeholder="98"
                value={formData.saturacion_oxigeno}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Weight className="w-3.5 h-3.5 text-slate-400" /> Peso (kg)
              </label>
              <input
                type="number"
                step="0.1"
                name="peso_kg"
                placeholder="70.5"
                value={formData.peso_kg}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Talla (cm)</label>
              <input
                type="number"
                name="talla_cm"
                placeholder="170"
                value={formData.talla_cm}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500"
              />
            </div>
          </div>
        </div>

        {/* Bloque 2: Anamnesis / Enfermedad Actual */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 text-slate-800 font-bold">
            <FileText className="w-5 h-5 text-asistencial-600" />
            <h3>Enfermedad Actual y Subjetivo</h3>
          </div>
          <textarea
            name="enfermedad_actual"
            rows="3"
            placeholder="Descripción detallada de los síntomas, inicio de cuadro y evolución..."
            value={formData.enfermedad_actual}
            onChange={handleChange}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500 resize-none"
          />
        </div>

        {/* Bloque 3: Diagnóstico */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 text-slate-800 font-bold">
            <Stethoscope className="w-5 h-5 text-asistencial-600" />
            <h3>Diagnóstico Médico</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">
                Diagnóstico Principal <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="diagnostico_principal"
                required
                placeholder="Ej: Síndrome febril / Infección respiratoria alta"
                value={formData.diagnostico_principal}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Código CIE-10</label>
              <input
                type="text"
                name="codigo_cie10"
                placeholder="Ej: J00"
                value={formData.codigo_cie10}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-asistencial-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Diagnósticos Secundarios</label>
            <input
              type="text"
              name="diagnostico_secundario"
              placeholder="Otras condiciones encontradas..."
              value={formData.diagnostico_secundario}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500"
            />
          </div>
        </div>

        {/* Bloque 4: Tratamiento y Plan */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 text-slate-800 font-bold">
            <Pill className="w-5 h-5 text-asistencial-600" />
            <h3>Tratamiento y Récipe</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">
              Medicamentos y Dosis <span className="text-red-500">*</span>
            </label>
            <textarea
              name="tratamiento"
              required
              rows="3"
              placeholder="1. Paracetamol 500mg cada 8 horas por 3 días..."
              value={formData.tratamiento}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500 resize-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Indicaciones y Recomendaciones</label>
            <textarea
              name="indicaciones_medicas"
              rows="2"
              placeholder="Reposo, hidratación abundante, control por consulta externa..."
              value={formData.indicaciones_medicas}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asistencial-500 resize-none"
            />
          </div>
        </div>

        {/* Footer con Botón de Guardado */}
        <div className="flex justify-end space-x-4 pt-2">
          {onVolver && (
            <button
              type="button"
              onClick={onVolver}
              disabled={loading}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-asistencial-600 hover:bg-asistencial-700 text-white rounded-lg text-sm font-bold shadow-md flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Guardando Consulta...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Finalizar y Guardar Consulta</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

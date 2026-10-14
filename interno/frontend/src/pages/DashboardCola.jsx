import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getCola, transicionarEstado } from '../api/cola';
import TablaCola from '../components/TablaCola';
import AtencionMedica from './AtencionMedica';

const GRUPOS = [
  { clave: 'recepcion', label: 'Recepción' },
  { clave: 'triaje', label: 'Triaje' },
  { clave: 'espera', label: 'En espera' },
  { clave: 'consulta', label: 'En consulta' },
  { clave: 'finalizado', label: 'Finalizados' },
];

export default function DashboardCola() {
  const [cola, setCola] = useState({
    recepcion: [],
    triaje: [],
    espera: [],
    consulta: [],
    finalizado: [],
  });
  const [flujoCola, setFlujoCola] = useState(true);
  const [pacienteAtendiendo, setPacienteAtendiendo] = useState(null);
  const [grupoActivo, setGrupoActivo] = useState('espera');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargarCola = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getCola();
      setCola({
        recepcion: data.recepcion || [],
        triaje: data.triaje || [],
        espera: data.espera || [],
        consulta: data.consulta || [],
        finalizado: data.finalizado || [],
      });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error al cargar la cola.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarCola();
    const intervalo = setInterval(cargarCola, 15000);
    return () => clearInterval(intervalo);
  }, [cargarCola]);

  const grupo = GRUPOS.find((g) => g.clave === grupoActivo) || GRUPOS[0];
  const pacientes = cola[grupo.clave] || [];

  const conteos = GRUPOS.map((g) => ({
    ...g,
    total: (cola[g.clave] || []).length,
  }));

  const atenderPaciente = (paciente) => {
    setPacienteAtendiendo(paciente);
    setFlujoCola(false);
  };

  const finalizarAtencion = async () => {
    if (pacienteAtendiendo) {
      try {
        await transicionarEstado(pacienteAtendiendo.id, { nuevo_estado: 'FINALIZADO' });
      } catch (err) {
        console.error('Error al finalizar cola:', err);
        setError(err.response?.data?.detail || 'La consulta se guardó, pero no se pudo finalizar la cola.');
      }
    }
    setPacienteAtendiendo(null);
    setFlujoCola(true);
    cargarCola();
  };

  const volverAlTablero = () => {
    setPacienteAtendiendo(null);
    setFlujoCola(true);
    cargarCola();
  };

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h2 className="text-2xl font-semibold text-slate-800">Cola de Atención</h2>
        <button
          onClick={cargarCola}
          className="inline-flex items-center gap-2 bg-asistencial-600 hover:bg-asistencial-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar Lista
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!flujoCola ? (
        <AtencionMedica
          pacienteSeleccionado={pacienteAtendiendo}
          onFinalizarAtencion={finalizarAtencion}
          onVolver={volverAlTablero}
        />
      ) : (
        <>
          {/* Tarjetas de resumen por estado */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {conteos.map((g) => (
              <button
                key={g.clave}
                onClick={() => setGrupoActivo(g.clave)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  grupo.clave === g.clave
                    ? 'bg-asistencial-600 border-asistencial-700 text-white'
                    : 'bg-white border-slate-200 hover:border-asistencial-500'
                }`}
              >
                <div className="text-2xl font-bold">{g.total}</div>
                <div className="text-xs uppercase tracking-wider opacity-80">{g.label}</div>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando cola de atención...</div>
          ) : (
            <TablaCola
              pacientes={pacientes}
              vacio={`Sin pacientes en «${grupo.label}».`}
              onAtender={atenderPaciente}
            />
          )}
        </>
      )}
    </main>
  );
}

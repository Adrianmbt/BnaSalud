const ESTADOS_ATENDIBLES = ['EN_ESPERA_CONSULTA', 'EN_CONSULTA'];

const ETIQUETAS_ESTADO = {
  RECEPCION: 'Recepción',
  TRIAJE: 'Triaje',
  EN_ESPERA_CONSULTA: 'En Espera',
  EN_CONSULTA: 'En Consulta',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
  NO_ASISTIO: 'No Asistió',
};

const COLORES_ESTADO = {
  RECEPCION: 'bg-slate-100 text-slate-700',
  TRIAJE: 'bg-amber-100 text-amber-800',
  EN_ESPERA_CONSULTA: 'bg-sky-100 text-sky-800',
  EN_CONSULTA: 'bg-indigo-100 text-indigo-800',
  FINALIZADO: 'bg-emerald-100 text-emerald-800',
  CANCELADO: 'bg-red-100 text-red-700',
  NO_ASISTIO: 'bg-slate-100 text-slate-500',
};

export function etiquetaEstado(estado) {
  return ETIQUETAS_ESTADO[estado] || estado || '—';
}

export function colorEstado(estado) {
  return COLORES_ESTADO[estado] || 'bg-slate-100 text-slate-700';
}

export default function TablaCola({ pacientes = [], vacio = 'No hay pacientes en esta lista.', onAtender }) {
  const conAccion = typeof onAtender === 'function';
  const numCols = conAccion ? 6 : 5;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
            <th className="p-4">Prioridad</th>
            <th className="p-4">Cédula</th>
            <th className="p-4">Nombre</th>
            <th className="p-4">Estado</th>
            <th className="p-4">Llegada</th>
            {conAccion && <th className="p-4 text-right">Acción</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {pacientes.length === 0 ? (
            <tr>
              <td colSpan={numCols} className="p-6 text-center text-slate-400">
                {vacio}
              </td>
            </tr>
          ) : (
            pacientes.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="p-4 font-bold text-amber-600">P{p.prioridad}</td>
                <td className="p-4 font-mono">{p.paciente_cedula}</td>
                <td className="p-4 font-medium">{p.paciente_nombre}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colorEstado(p.atencion_estado)}`}>
                    {etiquetaEstado(p.atencion_estado)}
                  </span>
                </td>
                <td className="p-4 text-slate-500">
                  {p.creado_en
                    ? new Date(p.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </td>
                {conAccion && (
                  <td className="p-4 text-right">
                    {ESTADOS_ATENDIBLES.includes(p.atencion_estado) ? (
                      <button
                        onClick={() => onAtender(p)}
                        className="px-3 py-1.5 bg-asistencial-600 hover:bg-asistencial-700 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Atender
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

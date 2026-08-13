import { useState } from 'react';
import Icon from './Icon';
import {
  PACIENTES_DEMO,
  DOCTORES_DEMO,
  getPersonaDemo,
  setPersonaDemo,
} from '../clinical/demo';

export default function DemoSwitcher() {
  const [abierto, setAbierto] = useState(false);
  const persona = getPersonaDemo();

  const elegir = (nueva) => {
    setPersonaDemo(nueva);
    window.location.reload();
  };

  const personaEtiqueta = persona
    ? persona.tipo === 'paciente'
      ? `Paciente ${persona.cedula}`
      : `Dr(a). ${persona.username}`
    : 'Ninguna';

  return (
    <div className="fixed bottom-4 right-4 z-[90] font-ui">
      {abierto ? (
        <div
          role="dialog"
          aria-label="Alternar persona de demostración"
          className="w-[330px] max-w-[86vw] bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-outline-variant bg-surface-container-low">
            <span className="w-8 h-8 rounded-lg bg-amber text-white flex items-center justify-center shrink-0">
              <Icon name="experiment" filled className="text-base" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-primary leading-tight">Modo demostración</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">
                Persona activa: {personaEtiqueta}
              </p>
            </div>
            <button
              onClick={() => setAbierto(false)}
              className="ml-auto w-8 h-8 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
              aria-label="Cerrar panel demo"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          <div className="max-h-[52vh] overflow-y-auto ledger-scroll">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant px-4 pt-3 pb-1">
              Pacientes
            </p>
            {PACIENTES_DEMO.map((p) => (
              <button
                key={p.perfil.cedula}
                onClick={() => elegir({ tipo: 'paciente', cedula: p.perfil.cedula })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container-low transition-colors ${
                  persona && persona.tipo === 'paciente' && persona.cedula === p.perfil.cedula
                    ? 'bg-fx-soft/60'
                    : ''
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-doc text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {p.perfil.nombre_completo.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-primary truncate">{p.perfil.nombre_completo}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">
                    V-{p.perfil.cedula} · PIN {p.pin}
                  </span>
                </span>
                {persona && persona.tipo === 'paciente' && persona.cedula === p.perfil.cedula && (
                  <Icon name="check_circle" filled className="text-doc" />
                )}
              </button>
            ))}

            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant px-4 pt-3 pb-1">
              Doctores
            </p>
            {DOCTORES_DEMO.map((d) => (
              <button
                key={d.username}
                onClick={() => elegir({ tipo: 'doctor', username: d.username })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container-low transition-colors ${
                  persona && persona.tipo === 'doctor' && persona.username === d.username
                    ? 'bg-fx-soft/60'
                    : ''
                }`}
              >
                <span className="w-8 h-8 rounded-lg bg-ink text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                  {d.nombre.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-primary truncate">{d.nombre}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">
                    @{d.username} · {d.especialidad} · clave {d.password}
                  </span>
                </span>
                {persona && persona.tipo === 'doctor' && persona.username === d.username && (
                  <Icon name="check_circle" filled className="text-doc" />
                )}
              </button>
            ))}
          </div>

          <div className="px-4 py-2.5 border-t border-outline-variant flex items-center justify-between bg-surface-container-low">
            <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant">
              Se recarga la vista al cambiar
            </p>
            {persona && (
              <button
                onClick={limpiar}
                className="text-xs font-bold text-error hover:underline"
              >
                Quitar persona demo
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAbierto(true)}
          className="flex items-center gap-2 pl-3 pr-4 h-11 rounded-full bg-ink text-white shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Abrir panel de demostración"
        >
          <Icon name="experiment" filled className="text-lg" />
          <span className="text-xs font-extrabold uppercase tracking-widest">Demo</span>
        </button>
      )}
    </div>
  );
}

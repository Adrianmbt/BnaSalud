import { useState } from 'react';
import Icon from './Icon';

export default function Appointment() {
  const [step, setStep] = useState(1);

  function nextStep() {
    if (step >= 3) return;
    setStep(step + 1);
  }

  return (
    <section className="py-16 md:py-24 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-64 h-64 bg-secondary rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-tertiary-fixed-dim rounded-full blur-3xl"></div>
      </div>
      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <div className="bg-white rounded-3xl md:rounded-4xl p-6 md:p-12 shadow-2xl" data-aos="zoom-in" data-aos-duration="600">
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary mb-4 border border-secondary/20">Formulario Rápido</span>
            <h2 className="text-3xl md:text-4xl font-bold text-primary">Agende su Cita Digital</h2>
            <p className="text-base text-on-surface-variant mt-2">Complete el formulario en menos de 2 minutos.</p>
          </div>

          <div className="flex items-center justify-center mb-10 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-4">
                {n > 1 && <div className="h-0.5 w-16 bg-outline-variant/50"></div>}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ${
                      n === step
                        ? 'bg-secondary text-white'
                        : n < step
                          ? 'bg-tertiary-fixed-dim text-tertiary'
                          : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {n < step ? <Icon name="check" /> : n}
                  </div>
                  <span className={`text-xs ${n === step ? 'font-semibold text-secondary' : 'font-medium text-on-surface-variant/60'}`}>
                    {n === 1 ? 'Identificación' : n === 2 ? 'Selección' : 'Confirmación'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="max-w-xl mx-auto">
            {step === 1 && (
              <div id="stepContent" className="space-y-5 transition-all duration-500">
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-on-surface-variant">Cédula de Identidad</label>
                    <input
                      type="text"
                      placeholder="V-00.000.000"
                      className="bg-surface-container-low border-0 border-b-2 border-outline focus:border-secondary transition-all px-4 py-3 rounded-t-lg text-sm focus:ring-0 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-on-surface-variant">Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Ej: Juan Pérez"
                      className="bg-surface-container-low border-0 border-b-2 border-outline focus:border-secondary transition-all px-4 py-3 rounded-t-lg text-sm focus:ring-0 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    className="bg-surface-container-low border-0 border-b-2 border-outline focus:border-secondary transition-all px-4 py-3 rounded-t-lg text-sm focus:ring-0 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {step > 1 && (
              <div className="flex flex-col items-center justify-center py-10 space-y-4 animate-fade-in">
                <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center">
                  <Icon name="check_circle" filled className="text-5xl" />
                </div>
                <h3 className="text-2xl font-bold text-primary">¡Paso {step} completado!</h3>
                <p className="text-on-surface-variant text-center max-w-sm">Estamos procesando su solicitud en tiempo real para asignarle el mejor especialista disponible.</p>
              </div>
            )}

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-outline-variant/20">
              {step < 3 ? (
                <>
                  <button type="button" className="text-secondary font-semibold text-sm px-6 py-3 rounded-xl hover:bg-secondary/5 transition-all">Cancelar</button>
                  <button type="button" onClick={nextStep} className="btn-primary text-white px-8 py-3 rounded-xl font-semibold text-sm shadow-lg active:scale-95 flex items-center gap-2">
                    Siguiente Paso
                    <Icon name="arrow_forward" />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="text-secondary font-semibold text-sm px-6 py-3 rounded-xl hover:bg-secondary/5 transition-all" onClick={() => setStep(1)}>
                    Volver a Empezar
                  </button>
                  <button type="button" className="btn-primary text-white px-8 py-3 rounded-xl font-semibold text-sm shadow-lg active:scale-95 flex items-center gap-2">
                    <Icon name="check" /> Confirmar Cita
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

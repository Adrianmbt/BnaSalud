import { useState } from 'react';
import Icon from './Icon';

const RESPUESTAS = {
  '¿Cómo pido cita en la red municipal?': 'Para solicitar una cita en nuestra red municipal solo debes hacer clic en el botón <strong>"Pedir Cita"</strong> del centro de salud de tu preferencia. Se abrirá un formulario donde ingresas tus datos personales, seleccionas la especialidad y la fecha. Recibirás la confirmación en tu correo electrónico en menos de 24 horas. Si tienes alguna dificultad, también puedes llamarnos al +58 281 000 0001.',
  'Centros de salud aliados y horarios': 'Actualmente contamos con <strong>5 centros de salud</strong> en la red municipal: CITAB (Clínica de los Trabajadores, Lun-Vie 7AM-6PM), Clínica de la Mujer (Lun-Sáb 7AM-5PM), Clínica del Niño (Lun-Sáb 7AM-6PM), Jornadas de Salud (fines de semana, calendario público) y el Centro Oncológico (Lun-Vie 7AM-5PM). Todos comparten el mismo historial clínico y sistema de referencia.',
  'Emergencias 24 horas': 'Si estás enfrentando una emergencia médica, acude de inmediato al centro de salud más cercano de la red municipal — la Clínica de los Trabajadores CITAB y el Hospital del municipio atienden urgencias. Mientras recibes atención, mantén la calma, identifica síntomas como dolor en el pecho, dificultad para respirar, sangrado o pérdida de conciencia. Nuestro equipo de triaje evaluará tu caso al llegar. Para emergencias graves, llama al <strong>+58 281 000 0000</strong>. ¡No esperes, cada minuto cuenta!',
};

export default function Chatbot() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([
    { tipo: 'bot', texto: '¡Hola! Soy Apolonio tu asistente del Instituto de Salud Municipal. ¿En qué puedo ayudarte hoy?' },
  ]);
  const [input, setInput] = useState('');

  function agregarMensaje(texto, tipo) {
    setMensajes((prev) => [...prev, { tipo, texto }]);
  }

  function responder(consulta) {
    setTimeout(() => {
      agregarMensaje(
        RESPUESTAS[consulta] || 'Gracias por tu consulta. Un agente del Instituto de Salud Municipal te contactará a la brevedad para brindarte la información que necesitas.',
        'bot'
      );
    }, 800);
  }

  function enviar() {
    if (!input.trim()) return;
    agregarMensaje(input.trim(), 'user');
    responder(input.trim());
    setInput('');
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-16 h-16 btn-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 group"
        aria-label="Abrir asistente virtual"
      >
        <Icon name="smart_toy" className="text-3xl group-hover:rotate-12 transition-transform" />
      </button>

      {abierto && (
        <div className="absolute bottom-20 right-0 w-[360px] bg-white rounded-3xl border border-outline-variant/20 overflow-hidden flex flex-col" style={{ boxShadow: '0 32px 64px -16px rgba(0,0,0,0.25)' }}>
          <div className="bg-primary px-6 py-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-white">
              <Icon name="support_agent" filled />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Apolonio Asistente Virtual IA</p>
              <p className="text-[10px] text-secondary-container flex items-center gap-1">
                <span className="w-2 h-2 bg-tertiary-fixed rounded-full animate-pulse"></span> En línea · Respuestas al instante
              </p>
            </div>
            <button onClick={() => setAbierto(false)} className="ml-auto text-white/50 hover:text-white transition-colors" aria-label="Cerrar chat">
              <Icon name="close" />
            </button>
          </div>

          <div className="h-80 p-4 overflow-y-auto scrollbar-hide bg-surface-container-low space-y-4">
            {mensajes.map((m, i) => (
              <div
                key={i}
                className={
                  m.tipo === 'user'
                    ? 'bg-secondary text-white p-4 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] self-end ml-auto'
                    : 'bg-white p-4 rounded-2xl rounded-tl-none shadow-sm max-w-[85%]'
                }
              >
                <p className={`text-sm ${m.tipo === 'user' ? '' : 'text-primary'}`} dangerouslySetInnerHTML={{ __html: m.texto }}></p>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-outline-variant/20 flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="Escribe tu consulta..."
              className="flex-1 bg-surface-container-low border-0 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-secondary/50 focus:outline-none"
            />
            <button onClick={enviar} className="bg-secondary text-white p-3 rounded-xl hover:bg-secondary/90 transition-all" aria-label="Enviar mensaje">
              <Icon name="send" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

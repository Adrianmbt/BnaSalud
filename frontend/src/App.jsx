import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import AOS from 'aos';
import Home from './pages/Home';

function Proximamente({ titulo }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
      <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-5xl">construction</span>
      </div>
      <h1 className="text-3xl font-bold text-primary mb-2">{titulo}</h1>
      <p className="text-on-surface-variant text-center max-w-md">
        Esta sección se está construyendo a partir del boceto. Vuelve pronto.
      </p>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    AOS.init({
      once: true,
      duration: 600,
      easing: 'ease-out-cubic',
    });
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/paciente" element={<Proximamente titulo="Portal del Paciente" />} />
      <Route path="/admin" element={<Proximamente titulo="Panel de Administración" />} />
      <Route path="*" element={<Proximamente titulo="Página no encontrada" />} />
    </Routes>
  );
}

import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import AOS from 'aos';
import Home from './pages/Home';
import Farmacia from './pages/Farmacia';
import Doctores from './pages/Doctores';
import Laboratorio from './pages/Laboratorio';
import Paciente from './pages/Paciente';
import Admin from './pages/Admin';

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
      disable: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/paciente" element={<Paciente />} />
      <Route path="/farmacia" element={<Farmacia />} />
      <Route path="/doctores" element={<Doctores />} />
      <Route path="/laboratorio" element={<Laboratorio />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Proximamente titulo="Página no encontrada" />} />
    </Routes>
  );
}

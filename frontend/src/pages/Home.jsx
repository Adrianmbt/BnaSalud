import { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Metrics from '../components/Metrics';
import ComoFunciona from '../components/ComoFunciona';
import Specialties from '../components/Specialties';
import Centros from '../components/Centros';
import Testimonials from '../components/Testimonials';
import Footer from '../components/Footer';
import CitaModal from '../components/CitaModal';
import Chatbot from '../components/Chatbot';

export default function Home() {
  const [centroModal, setCentroModal] = useState(null);

  return (
    <>
      <a href="#inicio" className="skip-link">Ir al contenido principal</a>
      <Navbar />
      <Hero onSolicitarCita={() => window.location.hash = '#sedes'} />
      <Metrics />
      <ComoFunciona />
      <Specialties />
      <Centros onPedirCita={setCentroModal} />
      <Testimonials />
      <Footer />
      <Chatbot />

      {centroModal && (
        <CitaModal centro={centroModal} onClose={() => setCentroModal(null)} />
      )}
    </>
  );
}

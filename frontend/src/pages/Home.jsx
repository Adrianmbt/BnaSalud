import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Metrics from '../components/Metrics';
import ComoFunciona from '../components/ComoFunciona';
import Specialties from '../components/Specialties';
import Acceso from '../components/Acceso';
import Testimonials from '../components/Testimonials';
import Footer from '../components/Footer';
import Chatbot from '../components/Chatbot';

export default function Home() {
  const navigate = useNavigate();

  return (
    <>
      <a href="#inicio" className="skip-link">Ir al contenido principal</a>
      <Navbar />
      <Hero onSolicitarCita={() => navigate('/paciente')} />
      <Metrics />
      <ComoFunciona />
      <Specialties />
      <Acceso onAcceder={() => navigate('/paciente')} />
      <Testimonials />
      <Footer />
      <Chatbot />
    </>
  );
}

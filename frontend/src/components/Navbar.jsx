import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

export default function Navbar() {
  useEffect(() => {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) e.preventDefault();
      });
    });
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass h-20" aria-label="Navegación principal">
      <div className="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-14 h-12 rounded-xl overflow-hidden bg-white shadow-lg ring-1 ring-outline-variant/30 flex items-center justify-center px-1.5">
            <img src="/identidad visual/SBna.jpeg" alt="Logo Salud Barcelona" className="h-full w-auto object-contain" loading="lazy" />
          </div>
          <div>
            <span className="text-xl font-bold text-primary leading-none">Salud Barcelona</span>
            <span className="text-xs font-semibold text-secondary uppercase tracking-[0.15em] block">Instituto de Salud Municipal · Simón Bolívar</span>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-8">
          <a href="#servicios" className="text-sm font-semibold text-secondary border-b-2 border-secondary pb-1">Servicios</a>
          <a href="#sedes" className="text-sm font-medium text-on-surface-variant hover:text-secondary transition-colors">Red de Centros</a>
          <a href="#impacto" className="text-sm font-medium text-on-surface-variant hover:text-secondary transition-colors">Impacto Social</a>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center bg-surface-container-low p-1 rounded-full border border-outline-variant/30">
            <Link to="/paciente" className="px-4 py-1.5 rounded-full text-xs font-semibold bg-primary text-white shadow-sm">Pacientes</Link>
            <Link to="/admin" className="px-4 py-1.5 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-dim/50 transition-all">Admin</Link>
          </div>
          <div className="bg-error/10 text-error px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse-slow">
            <Icon name="emergency" filled className="text-lg" />
            <span className="text-xs font-bold whitespace-nowrap">24/7 Emergencias</span>
          </div>
          <button className="p-2 hover:bg-secondary/10 rounded-full transition-all text-on-surface" aria-label="Cuenta">
            <Icon name="account_circle" />
          </button>
        </div>
      </div>
    </nav>
  );
}

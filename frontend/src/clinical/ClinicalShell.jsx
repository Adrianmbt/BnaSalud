import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';

const MODULOS = [
  {
    id: 'farmacia',
    index: '01',
    etiqueta: 'Despacho de Recetas',
    detalle: 'Farmacia e inventario',
    icono: 'prescriptions',
    to: '/farmacia',
  },
  {
    id: 'doctores',
    index: '02',
    etiqueta: 'Gestión de Consultas',
    detalle: 'Portal médico',
    icono: 'stethoscope',
    to: '/doctores',
  },
];

export default function ClinicalShell({ module, children }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const fecha = new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const activo = MODULOS.find((m) => m.id === module);
  const esFarmacia = module === 'farmacia';

  const contenidoNav = (
    <>
      <div className="px-6 pt-7 pb-5 border-b border-white/10">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-11 h-10 rounded-lg overflow-hidden bg-white shadow-lg ring-1 ring-white/30 flex items-center justify-center px-1 shrink-0 group-hover:ring-white/60 transition-all">
            <img src="/identidad visual/SBna.jpeg" alt="Logo Salud Barcelona" className="h-full w-auto object-contain" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-paper leading-none truncate">Salud Barcelona</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/50 mt-1">Instituto de Salud · S. Bolívar</p>
          </div>
        </Link>
      </div>

      <div className="px-5 pt-6 pb-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-paper/40 mb-3 px-2">Módulos internos</p>
        <ul className="space-y-1.5">
          {MODULOS.map((m) => {
            const activado = m.id === module;
            return (
              <li key={m.id}>
                <Link
                  to={m.to}
                  onClick={() => setMenuAbierto(false)}
                  aria-current={activado ? 'page' : undefined}
                  className={
                    activado
                      ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl bg-paper text-ink shadow-md'
                      : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-paper/70 hover:text-paper hover:bg-white/5 transition-colors'
                  }
                >
                  <span className={`font-mono text-[10px] ${activado ? 'text-ink-faint' : 'text-paper/35'}`}>
                    {m.index}
                  </span>
                  <Icon name={m.icono} filled={activado} className="text-xl" />
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold leading-tight ${activado ? 'text-ink' : 'text-paper/85'}`}>
                      {m.etiqueta}
                    </span>
                    <span className={`block font-mono text-[9px] uppercase tracking-widest mt-0.5 ${activado ? 'text-ink-faint' : 'text-paper/40'}`}>
                      {m.detalle}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-auto px-5 py-5 space-y-1.5 border-t border-white/10">
        <Link
          to="/"
          onClick={() => setMenuAbierto(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-paper/70 hover:text-paper hover:bg-white/5 transition-colors text-sm font-medium"
        >
          <Icon name="home" className="text-xl" />
          Portal de la Comunidad
        </Link>
        <Link
          to="/"
          onClick={() => setMenuAbierto(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-paper/70 hover:text-paper hover:bg-white/5 transition-colors text-sm font-medium"
        >
          <Icon name="logout" className="text-xl" />
          Cerrar sesión
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-paper paper-noise text-ink font-ui">
      {/* Sidebar escritorio */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[280px] bg-ink flex-col z-40">
        {contenidoNav}
      </aside>

      {/* Sidebar móvil */}
      <div
        className={`lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${menuAbierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMenuAbierto(false)}
        aria-hidden="true"
      />
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-[280px] bg-ink flex flex-col z-50 transition-transform duration-300 ease-out ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Navegación de módulos"
      >
        <button
          onClick={() => setMenuAbierto(false)}
          className="absolute top-4 right-4 p-2 rounded-lg text-paper/70 hover:text-paper hover:bg-white/10"
          aria-label="Cerrar menú"
        >
          <Icon name="close" />
        </button>
        {contenidoNav}
      </aside>

      {/* Barra superior */}
      <header className="lg:pl-[280px] sticky top-0 z-30 bg-paper/90 backdrop-blur-md border-b border-ink-line">
        <div className="flex items-center justify-between gap-4 px-5 md:px-8 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMenuAbierto(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-ink-soft hover:bg-paper-2"
              aria-label="Abrir menú de módulos"
            >
              <Icon name="menu" />
            </button>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-ink-faint">
                Módulo {activo.index} · {esFarmacia ? 'Farmacia' : 'Consulta'}
              </p>
              <h1 className="font-display text-xl font-semibold text-ink leading-tight truncate">
                {activo.etiqueta}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <p className="hidden md:block font-mono text-[10px] uppercase tracking-widest text-ink-faint capitalize">
              {fecha}
            </p>
            <button
              className="relative p-2.5 rounded-full text-ink-soft hover:bg-paper-2 transition-colors"
              aria-label="Notificaciones"
            >
              <Icon name="notifications" />
              <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${esFarmacia ? 'bg-amber' : 'bg-blood'}`} />
            </button>
            <div className="flex items-center gap-2.5 pl-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-paper font-display font-semibold text-sm shadow-sm ${esFarmacia ? 'bg-fx' : 'bg-doc'}`}>
                {esFarmacia ? 'QF' : 'LF'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-ink leading-tight">
                  {esFarmacia ? 'Lic. Y. Contreras' : 'Dra. Laura Fernández'}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                  {esFarmacia ? 'ID 2071 · Regente' : 'Med. General · ID 1043'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="lg:pl-[280px] h-[calc(100vh-4rem)] overflow-hidden">{children}</div>
    </div>
  );
}

import { HeartPulse } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="bg-asistencial-700 text-white p-4 shadow-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <HeartPulse className="w-7 h-7 text-sky-200" />
          <h1 className="text-xl font-bold tracking-wide">BnaSalud — Módulo Interno</h1>
        </div>
        <span className="bg-asistencial-600 px-3 py-1 rounded-full text-xs font-semibold">
          Panel de Atención
        </span>
      </div>
    </header>
  );
}

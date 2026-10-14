import React, { useMemo, useState } from 'react';
import { Pill, Search, Loader2, Plus, X, CheckCircle2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import PanelModal from './PanelModal';

export default function RecetaCatalogModal({
  abierto,
  onClose,
  onSeleccionar,
  catalogo = [],
  cargando = false,
  err = '',
}) {
  const [busqueda, setBusqueda] = useState('');
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaPresentacion, setNuevaPresentacion] = useState('');
  const [nuevaConcentracion, setNuevaConcentracion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState('');

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter((m) =>
      [m.nombre, m.presentacion, m.concentracion].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [catalogo, busqueda]);

  const handleSeleccionar = (med) => {
    onSeleccionar(med);
    setBusqueda('');
  };

  const handleAgregar = async () => {
    if (!nuevoNombre.trim()) return;
    setGuardando(true);
    setExito('');
    try {
      await axiosClient.post('/medicamentos', {
        nombre: nuevoNombre.trim(),
        presentacion: nuevaPresentacion.trim() || null,
        concentracion: nuevaConcentracion.trim() || null,
      });
      setExito('Medicamento agregado al catalogo.');
      setNuevoNombre('');
      setNuevaPresentacion('');
      setNuevaConcentracion('');
      setMostrarAgregar(false);
    } catch (e) {
      // error silently
    } finally {
      setGuardando(false);
    }
  };

  const handleClose = () => {
    setBusqueda('');
    setMostrarAgregar(false);
    setExito('');
    onClose();
  };

  return (
    <PanelModal
      abierto={abierto}
      onClose={handleClose}
      id="sp-receta-catalogo"
      titulo="Catalogo de recetas"
      subtitulo="Selecciona o agrega medicamentos para recetar"
      icono={<Pill className="w-5 h-5" />}
      maxW="max-w-lg"
    >
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, presentacion o concentracion..."
          className="cp-input !pl-9 !py-2.5 !text-sm"
          autoFocus
        />
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 text-red-700 px-3 py-2 text-xs font-semibold mb-3">
          {err}
        </div>
      )}

      {exito && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 px-3 py-2 text-xs font-semibold mb-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {exito}
        </div>
      )}

      {/* Formulario agregar nuevo */}
      {mostrarAgregar && (
        <div className="rounded-xl border border-brand-primary/30 bg-brand-primary/5 p-3 mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-brand-deep">Agregar medicamento al catalogo</span>
            <button onClick={() => setMostrarAgregar(false)} className="p-1 rounded-md hover:bg-white text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre del medicamento *"
            className="cp-input !py-1.5 !text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={nuevaPresentacion}
              onChange={(e) => setNuevaPresentacion(e.target.value)}
              placeholder="Presentacion (tableta, jarabe...)"
              className="cp-input !py-1.5 !text-xs"
            />
            <input
              value={nuevaConcentracion}
              onChange={(e) => setNuevaConcentracion(e.target.value)}
              placeholder="Concentracion (500mg...)"
              className="cp-input !py-1.5 !text-xs"
            />
          </div>
          <button
            onClick={handleAgregar}
            disabled={!nuevoNombre.trim() || guardando}
            className="w-full py-1.5 rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-brand-deep transition-colors disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Agregar al catalogo'}
          </button>
        </div>
      )}

      <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
        {cargando ? (
          <div className="py-10 text-center text-slate-400">
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-brand-primary" />
            <p className="mt-2 text-xs">Cargando catalogo...</p>
          </div>
        ) : lista.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">
            {busqueda ? 'Sin resultados para esta busqueda.' : 'Sin medicamentos en el catalogo.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {lista.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => handleSeleccionar(m)}
                  className="w-full text-left rounded-xl px-3 py-2.5 transition-all bg-slate-50 hover:bg-brand-success/10 ring-1 ring-slate-200 hover:ring-brand-success/40"
                >
                  <div className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-700 truncate">{m.nombre}</span>
                    <span className="text-[11px] text-slate-400">
                      {[m.presentacion, m.concentracion].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setMostrarAgregar(true)}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-brand-primary/40 text-brand-primary hover:border-brand-primary hover:bg-brand-primary/5 font-bold text-[11px] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Agregar medicamento nuevo
      </button>
    </PanelModal>
  );
}

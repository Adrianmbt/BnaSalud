import React from 'react';
import { Pill } from 'lucide-react';
import PanelModal from './PanelModal';
import MedicationPanel from './MedicationPanel';

export default function RecetasModal({ abierto, onClose, recetas, onRecetas }) {
  return (
    <PanelModal
      abierto={abierto}
      onClose={onClose}
      id="sp-recetas-modal"
      titulo="Medicamentos / Receta"
      subtitulo="Selecciona medicamentos del catálogo con stock del centro de salud"
      icono={<Pill className="w-5 h-5" />}
    >
      <MedicationPanel recetas={recetas} onRecetas={onRecetas} />
    </PanelModal>
  );
}
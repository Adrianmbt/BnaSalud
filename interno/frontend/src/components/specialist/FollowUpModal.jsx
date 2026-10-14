import React from 'react';
import { Siren } from 'lucide-react';
import PanelModal from './PanelModal';
import EmergencyFollowUpCard from './EmergencyFollowUpCard';

export default function FollowUpModal({ abierto, onClose, consulta, cumplimiento, onCumplimiento, onGuardar }) {
  if (!consulta) return null;
  return (
    <PanelModal
      abierto={abierto}
      onClose={onClose}
      id="sp-followup-modal"
      titulo="Seguimiento del tratamiento de emergencia"
      subtitulo="Verifica si el paciente siguió el tratamiento prescrito por Medicina de Emergencias"
      icono={<Siren className="w-5 h-5 text-red-600" />}
      maxW="max-w-2xl"
    >
      <EmergencyFollowUpCard
        consulta={consulta}
        cumplimiento={cumplimiento}
        onCumplimiento={onCumplimiento}
        onGuardar={onGuardar}
      />
    </PanelModal>
  );
}
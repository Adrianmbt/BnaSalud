import React from 'react';
import { History } from 'lucide-react';
import PanelModal from './PanelModal';
import HistoryPanel from './HistoryPanel';

export default function ConsultasPreviasModal({
  abierto,
  onClose,
  consultasPrevias,
  previasCargando,
  onReSolicitar,
}) {
  return (
    <PanelModal
      abierto={abierto}
      onClose={onClose}
      id="sp-previas-modal"
      titulo="Consultas previas"
      subtitulo="Línea de tiempo del expediente del paciente (Emergencia · Especialista)"
      icono={<History className="w-5 h-5" />}
    >
      <HistoryPanel
        consultasPrevias={consultasPrevias}
        previasCargando={previasCargando}
        onReSolicitar={onReSolicitar}
      />
    </PanelModal>
  );
}
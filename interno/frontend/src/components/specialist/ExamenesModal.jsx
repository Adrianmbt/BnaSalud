import React from 'react';
import { ListChecks } from 'lucide-react';
import PanelModal from './PanelModal';
import ExamOrderPanel from './ExamOrderPanel';

export default function ExamenesModal({ abierto, onClose, examenes, onExamenes }) {
  return (
    <PanelModal
      abierto={abierto}
      onClose={onClose}
      id="sp-examenes-modal"
      titulo="Órdenes de exámenes"
      subtitulo="Laboratorio, imagen y estudios funcionales para esta consulta"
      icono={<ListChecks className="w-5 h-5" />}
    >
      <ExamOrderPanel examenes={examenes} onExamenes={onExamenes} />
    </PanelModal>
  );
}
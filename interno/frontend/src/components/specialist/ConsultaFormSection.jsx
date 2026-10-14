import React from 'react';
import ClinicalFormCard from './ClinicalFormCard';
import TreatmentTabs from './TreatmentTabs';

export default function ConsultaFormSection({
  form,
  setForm,
  recetas,
  onRecetas,
  aplicados,
  onAplicados,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      <ClinicalFormCard form={form} setForm={setForm} />
      <TreatmentTabs
        form={form}
        setForm={setForm}
        recetas={recetas}
        onRecetas={onRecetas}
        aplicados={aplicados}
        onAplicados={onAplicados}
      />
    </div>
  );
}

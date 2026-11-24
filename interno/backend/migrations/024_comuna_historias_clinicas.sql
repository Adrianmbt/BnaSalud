-- Comuna de residencia del paciente (formularios de Recepción).
ALTER TABLE historias_clinicas ADD COLUMN IF NOT EXISTS comuna TEXT;

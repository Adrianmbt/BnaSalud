-- ============================================================
-- Migración: Catálogo de exámenes + Órdenes médicas
-- BnaSalud / CITAB — 2026-09-06
-- Ejecutar en Supabase SQL Editor o psql
-- ============================================================

-- Enum para categorías de examen
DO $$ BEGIN
  CREATE TYPE exam_category_enum AS ENUM ('laboratorio', 'imagen', 'funcional', 'anatomia_patologica');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum para estados de orden/item
DO $$ BEGIN
  CREATE TYPE order_status_enum AS ENUM ('pendiente', 'en_proceso', 'completado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- Tabla: catalogo_examenes
-- Catálogo maestro de exámenes disponibles
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalogo_examenes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    categoria exam_category_enum NOT NULL,
    grupo TEXT NOT NULL,
    nombre_estudio TEXT NOT NULL,
    requiere_ayuno BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (nombre_estudio)
);

CREATE INDEX IF NOT EXISTS idx_catalogo_categoria ON public.catalogo_examenes(categoria);
CREATE INDEX IF NOT EXISTS idx_catalogo_grupo ON public.catalogo_examenes(grupo);
CREATE INDEX IF NOT EXISTS idx_catalogo_activo ON public.catalogo_examenes(activo) WHERE activo = true;

-- ─────────────────────────────────────────────
-- Tabla: ordenes_medicas
-- Encabezado de orden de exámenes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ordenes_medicas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES public.historias_clinicas(id) ON DELETE RESTRICT,
    medico_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    origen_atencion TEXT NOT NULL CHECK (origen_atencion IN ('recepcion', 'emergencia', 'consulta_especialidad')),
    estado order_status_enum DEFAULT 'pendiente',
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_paciente ON public.ordenes_medicas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_medico ON public.ordenes_medicas(medico_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON public.ordenes_medicas(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_origen ON public.ordenes_medicas(origen_atencion);
CREATE INDEX IF NOT EXISTS idx_ordenes_created ON public.ordenes_medicas(created_at DESC);

-- ─────────────────────────────────────────────
-- Tabla: orden_examenes_items
-- Items individuales de una orden (muchos a uno)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orden_examenes_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    orden_id UUID NOT NULL REFERENCES public.ordenes_medicas(id) ON DELETE CASCADE,
    examen_id UUID REFERENCES public.catalogo_examenes(id) ON DELETE SET NULL,
    nombre_examen TEXT NOT NULL,
    categoria exam_category_enum NOT NULL,
    grupo TEXT NOT NULL,
    resultado TEXT,
    estado_item order_status_enum DEFAULT 'pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orden_items_orden ON public.orden_examenes_items(orden_id);
CREATE INDEX IF NOT EXISTS idx_orden_items_examen ON public.orden_examenes_items(examen_id);
CREATE INDEX IF NOT EXISTS idx_orden_items_estado ON public.orden_examenes_items(estado_item);

-- ─────────────────────────────────────────────
-- Trigger: actualizar updated_at automáticamente
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ordenes_medicas_updated_at ON public.ordenes_medicas;
CREATE TRIGGER update_ordenes_medicas_updated_at
    BEFORE UPDATE ON public.ordenes_medicas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orden_items_updated_at ON public.orden_examenes_items;
CREATE TRIGGER update_orden_items_updated_at
    BEFORE UPDATE ON public.orden_examenes_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────
-- Seed: catálogo base de exámenes CITAB
-- ─────────────────────────────────────────────
INSERT INTO public.catalogo_examenes (categoria, grupo, nombre_estudio, requiere_ayuno) VALUES
-- Laboratorio > Hematología
('laboratorio', 'Hematología', 'Hemograma completo', false),
('laboratorio', 'Hematología', 'Plaquetas', false),
('laboratorio', 'Hematología', 'Coagulación (TP/INR/TTPa)', false),
('laboratorio', 'Hematología', 'Fibrinógeno', false),
('laboratorio', 'Hematología', 'Grupo y factor sanguíneo', false),
('laboratorio', 'Hematología', 'VSG (velocidad de sedimentación)', false),
('laboratorio', 'Hematología', 'Reticulocitos', false),
('laboratorio', 'Hematología', 'Electroforesis de hemoglobina', false),
-- Laboratorio > Química sanguínea
('laboratorio', 'Química sanguínea', 'Glucosa en ayunas', true),
('laboratorio', 'Química sanguínea', 'Glucosa postprandial', false),
('laboratorio', 'Química sanguínea', 'Hemoglobina glicosilada (HbA1c)', false),
('laboratorio', 'Química sanguínea', 'Creatinina', false),
('laboratorio', 'Química sanguínea', 'Urea / BUN', false),
('laboratorio', 'Química sanguínea', 'Ácido úrico', false),
('laboratorio', 'Química sanguínea', 'Electrolitos (Na, K, Cl, Ca, Mg, P)', false),
('laboratorio', 'Química sanguínea', 'Perfil hepático (TGO, TGP, GGT, Bilirrubina total y fraccionada, Fosfatasa alcalina)', false),
('laboratorio', 'Química sanguínea', 'Proteínas totales y fraccionadas (Albúmina/Globulina)', false),
('laboratorio', 'Química sanguínea', 'Perfil lipídico (Colesterol total, Triglicéridos, HDL, LDL, VLDL)', true),
('laboratorio', 'Química sanguínea', 'Perfil pancreático (Amilasa, Lipasa)', false),
('laboratorio', 'Química sanguínea', 'Perfil cardíaco (Troponina, CPK, CPK-MB)', false),
('laboratorio', 'Química sanguínea', 'Proteína C reactiva (PCR cuantitativa)', false),
-- Laboratorio > Hormonas y Marcadores
('laboratorio', 'Hormonas y Marcadores', 'Perfil tiroideo (TSH, T3 libre, T4 libre, Anti-TPO)', false),
('laboratorio', 'Hormonas y Marcadores', 'Perfil ginecológico / reproductivo (FSH, LH, Prolactina, Estradiol, Progesterona)', false),
('laboratorio', 'Hormonas y Marcadores', 'Testosterona total y libre', false),
('laboratorio', 'Hormonas y Marcadores', 'Insulina en ayunas / HOMA-IR', true),
('laboratorio', 'Hormonas y Marcadores', 'Cortisol sérico', false),
('laboratorio', 'Hormonas y Marcadores', 'Subunidad Beta HCG (Prueba de embarazo cualitativa/cuantitativa)', false),
('laboratorio', 'Hormonas y Marcadores', 'PSA Total y Libre (Antígeno Prostático Específico)', false),
('laboratorio', 'Hormonas y Marcadores', 'CEA (Antígeno Carcinoembrionario)', false),
('laboratorio', 'Hormonas y Marcadores', 'AFP (Alfa-fetoproteína)', false),
('laboratorio', 'Hormonas y Marcadores', 'CA 125 / CA 19-9 / CA 15-3', false),
-- Laboratorio > Serología
('laboratorio', 'Serología e inmunología', 'VIH (1 y 2 / Antígeno p24)', false),
('laboratorio', 'Serología e inmunología', 'Hepatitis B (HBsAg, Anti-HBs, Anti-HBc)', false),
('laboratorio', 'Serología e inmunología', 'Hepatitis C (Anti-HCV)', false),
('laboratorio', 'Serología e inmunología', 'VDRL / RPR (Sífilis)', false),
('laboratorio', 'Serología e inmunología', 'Dengue (NS1, IgG, IgM)', false),
('laboratorio', 'Serología e inmunología', 'Prueba rápida de Malaria / Gota gruesa', false),
('laboratorio', 'Serología e inmunología', 'Toxoplasmosis (IgG, IgM)', false),
('laboratorio', 'Serología e inmunología', 'Chagas (IgG)', false),
('laboratorio', 'Serología e inmunología', 'Factor reumatoide (FR) / ASTO', false),
-- Laboratorio > Microbiología
('laboratorio', 'Microbiología', 'Urocultivo con antibiograma', false),
('laboratorio', 'Microbiología', 'Hemocultivo', false),
('laboratorio', 'Microbiología', 'Coprocultivo', false),
('laboratorio', 'Microbiología', 'Cultivo de secreción / herida / faríngeo', false),
('laboratorio', 'Microbiología', 'Examen directo en fresco / Coloración Gram', false),
('laboratorio', 'Microbiología', 'Baciloscopia (BK en expectoración)', false),
-- Laboratorio > Orina
('laboratorio', 'Orina', 'Parcial de orina (uroanálisis completo)', false),
('laboratorio', 'Orina', 'Depuración / Aclaramiento de creatinina (24h)', false),
('laboratorio', 'Orina', 'Proteinuria en 24 horas', false),
('laboratorio', 'Orina', 'Microalbuminuria', false),
-- Laboratorio > Heces
('laboratorio', 'Heces', 'Coprológico (parasitológico directo y concentrado)', false),
('laboratorio', 'Heces', 'Sangre oculta en heces (método inmunocromatográfico)', false),
('laboratorio', 'Heces', 'pH y azúcares reductores en heces', false),
-- Laboratorio > Vitaminas
('laboratorio', 'Vitaminas y minerales', 'Vitamina D (25-OH)', false),
('laboratorio', 'Vitaminas y minerales', 'Ferritina', false),
('laboratorio', 'Vitaminas y minerales', 'Hierro sérico / TIBC / Transferrina', false),
('laboratorio', 'Vitaminas y minerales', 'Vitamina B12 / Ácido fólico', false),
-- Laboratorio > Perfiles especiales
('laboratorio', 'Perfil lipídico', 'Perfil lipídico completo (Colesterol total, LDL, HDL, Triglicéridos, VLDL)', true),
('laboratorio', 'Perfil hepático', 'Perfil hepático completo (TGO, TGP, GGT, Bilirrubina total/directa/indirecta, Fosfatasa alcalina, Albúmina)', false),
('laboratorio', 'Perfil renal', 'Perfil renal (Creatinina, BUN, Ácido úrico, FGe, Cistatina C)', false),
('laboratorio', 'Electrolitos', 'Electrolitos séricos (Na⁺, K⁺, Cl⁻, Ca²⁺, Mg²⁺, Fósforo)', false),
-- Imagen > Radiología
('imagen', 'Radiología (Rayos X)', 'Radiografía de tórax (PA / Lateral)', false),
('imagen', 'Radiología (Rayos X)', 'Radiografía de columna (Cervical / Dorsal / Lumbar)', false),
('imagen', 'Radiología (Rayos X)', 'Radiografía de extremidades (Huesos largos / Articulaciones)', false),
('imagen', 'Radiología (Rayos X)', 'Radiografía de abdomen simple', false),
('imagen', 'Radiología (Rayos X)', 'Radiografía de cráneo y senos paranasales', false),
('imagen', 'Radiología (Rayos X)', 'Radiografía de pelvis / Cadera', false),
-- Imagen > TAC
('imagen', 'Tomografía computarizada (TAC)', 'TAC de cráneo (simple / contrastado)', false),
('imagen', 'Tomografía computarizada (TAC)', 'TAC de tórax (alta resolución / contrastado)', false),
('imagen', 'Tomografía computarizada (TAC)', 'TAC de abdomen y pelvis (contrastado)', false),
('imagen', 'Tomografía computarizada (TAC)', 'TAC de columna (Cervical / Lumbar)', false),
('imagen', 'Tomografía computarizada (TAC)', 'AngioTAC', false),
-- Imagen > RM
('imagen', 'Resonancia magnética (RM)', 'RM de encéfalo', false),
('imagen', 'Resonancia magnética (RM)', 'RM de columna (Cervical / Dorsal / Lumbar)', false),
('imagen', 'Resonancia magnética (RM)', 'RM articulaciones (Hombro / Rodilla / Cadera)', false),
('imagen', 'Resonancia magnética (RM)', 'RM abdominal / Pelviana', false),
-- Imagen > Ecografía
('imagen', 'Ecografía', 'Ecografía abdominal superior / completa', false),
('imagen', 'Ecografía', 'Ecografía renal y vías urinarias', false),
('imagen', 'Ecografía', 'Ecografía pélvica / transvaginal', false),
('imagen', 'Ecografía', 'Ecografía obstétrica / Perfil biofísico', false),
('imagen', 'Ecografía', 'Ecografía mamaria', false),
('imagen', 'Ecografía', 'Ecografía tiroidea', false),
('imagen', 'Ecografía', 'Ecografía testicular / prostática', false),
('imagen', 'Ecografía', 'Ecografía doppler arterial / venoso (Miembros inferiores)', false),
('imagen', 'Ecografía', 'Ecografía de tejidos blandos y pared abdominal', false),
-- Funcional > Cardiovascular
('funcional', 'Cardiovascular', 'Electrocardiograma (ECG) de 12 derivaciones', false),
('funcional', 'Cardiovascular', 'Ecocardiograma Doppler transtorácico', false),
('funcional', 'Cardiovascular', 'Prueba de esfuerzo (Ergometría)', false),
('funcional', 'Cardiovascular', 'Monitoreo Holter de ritmo (24 horas)', false),
('funcional', 'Cardiovascular', 'MAPA (Monitoreo Ambulatorio de Presión Arterial 24h)', false),
-- Funcional > Respiratorio
('funcional', 'Respiratorio', 'Espirometría simple y con broncodilatador', false),
('funcional', 'Respiratorio', 'Gasometría arterial', false),
('funcional', 'Respiratorio', 'Oximetría de pulso continuo', false),
-- Funcional > Neurológico
('funcional', 'Neurológico', 'Electroencefalograma (EEG)', false),
('funcional', 'Neurológico', 'Electromiografía (EMG) y velocidad de conducción nerviosa', false),
-- Anatomía patológica
('anatomia_patologica', 'Citología y Biopsias', 'Citología cérvico-vaginal (Papanicolaou)', false),
('anatomia_patologica', 'Citología y Biopsias', 'Citología de líquidos corporales (pleural, ascítico)', false),
('anatomia_patologica', 'Citología y Biopsias', 'Biopsia de piel / tejidos blandos', false),
('anatomia_patologica', 'Citología y Biopsias', 'Biopsia por aspiración con aguja fina (PAAF)', false),
('anatomia_patologica', 'Citología y Biopsias', 'Estudio histopatológico de pieza quirúrgica', false)
ON CONFLICT (nombre_estudio) DO NOTHING;

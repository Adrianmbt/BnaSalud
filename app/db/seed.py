"""Semilla de datos inicial para BnaSalud (Supabase).

Requisitos:
  1. Ejecutar antes supabase/migrations/0001_schema.sql (SQL Editor).
  2. Tener las credenciales en el .env (SUPABASE_URL, SUPABASE_KEY).

Uso:
  venv\\Scripts\\python -m app.db.seed

El script es idempotente: puede re-ejecutarse (upserts).
"""
from __future__ import annotations

from typing import Any

from app.core.database import supabase

ESPECIALIDADES: list[dict[str, Any]] = [
    {"id": 1, "nombre": "Medicina General", "descripcion": "Medicina de familia y prevención.", "icono": "stethoscope"},
    {"id": 2, "nombre": "Pediatría", "descripcion": "Cuidado integral para los más pequeños.", "icono": "child_care"},
    {"id": 3, "nombre": "Ginecología", "descripcion": "Atención ginecológica y obstetricia.", "icono": "female"},
    {"id": 4, "nombre": "Cardiología", "descripcion": "Diagnóstico y tratamiento cardiovascular.", "icono": "cardiology"},
    {"id": 5, "nombre": "Odontología", "descripcion": "Salud bucodental avanzada y estética.", "icono": "dentistry"},
    {"id": 6, "nombre": "Psicología", "descripcion": "Atención en salud mental y bienestar.", "icono": "psychology"},
    {"id": 7, "nombre": "Oncología", "descripcion": "Diagnóstico y tratamiento del cáncer.", "icono": "radiology"},
]

TURNOS: list[dict[str, Any]] = [
    {"nombre": "Guardia 24h", "hora_inicio": "00:00:00", "hora_fin": "23:59:00"},
    {"nombre": "Mañana", "hora_inicio": "07:00:00", "hora_fin": "13:00:00"},
    {"nombre": "Tarde", "hora_inicio": "13:00:00", "hora_fin": "19:00:00"},
]

PACIENTES: list[dict[str, Any]] = [
    {
        "tipo_cedula": "V", "cedula": "18234567", "nombre_completo": "Carlos Mendoza",
        "fecha_nacimiento": "1980-05-12", "telefono": "04141234567", "email": "carlos.mendoza@example.com",
        "tipo_sangre": "O+", "antecedentes_medicos": ["Hipertensión"], "alergias": ["Penicilina"],
        "numero_historia": "HIS-V18234567",
    },
    {
        "tipo_cedula": "V", "cedula": "12345678", "nombre_completo": "María Rodríguez",
        "fecha_nacimiento": "1985-03-22", "telefono": "04141337899", "email": "maria.rodriguez@example.com",
        "tipo_sangre": "A+", "antecedentes_medicos": ["Asma"], "alergias": [],
        "numero_historia": "HIS-V12345678",
    },
    {
        "tipo_cedula": "V", "cedula": "98765432", "nombre_completo": "Juan Pérez",
        "fecha_nacimiento": "1990-11-02", "telefono": "04241411122", "email": "juan.perez@example.com",
        "tipo_sangre": "B-", "antecedentes_medicos": [], "alergias": ["Sulfamidas"],
        "numero_historia": "HIS-V98765432",
    },
    {
        "tipo_cedula": "V", "cedula": "87654321", "nombre_completo": "Ana Rodríguez",
        "fecha_nacimiento": "1995-07-15", "telefono": "04241556677", "email": "ana.rodriguez@example.com",
        "tipo_sangre": "O-", "antecedentes_medicos": ["Diabetes gestacional"], "alergias": [],
        "numero_historia": "HIS-V87654321",
    },
    {
        "tipo_cedula": "V", "cedula": "76543210", "nombre_completo": "Pedro García",
        "fecha_nacimiento": "1978-01-30", "telefono": "04161788990", "email": "pedro.garcia@example.com",
        "tipo_sangre": "AB+", "antecedentes_medicos": ["Dislipidemia"], "alergias": [],
        "numero_historia": "HIS-V76543210",
    },
]

PERSONAL: list[dict[str, Any]] = [
    {"cedula": "11111111", "nombre": "Dr. Antonio", "apellido": "Valera", "especialidad": "Cardiología", "telefono": "+58 414 123 4567", "cargo": "Médico", "status": "EN_GUARDIA", "clinica_id": 2},
    {"cedula": "22222222", "nombre": "Dra. María", "apellido": "González", "especialidad": "Pediatría", "telefono": "+58 414 222 3344", "cargo": "Médico", "status": "DISPONIBLE", "clinica_id": 1},
    {"cedula": "33333333", "nombre": "Dra. Luisa", "apellido": "Pérez", "especialidad": "Ginecología", "telefono": "+58 414 555 6677", "cargo": "Médico", "status": "DISPONIBLE", "clinica_id": 3},
    {"cedula": "44444444", "nombre": "Enf. Carlos", "apellido": "Ruiz", "especialidad": "Enfermería", "telefono": "+58 414 888 9900", "cargo": "Enfermero", "status": "DISPONIBLE", "clinica_id": 2},
    {"cedula": "55555555", "nombre": "Dr. Pedro", "apellido": "Sánchez", "especialidad": "Medicina General", "telefono": "+58 414 111 2233", "cargo": "Médico", "status": "DISPONIBLE", "clinica_id": 4},
    {"cedula": "66666666", "nombre": "Dra. Elena", "apellido": "Gómez", "especialidad": "Oncología", "telefono": "+58 414 444 5566", "cargo": "Médico", "status": "DISPONIBLE", "clinica_id": 4},
    {"cedula": "77777777", "nombre": "Dr. Ramón", "apellido": "Díaz", "especialidad": "Medicina General", "telefono": "+58 414 777 8899", "cargo": "Médico", "status": "DISPONIBLE", "clinica_id": 5},
]

MEDICAMENTOS: list[dict[str, Any]] = [
    {"id": 1, "nombre": "Amoxicilina 500mg", "presentacion": "Cápsula", "concentracion": "500 mg", "categoria": "Antibiótico", "stock_actual": 120, "stock_minimo": 30, "unidad": "unidad", "unidad_medida": "unidad"},
    {"id": 2, "nombre": "Paracetamol 500mg", "presentacion": "Tableta", "concentracion": "500 mg", "categoria": "Analgésico", "stock_actual": 300, "stock_minimo": 50, "unidad": "unidad", "unidad_medida": "unidad"},
    {"id": 3, "nombre": "Ibuprofeno 400mg", "presentacion": "Tableta", "concentracion": "400 mg", "categoria": "Antiinflamatorio", "stock_actual": 200, "stock_minimo": 40, "unidad": "unidad", "unidad_medida": "unidad"},
    {"id": 4, "nombre": "Enalapril 10mg", "presentacion": "Tableta", "concentracion": "10 mg", "categoria": "Antihipertensivo", "stock_actual": 90, "stock_minimo": 20, "unidad": "unidad", "unidad_medida": "unidad"},
    {"id": 5, "nombre": "Metformina 850mg", "presentacion": "Tableta", "concentracion": "850 mg", "categoria": "Antidiabético", "stock_actual": 150, "stock_minimo": 30, "unidad": "unidad", "unidad_medida": "unidad"},
    {"id": 6, "nombre": "Salbutamol 100mcg", "presentacion": "Inhalador", "concentracion": "100 mcg", "categoria": "Broncodilatador", "stock_actual": 40, "stock_minimo": 10, "unidad": "inhalador", "unidad_medida": "inhalador"},
    {"id": 7, "nombre": "Losartán 50mg", "presentacion": "Tableta", "concentracion": "50 mg", "categoria": "Antihipertensivo", "stock_actual": 110, "stock_minimo": 25, "unidad": "unidad", "unidad_medida": "unidad"},
    {"id": 8, "nombre": "Vitamina C 500mg", "presentacion": "Tableta", "concentracion": "500 mg", "categoria": "Suplemento", "stock_actual": 500, "stock_minimo": 80, "unidad": "unidad", "unidad_medida": "unidad"},
]

CITAS: list[dict[str, Any]] = [
    {"centro_id": 2, "centro_salud": "Clínica de los Trabajadores (CITAB)", "especialidad": "Cardiología", "especialidad_id": 4, "fecha_cita": "2026-08-15", "hora_inicio": "08:30:00", "motivo": "Control cardiovascular", "origen": "cita_web", "estado": "pendiente", "codigo_confirmacion": "CITAB-2026-89A1"},
    {"centro_id": 2, "centro_salud": "Clínica de los Trabajadores (CITAB)", "especialidad": "Medicina General", "especialidad_id": 1, "fecha_cita": "2026-08-16", "hora_inicio": "10:00:00", "motivo": "Chequeo de rutina", "origen": "cita_web", "estado": "confirmada", "codigo_confirmacion": "CITAB-2026-8B2C"},
    {"centro_id": 1, "centro_salud": "Clínica del Niño", "especialidad": "Pediatría", "especialidad_id": 2, "fecha_cita": "2026-08-17", "hora_inicio": "09:15:00", "motivo": "Control pediátrico", "origen": "cita_web", "estado": "pendiente", "codigo_confirmacion": "NINO-2026-3C4D"},
]

RECETAS: list[dict[str, Any]] = [
    {"codigo_receta": "RX-2026-0892", "paciente_cedula": "V-18234567", "paciente_nombre": "Carlos Mendoza", "medico": "Dr. Antonio Valera", "estado": "PENDIENTE", "clinica_id": 2},
    {"codigo_receta": "RX-2026-0893", "paciente_cedula": "V-98765432", "paciente_nombre": "Juan Pérez", "medico": "Dra. María González", "estado": "DESPACHADA", "clinica_id": 1},
]

CONSULTAS: list[dict[str, Any]] = [
    {
        "id": "11111111-2222-3333-4444-555555555555",
        "cita_id": "CITAB-2026-89A1",
        "especialidad": "Cardiología",
        "medico_nombre": "Dr. Antonio Valera",
        "motivo_consulta": "Cefalea constante de 3 días",
        "examen_fisico": "Presión arterial 130/85. Paciente consciente, orientado.",
        "cie10_codigo": "I10",
        "cie10_descripcion": "Hipertensión esencial (primaria)",
        "tratamiento": "Enalapril 10mg cada 12 hrs",
        "recomendaciones": "Reposo por 48 hrs y baja ingesta de sal",
        "recetas": [{"nombre": "Enalapril 10mg", "posologia": "1 tableta cada 12 horas por 30 días"}],
        "laboratorios": [{"parametro": "Hemoglobina", "valor": "14.2 g/dL"}],
        "comprobante_ref": "ABH-99281",
    },
    {
        "id": "22222222-3333-4444-5555-666666666666",
        "cita_id": "NINO-2026-3C4D",
        "especialidad": "Pediatría",
        "medico_nombre": "Dra. María González",
        "motivo_consulta": "Control de crecimiento",
        "examen_fisico": "Peso y talla acordes a la edad. Sin hallazgos.",
        "cie10_codigo": "Z00.1",
        "cie10_descripcion": "Examen de salud de rutina del niño sano",
        "tratamiento": "Esquema de vacunación al día",
        "recomendaciones": "Próxima consulta en 3 meses",
        "recetas": [],
        "laboratorios": [],
        "comprobante_ref": "ABH-99290",
    },
]


def upsert(tabla: str, filas: list[dict[str, Any]], on_conflict: str) -> None:
    if not filas:
        return
    res = supabase.table(tabla).upsert(filas, on_conflict=on_conflict).execute()
    print(f"  {tabla:<18} {len(res.data)} filas")

def get_ids(tabla: str, cols: list[str]) -> list[dict[str, Any]]:
    res = supabase.table(tabla).select(",".join(cols)).execute()
    return res.data or []

def main() -> None:
    print("Semilla BnaSalud\n")

    print("[1/9] Turnos (RRHH)")
    try:
        existentes = supabase.table("turnos").select("id").limit(1).execute().data
        if not existentes:
            supabase.table("turnos").insert(TURNOS).execute()
            print(f"  turnos             {len(TURNOS)} filas")
        else:
            print("  turnos             ya existentes")
    except Exception as e:
        print("  turnos             ERROR:", e)

    print("[2/9] Especialidades")
    upsert("especialidades", ESPECIALIDADES, "id")

    print("[3/9] Medicamentos (inventario_medicamentos)")
    upsert("inventario_medicamentos", MEDICAMENTOS, "nombre")
    medicamentos_por_nombre = {
        m["nombre"]: m["id"] for m in get_ids("inventario_medicamentos", ["id", "nombre"])
    }

    print("[4/9] Personal (RRHH / médicos)")
    upsert("personal", PERSONAL, "cedula")
    personal_por_nombre = {
        f"{p['nombre']} {p['apellido']}": p["id"]
        for p in get_ids("personal", ["id", "nombre", "apellido"])
    }

    print("[5/9] Pacientes (historias_clinicas)")
    upsert("historias_clinicas", PACIENTES, "cedula")
    pacientes_por_cedula = {p["cedula"]: p["id"] for p in get_ids("historias_clinicas", ["id", "cedula"])}

    print("[6/9] Citas")
    paciente_por_cita = {
        "CITAB-2026-89A1": "18234567",
        "CITAB-2026-8B2C": "98765432",
        "NINO-2026-3C4D": "12345678",
    }
    citas: list[dict[str, Any]] = []
    for cita in CITAS:
        fila = dict(cita)
        fila["paciente_id"] = pacientes_por_cedula[paciente_por_cita[cita["codigo_confirmacion"]]]
        citas.append(fila)
    upsert("citas", citas, "codigo_confirmacion")

    print("[7/9] Recetas")
    recetas: list[dict[str, Any]] = []
    for receta in RECETAS:
        fila = dict(receta)
        fila["medico_id"] = personal_por_nombre[receta["medico"]]
        recetas.append(fila)
    upsert("recetas", recetas, "codigo_receta")
    recetas_por_codigo = {r["codigo_receta"]: r["id"] for r in get_ids("recetas", ["id", "codigo_receta"])}

    print("[8/9] Detalles de recetas")
    detalles = [
        {"id": 901, "receta_id": recetas_por_codigo["RX-2026-0892"], "medicamento_id": medicamentos_por_nombre["Amoxicilina 500mg"],
         "cantidad_prescrita": 21, "cantidad_despachada": 0,
         "posologia": "1 cápsula cada 8 horas por 7 días"},
        {"id": 902, "receta_id": recetas_por_codigo["RX-2026-0893"], "medicamento_id": medicamentos_por_nombre["Paracetamol 500mg"],
         "cantidad_prescrita": 20, "cantidad_despachada": 20,
         "posologia": "1 tableta cada 6 horas por 5 días"},
    ]
    upsert("receta_detalles", detalles, "id")

    print("[9/9] Consultas (historial clínico)")
    paciente_por_consulta = {
        "CITAB-2026-89A1": "18234567",
        "NINO-2026-3C4D": "12345678",
    }
    consultas: list[dict[str, Any]] = []
    for consulta in CONSULTAS:
        fila = dict(consulta)
        fila["paciente_id"] = pacientes_por_cedula[paciente_por_consulta[consulta["cita_id"]]]
        fila["medico_id"] = personal_por_nombre[consulta["medico_nombre"]]
        consultas.append(fila)
    upsert("consultas", consultas, "id")

    print("\nSemilla completada.")


if __name__ == "__main__":
    main()

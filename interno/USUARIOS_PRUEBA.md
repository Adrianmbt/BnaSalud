# Usuarios de Prueba — BnaSalud Multi-Centro

Todos los usuarios tienen contraseña: **`test123`**

---

## 🏥 Red de Salud (General)

| Usuario | Contraseña | Rol | Nombre | Centro |
|---------|-----------|-----|--------|--------|
| `director` | director123 | Director | Adolfo Farias | General (todas las clínicas) |

---

## 🔵 CITAB — Clínica Integral de Alta Tecnología de Barcelona

| Usuario | Contraseña | Rol | Nombre | Especialidad |
|---------|-----------|-----|--------|-------------|
| `rec_citab` | test123 | Recepcionista | Recepcionista CITAB | — |
| `med_citab` | test123 | Médico | Doctor CITAB | Medicina General |
| `farm_citab` | test123 | Jefe de Farmacia | Farmacia CITAB | — |

![Logo CITAB](../frontend/public/identidad/Citab.jpeg)

---

## 🩷 Clínica Integral de la Mujer (CMUJER)

| Usuario | Contraseña | Rol | Nombre | Especialidad |
|---------|-----------|-----|--------|-------------|
| `rec_cmujer` | test123 | Recepcionista | Recepcionista CMUJER | — |
| `med_cmujer` | test123 | Médico | Doctora CMUJER | Ginecología |
| `farm_cmujer` | test123 | Jefe de Farmacia | Farmacia CMUJER | — |

![Logo CMUJER](../frontend/public/identidad/CliMujer.jpeg)

---

## 🟠 Clínica Integral de los Niños (CNINOS)

| Usuario | Contraseña | Rol | Nombre | Especialidad |
|---------|-----------|-----|--------|-------------|
| `rec_cinos` | test123 | Recepcionista | Recepcionista CNINOS | — |
| `med_cinos` | test123 | Médico | Doctora CNINOS | Pediatría |
| `farm_cinos` | test123 | Jefe de Farmacia | Farmacia CNINOS | — |

![Logo CNINOS](../frontend/public/identidad/CliNiño.jpeg)

---

## 🔵 Clínica Municipal CAP José Pérez Fernández (CAPJPF)

| Usuario | Contraseña | Rol | Nombre | Especialidad |
|---------|-----------|-----|--------|-------------|
| `rec_capjpf` | test123 | Recepcionista | Recepcionista CAPJPF | — |
| `med_capjpf` | test123 | Médico | Doctor CAPJPF | Medicina General |
| `farm_capjpf` | test123 | Jefe de Farmacia | Farmacia CAPJPF | — |

![Logo CAPJPF](../frontend/public/identidad/ClinicaMunicipalJosePerezFernandez.jpeg)

---

## 🟣 Casa del Adulto Mayor (CAMAYOR)

| Usuario | Contraseña | Rol | Nombre | Especialidad |
|---------|-----------|-----|--------|-------------|
| `rec_camayor` | test123 | Recepcionista | Recepcionista CAMAYOR | — |
| `med_camayor` | test123 | Médico | Doctora CAMAYOR | Gerontología |
| `farm_camayor` | test123 | Jefe de Farmacia | Farmacia CAMAYOR | — |

![Logo CAMAYOR](../frontend/public/identidad/CasaAbuelo.jpeg)

---

## 🩵 Oncológico Maruja Clavier (OMARUJA)

| Usuario | Contraseña | Rol | Nombre | Especialidad |
|---------|-----------|-----|--------|-------------|
| `rec_omaruja` | test123 | Recepcionista | Recepcionista OMARUJA | — |
| `med_omaruja` | test123 | Médico | Doctor OMARUJA | Oncología |
| `farm_omaruja` | test123 | Jefe de Farmacia | Farmacia OMARUJA | — |

![Logo OMARUJA](../frontend/public/identidad/Oncologico.jpeg)

---

## Imágenes de Identidad Visual

| Centro | Archivo |
|--------|---------|
| General (Instituto de Salud) | `InstitutoSalud.jpeg` |
| CITAB | `Citab.jpeg` |
| Clínica de la Mujer | `CliMujer.jpeg` |
| Clínica del Niño | `CliNiño.jpeg` |
| CAPJPF | `ClinicaMunicipalJosePerezFernandez.jpeg` |
| Adulto Mayor | `CasaAbuelo.jpeg` |
| Oncológico | `Oncologico.jpeg` |
| Eventos (Jornadas) | `JornadasSaludBna.jpeg` |
| Sin asignar | `SBna.jpeg` |

---

## Notas

- **Contraseña universal:** `test123` (hash bcrypt: `$2b$12$Uykz7zIfyRznEDXncGCFm.9lZJT6hKy88ygxbXunaywNR1q0.oNi.`)
- **Médicos especialistas** solo ven la interfaz de especialista
- **Recepcionistas** ven la interfaz de recepción con cola de pacientes
- **Jefes de farmacia** ven la interfaz de inventario
- **Director** ve el dashboard ejecutivo con KPIs de todos los centros
- El login resuelve el `clinica_id` automáticamente y aplica el tema visual del centro

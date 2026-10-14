# Dashboard Ejecutivo — Estructura Actual

## Layout General

```
┌──────────────────────┬──────────────────────────────────────────┐
│                      │ HEADER (sticky)                          │
│  SIDEBAR             │ ┌──────────────────────────────────────┐ │
│  (navegación)        │ │ Dashboard Ejecutivo        [Actualizar]│ │
│                      │ │ [KPI] [KPI] [KPI] [KPI] [KPI] [KPI] │ │
│  ─────────────────── │ └──────────────────────────────────────┘
│  Secciones           ├──────────────────────────────────────────┤
│  ├─ Rendimiento Médico│                                         │
│  │  ├─ General       │  CONTENIDO                               │
│  │  ├─ CITAB         │  (según sección + centro seleccionado)   │
│  │  ├─ Clín. Mujer   │                                         │
│  │  ├─ Clín. Niños   │                                         │
│  │  ├─ Oncológico    │                                         │
│  │  ├─ Adulto Mayor  │                                         │
│  │  └─ Jornadas      │                                         │
│  ├─ Pacientes & Flujo│                                         │
│  │  └─ (mismos)      │                                         │
│  ├─ Inventario       │                                         │
│  │  └─ (mismos)      │                                         │
│  ─────────────────── │                                         │
│  User Info           ├──────────────────────────────────────────┤
│  [Cerrar Sesión]     │ FOOTER                                   │
└──────────────────────┴──────────────────────────────────────────┘
```

## Componentes

### `ExecutiveAdminDashboard.jsx`
- **Ruta:** `/director` (rol `director`)
- **Estado:** `activeSection`, `selectedCentro`, `summary`, `medicoData`
- **Datos:** carga `/dashboard/summary` + `/dashboard/medicos` al montar
- **Header:** 6 KPI cards + botón Actualizar
- **Contenido:** renderiza sección según `activeSection` + `selectedCentro`

### `DirectorSidebar.jsx`
- **Secciones expandibles:** cada sección tiene submenú con 7 centros de salud
- **Centros:** General, CITAB, Clínica Mujer, Clínica Niños, Oncológico, Adulto Mayor, Jornadas
- **Colapsable:** modo compacto (72px) / expandido (256px)
- **Accesibilidad:** `aria-expanded`, `aria-current`, `role="menu"`, `role="menuitem"`

### `MedicalKpiTab.jsx`
- **Gráficos (3 columnas):**
  1. Top 5 Motivos de Consulta (bar horizontal)
  2. Consultas por Especialidad (pie chart)
  3. Consultas por Hora del Día (bar vertical)
- **Endpoint:** `GET /dashboard/medicos`

### `PatientKpiTab.jsx`
- **Gráficos (2x2):**
  1. Distribución de Pacientes (pie chart)
  2. Ruta de Atención: Emergencia vs Cita (bar)
  3. Eficiencia de Asistencia (bar)
  4. Pacientes por Clínica (bar horizontal)
  5. Resumen de Eficiencia (texto: % asistencia, cancelados, no-show)
- **Endpoint:** `GET /dashboard/pacientes`

### `InventoryKpiTab.jsx`
- **Alertas:**
  1. Alertas de Stock Bajo — Medicamentos (lista scrollable)
  2. Alertas de Stock Bajo — Insumos (lista scrollable)
  3. Lotes Vencidos y por Vencer (lista scrollable)
- **Gráficos:**
  4. Medicamentos más Aplicados en Consultas (bar horizontal)
  5. Movimientos de Inventario — Últimos 30 Días (bar)
- **Endpoint:** `GET /dashboard/inventario`

### `CentroConstruccion.jsx`
- **Se muestra:** cuando `selectedCentro` no está en `CENTROS_CON_DATOS`
- **Contenido:** nombre del centro, badge "Centro en Construcción", descripción, placeholders

## Centros de Salud

| ID | Nombre | Estado |
|----|--------|--------|
| `general` | General (Todas las Sedes) | ✅ Con datos |
| `citab` | CITAB | ✅ Con datos |
| `clinica_mujer` | Clínica Integral de la Mujer | 🔨 En construcción |
| `clinica_ninos` | Clínica Integral de los Niños | 🔨 En construcción |
| `oncologico` | Oncológico Maruja Clavier | 🔨 En construcción |
| `adulto_mayor` | Casa del Adulto Mayor | 🔨 En construcción |
| `jornadas` | Jornadas Médico Asistencial | 🔨 En construcción |

## Endpoints del Dashboard

### `GET /dashboard/summary`
KPIs ejecutivos para las tarjetas del header.

**Respuesta:**
```json
{
  "consultas_hoy": 12,
  "pacientes_en_cola": 5,
  "consultas_semana": 67,
  "meds_stock_bajo": 3,
  "ins_stock_bajo": 2,
  "lotes_vencidos": 1,
  "lotes_por_vencer": 4
}
```

### `GET /dashboard/medicos`
Rendimiento médico. Soporta `start_date`, `end_date`, `medico_id`.

**Respuesta:**
```json
{
  "total_consultas": 150,
  "duracion_promedio_min": 18.5,
  "top_diagnosticos": [...],
  "tasa_remision": 12.3,
  "top_motivos": [
    { "motivo": "Dolor abdominal", "total": 25 },
    { "motivo": "Fiebre", "total": 18 }
  ],
  "por_especialidad": [...],
  "consultas_por_hora": [
    { "hora": 8, "total": 15 },
    { "hora": 9, "total": 22 }
  ]
}
```

### `GET /dashboard/pacientes`
Demografía y flujo de pacientes. Soporta `start_date`, `end_date`.

**Respuesta:**
```json
{
  "total_procesados": 45,
  "por_categoria": [...],
  "por_ruta": [...],
  "eficiencia_asistencia": [...],
  "cola_actual": [...],
  "por_clinica": [...]
}
```

### `GET /dashboard/inventario`
Inventario, alertas de stock y vencimiento.

**Respuesta:**
```json
{
  "medicamentos_stock_bajo": [...],
  "insumos_stock_bajo": [...],
  "lotes_vencidos": [...],
  "lotes_por_vencer": [...],
  "meds_aplicados": [...],
  "movimientos_30d": [...],
  "stock_total_medicamentos": 1200,
  "stock_total_insumos": 340
}
```

## Diseño Visual

- **Tema:** Light (blanco/gris claro)
- **Brand colors:** `#3B98D4` (primario), `#1A4B7C` (profundo), `#38B000` (éxito)
- **Fuentes:** Manrope (body), Sora (display), Fraunces (charts)
- **Componentes:** bordes `border-slate-200`, sombras `shadow-sm`, bordes redondeados `rounded-xl`
- **Accesibilidad:** `role`, `aria-label`, `aria-current`, `sr-only`, `focus-visible:ring`

## Archivos

```
frontend/src/
├── pages/
│   └── ExecutiveAdminDashboard.jsx    # Página principal del director
├── components/dashboard/
│   ├── DirectorSidebar.jsx            # Sidebar con secciones expandibles
│   ├── MedicalKpiTab.jsx              # Gráficos rendimiento médico
│   ├── PatientKpiTab.jsx              # Gráficos pacientes y flujo
│   ├── InventoryKpiTab.jsx            # Alertas y gráficos inventario
│   ├── CentroConstruccion.jsx         # Placeholder centros sin datos
│   └── ProximamenteCard.jsx           # (legado, sin usar)
```

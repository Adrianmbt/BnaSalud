# Design Spec: Farmacia e Insumos — BnaSalud Interno

**Date:** 2026-09-17
**Status:** Approved
**Scope:** Phase 1 of 3 (Farmacia → Admin Sistema → Admin Dashboard)

---

## 1. Purpose

Build a dedicated **Farmacia e Insumos** interface for the `jefe_farmacia` role. The system currently has pharmacy API endpoints but no dedicated UI. This interface manages medication and supply inventory with batch tracking and expiration dates.

**Who uses it:** Pharmacy manager (`jefe_farmacia`) — single role, full access.

---

## 2. Aesthetic Direction

**Tone:** Industrial/functional — dense data interface with visual stock and expiration indicators.

**Color palette:**
- Background: `#0f1117` (near-black)
- Cards/surfaces: `#1a1d27` (dark gray)
- Primary accent: `#f97316` (orange) — actions, active states
- Stock OK: `#22c55e` (green)
- Stock low: `#eab308` (yellow/amber)
- Stock critical / expired: `#ef4444` (red)
- Text primary: `#f1f5f9`
- Text secondary: `#94a3b8`

**Typography:**
- Numbers/stock values: `JetBrains Mono` (monospace for alignment)
- Labels/body: `DM Sans`

**Layout:** Sidebar navigation + main content area. Dense data tables with color-coded status badges.

---

## 3. Architecture

### 3.1 Frontend Components

```
frontend/src/
├── pages/
│   └── FarmaciaInterface.jsx          # Top-level (role === 'farmacia')
├── components/farmacia/
│   ├── FarmaciaSidebar.jsx            # Left sidebar navigation
│   ├── FarmaciaDashboard.jsx          # KPI cards + charts
│   ├── MedicamentosSection.jsx        # Medications CRUD table
│   ├── InsumosSection.jsx             # Supplies CRUD table
│   ├── LotesSection.jsx               # Batch management
│   ├── MovimientosSection.jsx         # Movement history
│   ├── MedicamentoFormModal.jsx       # Add/edit medication modal
│   ├── InsumoFormModal.jsx            # Add/edit supply modal
│   ├── LoteFormModal.jsx              # Add/edit batch modal
│   ├── MovimientoFormModal.jsx        # Register movement modal
│   └── FarmaciaCharts.jsx            # Recharts components
```

### 3.2 Routing

Add `farmacia` to `MODULOS_INTERNOS` in `auth.py`:
```python
"farmacia": "farmacia"
```

Add to `App.jsx`:
```jsx
if (currentRole === 'farmacia') return <FarmaciaInterface />
```

### 3.3 Database Changes

#### New table: `lotes`
```sql
CREATE TABLE lotes (
    id SERIAL PRIMARY KEY,
    codigo_lote VARCHAR(50) NOT NULL,
    medicamento_id INTEGER REFERENCES medicamentos_catalogo(id),
    insumo_id INTEGER REFERENCES insumos_catalogo(id),
    cantidad INTEGER NOT NULL DEFAULT 0,
    fecha_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (medicamento_id IS NOT NULL OR insumo_id IS NOT NULL)
);
```

#### New table: `movimientos_inventario`
```sql
CREATE TABLE movimientos_inventario (
    id SERIAL PRIMARY KEY,
    lote_id INTEGER REFERENCES lotes(id),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
    cantidad INTEGER NOT NULL,
    observacion TEXT,
    creado_por INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### New table: `insumos_catalogo`
```sql
CREATE TABLE insumos_catalogo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    unidad VARCHAR(50) NOT NULL DEFAULT 'pieza',
    stock_actual INTEGER DEFAULT 0,
    stock_minimo INTEGER DEFAULT 10,
    creado_por INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Modify: `medicamentos_catalogo`
Add columns:
```sql
ALTER TABLE medicamentos_catalogo ADD COLUMN stock_actual INTEGER DEFAULT 0;
ALTER TABLE medicamentos_catalogo ADD COLUMN stock_minimo INTEGER DEFAULT 10;
ALTER TABLE medicamentos_catalogo ADD COLUMN categoria VARCHAR(50) DEFAULT 'MEDICAMENTO';
```

### 3.4 Backend Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/farmacia/dashboard` | KPIs: total meds, total supplies, low stock count, expiring soon, expired |
| GET | `/farmacia/medicamentos` | List medications (search, filter by stock status) |
| POST | `/farmacia/medicamentos` | Create medication |
| PUT | `/farmacia/medicamentos/{id}` | Update medication |
| DELETE | `/farmacia/medicamentos/{id}` | Soft-delete medication |
| GET | `/farmacia/insumos` | List supplies |
| POST | `/farmacia/insumos` | Create supply |
| PUT | `/farmacia/insumos/{id}` | Update supply |
| DELETE | `/farmacia/insumos/{id}` | Soft-delete supply |
| GET | `/farmacia/lotes` | List batches (filter by product, expiration status) |
| POST | `/farmacia/lotes` | Create batch (auto-updates product stock) |
| PUT | `/farmacia/lotes/{id}` | Update batch |
| GET | `/farmacia/lotes/proximos-vencer` | Batches expiring within 30 days |
| GET | `/farmacia/movimientos` | Movement history (filter by date range, type, product) |
| POST | `/farmacia/movimientos` | Register movement (updates batch stock) |

### 3.5 Seed Data

Create test user:
```
username: farmacia
password: farmacia123
rol: jefe_farmacia
nombre: Maria
apellido: Gonzalez
```

Seed 15-20 medications and 10-15 supplies with varied stock levels and expiration dates (some expired, some expiring soon, some OK).

---

## 4. Component Details

### 4.1 FarmaciaDashboard

**KPI Cards (top row):**
| Card | Value | Icon | Color |
|------|-------|------|-------|
| Total Medicamentos | count | Pill | Blue |
| Total Insumos | count | Box | Purple |
| Stock Bajo | count | AlertTriangle | Yellow |
| Por Vencer (30 días) | count | Clock | Orange |
| Vencidos | count | XCircle | Red |

**Charts row:**
- Bar chart: Stock by category (Recharts `BarChart`)
- Line chart: Movements last 30 days (Recharts `LineChart`)

**Bottom:** Table — Top 10 items with lowest stock ratio (stock_actual / stock_minimo).

### 4.2 MedicamentosSection / InsumosSection

**Table columns:**
| Column | Width | Notes |
|--------|-------|-------|
| Nombre | auto | Bold text |
| Presentación | 120px | e.g., "Tabletas 500mg" |
| Concentración | 100px | |
| Stock | 80px | Monospace, color-coded |
| Mínimo | 80px | Monospace |
| Estado | 100px | Badge: OK/Bajo/Crítico |
| Vencimiento | 120px | Nearest batch expiration |
| Acciones | 100px | Edit, Delete buttons |

**Filters bar:** Search input, stock status dropdown (Todos/OK/Bajo/Crítico), "Agregar" button.

**Status logic:**
- `stock_actual >= stock_minimo * 1.5` → ✅ OK (green)
- `stock_actual >= stock_minimo` → ⚠️ Bajo (yellow)
- `stock_actual < stock_minimo` → 🔴 Crítico (red)

### 4.3 LotesSection

**Table columns:**
| Column | Notes |
|--------|-------|
| Código Lote | Bold |
| Producto | Medication or supply name |
| Tipo | MEDICAMENTO / INSUMO badge |
| Cantidad | Monospace |
| Fecha Entrada | Date format DD/MM/YYYY |
| Vencimiento | Date format, color-coded |
| Estado | Vigente / Por Vencer / Vencido badge |
| Acciones | Edit, Registrar salida |

**Expiration badges:**
- `> 60 days` → ✅ Vigente (green)
- `30-60 days` → ⚠️ Por Vencer (yellow)
- `< 30 days` → 🔴 Urgente (red)
- `< 0 days` → ❌ Vencido (dark red)

### 4.4 MovimientosSection

**Filters:** Date range picker, type dropdown (Todos/Entrada/Salida/Ajuste), product search.

**Table columns:** Fecha, Tipo (badge), Producto, Lote, Cantidad, Registrado por, Observación.

---

## 5. Visual Reference

Inspired by industrial monitoring dashboards. Dense data, color-coded status indicators, monospace numbers for alignment. Think "control room" aesthetic — functional, information-dense, no wasted space.

---

## 6. Acceptance Criteria

- [ ] `jefe_farmacia` role can log in and see FarmaciaInterface
- [ ] Dashboard shows real KPI counts from database
- [ ] Medications CRUD works (create, read, update, delete)
- [ ] Supplies CRUD works
- [ ] Batches can be created with expiration dates
- [ ] Creating a batch auto-updates product stock
- [ ] Registering a movement updates batch stock
- [ ] Stock status badges show correct colors
- [ ] Expiration badges show correct colors
- [ ] Charts render with real data
- [ ] Search and filters work on all sections
- [ ] Test user `farmacia/farmacia123` can log in

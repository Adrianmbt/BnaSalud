# Farmacia e Insumos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Farmacia e Insumos interface for the `jefe_farmacia` role with inventory management, batch tracking, expiration dates, and dashboard with charts.

**Architecture:** React + Vite frontend with role-based routing, FastAPI backend with new endpoints, PostgreSQL tables for batches and movements. Recharts for dashboard visualizations.

**Tech Stack:** React 18, Vite, Tailwind CSS, Recharts, FastAPI, SQLAlchemy async, PostgreSQL, asyncpg

**Spec:** `docs/superpowers/specs/2026-09-17-farmacia-insumos-design.md`

## Global Constraints

- Frontend: React 18 + Vite + Tailwind CSS 3
- Backend: FastAPI + SQLAlchemy 2.0 async + asyncpg
- Database: PostgreSQL (base `bnasalud`, user `postgres`, password `19674244`, port 5432)
- Backend runs on port 8000, frontend dev on port 3000, Vite proxies `/api` → `localhost:8000`
- No React Router — role-based conditional rendering in App.jsx
- Auth: JWT tokens (HS256, 8-hour expiry)
- Existing router prefix: `/farmacia` already exists in `backend/app/api/v1/router.py`

---

## File Structure

### Backend (new/modified)
| File | Action | Purpose |
|------|--------|---------|
| `backend/app/models/farmacia.py` | Create | SQLAlchemy models: Lote, MovimientoInventario, InsumoCatalogo |
| `backend/app/schemas/farmacia.py` | Create | Pydantic schemas for all farmacia endpoints |
| `backend/app/api/v1/endpoints/farmacia.py` | Modify | Add new endpoints (dashboard, lotes, movimientos, insumos) |
| `backend/app/api/v1/router.py` | Modify | Ensure `/farmacia` prefix includes new endpoints |
| `backend/seed_farmacia.py` | Create | Seed script for test user + sample data |
| `backend/create_tables_farmacia.py` | Create | SQL script for new tables |

### Frontend (new/modified)
| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/pages/FarmaciaInterface.jsx` | Create | Top-level farmacia page |
| `frontend/src/components/farmacia/FarmaciaSidebar.jsx` | Create | Sidebar navigation |
| `frontend/src/components/farmacia/FarmaciaDashboard.jsx` | Create | KPI cards + charts |
| `frontend/src/components/farmacia/MedicamentosSection.jsx` | Create | Medications CRUD table |
| `frontend/src/components/farmacia/InsumosSection.jsx` | Create | Supplies CRUD table |
| `frontend/src/components/farmacia/LotesSection.jsx` | Create | Batch management |
| `frontend/src/components/farmacia/MovimientosSection.jsx` | Create | Movement history |
| `frontend/src/components/farmacia/MedicamentoFormModal.jsx` | Create | Add/edit medication modal |
| `frontend/src/components/farmacia/InsumoFormModal.jsx` | Create | Add/edit supply modal |
| `frontend/src/components/farmacia/LoteFormModal.jsx` | Create | Add/edit batch modal |
| `frontend/src/components/farmacia/MovimientoFormModal.jsx` | Create | Register movement modal |
| `frontend/src/App.jsx` | Modify | Add `farmacia` role routing |
| `frontend/package.json` | Modify | Add `recharts` dependency |

---

## Tasks

### Task 1: Database Schema — New Tables

**Files:**
- Create: `backend/create_tables_farmacia.py`

**Interfaces:**
- Produces: SQL execution script that creates `lotes`, `movimientos_inventario`, `insumos_catalogo` tables and alters `medicamentos_catalogo`

- [ ] **Step 1: Create the SQL migration script**

```python
# backend/create_tables_farmacia.py
"""Create pharmacy extension tables: lotes, movimientos_inventario, insumos_catalogo"""
import asyncio
from app.core.database import engine

SQL = """
-- New table: insumos_catalogo
CREATE TABLE IF NOT EXISTS insumos_catalogo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    unidad VARCHAR(50) NOT NULL DEFAULT 'pieza',
    stock_actual INTEGER DEFAULT 0,
    stock_minimo INTEGER DEFAULT 10,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- New table: lotes
CREATE TABLE IF NOT EXISTS lotes (
    id SERIAL PRIMARY KEY,
    codigo_lote VARCHAR(50) NOT NULL,
    medicamento_id INTEGER REFERENCES medicamentos_catalogo(id) ON DELETE SET NULL,
    insumo_id INTEGER REFERENCES insumos_catalogo(id) ON DELETE SET NULL,
    cantidad INTEGER NOT NULL DEFAULT 0,
    cantidad_inicial INTEGER NOT NULL DEFAULT 0,
    fecha_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (medicamento_id IS NOT NULL OR insumo_id IS NOT NULL)
);

-- New table: movimientos_inventario
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id SERIAL PRIMARY KEY,
    lote_id INTEGER REFERENCES lotes(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
    cantidad INTEGER NOT NULL,
    observacion TEXT,
    creado_por VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alter medicamentos_catalogo: add stock columns
ALTER TABLE medicamentos_catalogo ADD COLUMN IF NOT EXISTS stock_actual INTEGER DEFAULT 0;
ALTER TABLE medicamentos_catalogo ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 10;
ALTER TABLE medicamentos_catalogo ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'MEDICAMENTO';
ALTER TABLE medicamentos_catalogo ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lotes_medicamento ON lotes(medicamento_id);
CREATE INDEX IF NOT EXISTS idx_lotes_insumo ON lotes(insumo_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_movimientos_lote ON movimientos_inventario(lote_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_inventario(created_at);
"""

async def main():
    async with engine.begin() as conn:
        await conn.exec_driver_sql(SQL)
    print("Farmacia tables created successfully.")

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Run the migration**

Run: `cd backend && python create_tables_farmacia.py`
Expected: "Farmacia tables created successfully."

- [ ] **Step 3: Verify tables exist**

Run: `cd backend && python -c "import asyncio; from app.core.database import engine; asyncio.run((asyncio.coroutine(lambda: None))())"` or use psql directly.

- [ ] **Step 4: Commit**

```bash
git add backend/create_tables_farmacia.py
git commit -m "feat: add pharmacy extension tables (lotes, movimientos, insumos)"
```

---

### Task 2: Seed Data — Test User + Sample Medications

**Files:**
- Create: `backend/seed_farmacia.py`

**Interfaces:**
- Produces: Test user `farmacia/farmacia123` with role `jefe_farmacia`, 15 medications, 10 supplies, 20 batches, 30 movements

- [ ] **Step 1: Create seed script**

```python
# backend/seed_farmacia.py
"""Seed pharmacy test data: user, medications, supplies, batches, movements"""
import asyncio
from datetime import date, timedelta
from app.core.database import engine
from app.core.security import hash_password

SEED_USER = """
INSERT INTO usuarios (username, password_hash, rol, activo)
VALUES ('farmacia', :pwd_hash, 'jefe_farmacia', true)
ON CONFLICT (username) DO NOTHING
RETURNING id;
"""

SEED_PERSONAL = """
INSERT INTO personal (cedula, nombre, apellido, cargo, clinica_id)
VALUES ('20000001', 'Maria', 'Gonzalez', 'Jefe de Farmacia', 1)
ON CONFLICT (cedula) DO NOTHING
RETURNING id;
"""

SEED_MEDICATIONS = """
INSERT INTO medicamentos_catalogo (nombre, presentacion, concentracion, categoria, stock_actual, stock_minimo, activo)
VALUES
    ('Paracetamol', 'Tabletas', '500mg', 'ANALGESICO', 150, 30, true),
    ('Ibuprofeno', 'Tabletas', '400mg', 'ANTIINFLAMATORIO', 80, 25, true),
    ('Amoxicilina', 'Cápsulas', '500mg', 'ANTIBIOTICO', 120, 20, true),
    ('Omeprazol', 'Cápsulas', '20mg', 'GASTRO', 200, 40, true),
    ('Losartán', 'Tabletas', '50mg', 'CARDIOVASCULAR', 45, 15, true),
    ('Metformina', 'Tabletas', '850mg', 'ANTIDIABETICO', 90, 20, true),
    ('Salbutamol', 'Inhalador', '100mcg', 'RESPIRATORIO', 35, 10, true),
    ('Diclofenaco', 'Inyectable', '75mg/ml', 'ANTIINFLAMATORIO', 60, 15, true),
    ('Ciprofloxacino', 'Tabletas', '500mg', 'ANTIBIOTICO', 10, 20, true),
    ('Metamizol', 'Gotas', '500mg/ml', 'ANALGESICO', 25, 10, true),
    ('Ranitidina', 'Tabletas', '150mg', 'GASTRO', 0, 15, true),
    ('Dexametasona', 'Inyectable', '4mg/ml', 'CORTICOIDE', 40, 10, true),
    ('Ketorolaco', 'Inyectable', '30mg/ml', 'ANALGESICO', 55, 15, true),
    ('Azitromicina', 'Tabletas', '500mg', 'ANTIBIOTICO', 70, 20, true),
    ('Pantoprazol', 'Tabletas', '40mg', 'GASTRO', 110, 25, true)
ON CONFLICT DO NOTHING;
"""

SEED_SUPPLIES = """
INSERT INTO insumos_catalogo (nombre, descripcion, categoria, unidad, stock_actual, stock_minimo, activo)
VALUES
    ('Guantes desechables', 'Guantes de látex talla M', 'PROTECCION', 'caja', 200, 50, true),
    ('Jeringas 5ml', 'Jeringas desechables 5ml', 'INYECCION', 'pieza', 500, 100, true),
    ('Algodón', 'Algodón hidrófilo 500g', 'HIGIENE', 'rollo', 30, 10, true),
    ('Gasas estériles', 'Gasas 10x10cm paquete de 10', 'CURACION', 'paquete', 80, 20, true),
    ('Sueres fisiológicos', 'NaCl 0.9% 500ml', 'INFUSION', 'unidad', 150, 30, true),
    ('Catéteres IV', 'Catéter 20G', 'ACCESO_VENOSO', 'pieza', 40, 15, true),
    ('Cintas adhesivas', 'Micropore 2.5cm', 'CURACION', 'rollo', 25, 10, true),
    ('Mascarillas quirúrgicas', 'Mascarilla quirúrgica 3 capas', 'PROTECCION', 'unidad', 300, 50, true),
    ('Bata desechable', 'Bata quirúrgica talla L', 'PROTECCION', 'unidad', 100, 20, true),
    ('Tubos de ensayo', 'Tubos vacutainer 5ml', 'LABORATORIO', 'pieza', 0, 50, true)
ON CONFLICT DO NOTHING;
"""

async def main():
    async with engine.begin() as conn:
        # Create user
        pwd_hash = hash_password("farmacia123")
        result = await conn.exec_driver_sql(
            SEED_USER, {"pwd_hash": pwd_hash}
        )
        user_row = result.fetchone()
        user_id = user_row[0] if user_row else None

        # Create personal
        await conn.exec_driver_sql(SEED_PERSONAL)

        # Seed medications
        await conn.exec_driver_sql(SEED_MEDICATIONS)

        # Seed supplies
        await conn.exec_driver_sql(SEED_SUPPLIES)

        # Seed batches (varied expiration dates)
        today = date.today()
        batch_data = []
        for i in range(1, 21):
            med_id = (i % 15) + 1
            days_offset = -30 + (i * 10)  # Some expired, some expiring soon, some OK
            exp_date = today + timedelta(days=days_offset)
            qty = max(0, 50 - (i * 3))
            batch_data.append((
                f"LOTE-{i:04d}", med_id, None, qty, qty,
                today - timedelta(days=60), exp_date
            ))

        for b in batch_data:
            await conn.exec_driver_sql("""
                INSERT INTO lotes (codigo_lote, medicamento_id, insumo_id, cantidad, cantidad_inicial, fecha_entrada, fecha_vencimiento)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, b)

        # Seed movements
        for i in range(1, 31):
            lote_id = (i % 20) + 1
            tipo = 'ENTRADA' if i % 3 == 0 else 'SALIDA'
            cantidad = (i * 5) % 20 + 1
            await conn.exec_driver_sql("""
                INSERT INTO movimientos_inventario (lote_id, tipo, cantidad, observacion, creado_por)
                VALUES (%s, %s, %s, %s, %s)
            """, (lote_id, tipo, cantidad, f'Movimiento seed #{i}', 'farmacia'))

    print("Farmacia seed data created successfully.")

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Run the seed script**

Run: `cd backend && python seed_farmacia.py`
Expected: "Farmacia seed data created successfully."

- [ ] **Step 3: Verify data exists**

Run: `cd backend && python -c "import asyncio; from app.core.database import engine; async def check(): async with engine.begin() as c: r = await c.exec_driver_sql('SELECT count(*) FROM lotes'); print(f'Lotes: {r.scalar()}'); r2 = await c.exec_driver_sql('SELECT count(*) FROM medicamentos_catalogo'); print(f'Medicamentos: {r2.scalar()}'); r3 = await c.exec_driver_sql('SELECT count(*) FROM insumos_catalogo'); print(f'Insumos: {r3.scalar()}'); asyncio.run(check())"`

- [ ] **Step 4: Commit**

```bash
git add backend/seed_farmacia.py
git commit -m "feat: seed pharmacy test data (user, medications, supplies, batches)"
```

---

### Task 3: Backend — SQLAlchemy Models

**Files:**
- Create: `backend/app/models/farmacia.py`

**Interfaces:**
- Produces: `Lote`, `MovimientoInventario`, `InsumoCatalogo` ORM models

- [ ] **Step 1: Create ORM models**

```python
# backend/app/models/farmacia.py
from sqlalchemy import Column, Integer, String, Date, DateTime, Text, Boolean, ForeignKey, CheckConstraint
from sqlalchemy.sql import func
from app.core.database import Base

class InsumoCatalogo(Base):
    __tablename__ = "insumos_catalogo"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    categoria = Column(String(100))
    unidad = Column(String(50), nullable=False, default="pieza")
    stock_actual = Column(Integer, default=0)
    stock_minimo = Column(Integer, default=10)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Lote(Base):
    __tablename__ = "lotes"

    id = Column(Integer, primary_key=True, index=True)
    codigo_lote = Column(String(50), nullable=False)
    medicamento_id = Column(Integer, ForeignKey("medicamentos_catalogo.id", ondelete="SET NULL"))
    insumo_id = Column(Integer, ForeignKey("insumos_catalogo.id", ondelete="SET NULL"))
    cantidad = Column(Integer, nullable=False, default=0)
    cantidad_inicial = Column(Integer, nullable=False, default=0)
    fecha_entrada = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, nullable=False)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "(medicamento_id IS NOT NULL) OR (insumo_id IS NOT NULL)",
            name="ck_lote_producto"
        ),
    )

class MovimientoInventario(Base):
    __tablename__ = "movimientos_inventario"

    id = Column(Integer, primary_key=True, index=True)
    lote_id = Column(Integer, ForeignKey("lotes.id", ondelete="SET NULL"))
    tipo = Column(String(20), nullable=False)
    cantidad = Column(Integer, nullable=False)
    observacion = Column(Text)
    creado_por = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')", name="ck_movimiento_tipo"),
    )
```

- [ ] **Step 2: Import models in `__init__.py`**

Modify `backend/app/models/__init__.py` to include the new models.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/farmacia.py backend/app/models/__init__.py
git commit -m "feat: add pharmacy SQLAlchemy models (Lote, MovimientoInventario, InsumoCatalogo)"
```

---

### Task 4: Backend — Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/farmacia.py`

**Interfaces:**
- Produces: Request/response schemas for all farmacia endpoints

- [ ] **Step 1: Create schemas**

```python
# backend/app/schemas/farmacia.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from enum import Enum

class TipoMovimiento(str, Enum):
    ENTRADA = "ENTRADA"
    SALIDA = "SALIDA"
    AJUSTE = "AJUSTE"

class EstadoStock(str, Enum):
    OK = "OK"
    BAJO = "BAJO"
    CRITICO = "CRITICO"

class EstadoVencimiento(str, Enum):
    VIGENTE = "VIGENTE"
    POR_VENCER = "POR_VENCER"
    VENCIDO = "VENCIDO"

# --- Medicamentos ---
class MedicamentoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    presentacion: Optional[str] = None
    concentracion: Optional[str] = None
    categoria: Optional[str] = None
    stock_actual: int = 0
    stock_minimo: int = 10

class MedicamentoUpdate(BaseModel):
    nombre: Optional[str] = None
    presentacion: Optional[str] = None
    concentracion: Optional[str] = None
    categoria: Optional[str] = None
    stock_actual: Optional[int] = None
    stock_minimo: Optional[int] = None

class MedicamentoResponse(BaseModel):
    id: int
    nombre: str
    presentacion: Optional[str]
    concentracion: Optional[str]
    categoria: Optional[str]
    stock_actual: int
    stock_minimo: int
    estado_stock: str
    vencimiento_mas_cercano: Optional[date]
    activo: bool

    class Config:
        from_attributes = True

# --- Insumos ---
class InsumoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    unidad: str = "pieza"
    stock_actual: int = 0
    stock_minimo: int = 10

class InsumoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    unidad: Optional[str] = None
    stock_actual: Optional[int] = None
    stock_minimo: Optional[int] = None

class InsumoResponse(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str]
    categoria: Optional[str]
    unidad: str
    stock_actual: int
    stock_minimo: int
    estado_stock: str
    vencimiento_mas_cercano: Optional[date]
    activo: bool

    class Config:
        from_attributes = True

# --- Lotes ---
class LoteCreate(BaseModel):
    codigo_lote: str = Field(..., min_length=1, max_length=50)
    medicamento_id: Optional[int] = None
    insumo_id: Optional[int] = None
    cantidad: int = Field(..., ge=0)
    fecha_entrada: date
    fecha_vencimiento: date

class LoteUpdate(BaseModel):
    codigo_lote: Optional[str] = None
    cantidad: Optional[int] = None
    fecha_vencimiento: Optional[date] = None

class LoteResponse(BaseModel):
    id: int
    codigo_lote: str
    medicamento_id: Optional[int]
    insumo_id: Optional[int]
    producto_nombre: str
    producto_tipo: str
    cantidad: int
    cantidad_inicial: int
    fecha_entrada: date
    fecha_vencimiento: date
    estado_vencimiento: str
    activo: bool

    class Config:
        from_attributes = True

# --- Movimientos ---
class MovimientoCreate(BaseModel):
    lote_id: int
    tipo: TipoMovimiento
    cantidad: int = Field(..., gt=0)
    observacion: Optional[str] = None

class MovimientoResponse(BaseModel):
    id: int
    lote_id: Optional[int]
    tipo: str
    cantidad: int
    observacion: Optional[str]
    creado_por: Optional[str]
    created_at: datetime
    producto_nombre: Optional[str]
    codigo_lote: Optional[str]

    class Config:
        from_attributes = True

# --- Dashboard ---
class DashboardKPI(BaseModel):
    total_medicamentos: int
    total_insumos: int
    stock_bajo: int
    por_vencer: int
    vencidos: int

class StockPorCategoria(BaseModel):
    categoria: str
    cantidad: int

class MovimientoPorDia(BaseModel):
    fecha: date
    entradas: int
    salidas: int

class TopStockBajo(BaseModel):
    nombre: str
    tipo: str
    stock_actual: int
    stock_minimo: int
    ratio: float
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/farmacia.py
git commit -m "feat: add pharmacy Pydantic schemas"
```

---

### Task 5: Backend — Pharmacy Endpoints

**Files:**
- Modify: `backend/app/api/v1/endpoints/farmacia.py`

**Interfaces:**
- Consumes: `Lote`, `MovimientoInventario`, `InsumoCatalogo` models; all schemas from Task 4
- Produces: All API endpoints listed in spec

- [ ] **Step 1: Rewrite farmacia.py with all endpoints**

This is the largest backend task. The file already exists with basic endpoints. Add:
- `GET /dashboard` — aggregate KPIs
- Full CRUD for `/medicamentos`, `/insumos`, `/lotes`
- `GET /lotes/proximos-vencer`
- CRUD for `/movimientos`
- Stock recalculation on batch create/movement

- [ ] **Step 2: Test endpoints manually**

Run: `cd backend && uvicorn main:app --reload`
Test each endpoint with curl or browser.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/farmacia.py
git commit -m "feat: implement pharmacy API endpoints (dashboard, CRUD, lotes, movimientos)"
```

---

### Task 6: Frontend — Install Recharts + App Routing

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: Role `farmacia` from auth
- Produces: `<FarmaciaInterface />` rendered for `farmacia` role

- [ ] **Step 1: Install Recharts**

Run: `cd frontend && npm install recharts`

- [ ] **Step 2: Add farmacia routing to App.jsx**

Add to the role switch:
```jsx
if (currentRole === 'farmacia') return <FarmaciaInterface onLogout={handleLogout} />
```

Import `FarmaciaInterface` at top.

- [ ] **Step 3: Add `farmacia` to MODULOS_INTERNOS in auth.py**

In `backend/app/api/v1/endpoints/auth.py`, add:
```python
"farmacia": "farmacia"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/src/App.jsx backend/app/api/v1/endpoints/auth.py
git commit -m "feat: add farmacia role routing and install Recharts"
```

---

### Task 7: Frontend — FarmaciaInterface + Sidebar

**Files:**
- Create: `frontend/src/pages/FarmaciaInterface.jsx`
- Create: `frontend/src/components/farmacia/FarmaciaSidebar.jsx`

**Interfaces:**
- Produces: Main layout with sidebar navigation and section switching

- [ ] **Step 1: Create FarmaciaSidebar**

Sidebar with sections: Dashboard, Medicamentos, Insumos, Lotes, Movimientos. Follow pattern from `ReceptionSidebar.jsx`.

- [ ] **Step 2: Create FarmaciaInterface**

Top-level component with `activeSection` state. Renders sidebar + active section component. Follow pattern from `ReceptionInterface.jsx`.

- [ ] **Step 3: Verify it renders**

Run frontend dev server, log in as `farmacia`, verify sidebar appears.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/FarmaciaInterface.jsx frontend/src/components/farmacia/FarmaciaSidebar.jsx
git commit -m "feat: create FarmaciaInterface layout with sidebar navigation"
```

---

### Task 8: Frontend — Dashboard Section with KPI Cards

**Files:**
- Create: `frontend/src/components/farmacia/FarmaciaDashboard.jsx`

**Interfaces:**
- Consumes: `GET /farmacia/dashboard` endpoint
- Produces: KPI cards + placeholder chart areas

- [ ] **Step 1: Create FarmaciaDashboard**

KPI cards (5 cards in a row): Total Medicamentos, Total Insumos, Stock Bajo, Por Vencer, Vencidos. Each card shows value, label, icon, and color.

- [ ] **Step 2: Add data fetching**

Use `useEffect` + `axiosClient.get('/farmacia/dashboard')` to populate cards.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/farmacia/FarmaciaDashboard.jsx
git commit -m "feat: create FarmaciaDashboard with KPI cards"
```

---

### Task 9: Frontend — Medications Section (CRUD Table)

**Files:**
- Create: `frontend/src/components/farmacia/MedicamentosSection.jsx`
- Create: `frontend/src/components/farmacia/MedicamentoFormModal.jsx`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /farmacia/medicamentos`
- Produces: Searchable, filterable table with status badges + add/edit modal

- [ ] **Step 1: Create MedicamentoFormModal**

Modal with form fields: nombre, presentación, concentración, categoría, stock_actual, stock_minimo.

- [ ] **Step 2: Create MedicamentosSection**

Table with columns: Nombre, Presentación, Concentración, Stock, Mínimo, Estado, Acciones. Filters bar with search + stock status dropdown. "Agregar" button opens modal.

- [ ] **Step 3: Add status badge logic**

```jsx
const getStockBadge = (actual, minimo) => {
  if (actual >= minimo * 1.5) return <span className="text-green-400">✅ OK</span>;
  if (actual >= minimo) return <span className="text-yellow-400">⚠️ Bajo</span>;
  return <span className="text-red-400">🔴 Crítico</span>;
};
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/farmacia/MedicamentosSection.jsx frontend/src/components/farmacia/MedicamentoFormModal.jsx
git commit -m "feat: create MedicamentosSection with CRUD table and form modal"
```

---

### Task 10: Frontend — Supplies Section (CRUD Table)

**Files:**
- Create: `frontend/src/components/farmacia/InsumosSection.jsx`
- Create: `frontend/src/components/farmacia/InsumoFormModal.jsx`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /farmacia/insumos`
- Produces: Same pattern as MedicamentosSection but for supplies

- [ ] **Step 1: Create InsumoFormModal**

Form fields: nombre, descripción, categoría, unidad, stock_actual, stock_minimo.

- [ ] **Step 2: Create InsumosSection**

Table with columns: Nombre, Descripción, Categoría, Unidad, Stock, Mínimo, Estado, Acciones. Same filter/search pattern.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/farmacia/InsumosSection.jsx frontend/src/components/farmacia/InsumoFormModal.jsx
git commit -m "feat: create InsumosSection with CRUD table and form modal"
```

---

### Task 11: Frontend — Batches Section

**Files:**
- Create: `frontend/src/components/farmacia/LotesSection.jsx`
- Create: `frontend/src/components/farmacia/LoteFormModal.jsx`

**Interfaces:**
- Consumes: `GET/POST/PUT /farmacia/lotes`, `GET /farmacia/lotes/proximos-vencer`
- Produces: Batch table with expiration badges

- [ ] **Step 1: Create LoteFormModal**

Form fields: código_lote, medicamento_id (select), insumo_id (select), cantidad, fecha_entrada, fecha_vencimiento.

- [ ] **Step 2: Create LotesSection**

Table with columns: Código Lote, Producto, Tipo, Cantidad, Fecha Entrada, Vencimiento, Estado, Acciones.

- [ ] **Step 3: Add expiration badge logic**

```jsx
const getVencimientoBadge = (fecha) => {
  const hoy = new Date();
  const venc = new Date(fecha);
  const dias = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
  if (dias < 0) return <span className="text-red-500">❌ Vencido</span>;
  if (dias < 30) return <span className="text-red-400">🔴 Urgente</span>;
  if (dias < 60) return <span className="text-yellow-400">⚠️ Por Vencer</span>;
  return <span className="text-green-400">✅ Vigente</span>;
};
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/farmacia/LotesSection.jsx frontend/src/components/farmacia/LoteFormModal.jsx
git commit -m "feat: create LotesSection with batch management and expiration badges"
```

---

### Task 12: Frontend — Movements Section

**Files:**
- Create: `frontend/src/components/farmacia/MovimientosSection.jsx`
- Create: `frontend/src/components/farmacia/MovimientoFormModal.jsx`

**Interfaces:**
- Consumes: `GET/POST /farmacia/movimientos`
- Produces: Movement history table with filters

- [ ] **Step 1: Create MovimientoFormModal**

Form fields: lote_id (select from lotes), tipo (ENTRADA/SALIDA/AJUSTE radio), cantidad, observación.

- [ ] **Step 2: Create MovimientosSection**

Table with columns: Fecha, Tipo (badge), Producto, Lote, Cantidad, Registrado por, Observación. Filters: date range, type dropdown, product search.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/farmacia/MovimientosSection.jsx frontend/src/components/farmacia/MovimientoFormModal.jsx
git commit -m "feat: create MovimientosSection with movement history and registration"
```

---

### Task 13: Frontend — Dashboard Charts (Recharts)

**Files:**
- Modify: `frontend/src/components/farmacia/FarmaciaDashboard.jsx`
- Create: `frontend/src/components/farmacia/FarmaciaCharts.jsx`

**Interfaces:**
- Consumes: Dashboard API data
- Produces: Bar chart (stock by category), Line chart (movements last 30 days), Top 10 lowest stock table

- [ ] **Step 1: Create FarmaciaCharts**

Recharts components:
- `BarChart`: Stock by category (medications vs supplies)
- `LineChart`: Movements last 30 days (entries vs exits)

- [ ] **Step 2: Integrate into FarmaciaDashboard**

Add charts below KPI cards. Add "Top 10 Stock Bajo" table at bottom.

- [ ] **Step 3: Verify charts render**

Log in as `farmacia`, verify charts show real data.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/farmacia/FarmaciaDashboard.jsx frontend/src/components/farmacia/FarmaciaCharts.jsx
git commit -m "feat: add Recharts visualizations to FarmaciaDashboard"
```

---

### Task 14: End-to-End Testing

**Files:** None (testing only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified working system

- [ ] **Step 1: Verify login**

Log in as `farmacia/farmacia123`. Should see FarmaciaInterface.

- [ ] **Step 2: Test Dashboard**

Verify KPI cards show real counts. Verify charts render.

- [ ] **Step 3: Test Medications CRUD**

Create a medication, edit it, delete it. Verify stock status badges.

- [ ] **Step 4: Test Supplies CRUD**

Create a supply, edit it, delete it.

- [ ] **Step 5: Test Batches**

Create a batch with expiration date. Verify it appears in the table.

- [ ] **Step 6: Test Movements**

Register an entry movement. Verify batch stock updates. Register an exit. Verify stock decreases.

- [ ] **Step 7: Test Expiration Badges**

Verify badges show correct colors for expired, expiring soon, and valid batches.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete Farmacia e Insumos interface"
```

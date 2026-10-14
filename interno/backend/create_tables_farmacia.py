# backend/create_tables_farmacia.py
"""Create pharmacy extension tables: lotes, movimientos_inventario, insumos_catalogo"""
import asyncio
from app.core.database import engine

SQL_STATEMENTS = [
    # New table: insumos_catalogo
    """
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
    """,
    # New table: lotes
    """
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
    """,
    # New table: movimientos_inventario
    """
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id SERIAL PRIMARY KEY,
        lote_id INTEGER REFERENCES lotes(id) ON DELETE SET NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
        cantidad INTEGER NOT NULL,
        observacion TEXT,
        creado_por VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
    );
    """,
    # Alter medicamentos_catalogo: add stock columns
    "ALTER TABLE medicamentos_catalogo ADD COLUMN IF NOT EXISTS stock_actual INTEGER DEFAULT 0;",
    "ALTER TABLE medicamentos_catalogo ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 10;",
    "ALTER TABLE medicamentos_catalogo ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'MEDICAMENTO';",
    "ALTER TABLE medicamentos_catalogo ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;",
    # Indexes
    "CREATE INDEX IF NOT EXISTS idx_lotes_medicamento ON lotes(medicamento_id);",
    "CREATE INDEX IF NOT EXISTS idx_lotes_insumo ON lotes(insumo_id);",
    "CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes(fecha_vencimiento);",
    "CREATE INDEX IF NOT EXISTS idx_movimientos_lote ON movimientos_inventario(lote_id);",
    "CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_inventario(created_at);",
]

async def main():
    async with engine.begin() as conn:
        for sql in SQL_STATEMENTS:
            await conn.exec_driver_sql(sql)
    print("Farmacia tables created successfully.")

if __name__ == "__main__":
    asyncio.run(main())
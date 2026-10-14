from typing import List, Optional

from pydantic import BaseModel


class InventarioItemSchema(BaseModel):
    id: int
    nombre: str
    presentacion: Optional[str] = None
    concentracion: Optional[str] = None
    stock_actual: int = 0
    stock_minimo: Optional[int] = None
    unidad: str = "unidad"
    categoria: Optional[str] = None
    vencimiento: Optional[str] = None


# --- Schemas para Insumos, Lotes y Movimientos de Inventario ---


class InsumoCatalogoCreate(BaseModel):
    """Payload para crear un insumo en catálogo."""
    nombre: str
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    unidad: str = "pieza"
    stock_actual: int = 0
    stock_minimo: int = 10


class InsumoCatalogoUpdate(BaseModel):
    """Payload para actualizar un insumo en catálogo."""
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    unidad: Optional[str] = None
    stock_actual: Optional[int] = None
    stock_minimo: Optional[int] = None
    activo: Optional[bool] = None


class InsumoCatalogoResponse(BaseModel):
    """Respuesta con datos de un insumo del catálogo."""
    id: int
    nombre: str
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    unidad: str
    stock_actual: int
    stock_minimo: int
    activo: bool

    class Config:
        from_attributes = True


class LoteCreate(BaseModel):
    """Payload para crear un lote."""
    codigo_lote: str
    medicamento_id: Optional[int] = None
    insumo_id: Optional[int] = None
    cantidad: int = 0
    cantidad_inicial: int = 0
    fecha_entrada: str
    fecha_vencimiento: str


class LoteUpdate(BaseModel):
    """Payload para actualizar un lote."""
    codigo_lote: Optional[str] = None
    medicamento_id: Optional[int] = None
    insumo_id: Optional[int] = None
    cantidad: Optional[int] = None
    fecha_vencimiento: Optional[str] = None
    activo: Optional[bool] = None


class LoteResponse(BaseModel):
    """Respuesta con datos de un lote."""
    id: int
    codigo_lote: str
    medicamento_id: Optional[int] = None
    insumo_id: Optional[int] = None
    cantidad: int
    cantidad_inicial: int
    fecha_entrada: str
    fecha_vencimiento: str
    activo: bool

    class Config:
        from_attributes = True


class MovimientoInventarioCreate(BaseModel):
    """Payload para registrar un movimiento de inventario."""
    lote_id: int
    tipo: str  # ENTRADA | SALIDA | AJUSTE
    cantidad: int
    observacion: Optional[str] = None
    creado_por: Optional[str] = None


class StockCentroRequest(BaseModel):
    """Payload para ingreso/descuento de stock por centro (doble libro)."""
    clinica_id: Optional[int] = None
    cantidad: int


class StockCentroResponse(BaseModel):
    """Respuesta tras operar stock por centro."""
    insumo_id: int
    clinica_id: int
    stock_centro: int
    stock_global: int


class MovimientoInventarioResponse(BaseModel):
    """Respuesta con datos de un movimiento de inventario."""
    id: int
    lote_id: Optional[int] = None
    tipo: str
    cantidad: int
    observacion: Optional[str] = None
    creado_por: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# --- Schemas para Medicamentos (inventario/stock) ---


class MedicamentoFarmaciaCreate(BaseModel):
    """Payload para crear un medicamento en inventario."""
    nombre: str
    presentacion: Optional[str] = None
    concentracion: Optional[str] = None
    categoria: Optional[str] = None
    stock_actual: int = 0
    stock_minimo: int = 10


class MedicamentoFarmaciaUpdate(BaseModel):
    """Payload para actualizar un medicamento en inventario."""
    nombre: Optional[str] = None
    presentacion: Optional[str] = None
    concentracion: Optional[str] = None
    categoria: Optional[str] = None
    stock_actual: Optional[int] = None
    stock_minimo: Optional[int] = None
    activo: Optional[bool] = None


class MedicamentoFarmaciaResponse(BaseModel):
    """Respuesta con datos de un medicamento del inventario."""
    id: int
    nombre: str
    presentacion: Optional[str] = None
    concentracion: Optional[str] = None
    categoria: Optional[str] = None
    stock_actual: int = 0
    stock_minimo: int = 10
    activo: bool = True

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    """KPIs del dashboard de farmacia."""
    total_medicamentos: int = 0
    total_insumos: int = 0
    stock_bajo: int = 0
    por_vencer: int = 0
    vencidos: int = 0

# Almacén: órdenes de entrega e inventario por centro

Flujo híbrido entre el **portal web** (Supabase, panel del Director) y el
**sistema interno** (PostgreSQL local, Jefe de Almacén).

## 1. Rol Jefe de Almacén (`jefe_almacen`)

- Existe en el sistema interno y en el catálogo de roles de Supabase.
- **Uso exclusivo del sistema interno**: `app/api/v1/endpoints/auth.py` del
  portal web rechaza el login con `403` y el mensaje
  «Las cuentas de Jefe de Almacén son exclusivas del sistema interno y no
  tienen acceso al portal web.»
- Se crea desde **Administración de Sistemas → Usuarios** eligiendo el rol
  «Jefe de Almacén (solo interno)» y **el centro de salud** (obligatorio).
  El centro se guarda en `usuarios.clinica_id` y en `personal.clinica_id`;
  es el centro cuyo inventario administra el usuario.
- Corrección del error «El personal indicado no existe»: si el Personal ID
  escrito no existe y el formulario trae nombre, se crea la ficha en
  `personal` en lugar de bloquear la operación. Además el centro ya no se
  fija a `2`: viaja desde el formulario.

## 2. Despacho desde la web (Director / Administración General)

- Sección **Stock e inventario** del panel `Institucional`.
- «Nueva orden de entrega» → centro destino, productos del catálogo central
  y cantidades. Se guarda en `ordenes_entrega` con estado
  `pendiente_recepcion` (`supabase/migrations/0029_...sql`).
- Endpoints: `GET /api/v1/almacen/catalogo`, `POST /api/v1/almacen/ordenes`,
  `GET /api/v1/almacen/ordenes`, `GET /api/v1/almacen/stock`,
  `GET /api/v1/almacen/movimientos`, `GET /api/v1/almacen/resumen`
  (solo `admin_sistemas` y `director`).
- El panel refresca el inventario cada 20 segundos.

## 3. Recepción en el sistema interno (Jefe de Almacén)

- Interfaz `AlmacenInterface` (rol `almacen`): pestañas **Órdenes de entrega**,
  **Inventario** y **Movimientos**.
- «Marcar como recibido» → la orden pasa a `recibida`, suma las cantidades a
  `almacen_stock` del centro y registra un movimiento `ENTRADA`.
- «Descontar» en el inventario registra el consumo diario (`SALIDA`) con
  validación de stock disponible.
- Endpoints: `GET /api/v1/almacen/resumen`, `/ordenes`, `/stock`,
  `/movimientos`; `POST /ordenes/{id}/recibir`, `/salidas`, `/sincronizar`;
  `GET /estado-sync`.

## 4. Sincronización y modo sin conexión

Mismo patrón que las solicitudes de citas web (`sincronizacion_portal.py`):

1. **Portal → interno**: el servicio `app/services/almacen.py` consulta
   Supabase y replica las órdenes pendientes del centro (idempotente por
   `remota_id`).
2. **Interno → portal**: cada recepción, consumo o cambio de estado se guarda
   en la tabla local `almacen_sync_outbox`. La cola se envía a Supabase
   (`almacen_stock` con upsert por `clinica_id + item_key`,
   `almacen_movimientos` con `sync_id` único y `PATCH` del estado de la orden).
3. **Sin internet**: todo se escribe primero en local, así que el Jefe de
   Almacén puede seguir recibiendo y descontando. La interfaz avisa «Sin
   conexión con el portal…» y reintenta al sincronizar (automático cada 45 s).
   Los movimientos quedan con `sincronizado = false` hasta que salen.

Los productos se identifican por `item_key = tipo:slug-del-nombre` porque el
catálogo del portal y el del sistema interno son distintos. Los centros usan
el mismo `clinicas.id` en ambos lados.

## 5. Migraciones

Aplicar en este orden:

```bash
# Sistema interno (PostgreSQL local)
cd interno/backend
python migrations/aplicar_sql.py migrations/0022_almacen_ordenes_entrega.sql

# Portal web (Supabase → SQL Editor)
# supabase/migrations/0029_almacen_ordenes_entrega.sql
```

Ambas son idempotentes. Sin la 022 el rol `jefe_almacen` no puede existir en
la tabla `usuarios` del sistema interno; el servicio crea las tablas del
almacén de forma perezosa como respaldo.

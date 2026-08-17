# BnaSalud · Plan de fases siguientes

Plan de trabajo propuesto después de completar las **Fases 0-4** (doble confirmación de recetas, consulta → receta, cola real con triaje, bienvenida por correo SMTP y trazabilidad admin). Última actualización: 17/08/2026.

## Estado actual (resumen de lo ya entregado)

| Fase | Entregable |
| --- | --- |
| 0 | Ciclo de receta `PENDIENTE → DESPACHADA → ENTREGADA → RECIBIDA` con doble confirmación (farmacéutico + paciente), normalización de cédulas (`_solo_digitos`), listado por paciente. |
| 1 | Generación de receta desde la consulta (`RX-2026-NNNN`), resolución contra inventario, código mostrado en el informe clínico. |
| 2 | Cola real (`cola_pacientes` + endpoints `/api/v1/cola`), check-in con cédula o anónimo, prioridades, asignación y cierre por el médico de turno. |
| 3 | Envío de correos (tarjeta de bienvenida con PIN, recuperación de PIN con código de 6 dígitos) vía SMTP por `.env` con fallback demo (`SMTP_HOST` vacío → `codigo_demo`). |
| 4 | Panel admin (`/admin`): trazabilidad completa de cada receta (consulta → despacho → entrega → recepción) y resumen operativo del día. |
| Seed | `app/db/seed.py` adaptado al esquema real y verificado idempotente: 16 personal, 5 pacientes, 21 usuarios, 4 recetas en todos los estados, 3 turnos de cola, despachos con responsable. |

**Configuración pendiente para producción** (no es una fase, es pre-requisito):
- Poner `SMTP_HOST/PORT/USER/PASSWORD/FROM` reales en `.env` y `PIN_EMITIR_DEMO=false`.
- Cambiar `JWT_SECRET` por defecto por un valor seguro (≥ 32 bytes).
- Ajustar los timestamps fijos de la semilla (hoy apuntan a la fecha de la jornada).

---

## Fase 5 · Notificaciones al paciente

**Objetivo:** cerrar el ciclo de comunicación con el paciente por correo.

- Backend:
  - `POST /pacientes/{cedula}/notificar` (rol superusuario) o evento automático: enviar correo cuando la receta pasa a `ENTREGADA` ("tu receta está lista para retirar").
  - Recordatorio de cita 24 h antes (tarea programada con APScheduler o cron).
  - Tabla `notificaciones` (paciente_id, tipo, canal, asunto, estado, enviado_en) para auditoría de envíos.
- Frontend: sección "Notificaciones" en el portal del paciente (historial de correos enviados).
- Criterio de aceptación: al entregar una receta en Farmacia, el paciente recibe correo y aparece el registro en su portal.

## Fase 6 · Órdenes de estudios end-to-end (laboratorio e imagenología)

**Objetivo:** conectar el módulo de órdenes con resultados reales.

- Backend: endpoints de **resultados** (rol enfermero/superusuario) para cargar/editar resultados por orden; notificación al paciente cuando `estado → RESULTADOS_DISPONIBLES`.
- Frontend: pantalla de laboratorio para subir resultados (manual o PDF) y vista del paciente de sus resultados (ya existe el módulo de órdenes en el home).
- BD: columnas `resultado` / `resultados_json` en `ordenes_estudios` (migración 0017).
- Criterio de aceptación: una orden creada en consulta puede recibir resultados y el paciente los ve en su portal con fecha de entrega.

## Fase 7 · Seguridad restante y auditoría

**Objetivo:** cerrar accesos abiertos y dejar trazabilidad de acciones administrativas.

- Proteger con rol `farmaceutico`/`superusuario` cualquier endpoint de farmacia que aún quede abierto y agregar pantalla de login propia al módulo Farmacia (hoy depende del navbar público).
- Decidir acceso a `/rrhh/*` y `/emergencias` (hoy públicos): restringir a staff o eliminarlos del home.
- Tabla `bitacora_acciones` (usuario_id, accion, entidad, entidad_id, detalle, creado_en) registrada vía middleware para: login, cambio de estado de recetas, asignación/finalización de cola, cambios en usuarios.
- Panel admin: vista "Auditoría" con filtros por usuario/acción/fecha.
- Criterio de aceptación: no existe endpoint mutador accesible sin token y toda acción sensible queda en la bitácora visible en `/admin`.

## Fase 8 · Reportes y cierre de jornada

**Objetivo:** datos operativos exportables para la dirección municipal.

- Backend: `GET /admin/reportes` con rango de fechas: recetas por estado, consultas por médico/centro, top medicamentos despachados, tiempo promedio de espera en cola, citas por especialidad (agrupar por `clinica_id` y `especialidad`).
- Exportación CSV/PDF (backend genera el archivo; frontend descarga).
- Vista en Admin.jsx con tarjetas por período y botones de exportación.
- Criterio de aceptación: se puede generar un reporte mensual del municipio en menos de 2 clics.

## Fase 9 · Multi-clínica: inventario y alertas

**Objetivo:** operar stock por centro con alertas tempranas.

- Backend: al despachar, descontar `stock_clinica` de la clínica de la receta (hoy solo registra el despacho); alerta cuando `cantidad_actual ≤ stock_minimo` (correo al farmacéutico del centro + indicador en Farmacia).
- Frontend: vista de inventario por centro con niveles, historial de movimientos (entradas por semilla, salidas por despacho).
- BD: tabla `movimientos_stock` (migración 0018) y columna `clasificacion` de medicamento si hace falta.
- Criterio de aceptación: despachar una receta reduce el stock del centro y la alerta aparece en ≤ 5 min.

## Fase 10 · Despliegue y pruebas

**Objetivo:** dejar el sistema accesible y verificado fuera de localhost.

- Despliegue: backend en Render/Railway con variables de entorno reales; frontend en Vercel/Netlify con proxy a la API; dominio o subdominio del municipio si aplica.
- Migraciones: script `supabase/migrations/` completo ejecutable desde cero en una base nueva (verificar orden y FK).
- Pruebas: suite pytest del backend (login, roles, ciclo de receta, cola, trazabilidad) con base de datos de prueba; smoke test del frontend.
- `INSTRUCCIONES.md` actualizado con la guía de despliegue paso a paso.
- Criterio de aceptación: en una máquina limpia, `git clone` + instrucciones del README dejan el sistema corriendo contra Supabase en menos de 30 minutos.

---

## Orden sugerido y dependencias

```
Fase 5 ─┐
Fase 6 ─┼→ Fase 7 → Fase 8 → Fase 9 → Fase 10
        │
Fase 7 (seguridad) conviene antes de abrir Farmacia al staff real
Fase 10 (despliegue) solo al final, con las demás estabilizadas
```

Puede ejecutarse en orden estricto (5 → 10) o priorizando **Fase 7** si el sistema se va a usar con datos reales antes de completar todo.
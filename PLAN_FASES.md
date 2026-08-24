# BnaSalud · Plan de fases siguientes

Plan de trabajo propuesto después de completar las **Fases 0-5** (doble confirmación de recetas, consulta → receta, cola real con triaje, bienvenida por correo SMTP, trazabilidad admin y notificaciones al paciente) y de entregar las **Fases 6-7** (órdenes de estudios end-to-end y seguridad/auditoría). Última actualización: 22/08/2026.

## Estado actual (resumen de lo ya entregado)

| Fase | Entregable |
| --- | --- |
| 0 | Ciclo de receta `PENDIENTE → DESPACHADA → ENTREGADA → RECIBIDA` con doble confirmación (farmacéutico + paciente), normalización de cédulas (`_solo_digitos`), listado por paciente. |
| 1 | Generación de receta desde la consulta (`RX-2026-NNNN`), resolución contra inventario, código mostrado en el informe clínico. |
| 2 | Cola real (`cola_pacientes` + endpoints `/api/v1/cola`), check-in con cédula o anónimo, prioridades, asignación y cierre por el médico de turno. |
| 3 | Envío de correos (tarjeta de bienvenida con PIN, recuperación de PIN con código de 6 dígitos) vía SMTP por `.env` con fallback demo (`SMTP_HOST` vacío → `codigo_demo`). |
| 4 | Panel admin (`/admin`): trazabilidad completa de cada receta (consulta → despacho → entrega → recepción) y resumen operativo del día. |
| Seed | `app/db/seed.py` adaptado al esquema real y verificado idempotente: 16 personal, 5 pacientes, 21 usuarios, 4 recetas en todos los estados, 3 turnos de cola, despachos con responsable. |
| 5 | Notificaciones al paciente: correo automático al entregar una receta, recordatorio de cita 24 h (APScheduler cada hora), tabla `notificaciones` (migración 0017), endpoint manual `POST /pacientes/{cedula}/notificar` (superusuario) y sección "Notificaciones" en el portal del paciente. |
| 6 | Órdenes de estudios end-to-end: `GET /estudios/ordenes` (staff), resultados con rol `medico/enfermero/superusuario`, aviso automático "resultados disponibles" y módulo Laboratorio `/laboratorio`. |
| 7 | Seguridad y auditoría: farmacia protegida por rol con login propio, `/rrhh/*` solo superusuario, `/emergencias` solo staff, bitácora de acciones (`bitacora_acciones`, migración 0018) instrumentada en los flujos sensibles y vista "Auditoría" en `/admin`. |

**Configuración pendiente para producción** (no es una fase, es pre-requisito):
- Poner `SMTP_HOST/PORT/USER/PASSWORD/FROM` reales en `.env` y `PIN_EMITIR_DEMO=false`.
- Cambiar `JWT_SECRET` por defecto por un valor seguro (≥ 32 bytes).
- Ajustar los timestamps fijos de la semilla (hoy apuntan a la fecha de la jornada).

---

## Fase 5 · Notificaciones al paciente ✅ (entregada 22/08/2026)

**Objetivo:** cerrar el ciclo de comunicación con el paciente por correo.

Implementado:
- `supabase/migrations/0017_notificaciones.sql`: tabla de auditoría (`paciente_id, tipo, canal, asunto, destinatario, estado enviado|demo|error, detalle, referencia` + índice único parcial `(tipo, referencia)` para evitar correos duplicados). **Pendiente aplicarla en Supabase SQL Editor.**
- Evento automático: al registrar la entrega en Farmacia (`POST /farmacia/recetas/{id}/entregar`) se envía "tu receta está lista" vía `app/core/notificaciones.py::notificar_receta_entregada` (un fallo de correo nunca interrumpe la entrega).
- Recordatorio de cita 24 h: job cada hora en `app/core/scheduler.py` (APScheduler, arranca con la app vía lifespan) → `procesar_recordatorios()`.
- Manual: `POST /pacientes/{cedula}/notificar` (rol superusuario) y listado `GET /pacientes/{cedula}/notificaciones`.
- Frontend: sección "Notificaciones" en el portal del paciente con historial de correos (estado Enviado/Demo/Error).
- Sin SMTP configurado todo queda registrado en estado `demo`; instalar dependencia nueva: `APScheduler>=3.10,<4`.

Criterio de aceptación: al entregar una receta en Farmacia, el paciente recibe correo y aparece el registro en su portal. ✔ (verificar con SMTP real en producción)

## Fase 6 · Órdenes de estudios end-to-end ✅ (entregada 22/08/2026)

**Objetivo:** conectar el módulo de órdenes con resultados reales.

Implementado:
- Backend: `GET /estudios/ordenes` (staff, filtro `estado`, join con el paciente) para la cola del laboratorio; `POST /estudios/ordenes/{id}/resultados` ahora exige rol `medico|enfermero|superusuario` y dispara el aviso "resultados disponibles" (`notificar_resultados_disponibles`).
- Frontend: módulo **Laboratorio** en `/laboratorio` (entrada 03 del menú interno): login propio (médico/enfermero/superusuario), cola de órdenes filtrable y formulario de resultados por estudio — parámetros dinámicos para laboratorio, descripción/conclusión para imagen/funcional.
- BD: se mantiene el diseño JSONB existente de `ordenes_estudios` (`estudios` guarda los resultados + `resultados_at`). La idea original de columnas `resultado/resultados_json` quedó descartada.
- Criterio de aceptación: una orden creada en consulta recibe resultados desde `/laboratorio` y queda `con_resultados`; el paciente es notificado. ✔

## Fase 7 · Seguridad restante y auditoría ✅ (entregada 22/08/2026)

**Objetivo:** cerrar accesos abiertos y dejar trazabilidad de acciones administrativas.

Implementado:
- Farmacia protegida: `GET /farmacia/recetas/pendientes`, `GET /farmacia/recetas/{codigo}`, `GET /farmacia/inventario` y `POST /farmacia/despachar` exigen rol `farmaceutico|superusuario`. Pantalla de login propia en `Farmacia.jsx` (sesión guardada, botón Salir).
- `/rrhh/*` restringido a superusuario; `/emergencias` (GET y POST) solo staff. Ninguno se usaba aún desde el frontend (verificado).
- Bitácora: migración `0018_bitacora_acciones.sql` + helper `app/core/bitacora.py::registrar_accion` (fail-safe). Instrumentado en: login staff/paciente, despacho/entrega/recepción de recetas, check-in/asignar/finalizar/cancelar cola, resultados de estudios y notificación manual.
- Panel admin: vista "Auditoría" (sección III) con filtros por acción y usuario sobre `GET /admin/bitacora` (superusuario).
- Criterio de aceptación: todos los endpoints mutadores requieren token con rol válido ✔ y cada acción sensible queda registrada en la bitácora visible en `/admin` ✔ (tras aplicar las migraciones 0017 y 0018 en Supabase SQL Editor).

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
- BD: tabla `movimientos_stock` (migración 0019; la 0018 ya corresponde a la bitácora) y columna `clasificacion` de medicamento si hace falta.
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
# BnaSalud — Resumen del Sistema

**Plataforma de Gestion Clinica — CITAB (Centro Integral de Alta Tecnologia - Salud Barcelona)**
Municipio Simon Bolivar, Estado Barinas, Venezuela

---

## 1. Arquitectura General

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL   │
│  React + Vite│     │  FastAPI     │     │   bnasalud    │
│  :3000       │     │  :8000       │     │   :5432       │
└─────────────┘     └─────────────┘     └──────────────┘
```

- **Frontend**: React 18, Tailwind CSS, jsPDF, Recharts
- **Backend**: FastAPI, SQLAlchemy async, Pydantic v2
- **DB**: PostgreSQL 15+ con tipos ENUM personalizados

---

## 2. Modulos del Sistema

| Modulo | Rol DB | Interfaz | Descripcion |
|--------|--------|----------|-------------|
| Recepcion | `recepcionista` | `ReceptionInterface` | Registro de pacientes, cola de atencion, gestion de guardias |
| Emergencia | `medico_emergencia` | `EmergencyDoctorInterface` | Consulta medica de emergencia: signos, diagnostico, recetas, remisiones |
| Especialista | `medico` | `SpecialistInterface` | Consulta especializada: cola asignada, historial, recetas, seguimiento |
| Farmacia | `jefe_farmacia` / `farmaceutico` | `FarmaciaInterface` | Inventario de medicamentos e insumos, aplicacion de tratamientos |
| Admin Sistemas | `admin_sistemas` | `SystemAdminInterface` | CRUD usuarios, gestion de nomina, logs del sistema |

---

## 3. Modelos de Datos

### 3.1 Pacientes y Historias Clinicas

| Tabla | PK | Campos Clave |
|-------|-----|--------------|
| `historias_clinicas` | UUID | cedula (unique), nombre_completo, apellido, direccion, telefono, tipo_sangre, antecedentes_medicos (JSONB), antecedentes_operatorios (JSONB), alergias (JSONB) |
| `beneficiarios` | UUID | empleado_id (FK), cedula, nombre_completo, parentesco |
| `empleados` | UUID | cedula (unique), nombre_completo, departamento, cargo |

### 3.2 Cola de Atencion

| Tabla | PK | Campos Clave |
|-------|-----|--------------|
| `cola_atencion` | BIGINT | token, paciente_id (FK), clinica_id (FK), medico_id (FK), especialista_id (FK), atencion_estado (ENUM), ruta_atencion (ENUM), prioridad, categoria_prioridad (ENUM), cita_id, consulta_id, signos vitales (7 campos) |
| `atencion_historial_estados` | BIGINT | cola_id (FK), estado_anterior, estado_nuevo, cambiado_por (FK) |
| `triaje_registros` | BIGINT | cola_id (FK), 12 campos de signos + nivel_triaje, ruta_sugerida |

**Estados de la cola (maquina de estados):**
```
RECEPCION → TRIAJE → EN_ESPERA_CONSULTA → EN_CONSULTA → FINALIZADO
                                                         → CANCELADO
                                                         → NO_ASISTIO
```

**Rutas de atencion:** `CITA` | `EMERGENCIA`

**Categorias de prioridad:** `VERDE` | `AMARILLO` | `ROJO`

### 3.3 Consultas Medicas

| Tabla | PK | Campos Clave |
|-------|-----|--------------|
| `consultas` | UUID | paciente_id (FK), cola_id, medico_id, medico_nombre, especialidad, motivo_consulta, examen_fisico, cie10_codigo, cie10_descripcion, tratamiento, recomendaciones, recetas (JSONB), laboratorios (JSONB), estudios (JSONB), insumos (JSONB), comprobante_ref, created_at |
| `citas` | UUID | paciente_id (FK), medico_id (FK), centro_id (FK), fecha_cita, hora_inicio, estado, codigo_confirmacion (unique), cola_id (FK) |
| `citas_examenes` | UUID | examen_ofrecido_id, paciente_id (FK), fecha_cita, hora_inicio, estado, codigo_confirmacion |

### 3.4 Examenes

| Tabla | PK | Campos Clave |
|-------|-----|--------------|
| `catalogo_examenes` | UUID | categoria (ENUM: laboratorio/imagen/funcional/anatomia_patologica), grupo, nombre_estudio (unique), requiere_ayuno |
| `ordenes_medicas` | UUID | paciente_id (FK), medico_id (FK), estado (ENUM: pendiente/en_proceso/completado/cancelado) |
| `orden_examenes_items` | UUID | orden_id (FK CASCADE), examen_id (FK), nombre_examen, categoria, resultado |
| `examenes_ofrecidos` | INT | examen, centro_id (FK), horario_atencion (JSONB), cupo_diario |

### 3.5 Farmacia / Inventario

| Tabla | PK | Campos Clave |
|-------|-----|--------------|
| `medicamentos_catalogo` | INT | nombre, presentacion, concentracion, categoria, stock_actual, stock_minimo, posologia_sugerida, activo |
| `insumos_catalogo` | INT | nombre, descripcion, categoria, unidad, stock_actual, stock_minimo, activo |
| `inventario_medicamentos` | INT | nombre, presentacion, concentracion, categoria, stock_actual, stock_minimo (legacy) |
| `lotes` | INT | codigo_lote, medicamento_id (FK), insumo_id (FK), cantidad, cantidad_inicial, fecha_entrada, fecha_vencimiento |
| `movimientos_inventario` | INT | lote_id (FK), tipo (ENUM: ENTRADA/SALIDA/AJUSTE), cantidad, observacion |
| `recetas` | INT | codigo_receta, paciente_cedula, medico, consulta_id, estado (PENDIENTE/DESPACHADA/ENTREGADA) |
| `receta_detalles` | INT | receta_id (FK), medicamento_id, cantidad_prescrita, cantidad_despachada, posologia |

### 3.6 Staff y Seguridad

| Tabla | PK | Campos Clave |
|-------|-----|--------------|
| `usuarios` | UUID | username (unique), password_hash (bcrypt), rol (ENUM), personal_id (FK), activo |
| `personal` | INT | cedula, nombre, apellido, cargo, especialidad, clinica_id (FK) |
| `guardias` | INT | medico_id (FK), clinica_id (FK), turno_id (FK), fecha, hora_inicio, hora_fin, estado |
| `turnos` | INT | nombre, hora_inicio, hora_fin |
| `clinicas` | INT | nombre, codigo, parroquia, direccion |
| `system_logs` | INT | nivel (ERROR/WARNING/INFO), mensaje, fuente, detalle |
| `bitacora_acciones` | BIGINT | usuario_id, username, rol, accion, entidad, entidad_id, detalle |

### 3.7 Tipos ENUM personalizados

| Tipo | Valores |
|------|---------|
| `atencion_estado_t` | RECEPCION, TRIAJE, EN_ESPERA_CONSULTA, EN_CONSULTA, FINALIZADO, CANCELADO, NO_ASISTIO |
| `ruta_atencion_t` | CITA, EMERGENCIA |
| `categoria_paciente_t` | VERDE, AMARILLO, ROJO |
| `exam_category_enum` | laboratorio, imagen, funcional, anatomia_patologica |
| `order_status_enum` | pendiente, en_proceso, completado, cancelado |

---

## 4. Endpoints API (55 total)

### Autenticacion
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/auth/login` | Login, retorna JWT + rol + personal_id + clinica_id |

### Admin Sistema
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/admin/usuarios` | Listar usuarios (paginado, busqueda) |
| POST | `/admin/usuarios` | Crear usuario |
| PUT | `/admin/usuarios/{id}` | Actualizar usuario |
| DELETE | `/admin/usuarios/{id}` | Eliminar usuario |
| GET | `/admin/empleados` | Listar empleados (paginado, busqueda) |
| POST | `/admin/empleados` | Crear empleado |
| PUT | `/admin/empleados/{id}` | Actualizar empleado |
| DELETE | `/admin/empleados/{id}` | Eliminar empleado |
| GET | `/admin/logs` | Listar logs (filtro por nivel) |
| POST | `/admin/logs` | Crear log |
| DELETE | `/admin/logs/{id}` | Eliminar log |
| GET | `/admin/logs/stats` | Estadisticas por nivel |

### Cola de Atencion
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/cola` | Registrar paciente (check-in) |
| GET | `/cola` | Listar cola (filtro por rol/clinica) |
| PATCH | `/cola/{id}` | Editar datos en cola |
| DELETE | `/cola/{id}` | Eliminar de cola |
| PUT | `/cola/{id}/consulta` | Vincular consulta a cola |
| PATCH | `/cola/{id}/transicion` | Transicion de estado |

### Consultas
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/consultas` | Crear consulta (descuenta stock automaticamente) |
| GET | `/consultas/hoy` | Consultas del dia |
| GET | `/consultas/contador-hoy/{medico_id}` | Conteo diario por medico |
| GET | `/consultas/detalle/{id}` | Detalle completo |
| PUT | `/consultas/{id}` | Reemplazar contenido |
| PATCH | `/consultas/{id}` | Editar campos clinicos |
| DELETE | `/consultas/{id}` | Eliminar consulta |
| PUT | `/consultas/{id}/resultados-examenes` | Actualizar resultados |

### Farmacia
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/farmacia/dashboard` | KPIs de farmacia |
| GET | `/farmacia/inventario` | Inventario unificado (meds + insumos) |
| GET/POST/PUT/DELETE | `/farmacia/medicamentos` | CRUD medicamentos |
| GET/POST/PUT/DELETE | `/farmacia/insumos` | CRUD insumos |
| GET/POST/PUT | `/farmacia/lotes` | Gestion de lotes |
| GET/POST | `/farmacia/movimientos` | Movimientos de inventario |
| GET | `/farmacia/recetas-aplicadas` | Recetas aplicadas en consultas |

### Historias Clinicas
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/historias-clinicas/{cedula}` | Buscar por cedula |
| POST | `/historias-clinicas` | Crear/actualizar |

### Agenda y Citas
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/agenda/especialistas` | Especialistas disponibles |
| GET | `/agenda/disponibilidad` | Disponibilidad por prioridad |
| GET | `/agenda/turnos` | Turnos libres por fecha |
| POST | `/agenda/citas` | Crear cita especialista |
| POST | `/agenda/reprogramar-todas` | Reprogramar pendientes |

### Examenes
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/examenes/catalogo` | Catalogo estructurado |
| GET | `/examenes/catalogo/buscar` | Buscar examenes |
| POST | `/examenes/ordenes` | Crear orden |
| GET | `/examenes/ordenes/paciente/{id}` | Ordenes por paciente |
| PATCH | `/examenes/ordenes/{orden_id}/item/{item_id}` | Actualizar resultado |

### Remision de Examenes
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/remision-examen/centros-adscritos` | Centros disponibles |
| GET | `/remision-examen/examenes-ofrecidos` | Examenes ofrecidos |
| GET | `/remision-examen/examenes-ofrecidos/{id}/disponibilidad` | Disponibilidad N dias |
| POST | `/remision-examen/citas` | Crear cita de examen |

### Guardias y Personal
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/guardias/iniciar` | Iniciar turno |
| POST | `/guardias/cambiar` | Cambiar turno |
| PATCH | `/guardias/{id}/finalizar` | Finalizar turno |
| GET | `/guardias/activas` | Turnos activos |
| GET | `/personal` | Listar personal |

---

## 5. Flujo Principal del Paciente

```
1. REGISTRO (Recepcion)
   └─ Paciente llega → Busqueda por cedula → Registro en cola → Token asignado

2. TRIAJE (Enfermeria / Recepcion)
   └─ Signos vitales → Clasificacion (VERDE/AMARILLO/ROJO) → Ruta asignada

3. CONSULTA (Medico de Emergencia o Especialista)
   └─ Evaluacion → Diagnostico CIE-10 → Recetas → Examenes → Remision

4. FARMACIA
   └─ Despacho de medicamentos → Descuento de stock

5. SEGUIMIENTO
   └─ Citas de control → Reprogramacion → Historial clinico actualizado
```

### Estados de la Cola
```
RECEPCION ──→ TRIAJE ──→ EN_ESPERA_CONSULTA ──→ EN_CONSULTA ──→ FINALIZADO
    │              │              │                    │
    └──────────────┴──────────────┴────────────────────┴──→ CANCELADO
                                                              NO_ASISTIO
```

---

## 6. Reglas de Negocio Clave

| # | Regla |
|---|-------|
| 1 | **Un paciente por dia por clinica**: No se permiten dos entradas activas con la misma cedula en el mismo dia |
| 2 | **Un medico, una consulta a la vez**: No puede iniciar nueva consulta si tiene paciente en EN_CONSULTA |
| 3 | **Descuento automatico de stock**: Al crear consulta, los insumos con `insumo_id` se descuentan de `medicamentos_catalogo`, `insumos_catalogo` o `inventario_medicamentos` |
| 4 | **Gestion por lotes**: Crear lote actualiza stock del producto; movimientos (ENTRADA/SALIDA/AJUSTE) actualizan lote + producto |
| 5 | **Ventanas de prioridad por cita**: Azul = mismo dia, Verde = 14 dias, Amarillo = 30 dias |
| 6 | **Elegibilidad para remision de examenes**: Solo empleados y beneficiarios |
| 7 | **Cupo diario**: Citas de examenes limitadas por `cupo_diario` en `examenes_ofrecidos` |
| 8 | **Auto-cola desde citas**: Al cargar cola del especialista, citas pendientes del dia se encolan automaticamente |

---

## 7. KPIs Disponibles para Dashboard

### 7.1 Flujo de Pacientes
- **Pacientes registrados hoy** (cola_atencion por fecha)
- **Pacientes en espera** (estado = EN_ESPERA_CONSULTA)
- **Pacientes en consulta** (estado = EN_CONSULTA)
- **Consultas finalizadas hoy** (consultas.created_at::date = hoy)
- **Tasa de asistencia** (FINALIZADO vs NO_ASISTIO)
- **Tiempo promedio de espera** (fec_encolada → iniciado_en)
- **Tiempo promedio de consulta** (iniciado_en → fin_en)
- **Pacientes por clinica** (GROUP BY clinica_id)
- **Pacientes por ruta** (EMERGENCIA vs CITA)

### 7.2 Rendimiento Medico
- **Consultas por medico/dia** (consultas GROUP BY medico_id, fecha)
- **Consultas por especialidad** (consultas GROUP BY especialidad)
- **Diagnosticos mas frecuentes** (consultas GROUP BY cie10_codigo)
- **Tasa de remision a especialista** (derivado_a_especialista = TRUE)
- **Tasa de remision a examenes** (examen_remitido = TRUE)
- **Tiempo promedio de consulta por medico**

### 7.3 Farmacia / Inventario
- **Total medicamentos activos** (medicamentos_catalogo WHERE activo)
- **Total insumos activos** (insumos_catalogo WHERE activo)
- **Medicamentos con stock bajo** (stock_actual < stock_minimo)
- **Insumos con stock bajo**
- **Lotes proximos a vencer** (fecha_vencimiento < hoy + N dias)
- **Lotes vencidos** (fecha_vencimiento < hoy)
- **Movimientos de inventario por tipo** (ENTRADA/SALIDA/AJUSTE)
- **Medicamentos mas aplicados** (consultas.insumos JSONB)
- **Valor total del inventario**

### 7.4 Agenda / Citas
- **Citas programadas hoy** (citas WHERE fecha_cita = hoy)
- **Citas completadas** (estado = completada)
- **Citas canceladas** (estado = cancelada)
- **Tasa de ocupacion por especialista** (citas / cupo disponible)
- **Citas de examenes pendientes** (citas_examenes WHERE estado = pendiente)

### 7.5 Examenes
- **Ordenes creadas por tipo** (laboratorio/imagen/funcional/anatomia_patologica)
- **Ordenes completadas vs pendientes**
- **Examenes mas solicitados** (orden_examenes_items GROUP BY nombre_examen)
- **Tiempo promedio de completion** (created_at → updated_at)

### 7.6 Seguridad / Sistema
- **Usuarios activos vs inactivos**
- **Usuarios por rol**
- **Logs de error** (nivel = ERROR, COUNT)
- **Logs de warning** (nivel = WARNING, COUNT)
- **Ultimos accesos** (bitacora_acciones)
- **Acciones por usuario**

### 7.7 Personal / Guardias
- **Guardias activas** (estado = ACTIVA)
- **Personal por clinica** (personal GROUP BY clinica_id)
- **Personal por cargo** (personal GROUP BY cargo)
- **Empleados activos vs inactivos**

---

## 8. Estructura de Directorios

```
interno/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/    # 14 archivos de endpoints
│   │   │   └── router.py     # Registro de routers
│   │   ├── core/
│   │   │   ├── config.py     # Settings (JWT, DB, etc.)
│   │   │   └── database.py   # SQLAlchemy async engine
│   │   ├── models/           # ORM models (7 archivos)
│   │   └── schemas/          # Pydantic schemas (3 archivos)
│   └── main.py               # FastAPI app
├── frontend/
│   └── src/
│       ├── pages/            # 8 interfaces principales
│       ├── components/       # Componentes reutilizables
│       │   ├── farmacia/
│       │   ├── specialist/
│       │   ├── reception/
│       │   └── AtendidosHoy.jsx
│       ├── api/              # axiosClient
│       ├── App.jsx           # Routing por rol
│       └── index.css         # Estilos globales + Tailwind
└── docs/
    └── superpowers/          # Specs y planes de desarrollo
```

---

## 9. Usuarios del Sistema

| Username | Password | Rol | Nombre |
|----------|----------|-----|--------|
| recepcion | recepcion123 | recepcionista | Recepcionista |
| doctor | doctor123 | medico_emergencia | Medico de Emergencia |
| especialista | especialista123 | medico | Medico Especialista |
| farmacia | farmacia123 | jefe_farmacia | Jefe de Farmacia |
| oswaldo | admin123 | admin_sistemas | Oswaldo Garcia |

---

## 10. Notas Tecnicas

- **Timezone DB**: `America/Caracas` (UTC-4). Usar `CURRENT_DATE` en queries de fecha, no `datetime.now(utc)`.
- **Colision de IDs**: `medicamentos_catalogo` e `insumos_catalogo` comparten IDs. El endpoint unificado `/farmacia/inventario` retorna `tabla_origen` para desambiguar.
- **Tablas legacy**: `inventario_medicamentos` coexiste con las tablas nuevas. El backend busca en las 3.
- **JSONB**: `consultas.recetas`, `consultas.laboratorios`, `consultas.estudios`, `consultas.insumos` son campos JSONB.
- **Auth**: JWT con expiracion configurable. El rol en el JWT determina la interfaz mostrada.
- **CHECK constraint**: `usuarios.rol` tiene un CHECK constraint con los roles permitidos.

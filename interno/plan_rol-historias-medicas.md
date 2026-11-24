# Plan de implementación — rol `historias_medicas`

## Objetivo

Habilitar el módulo de **Historia Clínica Integral (formato CITAB)** para el sistema
interno: un rol que busca al paciente por cédula, completa la ficha basal, registra
atenciones y emite reposos médicos con folio, dejando trazabilidad para nómina y
métricas para dirección.

## Alcance

- Rol nuevo `historias_medicas` (login, router, admin de usuarios y `App.jsx`).
- Tabla `historias_integrales` (una ficha por paciente, datos JSONB versionados).
- Tabla `reposos_medicos` (folio único, días 1/3/5/7, estado y anulación auditada).
- Columna `consultas.origen` + `consultas.historia_integral_id`.
- API: búsqueda/creación de paciente, ficha, atenciones, reposos, médicos y métricas.
- Interfaz `HistoriasMedicasInterface` con secciones Pacientes, Reposos y Métricas.
- Reporte PDF limpio (no réplica del Excel) de la ficha y del reposo.
- Reposos visibles para dirección con opción de anular.

## Flujo de trabajo

1. Recepción registra al paciente y lo pasa al médico de emergencia (`cola_atencion`).
2. El médico de emergencia atiende; la cola queda en `EN_CONSULTA` o `FINALIZADO`.
3. El usuario `historias_medicas` abre la sección **Pacientes**, que lista la cola del día
   (`GET /historias-medicas/cola`) y abre la ficha integral del paciente.
4. En **Nueva atención** registra motivo, examen, diagnóstico, tratamiento realizado,
   recetas médicas (catálogo + texto libre) y, si aplica, el reposo con fecha y días
   (1/3/5/7). El reposo se emite con folio en la misma transacción.
5. La atención queda en `consultas` con `origen='historia_integral'` y enlazada a la cola.

## Fuera de alcance

- Rediseño o reprogramación de citas.
- Réplica pixel a pixel de la hoja `CITAB`.
- Migración automática (el proyecto no usa Alembic).

## Capas

1. **Migración manual `019_historias_medicas.sql`**
   - `ALTER` del `CHECK` de `usuarios.rol`.
   - `historias_integrales`, `reposos_medicos`, secuencia de folio e índices.
   - `ALTER TABLE consultas` para `origen` y `historia_integral_id`.
2. **Backend**
   - Modelos ORM, esquemas Pydantic y endpoints `/historias-medicas`.
   - Permisos: lectura clínica amplia, escritura solo `historias_medicas`,
     anulación para `historias_medicas`, `admin_sistemas` y `director`.
   - Corrección del bug de `uuid` en `historias_clinicas.py`.
3. **Frontend**
   - Cliente API, configuración del formulario CITAB, formulario genérico,
     atención, reposos, métricas, PDF y sidebar.
   - Registro del rol en `App.jsx` y `SystemAdminInterface.jsx`.
4. **Pruebas**
   - Semilla del rol en `conftest.py`.
   - `test_historias_medicas.py`: permisos, ficha versionada, atención, reposo
     vinculado a nómina, anulación y métricas.

## Verificación

```powershell
cd interno/backend
python migrations/aplicar_sql.py migrations/019_historias_medicas.sql
python -m pytest tests/test_historias_medicas.py
python -m pytest

cd ..\frontend
npm test
npm run build
```

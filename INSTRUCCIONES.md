# BnaSalud · Instrucciones de la jornada

Notas para retomar el trabajo desde otro equipo/lugar. Última actualización: 13/08/2026.

## Versiones requeridas

> Versiones validadas en el equipo de desarrollo y mínimas recomendadas para correr el proyecto.

| Herramienta | Mínimo recomendado | Versión validada (este equipo) |
| --- | --- | --- |
| **Python** | 3.12+ | 3.14.4 |
| **Node.js** | 20.19+ (Vite 8 / Tailwind v4 lo exigen) | v24.15.0 |
| **npm** | 9+ (incluido con Node) | 11.12.1 |
| **Git** | 2.40+ | 2.54.0.windows.1 |

- **Python** se usa para el backend FastAPI (`venv`). Revisar `requirements.txt` instalará las dependencias compatibles.
- **Node/npm** se usan para el frontend React + Vite y la app móvil.
- **Git** solo para versionado; no hace falta una versión muy nueva.

## 1. Estado actual

- **Seguridad implementada** (backend + frontend):
  - Pacientes: acceso al portal con **cédula + PIN de 4-8 dígitos** (bcrypt en `historias_clinicas.pin_hash`).
  - Personal: **usuario + contraseña** contra la tabla `usuarios` (rol: superusuario | medico | farmaceutico | enfermero | paciente).
  - Tokens **JWT** (`app/core/security.py`), expiración 8 h por defecto (configurable en `.env` con `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRACION_MINUTOS`).
  - **Recuperación de PIN por correo**: `POST /auth/paciente/recuperar` genera un código de 6 dígitos (15 min, hasheado en `recuperacion_pacientes`); `POST /auth/paciente/reset` lo valida y restablece el PIN. Sin SMTP configurado, la API devuelve el código en `codigo_demo` (desactivar con `PIN_EMITIR_DEMO=false` en producción).
  - **Rutas protegidas por rol** (`app/api/v1/deps.py`): `pacientes/*`, `citas?cedula=`, `consultas/*`, `estudios/*` (órdenes/resultados/procesar). Un paciente solo ve sus propios datos.
- **Semilla demo** (`frontend/src/clinical/demo.js`):
  - 4 pacientes con historia clínica, citas, órdenes y médico tratante.
  - 4 doctores con credenciales y su cola de pacientes.
  - Panel flotante **"Demo"** (abajo a la derecha en Paciente/Doctores) para alternar la persona activa (persistida en `bna_persona_demo`).
- **Home**: sección "Cómo funciona" (registro → historia clínica → médico tratante → evolución) y el modal de cita muestra el **PIN inicial** al registrar al paciente por primera vez.

## 2. Pasos pendientes (activar datos reales en Supabase)

La base de datos remota **todavía no tiene las migraciones 0010-0013 aplicadas** (por eso el login devuelve 500/401 con datos reales). Ejecutar en el orden indicado:

1. **Supabase Dashboard → SQL Editor** → ejecutar, en este orden:
   - `supabase/migrations/0010_usuarios.sql`
   - `supabase/migrations/0011_optimizar_vinculos.sql`
   - `supabase/migrations/0012_vincular_medicos_pacientes.sql`
   - `supabase/migrations/0013_acceso_pacientes.sql`
   - `supabase/migrations/0014_entrega_recetas.sql`
   - `supabase/migrations/0015_cola_pacientes.sql`
   - `supabase/migrations/0016_trazabilidad_recetas.sql`
   - `supabase/migrations/0017_notificaciones.sql`
   - `supabase/migrations/0018_bitacora_acciones.sql`
2. **Sembrar datos** (idempotente):
   ```powershell
   venv\Scripts\python.exe -m app.db.seed
   ```
   - Contraseña de usuarios: `BnaSalud2026!`
   - PIN de pacientes: `1234` (cambiar después por recuperación)
3. **Verificar**:
   ```powershell
   venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
   ```
   - `POST /api/v1/auth/login` con `abello` / `BnaSalud2026!` → token + usuario.
   - `POST /api/v1/auth/paciente` con `18234567` / `1234` → token + paciente.
   - `GET /api/v1/pacientes/18234567` sin token → 401.

## 3. Credenciales de la semilla demo (sin backend)

| Rol | Usuario | Clave |
| --- | --- | --- |
| Pacientes | cédulas `0912345678` (María), `14302771` (Francisco), `24567890` (Ana), `16892345` (Rosa) | PIN `1234` |
| Doctores | `lfernandez` (Laura), `avalera` (Antonio), `mgonzalez` (María), `psanchez` (Pedro) | `1234` |
| Recuperación demo | cualquier correo registrado de un paciente | código `123456` |

## 4. Cómo correr el proyecto

```powershell
# Backend (FastAPI + Supabase)
venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload

# Frontend (React + Vite)
cd frontend
npm run dev        # http://localhost:5173
```

Rutas: `/` (home público), `/paciente` (portal paciente), `/doctores` (módulo médico), `/laboratorio` (resultados de estudios), `/farmacia` (login farmacéutico), `/admin` (supervisión + auditoría).

## 5. Pendientes / sugerencias para la próxima jornada

- Aplicar en Supabase SQL Editor las migraciones **0017 (notificaciones)** y **0018 (bitácora de auditoría)** — sin ellas la bitácora responde 500 y no hay historial de correos.
- Fases 8-10 del plan: reportes exportables, inventario multi-clínica con `movimientos_stock` (migración 0019) y despliegue.
- Configurar **SMTP real** para el envío del código de recuperación y poner `PIN_EMITIR_DEMO=false`.
- Cambiar `JWT_SECRET` por defecto en `.env` (valor seguro ≥ 32 bytes).
- Probar el flujo completo con backend real: reservar cita → PIN inicial → portal → historial → médico tratante.
# Usuarios clave para pruebas (QA)

Contraseña del personal: `BnaSalud2026!`
Contraseña de pacientes: la que cada uno define al registrarse (los pacientes creados por la semilla usan `Paciente2026!`).

## Un usuario por rol

| Rol | Usuario | Contraseña | Módulo | Nombre |
|---|---|---|---|---|
| `superusuario` | `abello` | `BnaSalud2026!` | `/admin`, `/farmacia`, `/laboratorio` | Administración |
| `medico` | `avalera` | `BnaSalud2026!` | `/doctores`, `/laboratorio` | Antonio Valera |
| `farmaceutico` | `cpereira` | `BnaSalud2026!` | `/farmacia` | Carlos Pereira |
| `enfermero` | `cruiz` | `BnaSalud2026!` | `/doctores`, `/laboratorio` | Enfermería |
| `paciente` | Cédula `18234567` | Contraseña definida al registrarse | `/paciente` | Carlos Mendoza |

## Accesos por módulo

| Módulo | Ruta | Roles permitidos |
|---|---|---|
| Portal público | `/` | Sin autenticación |
| Portal del paciente (CITAB) | `/paciente` | Paciente (cédula + contraseña) |
| Gestión de consultas | `/doctores` | `medico`, `enfermero`, `superusuario` |
| Farmacia | `/farmacia` | `farmaceutico`, `superusuario` |
| Laboratorio y estudios | `/laboratorio` | `medico`, `enfermero`, `superusuario` |
| Panel administrativo | `/admin` | `superusuario` |

## Otros usuarios de la semilla (mismo password)

- Médicos: `mgonzalez`, `lperez`, `psanchez`, `egomez`, `rdiaz`, `jblanco`, `sramos`
- Farmacéuticos (1 por centro): `mtorres`, `lhernandez`, `acastillo`, `rmedina`
- Enfermeros: `lmendoza`
- Pacientes (contraseña `Paciente2026!` en la semilla): `12345678` (María Rodríguez), `98765432` (José Pérez), `87654321` (Ana Rodríguez), `76543210` (Pedro García). Si la cuenta ya existía, hay que restablecer la contraseña desde el portal.

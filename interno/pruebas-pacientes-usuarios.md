# CITAB / BnaSalud — Compilación de Pacientes y Usuarios para Pruebas

> Fuente: `dump-bnasalud-202608301010.sql`
> Propósito: comenzar las pruebas funcionales de los módulos (moléculas de especialistas, emergencias, recepción, farmacia).

---

## 1. Usuarios del sistema por rol

### 1.1 Médicos especialistas (rol `medico`)

| Usuario | Médico | Especialidad | Cédula |
|---------|--------|--------------|--------|
| `avalera` | Antonio Valera | Cardiología | 11111111 |
| `mgonzalez` | María González | Pediatría | 22222222 |
| `lperez` | Luisa Pérez | Ginecología | 33333333 |
| `psanchez` | Pedro Sánchez | Medicina General | 55555555 |
| `egomez` | Elena Gómez | Oncología | 66666666 |
| `rdiaz` | Ramón Díaz | Medicina General | 77777777 |
| `jblanco` | Jorge Blanco | Medicina General | 88888888 |
| `sramos` | Sonia Ramos | Pediatría | 88888889 |
| `rosmaryhernandez` | Rosmary Sánchez | Medicina Interna | 10220380 |
| `yirasandoval` | Yira Sandoval | Medicina Interna | 15533733 |
| `carlosstanley` | Carlos Stanley | Medicina Interna | 17536936 |
| `jefersonsalazar` | Jeferson Salazar | Epidemiología | 17730683 |
| `edmilygomez` | Edmily Gómez | Oftalmología | 19190300 |
| `migdeliaarenas` | Migdelia Arenas | Oftalmología | 19275238 |
| `carlosortiz` | Carlos Ortiz | Ginecología | 24829475 |
| `joserivero` | José Rivero | Ginecología | 8266233 |
| `mairamarin` | Maira Marin | Pediatría | 13368680 |
| `adrianaramirez` | Adriana Ramírez | Pediatría | 16853320 |
| `chessaysnasilva` | Chessaysna Silva | Cirugía de Mano | 13316181 |
| `andreslaya` | Andrés Laya | Cirugía General | 19709911 |
| `orianahernandez` | Oriana Hernández | Cirugía General | 19672782 |
| `xiomaramendez` | Xiomara Méndez | Gastroenterología | 4361569 |
| `luciaobando` | Lucía Obando | Ecografía | 22705329 |
| `arcenorivero` | Arcenio Rivero | Fisiatría | 8265857 |
| `jhoniercardona` | Jhonier Cardona | Terapia de Conducta | 20358120 |
| `andreinaitriago` | Andreina Itriago | Traumatología | 20874654 |
| `ruthlopez` | Ruth López | Traumatología | 20873953 |
| `eneidatiapa` | Eneida Tiapa | Nefrología | 11423291 |

> **Nota:** Todos los usuarios listados en el dump comparten el **mismo hash de contraseña** (`$2b$12$oV8tx83...)`. Es la contraseña con la que ya iniciaste sesión como `avalera` u otro especialista. No se documenta aquí por seguridad.

### 1.2 Recepción y enfermería

| Usuario | Personal | Rol | Cédula |
|---------|----------|-----|--------|
| `rprueba` | Paula Recepción | `recepcionista` | — |
| `cruiz` | Carlos Ruiz (Enfermería) | `enfermero` | 44444444 |
| `lmendoza` | Laura Mendoza (Enfermería) | `enfermero` | 44444445 |

### 1.3 Farmacia

| Usuario | Personal | Cédula |
|---------|----------|--------|
| `cpereira` | Carlos Pereira | 99990001 |
| `mtorres` | María Torres | 99990002 |
| `lhernandez` | Luis Hernández | 99990003 |
| `acastillo` | Ana Castillo | 99990004 |
| `rmedina` | Rosa Medina | 99990005 |

### 1.4 Administración / Superusuario

| Usuario | Personal | Cédula |
|---------|----------|--------|
| `abello` | Adrián Bello (Superusuario) | 99990010 |

### 1.5 Médico de emergencias (prueba)

| Usuario | Personal | Cédula |
|---------|----------|--------|
| `eprueba` | (personal_id 17, comparte perfil normal) | 10220380 |

---

## 2. Pacientes por tipo (trabajador / beneficiario / público general)

### 2.1 Trabajador (empleado)

| Cédula | Nombre | Origen | Historia |
|--------|--------|--------|----------|
| 10000001 | Juan Perez Rodriguez | `empleados` — Administración/Analista, activo | HIS-V-10000001 |
| 10000001 | Juan Perez | `historias_clinicas` (usuario `jperez` no; este es prueba) | HIS-V-10000001 |

### 2.2 Beneficiario (familiar de trabajador)

| Cédula | Nombre | Parentesco | Historia |
|--------|--------|-----------|----------|
| 10000002 | Maria Perez | Hija de Juan Perez | HIS-V-10000002 |
| 10000002 | Maria Perez | beneficiario | HIS-V-10000002 |

### 2.3 Público general (con usuario de acceso)

| Usuario | Cédula | Nombre | Antecedentes | Alergias |
|---------|--------|--------|--------------|----------|
| `cmendoza` | 18234567 | Carlos Mendoza | Hipertensión | Penicilina |
| `pgarcia` | 76543210 | Pedro García | Dislipidemia | — |
| `jperez` | 98765432 | Juan Pérez | — | Sulfamidas |
| `arodriguez` | 87654321 | Ana Rodríguez | Diabetes gestacional | — |
| `mrodriguez` | 12345678 | María Rodríguez | Asma | — |

### 2.4 Pacientes de prueba (inscripción interna)

| Cédula | Nombre | Tipo |
|--------|--------|------|
| 10000001 | Juan Perez | Trabajador/Beneficiario (de facto empleado) |
| 99999999 | Publico | Público general |
| 10000002 | Maria Perez | Beneficiario |

---

## 3. Pacientes registrados en historias clínicas (para triaje/check-in)

Estos pacientes existen como registros de historia clínica (sin usuario de portal necesariamente) y pueden usarse para flujos de recepción/triaje/emergencia:

| Cédula | Nombre | Teléfono | Tipo de sangre | N° Historia |
|--------|--------|----------|----------------|-------------|
| 31087369 | Kali Rondon | 04122870986 | — | HIS-V31087369 |
| 18324298 | Adolfo Farias | 04120884647 | — | HIS-V18324298 |
| 19674244 | Adrian Bello | 04129451597 | O- | HIS-V19674244 |
| 15932487 | Crisangelis Caballero | 04124033301 | — | HIS-V15932487 |
| 17787893 | Oswaldo Garcia | 04248788827 | — | HIS-V17787893 |
| 18298540 | Adolfo Farias (dup) | 04120884647 | — | HIS-V18298540 |
| 17324297 | Adolfo Faria | 58424855257 | — | HIS-V17324297 |
| 24232876 | Rosmary Aguirre | 04129479862 | — | HIS-V24232876 |
| 14765304 | Normahira | 04248305909 | — | HIS-V14765304 |
| 30566244 | Oswaldo Garcia | 04248788827 | — | HIS-V30566244 |
| 52555411 | Axel Bello | 04125253665 | — | HIS-V52555411 |

---

## 4. Flujo de prueba recomendado (módulo de especialistas)

1. **Recepción** (`rprueba`): check-in de un paciente (ej. `31087369` Kali Rondon o `99999999` Publico).
2. **Triaje/Emergencia** (`eprueba`): evaluar y derivar por especialidad, creando una **cita** para el especialista.
3. **Especialista** (`avalera` Cardiología, etc.): esperar a que la cita sea "hoy", ver la cola filtrada por especialidad y atender al paciente registrando la consulta.
4. **Farmacia** (`cpereira`): dispensar receta si se generó.

### Correspondencia cita → especialista

| Especialidad de la cita | Especialista de prueba |
|-------------------------|------------------------|
| Cardiología | `avalera` |
| Pediatría | `mgonzalez` / `sramos` |
| Ginecología | `lperez` |
| Medicina Interna | `rosmaryhernandez` / `yirasandoval` / `carlosstanley` |
| Traumatología | `andreinaitriago` / `ruthlopez` |
| Medicina General | `psanchez` / `rdiaz` / `jblanco` |

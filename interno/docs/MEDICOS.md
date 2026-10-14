# Médicos · Especialistas BnaSalud

Datos de los especialistas de la red, fieles al archivo `DATA DR.csv`.
Cédulas sin puntos en la base de datos (`personal.cedula`).

## Especialistas

| Especialidad | Especialista | Cédula | Horario |
| --- | --- | --- | --- |
| Médico Internista | Rosmary Del Carmen Sánchez Hernández | 10.220.380 | Jueves: 7:00 AM - 1:00 PM |
| Médico Internista | Yira Del Valle Sandoval Castro | 15.533.733 | Lunes: 7:00 AM - 1:00 PM |
| | | | Miércoles: 1:00 PM - 7:00 PM |
| Médico Internista | Carlos Eduardo Stanley Medina | 17.536.936 | Martes: 1:00 PM - 7:00 PM |
| | | | Jueves: 1:00 PM - 7:00 PM |
| Epidemiólogo | Jeferson Jair Salazar Pérez | 17.730.683 | Lunes: 1:00 PM - 7:00 PM |
| | | | Miércoles: 1:00 PM - 7:00 PM |
| Oftalmólogo | Edmily Eddimar Gómez Ruiz | 19.190.300 | Martes: 7:00 AM - 1:00 PM |
| | | | Viernes: 7:00 AM - 1:00 PM |
| Oftalmólogo | Migdelia José Arenas Barrios | 19.275.238 | Miércoles: 7:00 AM - 1:00 PM |
| | | | Jueves: 7:00 AM - 1:00 PM |
| Ginecólogo | Carlos José Ortiz Pérez | 24.829.475 | Lunes: 7:00 AM - 1:00 PM |
| | | | Miércoles: 1:00 PM - 7:00 PM |
| Ginecólogo | José Arcenio Rivero Brito | 8.266.233 | Lunes: 1:00 PM - 7:00 PM |
| | | | Jueves: 1:00 PM - 7:00 PM |
| Pediatra | Maira Josefina Marín Báez | 13.368.680 | Martes: 1:00 PM - 7:00 PM |
| | | | Miércoles: 1:00 PM - 7:00 PM |
| Pediatra | Adriana Cecilia Ramírez Farías | 16.853.320 | Lunes: 7:00 AM - 1:00 PM |
| | | | Viernes: 7:00 AM - 1:00 PM |
| Cirujano de Mano | Chessaysna Ioanna Silva Rodríguez | 13.316.181 | Lunes: 11:00 AM |
| Cirujano General | Andrés Emilio Laya Hernández | 19.709.911 | Miércoles: 1:00 PM - 7:00 PM |
| | | | Jueves: 7:00 AM - 1:00 PM |
| Cirujano General | Oriana Hernández | 19.672.782 | Martes: 1:00 PM - 7:00 PM |
| | | | Miércoles: 7:00 AM - 1:00 PM |
| Gastroenterólogo | Xiomara Méndez Márquez | 4.361.569 | Lunes: 1:00 PM - 7:00 PM |
| | | | Jueves: 1:00 PM - 7:00 PM |
| Ecografista | Lucía Del Valle Obando Urbáez | 22.705.329 | Martes: 1:00 PM - 7:00 PM |
| | | | Viernes: 1:00 PM - 7:00 PM |
| Fisiatra | Arcenio José Rivero Brito | 8.265.857 | Martes: 1:00 PM - 7:00 PM |
| | | | Jueves: 1:00 PM - 7:00 PM |
| Terapia de Conducta | Jhonier Cardona Grajales | 20.358.120 | Jueves: 7:00 AM - 1:00 PM |
| | | | Viernes: 7:00 AM - 1:00 PM |
| Traumatología | Andreína Itriago | 20.874.654 | Jueves: 7:00 AM - 1:00 PM |
| | | | Viernes: 7:00 AM - 1:00 PM |
| Traumatología | Ruth Sarai López Moy | 20.873.953 | Miércoles: 1:00 PM - 7:00 PM |
| | | | Jueves: 1:00 PM - 7:00 PM |
| Nefrología | Eneida Del Carmen Tiapa Pérez | 11.423.291 | Martes: 1:00 PM - 7:00 PM |
| | | | Viernes: 1:00 PM - 7:00 PM |

## Mapeo a la base de datos

- Tabla `personal` → ids 17-36, cargo `Médico`, cédulas normalizadas (sin puntos).
- Tabla `agenda_medicos` → `dia_semana`: 0=lunes, 1=martes, 2=miércoles, 3=jueves, 4=viernes (convención del sistema).
- Turnos: `Mañana` (07:00-13:00) = turno 2; `Tarde` (13:00-19:00) = turno 3. El horario de 11:00 AM se registra en el turno Mañana.
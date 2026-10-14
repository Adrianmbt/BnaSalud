@echo off
rem ============================================================================
rem  BnaSalud - Lanzador Principal Unificado
rem  Inicia la API Asistencial (:8000), la Web Interna (:3000)
rem  y la Web Publica de Pacientes (:5173).
rem ============================================================================
cd /d "%~dp0interno"
call arrancar-servidores.bat

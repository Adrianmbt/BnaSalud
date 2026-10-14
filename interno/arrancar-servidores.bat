@echo off
rem ============================================================================
rem  BnaSalud / CITAB - arranque de los servidores de desarrollo
rem
rem    1. API   FastAPI  -> http://localhost:8000
rem    2. Web   Vite     -> http://localhost:3000  (host:true, visible en la LAN)
rem    3. Movil adb reverse tcp:8000 -> el telefono alcanza la API
rem
rem  Uso: doble clic, o "arrancar-servidores.bat" desde una terminal.
rem  Para parar cada servidor: Ctrl+C o "exit" en su ventana.
rem ============================================================================
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
title BnaSalud - Servidores

rem --- Rutas -------------------------------------------------------------------
rem El .venv del backend es el que tiene las dependencias; "python" del PATH es
rem el plan B. Absolutas porque "start /D" cambia la carpeta de trabajo.
set "PY=%~dp0backend\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

set "ADB="
if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not defined ADB if exist "%USERPROFILE%\android-sdk\platform-tools\adb.exe" set "ADB=%USERPROFILE%\android-sdk\platform-tools\adb.exe"
if not defined ADB for /f "delims=" %%a in ('where adb 2^>nul') do if not defined ADB set "ADB=%%a"

rem --- Comprobaciones previas --------------------------------------------------
if not exist "backend\.env" (
  echo [FALTA] backend\.env - sin DATABASE_URL el backend no arranca.
  echo         Copialo de un entorno que funcione y ajusta la cadena de conexion.
  echo.
  pause
  exit /b 1
)
if not exist "frontend\node_modules" (
  echo [FALTA] frontend\node_modules - ejecuta:  cd frontend ^&^& npm install
  echo.
  pause
  exit /b 1
)

rem --- Puerto ya ocupado -------------------------------------------------------
rem Los servidores sobreviven a la sesion anterior. Abrir una segunda ventana con
rem el mismo puerto solo produce "address already in use".
set "API_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"TCP .*:8000 .*LISTENING"') do set "API_PID=%%p"
set "WEB_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"TCP .*:3000 .*LISTENING"') do set "WEB_PID=%%p"

if defined API_PID (
  echo [OK] API ya escuchando en 8000 ^(pid !API_PID!^) - no se abre otra ventana.
) else (
  echo Levantando API en 8000...
  start "BnaSalud API :8000" /D "%~dp0backend" cmd /k ""%PY%" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
)

if defined WEB_PID (
  echo [OK] Web ya escuchando en 3000 ^(pid !WEB_PID!^) - no se abre otra ventana.
) else (
  echo Levantando Web en 3000...
  start "BnaSalud Web :3000" /D "%~dp0frontend" cmd /k "npm run dev"
)

rem --- Web Publica (Pacientes / Citas) en 5173 ---------------------------------
set "PUB_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"TCP .*:5173 .*LISTENING"') do set "PUB_PID=%%p"
set "DIR_PUB=%~dp0..\BnaSalud\frontend"

if exist "%DIR_PUB%" (
  if defined PUB_PID (
    echo [OK] Web Publica ya escuchando en 5173 ^(pid !PUB_PID!^) - no se abre otra ventana.
  ) else (
    echo Levantando Web Publica en 5173...
    start "BnaSalud Web Publica :5173" /D "%DIR_PUB%" cmd /k "npm run dev"
  )
)

rem --- Movil: adb reverse ------------------------------------------------------
rem El APK corre en nativo con el bundle incrustado, asi que el telefono NO usa
rem el puerto 3000. Lo que necesita es que "localhost:8000" DENTRO del telefono
rem llegue a la API de esta maquina; de ahi el reverse.
rem
rem "adb devices" lista el telefono de dos formas y valen las dos:
rem    192.168.1.50:5555              (host:puerto, cambia al reconectar)
rem    adb-XXXXXXXX._adb-tls-connect._tcp   (alias mDNS, se reconnecta solo)
rem Antes solo aceptaba la primera: al cambiar de red el telefono volvio por
rem alias mDNS y el script se rindio dizendo que no habia telefono.
rem Se da prioridad a host:puerto y se cae al alias. Sin -s "adb reverse" aborta
rem con "more than one device", y el alias puede llevar un espacio (variante
rem "... (2)...."), de ahi que siempre viaje entrecomillado.
rem
rem Ojo: dentro de un for /f no se puede combinar ruta entrecomillada + pipe +
rem findstr; la salida de adb va a un archivo temporal.
rem Ojo 2: la linea de "adb devices" se PARTE POR TAB (las 2 columnas van
rem tabuladas). Partir por espacio rompe el alias mDNS cuando este lleva un
rem espacio dentro del nombre (variante "... (2)..."): "tokens=1" lo cortaria
rem a la mitad y "delims=" (sin separador) meteria tambien el "device" final.
rem El "delims=" de abajo contiene un TAB literal.
set "DEV="
set "ALIAS="
if defined ADB (
  "%ADB%" devices > "%TEMP%\adb-devices.txt" 2>nul

  rem 1) Preferir host:puerto: es el identificador estable.
  for /f "tokens=1 delims=	" %%a in ('findstr /R /C:"device$" "%TEMP%\adb-devices.txt"') do (
    set "C=%%a"
    if not defined DEV (
      if not "!C::=!"=="!C!" ( set "DEV=%%a" ) else ( set "ALIAS=%%a" )
    )
  )

  rem 2) Si no hay host:puerto, conectar con lo que el telefono anuncia por
  rem    mdns: al cambiar de red el telefono vuelve por su alias, el script
  rem    entonces CONECTA el movil en vez de solo avisar.
  rem    El nombre del servicio mdns tambien puede traer un espacio (variante
  rem    "... (2)..."), con lo que "tokens=3" por espacio-tab se corre una
  rem    columna y toma el tipo "_adb-tls-connect._tcp" por el host:puerto.
  rem    Por eso el mdns tambien se parte por TAB: columnas <nombre> <tipo>
  rem    <host:puerto>, con el TAB literal de abajo.
  if not defined DEV (
    "%ADB%" mdns services > "%TEMP%\adb-mdns.txt" 2>nul
    set "DESCUBIERTO="
    for /f "tokens=3 delims=	" %%a in ('findstr "_adb-tls-connect" "%TEMP%\adb-mdns.txt"') do (
      if not defined DESCUBIERTO set "DESCUBIERTO=%%a"
    )
    if defined DESCUBIERTO (
      echo Conectando con el movil en !DESCUBIERTO! ...
      "%ADB%" connect "!DESCUBIERTO!" >nul 2>&1
      "%ADB%" devices > "%TEMP%\adb-devices.txt" 2>nul
      for /f "tokens=1 delims=	" %%a in ('findstr /R /C:"device$" "%TEMP%\adb-devices.txt"') do (
        set "C=%%a"
        if not defined DEV if not "!C::=!"=="!C!" set "DEV=%%a"
      )
      if not defined DEV if defined ALIAS set "DEV=!ALIAS!"
    )
  )

  rem 3) Sin host:puerto, vale el alias mDNS que se viera en el paso 1.
  if not defined DEV if defined ALIAS set "DEV=!ALIAS!"
)

if not defined ADB (
  echo [AVISO] No encontre adb - el movil no tendra puente a la API.
  goto resumen
)
if not defined DEV (
  echo [AVISO] No hay telefono conectado por ADB.
  echo.
  echo   Al cambiar de red Wi-Fi hay que volver a emparejar UNA vez:
  echo     1. En el telefono: Ajustes ^> Acerca del telefono ^> pulsas
  echo        "Numero de compilacion" 7 veces ^> Opciones de desarrollador.
  echo     2. Ajustes ^> Opciones de desarrollador ^> "Depuracion wireless" ^> ON.
  echo     3. Toca "Emparejar dispositivo con codigo PIN": aparecera
  echo        "IP:puerto" y un codigo de 6 digitos.
  echo     4. En esta ventana ejecuta:
  echo        adb pair IP:PUERTO
  echo        y teclea el codigo. A partir de ahi se reconecta solo.
  goto resumen
)

"%ADB%" -s "!DEV!" reverse tcp:8000 tcp:8000 >nul 2>&1
if errorlevel 1 (
  echo [AVISO] No pude crear el reverse con el id "!DEV!" - revisa "adb devices".
  echo         Si el id lleva un espacio al final del nombre, copialo CON comillas:
  echo           adb -s "ID" reverse tcp:8000 tcp:8000
  echo         y acepta el dialogo "Permitir depuracion" en el telefono.
) else (
  echo [OK] Movil "!DEV!" con tcp:8000 apuntando a la API de esta maquina.
)

:resumen
rem "ipconfig" cambia de texto segun el idioma del Windows, pero la linea de la
rem IPv4 siempre acaba en "<dos puntos> <ip>". Se parte por ":" y se descarta lo
rem que no sea una IPv4 (loopback y 169.254).
set "LAN=localhost"
for /f "tokens=1,2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
  set "IP=%%b"
  set "IP=!IP: =!"
  echo !IP! | findstr /R /C:"^[0-9][0-9]*\.[0-9][0-9]*\." >nul && set "LAN=!IP!"
)

echo.
echo ---------------------------------------------------------------------------
echo  Web Interna (esta maquina)   http://localhost:3000
echo  Web Interna (desde el movil) http://!LAN!:3000
echo  Web Publica (Pacientes)      http://localhost:5173
echo  API Docs (FastAPI)           http://localhost:8000/docs
if defined DEV (
  echo  Movil en primer plano:
  echo    adb -s "!DEV!" shell dumpsys activity activities ^| findstr mResumedActivity
) else (
  echo  Movil: sin conectar por ADB ^(los servidores de arriba funcionan igual^)
)
echo.
echo  Para poner la app en el telefono:
echo    cd frontend ^&^& npm run cap:run     ^(build + sync + install + launch^)
echo ---------------------------------------------------------------------------
echo.
pause
endlocal
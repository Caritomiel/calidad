@echo off
title Control Calidad - App para celular
cd /d "%~dp0"
echo.
echo ===============================================
echo  CONTROL DE INSPECCIONES Y REPARACIONES
echo ===============================================
echo.
echo Abra esta direccion en el celular conectado al mismo Wi-Fi:
echo.
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%B in ("%%A") do echo   http://%%B:8766/index.html
)
echo.
echo Si Windows pregunta, permita el acceso a Python en redes privadas.
echo Para cerrar la app, cierre esta ventana.
echo.
python server.py 8766
pause

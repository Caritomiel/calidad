# Control de Inspecciones y Reparaciones

Aplicacion web estatica para registrar inspecciones, reinspecciones y reparaciones de produccion.

## Como usarla

1. Abra `index.html` en Chrome, Edge, Safari o el navegador del telefono.
2. En Android o iPhone tambien puede abrirla desde una direccion `http://...` si se publica en una PC, servidor interno o hosting.
3. Use los botones principales para iniciar una inspeccion, reinspeccion o reparacion.
4. Guarde el inicio y cierre el registro cuando termine el trabajo.
5. Consulte por clave de proyecto, pieza, persona, tipo, estado o fechas.
6. Exporte CSV para Excel o respaldo JSON para conservar los datos.

## Datos incluidos

Los proyectos activos precargados son:

- EZ: Estacionamiento Zumaya
- AN: Ampliacion Nave
- 71+780: Puente KM 71+780
- 66+900: Puente KM 66+900
- 64+820: Puente KM 64+820
- 50D: 50 Doctors

Cuando se abre usando `INICIAR_APP_CELULAR.bat`, la informacion se guarda en `database.json` y todos los celulares conectados al mismo link consultan el mismo historial.

## Abrir desde celular en la misma red

1. En la computadora, abra `INICIAR_APP_CELULAR.bat`.
2. Si Windows pregunta por permisos de red, permita acceso en redes privadas.
3. En el celular, conectado al mismo Wi-Fi, abra la direccion que muestra la ventana.
4. Deje abierta la ventana negra del servidor mientras el personal use la app.

Ejemplo: `http://192.168.1.67:8766/index.html`

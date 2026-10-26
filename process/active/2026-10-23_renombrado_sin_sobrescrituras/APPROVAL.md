# Autorización y estado

Alcance autorizado por Biglex: identificar conflictos de renombrado y permitir deshacer sin perder archivos. Implementación local en `preview`; no se atribuye aceptación funcional a Biglex.

Ampliación autorizada: Shift + arrastrar acumula tandas; el contador salta automáticamente los nombres ocupados y muestra el resultado antes de renombrar.

Pruebas técnicas: build web correcto, cargo check correcto y 33 pruebas aprobadas (16 del backend y 17 de acumulación/orden/contador/saltos). Pendiente: comprobar el flujo de interfaz y el gesto físico desde el Explorador con este ajuste. El historial permanece en memoria durante la ejecución de la aplicación; esta corrección no recupera bytes sobrescritos previamente.

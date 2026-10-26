# Cesión del fondo entre Stable y Dev

## Objetivo autorizado
Al abrir Dev, Stable cede el control de sus fondos y bloquea sus controles. Al salir normalmente de Dev, Stable recupera el fondo y composición que tenía activos. Biglex aclaró que no solicita pruebas de cierre forzado.

## Implementación
- Dos reservas exclusivas por usuario en LOCALAPPDATA/com.biglexj.prisma-session: presencia de Dev y propietario del escritorio. Las reservas son handles de archivo abiertos sin compartición de Windows; no se intercambian preferencias entre perfiles.
- Stable suspende motor y composición, conserva en memoria el medio y la pausa, confirma la destrucción nativa de la superficie 3D y del host, y solo entonces libera el escritorio.
- Dev espera fuera del hilo UI. Al salir, la reserva se libera y Stable reconstruye su fondo y sus capas. No se reactiva un fondo que Stable tenía detenido.
- Interfaz, bandeja y comandos quedan bloqueados durante la cesión.
- Si otra versión conserva un host anterior al protocolo, la nueva espera y explica que se requiere actualizarla.
- La edición instalada 2.0.0 requiere actualizarse a 2.0.1 para participar. No se publica ni reemplaza automáticamente esa instalación.

## Validación
Prueba reproducible con perfiles y WebView2 aislados mediante scripts/diagnostics/Test-WallpaperHandoff.ps1, composición Borealis y una imagen local. Verifica ambos órdenes de arranque y salida normal de Dev. Los resultados se registran en VALIDATION.md.

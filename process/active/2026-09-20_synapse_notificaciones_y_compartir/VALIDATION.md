# Validación: Synapse — Notificaciones y Compartir (v1.1.6)

## Criterios de Éxito
1. Compilación Rust sin advertencias críticas (`cargo check`).
2. Comprobación TypeScript frontend (`bun run check`).
3. Al recibir un archivo por `POST /upload` vía Aurora Synapse:
   - La ventana de Prisma no debe desminimizarse ni robar foco repentinamente.
   - El archivo no debe reproducirse/abrirse automáticamente interfiriendo con la sesión activa.
   - Debe dispararse la notificación nativa de Windows informando la recepción con nombre y tamaño.
   - Si la app está en primer plano, el `SynapseToast` permite abrir el archivo de forma consentida al pulsar "Abrir".
4. El menú contextual de Windows ofrece "Enviar con Aurora Synapse" y al pulsarse sobre un archivo abre el modal de envío de Synapse hacia dispositivos descubiertos.
5. Versión sincronizada a `1.1.6` en todos los manifiestos.

## Evidencia de Validación
- **Compilación Rust (`cargo check`)**: Ejecutado exitosamente en `src-tauri` (`prisma v1.1.6`) con código de salida 0 sin advertencias bloqueantes.
- **Validación TypeScript (`bun run check`)**: Ejecutado exitosamente (`tsc --noEmit`) con código de salida 0 y 0 errores.
- **Recepción no invasiva**: `bring_main_window_to_front` y `prisma://open-media` retirados del flujo de subida en `server.rs`. Se integró `tauri_plugin_notification` para emisión de alerta nativa al SO Windows.
- **Menú Contextual Windows**: Registrado en `HKCU\Software\Classes\*\shell\Prisma.SynapseSend` con argumento `--synapse-send "%1"`.
- **Enlace Frontend**: `prisma://synapse-send` y `synapse_get_initial_send_file` conectados a `setSendModalFile` en `App.tsx` (1,219 líneas, dentro del umbral de calidad).


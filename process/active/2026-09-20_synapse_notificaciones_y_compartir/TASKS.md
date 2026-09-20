# Tareas: Synapse — Notificaciones y Compartir (v1.1.5)

## Estado
En validación / Completado.

## Checklist

### 1. Consolidación de Ciclo v1.1.5
- [x] Consolidar versión en `1.1.5` en `package.json`, `Cargo.toml` y `tauri.conf.json` (al no haber sido publicada en GitHub Releases).
- [x] Registrar hito en `ROADMAP.md`, `RELEASE_NOTES.md` y `RELEASE_MESSAGE.md`.

### 2. Recepción no invasiva en Synapse
- [x] Modificar `src-tauri/src/features/synapse/server.rs`:
  - Retirar `bring_main_window_to_front` del endpoint `POST /upload`.
  - Retirar emisión automática de `prisma://open-media`.
  - Mantener emisión de `prisma://file-received`.

### 3. Notificación nativa de escritorio
- [x] Añadir `tauri-plugin-notification = "2"` en `src-tauri/Cargo.toml`.
- [x] Configurar plugin en `src-tauri/src/lib.rs` y permisos en capabilities (`default.json`).
- [x] Disparar notificación nativa en `server.rs` al completarse la descarga del archivo:
  - Título: `Aurora Synapse · LAN`
  - Contenido: `Archivo recibido: [nombre] ([tamaño] MB) · Guardado en Descargas\Prisma`

### 4. Integración Menú Contextual Windows ("Enviar con Aurora Synapse")
- [x] Añadir soporte de argumento `--synapse-send <ruta>` en `lib.rs` (arranque en frío y `single_instance`).
- [x] Registrar clave en registro de Windows en `file_associations.rs`:
  - `HKCU\Software\Classes\*\shell\Prisma.SynapseSend` ("Enviar con Aurora Synapse").
- [x] Conectar evento frontend `prisma://synapse-send` y `synapse_get_initial_send_file` a `SendToSuperGalleryModal` en `App.tsx`.

### 5. Documentación y Requisitos Windows 11 Share Target
- [x] Documentar requisitos de MSIX / Sparse Package y `windows.shareTarget` para la hoja de ruta del ecosistema Aurora.


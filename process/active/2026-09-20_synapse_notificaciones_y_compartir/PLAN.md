# Plan: Synapse — Recepción no invasiva, Notificaciones nativas e Integración Windows (v1.1.6)

## Objetivo
Resolver la intrusión al recibir archivos vía Aurora Synapse desde el teléfono a la PC (eliminando la apertura y reproducción forzada "de golpe"), sustituyéndola por notificaciones del sistema no invasivas con apertura bajo demanda, elevar la versión del proyecto a `v1.1.6`, e implementar / diseñar la integración en el menú contextual de Windows ("Enviar con Aurora Synapse") y el contrato de Compartir de Windows 11 ("Compartir por medio").

## Alcance
1. **Recepción no invasiva en Synapse (`server.rs`)**:
   - Eliminar `bring_main_window_to_front` y `prisma://open-media` automáticos al recibir un archivo en `POST /upload`.
   - Preservar la emisión de `prisma://file-received` para refresco silencioso de bibliotecas y visualización de `SynapseToast` cuando la app esté en primer plano.
2. **Notificaciones Nativas de Windows**:
   - Integrar `tauri-plugin-notification` para emitir una notificación del sistema operativo con el nombre y tamaño del archivo guardado en `Downloads/Prisma`.
3. **Elevación de Versión (v1.1.6)**:
   - Incrementar versión en `package.json`, `Cargo.toml`, `tauri.conf.json` e inicializar ciclo en `ROADMAP.md` y `RELEASE_NOTES.md`.
4. **Integración con Menú Contextual de Windows ("Enviar con Aurora Synapse")**:
   - Agregar flag CLI `--synapse-send <ruta>` manejado en arranque y por `single_instance`.
   - Registrar la entrada en el registro de Windows (`HKCU\Software\Classes\*\shell\Prisma.SynapseSend`) en `file_associations.rs`.
   - Conectar el evento a `SendToSuperGalleryModal` en el frontend.
5. **Arquitectura y Requisitos para el Diálogo "Compartir" de Windows 11**:
   - Documentar con precisión técnica los requisitos de MSIX / Sparse Package e identidad de paquete (`windows.shareTarget`) para el ecosistema Aurora / Prisma.

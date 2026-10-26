# Validación

PASS `bun test tests/mobile-audio-shortcut.test.ts`: dos pruebas, diez aserciones. Incluye tecla física con distribución distinta, pulsaciones independientes y exclusión de modificadores del atajo global, repetición y composición.

PASS `bun run check`. PASS `cargo test --manifest-path src-tauri/Cargo.toml --lib features::audio_relay::tests`: tres aprobadas, tres pruebas físicas ignoradas por defecto.

El estado enabled del frontend ya no decide si el backend debe encender o apagar: la alternancia se realiza bajo su mutex de transición. Es una corrección preventiva de desincronización; no se ha reproducido y atribuido de forma concluyente el fallo de Shift+T en la instalación anterior.

El OSD usa una entrada Vite independiente sin React ni comandos IPC. El texto se serializa a JSON y se asigna con textContent. La ventana no recibe foco ni ratón y no se guarda con window-state.

PASS `bun run tauri build --debug --no-bundle`: TypeScript, Vite (incluye audio-toast.html) y Rust; ejecutable src-tauri/target/debug/prisma.exe. PASS diff-check de los archivos afectados.

Pendiente: aviso visible fuera de Prisma y prueba de ambos atajos en esa compilación. No se ha cerrado ni sustituido el Prisma instalado.

Biglex elige dejar pendiente la prueba y confirma después que ahora envían tanto Shift+T como el atajo global. Esta confirmación corresponde a su instancia actual: no se lanzó el ejecutable recién compilado y no valida el nuevo OSD. El fallo previo de Shift+T es intermitente; no se atribuye su recuperación al código que aún no está cargado.

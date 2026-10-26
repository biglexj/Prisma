# Validación — 2026-10-26

- [x] `bun run build`: TypeScript y Vite correctos con la pestaña Vídeos inicial y bloqueo de controles en Inicio/Fondos Vivos. Advertencia existente de tamaño de chunks.
- [x] Prueba independiente de exclusión Windows (`rustc --test .../desktop_lease.rs`): 1 aprobada. El handle impide un segundo propietario y permite reutilizar la reserva tras liberarla.
- [x] Compilación nativa release optimizada 2.0.1 con `tauri/custom-protocol`.
- [x] Prueba real de dos procesos: `scripts/diagnostics/Test-WallpaperHandoff.ps1`.
  - Stable → Dev → Stable: motor y ventana 3D de Stable cerrados antes de la cesión, comandos rechazados durante la espera y medio/composición restaurados después de salir Dev.
  - Dev → Stable en espera → Stable: Stable permanece sin fondo mientras Dev está abierto y lo recupera al salir Dev.
  - Composición Borealis e imagen local; perfiles de biblioteca y WebView2 aislados. Salida normal mediante `app.exit(0)`; no se realizó una prueba de cierre forzado.
  - Evidencia completa: `temp/handoff-tests/session-20261026-181341/evidence.json`, resultado `passed`, 2 casos.
  - SHA-256 del ejecutable probado: `70F9135A5FD0EC03978FD703B7AB336D5A114C564594CF0A9B2115C68084ECA4`.
- [x] Revisión interactiva de Dev: pestaña Vídeos y su panel visibles, controles Mezcla/Encuadre en el orden solicitado. El fondo de la instancia abierta se detuvo temporalmente para las pruebas; al finalizar esa instancia ya no estaba abierta.
- [x] Instalador Inno 2.0.1 generado y validador de empaquetado correcto. Archivo: `release/Prisma_2.0.1-setup.exe` (161,5 MB). SHA-256: `0f11fe2d0449a834cfb90da11ae136904dbfca2e761f4c40f610617d982fb0ed`. La plantilla fijada se reutilizó sin cambios visuales; se actualizó su versión de destino a 2.0.1.
- [ ] Instalación y aceptación de Biglex: pendientes. No se reemplazó la instalación 2.0.0 ni se publicó la nueva versión.

El primer intento aprobó el primer caso y detectó un fallo de preparación al reutilizar la carpeta del diagnóstico. Se corrigió la preparación para ser idempotente y se repitieron ambos casos con resultado correcto.

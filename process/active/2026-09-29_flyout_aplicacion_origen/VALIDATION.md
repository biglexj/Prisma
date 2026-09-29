# Validación

## Comprobado

- `bun run build`: TypeScript y Vite correctos, 277 módulos. Aviso existente de tamaño de bundle.
- `bun test tests/flyout-media.test.ts tests/flyout-auto-hide.test.ts tests/system-volume-writer.test.ts`: 15 pruebas, 43 comprobaciones, sin fallos.
- `git diff --check`: correcto.
- Compilación nativa por el watcher: correcta en 51,84 s; después de corregir los bloques unsafe, correcta en 9,22 s sin esas advertencias.
- Ajuste final: identificación en el worker y activación en el hilo de interfaz. El watcher regeneró `prisma.exe` a las 17:52:09, posterior a la fuente final de las 17:51:54.
- Sonda de lectura temporal que compila el módulo nativo real: `cargo run --offline --manifest-path temp/system-media-probe/Cargo.toml --target-dir src-tauri/target`, salida correcta: consulta de Windows exitosa, sin sesión externa activa en ese momento. La sonda solo lee; no modifica volumen, reproducción ni foco.

## Pendiente

- Clic en Prisma, restauración desde minimizado y apertura de aplicación externa.
- Recepción de metadatos y controles con una aplicación externa que publique una sesión; no había una disponible durante la sonda.

## Límites

- Windows solo expone aplicaciones que publican sesiones multimedia.
- Mientras Prisma reproduce, su tarjeta conserva prioridad. Las consultas externas solo ocurren con el flyout visible y Prisma detenido o pausado.
- Una identidad desconocida conserva el transporte de su sesión, pero el distintivo usa Prisma como respaldo.
- No se confunde compilación con funcionamiento físico de los controles.

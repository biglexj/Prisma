# Validación

- El código anterior lanzaba PowerShell oculto, descartaba el resultado de `spawn`, liberaba manualmente el plugin de instancia única y pedía `exit(0)`.
- El código local de Tauri 2.11.5 documenta `request_restart` para entregar `RunEvent::ExitRequested` y `RunEvent::Exit` incluso desde el hilo principal. `App::run` entrega Exit a los plugins y al cierre de audio antes de limpiar y relanzar el proceso. El plugin de instancia única ya libera sus recursos al recibir Exit.
- `bun test tests`: PASS, 56 pruebas y 219 aserciones. Comprueba regresiones del frontend; no prueba el reinicio nativo.
- PASS `cargo build --bin prisma`: compilación Dev nativa completada, sin errores. Dev se abrió desde el ejecutable actualizado con `--dev`, PID inicial 20244; la instalación habitual no se sustituyó.
- PASS `bun run build`: TypeScript y Vite, con los avisos conocidos sobre tamaño de bundle e importación mixta.
- PASS `git diff --check` para los cambios revisados.
- PASS botón real de la bandeja: Biglex confirma «Se reinicia y vuelve a abrir». El PID anterior 20244 terminó y el proceso nuevo 52640 declara como padre a 20244, conserva `--dev` y ejecuta el binario actualizado. Solo hay un proceso Prisma activo, sin duplicados.
- Biglex acepta el resultado: «listo queda». La comprobación cubre Dev; no sustituye ni prueba una instalación de release.

# Audio en directo — Validación

- Estado: `IN_PROGRESS`; compilaciones y pruebas unitarias pasan, aceptación física en curso.

## Evidencia de planificación

- [x] Revisados frontend Prisma, Synapse/DSP registrados en HEAD `1f8c00d` y clientes/servicios Android HEAD `566dd8f`.
- [x] Confirmado que `src-tauri/` no existe en el árbol Prisma al revisar; sus eliminaciones y los cambios previos se preservaron.
- [x] Diferenciado envío de archivos/handoff de un flujo de audio en directo.
- [x] Contrastadas las APIs relevantes con documentación oficial Microsoft/Android.

## Comprobaciones tras implementar

- [ ] V01 — Agente — Backend vigente disponible y diferencias locales revisadas; cambios ajenos preservados.
- [ ] V02 — Agente — `bun run check`, pruebas frontend afectadas, `cargo check --manifest-path src-tauri/Cargo.toml --features mpv` y pruebas Rust pertinentes. Registrar comandos y resultados reales.
- [ ] V03 — Dispositivos — Abrir Super Gallery con Synapse disponible, sin segundo emparejamiento. Habilitar desde Ecualizador → «Usar el teléfono como altavoz»: un clic, audio de Windows audible en teléfono sin abrir la app móvil; navegar fuera del Ecualizador y minimizar Prisma mantiene la salida.
- [ ] V04 — Dispositivos — Repetir sin salida física audible y con modo solo teléfono; volver a salida anterior sin dejar Windows en silencio ni alterar el volumen del stream involuntariamente.
- [ ] V05 — Dispositivos — Mantener habilitado, reproducir música/video, dejar 10 minutos de silencio y reanudar con otra app Windows. Sin apagar/reabrir la salida ni perder el inicio de señal. Probar también clips de 1–5 s como comprobación adicional.
- [ ] V06 — Dispositivos — Medir latencia acústica extremo a extremo con un evento de referencia compartido; registrar configuración/red, mediana y p95. Objetivo ≤150 ms en red estable, sujeto a medición.
- [ ] V07 — Dispositivos — Ejecutar al menos 60 minutos, incluyendo silencio prolongado y cambios de fuente; medir deriva, búfer, cortes y consumo. La salida sigue habilitada hasta apagarla; no reproducir audio antiguo tras congestión o reconexión.
- [ ] V08 — Dispositivos — Apagar pantalla 15 minutos durante recepción, cambiar de app, cortar/restaurar Wi-Fi y cambiar IP; recuperación cuando el receptor sigue disponible. Probar aparte servicio detenido y app forzada a detenerse: estado no disponible, sin promesas de despertar.
- [ ] V09 — Dispositivos — Probar USB/Bluetooth, quitar auriculares y recibir llamada. Audio focus y pausa segura sin imponer la ruta guardada.
- [ ] V12 — Agente/Dispositivos — Comprobar huella TLS recordada, detener sesiones duplicadas y comprobar cifrado/identidad. La primera asociación hereda la LAN de Synapse y no autentica la PC. Una IP nueva no cambia la identidad.
- [ ] V13 — Dispositivos — Archivos, handoff, remoto, DSP, MPV/HTML y salidas múltiples existentes conservan comportamiento; sin doble procesamiento ni eco.
- [x] V14 — Agente — `git diff --check` sin errores (avisos de CRLF en archivos previos). Los ocho documentos nuevos, enlaces cruzados y ausencia de variables de plantilla/conflictos/espacios finales se comprobaron. Esta entrega solo añadió las dos carpetas de planificación.
- [ ] V15 — Dispositivos — Usar el atajo global con otra app delante: alterna el mismo estado del Ecualizador y muestra aviso breve. Repetir pulsaciones rápidas y probar combinación ocupada: sin sesiones duplicadas ni cambios accidentales en salidas físicas.
- [ ] V16 — Dispositivos — Apagar desde Ecualizador, atajo y notificación Android por separado. Ambos extremos quedan desactivados, sin reconexión espontánea. Volver a habilitar reutiliza el teléfono elegido; cerrar/reabrir Prisma recuerda el destino pero no envía audio sin activación.
- [ ] V17 — Dispositivos — Usar teléfono solo y junto a salidas físicas con ganancias/retardos guardados. Activar/desactivar el teléfono conserva configuración y funcionamiento de las salidas múltiples existentes.

## Evidencia de implementación — 2026-10-06

- `bun run check`: correcto. `git diff --check`: correcto (avisos CRLF, sin errores de espacios).
- `cargo test --manifest-path src-tauri/Cargo.toml --features mpv audio_relay --lib`: tres pruebas aprobadas (encuadre acotado, PCM y DPAPI); prueba física optativa separada. Compila y enlaza Windows.
- Android `:app:assembleDebug :app:testDebugUnitTest`: correcto; tres pruebas nuevas del protocolo y parada explícita.
- APK debug instalado mediante ADB en Motorola Edge 60 Fusion. Instrumentación propia informa receptor listo; falta validar arranque normal desde Ajustes.
- Interfaz de Ecualizador y panel móvil observados en navegador de desarrollo. El navegador carece del IPC Tauri; no valida controles nativos ni conexión.
- Primera prueba física falló antes de autenticar: EOF durante handshake TLS. Diagnóstico en curso; no acredita reproducción.
- Pendientes: conexión/captura/reproducción completas, selector del fabricante y Bluetooth, atajo con app en segundo plano, 60 min de sesión, 10 min de silencio, 15 min de pantalla apagada, latencia audio audible y congestión.

## Evidencia actual — 2026-10-07

- Prisma: `bun run check` y `bun run build` aprobados. Rust: dos pruebas automáticas aprobadas y una prueba física optativa ignorada; ya no se usa DPAPI.
- Android: `:app:assembleDebug :app:assembleDebugAndroidTest :app:testDebugUnitTest` aprobados e instalación física correcta.
- El teléfono responde al estado Synapse y a HTTP Upgrade 101 en el mismo puerto 49288. TLS falla antes del control de audio; diagnóstico en curso, todavía sin reproducción acreditada.
- El panel ya elimina PIN/IP/confirmación de identidad; la primera selección usa Synapse automáticamente.
- Aceptación pendiente: audio audible, atajo nativo, rutas/notificaciones/Bluetooth, 60 min, silencio de 10 min, pantalla apagada 15 min y latencia acústica.

### Prueba física del canal — 2026-10-07

- TLS nativo Android corregido: Conscrypt firma un digest ya calculado con `NONEwithECDSA`; la identidad EC debe autorizar `DIGEST_NONE` además de SHA-256. Clave privada sigue en AndroidKeyStore; no se añadió proveedor externo. [Código de Conscrypt](https://github.com/google/conscrypt/blob/master/common/src/main/java/org/conscrypt/CryptoUpcalls.java).
- `PRISMA_AUDIO_PROBE_ADDRESS=192.168.1.103`, prueba Rust optativa `real_phone_capture_silence_and_reconnect`: aprobada en 90,49 s. 261.600 frames estéreo, 431.304 muestras no nulas, 82 heartbeats; 10 s sin PCM y reconexión conservando sesión aprobados. Audio capturado por WASAPI de Windows, tono de prueba generado en su salida predeterminada.
- Android informa AudioTrack 48 kHz estéreo con actividad y MediaSession PrismaAudio en PLAYING. Esto confirma transporte, captura y reproducción iniciada; audibilidad requiere confirmación de Biglex y latencia acústica sigue sin medir.
- Synapse mantiene conexión con un PC cercano: se declara `connectedDevice` en lugar de usar `dataSync` para disponibilidad continua. [Tipos oficiales Android](https://developer.android.com/develop/background-work/services/fgs/service-types#connected-device). Pendiente instalar y comprobar esta última revisión.

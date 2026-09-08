# Recuperación de audio y conversor de Prisma

## Cambios

- La preferencia de modo global persiste aunque WASAPI deje de funcionar. Un reconciliador secuencial reintenta cada segundo; los endpoints se actualizan cada dos segundos y al recuperar el foco.
- Los errores de captura/salida terminan el puente inválido, permitiendo reconstruirlo. Se recupera la salida guardada cuando vuelve a estar disponible.
- El modo global requiere el controlador virtual. Una vez listo el puente, dirige la salida predeterminada de Windows al canal virtual y restaura una salida física al apagarlo o salir normalmente. No instala ni modifica controladores.
- Las barras indican actividad confirmada del puente, pero siguen siendo una animación, no un analizador FFT.
- El conversor escucha el webview nativo de Tauri con un listener estable. Selección y arrastre usan la misma validación, con errores visibles. El modo se detecta para archivos reconocidos al iniciar una cola vacía.
- Los destinos existentes se rechazan. El lote se ejecuta secuencialmente; detenerlo termina el archivo actual y conserva los pendientes. Los ajustes quedan bloqueados mientras trabaja.
- FFmpeg y FFprobe proceden de un runtime propio, compartido con la biblioteca de vídeo y empaquetado en la aplicación. WebM selecciona códecs compatibles y WebP respeta la calidad.
- Quick Look permite extraer ZIP a una carpeta nueva. Rechaza rutas externas, enlaces, sobrescrituras y tamaños excesivos. RAR y 7z conservan la apertura externa; no se anuncian como extracción implementada.

## Preparación reproducible

Ejecutar `pwsh -NoProfile -File scripts/setup-ffmpeg.ps1 -SourceDirectory <distribución>` con una distribución estática completa que contenga bin/ffmpeg.exe, bin/ffprobe.exe, LICENSE y README.txt. Sin argumento busca Gyan.FFmpeg instalado con WinGet. El script copia los ejecutables y avisos, y genera hashes SHA256; no descarga ni instala programas. Los binarios permanecen ignorados por Git. Cargo verifica su presencia y el instalador los incluye.

Runtime preparado en esta máquina: FFmpeg 8.1.2 full, con FFprobe de la misma distribución. No usa los ejecutables de Krita.

## Validación

- Nueve pruebas Bun: cinco de conexión automática de salidas y cuatro del contrato de recuperación: motor detenido, cambio de salida, ausencia/reaparición, desactivación durante una consulta y descarte de consultas al desmontar.
- 28 pruebas Rust aprobadas, incluyendo conversión real a JPG, PNG, WebP, AVIF, BMP, TIFF y GIF; extracción a MP3, FLAC, WAV, AAC, OGG y M4A; transcodificación de audio y vídeo MP4/MKV/WebM; inspección de vídeo con FFprobe; extracción ZIP y rechazo de traversal/sobrescritura.
- TypeScript y compilación Vite aprobados. Vite conserva una advertencia de tamaño del bundle.
- Instalador de depuración: pendiente de terminar la compilación final.

## Comprobación pendiente en el equipo

La aplicación instalada seguía siendo la versión anterior durante estas pruebas. No se ha reiniciado Windows, desconectado físicamente el auricular ni realizado un arrastre real del Explorador sobre la nueva compilación. Las pruebas automatizadas no sustituyen esas comprobaciones. Tampoco cubren cierre forzado del proceso o cortes de energía; la restauración de salida se ejecuta en un cierre normal.

## Ampliación del 8 de septiembre

Conectar una salida nueva la selecciona automáticamente, incluso si la anterior sigue disponible. El primer inventario restaura la selección guardada sin considerar nuevos todos los dispositivos. Se excluye el canal de captura de Prisma; la selección se conserva en sondeos posteriores y se sincroniza con el reproductor local.

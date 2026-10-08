# Validación

2026-10-08: usuario informa audio externo audible y música de Prisma ausente.

- Inspección vigente: MPV excluía dispositivos Prisma/FXSound; useDspController elegía ruta virtual solo con múltiples salidas. AudioRelay suspende captura independiente cuando el puente publica su señal, dejando fuera la música local enviada al endpoint físico.
- `bun test tests/playbackAudioRoute.test.ts`: seis aprobadas. Cubre puente sin múltiples salidas, captura predeterminada, fuente explícita, retorno a salida física, prioridad del puente y fuente desaparecida.
- `bun run check`: aprobado después de separar las pruebas Bun de la compilación de la aplicación. Primer intento encontró falta de tipos bun:test en src; corregido sin añadir dependencias.
- Pruebas Rust audio_relay: dos aprobadas; una física ignorada por defecto.
- Prueba nativa optativa `internal_music_enters_virtual_loopback_without_double_dsp`: aprobada en 8,35 s. 766.567 muestras no nulas de MPV en el endpoint virtual capturado. AF se elimina durante bypass, conserva ajustes enviados durante bypass y vuelve a aplicarse al regresar a salida local.
- Teléfono disponible por Synapse. Dos intentos iniciales de prueba TLS rechazados con busy=true: su sesión personal estaba activa; no se detuvo la app ni se sustituyó esa sesión.
- Tercer intento de audio y prueba posterior de liberación rechazados por busy=true, sin sustituir la sesión existente. Compilación debug de ruta interna aprobada.
- Biglex confirma después: «Sí, ahora sí envía normal el audio, tanto de otras apps y de mismo Prisma». Es aceptación audible del flujo corregido.
- Colisión verificada: instalada PID 9844 escucha UDP49289 y dev se desplazaba a UDP49288, donde Android no emite. Luna Fetch también usa UDP49289. Los perfiles WebView y backend ya estaban aislados; no se cambian.
- Prueba de dos listeners compartidos de broadcast: aprobada. Comprobación de teléfono conocido sin poseer puerto de balizas: aprobada contra el receptor normal. Atajo de altavoz dev T; instalado M. Salidas múltiples dev D; instalado P. Dev deja de registrar asociaciones y prisma:// del instalado.
- Metadatos negociados: solo se envían si el receptor anuncia metadata=true. JPEG256px, extracción fuera del hilo PCM, envío solo al cambiar y validación de tamaño independiente de audio. Prueba Rust de miniatura aprobada.
- TypeScript aprobado con CustomSelect. Compilación Android y pruebas aprobadas, incluidos icono alternativo y muestreo.
- Comprobación final: debug Prisma y APK Android compilados; 120 pruebas Android sin fallos. APK instalado con éxito por ADB inalámbrico, sin borrar datos ni instrumentación.
- Prueba TLS de metadatos contra el teléfono: negocia metadata=true, envía JPEG256px y un bloque silencioso para activar MediaSession. Biglex confirma «Sí, aparece la imagen». Sesión de prueba temporal cerrada al terminar.
- Selectores: CustomSelect usado para teléfono, fuente y atajo; comprobación TypeScript aprobada. Vista web comprobada hasta Ecualizador; navegación posterior interrumpida al cerrarse la pestaña. Falta inspeccionar el desplegable dentro del escritorio actualizado, sin confundirlo con la prueba móvil.

Se conserva la salida física elegida; la política temporal del altavoz no sobrescribe su preferencia. No se usa instrumentación Android.

Fuente primaria para IDs MPV/WASAPI: [selección por ID y nombre](https://github.com/mpv-player/mpv/blob/master/audio/out/ao_wasapi_utils.c). Acepta ID completo del endpoint y evita ambigüedad de nombres.

Notificación y carátula: [Android MediaStyle](https://developer.android.com/reference/android/app/Notification.MediaStyle). Compartición de puerto: [Microsoft Winsock](https://learn.microsoft.com/es-es/windows/win32/winsock/using-so-reuseaddr-and-so-exclusiveaddruse). La versión instalada puede conservar una vinculación exclusiva; no se fuerza su cierre.

## Ajustes finales solicitados

Biglex pide quitar el selector de combinaciones y centralizar los atajos en Configuración, con solo las teclas visibles. Se retiran el check, Reintentar, sufijos y mensajes de atajos del panel y la tabla. Local Shift+T; global predefinido M para instalada y T para desarrollo. Se retiran Ctrl+H y Shift+B de segundo plano; quedan H y Shift+H.

La paleta usaba variables md-sys ausentes y caía a un fondo oscuro; ahora usa los tokens vigentes del tema. ResizeObserver/MutationObserver recalculan la posición al abrir opciones y se desconectan al cerrar. Callback local estable y auto-repetición filtrada; registro global se reintenta automáticamente cuando se libera una combinación ocupada.

Diagnóstico nativo: Ctrl+Shift+Alt+T ocupado, error Windows1409. Biglex identifica AutoHotkey y libera su combinación; confirma «Ya funcionan ambos atajos». Comprobación TypeScript y tres pruebas Rust de audio aprobadas después de los cambios.

# Audio en directo entre Prisma y Super Gallery — Plan conjunto

- Estado: `IN_PROGRESS`
- Fecha: `2026-10-05` (America/Bogota)
- Ejecución autorizada mediante «si aslo» y «continua»; recuperación de GitHub autorizada mediante «trae de github». Actualización: 2026-10-06.
- Prioridad confirmada por Biglex: primera entrega PC → teléfono; teléfono → PC queda para una segunda etapa independiente. La preparación de depuración no inicia por sí sola la implementación.
- Funcionamiento precisado por Biglex: teléfono como altavoz continuo, controlado en Ecualizador junto a salidas múltiples y mediante un atajo de activación/desactivación.
- Proyecto coordinador: Prisma. Contraparte: [proceso Android](../../../../Lienzo--Gallery/process/active/2026-10-05_audio_relay_y_salidas_respetuosas/PLAN.md).

## TAREA

Entregar primero el teléfono como salida continua del audio de Windows mediante Super Gallery. Activar/desactivar desde el Ecualizador junto a salidas múltiples, o mediante atajo global; permanece habilitado hasta desactivación explícita, también durante silencios y pausas. Corregir el control de salidas Android como requisito previo del receptor. El sentido inverso queda planificado para una segunda etapa y no condiciona la entrega ni el cierre de PC → teléfono.

## CONTEXTO

Biglex quiere utilizar su teléfono como altavoz de la PC durante todo el tiempo que deje habilitada esa salida, tanto para música/videos como para cualquier otro audio de Windows. Los sonidos breves motivaron la petición inicial, pero no definen la duración ni el alcance: no hay sesiones por clip ni cierre por silencio. La captura adjunta ilustra el flujo de AudioRelay; no establece compatibilidad con su protocolo propietario.

### Evidencia inicial (2026-10-05)

| Área | Estado observado | Consecuencia |
| --- | --- | --- |
| Prisma | Rama `preview`, HEAD `1f8c00d`, frontend local y cambios previos sin confirmar. `src-tauri/` ausente y marcado eliminado por Git. | El backend se consultó con `git show HEAD:...`; es referencia registrada, no código ejecutable del árbol actual. Antes de implementar hay que aclarar dónde está el backend vigente. No restaurarlo ni revertir los cambios automáticamente. |
| WASAPI en HEAD | `WasapiBridge` captura un endpoint, procesa PCM y distribuye a `RenderDeviceSlot`; existen salidas múltiples y controles DSP. | Reutilizar el flujo cuando resulte adecuado; separar captura de la obligación de tener una salida física, necesaria para el modo «solo teléfono». |
| Synapse en HEAD | Servidor TCP/HTTP con `status`, `playback`, `artwork`, `lyrics`, `handoff`, `remote` y `upload`. | Reutilizar descubrimiento y control. No hay una ruta de audio continuo en las rutas examinadas. |
| Super Gallery | Rama `preview`, HEAD `566dd8f`, árbol limpio al revisar; SDK mínimo 31, objetivo 36, Media3 1.10.1. | Integrar con los servicios y reproductores existentes; comprobar las restricciones Android actuales. |
| Envío existente | `SendToSuperGalleryModal.tsx` envía archivos. Android ofrece `uploadFileToPrisma`, `handoffToPrisma` y control remoto. El handoff busca un archivo equivalente en la biblioteca PC. | Enviar un archivo o continuar una canción no transmite el sonido del dispositivo. Conservar estas funciones con nombres claros. |
| Salidas Android | `AudioOutputHelper` persiste la selección, la reaplica al registrar reproductores y al añadir/quitar dispositivos; informa primero la preferencia guardada. | Causa probable del comportamiento agresivo. La reproducción real y la interacción con el selector del fabricante aún no se reprodujeron. |

El proceso previo de [salidas múltiples](../2026-09-28_salidas_audio_multiples_simultaneas/PLAN.md) sigue siendo referencia local. ROADMAP marca esa función completada, mientras el proceso conserva comprobaciones pendientes: verificar la versión vigente antes de apoyarse en su estado. La memoria histórica solo orientó la búsqueda; no acredita funcionamiento actual.

## FORMATO

### Experiencia propuesta

1. Abrir Super Gallery con Synapse activo. El receptor se prepara automáticamente salvo desactivación explícita; no pedir PIN, QR ni otra vinculación. Prisma conserva la identidad pública del teléfono al elegirlo automáticamente.
2. Uso habitual: en **Ecualizador → salidas**, junto a «Salidas múltiples», mostrar «Usar el teléfono como altavoz», el dispositivo seleccionado y un interruptor. Recordar el teléfono elegido; un clic habilita/deshabilita esa salida cuando el receptor está disponible. No crear otra sección de uso habitual ni requerir abrir dos pantallas.
3. Mientras el interruptor esté habilitado, el teléfono sigue funcionando como altavoz durante música, videos, otras apps, pausas y silencios. No finalizar por inactividad, fin de pista, cambio de app, navegación fuera del Ecualizador ni minimizar Prisma. Mantener la conexión preparada y recuperar interrupciones temporales de red mientras siga habilitado. La desactivación explícita cancela conexión, transmisión y reconexiones; recordar el destino no habilita por sí solo el envío al volver a iniciar Prisma.
4. Super Gallery muestra «Audio de Prisma», volumen y Detener en una notificación de reproducción. El destino físico sigue la salida de Android, incluidos cambios desde las notificaciones.
5. Segunda etapa: en Android, «Enviar audio a Prisma» identifica la fuente: audio reproducido por Super Gallery o audio de otras apps del teléfono. No confundirlo con «Continuar en Prisma». Esta acción no se incluye en la primera entrega.
6. La primera entrega transmite únicamente PC → teléfono. La segunda etapa conservará una dirección activa por sesión; cambiarla detendrá la anterior. Micrófono y conversación simultánea quedan fuera.
7. Un **atajo global configurable** alterna exactamente el mismo interruptor, incluso con otra app delante. Mostrar la combinación en el control del Ecualizador y en la configuración de atajos, con aviso breve de activado/desactivado o teléfono no disponible. Resolver la combinación en implementación tras comprobar conflictos; conservar los atajos actuales de salidas múltiples (`Ctrl+Mayús+O` local y `Ctrl+Mayús+Alt+P` global). Un atajo dedicado al teléfono no modifica las selecciones de salidas físicas.

### Integración con salidas múltiples y estado

- El teléfono es un destino de red del sistema de salidas del Ecualizador. Debe poder funcionar solo o junto a salidas físicas, sin perder las selecciones, ganancias ni retardos existentes al activar/desactivar el móvil.
- Control de volumen del destino móvil junto a sus controles de salida, evitando doble DSP. No crear una segunda captura del sistema si el motor ya proporciona la señal necesaria.
- Separar **intención** (habilitado/deshabilitado) de **conexión** (conectando/conectado/reconectando/no disponible). Silencio solo cambia el indicador de señal; no apaga el interruptor. Una pérdida de red conserva intención y muestra estado de reconexión. Nunca presentar una conexión fallida como transmisión efectiva.
- Detener desde Prisma, el atajo o la notificación Android es una desactivación explícita: sincronizar el estado para que no se reconecte inmediatamente después de que Biglex lo apague. Un cierre completo de Prisma termina el servicio; minimizar o cambiar de sección lo conserva.

El acceso de un clic presupone receptor disponible. Una app detenida forzosamente, un servicio terminado por Android o un teléfono fuera de red se muestran como no disponibles; no prometer despertar invisible ni recepción garantizada después de reiniciar.

### Orden de ejecución

| Fase | Entrega | Condición de paso |
| --- | --- | --- |
| 0 | Confirmar backend Prisma vigente y reproducir el rechazo de ruta Android. | Evidencia del árbol correcto y del teléfono de Biglex. |
| 1 | Salidas Android que sigan al sistema. | Cambio desde notificaciones respetado en segundo plano y tras reconectar Bluetooth. |
| 2 | Prototipo PC → teléfono y prueba del transporte. | Audio continuo y reanudación tras silencios sin cierre por inactividad; una desconexión no bloquea el audio local. |
| 3 | Integración del destino móvil en Ecualizador/salidas múltiples, atajo global, conexión automática Synapse y servicio de reproducción. | Altavoz continuo en PC/teléfono reales hasta desactivación explícita, también con pantalla apagada y otra app delante. |
| Segunda etapa, fuera de la primera entrega | Teléfono → PC: audio propio de Super Gallery. | No requiere un archivo coincidente en la biblioteca PC; play/pausa/seek y volumen conservan comportamiento coherente. |
| Segunda etapa, fuera de la primera entrega | Teléfono → PC: captura de otras apps permitidas por Android. | Autorización del sistema, inicio/cierre correcto de captura y errores claros cuando la app fuente impide capturar. |

Las fases 0–3 completan la primera entrega. Implementar, validar y entregar PC → teléfono antes de desarrollar el emisor Android o el receptor Windows. Cuando se retome el sentido inverso, abrir su propio proceso enlazado a esta propuesta.

## Arquitectura propuesta

- **Control y descubrimiento:** extender Synapse con capacidades versionadas para enviar/recibir audio y mensajes de preparar, iniciar, detener y estado. Mantener estado de salida habilitada separado de actividad de señal y estado de transporte. Detener explícitamente cancela reintentos en ambos equipos; reconexión solo mientras la salida siga habilitada. Los clientes antiguos mantienen archivos/handoff; no se presentan como receptores de audio si no anuncian capacidad. Los nombres concretos de endpoints se fijan en la fase 2.
- **Transporte inicial:** PCM16 estéreo por TLS 1.2/1.3 en LAN, sobre HTTP Upgrade del puerto Synapse existente 49288. Identidad AndroidKeyStore; Prisma obtiene automáticamente la huella pública del estado Synapse y la conserva para verificar reconexiones. Sin PIN, credencial ni segundo emparejamiento. A 48 kHz requiere 1,536 Mbit/s sin TLS/TCP. Se eligió para usar bibliotecas nativas y limitar dependencias. WebRTC/Opus no se ha prototipado ni descartado. TCP puede aumentar el retardo ante pérdidas; colas acotadas descartan audio viejo. Medir latencia y congestión en dispositivo antes de consolidarlo.
- **Captura Windows:** WASAPI loopback del endpoint que realmente recibe el audio de las apps, con selección visible. El endpoint virtual Prisma puede ser la fuente cuando ya se usa. No basta con elegir el monitor si el audio está en otro endpoint. Un monitor sin altavoces no impide capturar una salida activa, pero la ausencia/invalidez de endpoint sí requiere resolver la fuente.
- **Salida solo de red:** permitir captura sin inicializar un render físico obligatorio; el teléfono funciona aunque no haya altavoces locales. Conservar la selección anterior para volver. «Solo teléfono»/«Teléfono y salida local» son opciones explícitas; silenciar una salida no debe dejar a cero el flujo capturado.
- **Tiempo real:** en el hilo WASAPI solo copiar/enviar a una cola acotada; codificación/red en trabajadores separados. Negociar formato, remuestrear y compensar relojes. Búfer adaptativo acotado: recuperar descartando audio antiguo, sin reproducir segundos atrasados. No cerrar por silencios de ninguna duración ni por fin de pista: heartbeat/keepalive detecta pérdida de conexión independientemente de la presencia de señal. Al reaparecer audio, evitar perder el comienzo.
- **DSP y volumen:** tomar una sola copia de señal, con punto de captura documentado. Evitar aplicar el mismo DSP dos veces, duplicar la reproducción de MPV/HTML o hacer depender la ganancia remota del mute local. Volumen del stream y volumen físico Android son controles distintos.
- **Recepción Android:** servicio de reproducción con `MediaSession`, notificación y controles; gestionar audio focus, llamadas, auriculares y cambios de ruta. Discovery disponible y reproducción activa son estados distintos. No usar el servicio `dataSync` como garantía de escucha permanente: revisar restricciones de SDK 36 y arranque en segundo plano. No solicitar exención global de batería como solución inicial.
- **Segunda etapa — envío Android propio:** evaluar una copia PCM del pipeline Media3/DSP, con volumen definido y un único procesamiento. Evita permisos de captura de otras apps. La red nunca bloquea el audio sink.
- **Segunda etapa — envío Android de otras apps:** `AudioPlaybackCapture` + `MediaProjection` + `AudioRecord`, permiso `RECORD_AUDIO` y servicio `mediaProjection`. Solicitar autorización por sesión cuando Android lo requiera, atender revocación y comprobar bloqueo de pantalla en la versión del dispositivo. No prometer capturar llamadas ni contenidos excluidos por la política de la app fuente.
- **Segunda etapa — recepción Windows:** salida WASAPI elegida explícitamente, sin reenviar la señal recibida al propio transmisor. Una sola sesión/dirección evita el bucle inmediato; añadir identificación de sesión/origen y protección contra reconexiones duplicadas.
- **Confianza:** por indicación de Biglex, reutilizar el modelo de red local de Synapse y conectar directamente. Synapse vigente no autentica sus endpoints: la primera asociación automática depende de la confianza en esa LAN. TLS cifra el audio y comprueba la huella recordada en reconexiones; no aporta autenticación de la PC ni protege el primer uso de una LAN intervenida. No usar el nombre anunciado para sustituir la identidad recordada.

## Política de salidas compartida

La fase 1 se especifica en el proceso Android. Por defecto se libera la preferencia de dispositivo y se sigue la política de Android. Un cambio desde el panel del sistema tiene prioridad sobre una elección anterior de la app. La UI informa la ruta observada; una llamada sin excepción no prueba que el audio cambió. Una desconexión de auriculares puede pausar la música para evitar reproducirla inesperadamente en el altavoz.

## RESTRICCIONES

- Implementación y pruebas locales autorizadas por Biglex. No publicar ni cambiar versiones en este proceso.
- Implementar después en `preview` o derivada, preservando cambios concurrentes y verificando la disponibilidad del backend nativo.
- Primera versión en red local, un PC transmite y un teléfono recibe. Teléfono → PC, Internet, USB, varios receptores, micrófono y sincronización audiovisual exacta quedan fuera de esa entrega.
- La dirección teléfono → PC solo es útil si la PC tiene una salida audible. Esta función no proporciona altavoces al monitor.
- Android no permite eliminar la autorización de captura de otras apps ni garantizar el arranque de cualquier servicio remoto. La conexión recordada debe respetar esos límites.
- Las métricas siguientes son objetivos de aceptación, no resultados obtenidos ni promesas de latencia cero.

## Criterios de finalización

- [ ] Control «Usar el teléfono como altavoz» en el Ecualizador junto a salidas múltiples: un clic tras preparación inicial, destino recordado y estado real visible.
- [ ] Atajo global configurable activa/desactiva ese mismo destino con otra app delante, informa conflictos y conserva los atajos/selecciones físicas existentes.
- [ ] PC → teléfono con música, video y audio de otras apps Windows, también en modo solo red y con Prisma minimizado.
- [ ] Con sesión preparada, medir latencia extremo a extremo; objetivo ≤150 ms en Wi-Fi estable y registro de mediana/p95 y condiciones. Si no se alcanza, revisar el diseño y comunicar el resultado.
- [ ] Prueba continua de al menos 60 minutos, incluyendo 10 minutos de silencio y reanudación desde otra app: la salida permanece habilitada hasta desactivación explícita, sin cola creciente, duplicación ni bucles. Los clips cortos solo son una prueba adicional de inicio de señal.
- [ ] Desactivar desde Ecualizador, atajo o teléfono detiene y sincroniza ambos extremos, sin reconexión espontánea; volver a activar reutiliza el destino recordado.
- [ ] Pantalla apagada durante 15 minutos en recepción, cambio de app, Bluetooth, llamadas, revocación y reconexión sin exigir abrir ambas apps de nuevo cuando el sistema permite mantener el receptor.
- [ ] Cambio de salida desde notificaciones respetado y reflejado en Super Gallery.
- [ ] Cambios de identidad TLS rechazados al reconectar; clientes antiguos sin regresión. Primera asociación automática limitada a la LAN existente de Synapse.
- [ ] Comprobaciones de frontend, Rust y Android correspondientes a las modificaciones, más pruebas físicas; compilar no acredita transmisión audible.

El sentido inverso tendrá criterios y validaciones en un proceso posterior; no bloquea estos criterios de finalización.

## Fuentes técnicas verificadas el 5 de octubre de 2026

- [Microsoft: WASAPI loopback](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording).
- [Android: ExoPlayer, preferencia de dispositivo y restauración con null](https://developer.android.com/reference/androidx/media3/exoplayer/ExoPlayer#setPreferredAudioDevice(android.media.AudioDeviceInfo)).
- [Android: captura de audio y políticas de apps](https://developer.android.com/media/platform/av-capture).
- [Android: MediaProjection](https://developer.android.com/media/grow/media-projection).
- [Android: tipos y restricciones de foreground services](https://developer.android.com/develop/background-work/services/fgs/service-types).

## Autorización

- [x] Biglex solicitó analizar y entregar el plan para ambos proyectos.
- [x] Biglex confirmó que PC → teléfono es la prioridad y que el sentido inverso va después, manteniendo el trabajo como planificado.
- [x] Biglex precisó salida continua hasta desactivación, integrada en Ecualizador/salidas múltiples con atajo.
- [ ] Biglex indicó comenzar la implementación. Pendiente; no inferirla de la solicitud de planificación.

## Implementación — 2026-10-06

Prisma recuperado de `origin/preview` (`fd05b26`), conservando el delta de commits locales hasta `1f8c00d` y los cambios concurrentes. Dependencias restauradas con los scripts libmpv y FFmpeg. Receptor Android, captura WASAPI sin render físico y controles de Ecualizador escritos. Atajo predeterminado Ctrl+Mayús+Alt+M, alternativas T/U o desactivado. Sin publicación ni cambio de versión. Motorola Edge 60 Fusion conectado; APK debug instalado. Aceptación física en curso.

## Ajuste autorizado — 2026-10-07

Nombre: «Usar el teléfono como altavoz». Reutilizar descubrimiento y puerto 49288 de Synapse; comprobar Super Gallery y conectar sin PIN, QR ni IP manual. Si hay un teléfono se selecciona automáticamente; si hay varios se elige por nombre. El receptor se prepara junto con Synapse salvo desactivación explícita en Android. Un atajo o el control del Ecualizador mantienen el envío habilitado hasta apagarlo. El esquema inicial de PIN/puerto separado queda sustituido por esta decisión.

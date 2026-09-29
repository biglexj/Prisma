# Continuidad de colas y vista de música

- Estado: EN CURSO
- Fecha: 2026-09-29

## Objetivo y autorización

Biglex reportó que el paso automático de la última cola a la primera queda en reposo, aunque entre otras colas continúa. También pidió eliminar el diagnóstico de vídeo en música y evitar que la ruta aparezca solo al reproducir y desplace los controles.

## Enfoque

- Mantener el sondeo durante estados vacíos transitorios de carga; descartar respuestas de cargas anteriores.
- Esperar una lectura de la pista nueva antes de interpretar EOF y no avanzar anticipadamente ni por una pausa manual cerca del final.
- Respetar modos de fin de canción y pausa explícita.
- Mostrar la ruta de la selección antes de reproducir, reservar su espacio y mostrar diagnóstico de vídeo únicamente para vídeos.
- Comprobar escenarios de transición con pruebas y compilación; solicitar confirmación de audio real sin abrir otra instancia.

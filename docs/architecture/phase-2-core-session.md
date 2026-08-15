# Fase 2: núcleo de sesiones multimedia

## Objetivo

Abrir un archivo local, reconocer su familia y construir una sesión temporal con los archivos compatibles de su carpeta.

Esta fase no incorpora todavía biblioteca persistente, SQLite, playlists, letras ni edición de metadata.

## Flujo implementado

```text
Abrir archivo
    ↓
Clasificar audio, imagen o vídeo
    ↓
Leer únicamente la carpeta inmediata
    ↓
Filtrar archivos de la misma familia
    ↓
Ordenar de forma natural
    ↓
Mantener la lista ordenada y un índice actual
    ↓
Navegar anterior o siguiente
```

La lista no se rota al abrir un archivo. Conservar el orden y mover un índice evita inconsistencias al persistir o mostrar posteriormente la sesión.

## Decisiones actuales

- La clasificación inicial se realiza por extensión conocida.
- El motor conserva la validación definitiva al intentar cargar el archivo.
- La navegación no vuelve automáticamente del último archivo al primero.
- Los errores al leer entradas individuales no cancelan toda la sesión.
- Un cambio de archivo solo confirma el nuevo índice después de que el backend acepte la carga.
- El filesystem sigue siendo la autoridad; la sesión vive únicamente en memoria.

## Familias iniciales

### Audio

AAC, AIFF, ALAC, APE, FLAC, M4A, MP3, Ogg, Opus, WAV y WavPack.

### Imagen

AVIF, BMP, GIF, JPEG, JPEG XL, PNG, TIFF y WebP.

### Vídeo

3GP, AVI, FLV, M2TS, M4V, MKV, MOV, MP4, MPEG, OGV, TS, WebM y WMV.

Esta lista describe candidatos. La compatibilidad real depende del backend y debe comprobarse con fixtures.

## Criterios de salida

- Clasificación correcta sin distinguir mayúsculas y minúsculas.
- Orden natural: `2.mp3` aparece antes que `10.mp3`.
- La sesión contiene exclusivamente archivos de la familia abierta.
- El índice actual corresponde al archivo elegido.
- Anterior y siguiente no exceden los límites.
- Cambiar de elemento actualiza reproducción y estado como una sola operación lógica.
- Las rutas con espacios, tildes y eñes funcionan.
- Las pruebas de Rust y el build de TypeScript finalizan correctamente.

Los últimos dos puntos continúan pendientes de verificación local mientras el lanzador del terminal permanezca bloqueado.

# Plan: Corrección del Scroll y Despliegue Completo en QuickLook para Archivos de Texto y Letras

## Contexto y Diagnóstico
En la vista previa de QuickLook (`QuickLookText`, `QuickLookMarkdown`, `QuickLookLyrics`, `QuickLookHtml`), al abrir un archivo de texto con más de ~39 líneas (como `Letra.txt` de 62 líneas), la columna de números de línea (`.quicklook-line-numbers`) calcula su altura correctamente (1240px aprox.), pero el bloque de contenido `<pre className="quicklook-code-content">` poseía la propiedad CSS `overflow: hidden`.
En Chromium / Blink WebView2, dentro de un contenedor flex con `display: flex; overflow-y: auto`, un elemento flex hijo con `overflow: hidden` colapsa su caja de renderizado a la altura inicial visible del viewport (~760px, equivalente a ~39 líneas).
Al hacer scroll vertical hacia abajo, el `<pre>` se desplazaba hacia arriba pero se terminaba abruptamente en la línea 39, dejando el resto del espacio vacío/negro mientras los números de línea continuaban hasta el 62.

Adicionalmente, el usuario requirió generar copias `.txt` de todas las letras `.md` existentes en las carpetas de canciones en `D:\Música\IA Sounds\biglexj` para su verificación directa en QuickLook.

## Objetivos
1. **Generación de Archivos de Prueba**: Copiar todos los archivos `Letra.md` a `Letra.txt` en las 34 carpetas de canciones del usuario.
2. **Corrección de CSS en QuickLook**:
   - Eliminar `overflow: hidden` de `.quicklook-code-content` y establecer `overflow: visible !important; height: auto; min-height: 100%;`.
   - Asegurar `white-space: pre` y `overflow-x: auto` en `.quicklook-text-viewport` para mantener sincronización 1:1 estricta entre números de línea y contenido sin truncamientos.
   - Asegurar soporte de fondo correcto en modo oscuro para los números de línea sticky (`position: sticky; left: 0`).
3. **Verificación en Componentes**:
   - `QuickLookText.tsx`
   - `QuickLookMarkdown.tsx`
   - `QuickLookLyrics.tsx`
   - `QuickLookHtml.tsx`
4. **Validación Técnica**:
   - `bun run build` y `cargo check` sin advertencias ni errores.
   - Comprobación de renderizado completo de las 62 líneas de `Letra.txt`.

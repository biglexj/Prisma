# Bóveda flotante del sistema

La zona de recepción deja de vivir dentro de la ventana de Prisma y pasa a ser una **bóveda flotante del sistema**: una ventana propia, siempre encima, anclada en el borde superior central del escritorio virtual (80 px de ancho por 3 de alto cuando está vacía). Sirve desde el Explorador de archivos, el navegador o cualquier otra aplicación, incluso con Prisma minimizado o en la bandeja.

La bóveda guarda **hasta tres elementos**:

1. Uno se puede **fijar**: queda siempre primero y no se expulsa nunca. Solo puede haber uno fijado a la vez, y se puede desfijar.
2. Los otros dos son normales: cuando entra un cuarto, expulsa el más antiguo que no esté fijado.
3. Los elementos **permanecen** entre sesiones: se guardan en `vault.json` en la carpeta de datos de la aplicación.

Cada elemento tiene sus acciones encima:

- **Enviar al teléfono**: abre el sistema de transferencias hacia Super Galería.
- **Guardar en una carpeta**: hace una copia en la carpeta configurada, como una descarga. Si el archivo ya existe, no lo pisa: añade «(1)».
- **Fijar / desfijar** y **quitar**.

Además, cada elemento se puede **arrastrar fuera** de la bóveda: se usa el arrastre nativo de Windows, así que al soltarlo en el Explorador de archivos se hace una copia allí, y en cualquier otra aplicación se abre con su programa.

En Configuración → General y Sistema se puede **activar o desactivar** la zona y elegir la **carpeta de destino** de las copias (por defecto, Descargas\Prisma).


## Ampliación del 22 de octubre: notch Synapse de cinco espacios

Dirección actual de Biglex: franja de 100×3 px, centrada en el borde superior, apertura al acercar el ratón con animación de salida, cinco cuadros visibles incluso cuando están vacíos. Destinos: fijar a la izquierda, temporal al centro, enviar al teléfono a la derecha. El envío se resuelve dentro de esta ventana y las capturas guardadas entran automáticamente.

Implementación: región Win32 opaca con esquinas inferiores recortadas; coordenadas adaptadas al DPI y monitor principal; receptor OLE por ventana para rutas CF_HDROP y HTML/texto Unicode de navegador; importación de copias locales y materialización de texto, enlaces e imágenes públicas. Los temporales rotan al llenar cinco espacios. La dirección final de Biglex limita los fijados a dos; capturas y archivos comparten las casillas restantes, ordenados de izquierda a derecha por antigüedad, con el nuevo al final. Los errores se muestran en la barra.

Los recursos web tienen un límite de 64 MiB y un tiempo máximo de descarga; recursos que requieren la sesión privada del navegador pueden fallar. Las copias internas no se borran al expulsar tarjetas; no se elimina el archivo de origen. No se vigila todo el portapapeles: Ctrl+V pega contenido expresamente.

La ventana de aceptación `src-tauri/examples/synapse_notch_smoke.rs` usa los comandos reales con perfil aislado, sin descubrimiento ni envío a teléfonos reales. Esa prueba no sustituye la aceptación del teléfono ni el arrastre desde cada navegador.


### Acabado solicitado tras los cambios paralelos

Las tres opciones aparecen exclusivamente durante el arrastre, con zonas grandes para soltar que ocupan toda la altura. Al consultar el contenido se muestran cinco tarjetas cuadradas de 106×106 px, incluidos los huecos vacíos. Los controles de cada tarjeta se revelan al pasar el ratón o recibir foco. Se conserva el ajuste de altura dinámico incorporado por el otro agente. El arranque queda replegado; se retiraron los estados abiertos/de arrastre usados para la prueba visual.

### Rotación acordada de capturas y archivos

No se reserva una casilla exclusiva para capturas. Con la barra vacía, cinco capturas consecutivas ocupan las cinco casillas de izquierda a derecha. Al llenarse, cada captura o archivo nuevo expulsa al más antiguo no fijado y entra al final del grupo temporal; los fijados siguen delante y quedan protegidos. Las tarjetas expulsadas no provocan el borrado de archivos. El máximo para fijar es dos; un estado antiguo con más fijados se conserva sin desfijarlos automáticamente y bloquea nuevos fijados hasta bajar del límite.

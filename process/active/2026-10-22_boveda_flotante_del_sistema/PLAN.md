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

# Tareas

- [x] Transiciones DWM y orden de ocultación/limpieza.
- [x] Apertura/cierre continuo y señal de actividad de Synapse.
- [x] Barra compacta y cambio de intención conservando los píxeles originales.
- [x] Invalidar cuenta atrás si se cancela la grabación.
- [x] Build web, 26 pruebas Bun y dos pruebas Rust de sesión.
- [x] Comprobación funcional con componentes reales e IPC simulado en navegador.
- [ ] Verificar el acabado visual, el zoom intermitente y un archivo de vídeo real en Windows.
- [x] Rediseñar el control de grabación con cronómetro, estado, asa e iconos.
- [x] Centrar en el área útil del monitor y excluir la ventana de captura sin recortar el vídeo.
- [x] Separar rutas de capturas, grabaciones y fotogramas; crear los destinos Prisma.
- [x] Build web, 18 pruebas Bun de rutas/captura y prueba Rust de geometría.
- [x] Comprobar pausa/reanudación, solicitud de arrastre, fallo de parada y reintento en navegador con IPC simulado.
- [ ] Comprobar exclusión de la barra y arrastre físico durante una grabación real.
- [x] Distinguir copia interna y ubicación de origen/guardado en Synapse.
- [x] Usar disquete para guardar y carpeta para localizar; registrar el destino sin duplicar tarjetas.
- [x] Validar persistencia, orígenes A/B y transición guardar/localizar con componente real e IPC simulado.
- [x] Corregir contraste de Detener y mostrar confirmación en la barra nativa tras guardar, por botón o atajo.
- [x] Reproducir y corregir el inicio por ventana: tamaño cliente para GDIGRAB y error visible si falla.
- [x] Evitar bloqueo de vídeo cuando WASAPI no entrega paquetes durante el silencio.
- [x] Verificar desde Prisma Dev selección, cuenta atrás, barra Grabando, parada y aviso Guardada; inspeccionar el MP4 real con FFprobe.

- [x] Corregir el vídeo negro capturando la región visible completa y conservando coordenadas físicas.
- [x] Reducir las barras activas a 150×42, incluidos estilos raíz y controles por iconos.
- [x] Decodificar y revisar visualmente un fotograma del vídeo real, además de comprobar sus metadatos.

- [x] Juntar estado y cronómetro; añadir ocultar y ocultación automática a los cinco segundos.
- [x] Añadir Ctrl+S temporal y acciones de grabación en la bandeja.
- [x] Verificar ocultación con IPC simulado y detener/guardar con Ctrl+S en Prisma Dev real.
- [ ] Implementar dibujo sobre la grabación: solo plan solicitado; diferido.

- [x] Completar texto/enlaces pegados, casillas estables, protección de fijados y vista previa.
- [x] Doble clic copia el contenido completo sin abrir visor ni navegador.
- [x] Añadir reproductor de Inicio con carátula, controles y barras decorativas; corregir centrado de órbitas.
- [x] Validar interfaz, pegado/copia en navegador y build web.
- [ ] Repetir pruebas Rust finales y aceptación nativa cuando compile el módulo concurrente de fondos de pantalla.

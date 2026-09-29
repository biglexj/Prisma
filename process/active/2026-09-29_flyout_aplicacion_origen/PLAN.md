# Aplicación de origen en el flyout

## Objetivo

Pulsar el distintivo para mostrar Prisma. Si Windows identifica una sesión multimedia externa, mostrar su nombre y abrir esa aplicación. Usar Prisma como respaldo cuando no exista una identidad clara.

## Implementación

- Consultar la sesión multimedia actual de Windows fuera del hilo de interfaz y solo cuando el flyout está visible y Prisma no está reproduciendo.
- Vincular metadatos, capacidades y transporte a esa sesión concreta.
- Resolver nombres e iconos registrados; complementar con identidades de escritorio conocidas.
- Restaurar una ventana existente o activar una aplicación registrada. Si no resulta posible, restaurar Prisma.
- Mantener el volumen global y el temporizador independientes de la consulta multimedia.

## Alcance de validación

Pruebas de selección y respaldo, compilación web/nativa y lectura real de sesiones. El clic físico y la compatibilidad de cada reproductor requieren comprobación en la aplicación.

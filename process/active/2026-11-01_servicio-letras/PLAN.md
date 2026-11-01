# Integración del servicio de letras en Prisma

Fecha: 2026-11-01. Rama: preview.

Solicitud autorizada: integrar el servicio descrito en Documentación Core primero en Prisma. Super Galería se implementará después y queda fuera de este cambio.

Alcance: consulta pública por título/artista, revisión de candidatos y grabaciones, aplicación explícita al editor existente, fuente alternativa LRCLIB identificada, aportes anónimos con comprobantes e idempotencia y respeto de servicios conectados. Sin cambios de versión, publicación ni despliegue.

Criterios: preservar archivos locales hasta guardar, no asumir equivalencia de grabación por duración, no enviar biblioteca ni audio, conservar reintentos y separar recepción de publicación. Pruebas del contrato y compilación web; revisión en navegador con búsqueda real. La aceptación del guardado y reproducción nativos queda identificada aparte.

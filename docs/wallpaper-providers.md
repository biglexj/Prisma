# Proveedores del catálogo de wallpapers

Revisión: 2026-11-02.

## Disponible actualmente

Prisma consulta el catálogo oficial de Biglex J mediante `/api/v1/wallpapers`. La cuenta identifica al usuario y el servidor decide qué contenido puede utilizar. Letras y Wallpapers tienen interruptores independientes.

El antiguo «Servidor del catálogo» cambiaba la URL base para un servidor local o personalizado con el mismo contrato de Aurora. No era un selector de proveedores externos: una dirección como pexels.com no implementa nuestra API. El control se retiró; el cliente usa el servidor oficial incluso si conserva una dirección personalizada en preferencias antiguas.

Texto de interfaz: «Catálogo de Biglex J. Explora wallpapers públicos y contenido exclusivo según los permisos de tu cuenta».

## Proveedores externos: propuesta sin implementar

Si se añaden fuentes externas, presentarlas como «Proveedores de wallpapers», con nombre, descripción, atribución y estado de conexión propios. Evitar pedir una URL genérica o sugerir que cualquier página sirve como catálogo. Mantener Biglex J como proveedor disponible; no mostrar Pexels como integrado.

Cada proveedor necesita un adaptador para búsqueda, paginación, tamaños y créditos, además de tratamiento de errores, cuotas y cancelación. La selección debe conservar procedencia, autor y enlace original. Los permisos Premium de Biglex J no conceden prestaciones de terceros. Nunca enviar el token de Biglex J al proveedor externo. Definir primero si el acceso utiliza un servicio intermediario o credenciales individuales admitidas por el proveedor, su almacenamiento y el consumo de cuota; no distribuir una clave secreta común en el cliente.

## Pexels: viabilidad condicionada

Su API ofrece búsqueda de imágenes, requiere una clave de acceso y pide un enlace destacado a Pexels y créditos de fotógrafos cuando sea posible. Sus reglas distinguen entre una app que replica una biblioteca/servicio de wallpapers y una función complementaria para elegir un fondo dentro de otra aplicación. Prisma es una aplicación multimedia más amplia y podría encajar en el segundo supuesto; esto es una evaluación inicial, no una aprobación de Pexels. Confirmar el caso concreto y los requisitos antes de implementarlo o anunciarlo. No extender esa conclusión automáticamente a Super Galería.

Fuentes oficiales consultadas:

- [Documentación de la API de Pexels](https://www.pexels.com/api/documentation/).
- [Uso de la API en aplicaciones de wallpapers y excepciones](https://help.pexels.com/hc/en-us/articles/4405588861721-Can-I-use-the-API-as-a-wallpaper-app).

Para el usuario, una integración futura debería explicar qué contenido ofrece cada fuente, si necesita conexión o credenciales, quién recibe las consultas y dónde aparecen los créditos. Las cuotas y condiciones deben verificarse nuevamente al implementar.

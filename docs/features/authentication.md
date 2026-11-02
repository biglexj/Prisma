# Autenticación de Prisma

Contrato reutilizable y componente de callback: [Documentación Core](../../../Docs/features/authentication/native-desktop-auth.md). Prisma conserva su propia sesión; no usa la sesión ni la restricción administrativa de Aurora Hub.

## Configuración vigente

| Edición | Retorno permitido | Bóveda |
| --- | --- | --- |
| Stable | `prisma://auth/callback` | `prisma:user-session:prod:provider` |
| Dev | `prisma-dev://auth/callback` | `prisma:user-session:dev:provider` |

El proveedor predeterminado es Supabase Auth. `src-tauri/auth.public.json` distribuye únicamente URL y clave **publicable**, contrastadas con la configuración pública de Hub. No contiene claves de servidor ni secretos OAuth. Se permiten sustituciones públicas mediante `PRISMA_SUPABASE_URL` y `PRISMA_SUPABASE_PUBLISHABLE_KEY`. Un callback configurado mediante `PRISMA_AUTH_REDIRECT_URI` debe seguir perteneciendo al entorno actual. El modo de backend propio queda como adaptación explícita, no como opción operativa por defecto.

El callback se registra en HKCU. El comando de Dev conserva `--dev` incluso con un binario Release. Con la aplicación abierta, el nuevo proceso reenvía el retorno por el canal local existente de Prisma y sale si la entrega se confirma. El receptor exige peer loopback, esquema correcto y una prueba PKCE pendiente; el canje y su resultado se gestionan en el proceso que inició el login. No viajan tokens por ese canal. Si no hay receptor, el arranque normal recupera la prueba cifrada de la bóveda.

El adaptador utiliza el canje JSON `grant_type=pkce` y la renovación `grant_type=refresh_token`. La prueba PKCE usa entropía criptográfica del sistema. Las sesiones restauradas requieren verificación remota antes de habilitar acciones conectadas. El cierre usa el alcance de sesión local del proveedor; si falla, informa que el borrado local no acredita revocación remota.

## Permisos

El [proceso existente](../../process/active/2026-11-01_estandar-autenticacion-servicios/PLAN.md) define letras y wallpapers. Consultar letras y aportar anónimamente no exige cuenta. La sesión permite atribuir un aporte al usuario verificado; no publica automáticamente ni concede moderación. Wallpapers conserva la autorización por recurso (`isAuthorized !== false`) y las preferencias/permisos comprobados por el servidor. Iniciar sesión no convierte a un usuario en VIP o admin.

La configuración y corrección del login no implementan Device Code, favoritos remotos, subida comunitaria ni la bandeja administrativa de aportes. Esas capacidades mantienen sus pendientes. No se han cambiado permisos o redirecciones del proveedor remoto ni publicado una versión de Prisma.

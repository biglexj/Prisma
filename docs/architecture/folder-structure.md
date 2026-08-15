# Estructura modular de Prisma

## Principio

Prisma se organiza por capacidades del producto. Una feature contiene decisiones y comportamiento propios de Prisma; infraestructura contiene mecanismos técnicos reemplazables.

La estructura es progresiva: ninguna carpeta se crea antes de que exista una responsabilidad real que ubicar en ella.

## Árbol de destino

```text
Prisma/
├── docs/
│   ├── architecture/
│   ├── features/
│   ├── testing/
│   └── distribution/
├── src/
│   ├── app/
│   ├── features/
│   └── shared/
├── src-tauri/
│   └── src/
│       ├── app/
│       ├── features/
│       ├── infrastructure/
│       └── shared/
├── tests/
│   ├── contracts/
│   ├── fixtures/
│   └── e2e/
└── scripts/
```

## Fronteras

### `app`

Arranque, composición, ventanas, routing, comandos, eventos y estado compartido. No contiene reglas particulares de reproducción, biblioteca o letras.

### `features`

Capacidades reconocibles del producto, como `playback`, `viewer`, `library`, `queue`, `metadata` y `lyrics`.

Una feature pequeña comienza con pocos archivos. Solo incorpora subcarpetas como `domain`, `application`, `model` o `ui` cuando su tamaño y responsabilidades lo justifican.

En el estado actual, `music_library` conserva las decisiones propias del audio y `visual_library` comparte únicamente el contrato que sí es común entre imágenes y vídeos. `home` compone resúmenes de ambas sin apropiarse de sus reglas de escaneo.

### `infrastructure`

Implementaciones reemplazables: libmpv, filesystem, SQLite, decodificadores e integraciones de Windows o Linux. Infrastructure implementa contratos definidos por las features; no decide comportamiento del producto.

### `shared`

Código verdaderamente transversal y sin dueño funcional claro. No es una carpeta de descarte. Si algo solo lo usa una feature, permanece dentro de ella.

## Límites de tamaño

- Objetivo normal: 200–600 líneas por archivo.
- Revisar separación de responsabilidades al superar 700–800 líneas.
- Advertencia fuerte al llegar a 1000 líneas.
- Máximo excepcional: 1200 líneas.
- Los archivos generados, fixtures extensos y migraciones pueden documentar una excepción.

La división se realiza por responsabilidad, no únicamente para reducir un contador. Un componente React de 900 líneas normalmente ya necesita separarse, aunque no haya llegado al máximo.

## Documentación modular

- Cada documento responde una pregunta principal.
- El objetivo normal es 500–900 líneas.
- El máximo es 1200 líneas.
- Cuando un tema crece, se convierte en una carpeta con un `README.md` que funciona como índice.
- Las decisiones permanentes se registran como ADR y no se esconden dentro de guías operativas.

## Regla para agentes

Antes de crear un archivo o módulo, el agente debe responder:

1. ¿Pertenece a una capacidad reconocible del producto? Va en `features`.
2. ¿Es un mecanismo técnico reemplazable? Va en `infrastructure`.
3. ¿Compone el proceso, las ventanas o los contratos de entrada? Va en `app`.
4. ¿Es verdaderamente transversal y estable? Puede ir en `shared`.

No se crean carpetas vacías para anticipar features futuras.

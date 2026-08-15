# 🎯 Prisma — Roadmap

Plan de trabajo, objetivos de producto y hoja de ruta estratégica del proyecto.

> **Regla del roadmap:** El Roadmap reúne los pendientes, prioridades, pausas y logros del producto. La ejecución detallada se registra dentro de `process/active/YYYY-MM-DD_objetivo/`. Cuando un proceso queda aprobado, el elemento correspondiente pasa a **Completado** (`- [x] **vX.X.X**`).

---

## 🔴 Pendientes activos

- [ ] **Estandarización Ecosistema biglexj** — `process/active/2026-08-11_estandarizacion_ecosistema_biglexj/`
- [ ] **Modo de Reproducción Flotante (PiP / MiniPlayer)** — `process/active/`
- [x] **Optimización de Renderizado de Listas de Fotos Masivas y Memoria WebView** — `process/completed/2026/2026-08-13_optimizacion_memoria_webview/`

---

## 🟡 Intermedio (Prioridad Media/Baja)

- [ ] Soporte para listas de reproducción personalizadas y exportación M3U.
- [ ] Búsqueda y filtrado avanzado por metadatos (artista, álbum, formato, fecha).
- [ ] Ajustes de ecualizador y filtros de audio mediante MPV.
- [ ] Sistema de marcadores y etiquetas en galería visual.

---

## ⚪ Descartado / En Pausa

- ⏸️ Integración con servicios de streaming en la nube (Prisma se mantiene como visor 100% local-first).

---

## 🟢 Completado

- [x] **v0.6.0**
  - Integración completa de la estructura de procesos, reglas de agente `.agents/rules/` y gobernanza del ecosistema biglexj.
- [x] **v0.5.0**
  - Motor de vista previa nativa MPV y generación acelerada de miniaturas visuales.
- [x] **v0.4.0**
  - Biblioteca de música local, extracción de metadatos (Lofty) y reproductor integrado.
- [x] **v0.3.0**
  - Sistema de UI basado en Material 3 Expressive, navegación por dominios y Dashboard.
- [x] **v0.2.0**
  - Capa de comunicación IPC entre React/TypeScript y backend nativo Tauri v2 / Rust.
- [x] **v0.1.0**
  - Inicialización del proyecto y configuración base de empaquetado.

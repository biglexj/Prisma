# Plan: Estandarización e Integración del Ecosistema biglexj en Prisma

- **Fecha:** 2026-08-11
- **Responsable:** Antigravity AI
- **Estado:** En ejecución

## 🎯 Objetivo
Implementar la estructura completa de reglas, gobernanza, documentación y procesos de trabajo del ecosistema **biglexj** en la aplicación de escritorio **Prisma**, elevando el proyecto al estándar dorado de la red.

## 📋 Alcance
1. **Reglas del Agente (`.agents/rules/`)**:
   - `base.md`: Instrucciones principales del agente con personalidad científica Dr. Stone / Senku, reglas de versionado, planning mode y enlaces oficiales de soporte.
   - `core_profile.md`: Perfil técnico Core para aplicaciones Desktop (Windows, React, TypeScript, Tauri, Rust).
   - `folder_structure.md`: Arbol semántico detallado de carpetas y límites de tamaño de archivo.
2. **Raíz del Proyecto (`agent.md`)**:
   - Instrucciones espejo en la raíz para descubrimiento directo.
3. **Flujo de Procesos (`process/`)**:
   - Creación del proceso activo `2026-08-11_estandarizacion_ecosistema_biglexj/` con `PLAN.md`, `TASKS.md`, `VALIDATION.md` y `APPROVAL.md`.
4. **Hojas de Ruta y Versionado (`ROADMAP.md`, `RELEASE_NOTES.md`, `RELEASE_MESSAGE.md`)**:
   - Sincronización de versión a `0.6.0` en `package.json`, `tauri.conf.json` y `Cargo.toml`.
   - Historial de cambios sanitizados en `RELEASE_NOTES.md`.
   - Formato estándar de cuatro bloques en `ROADMAP.md`.
5. **Configuración de Entorno**:
   - Exclusión de `temp/`, `test/` y `scratch/` en `.gitignore`.

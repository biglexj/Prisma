# 📋 Plan de Proceso — Integración de Gallery-DL GUI en Prisma (Herramientas y Ecosistema)

- **Fecha de Inicio**: 2026-08-17
- **Objetivo**: Integrar el descargador masivo de galerías y colecciones de imágenes **Gallery-DL GUI** (`D:\Proyectos\biglexj\Gallery-DL-GUI`) en el ecosistema Prisma bajo la barra lateral de **HERRAMIENTAS**, con hub interactivo, enlace HTTP/IPC en Rust y sinergia con el Visor de Imágenes y Convertidor Prisma.
- **Autor**: biglexj & Antigravity

---

## 🎯 Alcance y Componentes

1. **Barra Lateral (`AppSidebar.tsx`)**:
   - Agregar ítem **Gallery-DL** (`Icon name="layers"` o `image`) en la sección `HERRAMIENTAS` junto a **Conversor** y **Luna Fetch**.

2. **Backend Nativo Tauri / Rust (`synapse.rs` / `lib.rs`)**:
   - Nuevo comando `launch_gallery_dl(url: Option<String>, directory_structure: Option<String>)`:
     - Intento 1: Envío HTTP directo al `InterceptionServer` local de Gallery-DL GUI (`http://127.0.0.1:18274/download` o `18284`).
     - Intento 2: Búsqueda y ejecución del binario local (`%LOCALAPPDATA%\Programs\GalleryDL-GUI\GalleryDL-GUI.exe`, `%PROGRAMFILES%`, o ruta de desarrollo `D:\Proyectos\biglexj\Gallery-DL-GUI\release\`).
     - Intento 3: Enlace de fallback a releases oficiales en GitHub.

3. **Vista Hub en Frontend (`GalleryDlView.tsx` & `gallery-dl.css`)**:
   - Banner de cabecera con identidad M3 Expressive (degradado esmeralda / cian / violeta de galerías).
   - Caja de entrada rápida para URLs de álbumes, perfiles de arte y galerías (Pixiv, ArtStation, Reddit, Danbooru, Twitter/X, Instagram, etc.).
   - Selector personalizado de estructura de carpetas (`Plana / Flat`, `Por Sitio / Dominio`, `Por Artista / Usuario`).
   - Botón *"Descargar Galería"* y botón *"Pegar"*.
   - Accesos directos de sinergia:
     - 🖼️ *Explorar Imágenes*: Abrir la galería visual en Prisma.
     - 🔄 *Optimizar en Convertidor*: Redimensionar por lotes o transcodificar formatos (WebP/AVIF).
     - 📂 *Abrir Carpeta*: Abrir el destino en el Explorador de Windows.
     - 🚀 *Abrir Gallery-DL GUI*: Lanzar la ventana de la aplicación.

4. **Soporte en Gallery-DL GUI (`Main.kt`)**:
   - Asegurar que los argumentos de inicio (`args`) pasen la URL inicial al estado `externalUrl` si la app se inicia desde cero mediante comando de Prisma.

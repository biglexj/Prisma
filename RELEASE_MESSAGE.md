# 🚀 Prisma v1.0.7 — Ecualizador & DSP de Audio de Alta Fidelidad, Micro-interacciones y Aurora Synapse

Llega **Prisma v1.0.7**, una de las mayores y más ambiciosas actualizaciones de la plataforma multimedia local. Esta versión estrena la nueva **Suite de Ecualización y Procesamiento DSP de Audio de Alta Fidelidad** con arquitectura de limitación y ganancia dinámica inspirada en FxSound (cero distorsión a volumen máximo), **micro-interacciones fluidas y reproducción sin interrupciones** en música y vídeos, la evolución completa del **Renombrador Masivo Multimedia**, sincronización continua mediante **Aurora Synapse** y un nuevo motor de conversión de imágenes nativo en Rust.

---

### ✨ Novedades destacadas

- 🎛️ **Suite de Ecualizador Gráfico y Procesamiento DSP**: Ecualizador de 10 bandas de alta resolución con interpolación Spline Bezier interactiva y 5 procesadores de audio en tiempo real: Claridad armónica (*Aural Exciter*), pegada de graves (*HyperBass*), sonido envolvente 3D (*Wide Mid-Side*), ambiente acústico y refuerzo dinámico (*Dynamic Boost*).
- 🔊 **Refuerzo Acústico Limpio sin Distorsión (Arquitectura FxSound)**: Motor DSP calibrado con compresión ascendente de codo suave (*soft-knee RMS*) y limitador predictivo *lookahead* a -0.17 dBFS (ventana de 7 ms). Aumenta la sonoridad percibida y el impacto acústico de tus pistas sin sobrecargar la señal ni generar clipping digital.
- 🎯 **Graves Centrados y Enfocados en Fase**: El refuerzo de graves (*HyperBass*) se procesa con filtro biquad centrado a 90 Hz ($Q = 2.5$) y 55 Hz ($Q = 2.2$) colocado estratégicamente tras el ensanchamiento estéreo, manteniendo el bombo y el bajo perfectamente sólidos en el centro sin dispersión lateral.
- ⏯️ **Experiencia de Reproducción Continua y Micro-animaciones**: Botón flotante circular de reproducción de aparición suave exclusivamente en hover sobre las carátulas. Micro-animación elástica (*pop bounce*) y onda expansiva luminosa (*ripple*) al dar Play. La música reproduce en segundo plano sin expulsar al usuario al panel "Escuchar".
- 🏷️ **Renombrador Masivo con Reglas Apiladas**: Nueva interfaz con distribución ergonómica de "un elemento por línea", proporcionando respiro visual total a selectores, patrones y contadores de caracteres.
- ⚡ **Sincronización Aurora Synapse LAN & P2P**: Soporte completo para deep links y URIs canónicas en Windows, recepción fluida de reproducción continua (Handoff) desde dispositivos móviles, servidor HTTP de alta velocidad para carátulas y letras sincronizadas, y balizas UDP automáticas.
- 🖼️ **Motor de Conversión Nativo en Rust**: Conversión y redimensionado de imágenes de alto rendimiento en memoria (`Lanczos3`) para WebP, PNG y JPG sin dependencias externas.
- 🛠️ **Estandarización Global de Scripts**: Adopción de comandos normalizados en `package.json` (`build:web`, `build:desktop`, `compile`, `release`) alineados con la Documentación Core.

---

### 💖 Apoyo y comunidad

Si disfrutas usando **Prisma**, considera apoyar el desarrollo continuo:
- ☕ **Buy Me a Coffee**: https://buymeacoffee.com/biglexj
- 💳 **Donaciones directas**: https://www.biglexj.com/donaciones
- 🐙 **GitHub**: https://github.com/biglexj


# 🎛️ Especificación Técnica: Suite de 8 Nuevos Efectos para Barra de Progreso
## Guía de Portabilidad e Implementación para Supergalería (`Lienzo--Gallery` / Jetpack Compose)

- **Autor**: biglexj (Prisma Ecosystem)
- **Fecha de Redacción**: 2026-08-16
- **Propósito**: Documentar las fórmulas matemáticas, física aplicada, parámetros de renderizado y modelos en Kotlin / Jetpack Compose para replicar los 8 nuevos efectos de la barra de progreso de Prisma en Supergalería con 100% de simetría y fidelidad visual.

---

## 📐 1. Arquitectura de Renderizado y Bucle de Tiempo

### 1.1 Variables de Estado del Motor Físico (`RenderState`)
Para que las animaciones sean fluidas a 60/120 FPS sin latigazos al cambiar de estado de reproducción, se utiliza un bucle continuo de tiempo que actualiza un estado mutable:

```kotlin
data class ProgressRenderState(
    var phase: Float = 0f,              // Fase angular continua (rad)
    var currentAmp: Float = 0f,         // Amplitud actual interpolada suavemente
    var fluidVelocity: Float = 0f,      // Velocidad calculada del thumb (px/s)
    var lastProgressX: Float = 0f,      // Última posición X para derivar velocidad
    var elasticAmp: Float = 0f,         // Amplitud del oscilador armónico elástico
    var elasticPhase: Float = 0f,       // Fase del oscilador elástico
    val particles: MutableList<ProgressParticle> = mutableListOf()
)

data class ProgressParticle(
    var x: Float,
    var y: Float,
    var vx: Float,
    var vy: Float,
    var life: Float,
    val maxLife: Float,
    val size: Float,
    val color: Color
)
```

### 1.2 Actualización por Cuadro (Frame Step)
En cada cuadro con $\Delta t$ segundos:
1. **Fase Continua**: $\text{phase} = (\text{phase} + \Delta t \cdot \omega) \pmod{2\pi}$, donde $\omega = \frac{2\pi}{1.8\text{s}} \approx 3.49\,\text{rad/s}$.
2. **Suavizado de Amplitud (Attack / Release)**:
   $$\text{currentAmp} \leftarrow \text{currentAmp} + (\text{targetAmp} - \text{currentAmp}) \cdot \min(\Delta t \cdot 10, 1.0)$$
3. **Inercia de Arrastre (Velocidad)**:
   $$v = \frac{\text{progressX} - \text{lastProgressX}}{\Delta t}, \quad \text{fluidVelocity} \leftarrow \text{fluidVelocity} \cdot 0.85 + v \cdot 0.15$$

---

## 🎨 2. Catálogo Detallado de los 8 Nuevos Efectos

---

### 🌈 Efecto 1: Haz Prismático (`prism`)

#### 1. Concepto y Metáfora Visual
Dispersión cromática de luz espectral inspirada en la física óptica de difracción por un prisma de cristal. La sección activa muestra un degradado continuo iridiscente con un destello cáustico blanco que se desplaza armónicamente a lo largo de la barra. El thumb es un diamante facetado brillante.

#### 2. Parámetros Físicos y Medidas
- **Grosor de la línea**: $4\,\text{dp}$.
- **Destello cáustico**: Amplitud $\pm 45\,\text{dp}$, velocidad $\text{phase} \times 1.2$.
- **Gradiente espectral**:
  - `0.00`: `#FF453A` (Rojo Carmesí)
  - `0.20`: `#FF9F0A` (Naranja Ámbar)
  - `0.40`: `#FFD60A` (Amarillo Solar)
  - `0.60`: `#30D158` (Verde Esmeralda)
  - `0.80`: `#64D2FF` (Cian Eléctrico)
  - `1.00`: `#BF5AF2` (Violeta Espectral)
- **Thumb**: Diamante / Rombo de $13 \times 13\,\text{dp}$ con núcleo blanco y reflejo superior.

#### 3. Fórmulas de Dibujo
- **Destello Cáustico**:
  $$x_{\text{flare}} = \text{progressX} \cdot \left(0.5 + 0.5 \cdot \sin(\text{phase} \cdot 1.2)\right)$$
- **Rombo / Diamante**:
  $$\text{Path: } (\text{progressX}, \text{centerY} - r) \to (\text{progressX} + r, \text{centerY}) \to (\text{progressX}, \text{centerY} + r) \to (\text{progressX} - r, \text{centerY}) \to \text{Close}$$

#### 4. Modelo en Jetpack Compose (`DrawScope`)
```kotlin
fun DrawScope.drawPrismProgressBar(
    progressX: Float,
    width: Float,
    centerY: Float,
    phase: Float,
    isPlaying: Boolean,
    trackColor: Color
) {
    val strokePx = 4.dp.toPx()

    // 1. Inactivo
    if (progressX < width) {
        drawLine(
            color = trackColor,
            start = Offset(progressX, centerY),
            end = Offset(width, centerY),
            strokeWidth = strokePx,
            cap = StrokeCap.Round
        )
    }

    // 2. Activo: Gradiente espectral
    if (progressX > 0f) {
        val rainbowBrush = Brush.linearGradient(
            colors = listOf(
                Color(0xFFFF453A), Color(0xFFFF9F0A), Color(0xFFFFD60A),
                Color(0xFF30D158), Color(0xFF64D2FF), Color(0xFFBF5AF2)
            ),
            start = Offset(0f, centerY),
            end = Offset(progressX, centerY)
        )
        drawLine(
            brush = rainbowBrush,
            start = Offset(0f, centerY),
            end = Offset(progressX, centerY),
            strokeWidth = strokePx,
            cap = StrokeCap.Round
        )

        // Destello cáustico
        if (isPlaying) {
            val flarePos = progressX * (0.5f + 0.5f * sin(phase * 1.2f))
            val flareWidth = 35.dp.toPx()
            val flareBrush = Brush.radialGradient(
                colors = listOf(Color.White.copy(alpha = 0.85f), Color.Transparent),
                center = Offset(flarePos, centerY),
                radius = flareWidth
            )
            drawLine(
                brush = flareBrush,
                start = Offset((flarePos - flareWidth).coerceAtLeast(0f), centerY),
                end = Offset((flarePos + flareWidth).coerceAtMost(progressX), centerY),
                strokeWidth = strokePx * 1.8f
            )
        }
    }

    // 3. Thumb: Diamante facetado
    val diamondRadius = 6.5.dp.toPx()
    val diamondPath = Path().apply {
        moveTo(progressX, centerY - diamondRadius)
        lineTo(progressX + diamondRadius, centerY)
        lineTo(progressX, centerY + diamondRadius)
        lineTo(progressX - diamondRadius, centerY)
        close()
    }
    drawPath(diamondPath, color = Color.White)
    drawPath(
        diamondPath,
        color = Color(0xFF64D2FF),
        style = Stroke(width = 1.5.dp.toPx())
    )
}
```

---

### 📊 Efecto 2: Espectro SoundWave (`soundwave`)

#### 1. Concepto y Metáfora Visual
Ecualizador gráfico paramétrico compuesto por micro-barras verticales discretas con espaciado constante ($6\,\text{dp}$). La altura de cada barra oscila mediante la interferencia de múltiples armónicos senoidales. Las barras inactivas permanecen como puntos sutiles de $3\,\text{dp}$.

#### 2. Parámetros Físicos y Medidas
- **Paso entre barras**: $\text{step} = 6\,\text{dp}$.
- **Grosor de barra activa**: $3.2\,\text{dp}$ (esquinas redondeadas).
- **Altura base inactiva**: $3\,\text{dp}$.
- **Altura activa**: Rango de $4\,\text{dp}$ a $18\,\text{dp}$ según modulación armónica.
- **Armónicos de Modulación**:
  $$H(x, t) = 0.45 \cdot \sin\left(\frac{x}{22} - 3t\right) + 0.35 \cdot \sin\left(\frac{x}{13} + 2t\right) + 0.20 \cdot \cos\left(\frac{x}{31} - 1.5t\right)$$
- **Envolvente en extremos**: $\text{env}(x) = \min\left(\frac{x}{16}, \frac{\text{progressX} - x}{16}, 1.0\right)$.

#### 3. Modelo en Jetpack Compose (`DrawScope`)
```kotlin
fun DrawScope.drawSoundwaveProgressBar(
    progressX: Float,
    width: Float,
    centerY: Float,
    phase: Float,
    isPlaying: Boolean,
    primaryColor: Color,
    trackColor: Color
) {
    val barStep = 6.dp.toPx()
    val barWidth = 3.2.dp.toPx()
    val maxBarHeight = 18.dp.toPx()
    val minBarHeight = 4.dp.toPx()
    val inactiveBarHeight = 3.dp.toPx()
    val cornerRadius = CornerRadius(1.5.dp.toPx(), 1.5.dp.toPx())

    var x = 0f
    while (x <= width) {
        if (x <= progressX) {
            // Barra activa con modulación armónica
            val normX = x / 22.dp.toPx()
            val hNorm = if (isPlaying) {
                0.45f * sin(normX - phase * 3f) +
                0.35f * sin(x / 13.dp.toPx() + phase * 2f) +
                0.20f * cos(x / 31.dp.toPx() - phase * 1.5f)
            } else {
                0.2f * sin(normX)
            }

            val envelope = minOf(
                x / 16.dp.toPx(),
                (progressX - x) / 16.dp.toPx(),
                1f
            ).coerceAtLeast(0.15f)

            val barH = (minBarHeight + (hNorm * 0.5f + 0.5f) * (maxBarHeight - minBarHeight) * envelope)
                .coerceIn(minBarHeight, maxBarHeight)

            drawRoundRect(
                color = primaryColor,
                topLeft = Offset(x - barWidth / 2f, centerY - barH / 2f),
                size = Size(barWidth, barH),
                cornerRadius = cornerRadius
            )
        } else {
            // Barra inactiva sutil
            drawRoundRect(
                color = trackColor,
                topLeft = Offset(x - barWidth / 2f, centerY - inactiveBarHeight / 2f),
                size = Size(barWidth, inactiveBarHeight),
                cornerRadius = cornerRadius
            )
        }
        x += barStep
    }

    // Thumb / Cursor central
    val thumbW = 4.dp.toPx()
    val thumbH = 20.dp.toPx()
    drawRoundRect(
        color = Color.White,
        topLeft = Offset(progressX - thumbW / 2f, centerY - thumbH / 2f),
        size = Size(thumbW, thumbH),
        cornerRadius = CornerRadius(2.dp.toPx(), 2.dp.toPx())
    )
}
```

---

### 💧 Efecto 3: Mercurio Líquido (`fluid`)

#### 1. Concepto y Metáfora Visual
Comportamiento hidrodinámico y viscoelástico. El canal activo palpita suavemente simulando flujo laminar, y el thumb es una metagota que experimenta *squash & stretch* (deformación elástica proporcional a la velocidad e inercia de arrastre), acompañada por un reflejo especular satinado.

#### 2. Parámetros Físicos y Medidas
- **Grosor del tubo activo**: $5\,\text{dp}$ con micro-pulsación $\pm 1.2\,\text{dp}$.
- **Radio de la gota en reposo**: $r = 6.5\,\text{dp}$.
- **Deformación por velocidad (Squash & Stretch)**:
  $$s_x = 1.0 + \min(|v| \cdot 0.04, 0.70) + 0.15 \cdot \sin(3t), \quad s_y = \frac{1}{\sqrt{\max(s_x, 0.5)}}$$
- **Dimensiones de la elipse**: $r_x = r \cdot s_x, \quad r_y = r \cdot s_y$.

#### 3. Modelo en Jetpack Compose (`DrawScope`)
```kotlin
fun DrawScope.drawFluidProgressBar(
    progressX: Float,
    width: Float,
    centerY: Float,
    phase: Float,
    fluidVelocity: Float,
    isPlaying: Boolean,
    primaryColor: Color,
    trackColor: Color,
    thumbColor: Color
) {
    // 1. Inactivo
    if (progressX < width) {
        drawLine(
            color = trackColor,
            start = Offset(progressX, centerY),
            end = Offset(width, centerY),
            strokeWidth = 3.5.dp.toPx(),
            cap = StrokeCap.Round
        )
    }

    // 2. Activo: Tubo líquido con pulsación continua
    if (progressX > 0f) {
        val fluidPath = Path().apply {
            moveTo(0f, centerY)
            var x = 0f
            while (x <= progressX) {
                val pulse = if (isPlaying) sin(x / 20.dp.toPx() - phase * 2f) * 1.2.dp.toPx() else 0f
                lineTo(x, centerY + pulse)
                x += 3.dp.toPx()
            }
            lineTo(progressX, centerY)
        }
        drawPath(
            path = fluidPath,
            color = primaryColor,
            style = Stroke(width = 5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
        )
    }

    // 3. Thumb: Metagota con Squash & Stretch
    val baseRadius = 6.5.dp.toPx()
    val vel = abs(fluidVelocity)
    val breath = if (isPlaying) sin(phase * 3f) * 0.15f else 0f
    val scaleX = 1f + (vel * 0.04f).coerceAtMost(0.7f) + breath
    val scaleY = 1f / sqrt(scaleX.coerceAtLeast(0.5f))

    val rx = baseRadius * scaleX
    val ry = baseRadius * scaleY
    val thumbCenter = Offset(progressX.coerceIn(rx, width - rx), centerY)

    // Gota principal
    drawOval(
        color = thumbColor,
        topLeft = Offset(thumbCenter.x - rx, thumbCenter.y - ry),
        size = Size(rx * 2f, ry * 2f)
    )

    // Reflejo especular brillante superior
    drawCircle(
        color = Color.White.copy(alpha = 0.9f),
        radius = 1.8.dp.toPx(),
        center = Offset(thumbCenter.x - 1.5.dp.toPx(), thumbCenter.y - 2.dp.toPx())
    )
}
```

---

### 🧬 Efecto 4: Doble Hélice Cuántica (`helix`)

#### 1. Concepto y Metáfora Visual
Estructura molecular tridimensional de ADN / hebra cuántica entrelazada. Dos ondas sinusoidales desfasadas exactamente en $\pi\,\text{rad}$ ($180^\circ$) se cruzan rítmicamente. En los nodos regulares, peldaños luminosos conectan ambas hebras simulando puentes de hidrógeno.

#### 2. Parámetros Físicos y Medidas
- **Longitud de onda**: $\lambda = 36\,\text{dp}$.
- **Amplitud máxima**: $A = 6.5\,\text{dp}$.
- **Espaciado de peldaños conectores**: Cada $14\,\text{dp}$.
- **Hebra 1 (Primaria)**: Grosor $3.5\,\text{dp}$, color primario.
- **Hebra 2 (Luminosa)**: Grosor $2.5\,\text{dp}$, blanco translúcido (`#FFFFFFD8`).
- **Fórmula de las Hebras**:
  $$y_1(x) = \text{centerY} + A \cdot \sin\left(\frac{2\pi x}{\lambda} - \text{phase}\right)$$
  $$y_2(x) = \text{centerY} + A \cdot \sin\left(\frac{2\pi x}{\lambda} - \text{phase} + \pi\right)$$

#### 3. Modelo en Jetpack Compose (`DrawScope`)
```kotlin
fun DrawScope.drawHelixProgressBar(
    progressX: Float,
    width: Float,
    centerY: Float,
    phase: Float,
    isPlaying: Boolean,
    primaryColor: Color,
    trackColor: Color,
    thumbColor: Color
) {
    val wavelength = 36.dp.toPx()
    val maxAmp = 6.5.dp.toPx() * (if (isPlaying) 1f else 0.4f)

    // 1. Inactivo
    if (progressX < width) {
        drawLine(
            color = trackColor,
            start = Offset(progressX, centerY),
            end = Offset(width, centerY),
            strokeWidth = 3.dp.toPx(),
            cap = StrokeCap.Round
        )
    }

    if (progressX > 0f) {
        // 2. Peldaños de enlace cuántico
        val rungStep = 14.dp.toPx()
        var rx = 6.dp.toPx()
        while (rx <= progressX - 4.dp.toPx()) {
            val angle = (rx / wavelength) * 2f * Math.PI.toFloat() - phase
            val y1 = centerY + sin(angle) * maxAmp
            val y2 = centerY + sin(angle + Math.PI.toFloat()) * maxAmp
            drawLine(
                color = Color.White.copy(alpha = 0.25f),
                start = Offset(rx, y1),
                end = Offset(rx, y2),
                strokeWidth = 1.5.dp.toPx()
            )
            rx += rungStep
        }

        // 3. Hebra 1 (Color Primario)
        val strand1 = Path().apply {
            moveTo(0f, centerY)
            var x = 0f
            while (x <= progressX) {
                val angle = (x / wavelength) * 2f * Math.PI.toFloat() - phase
                lineTo(x, centerY + sin(angle) * maxAmp)
                x += 1.5.dp.toPx()
            }
        }
        drawPath(
            strand1,
            color = primaryColor,
            style = Stroke(width = 3.5.dp.toPx(), cap = StrokeCap.Round)
        )

        // 4. Hebra 2 (Luminosa en Contrafase)
        val strand2 = Path().apply {
            moveTo(0f, centerY)
            var x = 0f
            while (x <= progressX) {
                val angle = (x / wavelength) * 2f * Math.PI.toFloat() - phase + Math.PI.toFloat()
                lineTo(x, centerY + sin(angle) * maxAmp)
                x += 1.5.dp.toPx()
            }
        }
        drawPath(
            strand2,
            color = Color.White.copy(alpha = 0.85f),
            style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round)
        )
    }

    // 5. Thumb: Esfera con núcleo cuántico
    drawCircle(
        color = primaryColor.copy(alpha = 0.35f),
        radius = 8.dp.toPx(),
        center = Offset(progressX, centerY)
    )
    drawCircle(
        color = thumbColor,
        radius = 5.5.dp.toPx(),
        center = Offset(progressX, centerY)
    )
}
```

---

### ⚡ Efecto 5: Pulso Bio-Sensor ECG (`neon_pulse`)

#### 1. Concepto y Metáfora Visual
Monitor cardíaco y bio-sensor de telemetría médica en cian neón electroluminiscente (`#00F0FF`). A lo largo de la línea activa viaja un complejo electrocardiográfico completo (Onda P, depresión Q, pico R agudo de $10.5\,\text{dp}$, valle S y repolarización T).

#### 2. Parámetros Físicos y Formulación Sintética del ECG
- **Color de emisión**: Cian Neón (`#00F0FF`) con resplandor difuso.
- **Ancho del paquete cardíaco**: $L_{\text{pulse}} = 50\,\text{dp}$.
- **Posición del pulso**:
  $$x_{\text{pulse}} = \text{progressX} \cdot \left(\frac{\text{phase}}{2\pi}\right)$$
- **Ecuación por segmentos** con $u = \frac{x - x_{\text{pulse}}}{L_{\text{pulse}} / 2} \in [-1, 1]$:
  $$\Delta y(u) = \begin{cases} 
  -2.5 \cdot \sin\left(\frac{u + 0.55}{0.15}\pi\right) & \text{si } -0.70 < u < -0.40 \quad (\text{Onda P}) \\
  +3.5 & \text{si } -0.20 \le u < -0.08 \quad (\text{Valle Q}) \\
  -10.5 \cdot \left(1 - \frac{|u|}{0.08}\right) & \text{si } -0.08 \le u \le 0.08 \quad (\text{Pico R}) \\
  +4.5 & \text{si } 0.08 < u \le 0.20 \quad (\text{Valle S}) \\
  -3.0 \cdot \sin\left(\frac{u - 0.525}{0.175}\pi\right) & \text{si } 0.35 < u < 0.70 \quad (\text{Onda T}) \\
  0 & \text{en otro caso (Línea Isoeléctrica)}
  \end{cases}$$

#### 3. Modelo en Jetpack Compose (`DrawScope`)
```kotlin
fun DrawScope.drawNeonPulseProgressBar(
    progressX: Float,
    width: Float,
    centerY: Float,
    phase: Float,
    isPlaying: Boolean,
    trackColor: Color,
    thumbColor: Color
) {
    val neonCyan = Color(0xFF00F0FF)

    // 1. Inactivo
    if (progressX < width) {
        drawLine(
            color = trackColor,
            start = Offset(progressX, centerY),
            end = Offset(width, centerY),
            strokeWidth = 3.dp.toPx(),
            cap = StrokeCap.Round
        )
    }

    // 2. Activo: ECG viajero
    if (progressX > 0f) {
        val pulseLen = 50.dp.toPx()
        val pulsePos = if (isPlaying) {
            (phase / (2f * Math.PI.toFloat())) * progressX
        } else {
            progressX * 0.7f
        }

        val ecgPath = Path().apply {
            moveTo(0f, centerY)
            var x = 0f
            val halfLen = pulseLen / 2f
            while (x <= progressX) {
                val dist = x - pulsePos
                var y = centerY
                if (abs(dist) < halfLen) {
                    val norm = dist / halfLen
                    if (norm > -0.7f && norm < -0.4f) {
                        y -= 2.5.dp.toPx() * sin(((norm + 0.55f) / 0.15f) * Math.PI.toFloat())
                    } else if (norm >= -0.2f && norm < -0.08f) {
                        y += 3.5.dp.toPx()
                    } else if (norm >= -0.08f && norm <= 0.08f) {
                        y -= 10.5.dp.toPx() * (1f - abs(norm / 0.08f))
                    } else if (norm > 0.08f && norm <= 0.2f) {
                        y += 4.5.dp.toPx()
                    } else if (norm > 0.35f && norm < 0.7f) {
                        y -= 3.0.dp.toPx() * sin(((norm - 0.525f) / 0.175f) * Math.PI.toFloat())
                    }
                }
                lineTo(x, y)
                x += 2.dp.toPx()
            }
        }

        // Halo neón
        drawPath(
            path = ecgPath,
            color = neonCyan.copy(alpha = 0.35f),
            style = Stroke(width = 6.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
        )
        // Trazo central nítido
        drawPath(
            path = ecgPath,
            color = neonCyan,
            style = Stroke(width = 3.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
        )
    }

    // 3. Thumb
    val thumbW = 4.5.dp.toPx()
    val thumbH = 16.dp.toPx()
    drawRoundRect(
        color = thumbColor,
        topLeft = Offset(progressX - thumbW / 2f, centerY - thumbH / 2f),
        size = Size(thumbW, thumbH),
        cornerRadius = CornerRadius(2.25.dp.toPx(), 2.25.dp.toPx())
    )
}
```

---

### ✨ Efecto 6: Estela Cósmica (`particles`)

#### 1. Concepto y Metáfora Visual
Emisión balística de micro-partículas estelares originadas en el thumb que flotan y se dispersan hacia atrás con desaceleración e inercia física, desvaneciéndose en el espacio. El thumb es una estrella resplandeciente.

#### 2. Parámetros del Sistema de Partículas
- **Límite de partículas vivas**: Máximo 35 concurrentes.
- **Tasa de emisión**: 65% de probabilidad por cuadro durante la reproducción.
- **Velocidad de expulsión**:
  $$v_x = -(\text{random}(15, 40) + |v_{\text{fluid}}| \cdot 20)\,\text{dp/s}, \quad v_y = \text{random}(-6, 6)\,\text{dp/s}$$
- **Vida útil**: $T_{\text{max}} = \text{random}(0.5, 1.3)\,\text{s}$.
- **Transparencia**: $\alpha = \max\left(1.0 - \frac{t_{\text{life}}}{T_{\text{max}}}, 0.0\right)$.

#### 3. Modelo en Jetpack Compose (`DrawScope`)
```kotlin
fun DrawScope.drawParticlesProgressBar(
    progressX: Float,
    width: Float,
    centerY: Float,
    particles: List<ProgressParticle>,
    primaryColor: Color,
    trackColor: Color,
    thumbColor: Color
) {
    // 1. Inactivo
    if (progressX < width) {
        drawLine(
            color = trackColor,
            start = Offset(progressX, centerY),
            end = Offset(width, centerY),
            strokeWidth = 3.5.dp.toPx(),
            cap = StrokeCap.Round
        )
    }

    // 2. Haz de plasma activo
    if (progressX > 0f) {
        drawLine(
            color = primaryColor,
            start = Offset(0f, centerY),
            end = Offset(progressX, centerY),
            strokeWidth = 4.dp.toPx(),
            cap = StrokeCap.Round
        )

        // 3. Renderizado de micro-partículas
        for (p in particles) {
            val alpha = (1f - (p.life / p.maxLife)).coerceIn(0f, 1f)
            drawCircle(
                color = p.color.copy(alpha = alpha),
                radius = p.size.dp.toPx(),
                center = Offset(p.x, p.y)
            )
        }
    }

    // 4. Thumb: Estrella con halo resplandeciente
    drawCircle(
        color = primaryColor.copy(alpha = 0.4f),
        radius = 8.5.dp.toPx(),
        center = Offset(progressX, centerY)
    )
    drawCircle(
        color = thumbColor,
        radius = 5.5.dp.toPx(),
        center = Offset(progressX, centerY)
    )
}
```

---

### 📼 Efecto 7: Cinta Analógica & Vinilo (`vinyl_tape`)

#### 1. Concepto y Metáfora Visual
Estética retro analógica de alta fidelidad. Representa una cinta de casete magnética y microsurcos de vinilo (ancho $8\,\text{dp}$) con marcas de índice viajeras. El thumb es un cabezal de reproducción de aluminio cepillado con un rubí central de joya óptica.

#### 2. Parámetros Físicos y Medidas
- **Altura de la cinta**: $8\,\text{dp}$ (radio de redondeo $2\,\text{dp}$).
- **Microsurcos longitudinales**: Dos líneas blancas finas de $1\,\text{dp}$ al 35% de opacidad.
- **Marcas de índice magnético**: Bloques verticales espaciados cada $18\,\text{dp}$ que avanzan con la fase.
- **Cabezal de aluminio**: Rectángulo de $6.5 \times 18\,\text{dp}$ en color `#E1E4E8` con biseles y joya rubí central roja (`#FF3B30`) de radio $1.6\,\text{dp}$.

#### 3. Modelo en Jetpack Compose (`DrawScope`)
```kotlin
fun DrawScope.drawVinylTapeProgressBar(
    progressX: Float,
    width: Float,
    centerY: Float,
    phase: Float,
    isPlaying: Boolean,
    primaryColor: Color,
    trackColor: Color
) {
    val tapeH = 8.dp.toPx()
    val tapeY = centerY - tapeH / 2f

    // 1. Inactivo: Guía de cinta vacía
    if (progressX < width) {
        drawRoundRect(
            color = trackColor,
            topLeft = Offset(progressX, tapeY + 2.dp.toPx()),
            size = Size(width - progressX, 4.dp.toPx()),
            cornerRadius = CornerRadius(2.dp.toPx(), 2.dp.toPx())
        )
    }

    // 2. Activo: Cinta magnética con surcos
    if (progressX > 0f) {
        // Cuerpo de cinta
        drawRoundRect(
            color = primaryColor,
            topLeft = Offset(0f, tapeY),
            size = Size(progressX, tapeH),
            cornerRadius = CornerRadius(2.dp.toPx(), 2.dp.toPx())
        )

        // Microsurcos longitudinales
        val grooveColor = Color.White.copy(alpha = 0.35f)
        val grooveStroke = 1.dp.toPx()
        drawLine(
            color = grooveColor,
            start = Offset(0f, tapeY + 2.5.dp.toPx()),
            end = Offset(progressX, tapeY + 2.5.dp.toPx()),
            strokeWidth = grooveStroke
        )
        drawLine(
            color = grooveColor,
            start = Offset(0f, tapeY + 5.5.dp.toPx()),
            end = Offset(progressX, tapeY + 5.5.dp.toPx()),
            strokeWidth = grooveStroke
        )

        // Marcas magnéticas en movimiento
        if (isPlaying) {
            val markColor = Color.Black.copy(alpha = 0.25f)
            val offset = ((phase * 6f) % 18.dp.toPx())
            var mx = offset
            while (mx < progressX - 3.dp.toPx()) {
                drawRect(
                    color = markColor,
                    topLeft = Offset(mx, tapeY + 1.dp.toPx()),
                    size = Size(2.dp.toPx(), tapeH - 2.dp.toPx())
                )
                mx += 18.dp.toPx()
            }
        }
    }

    // 3. Thumb: Cabezal de aluminio con punto rubí
    val thumbW = 6.5.dp.toPx()
    val thumbH = 18.dp.toPx()
    val thumbX = (progressX - thumbW / 2f).coerceIn(0f, width - thumbW)

    // Cabezal de aluminio
    drawRoundRect(
        color = Color(0xFFE1E4E8),
        topLeft = Offset(thumbX, centerY - thumbH / 2f),
        size = Size(thumbW, thumbH),
        cornerRadius = CornerRadius(2.dp.toPx(), 2.dp.toPx())
    )
    // Joya rubí central
    drawCircle(
        color = Color(0xFFFF3B30),
        radius = 1.6.dp.toPx(),
        center = Offset(thumbX + thumbW / 2f, centerY)
    )
}
```

---

### 🎻 Efecto 8: Cuerda Elástica Tensada (`elastic_string`)

#### 1. Concepto y Metáfora Visual
Física de cuerda vibrante tensada (modo fundamental de oscilación armónica acústica $n=1$). La cuerda vibra continuamente durante la reproducción con estelas semi-transparentes de resonancia, y responde dinámicamente con mayor amplitud al pasar el puntero o soltar el arrastre (pulsación / punteo acústico).

#### 2. Parámetros Físicos y Formulación
- **Modo normal de vibración**:
  $$y(x, t) = \text{centerY} + A(t) \cdot \sin\left(\frac{\pi x}{\text{progressX}}\right) \cdot \sin(\omega t)$$
- **Amplitud total**:
  $$A(t) = A_{\text{pluck}}(t) + \begin{cases} 2.8\,\text{dp} \cdot \sin(5t) & \text{si reproduce} \\ 0 & \text{si pausado} \end{cases}$$
- **Estelas fantasma de resonancia**: Trazado simétrico superior e inferior con $\alpha = 0.25$.
- **Thumb**: Plectro / Cejuela acústica redondeada de $5 \times 17\,\text{dp}$.

#### 3. Modelo en Jetpack Compose (`DrawScope`)
```kotlin
fun DrawScope.drawElasticStringProgressBar(
    progressX: Float,
    width: Float,
    centerY: Float,
    phase: Float,
    elasticAmp: Float,
    isPlaying: Boolean,
    primaryColor: Color,
    trackColor: Color,
    thumbColor: Color
) {
    // 1. Inactivo: Cuerda en reposo
    if (progressX < width) {
        drawLine(
            color = trackColor,
            start = Offset(progressX, centerY),
            end = Offset(width, centerY),
            strokeWidth = 3.dp.toPx(),
            cap = StrokeCap.Round
        )
    }

    // 2. Activo: Cuerda armónica vibrante
    if (progressX > 0f) {
        val continuousVib = if (isPlaying) sin(phase * 5f) * 2.8.dp.toPx() else 0f
        val totalAmp = elasticAmp + continuousVib

        // Estelas de resonancia acústica semi-transparentes
        if (abs(totalAmp) > 0.4.dp.toPx()) {
            val ghostAlpha = 0.25f
            val ghostStroke = 1.5.dp.toPx()

            // Estela positiva
            val ghostTop = Path().apply {
                moveTo(0f, centerY)
                var x = 0f
                while (x <= progressX) {
                    val curve = sin((x / progressX.coerceAtLeast(1f)) * Math.PI.toFloat()) * totalAmp
                    lineTo(x, centerY + curve)
                    x += 3.dp.toPx()
                }
            }
            drawPath(
                ghostTop,
                color = primaryColor.copy(alpha = ghostAlpha),
                style = Stroke(width = ghostStroke)
            )

            // Estela negativa
            val ghostBottom = Path().apply {
                moveTo(0f, centerY)
                var x = 0f
                while (x <= progressX) {
                    val curve = -sin((x / progressX.coerceAtLeast(1f)) * Math.PI.toFloat()) * totalAmp
                    lineTo(x, centerY + curve)
                    x += 3.dp.toPx()
                }
            }
            drawPath(
                ghostBottom,
                color = primaryColor.copy(alpha = ghostAlpha),
                style = Stroke(width = ghostStroke)
            )
        }

        // Cuerda central
        val stringPath = Path().apply {
            moveTo(0f, centerY)
            var x = 0f
            while (x <= progressX) {
                val curve = sin((x / progressX.coerceAtLeast(1f)) * Math.PI.toFloat()) * totalAmp
                lineTo(x, centerY + curve)
                x += 2.dp.toPx()
            }
        }
        drawPath(
            stringPath,
            color = primaryColor,
            style = Stroke(width = 3.5.dp.toPx(), cap = StrokeCap.Round)
        )
    }

    // 3. Thumb: Plectro acústico
    val thumbW = 5.dp.toPx()
    val thumbH = 17.dp.toPx()
    drawRoundRect(
        color = thumbColor,
        topLeft = Offset(progressX - thumbW / 2f, centerY - thumbH / 2f),
        size = Size(thumbW, thumbH),
        cornerRadius = CornerRadius(2.5.dp.toPx(), 2.5.dp.toPx())
    )
}
```

---

## 🎯 3. Tabla Resumen de Equivalencias y Parámetros

| Identificador | Nombre en Español | Frecuencia ($\omega$) | Amplitud ($A$) | Forma del Thumb | Elemento Visual Distintivo |
|---|---|---|---|---|---|
| `wavy` | Ondulada | $3.49\,\text{rad/s}$ | $3.5\,\text{dp}$ | Cápsula $4.5 \times 16\,\text{dp}$ | Onda activa + estela de atenuación inactiva ($48\text{dp}$). |
| `classic` | Clásica | Estático | $0\,\text{dp}$ | Cápsula $4.5 \times 16\,\text{dp}$ | Línea pura Material 3 Expressive. |
| `prism` | Haz Prismático | $4.18\,\text{rad/s}$ | Destello $\pm 45\,\text{dp}$ | Diamante $13 \times 13\,\text{dp}$ | Degradado espectral de 6 colores + destello cáustico. |
| `soundwave` | Espectro SoundWave | $3.49\,\text{rad/s}$ | $4 \to 18\,\text{dp}$ | Barra $4 \times 20\,\text{dp}$ | Modulación armónica triple con barras discretas cada $6\text{dp}$. |
| `fluid` | Mercurio Líquido | $5.23\,\text{rad/s}$ | Pulsación $1.2\,\text{dp}$ | Elipse con *Squash & Stretch* | Deformación elástica de gota por inercia + reflejo especular. |
| `helix` | Doble Hélice | $3.49\,\text{rad/s}$ | $6.5\,\text{dp}$ | Esfera con halo $\oslash 11\,\text{dp}$ | Doble hebra 3D en contrafase $\pi$ con peldaños de enlace. |
| `neon_pulse` | Pulso Bio-Sensor | $3.49\,\text{rad/s}$ | Pico $10.5\,\text{dp}$ | Cápsula $4.5 \times 16\,\text{dp}$ | Electrocardiograma con pulso P-Q-R-S-T viajero en cian neón. |
| `particles` | Estela Cósmica | Continuo | Dispersión $\pm 6\,\text{dp}$ | Estrella $\oslash 11\,\text{dp}$ | Sistema de hasta 35 micro-partículas vivas flotantes. |
| `vinyl_tape` | Cinta Analógica | $3.49\,\text{rad/s}$ | Alto $8\,\text{dp}$ | Cabezal $6.5 \times 18\,\text{dp}$ | Microsurcos longitudinales + joya rubí de precisión. |
| `elastic_string` | Cuerda Elástica | $8.72\,\text{rad/s}$ | $2.8\,\text{dp} + \text{pluck}$ | Cejuela $5 \times 17\,\text{dp}$ | Modo normal $\sin(\pi x/L)$ con estelas de resonancia simétrica. |

---

## ⚡ 4. Recomendaciones Críticas de Rendimiento para Android

1. **Reutilización de Objetos `Path`**:
   - En Jetpack Compose, **nunca crear instancias `Path()` dentro de cada frame de `drawWithCache` o `Canvas`**.
   - Declarar una instancia persistente con `remember { Path() }` y llamar a `path.rewind()` o `path.reset()` antes de dibujar.
2. **Animación Continua sin Recomposición de Árbol**:
   - Utilizar `rememberInfiniteTransition()` con un `Float` animado de `0f` a `2f * Math.PI.toFloat()` o un `LaunchedEffect` con `withFrameNanos`.
   - Pasar el estado de animación directamente al `DrawScope` mediante `Modifier.drawWithCache` para que Compose solo re-ejecute el paso de dibujo (`DrawPhase`) y salte completamente la recomposición (`CompositionPhase`).
3. **Escalado de Densidad**:
   - Todas las constantes numéricas documentadas arriba están en `dp` y se convierten a píxeles físicos multiplicando por `density` (`dp.toPx()`), garantizando perfecta nitidez en pantallas de 120Hz AMOLED (Full HD+, Quad HD+).

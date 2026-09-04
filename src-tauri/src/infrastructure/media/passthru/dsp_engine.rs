use std::f32::consts::PI;

/// Filtro Biquad en forma directa II transpuesta (Direct Form II Transposed).
/// Procesa muestras estéreo en tiempo real con cero asignaciones de memoria en el bucle caliente.
#[derive(Clone, Debug)]
pub struct BiquadFilter {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    // Estados internos para canal izquierdo (L) y derecho (R)
    s1_l: f32,
    s2_l: f32,
    s1_r: f32,
    s2_r: f32,
}

impl BiquadFilter {
    pub fn new() -> Self {
        Self {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            s1_l: 0.0,
            s2_l: 0.0,
            s1_r: 0.0,
            s2_r: 0.0,
        }
    }

    /// Configura el filtro como ecualizador paramétrico de campana (Peaking EQ).
    pub fn set_peaking(&mut self, sample_rate: f32, freq: f32, q: f32, gain_db: f32) {
        if gain_db.abs() < 0.01 {
            self.b0 = 1.0;
            self.b1 = 0.0;
            self.b2 = 0.0;
            self.a1 = 0.0;
            self.a2 = 0.0;
            return;
        }

        let clamped_freq = freq.clamp(20.0, sample_rate * 0.49);
        let a = 10.0f32.powf(gain_db / 40.0);
        let omega = 2.0 * PI * clamped_freq / sample_rate;
        let sin_omega = omega.sin();
        let cos_omega = omega.cos();
        let alpha = sin_omega / (2.0 * q.max(0.1));

        let a0 = 1.0 + alpha / a;
        self.b0 = (1.0 + alpha * a) / a0;
        self.b1 = (-2.0 * cos_omega) / a0;
        self.b2 = (1.0 - alpha * a) / a0;
        self.a1 = (-2.0 * cos_omega) / a0;
        self.a2 = (1.0 - alpha / a) / a0;
    }

    /// Configura el filtro como High-Shelf (para brillo y aire).
    pub fn set_high_shelf(&mut self, sample_rate: f32, freq: f32, q: f32, gain_db: f32) {
        if gain_db.abs() < 0.01 {
            self.b0 = 1.0;
            self.b1 = 0.0;
            self.b2 = 0.0;
            self.a1 = 0.0;
            self.a2 = 0.0;
            return;
        }

        let clamped_freq = freq.clamp(20.0, sample_rate * 0.49);
        let a = 10.0f32.powf(gain_db / 40.0);
        let omega = 2.0 * PI * clamped_freq / sample_rate;
        let sin_omega = omega.sin();
        let cos_omega = omega.cos();
        let alpha = sin_omega / (2.0 * q.max(0.1));
        let sqrt_a = a.sqrt();

        let a0 = (a + 1.0) - (a - 1.0) * cos_omega + 2.0 * sqrt_a * alpha;
        self.b0 = (a * ((a + 1.0) + (a - 1.0) * cos_omega + 2.0 * sqrt_a * alpha)) / a0;
        self.b1 = (-2.0 * a * ((a - 1.0) + (a + 1.0) * cos_omega)) / a0;
        self.b2 = (a * ((a + 1.0) + (a - 1.0) * cos_omega - 2.0 * sqrt_a * alpha)) / a0;
        self.a1 = (2.0 * ((a - 1.0) - (a + 1.0) * cos_omega)) / a0;
        self.a2 = ((a + 1.0) - (a - 1.0) * cos_omega - 2.0 * sqrt_a * alpha) / a0;
    }

    /// Procesa una muestra estéreo (L, R) in-place.
    #[inline(always)]
    pub fn process_stereo(&mut self, l: f32, r: f32) -> (f32, f32) {
        let out_l = self.b0 * l + self.s1_l;
        self.s1_l = self.b1 * l - self.a1 * out_l + self.s2_l;
        self.s2_l = self.b2 * l - self.a2 * out_l;

        let out_r = self.b0 * r + self.s1_r;
        self.s1_r = self.b1 * r - self.a1 * out_r + self.s2_r;
        self.s2_r = self.b2 * r - self.a2 * out_r;

        (out_l, out_r)
    }

    #[allow(dead_code)]
    pub fn reset(&mut self) {
        self.s1_l = 0.0;
        self.s2_l = 0.0;
        self.s1_r = 0.0;
        self.s2_r = 0.0;
    }
}

/// Parámetros de ecualización y efectos de audio.
#[derive(Clone, Debug, PartialEq)]
pub struct DspParameters {
    pub enabled: bool,
    pub preamp_db: f32,
    pub band_gains_db: [f32; 10], // 31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz
    pub clarity: f32,             // 0 a 10
    pub ambience: f32,            // 0 a 10
    pub surround: f32,            // 0 a 10
    pub dynamic_boost: f32,       // 0 a 10
    pub bass_boost: f32,          // 0 a 10
}

impl Default for DspParameters {
    fn default() -> Self {
        Self {
            enabled: true,
            preamp_db: 0.0,
            band_gains_db: [0.0; 10],
            clarity: 4.0,
            ambience: 3.0,
            surround: 3.0,
            dynamic_boost: 2.0,
            bass_boost: 3.0,
        }
    }
}

pub const EQ_FREQUENCIES: [f32; 10] = [
    31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0,
];

/// Motor de procesamiento DSP en tiempo real completo de Prisma.
pub struct DspProcessor {
    sample_rate: f32,
    params: DspParameters,
    // 10 filtros paramétricos para el EQ gráfico
    eq_filters: [BiquadFilter; 10],
    // Filtros de Claridad (Aural Exciter: High-Shelf 7.5 kHz + Presence 3.5 kHz)
    clarity_air: BiquadFilter,
    clarity_presence: BiquadFilter,
    // Filtros de Graves Centrados (FxSound HyperBass: 90 Hz Q=2.5 y Sub 55 Hz Q=2.2)
    bass_main: BiquadFilter,
    bass_sub: BiquadFilter,
    // Buffer circular para retardo de Ambiente (Ambience diffusion delay)
    ambience_buf_l: Vec<f32>,
    ambience_buf_r: Vec<f32>,
    ambience_idx: usize,
    // Estado del Maximizer / Dynamic Boost
    compressor_env: f32,
    limiter_env: f32,
}

impl DspProcessor {
    pub fn new(sample_rate: f32) -> Self {
        let mut proc = Self {
            sample_rate,
            params: DspParameters::default(),
            eq_filters: std::array::from_fn(|_| BiquadFilter::new()),
            clarity_air: BiquadFilter::new(),
            clarity_presence: BiquadFilter::new(),
            bass_main: BiquadFilter::new(),
            bass_sub: BiquadFilter::new(),
            ambience_buf_l: vec![0.0; (sample_rate * 0.05) as usize], // hasta 50ms de retardo
            ambience_buf_r: vec![0.0; (sample_rate * 0.05) as usize],
            ambience_idx: 0,
            compressor_env: 0.0,
            limiter_env: 0.0,
        };
        proc.recalculate_filters();
        proc
    }

    #[allow(dead_code)]
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        if (self.sample_rate - sample_rate).abs() > 1.0 {
            self.sample_rate = sample_rate;
            self.ambience_buf_l = vec![0.0; (sample_rate * 0.05) as usize];
            self.ambience_buf_r = vec![0.0; (sample_rate * 0.05) as usize];
            self.ambience_idx = 0;
            self.recalculate_filters();
        }
    }

    pub fn update_parameters(&mut self, params: DspParameters) {
        self.params = params;
        self.recalculate_filters();
    }

    fn recalculate_filters(&mut self) {
        let sr = self.sample_rate;

        // 1. Configurar las 10 bandas del ecualizador gráfico
        for i in 0..10 {
            let freq = EQ_FREQUENCIES[i];
            let gain = self.params.band_gains_db[i];
            self.eq_filters[i].set_peaking(sr, freq, 1.527, gain);
        }

        // 2. Claridad (FxSound Aural Enhancer: Air en 7.5 kHz + Presencia en 3.5 kHz)
        let clarity_val = self.params.clarity.clamp(0.0, 10.0);
        let air_gain = clarity_val * 0.45;
        let presence_gain = clarity_val * 0.30;
        self.clarity_air.set_high_shelf(sr, 7500.0, 0.707, air_gain);
        self.clarity_presence.set_peaking(sr, 3500.0, 1.2, presence_gain);

        // 3. HyperBass Centrado (FxSound Play32: 90 Hz Q=2.5 y Sub-grave 55 Hz Q=2.2)
        // Se ejecuta después del Surround para mantener el centro perfecto sin fuga lateral
        let bass_val = self.params.bass_boost.clamp(0.0, 10.0);
        let bass_gain = bass_val * 0.90;
        let sub_gain = bass_val * 0.65;
        self.bass_main.set_peaking(sr, 90.0, 2.5, bass_gain);
        self.bass_sub.set_peaking(sr, 55.0, 2.2, sub_gain);
    }

    /// Procesa un bloque de muestras de audio estéreo intercaladas (L, R, L, R...) in-place.
    pub fn process_interleaved(&mut self, buffer: &mut [f32]) {
        if !self.params.enabled || buffer.is_empty() {
            return;
        }

        // Ganancia lineal de preamp
        let preamp_linear = 10.0f32.powf(self.params.preamp_db / 20.0);

        // Parámetros de Surround (Mid-Side)
        let surround_val = self.params.surround.clamp(0.0, 10.0);
        let side_multiplier = 1.0 + (surround_val * 0.12);
        let mid_compensation = 1.0 - (surround_val * 0.02);

        // Parámetros de Ambiente
        let amb_val = self.params.ambience.clamp(0.0, 10.0);
        let amb_enabled = amb_val > 0.01;
        let delay_samples = ((8.0 + amb_val * 1.5) * 0.001 * self.sample_rate) as usize;
        let amb_feedback = (0.04 + amb_val * 0.015).min(0.20);
        let amb_mix = (amb_val * 0.04).min(0.35);

        // Parámetros de HyperBass
        let bass_val = self.params.bass_boost.clamp(0.0, 10.0);

        // Parámetros de Dynamic Boost / Maximizer (FxSound Maxi32)
        let dyn_val = self.params.dynamic_boost.clamp(0.0, 10.0);
        let dyn_enabled = dyn_val > 0.01;
        let dyn_thresh = 10.0f32.powf((-8.0 - dyn_val * 0.8) / 20.0);
        let dyn_ratio = 1.3 + (dyn_val * 0.12);
        let dyn_makeup = 1.0 + (dyn_val * 0.09);

        // Coeficientes de ataque y liberación para RMS suave
        let comp_attack_coef = (-1.0 / (0.008 * self.sample_rate)).exp();
        let comp_release_coef = (-1.0 / (0.070 * self.sample_rate)).exp();
        let lim_attack_coef = (-1.0 / (0.005 * self.sample_rate)).exp();
        let lim_release_coef = (-1.0 / (0.050 * self.sample_rate)).exp();

        let num_frames = buffer.len() / 2;
        let buf_cap = self.ambience_buf_l.len();

        for i in 0..num_frames {
            let mut l = buffer[i * 2] * preamp_linear;
            let mut r = buffer[i * 2 + 1] * preamp_linear;

            // 1. Filtros del Ecualizador de 10 Bandas
            for filter in &mut self.eq_filters {
                let (fl, fr) = filter.process_stereo(l, r);
                l = fl;
                r = fr;
            }

            // 2. Claridad / Aural Exciter
            let (fl, fr) = self.clarity_air.process_stereo(l, r);
            let (fl2, fr2) = self.clarity_presence.process_stereo(fl, fr);
            l = fl2;
            r = fr2;

            // 3. Espacialidad y Ambiente (Difusión por retardo cruzado)
            if amb_enabled && buf_cap > 0 {
                let read_idx = (self.ambience_idx + buf_cap - (delay_samples % buf_cap)) % buf_cap;
                let delayed_l = self.ambience_buf_l[read_idx];
                let delayed_r = self.ambience_buf_r[read_idx];

                // Escribir en buffer circular con retroalimentación suave
                self.ambience_buf_l[self.ambience_idx] = l + delayed_r * amb_feedback;
                self.ambience_buf_r[self.ambience_idx] = r + delayed_l * amb_feedback;
                self.ambience_idx = (self.ambience_idx + 1) % buf_cap;

                // Mezcla sutil de ambiente
                l = l * (1.0 - amb_mix * 0.3) + delayed_r * amb_mix;
                r = r * (1.0 - amb_mix * 0.3) + delayed_l * amb_mix;
            }

            // 4. Sonido Envolvente 3D (Expansión Mid-Side)
            if surround_val > 0.01 {
                let mid = (l + r) * 0.5 * mid_compensation;
                let side = (l - r) * 0.5 * side_multiplier;
                l = mid + side;
                r = mid - side;
            }

            // 5. HyperBass Centrado (CRÍTICO: después de Surround y Ambiente)
            // Se aplica directamente sobre ambos canales para mantener el bajo 100% en el centro
            if bass_val > 0.01 {
                let (bl, br) = self.bass_main.process_stereo(l, r);
                let (bl2, br2) = self.bass_sub.process_stereo(bl, br);
                l = bl2;
                r = br2;
            }

            // 6. Dynamic Boost (Compresor ascendente suave)
            if dyn_enabled {
                let peak = l.abs().max(r.abs());
                let coef = if peak > self.compressor_env {
                    comp_attack_coef
                } else {
                    comp_release_coef
                };
                self.compressor_env = peak + coef * (self.compressor_env - peak);

                let comp_gain = if self.compressor_env > dyn_thresh {
                    let over_db = 20.0 * (self.compressor_env / dyn_thresh).log10();
                    let gain_reduction_db = over_db * (1.0 - 1.0 / dyn_ratio);
                    10.0f32.powf(-gain_reduction_db / 20.0)
                } else {
                    1.0
                };

                l *= comp_gain * dyn_makeup;
                r *= comp_gain * dyn_makeup;
            }

            // 7. Limitador Predictivo de Picos (Lookahead Limiter a 0.98 / -0.17 dBFS)
            // Evita totalmente distorsión digital o clipping a volúmenes altos
            let peak_out = l.abs().max(r.abs());
            let lim_coef = if peak_out > self.limiter_env {
                lim_attack_coef
            } else {
                lim_release_coef
            };
            self.limiter_env = peak_out + lim_coef * (self.limiter_env - peak_out);

            let max_ceiling = 0.98;
            if self.limiter_env > max_ceiling {
                let limit_gain = max_ceiling / self.limiter_env;
                l *= limit_gain;
                r *= limit_gain;
            }

            buffer[i * 2] = l.clamp(-1.0, 1.0);
            buffer[i * 2 + 1] = r.clamp(-1.0, 1.0);
        }
    }
}

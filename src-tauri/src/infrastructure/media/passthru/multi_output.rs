use std::collections::VecDeque;

/// Cola por salida. Cada dispositivo conserva su propio reloj y su fase de remuestreo.
pub struct OutputQueue {
    channels: usize,
    source_rate: u32,
    target_rate: u32,
    next_source_frame: f64,
    rate_adjustment: f64,
    received_frames: u64,
    previous_frame: Vec<f32>,
    samples: VecDeque<f32>,
    configured_delay_frames: usize,
    delay_remaining_samples: usize,
}

impl OutputQueue {
    pub fn new(channels: usize, source_rate: u32, target_rate: u32) -> Self {
        Self {
            channels,
            source_rate,
            target_rate,
            next_source_frame: 0.0,
            rate_adjustment: 0.0,
            received_frames: 0,
            previous_frame: vec![0.0; channels],
            samples: VecDeque::with_capacity((target_rate as usize / 10).saturating_mul(channels) + channels * 2),
            configured_delay_frames: 0,
            delay_remaining_samples: 0,
        }
    }

    pub fn push(&mut self, input: &[f32]) {
        if self.channels == 0 || self.source_rate == 0 || self.target_rate == 0 {
            return;
        }
        let frames = input.len() / self.channels;
        if frames == 0 {
            return;
        }
        let start = self.received_frames;
        let end = start + frames as u64;
        let step = self.source_rate as f64 / self.target_rate as f64 * (1.0 + self.rate_adjustment);
        while self.next_source_frame < end as f64 - 1.0 {
            let base = self.next_source_frame.floor() as u64;
            let frac = (self.next_source_frame - base as f64) as f32;
            for channel in 0..self.channels {
                let a = if base < start {
                    self.previous_frame[channel]
                } else {
                    input[(base - start) as usize * self.channels + channel]
                };
                let b = input[(base + 1 - start) as usize * self.channels + channel];
                self.samples.push_back(a + (b - a) * frac);
            }
            self.next_source_frame += step;
        }
        self.previous_frame.copy_from_slice(&input[(frames - 1) * self.channels..frames * self.channels]);
        self.received_frames = end;
        // Mantener la latencia acotada cuando los relojes físicos divergen o un endpoint se retrasa.
        let max_frames = (self.target_rate as usize / 10).max(1) + self.configured_delay_frames;
        while self.samples.len() / self.channels > max_frames {
            for _ in 0..self.channels { self.samples.pop_front(); }
        }
    }

    pub fn available_frames(&self) -> usize {
        // La espera configurada comienza con el primer bloque capturado, no al abrir el endpoint.
        if self.samples.is_empty() { return 0; }
        (self.samples.len() + self.delay_remaining_samples) / self.channels.max(1)
    }

    pub fn set_delay_ms(&mut self, delay_ms: u32) {
        let next = ((self.target_rate as u64 * delay_ms as u64 + 500) / 1_000) as usize;
        if next > self.configured_delay_frames {
            self.delay_remaining_samples += (next - self.configured_delay_frames) * self.channels;
        } else {
            let mut remove = (self.configured_delay_frames - next) * self.channels;
            let silence = remove.min(self.delay_remaining_samples);
            self.delay_remaining_samples -= silence;
            remove -= silence;
            for _ in 0..remove.min(self.samples.len()) { self.samples.pop_front(); }
        }
        self.configured_delay_frames = next;
    }

    /// Acerca lentamente el llenado al búfer objetivo para compensar relojes físicos distintos.
    pub fn set_clock_feedback(&mut self, device_padding: u32, buffer_frames: u32) {
        let target = (buffer_frames as usize + self.configured_delay_frames).max(1) as f64;
        let fill = device_padding as f64 + self.available_frames() as f64;
        self.rate_adjustment = ((fill - target) / target * 0.002).clamp(-0.002, 0.002);
    }

    pub fn pop_sample(&mut self) -> f32 {
        if self.delay_remaining_samples > 0 {
            self.delay_remaining_samples -= 1;
            0.0
        } else {
            self.samples.pop_front().unwrap_or(0.0)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::OutputQueue;

    #[test]
    fn packet_boundaries_do_not_change_resampling_phase() {
        let input: Vec<f32> = (0..480).map(|i| i as f32 / 480.0).collect();
        let mut whole = OutputQueue::new(1, 48_000, 44_100);
        whole.push(&input);
        let mut packets = OutputQueue::new(1, 48_000, 44_100);
        for packet in input.chunks(37) { packets.push(packet); }
        assert_eq!(whole.available_frames(), packets.available_frames());
        while whole.available_frames() > 0 {
            assert!((whole.pop_sample() - packets.pop_sample()).abs() < 0.00001);
        }
    }

    #[test]
    fn queue_stays_bounded_when_an_output_stalls() {
        let mut output = OutputQueue::new(2, 48_000, 44_100);
        output.push(&vec![0.25; 48_000 * 2]);
        assert!(output.available_frames() <= 4_410);
    }

    #[test]
    fn delay_can_be_set_on_any_output_and_changed_while_running() {
        let mut output = OutputQueue::new(1, 1_000, 1_000);
        output.set_delay_ms(3);
        assert_eq!(output.available_frames(), 0);
        output.push(&[1.0, 2.0, 3.0, 4.0]);
        assert_eq!([output.pop_sample(), output.pop_sample(), output.pop_sample()], [0.0; 3]);
        assert_eq!(output.pop_sample(), 1.0);
        output.set_delay_ms(5);
        assert_eq!([output.pop_sample(), output.pop_sample()], [0.0; 2]);
        output.set_delay_ms(0);
        assert_eq!(output.available_frames(), 0);
    }
}

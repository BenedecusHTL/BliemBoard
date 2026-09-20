use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum DetectorType {
    Peak,
    Rms,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CompressorParams {
    pub enabled: bool,
    pub threshold_db: f32,
    pub ratio: f32,
    pub attack_ms: f32,
    pub release_ms: f32,
    pub knee_db: f32,
    pub makeup_db: f32,
    pub auto_makeup: bool,
    pub detector: DetectorType,
}

impl Default for CompressorParams {
    fn default() -> Self {
        Self {
            enabled: false,
            threshold_db: -12.0,
            ratio: 4.0,
            attack_ms: 5.0,
            release_ms: 50.0,
            knee_db: 6.0,
            makeup_db: 0.0,
            auto_makeup: true,
            detector: DetectorType::Peak,
        }
    }
}

pub struct CompressorStats {
    pub max_gain_reduction_db: f32,
}

pub struct CompressorState {
    env: f32,
    attack_coeff: f32,
    release_coeff: f32,
    makeup_linear: f32,
    threshold_db: f32,
    ratio: f32,
    knee_db: f32,
    detector: DetectorType,
    channels: usize,
    pub max_gain_reduction_db: f32,
}

impl CompressorState {
    pub fn new(params: &CompressorParams, sample_rate: u32, channels: usize) -> Self {
        let attack_coeff = (-1.0 / (params.attack_ms * 0.001 * sample_rate as f32)).exp();
        let release_coeff = (-1.0 / (params.release_ms * 0.001 * sample_rate as f32)).exp();
        
        let makeup = if params.auto_makeup {
            -(params.threshold_db * (1.0 - 1.0 / params.ratio)) * 0.5 + params.makeup_db
        } else {
            params.makeup_db
        };
        
        Self {
            env: -100.0,
            attack_coeff,
            release_coeff,
            makeup_linear: 10.0_f32.powf(makeup / 20.0),
            threshold_db: params.threshold_db,
            ratio: params.ratio,
            knee_db: params.knee_db,
            detector: params.detector.clone(),
            channels,
            max_gain_reduction_db: 0.0,
        }
    }

    /// Processes one sample for all channels (stereo link).
    /// `frame` must be a slice of length `channels`.
    /// Returns the gain factor to apply to all channels.
    pub fn process_frame_gain(&mut self, frame: &[f32]) -> f32 {
        let mut level_db = -100.0;
        
        if self.detector == DetectorType::Peak {
            let mut max_abs = 0.0_f32;
            for &v in frame {
                let abs_v = v.abs();
                if abs_v > max_abs { max_abs = abs_v; }
            }
            level_db = 20.0 * (max_abs.max(1e-9)).log10();
        } else {
            let mut sum_sq = 0.0_f32;
            for &v in frame { sum_sq += v * v; }
            let rms = (sum_sq / self.channels as f32).sqrt();
            level_db = 20.0 * (rms.max(1e-9)).log10();
        }
        
        if level_db > self.env {
            self.env = self.attack_coeff * self.env + (1.0 - self.attack_coeff) * level_db;
        } else {
            self.env = self.release_coeff * self.env + (1.0 - self.release_coeff) * level_db;
        }
        
        let mut gr_db = 0.0;
        let diff = self.env - self.threshold_db;
        
        if diff > self.knee_db * 0.5 {
            gr_db = diff * (1.0 - 1.0 / self.ratio);
        } else if diff > -self.knee_db * 0.5 {
            let q = diff + self.knee_db * 0.5;
            gr_db = (1.0 - 1.0 / self.ratio) * (q * q) / (2.0 * self.knee_db);
        }
        
        if gr_db > self.max_gain_reduction_db {
            self.max_gain_reduction_db = gr_db;
        }
        
        10.0_f32.powf(-gr_db / 20.0) * self.makeup_linear
    }
    
    /// Helper for single-channel processing
    pub fn process_sample(&mut self, x: f32) -> f32 {
        let gain = self.process_frame_gain(&[x]);
        x * gain
    }
}

pub fn process(samples: &mut Vec<Vec<f32>>, sample_rate: u32, params: &CompressorParams) -> Result<CompressorStats, String> {
    if !params.enabled || samples.is_empty() {
        return Ok(CompressorStats { max_gain_reduction_db: 0.0 });
    }

    let channels = samples.len();
    if channels == 0 {
        return Ok(CompressorStats { max_gain_reduction_db: 0.0 });
    }
    
    let frames = samples[0].len();
    let mut state = CompressorState::new(params, sample_rate, channels);
    let mut frame_buf = vec![0.0; channels];

    for i in 0..frames {
        for ch in 0..channels {
            frame_buf[ch] = samples[ch][i];
        }
        let gain = state.process_frame_gain(&frame_buf);
        for ch in 0..channels {
            samples[ch][i] *= gain;
        }
    }

    Ok(CompressorStats { max_gain_reduction_db: state.max_gain_reduction_db })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compressor_silence() {
        let mut samples = vec![vec![0.0; 100]];
        let mut params = CompressorParams::default();
        params.enabled = true;
        let stats = process(&mut samples, 48000, &params).unwrap();
        assert!(stats.max_gain_reduction_db < 0.1);
        for &s in &samples[0] {
            assert!(s.abs() < 1e-6);
        }
    }
}

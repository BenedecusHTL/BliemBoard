use nnnoiseless::DenoiseState;
use serde::{Deserialize, Serialize};
use super::resample::resample_linear;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DenoiseParams {
    pub enabled: bool,
    pub strength: f32, // 0.0 to 1.0 (dry/wet mix)
}

impl Default for DenoiseParams {
    fn default() -> Self {
        Self {
            enabled: false,
            strength: 1.0,
        }
    }
}

pub fn process(samples: &mut Vec<Vec<f32>>, sample_rate: u32, params: &DenoiseParams) {
    if !params.enabled || params.strength <= 0.0 || samples.is_empty() {
        return;
    }

    let target_rate = 48000;
    
    for channel in samples.iter_mut() {
        if channel.is_empty() {
            continue;
        }

        // 1. Resample to 48kHz if needed
        let mut work_buf = if sample_rate != target_rate {
            resample_linear(channel, sample_rate, target_rate)
        } else {
            channel.clone()
        };

        // 2. Pad to multiple of 480
        const FRAME_SIZE: usize = 480; // DenoiseState::FRAME_SIZE is 480
        let original_work_len = work_buf.len();
        let remainder = original_work_len % FRAME_SIZE;
        if remainder != 0 {
            work_buf.resize(original_work_len + (FRAME_SIZE - remainder), 0.0);
        }

        let mut out_buf = Vec::with_capacity(work_buf.len());
        let mut denoise = DenoiseState::new();

        // 3. Process frames
        for chunk in work_buf.chunks(FRAME_SIZE) {
            let mut in_frame = [0.0; FRAME_SIZE];
            // Scale -1.0..1.0 to i16 range for nnnoiseless
            for (i, &s) in chunk.iter().enumerate() {
                in_frame[i] = s * 32768.0;
            }
            
            let mut out_frame = [0.0; FRAME_SIZE];
            let _vad = denoise.process_frame(&mut out_frame, &in_frame);

            // Scale back
            for s in out_frame.iter() {
                out_buf.push(*s / 32768.0);
            }
        }
        
        // RNNoise has algorithmic latency of exactly 1 frame? Actually, empirical latency is often not strictly documented,
        // but typically the state uses overlapping windows. Wait, we'll keep the length the same. 
        // Truncate padded samples:
        out_buf.truncate(original_work_len);

        // Resample back to original rate if needed
        let mut final_buf = if sample_rate != target_rate {
            resample_linear(&out_buf, target_rate, sample_rate)
        } else {
            out_buf
        };

        // Ensure length matches exactly (resampling rounding issues)
        final_buf.resize(channel.len(), 0.0);

        // Apply dry/wet mix
        for (i, s) in channel.iter_mut().enumerate() {
            *s = *s * (1.0 - params.strength) + final_buf[i] * params.strength;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_denoise_silence() {
        let mut samples = vec![vec![0.0; 960]];
        let params = DenoiseParams { enabled: true, strength: 1.0 };
        process(&mut samples, 48000, &params);
        for &s in &samples[0] {
            assert!(s.abs() < 1e-6);
        }
    }
}

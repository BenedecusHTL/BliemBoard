use biquad::{Biquad, Coefficients, DirectForm2Transposed, Type, ToHertz};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EqBand {
    pub freq: f32,
    pub gain_db: f32,
    pub q: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EqParams {
    pub enabled: bool,
    pub bands: [EqBand; 5],
}

impl Default for EqParams {
    fn default() -> Self {
        Self {
            enabled: false,
            bands: [
                EqBand { freq: 80.0, gain_db: 0.0, q: 0.707 },
                EqBand { freq: 250.0, gain_db: 0.0, q: 0.707 },
                EqBand { freq: 1000.0, gain_db: 0.0, q: 0.707 },
                EqBand { freq: 4000.0, gain_db: 0.0, q: 0.707 },
                EqBand { freq: 8000.0, gain_db: 0.0, q: 0.707 },
            ]
        }
    }
}

pub struct EqState {
    filters: Vec<DirectForm2Transposed<f32>>,
}

impl EqState {
    pub fn new(params: &EqParams, sample_rate: u32) -> Result<Self, String> {
        let fs = (sample_rate as f32).hz();
        let max_freq = sample_rate as f32 * 0.475;
        let mut filters = Vec::new();

        for (i, band) in params.bands.iter().enumerate() {
            if band.gain_db.abs() < 0.01 {
                continue;
            }

            let f0 = band.freq.clamp(20.0, max_freq).hz();
            let q = band.q.max(0.1);
            let filter_type = match i {
                0 => Type::LowShelf(band.gain_db),
                4 => Type::HighShelf(band.gain_db),
                _ => Type::PeakingEQ(band.gain_db),
            };

            let coeffs = Coefficients::<f32>::from_params(filter_type, fs, f0, q)
                .map_err(|e| format!("Invalid EQ params for band {}: {:?}", i, e))?;
            
            filters.push(DirectForm2Transposed::<f32>::new(coeffs));
        }

        Ok(Self { filters })
    }

    pub fn process_sample(&mut self, mut x: f32) -> f32 {
        for filter in self.filters.iter_mut() {
            x = filter.run(x);
        }
        x
    }
}

pub fn process(samples: &mut Vec<Vec<f32>>, sample_rate: u32, params: &EqParams) -> Result<(), String> {
    if !params.enabled || samples.is_empty() {
        return Ok(());
    }

    for channel in samples.iter_mut() {
        let mut state = EqState::new(params, sample_rate)?;
        for s in channel.iter_mut() {
            *s = state.process_sample(*s);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eq_silence() {
        let mut samples = vec![vec![0.0; 100]];
        let mut params = EqParams::default();
        params.enabled = true;
        params.bands[1].gain_db = 5.0; // Activate a band
        process(&mut samples, 48000, &params).unwrap();
        for &s in &samples[0] {
            assert!(s.abs() < 1e-6);
        }
    }
}

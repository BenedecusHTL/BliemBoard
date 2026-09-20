pub mod compressor;
pub mod denoise;
pub mod eq;
pub mod resample;

use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct EffectChain {
    pub denoise: denoise::DenoiseParams,
    pub eq: eq::EqParams,
    pub compressor: compressor::CompressorParams,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct EffectResult {
    pub preview_path: String,
    pub max_gr_db: f32,
}

// Process the chain in a fixed order: Denoise -> EQ -> Compressor.
// - Denoise runs first because it needs the cleanest, unprocessed signal to distinguish noise from voice.
// - EQ runs before compression so we can shape the tone (e.g. cut rumble) before it triggers the compressor.
// - Compressor runs last to glue it together and catch any peaks the EQ introduced.
pub fn process_chain(
    samples: &mut Vec<Vec<f32>>,
    sample_rate: u32,
    chain: &EffectChain,
) -> Result<compressor::CompressorStats, String> {
    denoise::process(samples, sample_rate, &chain.denoise);
    eq::process(samples, sample_rate, &chain.eq)?;
    let comp_stats = compressor::process(samples, sample_rate, &chain.compressor)?;
    Ok(comp_stats)
}

/// Simple WAV writer for f32 PCM
pub fn write_wav_f32<P: AsRef<Path>>(
    path: P,
    samples: &[Vec<f32>],
    sample_rate: u32,
) -> Result<(), String> {
    if samples.is_empty() {
        return Err("No samples to write".into());
    }

    let channels = samples.len() as u16;
    let frames = samples[0].len();
    
    let mut file = File::create(path).map_err(|e| e.to_string())?;

    let byte_rate = sample_rate * channels as u32 * 4;
    let block_align = channels * 4;
    let data_chunk_size = frames as u32 * block_align as u32;
    let file_size = 36 + data_chunk_size;

    // RIFF header
    file.write_all(b"RIFF").map_err(|e| e.to_string())?;
    file.write_all(&file_size.to_le_bytes()).map_err(|e| e.to_string())?;
    file.write_all(b"WAVE").map_err(|e| e.to_string())?;

    // fmt chunk
    file.write_all(b"fmt ").map_err(|e| e.to_string())?;
    file.write_all(&16u32.to_le_bytes()).map_err(|e| e.to_string())?; // Subchunk1Size (16 for PCM)
    file.write_all(&3u16.to_le_bytes()).map_err(|e| e.to_string())?; // AudioFormat (3 for IEEE Float)
    file.write_all(&channels.to_le_bytes()).map_err(|e| e.to_string())?;
    file.write_all(&sample_rate.to_le_bytes()).map_err(|e| e.to_string())?;
    file.write_all(&byte_rate.to_le_bytes()).map_err(|e| e.to_string())?;
    file.write_all(&block_align.to_le_bytes()).map_err(|e| e.to_string())?;
    file.write_all(&32u16.to_le_bytes()).map_err(|e| e.to_string())?; // BitsPerSample (32)

    // data chunk
    file.write_all(b"data").map_err(|e| e.to_string())?;
    file.write_all(&data_chunk_size.to_le_bytes()).map_err(|e| e.to_string())?;

    // Interleave and write samples
    for i in 0..frames {
        for ch in 0..channels as usize {
            let s = samples[ch][i];
            file.write_all(&s.to_le_bytes()).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

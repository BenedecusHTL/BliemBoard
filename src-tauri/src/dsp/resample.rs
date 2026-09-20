pub fn resample_linear(input: &[f32], in_rate: u32, out_rate: u32) -> Vec<f32> {
    if in_rate == out_rate {
        return input.to_vec();
    }
    if input.is_empty() {
        return vec![];
    }
    let ratio = in_rate as f64 / out_rate as f64;
    let out_len = ((input.len() as f64) / ratio).ceil() as usize;
    let mut out = Vec::with_capacity(out_len);
    
    for i in 0..out_len {
        let pos = i as f64 * ratio;
        let idx = pos.floor() as usize;
        let frac = (pos - idx as f64) as f32;
        
        if idx + 1 < input.len() {
            let val = input[idx] * (1.0 - frac) + input[idx + 1] * frac;
            out.push(val);
        } else {
            out.push(input[idx]);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resample_same() {
        let input = vec![1.0, 2.0, 3.0, 4.0];
        let out = resample_linear(&input, 48000, 48000);
        assert_eq!(input, out);
    }
}

use rodio::Source;

fn test_decode() {
    let file = std::fs::File::open("dummy.wav").unwrap();
    let decoder = rodio::Decoder::new(std::io::BufReader::new(file)).unwrap();
    let mut f32_source = decoder.convert_samples::<f32>();
    let samples: Vec<f32> = f32_source.collect();
}

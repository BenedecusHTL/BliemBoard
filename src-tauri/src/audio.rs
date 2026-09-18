use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use once_cell::sync::Lazy;
use ringbuf::traits::{Consumer, Producer, Split};
use ringbuf::HeapRb;
use rodio::source::Source;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::Arc;
use std::thread;

fn log_audio_err(msg: &str, err: impl std::fmt::Debug) {
    let log_msg = format!("{}: {:?}\n", msg, err);
    let mut path = std::env::temp_dir();
    path.push("bliemboard_audio_error.log");
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = f.write_all(log_msg.as_bytes());
    }
}

struct MicSource {
    consumer: ringbuf::HeapCons<f32>,
    sample_rate: u32,
    channels: u16,
}

impl Iterator for MicSource {
    type Item = f32;
    fn next(&mut self) -> Option<f32> {
        Some(self.consumer.try_pop().unwrap_or(0.0))
    }
}

impl Source for MicSource {
    fn current_frame_len(&self) -> Option<usize> {
        None
    }
    fn channels(&self) -> u16 {
        self.channels
    }
    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
    fn total_duration(&self) -> Option<std::time::Duration> {
        None
    }
}

pub enum AudioCommand {
    Play(String, PathBuf, f32),
    StopAll,
    SetVolume(f32),
    SetOutputDevice(Option<String>),
    SetInputDevice(Option<String>),
    SetTestMic(bool),
    SetLocalPlayback(bool),
    ToggleMute,
    PlayMuteReminder,
    MicDisconnected,
}

pub static IS_MUTED: Lazy<Arc<AtomicBool>> = Lazy::new(|| Arc::new(AtomicBool::new(false)));

pub static AUDIO_SENDER: Lazy<Sender<AudioCommand>> = Lazy::new(|| {
    let (tx, rx) = channel::<AudioCommand>();
    thread::spawn(move || {
        let mut master_volume = 0.7;
        let mut virtual_output_name: Option<String> = None;
        let mut mic_input_name: Option<String> = None;
        let mut test_mic = false;

        let is_muted = IS_MUTED.clone();

        let mut local_playback_enabled = true;

        let mut stream1: Option<OutputStream> = None;
        let mut handle1: Option<OutputStreamHandle> = None;
        let mut stream2: Option<OutputStream> = None;
        let mut handle2: Option<OutputStreamHandle> = None;

        struct SoundSinks {
            local: Option<Sink>,
            cable: Option<Sink>,
            base_vol: f32,
        }
        // Sinks for soundboard sounds
        let mut sinks: HashMap<String, SoundSinks> = HashMap::new();

        // Sinks for microphone passthrough
        let mut mic_local_sink: Option<Sink> = None;
        let mut mic_cable_sink: Option<Sink> = None;
        let mut mic_stream: Option<cpal::Stream> = None;

        // Initial setup for outputs
        {
            let host = cpal::default_host();
            let default_device = host.default_output_device();
            let virtual_device = host.output_devices().ok().and_then(|mut devs| {
                devs.find(|d| {
                    d.name()
                        .unwrap_or_default()
                        .to_lowercase()
                        .contains("cable")
                })
            });
            if let Some(dev) = virtual_device {
                virtual_output_name = Some(dev.name().unwrap_or_default());
            }
            let virtual_device = if let Some(ref name) = virtual_output_name {
                host.output_devices()
                    .ok()
                    .and_then(|mut devs| devs.find(|d| d.name().unwrap_or_default() == *name))
            } else {
                None
            };

            if let Some(dev) = default_device {
                match OutputStream::try_from_device(&dev) {
                    Ok((s, h)) => {
                        stream1 = Some(s);
                        handle1 = Some(h);
                    }
                    Err(e) => log_audio_err("Failed to init default output", e),
                }
            } else {
                log_audio_err("No default output device found", "");
            }

            if let Some(dev) = virtual_device {
                match OutputStream::try_from_device(&dev) {
                    Ok((s, h)) => {
                        stream2 = Some(s);
                        handle2 = Some(h);
                    }
                    Err(e) => log_audio_err("Failed to init virtual output", e),
                }
            }
        }

        for cmd in rx {
            match cmd {
                AudioCommand::Play(id, path, ind_vol) => {
                    let mut local_sink = None;
                    if let Some(h1) = &handle1 {
                        match Sink::try_new(h1) {
                            Ok(sink) => {
                                sink.set_volume(master_volume * ind_vol);
                                match File::open(&path) {
                                    Ok(file) => {
                                        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| Decoder::new(BufReader::new(file)))).unwrap_or_else(|_| Err(rodio::decoder::DecoderError::UnrecognizedFormat)) {
                                            Ok(decoder) => {
                                                sink.append(decoder);
                                                local_sink = Some(sink);
                                            }
                                            Err(e) => log_audio_err("Failed to decode local file", e),
                                        }
                                    }
                                    Err(e) => log_audio_err("Failed to open local file", e),
                                }
                            }
                            Err(e) => log_audio_err("Failed to create local sink", e),
                        }
                    } else {
                        log_audio_err("No local handle available for playback", "");
                    }

                    let mut cable_sink = None;
                    if let Some(h2) = &handle2 {
                        match Sink::try_new(h2) {
                            Ok(sink) => {
                                let currently_muted = is_muted.load(Ordering::Relaxed);
                                if currently_muted {
                                    sink.set_volume(0.0);
                                } else {
                                    sink.set_volume(master_volume * ind_vol);
                                }
                                match File::open(&path) {
                                    Ok(file) => {
                                        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| Decoder::new(BufReader::new(file)))).unwrap_or_else(|_| Err(rodio::decoder::DecoderError::UnrecognizedFormat)) {
                                            Ok(decoder) => {
                                                sink.append(decoder);
                                                cable_sink = Some(sink);
                                            }
                                            Err(e) => log_audio_err("Failed to decode cable file", e),
                                        }
                                    }
                                    Err(e) => log_audio_err("Failed to open cable file", e),
                                }
                            }
                            Err(e) => log_audio_err("Failed to create cable sink", e),
                        }
                    } else {
                        // Not an error if they don't have a virtual cable installed
                    }

                    sinks.retain(|_, ss| {
                        let l_active = ss.local.as_ref().map_or(false, |s| !s.empty());
                        let c_active = ss.cable.as_ref().map_or(false, |s| !s.empty());
                        l_active || c_active
                    });

                    sinks.insert(
                        id,
                        SoundSinks {
                            local: local_sink,
                            cable: cable_sink,
                            base_vol: ind_vol,
                        },
                    );
                }
                AudioCommand::StopAll => {
                    sinks.clear();
                }
                AudioCommand::SetVolume(vol) => {
                    master_volume = vol;
                    let currently_muted = is_muted.load(Ordering::Relaxed);
                    for ss in sinks.values() {
                        if let Some(l) = &ss.local {
                            l.set_volume(vol * ss.base_vol);
                        }
                        if let Some(c) = &ss.cable {
                            if currently_muted {
                                c.set_volume(0.0);
                            } else {
                                c.set_volume(vol * ss.base_vol);
                            }
                        }
                    }
                }
                AudioCommand::SetOutputDevice(name) => {
                    virtual_output_name = name;
                    let host = cpal::default_host();
                    let default_device = host.default_output_device();
                    let virtual_device = if let Some(ref v_name) = virtual_output_name {
                        host.output_devices().ok().and_then(|mut devs| {
                            devs.find(|d| d.name().unwrap_or_default() == *v_name)
                        })
                    } else {
                        None
                    };

                    stream1 = None;
                    handle1 = None;
                    stream2 = None;
                    handle2 = None;
                    sinks.clear();

                    if let Some(dev) = default_device {
                        if let Ok((s, h)) = OutputStream::try_from_device(&dev) {
                            stream1 = Some(s);
                            handle1 = Some(h);
                        }
                    }
                    if let Some(dev) = virtual_device {
                        if let Ok((s, h)) = OutputStream::try_from_device(&dev) {
                            stream2 = Some(s);
                            handle2 = Some(h);
                        }
                    }
                }
                AudioCommand::SetInputDevice(name) => {
                    mic_input_name = name;

                    mic_stream = None;
                    mic_local_sink = None;
                    mic_cable_sink = None;

                    if let Some(mic_name) = &mic_input_name {
                        let host = cpal::default_host();
                        if let Some(dev) = host.input_devices().ok().and_then(|mut devs| {
                            devs.find(|d| d.name().unwrap_or_default() == *mic_name)
                        }) {
                            if let Ok(config) = dev.default_input_config() {
                                let sample_rate = config.sample_rate().0;
                                let channels = config.channels();

                                let mut rb1 = HeapRb::<f32>::new(4096);
                                let (mut prod1, cons1) = rb1.split();

                                let mut prod2_opt = None;
                                if test_mic {
                                    let mut rb2 = HeapRb::<f32>::new(4096);
                                    let (prod2, cons2) = rb2.split();
                                    prod2_opt = Some(prod2);

                                    if let Some(h1) = &handle1 {
                                        if let Ok(sink) = Sink::try_new(h1) {
                                            sink.append(MicSource {
                                                consumer: cons2,
                                                sample_rate,
                                                channels,
                                            });
                                            if !local_playback_enabled && !test_mic {
                                                sink.set_volume(0.0);
                                            }
                                            mic_local_sink = Some(sink);
                                        }
                                    }
                                }

                                if let Some(h2) = &handle2 {
                                    if let Ok(sink) = Sink::try_new(h2) {
                                        sink.append(MicSource {
                                            consumer: cons1,
                                            sample_rate,
                                            channels,
                                        });
                                        mic_cable_sink = Some(sink);
                                    }
                                }

                                let err_fn = |err| {
                                    log_audio_err("Mic error", err);
                                    let _ = AUDIO_SENDER.send(AudioCommand::MicDisconnected);
                                };
                                let is_muted_f32 = is_muted.clone();
                                let is_muted_i16 = is_muted.clone();

                                let stream = match config.sample_format() {
                                    cpal::SampleFormat::F32 => dev.build_input_stream(
                                        &config.into(),
                                        move |data: &[f32], _| {
                                            let muted = is_muted_f32.load(Ordering::Relaxed);
                                            for &sample in data {
                                                let s = if muted { 0.0 } else { sample };
                                                let _ = prod1.try_push(s);
                                                if let Some(p2) = &mut prod2_opt {
                                                    let _ = p2.try_push(s);
                                                }
                                            }
                                        },
                                        err_fn,
                                        None,
                                    ),
                                    cpal::SampleFormat::I16 => dev.build_input_stream(
                                        &config.into(),
                                        move |data: &[i16], _| {
                                            let muted = is_muted_i16.load(Ordering::Relaxed);
                                            for &sample in data {
                                                let s = sample as f32 / std::i16::MAX as f32;
                                                let final_s = if muted { 0.0 } else { s };
                                                let _ = prod1.try_push(final_s);
                                                if let Some(p2) = &mut prod2_opt {
                                                    let _ = p2.try_push(final_s);
                                                }
                                            }
                                        },
                                        err_fn,
                                        None,
                                    ),
                                    _ => Err(cpal::BuildStreamError::StreamConfigNotSupported),
                                };

                                if let Ok(s) = stream {
                                    if s.play().is_ok() {
                                        mic_stream = Some(s);
                                    }
                                }
                            }
                        }
                    }
                }
                AudioCommand::SetTestMic(test) => {
                    test_mic = test;
                    // Trigger input re-init
                    let name = mic_input_name.clone();
                    // Actually, easiest way is to just push SetInputDevice to the channel, but we don't have tx here.
                    // Just reset it next time they select input.
                    
                    // If they already have a local sink, update its volume directly:
                    if let Some(sink) = &mic_local_sink {
                        if test {
                            sink.set_volume(1.0);
                        } else if !local_playback_enabled {
                            sink.set_volume(0.0);
                        }
                    }
                }
                AudioCommand::ToggleMute => {
                    let currently_muted = is_muted.load(Ordering::Relaxed);
                    let newly_muted = !currently_muted;
                    is_muted.store(newly_muted, Ordering::Relaxed);

                    for ss in sinks.values() {
                        if let Some(c) = &ss.cable {
                            if newly_muted {
                                c.set_volume(0.0);
                            } else {
                                c.set_volume(master_volume * ss.base_vol);
                            }
                        }
                    }

                    let freq1 = if newly_muted { 400.0 } else { 300.0 };
                    let freq2 = if newly_muted { 300.0 } else { 400.0 };

                    if let Some(h1) = &handle1 {
                        if let Ok(sink) = Sink::try_new(h1) {
                            let s1 = rodio::source::SineWave::new(freq1)
                                .take_duration(std::time::Duration::from_millis(150))
                                .amplify(0.2);
                            let s2 = rodio::source::SineWave::new(freq2)
                                .take_duration(std::time::Duration::from_millis(150))
                                .amplify(0.2);
                            sink.append(s1);
                            sink.append(s2);
                            sink.detach();
                        }
                    }
                }
                AudioCommand::PlayMuteReminder => {
                    if let Some(h1) = &handle1 {
                        if let Ok(sink) = Sink::try_new(h1) {
                            // Subtle quick double blip
                            let s1 = rodio::source::SineWave::new(440.0)
                                .take_duration(std::time::Duration::from_millis(150))
                                .amplify(0.4);
                            let s2 = rodio::source::SineWave::new(0.0)
                                .take_duration(std::time::Duration::from_millis(100))
                                .amplify(0.0);
                            let s3 = rodio::source::SineWave::new(440.0)
                                .take_duration(std::time::Duration::from_millis(150))
                                .amplify(0.4);
                            sink.append(s1);
                            sink.append(s2);
                            sink.append(s3);
                            sink.detach();
                        }
                    }
                }
                AudioCommand::MicDisconnected => {
                    if let Some(h1) = &handle1 {
                        if let Ok(sink) = Sink::try_new(h1) {
                            let s1 = rodio::source::SineWave::new(500.0)
                                .take_duration(std::time::Duration::from_millis(150))
                                .amplify(0.25);
                            let s2 = rodio::source::SineWave::new(400.0)
                                .take_duration(std::time::Duration::from_millis(150))
                                .amplify(0.25);
                            let s3 = rodio::source::SineWave::new(300.0)
                                .take_duration(std::time::Duration::from_millis(300))
                                .amplify(0.25);
                            sink.append(s1);
                            sink.append(s2);
                            sink.append(s3);
                            sink.detach();
                        }
                    }
                }
                AudioCommand::SetLocalPlayback(enabled) => {
                    local_playback_enabled = enabled;
                    if let Some(sink) = &mic_local_sink {
                        if enabled || test_mic {
                            sink.set_volume(1.0);
                        } else {
                            sink.set_volume(0.0);
                        }
                    }
                }
            }
        }
    });
    tx
});

pub fn get_input_devices() -> Vec<String> {
    let host = cpal::default_host();
    let mut names = Vec::new();
    if let Ok(devices) = host.input_devices() {
        for device in devices {
            if let Ok(name) = device.name() {
                names.push(name);
            }
        }
    }
    names
}

pub fn get_output_devices() -> Vec<String> {
    let host = cpal::default_host();
    let mut names = Vec::new();
    if let Ok(devices) = host.output_devices() {
        for device in devices {
            if let Ok(name) = device.name() {
                names.push(name);
            }
        }
    }
    names
}

pub fn play_sound(id: String, path: PathBuf, volume: f32) -> Result<(), String> {
    let _ = AUDIO_SENDER.send(AudioCommand::Play(id, path, volume));
    Ok(())
}

pub fn stop_all() {
    let _ = AUDIO_SENDER.send(AudioCommand::StopAll);
}

pub fn set_volume(volume: f32) {
    let _ = AUDIO_SENDER.send(AudioCommand::SetVolume(volume));
}

pub fn set_input_device(name: Option<String>) {
    let _ = AUDIO_SENDER.send(AudioCommand::SetInputDevice(name));
}

pub fn set_output_device(name: Option<String>) {
    let _ = AUDIO_SENDER.send(AudioCommand::SetOutputDevice(name));
}

pub fn set_test_mic(test: bool) {
    AUDIO_SENDER.send(AudioCommand::SetTestMic(test)).unwrap();
}

pub fn get_is_muted() -> bool {
    IS_MUTED.load(Ordering::Relaxed)
}

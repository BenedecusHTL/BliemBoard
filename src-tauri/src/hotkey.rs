use rdev::{Event, EventType, Key};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;

#[derive(Clone)]
pub struct SoundAction {
    pub id: String,
    pub path: String,
    pub volume: f32,
}

pub struct Hotkeys {
    pub sounds: HashMap<String, SoundAction>, // key_combo -> SoundAction
    pub mute: Option<String>,                 // key_combo
}

lazy_static::lazy_static! {
    pub static ref HOTKEYS: Arc<Mutex<Hotkeys>> = Arc::new(Mutex::new(Hotkeys {
        sounds: HashMap::new(),
        mute: None,
    }));
}

pub fn update_hotkeys(sounds: HashMap<String, SoundAction>, mute: Option<String>) {
    if let Ok(mut h) = HOTKEYS.lock() {
        let mut upper_sounds = HashMap::new();
        for (k, v) in sounds {
            upper_sounds.insert(k.to_uppercase(), v);
        }
        h.sounds = upper_sounds;
        h.mute = mute.map(|m| m.to_uppercase());
    }
}

pub fn init() {
    thread::spawn(|| {
        let mut ctrl = false;
        let mut alt = false;
        let mut shift = false;
        let mut meta = false;

        let callback = move |event: Event| {
            match event.event_type {
                EventType::KeyPress(key) => {
                    match key {
                        Key::ControlLeft | Key::ControlRight => ctrl = true,
                        Key::Alt | Key::AltGr => alt = true,
                        Key::ShiftLeft | Key::ShiftRight => shift = true,
                        Key::MetaLeft | Key::MetaRight => meta = true,
                        _ => {
                            let mut combo = Vec::new();
                            if ctrl || meta {
                                combo.push("CommandOrControl".to_string());
                            }
                            if alt {
                                combo.push("Alt".to_string());
                            }
                            if shift {
                                combo.push("Shift".to_string());
                            }
                            let mut k_str = String::new();
                            if let Some(ref n) = event.name {
                                let up = n.to_uppercase();
                                if up.len() == 1 && (up.chars().next().unwrap().is_alphanumeric() || up.chars().next().unwrap().is_ascii_punctuation()) {
                                    k_str = up;
                                }
                            }
                            if k_str.is_empty() {
                                k_str = key_to_string(key);
                            }
                            
                            if !k_str.is_empty() {
                                combo.push(k_str);
                            }

                            let combo_str = combo.join("+").to_uppercase();

                            // Check against hotkeys
                            if let Ok(h) = HOTKEYS.lock() {


                                if let Some(ref m) = h.mute {
                                    if m == &combo_str {
                                        let _ = crate::audio::AUDIO_SENDER.send(crate::audio::AudioCommand::ToggleMute);
                                    }
                                }
                                if let Some(action) = h.sounds.get(&combo_str) {
                                    let path = std::path::PathBuf::from(&action.path);
                                    let _ = crate::audio::AUDIO_SENDER.send(crate::audio::AudioCommand::Play(action.id.clone(), path, action.volume));
                                }
                            }
                        }
                    }
                }
                EventType::KeyRelease(key) => {
                    match key {
                        Key::ControlLeft | Key::ControlRight => ctrl = false,
                        Key::Alt | Key::AltGr => alt = false,
                        Key::ShiftLeft | Key::ShiftRight => shift = false,
                        Key::MetaLeft | Key::MetaRight => meta = false,
                        _ => {}
                    }
                }
                _ => {}
            }
        };

        if let Err(error) = rdev::listen(callback) {
            let log_msg = format!("Error listening to keys: {:?}\n", error);
            let _ = std::fs::write(std::env::temp_dir().join("bliemboard_hotkey_error.log"), log_msg);
        }
    });
}

fn key_to_string(key: Key) -> String {
    match key {
        Key::Space => "Space".to_string(),
        Key::Return | Key::KpReturn => "Enter".to_string(),
        Key::Escape => "Escape".to_string(),
        Key::Backspace => "Backspace".to_string(),
        Key::Delete | Key::KpDelete => "Delete".to_string(),
        Key::Num0 | Key::Kp0 => "0".to_string(),
        Key::Num1 | Key::Kp1 => "1".to_string(),
        Key::Num2 | Key::Kp2 => "2".to_string(),
        Key::Num3 | Key::Kp3 => "3".to_string(),
        Key::Num4 | Key::Kp4 => "4".to_string(),
        Key::Num5 | Key::Kp5 => "5".to_string(),
        Key::Num6 | Key::Kp6 => "6".to_string(),
        Key::Num7 | Key::Kp7 => "7".to_string(),
        Key::Num8 | Key::Kp8 => "8".to_string(),
        Key::Num9 | Key::Kp9 => "9".to_string(),
        Key::KeyA => "A".to_string(),
        Key::KeyB => "B".to_string(),
        Key::KeyC => "C".to_string(),
        Key::KeyD => "D".to_string(),
        Key::KeyE => "E".to_string(),
        Key::KeyF => "F".to_string(),
        Key::KeyG => "G".to_string(),
        Key::KeyH => "H".to_string(),
        Key::KeyI => "I".to_string(),
        Key::KeyJ => "J".to_string(),
        Key::KeyK => "K".to_string(),
        Key::KeyL => "L".to_string(),
        Key::KeyM => "M".to_string(),
        Key::KeyN => "N".to_string(),
        Key::KeyO => "O".to_string(),
        Key::KeyP => "P".to_string(),
        Key::KeyQ => "Q".to_string(),
        Key::KeyR => "R".to_string(),
        Key::KeyS => "S".to_string(),
        Key::KeyT => "T".to_string(),
        Key::KeyU => "U".to_string(),
        Key::KeyV => "V".to_string(),
        Key::KeyW => "W".to_string(),
        Key::KeyX => "X".to_string(),
        Key::KeyY => "Y".to_string(),
        Key::KeyZ => "Z".to_string(),
        Key::UpArrow => "Up".to_string(),
        Key::DownArrow => "Down".to_string(),
        Key::LeftArrow => "Left".to_string(),
        Key::RightArrow => "Right".to_string(),
        Key::F1 => "F1".to_string(),
        Key::F2 => "F2".to_string(),
        Key::F3 => "F3".to_string(),
        Key::F4 => "F4".to_string(),
        Key::F5 => "F5".to_string(),
        Key::F6 => "F6".to_string(),
        Key::F7 => "F7".to_string(),
        Key::F8 => "F8".to_string(),
        Key::F9 => "F9".to_string(),
        Key::F10 => "F10".to_string(),
        Key::F11 => "F11".to_string(),
        Key::F12 => "F12".to_string(),
        Key::PageUp => "PageUp".to_string(),
        Key::PageDown => "PageDown".to_string(),
        Key::Home => "Home".to_string(),
        Key::End => "End".to_string(),
        Key::Tab => "Tab".to_string(),
        Key::NumLock => "NumLock".to_string(),
        Key::Pause => "Pause".to_string(),
        Key::ScrollLock => "ScrollLock".to_string(),
        Key::PrintScreen => "PrintScreen".to_string(),
        Key::Insert => "Insert".to_string(),
        Key::Minus | Key::KpMinus => "-".to_string(),
        Key::Equal => "=".to_string(),
        Key::LeftBracket => "[".to_string(),
        Key::RightBracket => "]".to_string(),
        Key::SemiColon => ";".to_string(),
        Key::Quote => "'".to_string(),
        Key::BackSlash => "\\".to_string(),
        Key::Comma => ",".to_string(),
        Key::Dot => ".".to_string(),
        Key::Slash | Key::KpDivide => "/".to_string(),
        Key::BackQuote => "`".to_string(),
        Key::KpMultiply => "*".to_string(),
        Key::KpPlus => "+".to_string(),
        Key::Unknown(33) => "PageUp".to_string(),
        Key::Unknown(34) => "PageDown".to_string(),
        Key::Unknown(35) => "End".to_string(),
        Key::Unknown(36) => "Home".to_string(),
        Key::Unknown(37) => "Left".to_string(),
        Key::Unknown(38) => "Up".to_string(),
        Key::Unknown(39) => "Right".to_string(),
        Key::Unknown(40) => "Down".to_string(),
        // German layout mappings
        Key::Unknown(222) => "Ä".to_string(),
        Key::Unknown(192) => "Ö".to_string(),
        Key::Unknown(186) => "Ü".to_string(),
        Key::Unknown(219) => "ß".to_string(),
        Key::Unknown(187) => "+".to_string(),
        Key::Unknown(191) => "#".to_string(),
        Key::Unknown(226) => "<".to_string(),
        Key::Unknown(189) => "-".to_string(),
        Key::Unknown(code) => format!("Unknown({})", code),
        _ => "".to_string(),
    }
}

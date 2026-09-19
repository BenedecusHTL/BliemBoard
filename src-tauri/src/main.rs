// Prevents additional console window on Windows in release, do not remove!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod store;
mod hotkey;
mod app_audio;

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use store::{SoundInfo, Store};
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;

struct AppState {
    store: Mutex<Store>,
}

#[tauri::command]
fn get_sounds(state: State<'_, AppState>) -> Vec<SoundInfo> {
    let store = state.store.lock().unwrap();
    store.load_sounds()
}

#[tauri::command]
fn add_sound(
    id: String,
    name: String,
    audio_data: Vec<u8>,
    image_data: Option<String>,
    ext: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    let file_ext = ext.unwrap_or_else(|| "audio".to_string());
    let filename = store.add_sound_file(&id, &audio_data, &file_ext);

    let mut sounds = store.load_sounds();
    sounds.push(SoundInfo {
        id,
        name,
        filename,
        image_data,
        volume: 1.0,
        hotkey: None,
        category: None,
    });
    store.save_sounds(&sounds);
    Ok(())
}

#[tauri::command]
fn update_sound(
    id: String,
    name: Option<String>,
    image_data: Option<String>,
    volume: Option<f32>,
    hotkey: Option<String>,
    category: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    let mut sounds = store.load_sounds();

    if let Some(sound) = sounds.iter_mut().find(|s| s.id == id) {
        if let Some(n) = name {
            sound.name = n;
        }
        if image_data.is_some() {
            sound.image_data = image_data;
        }
        if let Some(v) = volume {
            sound.volume = v;
        }
        if let Some(h) = hotkey {
            if h.is_empty() {
                sound.hotkey = None;
            } else {
                sound.hotkey = Some(h);
            }
        }
        if let Some(c) = category {
            if c.trim().is_empty() {
                sound.category = None;
            } else {
                sound.category = Some(c.trim().to_string());
            }
        }
    }
    store.save_sounds(&sounds);
    Ok(())
}

#[tauri::command]
fn reorder_sounds(new_order: Vec<String>, state: State<'_, AppState>) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    let mut sounds = store.load_sounds();
    
    // Sort sounds based on their index in the new_order array
    sounds.sort_by_key(|s| {
        new_order.iter().position(|id| id == &s.id).unwrap_or(usize::MAX)
    });
    
    store.save_sounds(&sounds);
    Ok(())
}

#[tauri::command]
fn delete_sound(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    let mut sounds = store.load_sounds();

    if let Some(pos) = sounds.iter().position(|s| s.id == id) {
        let sound = sounds.remove(pos);
        store.delete_sound_file(&sound.filename);
    }
    store.save_sounds(&sounds);
    Ok(())
}

#[tauri::command]
fn play_sound(id: String, stop_on_reclick: bool, state: State<'_, AppState>) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    let sounds = store.load_sounds();
    if let Some(sound) = sounds.iter().find(|s| s.id == id) {
        let path = store.get_sound_path(&sound.filename);
        audio::play_sound(id, path, sound.volume, stop_on_reclick)?;
    }
    Ok(())
}

#[tauri::command]
fn stop_all() {
    audio::stop_all();
}

#[tauri::command]
fn get_sound_path(id: String, state: State<'_, AppState>) -> Option<String> {
    let store = state.store.lock().unwrap();
    let sounds = store.load_sounds();
    sounds.iter().find(|s| s.id == id).map(|sound| {
        store
            .get_sound_path(&sound.filename)
            .to_string_lossy()
            .into_owned()
    })
}

#[tauri::command]
fn read_sound_bytes(id: String, state: State<'_, AppState>) -> Option<Vec<u8>> {
    let store = state.store.lock().unwrap();
    let sounds = store.load_sounds();
    sounds.iter().find(|s| s.id == id).and_then(|sound| {
        let path = store.get_sound_path(&sound.filename);
        std::fs::read(&path).ok()
    })
}

#[tauri::command]
fn read_file_bytes(path: String) -> Option<Vec<u8>> {
    std::fs::read(&path).ok()
}

#[tauri::command]
fn trim_sound(id: String, wav_data: Vec<u8>, state: State<'_, AppState>) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    let mut sounds = store.load_sounds();
    if let Some(sound) = sounds.iter_mut().find(|s| s.id == id) {
        // Save new WAV bytes, replacing old file (always outputs .wav)
        let new_filename = store.update_sound_file(&sound.filename, &wav_data, "wav");
        sound.filename = new_filename;
    }
    store.save_sounds(&sounds);
    Ok(())
}

#[tauri::command]
fn open_url(url: String) {
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd").args(["/C", "start", "", &url]).spawn();
}

#[tauri::command]
async fn download_and_install_update(url: String, app: tauri::AppHandle) -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let installer_path = temp_dir.join("BliemBoard_Update.exe");
    
    // Download using curl (built into Windows 10+)
    let status = std::process::Command::new("curl")
        .args(["-L", "-o", installer_path.to_str().unwrap(), &url])
        .status()
        .map_err(|e| e.to_string())?;
        
    if !status.success() {
        return Err("Download failed".into());
    }
    
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    
    // Hidden powershell: waits 2 seconds, kills app, runs NSIS installer silently (/S), then restarts app
    let script = format!(
        "Start-Sleep -Seconds 2; Stop-Process -Name 'soundboard-tauri' -Force -ErrorAction SilentlyContinue; Start-Process '\"{}\"' -ArgumentList '/S' -Wait; Start-Process '\"{}\"'",
        installer_path.display(),
        exe_path.display()
    );
    
    std::process::Command::new("powershell")
        .args(["-WindowStyle", "Hidden", "-Command", &script])
        .spawn()
        .map_err(|e| e.to_string())?;
        
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn generate_ascii_art(text: String) -> String {
    use figlet_rs::FIGlet;
    let font_str = include_str!("dos_rebel.flf");
    if let Ok(font) = FIGlet::from_content(font_str) {
        if let Some(figure) = font.convert(&text) {
            return figure.to_string();
        }
    }
    text // fallback
}

#[tauri::command]
fn set_volume(volume: f32) {
    audio::set_volume(volume);
}

#[tauri::command]
fn set_output_device(name: Option<String>) {
    audio::set_output_device(name);
}

#[tauri::command]
fn get_output_devices() -> Vec<String> {
    audio::get_output_devices()
}

#[tauri::command]
fn get_input_devices() -> Vec<String> {
    audio::get_input_devices()
}

#[tauri::command]
fn set_input_device(name: Option<String>) {
    audio::set_input_device(name);
}

#[tauri::command]
fn set_test_mic(test: bool) {
    audio::set_test_mic(test);
}

#[tauri::command]
fn toggle_mute() {
    audio::AUDIO_SENDER
        .send(audio::AudioCommand::ToggleMute)
        .unwrap();
}

#[tauri::command]
fn set_local_playback(enabled: bool) {
    audio::AUDIO_SENDER
        .send(audio::AudioCommand::SetLocalPlayback(enabled))
        .unwrap();
}

#[tauri::command]
fn get_is_muted() -> bool {
    audio::get_is_muted()
}

#[tauri::command]
fn play_mute_reminder() {
    audio::AUDIO_SENDER
        .send(audio::AudioCommand::PlayMuteReminder)
        .unwrap();
}

#[tauri::command]
async fn export_board(path: String, state: State<'_, AppState>) -> Result<(), String> {
    use std::fs::File;
    use std::io::Write;
    use zip::write::FileOptions;
    
    let app_dir = {
        let store = state.store.lock().unwrap();
        store.get_app_dir()
    };
    
    let file = File::create(&path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::<'_, ()>::default().compression_method(zip::CompressionMethod::Deflated);
    
    // Add sounds.json
    let sounds_json = app_dir.join("sounds.json");
    if sounds_json.exists() {
        zip.start_file("sounds.json", options.clone()).map_err(|e| e.to_string())?;
        let data = std::fs::read(&sounds_json).map_err(|e| e.to_string())?;
        zip.write_all(&data).map_err(|e| e.to_string())?;
    }
    
    // Add all sound files
    if let Ok(entries) = std::fs::read_dir(&app_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let name = p.file_name().unwrap().to_str().unwrap();
                if name == "sounds.json" { continue; } // Already added above
                zip.start_file(name, options.clone()).map_err(|e| e.to_string())?;
                let data = std::fs::read(&p).map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(|e| e.to_string())?;
            }
        }
    }
    
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn import_board(path: String, state: State<'_, AppState>) -> Result<(), String> {
    use std::fs::File;
    
    let app_dir = {
        let store = state.store.lock().unwrap();
        store.get_app_dir()
    };
    
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => app_dir.join(path),
            None => continue,
        };
        
        let mut outfile = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[derive(serde::Deserialize, Clone)]
pub struct SoundAction {
    pub id: String,
    pub path: String,
    pub volume: f32,
}

#[tauri::command]
fn update_rust_hotkeys(
    sounds: std::collections::HashMap<String, SoundAction>, 
    mute: Option<String>,
    state: tauri::State<'_, AppState>
) {
    let store = state.store.lock().unwrap();
    let app_dir = store.get_app_dir();
    let mut resolved_sounds = std::collections::HashMap::new();
    for (hk, action) in sounds {
        resolved_sounds.insert(hk, hotkey::SoundAction {
            id: action.id,
            path: app_dir.join(action.path).to_string_lossy().to_string(),
            volume: action.volume
        });
    }
    hotkey::update_hotkeys(resolved_sounds, mute);
}

#[tauri::command]
fn get_audio_sessions() -> Vec<app_audio::AudioSessionInfo> {
    app_audio::get_audio_sessions()
}

#[tauri::command]
fn set_app_volume(pid: u32, volume: f32) {
    app_audio::set_app_volume(pid, volume);
}

#[tauri::command]
fn start_app_loopback(pid: u32, volume: f32, virtual_output: Option<String>, app: tauri::AppHandle) {
    app_audio::start_app_loopback(pid, volume, virtual_output, app);
}

#[tauri::command]
fn stop_app_loopback(pid: u32) {
    app_audio::stop_app_loopback(pid);
}


fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            hotkey::init();
            let store = Store::new(app.handle());
            app.manage(AppState {
                store: Mutex::new(store),
            });

            // Set up tray menu
            let show_i = MenuItem::with_id(app, "show", "Show BliemBoard", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let autostart_manager = app.autolaunch();
            let is_autostart = autostart_manager.is_enabled().unwrap_or(false);

            let autostart_i = CheckMenuItem::with_id(
                app,
                "autostart",
                "Start on Boot",
                true,
                is_autostart,
                None::<&str>,
            )?;

            let menu = Menu::with_items(app, &[&show_i, &autostart_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    "autostart" => {
                        let manager = app.autolaunch();
                        if let Ok(enabled) = manager.is_enabled() {
                            if enabled {
                                let _ = manager.disable();
                            } else {
                                let _ = manager.enable();
                            }
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                })
                .icon(app.default_window_icon().unwrap().clone())
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_sounds,
            add_sound,
            update_sound,
            delete_sound,
            reorder_sounds,
            play_sound,
            stop_all,
            get_sound_path,
            read_sound_bytes,
            read_file_bytes,
            trim_sound,
            open_url,
            download_and_install_update,
            set_volume,
            set_output_device,
            get_output_devices,
            get_input_devices,
            set_input_device,
            set_test_mic,
            toggle_mute,
            set_local_playback,
            get_is_muted,
            play_mute_reminder,
            export_board,
            import_board,
            update_rust_hotkeys,
            generate_ascii_art,
            get_audio_sessions,
            set_app_volume,
            start_app_loopback,
            stop_app_loopback
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn default_volume() -> f32 {
    1.0
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SoundInfo {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub image_data: Option<String>,
    #[serde(default = "default_volume")]
    pub volume: f32,
    pub hotkey: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
}

pub struct Store {
    app_dir: PathBuf,
}

impl Store {
    pub fn new(app_handle: &AppHandle) -> Self {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .expect("Failed to get app data dir");

        if !app_dir.exists() {
            fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
        }

        Self { app_dir }
    }

    fn db_path(&self) -> PathBuf {
        self.app_dir.join("sounds.json")
    }

    pub fn load_sounds(&self) -> Vec<SoundInfo> {
        let path = self.db_path();
        if path.exists() {
            if let Ok(data) = fs::read_to_string(path) {
                if let Ok(sounds) = serde_json::from_str(&data) {
                    return sounds;
                }
            }
        }
        Vec::new()
    }

    pub fn save_sounds(&self, sounds: &Vec<SoundInfo>) {
        let path = self.db_path();
        if let Ok(data) = serde_json::to_string(sounds) {
            let _ = fs::write(path, data);
        }
    }

    pub fn add_sound_file(&self, id: &str, data: &[u8], ext: &str) -> String {
        let filename = format!("{}.{}", id, ext);
        let path = self.app_dir.join(&filename);
        let _ = fs::write(path, data);
        filename
    }

    pub fn update_sound_file(&self, filename: &str, data: &[u8], new_ext: &str) -> String {
        // Delete old file
        let old_path = self.app_dir.join(filename);
        let _ = fs::remove_file(&old_path);
        // Derive id from old filename (strip extension)
        let id = std::path::Path::new(filename)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy();
        let new_filename = format!("{}.{}", id, new_ext);
        let new_path = self.app_dir.join(&new_filename);
        let _ = fs::write(new_path, data);
        new_filename
    }

    pub fn get_sound_path(&self, filename: &str) -> PathBuf {
        self.app_dir.join(filename)
    }

    pub fn delete_sound_file(&self, filename: &str) {
        let path = self.app_dir.join(filename);
        let _ = fs::remove_file(path);
    }
    
    pub fn get_app_dir(&self) -> PathBuf {
        self.app_dir.clone()
    }
}

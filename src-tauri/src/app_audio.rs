// app_audio.rs - Per-process WASAPI audio loopback -> VB-Cable routing

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct AudioSessionInfo {
    pub pid: u32,
    pub name: String,
    pub icon_base64: Option<String>,
    pub volume: f32,
}

struct LoopbackEntry {
    stop_tx: std::sync::mpsc::Sender<()>,
    volume: Arc<Mutex<f32>>,
}

static LOOPBACK_STATE: Lazy<Mutex<HashMap<u32, LoopbackEntry>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// ─── Non-Windows stubs ────────────────────────────────────────────────────────
#[cfg(not(target_os = "windows"))]
pub fn get_audio_sessions() -> Vec<AudioSessionInfo> { vec![] }
#[cfg(not(target_os = "windows"))]
pub fn set_app_volume(_pid: u32, _volume: f32) {}
#[cfg(not(target_os = "windows"))]
pub fn start_app_loopback(_pid: u32, _volume: f32, _output: Option<String>) {}
#[cfg(not(target_os = "windows"))]
pub fn stop_app_loopback(_pid: u32) {}

// ─── Windows section ──────────────────────────────────────────────────────────
#[cfg(target_os = "windows")]
use windows::{
    Win32::{
        Foundation::{CloseHandle, HANDLE, WAIT_TIMEOUT},
        Media::Audio::*,
        System::{
            Com::{CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED},
            Threading::{CreateEventW, SetEvent, WaitForSingleObject},
        },
    },
};
#[cfg(target_os = "windows")]
use windows_core::{HRESULT, Interface, PROPVARIANT};


// COM completion handler — must be at module level for #[implement] macro
#[cfg(target_os = "windows")]
mod completion {
    use super::*;
    use windows::Win32::{Foundation::*, Media::Audio::*};
    // windows_core must be in scope for the #[implement] proc-macro
    use windows_core as windows_core;
    use windows_core::Interface;

    #[windows::core::implement(IActivateAudioInterfaceCompletionHandler)]
    pub struct CompletionHandler {
        pub event: HANDLE,
        pub result: Arc<Mutex<Option<windows::core::Result<IAudioClient>>>>,
    }

    impl IActivateAudioInterfaceCompletionHandler_Impl for CompletionHandler_Impl {
        fn ActivateCompleted(
            &self,
            activate_operation: Option<&IActivateAudioInterfaceAsyncOperation>,
        ) -> windows::core::Result<()> {
            if let Some(op) = activate_operation {
                let mut hr = windows_core::HRESULT(0);
                let mut unknown: Option<windows_core::IUnknown> = None;
                unsafe { let _ = op.GetActivateResult(&mut hr, &mut unknown); }
                let res = if hr.is_ok() {
                    unknown
                        .ok_or_else(|| windows::core::Error::from(E_NOINTERFACE))
                        .and_then(|u| u.cast::<IAudioClient>())
                } else {
                    Err(windows::core::Error::from(hr))
                };
                *self.result.lock().unwrap() = Some(res);
                unsafe { let _ = SetEvent(self.event); }
            }
            Ok(())
        }
    }
}

#[cfg(target_os = "windows")]
pub fn get_audio_sessions() -> Vec<AudioSessionInfo> {
    use windows::Win32::{Media::Audio::*, System::Com::*};
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator = match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) { Ok(e) => e, Err(_) => return vec![] };
        let device = match enumerator.GetDefaultAudioEndpoint(eRender, eConsole) { Ok(d) => d, Err(_) => return vec![] };
        let session_manager: IAudioSessionManager2 = match device.Activate(CLSCTX_ALL, None) { Ok(m) => m, Err(_) => return vec![] };
        let session_enum = match session_manager.GetSessionEnumerator() { Ok(e) => e, Err(_) => return vec![] };
        let count = session_enum.GetCount().unwrap_or(0);
        let mut seen = std::collections::HashSet::new();
        let mut results = vec![];
        let own_pid = std::process::id();
        for i in 0..count {
            let session: IAudioSessionControl = match session_enum.GetSession(i) { Ok(s) => s, Err(_) => continue };
            let session2: IAudioSessionControl2 = match session.cast() { Ok(s) => s, Err(_) => continue };
            let pid = match session2.GetProcessId() { Ok(p) => p, Err(_) => continue };
            if pid == 0 || pid == own_pid || seen.contains(&pid) { continue; }
            seen.insert(pid);
            let exe_path = match get_process_exe_path(pid) { Some(p) => p, None => continue };
            let name = std::path::Path::new(&exe_path).file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string();
            let icon_base64 = get_process_icon_b64(&exe_path);
            let vol_control: ISimpleAudioVolume = match session.cast() { Ok(v) => v, Err(_) => { results.push(AudioSessionInfo { pid, name, icon_base64, volume: 1.0 }); continue; } };
            let volume = vol_control.GetMasterVolume().unwrap_or(1.0);
            results.push(AudioSessionInfo { pid, name, icon_base64, volume });
        }
        results
    }
}

#[cfg(target_os = "windows")]
pub fn set_app_volume(pid: u32, volume: f32) {
    use windows::Win32::{Media::Audio::*, System::Com::*};
    if let Ok(state) = LOOPBACK_STATE.lock() {
        if let Some(entry) = state.get(&pid) { *entry.volume.lock().unwrap() = volume; }
    }
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator = match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) { Ok(e) => e, Err(_) => return };
        let device = match enumerator.GetDefaultAudioEndpoint(eRender, eConsole) { Ok(d) => d, Err(_) => return };
        let session_manager: IAudioSessionManager2 = match device.Activate(CLSCTX_ALL, None) { Ok(m) => m, Err(_) => return };
        let session_enum = match session_manager.GetSessionEnumerator() { Ok(e) => e, Err(_) => return };
        let count = session_enum.GetCount().unwrap_or(0);
        for i in 0..count {
            let session: IAudioSessionControl = match session_enum.GetSession(i) { Ok(s) => s, Err(_) => continue };
            let session2: IAudioSessionControl2 = match session.cast() { Ok(s) => s, Err(_) => continue };
            if session2.GetProcessId().unwrap_or(0) != pid { continue; }
            let vol_ctrl: ISimpleAudioVolume = match session.cast() { Ok(v) => v, Err(_) => continue };
            let _ = vol_ctrl.SetMasterVolume(volume.clamp(0.0, 1.0), std::ptr::null());
        }
    }
}

#[cfg(target_os = "windows")]
fn log_debug(msg: &str) {
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open("loopback_debug.txt") {
        use std::io::Write;
        let _ = writeln!(f, "[DEBUG] {}", msg);
    }
}

#[cfg(target_os = "windows")]
pub fn start_app_loopback(pid: u32, volume: f32, virtual_output_name: Option<String>) {
    stop_app_loopback(pid);
    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    let vol_arc = Arc::new(Mutex::new(volume));
    let vol_clone = vol_arc.clone();
    log_debug(&format!("Starting loopback for PID {}", pid));
    { let mut state = LOOPBACK_STATE.lock().unwrap(); state.insert(pid, LoopbackEntry { stop_tx, volume: vol_arc }); }
    std::thread::spawn(move || {
        log_debug("Inside thread...");
        unsafe { run_loopback_thread(pid, vol_clone, virtual_output_name, stop_rx); }
        log_debug("Thread exited!");
    });
}

#[cfg(target_os = "windows")]
pub fn stop_app_loopback(pid: u32) {
    if let Ok(mut state) = LOOPBACK_STATE.lock() {
        if let Some(entry) = state.remove(&pid) { let _ = entry.stop_tx.send(()); }
    }
}

#[cfg(target_os = "windows")]
fn get_process_exe_path(pid: u32) -> Option<String> {
    use windows::Win32::{Foundation::*, System::{ProcessStatus::*, Threading::*}};
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, false, pid).ok()?;
        let mut buf = vec![0u16; 1024];
        let len = GetModuleFileNameExW(handle, None, &mut buf);
        let _ = CloseHandle(handle);
        if len == 0 { return None; }
        Some(String::from_utf16_lossy(&buf[..len as usize]))
    }
}

#[cfg(target_os = "windows")]
fn get_process_icon_b64(exe_path: &str) -> Option<String> {
    use windows::Win32::{
        Storage::FileSystem::FILE_ATTRIBUTE_NORMAL,
        UI::{Shell::*, WindowsAndMessaging::*},
    };
    unsafe {
        let wide: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut sfi: SHFILEINFOW = std::mem::zeroed();
        let res = SHGetFileInfoW(
            windows_core::PCWSTR(wide.as_ptr()),
            FILE_ATTRIBUTE_NORMAL,
            Some(&mut sfi),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_SMALLICON | SHGFI_USEFILEATTRIBUTES,
        );
        if res == 0 || sfi.hIcon.is_invalid() { return None; }
        let png_b64 = hicon_to_png_b64(sfi.hIcon);
        let _ = DestroyIcon(sfi.hIcon);
        png_b64
    }
}

#[cfg(target_os = "windows")]
fn hicon_to_png_b64(hicon: windows::Win32::UI::WindowsAndMessaging::HICON) -> Option<String> {
    use windows::Win32::{Graphics::Gdi::*, UI::WindowsAndMessaging::*};
    unsafe {
        let mut icon_info: ICONINFO = std::mem::zeroed();
        GetIconInfo(hicon, &mut icon_info).ok()?;
        let mut bmp: BITMAP = std::mem::zeroed();
        let got = GetObjectW(icon_info.hbmColor, std::mem::size_of::<BITMAP>() as i32, Some(&mut bmp as *mut BITMAP as *mut _));
        if got == 0 { let _ = DeleteObject(icon_info.hbmColor); let _ = DeleteObject(icon_info.hbmMask); return None; }
        let width = bmp.bmWidth.unsigned_abs();
        let height = bmp.bmHeight.unsigned_abs();
        if width == 0 || height == 0 { let _ = DeleteObject(icon_info.hbmColor); let _ = DeleteObject(icon_info.hbmMask); return None; }
        let dc = CreateCompatibleDC(HDC::default());
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32, biHeight: -(height as i32),
                biPlanes: 1, biBitCount: 32, biCompression: BI_RGB.0,
                biSizeImage: 0, biXPelsPerMeter: 0, biYPelsPerMeter: 0, biClrUsed: 0, biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };
        let total = (width * height * 4) as usize;
        let mut pixels = vec![0u8; total];
        let lines = GetDIBits(dc, icon_info.hbmColor, 0, height, Some(pixels.as_mut_ptr() as *mut _), &mut bmi, DIB_RGB_COLORS);
        let _ = DeleteDC(dc); let _ = DeleteObject(icon_info.hbmColor); let _ = DeleteObject(icon_info.hbmMask);
        if lines == 0 { return None; }
        for chunk in pixels.chunks_exact_mut(4) { chunk.swap(0, 2); }
        let img = image::RgbaImage::from_raw(width, height, pixels)?;
        let mut buf: Vec<u8> = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png).ok()?;
        Some(B64.encode(&buf))
    }
}

#[cfg(target_os = "windows")]
use cpal::traits::{DeviceTrait, HostTrait};
use rodio::{OutputStream, Sink};
use windows::Win32::{Foundation::*, Media::Audio::*, System::{Com::*, Threading::*}};

#[cfg(target_os = "windows")]
unsafe fn run_loopback_thread(
    pid: u32,
    volume: Arc<Mutex<f32>>,
    virtual_output_name: Option<String>,
    stop_rx: std::sync::mpsc::Receiver<()>,
) {
    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

    let activation_params = AUDIOCLIENT_ACTIVATION_PARAMS {
        ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
        Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
            ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                TargetProcessId: pid,
                ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
            },
        },
    };

    #[repr(C)]
    struct BlobPV { vt: u16, r1: u16, r2: u16, r3: u16, size: u32, data: *const u8 }
    let blob = BlobPV {
        vt: 0x41, r1: 0, r2: 0, r3: 0,
        size: std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
        data: &activation_params as *const _ as *const u8,
    };
    let prop_var: &PROPVARIANT = &*((&blob as *const BlobPV) as *const PROPVARIANT);

    let done_event = match CreateEventW(None, false, false, None) { Ok(e) => e, Err(_) => return };
    let result_slot: Arc<Mutex<Option<windows_core::Result<IAudioClient>>>> = Arc::new(Mutex::new(None));

    let handler: IActivateAudioInterfaceCompletionHandler = completion::CompletionHandler {
        event: done_event,
        result: result_slot.clone(),
    }.into();

    let guid_str = windows_core::w!("{2eef81be-33fa-4800-9670-1cd474972c3f}");

    if ActivateAudioInterfaceAsync(guid_str, &IAudioClient::IID, Some(prop_var), &handler).is_err() {
        let _ = CloseHandle(done_event); return;
    }
    WaitForSingleObject(done_event, 5000);
    let _ = CloseHandle(done_event);
    drop(handler);

    let audio_client = match result_slot.lock().unwrap().take() { Some(Ok(c)) => c, _ => return };

    let mix_fmt = match audio_client.GetMixFormat() { Ok(p) => p, Err(_) => return };
    let sample_rate = (*mix_fmt).nSamplesPerSec;
    let channels = (*mix_fmt).nChannels;
    let bits = (*mix_fmt).wBitsPerSample;

    if audio_client.Initialize(AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK, 200_000, 0, mix_fmt, None).is_err() {
        CoTaskMemFree(Some(mix_fmt as _)); return;
    }
    CoTaskMemFree(Some(mix_fmt as _));

    let capture_client: IAudioCaptureClient = match audio_client.GetService() { Ok(c) => c, Err(_) => return };
    let ready_event = match CreateEventW(None, false, false, None) { Ok(e) => e, Err(_) => return };
    if audio_client.SetEventHandle(ready_event).is_err() { let _ = CloseHandle(ready_event); return; }
    if audio_client.Start().is_err() { let _ = CloseHandle(ready_event); return; }

    let cpal_host = cpal::default_host();
    let cable_device = if let Some(ref name) = virtual_output_name {
        cpal_host.output_devices().ok().and_then(|mut d| d.find(|dev| dev.name().unwrap_or_default() == *name))
    } else {
        cpal_host.output_devices().ok().and_then(|mut d| d.find(|dev| dev.name().unwrap_or_default().to_lowercase().contains("cable")))
    };

    let cable_device = match cable_device { Some(d) => d, None => { let _ = audio_client.Stop(); let _ = CloseHandle(ready_event); return; } };
    let (cable_stream, cable_handle) = match OutputStream::try_from_device(&cable_device) { Ok(r) => r, Err(_) => { let _ = audio_client.Stop(); let _ = CloseHandle(ready_event); return; } };
    let (queue_tx, queue_rx) = rodio::queue::queue::<f32>(true);
    let sink = match Sink::try_new(&cable_handle) { Ok(s) => s, Err(_) => { let _ = audio_client.Stop(); let _ = CloseHandle(ready_event); return; } };
    sink.append(queue_rx);
    sink.detach();
    let _stream_guard = cable_stream;

    loop {
        if stop_rx.try_recv().is_ok() { break; }
        let w = WaitForSingleObject(ready_event, 50);
        if w == WAIT_TIMEOUT { continue; }
        loop {
            let mut p_data: *mut u8 = std::ptr::null_mut();
            let mut num_frames: u32 = 0;
            let mut flags: u32 = 0;
            if capture_client.GetBuffer(&mut p_data, &mut num_frames, &mut flags, None, None).is_err() || num_frames == 0 { break; }
            let vol = *volume.lock().unwrap();
            let total = num_frames as usize * channels as usize;
            let samples: Vec<f32> = if (flags & 2) != 0 {
                vec![0f32; total]
            } else if bits == 32 {
                std::slice::from_raw_parts(p_data as *const f32, total).iter().map(|&s| s * vol).collect()
            } else if bits == 16 {
                std::slice::from_raw_parts(p_data as *const i16, total).iter().map(|&s| s as f32 / 32768.0 * vol).collect()
            } else { vec![0f32; total] };
            let _ = capture_client.ReleaseBuffer(num_frames);
            queue_tx.append(rodio::buffer::SamplesBuffer::new(channels, sample_rate, samples));
        }
    }
    let _ = audio_client.Stop();
    let _ = CloseHandle(ready_event);
}

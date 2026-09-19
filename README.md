# 🎛️ BliemBoard

BliemBoard is a lightning-fast, modern soundboard and audio router built with **Rust & Tauri**. It offers zero-latency playback, global hotkeys, and smart audio routing—perfect for Discord, TeamSpeak, or in-game voice chat!

## ✨ Features

- **Blazing Fast Rust Backend:** Rewritten with `rodio` and `cpal` for ultra-low latency, multi-channel audio processing directly at the system level.
- **App Audio Loopback (NEW):** Seamlessly capture the audio from any running game or application (like Spotify, YouTube, or your favorite game) and pipe it directly into your virtual cable for your friends to hear.
- **Real-Time Audio Visualizers (NEW):** Dynamic audio visualizers embedded behind your sound cards and running apps, reacting instantly to volume peaks.
- **Drag & Drop:** Easily add your sounds (`.mp3` and `.wav` supported).
- **Integrated Audio Editor ✂️:** Visually trim and cut your sounds on a waveform directly inside the app.
- **Organization:** Create custom categories (tabs), use real-time search, and arrange your sounds freely on the grid via drag & drop.
- **Global Hotkeys:** Trigger sounds or toggle mute with keyboard shortcuts, even when BliemBoard is minimized or playing in the background.
- **Full Customization:** Add custom images to your sounds, customize the app theme color, set volume levels per sound, and change the app header.
- **Smart Audio Routing & Mute Local:** Route your microphone and sounds into a virtual cable, while muting the sounds on your own headphones to avoid double-audio during screen sharing.
- **Auto-Updater:** Automatically checks for and installs new updates via GitHub.

---

## 🚀 Setup & Audio Routing (Tutorial)

To allow your friends in voice chat to hear your soundboard (and captured games) in perfect quality while you can still speak normally, BliemBoard uses a Virtual Audio Cable. It captures your real microphone, mixes in the sounds and game audio, and outputs everything together.

### Step 1: Install a Virtual Audio Cable
1. Download the free **[VB-Cable](https://vb-audio.com/Cable/)**.
2. Extract the ZIP file and run the setup as Administrator.
3. Restart your PC if prompted.

### Step 2: BliemBoard Settings
Open BliemBoard and click the ⚙️ **Settings** gear icon in the top right:
- **Pass-through Microphone (Input):** Select your *real* microphone here (e.g., your headset mic).
- **Virtual Cable (Output to Discord):** Select **`CABLE Input (VB-Audio Virtual Cable)`** here.

> 💡 *What happens here? BliemBoard now takes your microphone, your sound clips, and any "Additional Audio" games you add, and pipes them into this invisible cable.*

### Step 3: Discord / Voice-Chat Settings
Go to your audio settings in Discord (or your game):
- **Input Device (Microphone):** Select **`CABLE Output (VB-Audio Virtual Cable)`**.

> ⚠️ **Important for Discord Users:** Discord often filters out music and soundboard noises as "background noise". Go to Discord's "Voice & Video" settings and disable **Echo Cancellation** and **Noise Suppression (Krisp)** so your sounds aren't cut off.

---

## 🎮 Usage & Tips

- **Sorting:** Stay in the "All" tab and drag sounds with your mouse to your desired position. BliemBoard saves the layout automatically.
- **Additional Audio:** Click "Add Additional Audio", select a running game/app, and BliemBoard will capture its audio and send it to your friends. The background visualizer will bounce to show it's working!
- **Categories:** Click ✏️ (Edit) on a sound and type a new category (e.g., "Memes"). The tab will be created automatically.
- **Editing:** Click ✂️ (Scissors) on a sound. Highlight the exact section of the waveform you want to keep, test it with Play, and save.

---

## 🛠️ Developer Setup
```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

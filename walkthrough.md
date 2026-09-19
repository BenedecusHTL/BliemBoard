# BliemBoard v1.0.34
A clean installation of v1.0.34 with everything completely fixed up.

### Fixes
- **Stop Sound completely bug**: The visualizer and timer bar now properly stop along with the sound when `Stop on Reclick` is activated! The logic between the JavaScript UI and the Rust backend is perfectly synchronized again.
- **OGG Files**: Fixed the file picker so it explicitly accepts `.ogg` files and you can upload them again!
- **Volume Default**: Volume now correctly saves its value and stays synced across both UI sliders without randomly resetting to 70%!
- **UI Corruption (?? and ? Icons)**: I checked out a perfectly clean version of `index.html` from before the file corruption and carefully re-injected only the new Settings and Tabs features. This cleanly wiped out the two `??` texts and fixed the broken emojis!
- **Stop All Icon**: The red square `■` is back next to the Stop All button!
- **Settings Modal**: Modals are no longer permanently rendered inline at the bottom of the page.
- **Version Updates**: The app version is now correctly reporting as `v1.0.34` everywhere in the UI and installer!

The build is currently running and finishing up in the background. Once the build task finishes in a minute, you'll be able to install `BliemBoard_1.0.34_x64-setup.exe` from the `src-tauri/target/release/bundle/nsis/` directory and everything will work flawlessly!

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { register, unregisterAll, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { save, open } from '@tauri-apps/plugin-dialog';

/* ─── CUSTOMIZATIONS ─────────────────────────────────────────── */
window.setThemeColor = function(hex) {
    if (!hex) return;
    const root = document.documentElement;
    root.style.setProperty('--accent-1', hex);
    root.style.setProperty('--accent-2', `color-mix(in srgb, ${hex}, black 15%)`);
    root.style.setProperty('--accent-3', `color-mix(in srgb, ${hex}, black 30%)`);
    root.style.setProperty('--accent-4', `color-mix(in srgb, ${hex}, black 45%)`);
    root.style.setProperty('--accent-5', `color-mix(in srgb, ${hex}, black 60%)`);
    root.style.setProperty('--border-hover', hex);
    root.style.setProperty('--title-cyan', hex);
    localStorage.setItem('themeColor', hex);
    drawAsciiCanvas(hex);
    window.updateVizColors(hex);
};

window.setHeaderText = function(text) {
    localStorage.setItem('headerText', text);
    updateHeaderDisplay();
};

window.uploadLogo = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        localStorage.setItem('headerLogo', e.target.result);
        updateHeaderDisplay();
    };
    reader.readAsDataURL(file);
};

window.clearLogo = function() {
    localStorage.removeItem('headerLogo');
    document.getElementById('logoUpload').value = '';
    updateHeaderDisplay();
};

window.toggleHideVisualizer = function(hide) {
    localStorage.setItem('hideVisualizer', hide ? '1' : '0');
    document.querySelector('.visualizer-wrap').style.display = hide ? 'none' : 'block';
};

window.toggleStopOnReclick = function(stop) {
    localStorage.setItem('stopOnReclick', stop ? '1' : '0');
};

window.toggleHideMeta = function(hide) {
    localStorage.setItem('hideMeta', hide ? '1' : '0');
    document.querySelector('.header-meta').style.display = hide ? 'none' : 'flex';
};

/* ─── ASCII TITLE CANVAS ───────────────────────────────────── */
function drawAsciiCanvas(color, customLines = null) {
  const lines = customLines || [
    "██████╗ ██╗     ██║███████╗███╗   ███╗██████╗  ██████╗  █████╗ ██████╗ ██████╗ ",
    "██╔══██╗██║     ██║██╔════╝████╗ ████║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗",
    "██████╔╝██║     ██║█████╗  ██╔████╔██║██████╔╝██║   ██║███████║██████╔╝██║  ██║",
    "██╔══██╗██║     ██║██╔══╝  ██║╚██╔╝██║██╔══██╗██║   ██║██╔══██║██╔══██╗██║  ██║",
    "██████╔╝███████╗██║███████╗██║ ╚═╝ ██║██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝",
    "╚═════╝ ╚══════╝╚═╝╚══════╝╚═╝     ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝"
  ];
  const FONT_PX = 14;
  const FONT = `${FONT_PX}px "Courier New", Courier, monospace`;
  const PAD_X = 24, PAD_Y = 20;
  const canvas = document.getElementById('ascii-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.font = FONT;
  const cw = ctx.measureText("█").width;
  const ch = FONT_PX * 1.22;
  const maxLen = Math.max(...lines.map(l => l.length));
  const W = Math.ceil(maxLen * cw) + PAD_X * 2;
  const H = Math.ceil(lines.length * ch) + PAD_Y * 2;
  canvas.width = W; canvas.height = H;
  canvas.style.aspectRatio = `${W} / ${H}`;
  ctx.clearRect(0, 0, W, H);
  ctx.font = FONT; ctx.fillStyle = color || "#5cf0f0"; ctx.textBaseline = "top";
  lines.forEach((line, i) => { ctx.fillText(line, PAD_X, PAD_Y + i * ch); });
}

async function updateHeaderDisplay() {
    const text = localStorage.getItem('headerText') || '';
    const logo = localStorage.getItem('headerLogo');
    
    const canvas = document.getElementById('ascii-canvas');
    const img = document.getElementById('custom-logo');
    const h1 = document.getElementById('custom-text');
    
    if (canvas) canvas.style.display = 'none';
    if (img) img.style.display = 'none';
    if (h1) h1.style.display = 'none';
    
    if (logo) {
        if (img) {
            img.src = logo;
            img.style.display = 'block';
        }
    } else if (text) {
        if (canvas) {
            try {
                const asciiText = await invoke('generate_ascii_art', { text });
                const lines = asciiText.split('\n');
                const theme = localStorage.getItem('themeColor') || '#00e5ff';
                drawAsciiCanvas(theme, lines);
                canvas.style.display = 'block';
            } catch (e) {
                console.error("Failed to generate ascii art:", e);
                if (h1) {
                    h1.textContent = text;
                    h1.style.display = 'block';
                }
            }
        }
    } else {
        if (canvas) {
            const theme = localStorage.getItem('themeColor') || '#00e5ff';
            drawAsciiCanvas(theme);
            canvas.style.display = 'block';
        }
    }
}

function restoreCustomizations() {
    const color = localStorage.getItem('themeColor') || '#5cf0f0';
    document.getElementById('themeColor').value = color;
    window.setThemeColor(color);

    const text = localStorage.getItem('headerText') || '';
    document.getElementById('headerText').value = text;

    const hideViz = localStorage.getItem('hideVisualizer') === '1';
    document.getElementById('hideVisualizerCheckbox').checked = hideViz;
    window.toggleHideVisualizer(hideViz);

    const hideMeta = localStorage.getItem('hideMeta') === '1';
    document.getElementById('hideMetaCheckbox').checked = hideMeta;
    window.toggleHideMeta(hideMeta);

    const stopOnReclick = localStorage.getItem('stopOnReclick') === '1';
    if(document.getElementById('stopOnReclickCheckbox')) document.getElementById('stopOnReclickCheckbox').checked = stopOnReclick;

    const masterVolume = localStorage.getItem('masterVolume');
    if (masterVolume !== null) {
      const volSlider1 = document.getElementById('masterVolume');
      const volSlider2 = document.getElementById('masterVol');
      if (volSlider1) volSlider1.value = masterVolume;
      if (volSlider2) volSlider2.value = masterVolume;
      window.setMasterVolume(masterVolume);
    }

    updateHeaderDisplay();
}

window.addEventListener('DOMContentLoaded', () => {
    restoreCustomizations();
});

/* ═══════════════════════════════════════════════════════════════
   REAL AUDIO VISUALIZER
   • Sounds  → read bytes via Rust → Web Audio API (muted, analysis only)
   • Mic     → getUserMedia → same AnalyserNode
   Both paths feed one shared AnalyserNode. rodio still plays the real audio.
═══════════════════════════════════════════════════════════════ */
let audioCtx  = null;
let analyser  = null;
let muteGain  = null;
let micSource = null;
let micStream = null;
const activeSources = new Map(); // soundId → AudioBufferSourceNode

function ensureAudioCtx() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.80;
  muteGain = audioCtx.createGain();
  muteGain.gain.value = 0;           // completely silent — rodio plays the real sound
  analyser.connect(muteGain);
  muteGain.connect(audioCtx.destination);
}

async function playSound(soundId) {
  try {
    const stopOnReclick = document.getElementById('stopOnReclickCheckbox')?.checked || false;
    const btn = document.querySelector(`.sound-button[data-sound-id="${soundId}"]`);
    const isPlaying = btn ? btn.classList.contains('playing') : false;
    
    await invoke('play_sound', { id: soundId, stopOnReclick });

    if (stopOnReclick && isPlaying) {
      // The Rust backend stopped the sound. We just need to stop the visualizer.
      stopSoundAnalysis(soundId);
      return;
    }
    
    // Note: The '.playing' class and duration logic is now handled precisely 
    // inside startSoundAnalysis once we decode the audio to find its true length!
    startSoundAnalysis(soundId);
  } catch (error) {
    showToast('Error playing sound: ' + error);
    console.error('Play error:', error);
  }
}

async function startSoundAnalysis(soundId) {
  try {
    ensureAudioCtx();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    stopSoundAnalysis(soundId); // cancel previous instance

    const bytes = await invoke('read_sound_bytes', { id: soundId });
    if (!bytes) return;

    const arrayBuf = new Uint8Array(bytes).buffer;
    const decoded  = await audioCtx.decodeAudioData(arrayBuf);

    const source = audioCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(analyser);
    source.start(0);

    const btn = document.querySelector(`[data-sound-id="${soundId}"]`);
    if (btn) {
      // Force a reflow by removing and re-adding playing to reset the CSS transition
      btn.classList.remove('playing');
      void btn.offsetWidth;
      btn.style.setProperty('--duration', decoded.duration + 's');
      btn.classList.add('playing');
    }

    source.onended = () => {
      activeSources.delete(soundId);
      if (btn) btn.classList.remove('playing');
    };
    activeSources.set(soundId, source);
  } catch (e) {
    console.warn('Visualizer analysis error:', e);
  }
}

function stopSoundAnalysis(soundId) {
  const src = activeSources.get(soundId);
  if (src) {
    try { src.stop(); } catch (_) {}
    activeSources.delete(soundId);
  }
  const btn = document.querySelector(`.sound-button[data-sound-id="${soundId}"]`);
  if (btn) btn.classList.remove('playing');
}

let hasShownMicOverlay = localStorage.getItem('micPermissionGranted') === 'true';

window.closeMicOverlay = function() {
  document.getElementById('micOverlay').classList.remove('show');
}

async function connectMicToAnalyser(deviceLabel) {
  // Disabled by user request: Visualizer should only react to soundboard sounds, not the microphone.
  return;
}

/* ─── VISUALIZER DRAW LOOP ─────────────────────────────────── */
let vizCanvas = null;
let vizCtx    = null;
const smoothBars = new Float32Array(48).fill(0);

let GOLD_HIGH = [210, 175,  80];
let GOLD_LOW  = [120,  95,  35];

window.updateVizColors = function(hex) {
    if (!hex) return;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        GOLD_HIGH = [r, g, b];
        GOLD_LOW = [Math.floor(r * 0.5), Math.floor(g * 0.5), Math.floor(b * 0.5)];
    }
};

function initVisualizer() {
  vizCanvas = document.getElementById('viz-canvas');
  if (!vizCanvas) return;
  vizCtx = vizCanvas.getContext('2d');

  function resize() {
    vizCanvas.width  = vizCanvas.offsetWidth  * devicePixelRatio;
    vizCanvas.height = vizCanvas.offsetHeight * devicePixelRatio;
  }
  resize();
  window.addEventListener('resize', resize);
  drawViz();   // start loop immediately
}

function drawViz() {
  requestAnimationFrame(drawViz);
  if (!vizCtx || !vizCanvas) return;

  const W = vizCanvas.width, H = vizCanvas.height;
  vizCtx.clearRect(0, 0, W, H);

  if (!analyser) {
    // idle flat line in muted gold
    vizCtx.strokeStyle = `rgba(${GOLD_LOW[0]},${GOLD_LOW[1]},${GOLD_LOW[2]},0.3)`;
    vizCtx.lineWidth = 1;
    vizCtx.beginPath();
    vizCtx.moveTo(0, H / 2);
    vizCtx.lineTo(W, H / 2);
    vizCtx.stroke();
    return;
  }

  const bufLen  = analyser.frequencyBinCount;   // 128
  const dataArr = new Uint8Array(bufLen);
  analyser.getByteFrequencyData(dataArr);

  const BAR_COUNT = 48;
  const gap  = 2 * devicePixelRatio;
  const barW = (W - gap * (BAR_COUNT + 1)) / BAR_COUNT;

  for (let i = 0; i < BAR_COUNT; i++) {
    // Logarithmic bin mapping for realistic spectrum shape
    const t_i   = i / BAR_COUNT;
    const binIdx = Math.min(Math.floor(Math.pow(bufLen, t_i)), bufLen - 1);
    const raw   = dataArr[binIdx] / 255;

    // Fast attack, slow decay
    smoothBars[i] = raw > smoothBars[i]
      ? smoothBars[i] * 0.35 + raw * 0.65
      : smoothBars[i] * 0.88 + raw * 0.12;

    const t    = smoothBars[i];
    const barH = Math.max(1.5 * devicePixelRatio, t * H * 0.88);
    const x    = gap + i * (barW + gap);
    const y    = (H - barH) / 2;

    // Interpolate between low-gold and high-gold
    const r     = Math.round(GOLD_LOW[0] + t * (GOLD_HIGH[0] - GOLD_LOW[0]));
    const g     = Math.round(GOLD_LOW[1] + t * (GOLD_HIGH[1] - GOLD_LOW[1]));
    const b2    = Math.round(GOLD_LOW[2] + t * (GOLD_HIGH[2] - GOLD_LOW[2]));
    const alpha = 0.30 + t * 0.70;

    vizCtx.fillStyle = `rgba(${r},${g},${b2},${alpha})`;
    vizCtx.beginPath();
    if (vizCtx.roundRect) {
      vizCtx.roundRect(x, y, barW, barH, Math.min(2, barW / 2));
    } else {
      vizCtx.rect(x, y, barW, barH);
    }
    vizCtx.fill();
  }
}

/* ═══════════════════════════════════════════════════════════════
   DRAG & DROP — uses Tauri's native file-drop event API
   (browser dragover/drop events don't fire for OS file drops in Tauri)
═══════════════════════════════════════════════════════════════ */
const ACCEPTED_EXT = new Set(['mp3','wav','ogg','flac','aac','m4a','mp4','weba','opus']);

function isAudioPath(path) {
  const ext = path.split('.').pop().toLowerCase();
  return ACCEPTED_EXT.has(ext);
}

async function addPathAsSound(filePath) {
  if (!isAudioPath(filePath)) {
    showToast(`Skipped — not a supported audio format`);
    return;
  }
  try {
    const bytes = await invoke('read_file_bytes', { path: filePath });
    if (!bytes) throw new Error('Could not read file');
    
    ensureAudioCtx();
    const arrayBuffer = new Uint8Array(bytes).buffer;
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBytes = window.audioBufferToWav(decoded);
    
    const id   = Date.now().toString() + Math.random().toString(36).slice(2);
    const name = filePath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, '');
    const ext  = 'wav';
    const audioData = Array.from(new Uint8Array(wavBytes));
    
    await invoke('add_sound', { id, name, audioData, imageData: null, ext });
    await render();
    showToast(`"${name}" added!`);
  } catch (error) {
    showToast('Error adding sound: ' + error);
    console.error(error);
  }
}

// Also keep browser-level drag-drop as fallback for any browser file objects
async function addFileAsSound(file) {
  if (!isAudioPath(file.name)) {
    showToast(`Skipped "${file.name}" — not a supported audio format`);
    return;
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    ensureAudioCtx();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBytes = window.audioBufferToWav(decoded);
    
    const id   = Date.now().toString() + Math.random().toString(36).slice(2);
    const name = file.name.replace(/\.[^/.]+$/, '');
    const ext  = 'wav';
    const audioData = Array.from(new Uint8Array(wavBytes));
    
    await invoke('add_sound', { id, name, audioData, imageData: null, ext });
    await render();
    showToast(`"${name}" added!`);
  } catch (error) {
    showToast('Error adding sound: ' + error);
  }
}

async function initDragDrop() {
  const overlay = document.getElementById('drop-overlay');

  // ── Tauri native file-drop (from Windows Explorer) ──────────
  try {
    const webview = getCurrentWebview();
    await webview.onDragDropEvent(async (event) => {
      const type = event.payload.type;
      if (type === 'over') {
        overlay.classList.add('show');
      } else if (type === 'drop') {
        overlay.classList.remove('show');
        const paths = event.payload.paths ?? [];
        for (const p of paths) await addPathAsSound(p);
      } else {
        overlay.classList.remove('show');
      }
    });
  } catch (e) {
    console.warn('Tauri drag-drop init failed, falling back to browser events:', e);
  }

  // ── Browser drag-drop fallback (e.g. from another browser tab) ──
  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    overlay.classList.add('show');
  });
  document.body.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      overlay.classList.remove('show');
    }
  });
  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    overlay.classList.remove('show');
    for (const file of Array.from(e.dataTransfer.files)) {
      await addFileAsSound(file);
    }
  });
}

/* ─── APP LOGIC ────────────────────────────────────────────── */
let editingId = null;

async function stopAll() {
  try {
    await invoke('stop_all');
    document.querySelectorAll('.sound-button.playing').forEach(btn => btn.classList.remove('playing'));
    for (const id of [...activeSources.keys()]) stopSoundAnalysis(id);
  } catch (error) {
    showToast('Error stopping sounds: ' + error);
  }
}

async function setMasterVolume(value) {
  try {
    const volume = parseFloat(value) / 100;
    await invoke('set_volume', { volume });
    const volVal = document.getElementById('volumeValue');
    if (volVal) volVal.textContent = value + '%';
    
    const slider1 = document.getElementById('masterVolume');
    const slider2 = document.getElementById('masterVol');
    if (slider1 && slider1.value !== value) slider1.value = value;
    if (slider2 && slider2.value !== value) slider2.value = value;

    localStorage.setItem('masterVolume', value);
  } catch (error) {
    console.error('Volume error:', error);
  }
}

async function addSound() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*,video/mp4,.ogg,.mp3,.wav';
  input.multiple = true;
  input.onchange = async (e) => {
    for (const file of Array.from(e.target.files || [])) await addFileAsSound(file);
  };
  input.click();
}

async function addImage(soundId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const imageData = ev.target?.result;
        if (imageData) {
          await invoke('update_sound', { id: soundId, name: null, imageData });
          await render();
          showToast('Image added!');
        }
      };
      reader.readAsDataURL(file);
    } catch (e) { showToast('Error: ' + e); }
  };
  input.click();
}

function openEdit(soundId, name, volume, hotkey, category) {
  editingId = soundId;
  const inp = document.getElementById('editInput');
  inp.value = name;
  
  const catInp = document.getElementById('editCategory');
  catInp.value = category || '';

  const volInp = document.getElementById('editVolume');
  const volVal = Math.round(volume * 100);
  volInp.value = volVal;
  document.getElementById('editVolVal').innerText = volVal + '%';
  
  const hkInp = document.getElementById('editHotkey');
  hkInp.value = hotkey || '';
  
  document.getElementById('editOverlay').classList.add('show');
  setTimeout(() => inp.focus(), 0);
}

function closeEdit() {
  document.getElementById('editOverlay').classList.remove('show');
  editingId = null;
}

async function saveEdit() {
  const newName = document.getElementById('editInput').value;
  const newCategory = document.getElementById('editCategory').value;
  const volVal = parseInt(document.getElementById('editVolume').value, 10);
  const volume = isNaN(volVal) ? 1.0 : volVal / 100.0;
  const hotkey = document.getElementById('editHotkey').value.trim();

  if (editingId && newName.trim()) {
    try {
      await invoke('update_sound', { 
        id: editingId, 
        name: newName.trim(), 
        imageData: null, 
        volume: volume,
        hotkey: hotkey || "",
        category: newCategory.trim() || ""
      });
      await render();
      showToast('Sound updated!');
    } catch (e) { showToast('Error: ' + e); }
  }
  closeEdit();
}



function showToast(message) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

let currentCategory = 'All';
let searchQuery = '';

// Add event listener for search bar
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      render();
    });
  }

  // Custom Category Autocomplete
  const catInput = document.getElementById('editCategory');
  const catList = document.getElementById('categoryCustomList');
  if (catInput && catList) {
    function showCatList() {
      const val = catInput.value.toLowerCase();
      catList.innerHTML = '';
      let hasItems = false;
      if (window.existingCategories) {
        window.existingCategories.forEach(c => {
          if (c.toLowerCase().includes(val) || val === '') {
            hasItems = true;
            const d = document.createElement('div');
            d.textContent = c;
            d.style.padding = '8px 12px';
            d.style.cursor = 'pointer';
            d.style.color = 'var(--text-1)';
            d.style.fontSize = '12px';
            d.style.borderBottom = '1px solid var(--border)';
            d.onmouseover = () => d.style.background = 'var(--hover)';
            d.onmouseout = () => d.style.background = 'transparent';
            d.onclick = () => {
              catInput.value = c;
              catList.style.display = 'none';
            };
            catList.appendChild(d);
          }
        });
      }
      catList.style.display = hasItems ? 'block' : 'none';
    }
    catInput.addEventListener('focus', showCatList);
    catInput.addEventListener('input', showCatList);
    document.addEventListener('click', (e) => {
      if (e.target !== catInput && e.target !== catList && !catList.contains(e.target)) {
        catList.style.display = 'none';
      }
    });
  }
});

// --- CUSTOM RIGHT-CLICK DRAG & DROP ---
let draggedSoundId = null;
let rightDragActive = false;
let rightDragElement = null;
let rightDragClone = null;
let isRightDragRendering = false;

document.addEventListener('mousemove', (e) => {
  if (rightDragActive && rightDragClone) {
    if (!isRightDragRendering) {
      isRightDragRendering = true;
      requestAnimationFrame(() => {
        rightDragClone.style.transform = `translate(${e.clientX - rightDragClone.offsetWidth/2}px, ${e.clientY - rightDragClone.offsetHeight/2}px)`;
        
        document.querySelectorAll('.sound-button').forEach(b => b.classList.remove('drag-over'));
        
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (target) {
          const targetBtn = target.closest('.sound-button');
          if (targetBtn && targetBtn !== rightDragElement) {
            targetBtn.classList.add('drag-over');
          }
        }
        isRightDragRendering = false;
      });
    }
  }
});

document.addEventListener('mouseup', async (e) => {
  if (e.button === 2 && rightDragActive) {
    rightDragActive = false;
    if (rightDragClone) {
      rightDragClone.remove();
      rightDragClone = null;
    }
    if (rightDragElement) rightDragElement.style.opacity = '1';
    
    document.querySelectorAll('.sound-button').forEach(b => b.classList.remove('drag-over'));
    
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (target) {
      const targetBtn = target.closest('.sound-button');
      if (targetBtn && targetBtn !== rightDragElement) {
        const targetId = targetBtn.getAttribute('data-sound-id');
        if (draggedSoundId && targetId && draggedSoundId !== targetId) {
          try {
            const sounds = await invoke('get_sounds');
            const originalIds = sounds.map(s => s.id);
            const fromIdx = originalIds.indexOf(draggedSoundId);
            const toIdx = originalIds.indexOf(targetId);
            if (fromIdx !== -1 && toIdx !== -1) {
              originalIds.splice(fromIdx, 1);
              originalIds.splice(toIdx, 0, draggedSoundId);
              await invoke('reorder_sounds', { newOrder: originalIds });
              render();
            }
          } catch(err) { console.error(err); }
        }
      }
    }
    
    draggedSoundId = null;
    rightDragElement = null;
  }
});

async function render() {
  try {
    const sounds = await invoke('get_sounds');
    const sb = document.getElementById('soundboard');
    const tabsContainer = document.getElementById('categoryTabs');
    sb.innerHTML = '';
    
    if (tabsContainer) {
      tabsContainer.innerHTML = '';
      const categories = new Set();
      sounds.forEach(s => {
        if (s.category && s.category.trim() !== '') {
          categories.add(s.category.trim());
        }
      });
      
      const catsArray = Array.from(categories).sort();
      catsArray.unshift('All');

      // Save categories globally for our custom dropdown
      window.existingCategories = catsArray.slice(1);

      catsArray.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${currentCategory === cat ? 'active' : ''}`;
        btn.textContent = cat;
        btn.onclick = () => {
          currentCategory = cat;
          render();
        };
        tabsContainer.appendChild(btn);
      });
    }

    let filteredSounds = sounds;
    if (searchQuery) {
      filteredSounds = sounds.filter(s => s.name.toLowerCase().includes(searchQuery));
    } else if (currentCategory !== 'All') {
      filteredSounds = sounds.filter(s => s.category === currentCategory);
    }

    filteredSounds.forEach(sound => {
      const btn = document.createElement('button');
      btn.className = 'sound-button';
      btn.title = sound.name;
      btn.type = 'button';
      btn.setAttribute('data-sound-id', sound.id);
      
      // -- DRAG AND DROP (Custom Right-Click) --
      if (!searchQuery) {
        btn.oncontextmenu = (e) => e.preventDefault();
        btn.onmousedown = (e) => {
          if (e.button === 2) { // Right click
            e.preventDefault();
            rightDragActive = true;
            draggedSoundId = sound.id;
            rightDragElement = btn;
            
            rightDragClone = btn.cloneNode(true);
            rightDragClone.style.position = 'fixed';
            rightDragClone.style.pointerEvents = 'none';
            rightDragClone.style.opacity = '0.8';
            rightDragClone.style.zIndex = '9999';
            rightDragClone.style.width = btn.offsetWidth + 'px';
            rightDragClone.style.height = btn.offsetHeight + 'px';
            rightDragClone.style.left = '0px';
            rightDragClone.style.top = '0px';
            rightDragClone.style.transform = `translate(${e.clientX - btn.offsetWidth/2}px, ${e.clientY - btn.offsetHeight/2}px)`;
            document.body.appendChild(rightDragClone);
            
            btn.style.opacity = '0.3';
          }
        };
      }

      btn.onclick = () => playSound(sound.id);

      let html = '';
      if (sound.imageData || sound.image_data)
        html += `<img src="${sound.imageData || sound.image_data}" alt="" class="sound-image">`;
      html += `<span class="sound-label">${sound.name}</span>`;
      html += `<span class="playing-tag">▶ playing</span>`;
      const soundVol = (sound.volume !== undefined && sound.volume !== null) ? sound.volume : 1.0;
      const soundHotkey = sound.hotkey ? sound.hotkey.replace(/'/g,"\\'") : '';
      const soundCat = sound.category ? sound.category.replace(/'/g,"\\'").replace(/"/g,"&quot;") : '';
      html += `<div class="button-menu">`;
      html += `<button class="icon-btn" type="button" title="Settings" onclick="openEdit('${sound.id}','${sound.name.replace(/'/g,"\\'").replace(/"/g,"&quot;")}', ${soundVol}, '${soundHotkey}', '${soundCat}');event.stopPropagation();">✏</button>`;
      html += `<button class="icon-btn" type="button" title="Trim / Edit Audio" onclick="window.openAudioEditor('${sound.id}','${sound.name.replace(/'/g,"\\'")}');event.stopPropagation();"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg></button>`;
      html += `</div>`;
      btn.innerHTML = html;
      sb.appendChild(btn);
    });

    const addBtn = document.createElement('label');
    addBtn.className = 'sound-button add-button';
    addBtn.title = 'Add new sound';
    addBtn.innerHTML = `<span style="font-size:26px;opacity:0.5;">+</span>`;
    addBtn.onclick = addSound;
    sb.appendChild(addBtn);

    registerHotkeys(sounds);
  } catch (e) { console.error('Render error:', e); }
}

async function registerHotkeys(sounds) {
  try {
    const map = {};
    for (const sound of sounds) {
      if (sound.hotkey) {
        map[sound.hotkey] = {
          id: sound.id,
          path: sound.filename,
          volume: sound.volume || 1.0
        };
      }
    }
    const muteKey = localStorage.getItem('muteHotkey');
    await invoke('update_rust_hotkeys', { sounds: map, mute: muteKey || null });
  } catch (e) {
    console.error('Error with hotkeys:', e);
    showToast('Hotkey sync error: ' + e);
  }
}

document.getElementById('editInput').addEventListener('keypress', e => { if (e.key === 'Enter') saveEdit(); });
document.getElementById('editOverlay').addEventListener('click', e => { if (e.target === document.getElementById('editOverlay')) closeEdit(); });

const hkInput = document.getElementById('editHotkey');
hkInput.addEventListener('keydown', e => {
  e.preventDefault();
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Escape') {
    e.target.value = '';
    return;
  }
  let keys = [];
  if (e.ctrlKey || e.metaKey) keys.push('CommandOrControl');
  if (e.altKey) keys.push('Alt');
  if (e.shiftKey) keys.push('Shift');
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    e.target.value = keys.join('+');
    return;
  }
  let key = e.key.toUpperCase();
  if (key === ' ') key = 'Space';
  else if (key.length === 1 && key.match(/[A-Z0-9]/)) key = key;
  else if (key.startsWith('ARROW')) key = key.replace('ARROW', '');
  keys.push(key);
  e.target.value = keys.join('+');
});

const muteHkInput = document.getElementById('muteHotkey');
if (muteHkInput) {
  muteHkInput.addEventListener('keydown', e => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Escape') {
      e.target.value = '';
      localStorage.removeItem('muteHotkey');
      return;
    }
    let keys = [];
    if (e.ctrlKey || e.metaKey) keys.push('CommandOrControl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      e.target.value = keys.join('+');
      return;
    }
    let key = e.key.toUpperCase();
    if (key === ' ') key = 'Space';
    else if (key.length === 1 && key.match(/[A-Z0-9]/)) key = key;
    else if (key.startsWith('ARROW')) key = key.replace('ARROW', '');
    keys.push(key);
    const combo = keys.join('+');
    e.target.value = combo;
    localStorage.setItem('muteHotkey', combo);
  });
}

let confirmAction = null;
function showConfirm(message, action) {
  document.getElementById('confirmMessage').innerText = message;
  confirmAction = action;
  document.getElementById('confirmOverlay').classList.add('show');
}
window.closeConfirm = function() {
  document.getElementById('confirmOverlay').classList.remove('show');
  confirmAction = null;
}
document.getElementById('confirmYesBtn').onclick = () => {
  if (confirmAction) confirmAction();
  window.closeConfirm();
}

async function deleteSound(soundId) {
  showConfirm('Delete this sound?', async () => {
    try {
      await invoke('delete_sound', { id: soundId });
      await render();
      showToast('Sound deleted');
    } catch (e) { showToast('Error: ' + e); }
  });
}

window.addImage      = addImage;
window.openEdit      = openEdit;
window.closeEdit     = closeEdit;

window.openSettings = function() {
  document.getElementById('settingsOverlay').classList.add('show');
  const muteHk = localStorage.getItem('muteHotkey');
  if (muteHk) document.getElementById('muteHotkey').value = muteHk;
};
window.closeSettings = async function() {
  document.getElementById('settingsOverlay').classList.remove('show');
  // Re-register hotkeys just in case mute hotkey changed
  try {
    const sounds = await invoke('get_sounds');
    await registerHotkeys(sounds);
  } catch(e) {}
};
document.getElementById('settingsOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('settingsOverlay')) window.closeSettings();
});

window.saveEdit      = saveEdit;
window.deleteSound   = deleteSound;
window.addSound      = addSound;
window.stopAll       = stopAll;
window.setMasterVolume = setMasterVolume;

window.triggerAddImage = function() {
  if (editingId) addImage(editingId);
};

window.triggerDeleteSound = function() {
  if (editingId) {
    deleteSound(editingId);
    closeEdit();
  }
};

window.setMic = async function(name) {
  try {
    await invoke('set_input_device', { name: name || null });
    await connectMicToAnalyser(name || null);
    if (name) {
      localStorage.setItem('selectedMic', name);
    } else {
      localStorage.removeItem('selectedMic');
    }
  } catch (e) { console.error('Error setting mic:', e); }
};

let muteReminderInterval = null;

function startMuteReminder() {
  if (muteReminderInterval) clearInterval(muteReminderInterval);
  muteReminderInterval = null;
  const mins = parseFloat(localStorage.getItem('muteReminderMins')) || 0;
  if (mins > 0) {
    muteReminderInterval = setInterval(() => {
      invoke('play_mute_reminder').catch(e => console.error(e));
    }, mins * 60 * 1000);
  }
}

window.setMuteReminder = function(mins) {
  localStorage.setItem('muteReminderMins', mins);
  const badge = document.getElementById('mutedBadge');
  if (badge.style.display !== 'none') {
    startMuteReminder();
  }
};

window.exportBoard = async function() {
  try {
    const filePath = await save({
      filters: [{ name: 'BliemBoard', extensions: ['bliem'] }],
      defaultPath: 'MySounds.bliem',
    });
    if (filePath) {
      showToast('Exporting board... (Might take a few seconds)');
      await invoke('export_board', { path: filePath });
      showToast('Board exported successfully!');
    }
  } catch (e) {
    showToast('Export error: ' + e);
  }
};

window.importBoard = async function() {
  try {
    const filePaths = await open({
      multiple: false,
      filters: [{ name: 'BliemBoard', extensions: ['bliem'] }],
    });
    if (filePaths && filePaths.length > 0) {
      // dialog returns array if multiple, string if single? Actually in v2 open(multiple:false) returns string or null
      const path = Array.isArray(filePaths) ? filePaths[0] : filePaths;
      if (!path) return;
      showToast('Importing board... (Might take a few seconds)');
      await invoke('import_board', { path });
      showToast('Board imported! Reloading...');
      setTimeout(() => window.location.reload(), 1000);
    }
  } catch (e) {
    showToast('Import error: ' + e);
  }
};

  window.updateMuteState = async function() {
    try {
      const isMuted = await invoke('get_is_muted');
      const badge = document.getElementById('mutedBadge');
      const settingsBadge = document.getElementById('settingsMutedBadge');
      if (isMuted) {
        badge.style.display = 'inline-block';
        if (settingsBadge) settingsBadge.style.display = 'inline-block';
        if (!muteReminderInterval) {
          startMuteReminder();
        }
      } else {
        badge.style.display = 'none';
        if (settingsBadge) settingsBadge.style.display = 'none';
        if (muteReminderInterval) clearInterval(muteReminderInterval);
        muteReminderInterval = null;
      }
    } catch(e) {}
  };

// Poll mute state periodically in case it was toggled via global hotkey in Rust
setInterval(() => {
  window.updateMuteState();
}, 250);

window.toggleMute = async function() {
  try {
    await invoke('toggle_mute');
    await window.updateMuteState();
  } catch (e) { console.error('Error toggling mute:', e); }
};

window.toggleMuteLocal = async function(checked) {
  try {
    await invoke('set_local_playback', { enabled: !checked });
    localStorage.setItem('muteLocal', checked ? 'true' : 'false');
  } catch (e) { showToast('Error: ' + e); }
};

window.toggleTestMic = async function(checked) {
  try {
    await invoke('set_test_mic', { test: checked });
    const sel = document.getElementById('micSelect');
    await window.setMic(sel.value);
    localStorage.setItem('testMic', checked ? '1' : '0');
  } catch (e) { console.error('Error toggling test mic:', e); }
};

window.toggleAutoStart = async function(checked) {
  try {
    const { enable, disable } = await import('@tauri-apps/plugin-autostart');
    if (checked) {
      await enable();
    } else {
      await disable();
    }
  } catch (e) {
    console.error('Error toggling autostart:', e);
  }
};

(async () => {
  try {
    await render();

    // Populate mic list
    const mics = await invoke('get_input_devices');
    const sel  = document.getElementById('micSelect');
    [...new Set(mics)].forEach(mic => {
      const opt = document.createElement('option');
      opt.value = mic; opt.textContent = mic;
      sel.appendChild(opt);
    });

    // Restore saved mic
    const savedMic = localStorage.getItem('selectedMic');
    if (savedMic && [...sel.options].some(o => o.value === savedMic)) {
      sel.value = savedMic;
      await window.setMic(savedMic);
    }

    // Restore test mic state
    const savedTest = localStorage.getItem('testMic') === '1';
    if (savedTest) {
      document.getElementById('testMic').checked = true;
      await window.toggleTestMic(true);
    }
    
    try {
      const { isEnabled } = await import('@tauri-apps/plugin-autostart');
      document.getElementById('autoStart').checked = await isEnabled();
    } catch (e) {
      console.warn("Could not load autostart status", e);
    }
    
    const savedMuteLocal = localStorage.getItem('muteLocal') === 'true';
    if (savedMuteLocal) {
      document.getElementById('muteLocal').checked = true;
      await window.toggleMuteLocal(true);
    }

    const savedReminder = localStorage.getItem('muteReminderMins');
    if (savedReminder) {
      const select = document.getElementById('muteReminderSelect');
      if (select) select.value = savedReminder;
    }
    
    await window.updateMuteState();

    initVisualizer();
    await initDragDrop();
  } catch (e) {
    console.error('Init error:', e);
    showToast('Failed to initialize app');
  }
})();

/* ═══════════════════════════════════════════════════════════════
   AUDIO EDITOR — trim / cut any format using Web Audio API
   Works with: MP3, WAV, OGG, FLAC, AAC, M4A, MP4, OPUS, WEBM…
   Output is always WAV (lossless, universal).
═══════════════════════════════════════════════════════════════ */
(function() {
  let editorSoundId = null;
  let editorBuffer = null;      // AudioBuffer (decoded)
  let editorCtx = null;         // AudioContext
  let editorStartFrac = 0;      // 0–1 fraction
  let editorEndFrac = 1;
  let editorPreviewSource = null;
  let editorDragging = null;    // 'start' | 'end' | null

  const overlay  = () => document.getElementById('audioEditorOverlay');
  const canvas   = () => document.getElementById('editorWaveform');
  const hStart   = () => document.getElementById('editorHandleStart');
  const hEnd     = () => document.getElementById('editorHandleEnd');
  const playhead = () => document.getElementById('editorPlayhead');
  const dimL     = () => document.getElementById('editorDimLeft');
  const dimR     = () => document.getElementById('editorDimRight');
  const status   = () => document.getElementById('editorStatus');

  function updateLabels() {
    if (!editorBuffer) return;
    const dur = editorBuffer.duration;
    const s = editorStartFrac * dur;
    const e = editorEndFrac * dur;
    document.getElementById('editorStartLabel').textContent = s.toFixed(2) + 's';
    document.getElementById('editorEndLabel').textContent   = e.toFixed(2) + 's';
    document.getElementById('editorDurLabel').textContent   = (e - s).toFixed(2) + 's';
  }

  function updateHandlePositions() {
    const c = canvas();
    const w = c.offsetWidth;
    hStart().style.left = (editorStartFrac * 100) + '%';
    hEnd().style.left = 'unset'; hEnd().style.right = ((1 - editorEndFrac) * 100) + '%';
    dimL().style.width  = (editorStartFrac * 100) + '%';
    dimR().style.width  = ((1 - editorEndFrac) * 100) + '%';
    updateLabels();
  }

  function drawWaveform() {
    const c = canvas();
    const dpr = window.devicePixelRatio || 1;
    c.width  = c.offsetWidth  * dpr;
    c.height = c.offsetHeight * dpr;
    const ctx2d = c.getContext('2d');
    ctx2d.scale(dpr, dpr);
    const W = c.offsetWidth;
    const H = c.offsetHeight;

    // Get mixed-down mono data from first channel
    const data = editorBuffer.getChannelData(0);
    const step = Math.ceil(data.length / W);
    const mid  = H / 2;

    ctx2d.clearRect(0, 0, W, H);
    ctx2d.strokeStyle = 'var(--accent-1)';
    ctx2d.lineWidth = 1;

    for (let x = 0; x < W; x++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const v = data[x * step + j] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      ctx2d.beginPath();
      ctx2d.moveTo(x, mid + min * mid * 0.9);
      ctx2d.lineTo(x, mid + max * mid * 0.9);
      ctx2d.stroke();
    }
  }

  // Drag handles
  function onMouseMove(e) {
    if (!editorDragging) return;
    const c = canvas();
    const rect = c.getBoundingClientRect();
    let frac = (e.clientX - rect.left) / rect.width;
    frac = Math.max(0, Math.min(1, frac));
    if (editorDragging === 'start') {
      editorStartFrac = Math.min(frac, editorEndFrac - 0.01);
    } else {
      editorEndFrac = Math.max(frac, editorStartFrac + 0.01);
    }
    updateHandlePositions();
  }

  function onMouseUp() { editorDragging = null; }

  function initDragListeners() {
    hStart().addEventListener('mousedown', e => { editorDragging = 'start'; e.preventDefault(); });
    hEnd().addEventListener('mousedown',   e => { editorDragging = 'end';   e.preventDefault(); });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);

    // Touch support
    hStart().addEventListener('touchstart', e => { editorDragging = 'start'; e.preventDefault(); }, { passive: false });
    hEnd().addEventListener('touchstart',   e => { editorDragging = 'end';   e.preventDefault(); }, { passive: false });
    document.addEventListener('touchmove', e => {
      if (!editorDragging) return;
      onMouseMove(e.touches[0]);
    }, { passive: false });
    document.addEventListener('touchend', onMouseUp);
  }

  // Open the editor for a given sound id
  window.openAudioEditor = async function(soundId, soundName) {
    editorSoundId = soundId;
    editorStartFrac = 0;
    editorEndFrac   = 1;
    editorBuffer    = null;
    if (editorPreviewSource) { try { editorPreviewSource.stop(); } catch(_) {} editorPreviewSource = null; }

    document.getElementById('audioEditorName').textContent = soundName || '';
    overlay().classList.add('show');
    status().textContent = 'Loading audio…';
    document.getElementById('editorSaveBtn').disabled = true;
    document.getElementById('editorPreviewBtn').disabled = true;
    playhead().style.display = 'none';

    try {
      const bytes = await invoke('read_sound_bytes', { id: soundId });
      if (!bytes || bytes.length === 0) throw new Error('Could not read audio data');

      if (!editorCtx) editorCtx = new AudioContext();
      const arrayBuf = new Uint8Array(bytes).buffer;
      editorBuffer = await editorCtx.decodeAudioData(arrayBuf);

      // Draw waveform (wait one frame so canvas has its dimensions)
      requestAnimationFrame(() => {
        drawWaveform();
        updateHandlePositions();
      });

      status().textContent = `Duration: ${editorBuffer.duration.toFixed(2)}s  ·  ${editorBuffer.sampleRate}Hz  ·  ${editorBuffer.numberOfChannels}ch`;
      document.getElementById('editorSaveBtn').disabled = false;
      document.getElementById('editorPreviewBtn').disabled = false;
    } catch(err) {
      status().textContent = '❌ ' + err.message;
      console.error('Audio editor load error:', err);
    }
  };

  window.closeAudioEditor = function() {
    if (editorPreviewSource) { try { editorPreviewSource.stop(); } catch(_) {} editorPreviewSource = null; }
    overlay().classList.remove('show');
  };

  // Preview only the selected region
  window.previewAudioTrim = function() {
    if (!editorBuffer || !editorCtx) return;
    if (editorPreviewSource) { try { editorPreviewSource.stop(); } catch(_) {} editorPreviewSource = null; }
    playhead().style.display = 'block';

    const startTime = editorStartFrac * editorBuffer.duration;
    const endTime   = editorEndFrac   * editorBuffer.duration;
    const duration  = endTime - startTime;

    const src = editorCtx.createBufferSource();
    // Slice the buffer to the selection
    const sliced = sliceAudioBuffer(editorBuffer, startTime, endTime);
    src.buffer = sliced;
    src.connect(editorCtx.destination);

    const playStartedAt = editorCtx.currentTime;
    src.start();
    editorPreviewSource = src;

    // Animate playhead
    function animatePlayhead() {
      if (!editorPreviewSource || editorPreviewSource !== src) return;
      const elapsed = editorCtx.currentTime - playStartedAt;
      const frac = editorStartFrac + (elapsed / editorBuffer.duration);
      playhead().style.left = (Math.min(frac, editorEndFrac) * 100) + '%';
      if (elapsed < duration) requestAnimationFrame(animatePlayhead);
      else { playhead().style.display = 'none'; editorPreviewSource = null; }
    }
    requestAnimationFrame(animatePlayhead);
  };

  // Save the trimmed audio as WAV
  window.saveAudioTrim = async function() {
    if (!editorBuffer || !editorCtx) return;
    if (editorPreviewSource) { try { editorPreviewSource.stop(); } catch(_) {} editorPreviewSource = null; }

    const startTime = editorStartFrac * editorBuffer.duration;
    const endTime   = editorEndFrac   * editorBuffer.duration;
    if (endTime - startTime < 0.01) { showToast('Selection too short!'); return; }

    document.getElementById('editorSaveBtn').disabled = true;
    status().textContent = 'Saving…';

    try {
      const sliced = sliceAudioBuffer(editorBuffer, startTime, endTime);
      const wavBytes = window.audioBufferToWav(sliced);
      const wavArray = Array.from(new Uint8Array(wavBytes));
      await invoke('trim_sound', { id: editorSoundId, wavData: wavArray });
      showToast('✂️ Trim saved!');
      window.closeAudioEditor();
      await render();
    } catch(err) {
      status().textContent = '❌ Save failed: ' + err.message;
      console.error('Trim save error:', err);
    } finally {
      document.getElementById('editorSaveBtn').disabled = false;
    }
  };

  // ── Helpers ─────────────────────────────────────────────────

  // Slice an AudioBuffer between startSec and endSec → new AudioBuffer
  function sliceAudioBuffer(buffer, startSec, endSec) {
    const sampleRate  = buffer.sampleRate;
    const channels    = buffer.numberOfChannels;
    const startSample = Math.floor(startSec * sampleRate);
    const endSample   = Math.min(Math.ceil(endSec * sampleRate), buffer.length);
    const length      = endSample - startSample;
    const ctx         = new OfflineAudioContext(channels, length, sampleRate);
    const out         = ctx.createBuffer(channels, length, sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      out.getChannelData(ch).set(buffer.getChannelData(ch).subarray(startSample, endSample));
    }
    return out;
  }

  // Encode an AudioBuffer as a WAV file (PCM 16-bit, little-endian)
  window.audioBufferToWav = function(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate  = buffer.sampleRate;
    const numSamples  = buffer.length;
    const bitsPerSample = 16;
    const byteRate    = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign  = numChannels * (bitsPerSample / 8);
    const dataSize    = numSamples * blockAlign;
    const totalSize   = 44 + dataSize;

    const buf = new ArrayBuffer(totalSize);
    const view = new DataView(buf);

    // RIFF header
    writeStr(view, 0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeStr(view, 8, 'WAVE');
    writeStr(view, 12, 'fmt ');
    view.setUint32(16, 16, true);           // PCM chunk size
    view.setUint16(20, 1, true);            // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave channels as 16-bit PCM
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = buffer.getChannelData(ch)[i];
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
        offset += 2;
      }
    }
    return buf;
  }

  function writeStr(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  initDragListeners();
})();

// GitHub Auto-Updater
async function checkForUpdates() {
  try {
    const response = await fetch('https://api.github.com/repos/BenedecusHTL/BliemBoard/releases/latest');
    if (!response.ok) return;
    const data = await response.json();
    const latestVersion = data.tag_name; // e.g., 'v1.0.8'
    
    // Get current version from HTML
    const currentVersionSpan = document.querySelector('.header-meta .version');
    if (!currentVersionSpan) return;
    const currentVersion = currentVersionSpan.textContent.trim(); // e.g., 'v1.0.7'

    // Compare semantic versions properly (e.g. v1.0.10 > v1.0.9)
    const cmpVersions = (a, b) => {
      const pa = a.replace('v', '').split('.').map(Number);
      const pb = b.replace('v', '').split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) > (pb[i] || 0)) return 1;
        if ((pa[i] || 0) < (pb[i] || 0)) return -1;
      }
      return 0;
    };

    if (latestVersion && cmpVersions(latestVersion, currentVersion) > 0) {
      const updateBadge = document.getElementById('updateBadge');
      if (updateBadge) {
        updateBadge.textContent = 'Install new version ' + latestVersion;
        updateBadge.style.display = 'inline-block';
        
        const msiAsset = data.assets && data.assets.find(a => a.name.endsWith('.msi'));
        const downloadUrl = msiAsset ? msiAsset.browser_download_url : data.html_url;

        updateBadge.onclick = async () => {
          if (msiAsset) {
            updateBadge.textContent = 'Downloading...';
            updateBadge.style.pointerEvents = 'none';
            try {
              await invoke('download_and_install_update', { url: downloadUrl });
            } catch (err) {
              console.error(err);
              updateBadge.textContent = 'Install failed!';
            }
          } else {
            await invoke('open_url', { url: downloadUrl });
          }
        };
      }
    }
  } catch (err) {
    console.warn("Update check failed:", err);
  }
}

window.addEventListener('DOMContentLoaded', checkForUpdates);

// ─── ADDITIONAL AUDIO ─────────────────────────────────────────────────────────

let _audioApps = JSON.parse(localStorage.getItem('audioApps') || '[]');

function saveAudioApps() {
  localStorage.setItem('audioApps', JSON.stringify(_audioApps));
}

function renderAudioApps() {
  const container = document.getElementById('additionalAudioCards');
  const panel = document.getElementById('additionalAudioPanel');
  if (!container) return;
  container.innerHTML = '';
  if (_audioApps.length === 0) {
    // panel.style.display = 'none';
    return;
  }
  // panel.style.display = 'block';
  _audioApps.forEach(app => {
    const card = document.createElement('div');
    card.style.cssText = 'position:relative; display:flex; flex-direction:column; align-items:center; width:115px; background:var(--bg-2); border:1px solid var(--border); border-radius:8px; padding:10px 8px 8px; gap:6px; cursor:default;';

    const rm = document.createElement('button');
    rm.innerHTML = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    rm.style.cssText = 'position:absolute; top:4px; right:4px; background:none; border:none; color:var(--text-4); cursor:pointer; padding:2px; line-height:0;';
    rm.onclick = () => window.removeAudioApp(app.pid);
    card.appendChild(rm);

    const img = document.createElement('div');
    img.style.cssText = 'width:40px; height:40px; border-radius:6px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:var(--bg-3);';
    if (app.iconBase64) {
      img.innerHTML = `<img src="data:image/png;base64,${app.iconBase64}" style="width:32px;height:32px;object-fit:contain;">`;
    } else {
      img.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    }
    card.appendChild(img);

    const name = document.createElement('div');
    name.textContent = app.name;
    name.style.cssText = 'font-size:11px; color:var(--text-1); text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; max-width:99px;';
    card.appendChild(name);

    const row = document.createElement('div');
    row.className = 'volume-control';
    row.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; width:100%; margin-top:4px; padding: 4px 0; background: transparent;';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '100';
    slider.value = Math.round(app.volume * 100);
    slider.style.cssText = 'width: 100%; max-width: 90px; text-align:center;';
    slider.oninput = () => {
      const vol = parseInt(slider.value) / 100;
      app.volume = vol;
      saveAudioApps();
      invoke('set_app_volume', { pid: app.pid, volume: vol }).catch(() => {});
    };
    const label = document.createElement('span');
    label.textContent = slider.value + '%';
    label.style.cssText = 'font-size:10px; color:var(--text-4); width:100%; text-align:center; margin-top:2px;';
    slider.addEventListener('input', () => { label.textContent = slider.value + '%'; });
    row.appendChild(slider);
    row.appendChild(label);
    card.appendChild(row);

    container.appendChild(card);
  });
}

window.openAddAudioModal = async function() {
  document.getElementById('addAudioOverlay').style.display = 'flex';
  await window.refreshAudioSessions();
};

window.refreshAudioSessions = async function() {
  const list = document.getElementById('audioSessionList');
  if (!list) return;
  list.innerHTML = '<div style="font-size:12px;color:var(--text-4);padding:8px;">Loading...</div>';
  try {
    const sessions = await invoke('get_audio_sessions');
    if (!sessions || sessions.length === 0) {
      list.innerHTML = '<div style="font-size:12px;color:var(--text-4);padding:8px;">No apps currently playing audio detected.</div>';
      return;
    }
    list.innerHTML = '';
    sessions.forEach(s => {
      const alreadyAdded = _audioApps.some(a => a.pid === s.pid);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px; border-radius:6px; background:var(--bg-2); cursor:pointer;';
      row.onmouseenter = () => row.style.background = 'var(--bg-3)';
      row.onmouseleave = () => row.style.background = 'var(--bg-2)';

      const iconEl = document.createElement('div');
      iconEl.style.cssText = 'width:28px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;';
      if (s.icon_base64) {
        iconEl.innerHTML = `<img src="data:image/png;base64,${s.icon_base64}" style="width:24px;height:24px;object-fit:contain;">`;
      } else {
        iconEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>`;
      }
      row.appendChild(iconEl);

      const nameEl = document.createElement('span');
      nameEl.textContent = s.name;
      nameEl.style.cssText = 'font-size:12px;color:var(--text-1);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      row.appendChild(nameEl);

      if (alreadyAdded) {
        const badge = document.createElement('span');
        badge.textContent = 'Added';
        badge.style.cssText = 'font-size:10px;color:var(--accent);opacity:0.7;';
        row.appendChild(badge);
      } else {
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add';
        addBtn.className = 'btn btn-primary-modal';
        addBtn.style.cssText = 'font-size:11px; padding:3px 10px;';
        addBtn.onclick = (e) => {
          e.stopPropagation();
          window.addAudioApp(s.pid, s.name, s.icon_base64, s.volume);
          addBtn.textContent = '✓ Added';
          addBtn.disabled = true;
          addBtn.style.opacity = '0.5';
        };
        row.appendChild(addBtn);
      }
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<div style="font-size:12px;color:#ff5555;padding:8px;">Error: ${err}</div>`;
  }
};

window.addAudioApp = function(pid, name, iconBase64) {
  if (_audioApps.find(a => a.pid === pid)) return;
  const volume = 1.0;
  _audioApps.push({ pid, name, iconBase64: iconBase64 || null, volume: volume ?? 1.0 });
  saveAudioApps();
  renderAudioApps();
  const vOut = localStorage.getItem('virtualOutput') || null;
  invoke('start_app_loopback', { pid, volume: volume ?? 1.0, virtualOutput: vOut }).catch(() => {});
}

window.removeAudioApp = function(pid) {
  _audioApps = _audioApps.filter(a => a.pid !== pid);
  saveAudioApps();
  renderAudioApps();
  invoke('stop_app_loopback', { pid }).catch(() => {});
}

window.updateAudioAppVolume = function(pid, volume) {
  const app = _audioApps.find(a => a.pid === pid);
  if (app) {
    app.volume = volume;
    saveAudioApps();
    invoke('set_app_volume', { pid, volume }).catch(() => {});
  }
}

window.restoreAudioApps = function() {
  renderAudioApps();
  const vOut = localStorage.getItem('virtualOutput') || null;
  _audioApps.forEach(app => {
    invoke('start_app_loopback', { pid: app.pid, volume: app.volume, virtualOutput: vOut }).catch(() => {});
  });
};

// Start restoring audio apps on load
setTimeout(window.restoreAudioApps, 1000);

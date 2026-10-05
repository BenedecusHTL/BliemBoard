const fs = require('fs');
let c = fs.readFileSync('src/main.js', 'utf8');

const target = "window.setMasterVolume(masterVolume);\n    }";
const replacement = target + "\n\nwindow.addEventListener('DOMContentLoaded', () => {\n  restoreCustomizations();\n  initMicDsp();\n  ['dspDenoiseModal', 'dspEqModal', 'dspCompModal'].forEach(id => { const el = document.getElementById(id); if (el) document.body.appendChild(el); });\n});\n";

c = c.replace(target, replacement);
fs.writeFileSync('src/main.js', c);

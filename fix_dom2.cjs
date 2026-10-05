const fs = require('fs');
let c = fs.readFileSync('src/main.js', 'utf8');

c = c.replace(
  "window.addEventListener('DOMContentLoaded', () => {\n    restoreCustomizations();\n    initMicDsp();\n    ['dspDenoiseModal', 'dspEqModal', 'dspCompModal'].forEach(id => { const el = document.getElementById(id); if (el) document.body.appendChild(el); });\n});",
  "// Execute immediately since type='module' defers execution until DOM is parsed\nrestoreCustomizations();\ninitMicDsp();\n['dspDenoiseModal', 'dspEqModal', 'dspCompModal'].forEach(id => { const el = document.getElementById(id); if (el) document.body.appendChild(el); });"
);

fs.writeFileSync('src/main.js', c);

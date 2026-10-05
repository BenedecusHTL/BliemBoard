const fs = require('fs');
let c = fs.readFileSync('src/main.js', 'utf8');

c = c.replace(/window\.addEventListener\('DOMContentLoaded', \(\) => \{\s*restoreCustomizations\(\);\s*\}\);/, "window.addEventListener('DOMContentLoaded', () => {\n    restoreCustomizations();\n    initMicDsp();\n    ['dspDenoiseModal', 'dspEqModal', 'dspCompModal'].forEach(id => { const el = document.getElementById(id); if (el) document.body.appendChild(el); });\n});");

fs.writeFileSync('src/main.js', c);

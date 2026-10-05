const fs = require('fs');
let js = fs.readFileSync('src/main.js', 'utf8');

js = js.replace(/window\.addEventListener\('DOMContentLoaded', \(\) => \{\s*restoreCustomizations\(\);\s*initMicDsp\(\);\s*\}\);/g, `
try { restoreCustomizations(); } catch(e) { console.error('restoreCustomizations error:', e); }
try { ['dspDenoiseModal', 'dspEqModal', 'dspCompModal'].forEach(id => { const el = document.getElementById(id); if (el) document.body.appendChild(el); }); } catch(e) { console.error('modal move error:', e); }
window.initMicDspWrapper = function() { try { if (typeof initMicDsp !== 'undefined') initMicDsp(); } catch(e) { console.error('initMicDsp error:', e); } };
`);

// Now at the bottom of the IIFE, call initMicDspWrapper() and render()
js = js.replace(/render\(\);\s*\}\)\(\);/g, `
    render();
    if (typeof window.initMicDspWrapper === 'function') window.initMicDspWrapper();
  })();
`);

fs.writeFileSync('src/main.js', js);

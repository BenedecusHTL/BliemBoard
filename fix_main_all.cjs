const fs = require('fs');
let c = fs.readFileSync('src/main.js', 'utf8');

// 1. Remove bad initMicDsp call at the top if it exists
c = c.replace(
    /window\.addEventListener\('DOMContentLoaded', \(\) => \{\n\s*restoreCustomizations\(\);\n\s*initMicDsp\(\);\n\}\);/,
    "window.addEventListener('DOMContentLoaded', () => {\n    restoreCustomizations();\n});"
);

// 2. Fix setDspChain
c = c.replace(
    /for\(let i=0; i<5; i\+\+\) \{\n\s*let v = document\.getElementById\(dspEqBand\$\{i\}\)\.value;\n\s*document\.getElementById\(dspEqVal\$\{i\}\)\.textContent = \(v > 0 \? '\+'\+v : v\) \+ 'dB';\n\s*\}\n\s*document\.getElementById\('dspDenoiseVal'\)\.textContent = document\.getElementById\('dspDenoiseStrength'\)\.value;\n\s*document\.getElementById\('dspCompThreshVal'\)\.textContent = document\.getElementById\('dspCompThresh'\)\.value;\n\s*document\.getElementById\('dspCompRatioVal'\)\.textContent = document\.getElementById\('dspCompRatio'\)\.value;/g,
    "document.getElementById('dspDenoiseVal').textContent = document.getElementById('dspDenoiseStrength').value;\n    document.getElementById('dspCompRatioVal').textContent = document.getElementById('dspCompRatio').value;"
);

// 3. Add to bottom DOMContentLoaded block (the one that ends around line 671)
// The end of that block is:
//     });
//   }
// });
// // --- CUSTOM RIGHT-CLICK DRAG & DROP ---

c = c.replace(
    "    });\n  }\n});\n\n// --- CUSTOM RIGHT-CLICK DRAG & DROP ---",
    "    });\n  }\n\n  initMicDsp();\n  ['dspDenoiseModal', 'dspEqModal', 'dspCompModal'].forEach(id => { const el = document.getElementById(id); if (el) document.body.appendChild(el); });\n});\n\n// --- CUSTOM RIGHT-CLICK DRAG & DROP ---"
);

fs.writeFileSync('src/main.js', c);

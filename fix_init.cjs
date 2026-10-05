const fs = require('fs');
let js = fs.readFileSync('src/main.js', 'utf8');

js = js.replace('await render();\n\n    // Populate virtual output list', 
  'await render();\n    try { initMicDsp(); } catch(e) { console.error("initMicDsp error:", e); }\n\n    // Populate virtual output list');

// And remove my previous wrapper attempt from the top
js = js.replace(/window\.initMicDspWrapper = function.*?\n/, '');

fs.writeFileSync('src/main.js', js);

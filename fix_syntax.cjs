const fs = require('fs');
let c = fs.readFileSync('src/main.js', 'utf8');

c = c.replace(/restoreCustomizations\(\);\\n    initMicDsp\(\);/g, "restoreCustomizations();");

fs.writeFileSync('src/main.js', c);

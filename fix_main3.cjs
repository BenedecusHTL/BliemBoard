const fs = require('fs');
let c = fs.readFileSync('src/main.js', 'utf8');

let lines = c.split('\n');
let newLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes('for(let i=0; i<5; i++) {')) {
        skip = true;
    }
    
    if (skip && line.includes('document.getElementById("dspCompRatioVal").textContent = document.getElementById("dspCompRatio").value;'.replace(/"/g, "'"))) {
        skip = false;
        newLines.push("    document.getElementById('dspDenoiseVal').textContent = document.getElementById('dspDenoiseStrength').value;");
        newLines.push("    document.getElementById('dspCompRatioVal').textContent = document.getElementById('dspCompRatio').value;");
        continue;
    }
    
    if (!skip) {
        newLines.push(line);
    }
}
c = newLines.join('\n');

fs.writeFileSync('src/main.js', c);

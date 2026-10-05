const fs = require('fs');
let c = fs.readFileSync('src/index.html', 'utf8');

const regex = /(<!-- DSP Modals -->[\s\S]*?id=\"dspCompRatio\".*?<\/div>\s*<\/div>\s*<\/div>)/;
const match = c.match(regex);
if (match) {
    const modals = match[1];
    c = c.replace(modals, '');
    c = c.replace('</body>', modals + '\n</body>');
    fs.writeFileSync('src/index.html', c);
    console.log('Moved modals successfully!');
} else {
    console.log('Match failed.');
}

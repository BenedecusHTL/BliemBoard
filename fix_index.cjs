const fs = require('fs');
let c = fs.readFileSync('src/index.html', 'utf8');

c = c.replace(
  "<div class=\"modal-body\" style=\"overflow:hidden;\">",
  "<div class=\"modal-body\" style=\"max-height: 80vh; overflow-y: auto;\">"
);

const startIndex = c.indexOf('<!-- DSP Modals -->');
if (startIndex !== -1) {
    const endStr = '</button>\n        </div>\n      </div>\n    </div>'; // Last part of the Compressor modal
    const endIndex = c.indexOf(endStr, startIndex);
    if (endIndex !== -1) {
        const fullEnd = endIndex + endStr.length;
        const modalsStr = c.substring(startIndex, fullEnd);
        c = c.substring(0, startIndex) + c.substring(fullEnd);
        c = c.replace('</body>', modalsStr + '\n</body>');
    }
}

fs.writeFileSync('src/index.html', c);

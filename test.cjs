const fs = require('fs'); let html = fs.readFileSync('src/index.html', 'utf8'); let s = html.indexOf('openSettings'); console.log(html.substring(s - 50, s + 50));

const http = require('http'); http.createServer((req, res) => { console.log('FRONTEND LOG:', req.url); res.end('ok'); }).listen(9999, () => console.log('Listening on 9999'));

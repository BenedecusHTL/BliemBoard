const fs = require('fs');
let js = fs.readFileSync('src/main.js', 'utf8');
const injection = `
const origLog = console.log;
const origErr = console.error;
window.addEventListener('error', e => {
  fetch('http://127.0.0.1:9999/log?type=error&msg=' + encodeURIComponent(e.message + ' at ' + e.filename + ':' + e.lineno)).catch(()=>origLog.apply(console,['fetch err']));
});
window.addEventListener('unhandledrejection', e => {
  fetch('http://127.0.0.1:9999/log?type=unhandledrejection&msg=' + encodeURIComponent(e.reason)).catch(()=>origLog.apply(console,['fetch err']));
});
console.log = function(...args) {
  fetch('http://127.0.0.1:9999/log?type=log&msg=' + encodeURIComponent(args.join(' '))).catch(()=>{});
  origLog.apply(console, args);
};
console.error = function(...args) {
  fetch('http://127.0.0.1:9999/log?type=error&msg=' + encodeURIComponent(args.join(' '))).catch(()=>{});
  origErr.apply(console, args);
};
`;
// Clean previous injection
js = js.replace(/window\.addEventListener\('error'.*?console\.error = function[^\}]+\};\n/s, '');
if (!js.includes('http://127.0.0.1:9999')) {
  fs.writeFileSync('src/main.js', injection + js);
}

const fs = require('fs');
let js = fs.readFileSync('src/main.js', 'utf8');
const injection = `
window.addEventListener('error', e => {
  document.body.innerHTML += \`<div style='position:fixed;top:0;left:0;z-index:9999;background:red;color:white;padding:10px;'>ERR: \${e.message} \${e.filename}:\${e.lineno}</div>\`;
});
window.addEventListener('unhandledrejection', e => {
  document.body.innerHTML += \`<div style='position:fixed;top:40px;left:0;z-index:9999;background:orange;color:white;padding:10px;'>REJ: \${e.reason}</div>\`;
});
`;
if (!js.includes('window.addEventListener(\'error\'')) {
  fs.writeFileSync('src/main.js', injection + js);
}

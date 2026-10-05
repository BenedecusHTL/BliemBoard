const fs = require('fs');
let js = fs.readFileSync('src/main.js', 'utf8');

js = js.replace(/\(async \(\) => \{\s*try \{/, `
console.log('REACHED IIFE');
(async () => {
  try {`);
fs.writeFileSync('src/main.js', js);

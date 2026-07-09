const fs = require('fs');
const path = require('path');
const here = __dirname;
const tpl = fs.readFileSync(path.join(here, 'tool-template.html'), 'utf8');
const lib = fs.readFileSync(path.join(here, 'package/dist/xlsx.full.min.js'), 'utf8');
const marker = '//__SHEETJS_HERE__';
if (!tpl.includes(marker)) throw new Error('marker missing');
// split/join, not replace(): the lib contains "$" sequences replace() would mangle
const out = tpl.split(marker).join(lib);
const dest = process.argv[2] || '/home/user/Band-Music-Organizer/hotel-sheet-sync.html';
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(0) + ' KB');

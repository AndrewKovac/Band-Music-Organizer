// Extracts the core-logic <script> block from the template so Node can require it.
const fs = require('fs');
const path = require('path');
const tpl = fs.readFileSync(path.join(__dirname, 'tool-template.html'), 'utf8');
const m = tpl.match(/<script id="core-logic">([\s\S]*?)<\/script>/);
if (!m) throw new Error('core-logic block not found');
fs.writeFileSync(path.join(__dirname, 'core.js'),
  'global.XLSX = require("./package/dist/xlsx.full.min.js");\n' + m[1]);
console.log('core.js extracted');

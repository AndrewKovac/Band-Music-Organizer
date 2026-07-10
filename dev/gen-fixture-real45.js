// Fixture real4 — THE MONEY BUG: a pilot with two separate stays (07-08JUL
// past, 10JUL future). The master only lists the 10JUL one. Merging them
// would stretch the first booking across extra paid nights. Required: the
// 10JUL booking is NEW, the 07JUL row is HISTORICAL, nothing merges.
//
// Fixture real5 — GREY/STRUCK RECORDS: a dead (grey+struck) name inside a
// live row must be left alone (no "name change"), and a fully struck row is
// "cancelled earlier" — never re-proposed, record kept.
const XLSX = require('./package/dist/xlsx.full.min.js');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const s = v => ({ t: 's', v: String(v) });
const HHDR = ['Hotel Name', 'Hotel Location', 'Check-in Time', 'Check-in Date', 'Inbound FLT',
  'Check-Out Time', 'Check-Out Date', 'Outbound FLT', 'Name 1', 'Name 2', 'Name 3',
  'Pairing Shortcode', 'Confirmation Numbers', '', '', 'Comments'];
const MHDR = ['Hotel Name', 'Hotel Location', 'Check in Time', 'Check in Date', 'Inbound Flight',
  'Check out Time', 'Check out Date', 'Outbound Flight', 'Name 1', 'Name 2', 'Name 3', 'Pairing Code', 'Notes'];
const LIM = 'LIM - Pullman Lima Miraflores';
function sheet(hdr, rows) {
  const ws = {};
  hdr.forEach((h, c) => { if (h) ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h }; });
  rows.forEach((row, r) => row.forEach((cell, c) => {
    if (cell && cell.v !== undefined && cell.v !== '') ws[XLSX.utils.encode_cell({ r: r + 1, c })] = cell;
  }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: hdr.length - 1 } });
  return ws;
}

/* ---------------- real4 ---------------- */
const h4 = [
  [s(LIM), s('LIM'), s('05:34'), s('7-Jul'), s('1507'), s('05:18'), s('8-Jul'), s('1508'),
   s('Diaz, Pilot'), '', '', s('Pairing short code AA11'), s('80011001'), '', '', ''],
];
const hwb4 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(hwb4, sheet(HHDR, h4), 'JUL 06 AK N');
fs.writeFileSync(path.join(__dirname, 'fixtures/real4.hotel.xlsx'), XLSX.write(hwb4, { type: 'buffer', bookType: 'xlsx' }));
const m4 = [
  [s(LIM), s('LIM'), s('02:10'), s('10-Jul'), s('1507'), s('05:45'), s('10-Jul'), s('1508'),
   s('Diaz, Pilot'), '', '', s('BB22'), ''],
];
const mwb4 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(mwb4, sheet(MHDR, m4), 'Hotel Bookings Report');
fs.writeFileSync(path.join(__dirname, 'fixtures/real4.master.xlsx'), XLSX.write(mwb4, { type: 'buffer', bookType: 'xlsx' }));

/* ---------------- real5 (needs real styles -> raw xlsx) ---------------- */
function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function cell(ref, txt, styleIdx) {
  if (txt === '' || txt == null) return '';
  return '<c r="' + ref + '"' + (styleIdx ? ' s="' + styleIdx + '"' : '') +
    ' t="inlineStr"><is><t xml:space="preserve">' + esc(txt) + '</t></is></c>';
}
const COLS = 'ABCDEFGHIJKLMNOP';
function rowXml(rn, vals, styles) {
  let x = '<row r="' + rn + '">';
  vals.forEach((v, i) => { x += cell(COLS[i] + rn, v, (styles && styles[i]) || 0); });
  return x + '</row>';
}
// style 1 = grey font + strike (dead name) · style 2 = strike only (cancelled row)
const stylesXml = '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><sz val="11"/><name val="Calibri"/><strike/><color rgb="FF808080"/></font>' +
  '<font><sz val="11"/><name val="Calibri"/><strike/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/></cellXfs></styleSheet>';
const hdrRow = rowXml(1, HHDR);
const r2 = rowXml(2, [LIM, 'LIM', '14:00', '10-Jul', 'AV900', '11:00', '11-Jul', 'AV901',
  'Live, Larry', 'Dead, Denny', '', 'Pairing short code CC33', '80022001', '80022002', '', ''],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]);          // Denny + his conf: grey+struck
const r3 = rowXml(3, [LIM, 'LIM', '15:00', '10-Jul', 'AV910', '10:00', '11-Jul', 'AV911',
  'Gone, Gary', '', '', 'Pairing short code DD44', '80022003', '', '', 'Cancel'],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 2, 2, 0, 0, 2]);          // whole row struck
const r4 = rowXml(4, [LIM, 'LIM', '16:00', '10-Jul', 'AV920', '09:00', '11-Jul', 'AV921',
  'Stay, Sam', '', '', 'Pairing short code EE55', '80022004', '', '', '']);
const sheetXml = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
  hdrRow + r2 + r3 + r4 + '</sheetData></worksheet>';
const parts = {
  '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="JUL 06 AK N" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml': stylesXml,
  'xl/worksheets/sheet1.xml': sheetXml
};
// minimal stored-entry zip writer (no compression needed for tiny files)
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}
const chunks = [], central = [];
let offset = 0;
for (const [name, xml] of Object.entries(parts)) {
  const data = Buffer.from(xml, 'utf8');
  const nameB = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
  lh.writeUInt32LE(0, 10); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nameB.length, 26); lh.writeUInt16LE(0, 28);
  chunks.push(lh, nameB, data);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10);
  ch.writeUInt32LE(0, 12); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(0, 30); ch.writeUInt32LE(0, 34); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
  central.push(Buffer.concat([ch, nameB]));
  offset += lh.length + nameB.length + data.length;
}
const cd = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(central.length, 8); eocd.writeUInt16LE(central.length, 10);
eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
fs.writeFileSync(path.join(__dirname, 'fixtures/real5.hotel.xlsx'), Buffer.concat([...chunks, cd, eocd]));

const m5 = [
  [s(LIM), s('LIM'), s('14:00'), s('10-Jul'), s('AV900'), s('11:00'), s('11-Jul'), s('AV901'),
   s('Live, Larry'), '', '', s('CC33'), ''],
  [s(LIM), s('LIM'), s('16:00'), s('10-Jul'), s('AV920'), s('09:00'), s('11-Jul'), s('AV921'),
   s('Stay, Sam'), '', '', s('EE55'), ''],
];
const mwb5 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(mwb5, sheet(MHDR, m5), 'Hotel Bookings Report');
fs.writeFileSync(path.join(__dirname, 'fixtures/real5.master.xlsx'), XLSX.write(mwb5, { type: 'buffer', bookType: 'xlsx' }));
console.log('fixtures real4 + real5 ready');

// Master fixture = the VMO state that produced the "JUN 29 CR M" page in the
// user's real sample. VMO-style quirks on purpose: dates as bare day numbers,
// times as text, pairing codes bare (no "Pairing short code" prefix).
// Also copies the uploaded real hotel sheet into fixtures/real1.hotel.xlsx.
const XLSX = require('./package/dist/xlsx.full.min.js');
const fs = require('fs');
const path = require('path');

const upload = '/root/.claude/uploads/6f7cb8a5-a083-5e20-9bb7-1d469b798465/8bcbfebb-Test.xlsx';
fs.mkdirSync(path.join(__dirname, 'fixtures'), { recursive: true });
const hotelFix = path.join(__dirname, 'fixtures/real1.hotel.xlsx');
if (fs.existsSync(upload)) fs.copyFileSync(upload, hotelFix);
else if (!fs.existsSync(hotelFix)) throw new Error('real1.hotel.xlsx missing and upload unavailable');

const s = v => ({ t: 's', v: String(v) });
const dnum = d => ({ t: 'n', v: d });                    // bare day-of-month number
const HDR = ['Hotel Name', 'Hotel Location', 'Check in Time', 'Check in Date', 'Inbound Flight',
  'Check out Time', 'Check out Date', 'Outbound Flight', 'Name 1', 'Name 2', 'Name 3', 'Pairing Code', 'Notes'];
const BQK = 'BQK - Embassy Suites by Hilton Brunswick';
const rows = [
  [s(BQK), s('BQK'), s('12:22'), dnum(22), s('DL4686'), s('10:40'), dnum(23), s('9003'),
   s('Swift, Taylor'), s('Goldberg, Israel'), '', s('97PR'), ''],
  [s(BQK), s('BQK'), s('16:35'), dnum(24), s('9004'), s('11:07'), dnum(25), s('DL4686'),
   s('Steinburg, Jeremy'), s('Sandler, Adam'), '', s('DRCB'), ''],
  [s(BQK), s('BQK'), s('19:01'), dnum(22), s('9004'), s('11:07'), dnum(27), s('DL4686'),
   s('Walker, Brady'), s('Sandler, Adam'), '', s('FKJS'), ''],
];
const ws = {};
HDR.forEach((h, c) => { ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h }; });
rows.forEach((row, r) => row.forEach((cell, c) => {
  if (cell && cell.v !== undefined && cell.v !== '') ws[XLSX.utils.encode_cell({ r: r + 1, c })] = cell;
}));
ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: HDR.length - 1 } });
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'VMO Export');
fs.writeFileSync(path.join(__dirname, 'fixtures/real1.master.xlsx'), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log('fixtures/real1.master.xlsx + real1.hotel.xlsx ready');

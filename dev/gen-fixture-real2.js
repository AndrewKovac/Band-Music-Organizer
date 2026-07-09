// Fixture real2: the REAL VMO master export (uploaded by the user) against a
// hand-built prior-state hotel sheet for LIM, crafted to exercise:
//   - header-mapped parsing of the shifted VMO layout + UTC date anchoring
//   - check-in immutability (7-Jul/8-Jul check-ins are past vs today=9-Jul)
//   - check-out time/date updates on locked rows
//   - silent pairing splits (two one-name master rows, one two-name hotel row)
//   - historical vs cancellable unmatched hotel rows
//   - trailing footer junk that must be stripped from the output
const XLSX = require('./package/dist/xlsx.full.min.js');
const fs = require('fs');
const path = require('path');

const upload = '/root/.claude/uploads/6f7cb8a5-a083-5e20-9bb7-1d469b798465/e017a853-Master_Test.xlsx';
fs.mkdirSync(path.join(__dirname, 'fixtures'), { recursive: true });
const masterFix = path.join(__dirname, 'fixtures/real2.master.xlsx');
if (fs.existsSync(upload)) fs.copyFileSync(upload, masterFix);
else if (!fs.existsSync(masterFix)) throw new Error('real2.master.xlsx missing and upload unavailable');

const s = v => ({ t: 's', v: String(v) });
const dser = serial => ({ t: 'n', v: serial, z: 'd-mmm' });   // 2026-07-07 = 46210
const D = { 7: 46210, 8: 46211, 9: 46212, 10: 46213, 11: 46214, 12: 46215, 13: 46216 };
const HDR = ['Hotel Name', 'Hotel Location', 'Check-in Time', 'Check-in Date', 'Inbound FLT',
  'Check-Out Time', 'Check-Out Date', 'Outbound FLT', 'Name 1', 'Name 2', 'Name 3',
  'Pairing Shortcode', 'Confirmation Numbers', '', '', 'Comments'];
const LIM = 'LIM - Pullman Lima Miraflores';
const rows = [
  // past check-in (7th), hotel check-out time stale (05:00 vs master 04:15)
  [s(LIM), s('LIM'), s('05:18'), dser(D[7]), s('1507'), s('05:00'), dser(D[9]), s('1508'),
   s('Joe, Vincent'), s('Bob, Samuel'), '', s('Pairing short code AAQQ'), s('70011001'), s('70011002'), '', ''],
  // split pairing: both crew on ONE hotel row; master has them on two rows; co-time stale
  [s(LIM), s('LIM'), s('05:32'), dser(D[8]), s('1507'), s('03:45'), dser(D[10]), s('1508'),
   s('Bob, Nancy'), s('Bob, Tai Wai David'), '', s('Pairing short code SDKJ'), s('70011003'), s('70011004'), '', ''],
  // split pairing, fully in sync -> unchanged
  [s(LIM), s('LIM'), s('05:13'), dser(D[9]), s('1507'), s('04:15'), dser(D[11]), s('1508'),
   s('Joe, Colin'), s('Bob, Tracey'), '', s('Pairing short code KJWE'), s('70011005'), s('70011006'), '', ''],
  // in sync -> unchanged
  [s(LIM), s('LIM'), s('23:10'), dser(D[9]), s('DL151'), s('19:05'), dser(D[10]), s('5508'),
   s('Joe, Jeffrey'), s('Bob, Jason'), '', s('Pairing short code PPLL'), s('70011007'), s('70011008'), '', ''],
  // check-out DATE moved (hotel 12th, master 13th); check-in (10th) is future -> not locked
  [s(LIM), s('LIM'), s('05:30'), dser(D[10]), s('1507'), s('03:00'), dser(D[12]), s('1508'),
   s('Joe, Olaposi'), '', '', s('Pairing short code QQTT'), s('70011009'), '', '', ''],
  // in sync -> unchanged
  [s(LIM), s('LIM'), s('05:30'), dser(D[10]), s('1507'), s('22:05'), dser(D[10]), s('DL150'),
   s('Bob, Yue'), '', '', s('Pairing short code RRYY'), s('70011010'), '', '', ''],
  // in sync -> unchanged
  [s(LIM), s('LIM'), s('20:50'), dser(D[10]), s('5509'), s('09:45'), dser(D[11]), s('AV50'),
   s('Bob, Mohsen'), s('Joe, Himanshu'), '', s('Pairing short code MMHH'), s('70011011'), s('70011012'), '', ''],
  // past check-in, not on master at all -> HISTORICAL, never a cancellation
  [s(LIM), s('LIM'), s('14:00'), dser(D[8]), s('AV123'), s('10:00'), dser(D[9]), s('AV124'),
   s('Dave, Randy'), '', '', s('Pairing short code ZZXX'), s('70011013'), '', '', ''],
  // future check-in, not on master -> genuine cancellation proposal
  [s(LIM), s('LIM'), s('16:00'), dser(D[10]), s('AV223'), s('11:00'), dser(D[11]), s('AV224'),
   s('Smith, Chuck'), '', '', s('Pairing short code VVBB'), s('70011014'), '', '', ''],
];
const ws = {};
HDR.forEach((h, c) => { if (h) ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h }; });
rows.forEach((row, r) => row.forEach((cell, c) => {
  if (cell && cell.v !== undefined && cell.v !== '') ws[XLSX.utils.encode_cell({ r: r + 1, c })] = cell;
}));
// trailing footer junk that the output must strip
ws[XLSX.utils.encode_cell({ r: rows.length + 1, c: 0 })] = { t: 's', v: 'Prepared by hotel front desk — internal use' };
ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length + 1, c: 15 } });
ws['!merges'] = [{ s: { c: 12, r: 0 }, e: { c: 14, r: 0 } }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'JUL 06 AK N');
fs.writeFileSync(path.join(__dirname, 'fixtures/real2.hotel.xlsx'), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log('fixtures/real2.master.xlsx + real2.hotel.xlsx ready');

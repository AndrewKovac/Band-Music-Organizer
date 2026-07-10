// Fixture real6: the reported grey-wash bug — hotel sheet dates that are BARE
// DAY NUMBERS ("27", "28"). Resolving each one to the date nearest today read
// end-of-month numbers as LAST month (today the 10th: "28" -> June 28, past),
// so bookings still weeks away were washed grey. Rows must be read
// chronologically: only the July 1-2 stay is actually over.
const XLSX = require('./package/dist/xlsx.full.min.js');
const fs = require('fs');
const path = require('path');
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
// today is pinned to 2026-07-10 in expected.json
const hotelRows = [
  ['05:00', '1', '1507', '06:00', '2', '1508', 'Old, Oliver'],       // Jul 1-2: over -> GREY
  ['05:30', '9', '1507', '04:15', '11', '1508', 'Current, Chris'],   // Jul 9-11: in house
  ['05:30', '10', '1507', '03:00', '13', '1508', 'Frank, Future'],   // Jul 10-13
  ['14:00', '27', 'AV10', '10:00', '28', 'AV11', 'Late, Month'],     // Jul 27-28: FUTURE, the bug greyed it
  ['20:00', '30', 'AV20', '09:00', '1', 'AV21', 'Rollover, Ray'],    // Jul 30 - Aug 1: future, co rolls the month
].map((r, i) => [s(LIM), s('LIM'), s(r[0]), s(r[1]), s(r[2]), s(r[3]), s(r[4]), s(r[5]),
  s(r[6]), '', '', s('Pairing short code Y' + i), s('9100100' + i), '', '', '']);
const hwb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(hwb, sheet(HHDR, hotelRows), 'JUL 09 AK N');
fs.writeFileSync(path.join(__dirname, 'fixtures/real6.hotel.xlsx'), XLSX.write(hwb, { type: 'buffer', bookType: 'xlsx' }));
// master covers only the current period (days 9-10), also as day numbers
const masterRows = [
  [s(LIM), s('LIM'), s('05:30'), s('9'), s('1507'), s('04:15'), s('11'), s('1508'),
   s('Current, Chris'), '', '', s('AB11'), ''],
  [s(LIM), s('LIM'), s('05:30'), s('10'), s('1507'), s('03:00'), s('13'), s('1508'),
   s('Frank, Future'), '', '', s('AB22'), ''],
];
const mwb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(mwb, sheet(MHDR, masterRows), 'Hotel Bookings Report');
fs.writeFileSync(path.join(__dirname, 'fixtures/real6.master.xlsx'), XLSX.write(mwb, { type: 'buffer', bookType: 'xlsx' }));
console.log('fixtures/real6 ready');

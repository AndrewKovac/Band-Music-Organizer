// Fixture real3: the reported bug — hotel sheet rows with YEARLESS TEXT dates
// ("9-Jul") whose crews checked in this morning; the master was generated in
// the afternoon so those rows are gone from it. They must be HISTORICAL, not
// cancellations. An evening row missing from the master IS a cancellation.
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
// hotel sheet: ALL dates are yearless text, exactly as reported
const hotelRows = [
  ['05:18', '9-Jul', '1507', '04:15', '11-Jul', '1508', 'Chen, Morning'],   // checked in 05:18 today -> HISTORICAL
  ['08:40', '9-Jul', '2201', '09:00', '10-Jul', '2202', 'Diaz, Early'],     // checked in 08:40 today -> HISTORICAL
  ['23:10', '9-Jul', 'DL151', '19:05', '10-Jul', '5508', 'Evans, Night'],   // tonight, master dropped it -> CANCEL
  ['05:30', '10-Jul', '1507', '03:00', '13-Jul', '1508', 'Frank, Future'],  // tomorrow, on master -> UNCHANGED
].map((r, i) => [s(LIM), s('LIM'), s(r[0]), s(r[1]), s(r[2]), s(r[3]), s(r[4]), s(r[5]),
  s(r[6]), '', '', s('Pairing short code Z' + i), s('9000100' + i), '', '', '']);
const hwb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(hwb, sheet(HHDR, hotelRows), 'JUL 08 AK N');
fs.writeFileSync(path.join(__dirname, 'fixtures/real3.hotel.xlsx'), XLSX.write(hwb, { type: 'buffer', bookType: 'xlsx' }));
// master generated in the afternoon: morning rows + tonight's dropped row are gone
const masterRows = [
  [s(LIM), s('LIM'), s('05:30'), s('10-Jul'), s('1507'), s('03:00'), s('13-Jul'), s('1508'),
   s('Frank, Future'), '', '', s('TT01'), ''],
];
const mwb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(mwb, sheet(MHDR, masterRows), 'Hotel Bookings Report');
fs.writeFileSync(path.join(__dirname, 'fixtures/real3.master.xlsx'), XLSX.write(mwb, { type: 'buffer', bookType: 'xlsx' }));
console.log('fixtures/real3 ready');

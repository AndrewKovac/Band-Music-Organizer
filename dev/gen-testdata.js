// Builds realistic master.xlsx and hotel.xlsx test files, with mixed cell
// formats (real Excel date/time cells in the master, text in the hotel sheet).
const XLSX = require('./package/dist/xlsx.full.min.js');
const fs = require('fs');

function dcell(y, m, d) { // real Excel date cell, DDMMM display format
  return { t: 'n', v: 25569 + Math.round(Date.UTC(y, m - 1, d) / 86400000), z: 'ddmmm' };
}
function tcell(h, mi) {  // real Excel time cell
  return { t: 'n', v: (h * 60 + mi) / 1440, z: 'hh:mm' };
}
function s(v) { return { t: 's', v: String(v) }; }

const MHDR = ['Hotel Name', 'Hotel Location', 'Check in Time', 'Check in Date', 'Inbound Flight',
  'Check out Time', 'Check out Date', 'Outbound Flight', 'Name 1', 'Name 2', 'Name 3', 'Pairing Code', 'Notes'];
const HHDR = MHDR.slice(0, 12).concat(['Confirmation 1', 'Confirmation 2', 'Confirmation 3', 'Notes']);

const AG = 'Airport Grand Anchorage', HF = 'Hilton Fairbanks';

// ---- master rows (all hotels mixed together) ----
const masterRows = [
  // unchanged booking
  [s(AG), s('Anchorage'), tcell(14, 0), dcell(2026, 7, 25), s('AB941'), tcell(9, 0), dcell(2026, 7, 26), s('AB942'), s('SMITH JOHN'), s('DOE JANE'), '', s('P4411'), s('')],
  // other hotel — must be filtered out
  [s(HF), s('Fairbanks'), tcell(11, 0), dcell(2026, 7, 25), s('AB801'), tcell(8, 0), dcell(2026, 7, 26), s('AB802'), s('FRANKLIN FAY'), '', '', s('P9001'), s('')],
  // check-in time changed (hotel has 15:00)
  [s(AG), s('Anchorage'), tcell(16, 30), dcell(2026, 7, 25), s('AB955'), tcell(9, 0), dcell(2026, 7, 26), s('AB956'), s('BROWN BILL'), '', '', s('P4412'), s('')],
  // FO name changed (hotel has BAKER BOB) + pairing code changed
  [s(AG), s('Anchorage'), tcell(14, 0), dcell(2026, 7, 26), s('AB960'), tcell(9, 30), dcell(2026, 7, 27), s('AB961'), s('ADAMS ALICE'), s('CARTER CHRIS'), '', s('P5520'), s('')],
  // check-in date shifted one day (hotel has 27JUL), same crew + flight
  [s(AG), s('Anchorage'), tcell(13, 15), dcell(2026, 7, 28), s('AB980'), tcell(10, 0), dcell(2026, 7, 29), s('AB981'), s('GARCIA GLEN'), '', '', s('P4477'), s('')],
  // brand-new booking, not on hotel sheet
  [s(AG), s('Anchorage'), tcell(18, 45), dcell(2026, 7, 27), s('AB970'), tcell(7, 30), dcell(2026, 7, 28), s('AB971'), s('WILSON WENDY'), s('YOUNG YURI'), '', s('P6100'), s('Late arrival')],
  // another other-hotel row
  [s(HF), s('Fairbanks'), tcell(12, 0), dcell(2026, 7, 28), s('AB803'), tcell(9, 0), dcell(2026, 7, 29), s('AB804'), s('IRVING IKE'), '', '', s('P9002'), s('')],
];

// ---- hotel sheet rows (text-formatted dates/times, as hotels often send) ----
const hotelRows = [
  [s(AG), s('Anchorage'), s('14:00'), s('25JUL'), s('AB941'), s('09:00'), s('26JUL'), s('AB942'), s('SMITH JOHN'), s('DOE JANE'), '', s('P4411'), s('CNF88211'), s('CNF88212'), '', s('')],
  [s(AG), s('Anchorage'), s('15:00'), s('25JUL'), s('AB955'), s('09:00'), s('26JUL'), s('AB956'), s('BROWN BILL'), '', '', s('P4412'), s('0072155'), '', '', s('')],
  [s(AG), s('Anchorage'), s('14:00'), s('26JUL'), s('AB960'), s('09:30'), s('27JUL'), s('AB961'), s('ADAMS ALICE'), s('BAKER BOB'), '', s('P5519'), s('CNF88613'), s('CNF88614'), '', s('')],
  [s(AG), s('Anchorage'), s('13:15'), s('27JUL'), s('AB980'), s('10:00'), s('29JUL'), s('AB981'), s('GARCIA GLEN'), '', '', s('P4477'), s('CNF90112'), '', '', s('')],
  // cancelled: on hotel sheet, gone from master
  [s(AG), s('Anchorage'), s('12:00'), s('25JUL'), s('AB990'), s('09:00'), s('26JUL'), s('AB991'), s('MILLER MIKE'), '', '', s('P3300'), s('CNF77440'), '', '', s('')],
  // non-pilot guest: NOT on master, must NOT be auto-cancelled
  [s(AG), s('Anchorage'), s('16:00'), s('25JUL'), '', s('11:00'), s('28JUL'), '', s('LARSSON LENA (LOADMASTER)'), '', '', '', s('CNF70001'), '', '', s('Company guest')],
  // beyond the master window (master covers 25-28JUL): must be OUT OF RANGE, not cancelled —
  // including a crew member (Brown) who also has an in-window stay
  [s(AG), s('Anchorage'), s('14:30'), s('30JUL'), s('AB957'), s('09:00'), s('31JUL'), s('AB958'), s('BROWN BILL'), '', '', s('P4499'), s('CNF91555'), '', '', s('')],
  [s(AG), s('Anchorage'), s('17:00'), s('02AUG'), s('AB965'), s('10:00'), s('03AUG'), s('AB966'), s('PETERS PAUL'), '', '', s('P4520'), s('CNF92001'), '', '', s('')],
];

function toSheet(hdr, rows) {
  const ws = {};
  hdr.forEach((h, c) => { ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h }; });
  rows.forEach((row, r) => row.forEach((cell, c) => {
    if (cell && cell.v !== undefined && cell.v !== '') ws[XLSX.utils.encode_cell({ r: r + 1, c })] = cell;
  }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: hdr.length - 1 } });
  return ws;
}

const mwb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(mwb, toSheet(MHDR, masterRows), 'Master');
fs.writeFileSync(__dirname + '/master.xlsx', XLSX.write(mwb, { type: 'buffer', bookType: 'xlsx' }));

const hwb = XLSX.utils.book_new();
// older page first, current page last — tool should default to the LAST tab
XLSX.utils.book_append_sheet(hwb, toSheet(HHDR, hotelRows.slice(0, 3)), '28JUN AKN');
XLSX.utils.book_append_sheet(hwb, toSheet(HHDR, hotelRows), '01JUL AKN');
fs.writeFileSync(__dirname + '/hotel.xlsx', XLSX.write(hwb, { type: 'buffer', bookType: 'xlsx' }));

console.log('test files written');

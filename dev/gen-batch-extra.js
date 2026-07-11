// Extra e2e inputs for batch night mode:
//  - hotel-nochange.xlsx: a hotel sheet that matches the e2e master exactly
//    (same crews/dates/times/flights) so the batch flags it "no changes".
//  - base-chg.msg / base-noc.msg: synthetic Outlook-style base emails with
//    the [NAME] token, built stream-by-stream like the unit-test bases.
const C = require('./core.js');
const X = global.XLSX;
const fs = require('fs');
const path = require('path');

// ---- no-change hotel sheet derived from the real e2e master ----
const mwb = X.read(fs.readFileSync(path.join(__dirname, 'master.xlsx')), { type: 'buffer' });
const grid = C.sheetToGrid(mwb.Sheets[mwb.SheetNames[0]]);
const mRows = C.parseRows(grid, 'master').filter(r => /ANCHORAGE/i.test(r.disp[0] || ''));
if (!mRows.length) throw new Error('no Anchorage rows in master.xlsx');
const HHDR = ['Hotel Name', 'Hotel Location', 'Check in Time', 'Check in Date', 'Inbound Flight',
  'Check out Time', 'Check out Date', 'Outbound Flight', 'Name 1', 'Name 2', 'Name 3',
  'Pairing Code', 'Confirmation 1', 'Confirmation 2', 'Confirmation 3', 'Notes'];
const ws = {};
HHDR.forEach((h, c) => { ws[X.utils.encode_cell({ r: 0, c })] = { t: 's', v: h }; });
mRows.forEach((r, i) => {
  for (let c = 0; c < 12; c++) {
    const v = r.disp[c];
    if (v) ws[X.utils.encode_cell({ r: i + 1, c })] = { t: 's', v: String(v) };
  }
  ws[X.utils.encode_cell({ r: i + 1, c: 12 })] = { t: 's', v: String(900100 + i) };
  if (r.notes) ws[X.utils.encode_cell({ r: i + 1, c: 15 })] = { t: 's', v: String(r.notes) };
});
ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: mRows.length, c: 15 } });
const hwb = X.utils.book_new();
X.utils.book_append_sheet(hwb, ws, 'JUL 09 AK N');
fs.writeFileSync(path.join(__dirname, 'hotel-nochange.xlsx'), X.write(hwb, { type: 'buffer', bookType: 'xlsx' }));

// ---- synthetic base .msg files ----
function baseMsg(subject, body, html) {
  const cfb = X.CFB.utils.cfb_new();
  const put = (p, b) => X.CFB.utils.cfb_add(cfb, p, Array.from(b));
  const subj = C.msgU16(subject), cls = C.msgU16('IPM.Note'), bod = C.msgU16(body);
  const h = C.msgLatinBytes(html);
  put('/__substg1.0_0037001F', subj);
  put('/__substg1.0_001A001F', cls);
  put('/__substg1.0_1000001F', bod);
  put('/__substg1.0_10130102', h);
  const rows = [
    C.propRowFixed(0x0E070003, 0x1),
    C.propRowVar(0x0037001F, C.propVarSize(0x0037001F, subj.length)),
    C.propRowVar(0x001A001F, C.propVarSize(0x001A001F, cls.length)),
    C.propRowVar(0x1000001F, C.propVarSize(0x1000001F, bod.length)),
    C.propRowVar(0x10130102, h.length)
  ];
  put('/__properties_version1.0', C.propsBuild(new Uint8Array(32), rows));
  put('/__nameid_version1.0/__substg1.0_00020102', [0, 0, 0, 0]);
  return Buffer.from(X.CFB.write(cfb, { type: 'buffer' }));
}
fs.writeFileSync(path.join(__dirname, 'base-chg.msg'), baseMsg(
  'Crew accommodation update',
  'Good evening,\nPlease find tonight\'s updated rooming list attached.\nRegards,\n[NAME]\nCargojet Crew Scheduling',
  '<html><body><p>Good evening,</p><p>Please find tonight\'s <b>updated rooming list</b> attached.</p><p>Regards,<br>[NAME]<br>Cargojet Crew Scheduling</p></body></html>'
));
fs.writeFileSync(path.join(__dirname, 'base-noc.msg'), baseMsg(
  'Crew accommodation - no changes tonight',
  'Good evening,\nNo changes to the rooming list tonight.\nRegards,\n[NAME]\nCargojet Crew Scheduling',
  '<html><body><p>Good evening,</p><p><b>No changes</b> to the rooming list tonight.</p><p>Regards,<br>[NAME]<br>Cargojet Crew Scheduling</p></body></html>'
));
console.log('batch extras ready: hotel-nochange.xlsx (' + mRows.length + ' rows), base-chg.msg, base-noc.msg');

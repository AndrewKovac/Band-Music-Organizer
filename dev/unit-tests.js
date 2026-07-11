const assert = require('assert');
const C = require('./core.js');

let n = 0;
function eq(actual, expected, label) {
  n++;
  assert.deepStrictEqual(actual, expected, label + '\n  got:      ' + JSON.stringify(actual) + '\n  expected: ' + JSON.stringify(expected));
}

/* ---- normalisers ---- */
eq(C.nameKey('  Smith,  John '), 'JOHN SMITH', 'nameKey punctuation/order');
eq(C.nameKey('JOHN SMITH'), C.nameKey('Smith John'), 'nameKey order-insensitive');
eq(C.canonFlight('AB 0941'), 'AB941', 'flight zeros/spaces');
eq(C.canonFlight('ab941'), 'AB941', 'flight case');
eq(C.canonFlight('941'), '941', 'flight bare number');

eq(C.parseDateText('25JUL'), '0000-07-25', 'DDMMM no year');
eq(C.parseDateText('25JUL26'), '2026-07-25', 'DDMMMYY');
eq(C.parseDateText('25 JUL 2026'), '2026-07-25', 'DD MMM YYYY');
eq(C.parseDateText('JUL 25, 2026'), '2026-07-25', 'MMM DD YYYY');
eq(C.parseDateText('7/25/26'), '2026-07-25', 'US m/d/y');
eq(C.parseDateText('25/7/26'), '2026-07-25', 'd/m/y');
eq(C.parseDateText('2026-07-25'), '2026-07-25', 'ISO');
eq(C.dateEq('0000-07-25', '2026-07-25'), true, 'dateEq yearless');
eq(C.dateEq('2026-07-25', '2026-07-26'), false, 'dateEq different');
eq(C.canonDate({ t: 'n', v: 46228 }), '2026-07-25', 'excel serial 25 Jul 2026');

eq(C.parseTimeText('1400'), '14:00', 'HHMM');
eq(C.parseTimeText('2:30 PM'), '14:30', '12h pm');
eq(C.parseTimeText('14:30'), '14:30', 'colon');
eq(C.parseTimeText('0900L'), '09:00', 'local suffix');
eq(C.canonTime({ t: 'n', v: 0.604166666666667 }), '14:30', 'excel time fraction');
eq(C.canonTime({ t: 'n', v: 1430 }), '14:30', 'numeric HHMM cell');

eq(C.computeTabName(new Date(2026, 6, 4), 'ak', 'n'), 'JUL 04 AK N', 'tab name matches real workbook convention');
eq(C.computeTabName(new Date(2026, 6, 4), '', ''), 'JUL 04', 'tab name without initials/shift');

/* pairing phrase normalization (real hotel sheets carry a boilerplate prefix) */
eq(C.canonPairing('Pairing short code 97PR'), '97PR', 'pairing phrase stripped');
eq(C.canonPairing('Pairing Shortcode DRCB'), 'DRCB', 'shortcode variant stripped');
eq(C.canonPairing('97PR'), '97PR', 'bare code untouched');
eq(C.canonPairing(''), '', 'empty pairing');

/* past guard */
eq(C.isPastISO('2026-07-04', '2026-07-09'), true, 'yesterday is past');
eq(C.isPastISO('2026-07-09', '2026-07-09'), false, 'today is not past');
eq(C.isPastISO('2026-07-22', '2026-07-09'), false, 'future is not past');
eq(C.isPastISO('0000-07-04', '2026-07-09'), false, 'yearless date is never past');
eq(C.isPastISO('D:04', '2026-07-09'), false, 'day-only date is never past');
eq(C.isPastISO('TXT:4TH ISH', '2026-07-09'), false, 'unparsed date is never past');

/* date+time-aware past: a check-in earlier today is locked too */
eq(C.isPastDT('2026-07-09', '05:18', '2026-07-09', '14:00'), true, 'checked in this morning -> past');
eq(C.isPastDT('2026-07-09', '23:10', '2026-07-09', '14:00'), false, 'tonight -> not past');
eq(C.isPastDT('2026-07-09', '', '2026-07-09', '14:00'), false, 'today with unknown time stays actionable');
eq(C.isPastDT('2026-07-08', '23:59', '2026-07-09', '00:01'), true, 'yesterday always past');
eq(C.isPastDT('2026-07-10', '00:01', '2026-07-09', '23:59'), false, 'tomorrow never past');

/* literal date resolution: yearless text and day numbers become real dates */
eq(C.resolveToDate('0000-07-09', '2026-07-09'), '2026-07-09', 'yearless 9-Jul resolves to this 9-Jul');
eq(C.resolveToDate('0000-12-30', '2027-01-02'), '2026-12-30', 'yearless near new year picks last year');
eq(C.resolveToDate('D:09', '2026-07-09'), '2026-07-09', 'bare day 9 resolves to today');
eq(C.resolveToDate('D:28', '2026-07-05'), '2026-06-28', 'bare day 28 early in month -> late last month');
eq(C.resolveToDate('D:22', '2026-07-09'), '2026-07-22', 'bare day 22 -> later this month');
eq(C.resolveToDate('TXT:WHENEVER', '2026-07-09'), null, 'unreadable stays unresolved');
/* the reported bug: hotel sheet says "9-Jul" (no year), crew checked in this morning */
eq(C.isPastDT(C.parseDateText('9-Jul'), '05:18', '2026-07-09', '14:00'), true,
   'morning-of-the-9th with yearless text date IS past by the afternoon');
eq(C.isPastDT(C.parseDateText('9-Jul'), '23:10', '2026-07-09', '14:00'), false,
   'tonight-of-the-9th yearless is still actionable');
eq(C.isPastDT('D:9', '05:18', '2026-07-09', '14:00'), true, 'day-number date also resolves and locks');

/* ---- row fixtures (parsed-rec shape) ---- */
function rec(kind, o) {
  const names = o.names.concat(['', '', '']).slice(0, 3);
  const disp = kind === 'hotel'
    ? [o.hotel || 'AIRPORT GRAND', 'ANC', o.ciT || '', o.ciD || '', o.inF || '', o.coT || '', o.coD || '', o.outF || '',
       names[0], names[1], names[2], o.pair || '', (o.confs || [])[0] || '', (o.confs || [])[1] || '', (o.confs || [])[2] || '', o.notes || '']
    : [o.hotel || 'AIRPORT GRAND', 'ANC', o.ciT || '', o.ciD || '', o.inF || '', o.coT || '', o.coD || '', o.outF || '',
       names[0], names[1], names[2], o.pair || '', o.notes || ''];
  const r = {
    srcRow: o.srcRow || 0, kind, disp,
    hotel: C.canonText(disp[0]),
    ciTime: C.parseTimeText(o.ciT || ''), ciDate: C.parseDateText(o.ciD || ''), inFlt: C.canonFlight(o.inF || ''),
    coTime: C.parseTimeText(o.coT || ''), coDate: C.parseDateText(o.coD || ''), outFlt: C.canonFlight(o.outF || ''),
    names, nameKeys: names.map(C.nameKey), pairing: C.canonPairing(o.pair || ''),
    notes: o.notes || ''
  };
  if (kind === 'hotel') r.confs = o.confs || ['', '', ''];
  return r;
}

/* name change: same flight+date, captain stays, FO changes */
{
  const m = rec('master', { names: ['ADAMS ALICE', 'CARTER CHRIS'], ciD: '25JUL', inF: 'AB941', ciT: '1400' });
  const h = rec('hotel',  { names: ['ADAMS ALICE', 'BAKER BOB'],   ciD: '25JUL', inF: 'AB941', ciT: '1400', confs: ['111', '222', ''] });
  const res = C.matchRows([m], [h]);
  eq(res.matches.length, 1, 'name-change pair matches');
  const items = C.diffPair(m, h);
  eq(items.length, 1, 'exactly one change item');
  eq(items[0].cat, 'name', 'is a name change');
  eq(items[0].col, 9, 'slot 2 replaced (conf 222 stays aligned)');
  eq(items[0].newText, 'CARTER CHRIS', 'new name');
}

/* schedule change: same crew, time changed */
{
  const m = rec('master', { names: ['BROWN BILL'], ciD: '25JUL', inF: 'AB955', ciT: '16:30' });
  const h = rec('hotel',  { names: ['BROWN BILL'], ciD: '25JUL', inF: 'AB955', ciT: '1500' });
  const res = C.matchRows([m], [h]);
  eq(res.matches.length, 1, 'schedule pair matches');
  const items = C.diffPair(m, h);
  eq(items.map(i => [i.col, i.cat]), [[2, 'schedule']], 'only check-in time flagged');
}

/* date moved a day: same crew + flight */
{
  const m = rec('master', { names: ['GARCIA GLEN'], ciD: '28JUL', inF: 'AB980' });
  const h = rec('hotel',  { names: ['GARCIA GLEN'], ciD: '27JUL', inF: 'AB980' });
  const res = C.matchRows([m], [h]);
  eq(res.matches.length, 1, 'date-shift still matches (crew+flight)');
  eq(C.diffPair(m, h).map(i => i.col), [3], 'check-in date flagged');
}

/* pairing code change alone must NOT split the match — and is NOT a change */
{
  const m = rec('master', { names: ['SMITH JOHN', 'DOE JANE'], ciD: '25JUL', inF: 'AB941', pair: 'P999' });
  const h = rec('hotel',  { names: ['SMITH JOHN', 'DOE JANE'], ciD: '25JUL', inF: 'AB941', pair: 'P123' });
  const res = C.matchRows([m], [h]);
  eq(res.matches.length, 1, 'pairing change still matches');
  eq(C.diffPair(m, h).length, 0, 'a pairing-code difference alone is never proposed');
}

/* new + cancelled + non-pilot */
{
  const m1 = rec('master', { names: ['WILSON WENDY'], ciD: '27JUL', inF: 'AB970' });
  const h1 = rec('hotel',  { names: ['MILLER MIKE'], ciD: '25JUL', inF: 'AB990', srcRow: 5 });
  const h2 = rec('hotel',  { names: ['LARRY LOADMASTER'], ciD: '25JUL', inF: '', srcRow: 6 });
  const res = C.matchRows([m1], [h1, h2]);
  eq(res.matches.length, 0, 'nothing matches');
  eq(res.newMaster.length, 1, 'one new booking');
  eq(res.cancelledHotel.length, 2, 'two possible cancellations');
}

/* two stays, same crew, different dates: must pair correctly, not cross */
{
  const mA = rec('master', { names: ['SMITH JOHN'], ciD: '25JUL', inF: 'AB941' });
  const mB = rec('master', { names: ['SMITH JOHN'], ciD: '29JUL', inF: 'AB945' });
  const hA = rec('hotel',  { names: ['SMITH JOHN'], ciD: '25JUL', inF: 'AB941', srcRow: 1 });
  const hB = rec('hotel',  { names: ['SMITH JOHN'], ciD: '29JUL', inF: 'AB945', srcRow: 2 });
  const res = C.matchRows([mA, mB], [hB, hA]);
  eq(res.matches.length, 2, 'both stays matched');
  const pair = res.matches.map(x => [x.m.ciDate, x.h.ciDate]);
  pair.forEach(p => eq(p[0], p[1], 'stays paired by date, not crossed'));
}

/* full crew swap on same flight/date (unique) -> name changes, not new+cancel */
{
  const m = rec('master', { names: ['NEWguy NED', 'NOVAK NIA'], ciD: '25JUL', inF: 'AB941' });
  const h = rec('hotel',  { names: ['OLDMAN OTTO', 'OLSEN OLGA'], ciD: '25JUL', inF: 'AB941', confs: ['1', '2', ''] });
  const res = C.matchRows([m], [h]);
  eq(res.matches.length, 1, 'crew swap matched via tier 6');
  const items = C.diffPair(m, h);
  eq(items.filter(i => i.cat === 'name').length, 2, 'both names proposed for change');
}

/* 2 -> 3 crew: third name added, conf slot marked NEW */
{
  const m = rec('master', { names: ['ADAMS ALICE', 'BAKER BOB', 'CARTER CHRIS'], ciD: '25JUL', inF: 'AB941' });
  const h = rec('hotel',  { names: ['ADAMS ALICE', 'BAKER BOB'], ciD: '25JUL', inF: 'AB941', confs: ['1', '2', ''] });
  const items = C.diffPair(m, h);
  eq(items.length, 1, 'one add item');
  eq(items[0].sub, 'add', 'is an add');
  eq(items[0].confCol, 14, 'conf 3 to be marked NEW');
}

/* output builder */
{
  const grid = [
    [{ v: 'Hotel Name' }, { v: 'Hotel Location' }, { v: 'Check in Time' }, { v: 'Check in Date' }, { v: 'Inbound Flight' }, { v: 'Check out Time' }, { v: 'Check out Date' }, { v: 'Outbound Flight' }, { v: 'Name 1' }, { v: 'Name 2' }, { v: 'Name 3' }, { v: 'Pairing Code' }, { v: 'Confirmation 1' }, { v: 'Confirmation 2' }, { v: 'Confirmation 3' }, { v: 'Notes' }],
    [{ v: 'AIRPORT GRAND' }, { v: 'ANC' }, { v: '1500' }, { v: '25JUL' }, { v: 'AB955' }, { v: '0900' }, { v: '26JUL' }, { v: 'AB956' }, { v: 'BROWN BILL' }, null, null, { v: 'P1' }, { v: '007123' }, null, null, null],
    [{ v: 'AIRPORT GRAND' }, { v: 'ANC' }, { v: '1200' }, { v: '25JUL' }, { v: 'AB990' }, { v: '0900' }, { v: '26JUL' }, { v: 'AB991' }, { v: 'MILLER MIKE' }, null, null, { v: 'P2' }, { v: '88214' }, null, null, null]
  ];
  const newRec = rec('master', { names: ['WILSON WENDY'], ciD: '27JUL', inF: 'AB970', notes: 'late arrival' });
  const out = C.buildOutput(grid,
    [{ srcRow: 1, items: [{ col: 2, newText: '16:30', cat: 'schedule' }] }],
    [2], [newRec], [{ srcRow: 1, ciDate: '' }, { srcRow: 2, ciDate: '' }]);
  eq(out.length, 4, 'rows: header + 2 data + 1 new (no footer)');
  eq(out[1][2].text, '16:30', 'time updated');
  eq(out[1][2].fill, '#ffff00', 'yellow fill');
  eq(out[2][0].fill, '#ff0000', 'cancel red');
  eq(out[2][0].strike, true, 'cancel strike');
  eq(out[3][8].text, 'WILSON WENDY', 'new row name');
  eq(out[3][12].text, 'NEW', 'new row conf NEW');
  eq(out[3][15].text, 'late arrival', 'new row notes mapped M->P');
  eq(out[3][0].fill, '#b5e6a2', 'new row green');
  const html = C.outputToClipboardHtml(out);
  assert(html.includes("mso-number-format:'\\@'"), 'conf cols forced text');
  assert(html.includes('background-color:#ffff00'), 'clipboard has Excel-safe yellow');
  assert(html.includes('bgcolor="#ffff00"'), 'clipboard has legacy bgcolor attr');
  assert(html.includes('<s>'), 'strikethrough doubled as <s> tags');
  assert(html.includes('text-decoration:line-through'), 'clipboard has strike');
}

/* header detection: needs 2+ exact header labels, so data rows survive */
eq(C.isHeaderGridRow([{ v: 'Hotel Name' }, { v: 'Hotel Location' }]), true, 'header row detected');
eq(C.isHeaderGridRow([{ v: 'AIRPORT GRAND' }, { v: 'ANC' }]), false, 'data row not header');
eq(C.isHeaderGridRow([{ v: 'AIRPORT GRAND' }, { v: 'ANC' }, { v: '14:00' }, { v: '25JUL' }, null, null, null, null,
  { v: 'SMITH JOHN' }, null, null, null, null, null, null, { v: 'early check in requested' }]),
  false, 'booking row with "check in" in notes is NOT a header');
eq(C.isHeaderGridRow([{ v: 'Notes' }, { v: 'AIRPORT GRAND' }]), false, 'single header-ish word is not enough');

/* forward-fill: master rows with blank hotel (merged cells) inherit the one above */
{
  const grid = [
    [{ v: 'Hotel Name' }, { v: 'Hotel Location' }, { v: 'Check in Time' }, { v: 'Check in Date' }],
    [{ v: 'Airport Grand Anchorage' }, { v: 'ANC' }, { v: '14:00' }, { v: '25JUL' }, { v: 'AB941' }, null, null, null, { v: 'SMITH JOHN' }],
    [null, null, { v: '15:00' }, { v: '25JUL' }, { v: 'AB955' }, null, null, null, { v: 'BROWN BILL' }],
    [{ v: 'Hilton Fairbanks' }, { v: 'FAI' }, { v: '11:00' }, { v: '25JUL' }, { v: 'AB801' }, null, null, null, { v: 'FRANKLIN FAY' }]
  ];
  const rows = C.parseRows(grid, 'master');
  eq(rows.length, 3, 'forward-fill: three data rows parsed');
  eq(rows[1].hotel, rows[0].hotel, 'blank hotel cell inherits hotel above');
  eq(rows[2].hotel === rows[0].hotel, false, 'next named hotel resets the fill');
}

/* huge stray !ref must not freeze: capped at 5000 rows */
{
  const ws = { '!ref': 'A1:P1048576', A1: { v: 'Airport Grand' }, I1: { v: 'SMITH JOHN' } };
  const g = C.sheetToGrid(ws);
  eq(g.length, 5000, 'grid capped at 5000 rows');
  eq(g._truncated, 1048576, 'truncation flagged with real row count');
}

/* master date window: bookings outside it must never become cancellations */
{
  const mk = d => ({ ciDate: C.parseDateText(d) });
  const win = C.masterDateWindow([mk('04JUL26'), mk('07JUL26'), mk('10JUL26')]);
  eq(win, { md: false, min: '2026-07-04', max: '2026-07-10' }, 'window from full dates');
  eq(C.inWindow(win, C.parseDateText('05JUL26')), true, 'inside window');
  eq(C.inWindow(win, C.parseDateText('11JUL26')), false, '11th outside 4-10 window');
  eq(C.inWindow(win, C.parseDateText('30JUL26')), false, '30th outside window');
  eq(C.inWindow(win, C.parseDateText('03JUL26')), false, 'before window is outside too');
  eq(C.inWindow(win, C.parseDateText('11JUL')), false, 'yearless hotel date vs dated window');
  eq(C.inWindow(win, C.parseDateText('05JUL')), true, 'yearless inside');
  eq(C.inWindow(win, ''), true, 'unknown date stays in scope for human review');
  eq(C.inWindow(null, C.parseDateText('30JUL26')), true, 'no window known -> everything in scope');
  eq(C.fmtWindow(win), '04JUL–10JUL', 'window formatted for display');

  const winY = C.masterDateWindow([mk('28DEC26'), mk('03JAN27')]);
  eq(C.inWindow(winY, C.parseDateText('30DEC')), true, 'year-end wrap: 30DEC inside 28DEC-03JAN');
  eq(C.inWindow(winY, C.parseDateText('15JAN')), false, 'year-end wrap: 15JAN outside');

  const winML = C.masterDateWindow([mk('04JUL'), mk('10JUL')]);
  eq(winML.md, true, 'yearless master -> month-day window');
  eq(C.inWindow(winML, C.parseDateText('11JUL')), false, 'yearless window excludes 11th');
}

/* day-only dates ("4" in the date column — how real masters often look) */
eq(C.parseDateText('4'), 'D:04', 'bare day number');
eq(C.parseDateText('25th'), 'D:25', 'ordinal day');
eq(C.dateEq('D:04', C.parseDateText('04JUN26')), true, 'day-only equals dated same day');
eq(C.dateEq('D:04', C.parseDateText('05JUN26')), false, 'day-only differs across days');
eq(C.dateCmp('D:04', 'D:07') < 0, true, 'day-only ordering');

/* editable window from the two inputs */
{
  const w = C.windowFromInputs(C.parseDateText('04JUL26'), C.parseDateText('10JUL26'));
  eq(C.inWindow(w, C.parseDateText('11JUL26')), false, 'input window excludes the 11th');
  eq(C.inWindow(w, 'D:07'), true, 'day-only booking inside single-month window');
  eq(C.inWindow(w, 'D:11'), false, 'day-only booking outside single-month window');
  const open = C.windowFromInputs(C.parseDateText('04JUL26'), '');
  eq(C.inWindow(open, C.parseDateText('30AUG26')), true, 'open-ended top');
  eq(C.inWindow(open, C.parseDateText('01JUL26')), false, 'open-ended still bounds the bottom');
  const dayW = C.windowFromInputs(C.parseDateText('4'), C.parseDateText('10'));
  eq(dayW.day, true, 'day-only inputs make a day window');
  eq(C.inWindow(dayW, 'D:11'), false, 'day window excludes day 11');
  eq(C.inWindow(dayW, C.parseDateText('07JUL26')), true, 'dated booking inside day window');
  eq(C.windowFromInputs('', ''), null, 'blank inputs -> no window');
  eq(C.fmtWindow(dayW), 'days 04–10', 'day window formatted');
}

/* chronological insertion of approved new bookings */
{
  const hRows = [
    { srcRow: 1, ciDate: C.parseDateText('25JUL26') },
    { srcRow: 2, ciDate: C.parseDateText('30JUL26') }
  ];
  const newRec = rec('master', { names: ['WILSON WENDY'], ciD: '27JUL26', inF: 'AB970' });
  eq(C.insertionSrcRow(newRec, hRows), 2, 'new 27JUL row goes before the 30JUL row');
  const grid = [
    [{ v: 'Hotel Name' }, { v: 'Hotel Location' }, { v: 'Check in Time' }, { v: 'Check in Date' }],
    [{ v: 'AG' }, { v: 'ANC' }, { v: '14:00' }, { v: '25JUL26' }, null, null, null, null, { v: 'AAA' }],
    [{ v: 'AG' }, { v: 'ANC' }, { v: '15:00' }, { v: '30JUL26' }, null, null, null, null, { v: 'BBB' }]
  ];
  const out = C.buildOutput(grid, [], [], [newRec], hRows);
  eq(out.length, 4, 'header + 2 rows + inserted new (no footer)');
  eq(out[2][8].text, 'WILSON WENDY', 'new row inserted at index 2 (before 30JUL)');
  eq(out[3][8].text, 'BBB', '30JUL row pushed down and stays last');
}

/* pairing text helpers */
eq(C.pairingBothText('ABCD', 'DCBA'), 'ABCD, DCBA', 'combined-code text');
{
  const m = rec('master', { names: ['SMITH JOHN'], ciD: '25JUL', inF: 'AB941', pair: 'DCBA' });
  const h = rec('hotel',  { names: ['SMITH JOHN'], ciD: '25JUL', inF: 'AB941', pair: 'ABCD' });
  eq(C.diffPair(m, h).length, 0, 'ordinary code churn produces no proposal at all');
}

/* clipboard carries the paste geometry */
/* trailing notes/footers in the source are dropped; nothing is appended */
{
  const grid = [
    [{ v: 'Hotel Name' }, { v: 'Hotel Location' }],
    [{ v: 'AG' }, { v: 'ANC' }, { v: '14:00' }, { v: '25JUL26' }, null, null, null, null, { v: 'SMITH JOHN' }],
    [{ v: 'Booked by front desk — do not modify' }],
    [{ v: 'old footer 2' }]
  ];
  const out = C.buildOutput(grid, [], [], [], [{ srcRow: 1, ciDate: C.parseDateText('25JUL26') }]);
  eq(out.length, 2, 'old footers dropped: header + data, nothing appended');
}

{
  const out = C.buildOutput([[{ v: 'X' }]], [], [], []);
  const html = C.outputToClipboardHtml(out);
  assert(html.includes('<col width="127">'), 'col A width 127');
  assert(html.includes('<col width="56">'), 'col K width 56');
  assert(html.includes('<col width="162">'), 'col L width 162');
  assert((html.match(/<col width="96">/g) || []).length === 9, 'nine 96px columns (B-F, M-P)');
  assert(html.includes('text-align:left'), 'left justified');
  assert(html.includes('vertical-align:middle'), 'centre vertical');
  assert(html.includes('white-space:normal'), 'wrap on');
}

/* pairing+date matching tier: survives a full crew swap… */
{
  const m = rec('master', { names: ['NEWBIE NED', 'NOVAK NIA'], ciD: '22JUL26', inF: 'DL1', pair: '97PR' });
  const h = rec('hotel',  { names: ['OLDMAN OTTO', 'OLSEN OLGA'], ciD: '22JUL26', inF: 'DL9', pair: 'Pairing short code 97PR' });
  const res = C.matchRows([m], [h]);
  eq(res.matches.length, 1, 'pairing+date matches through full crew swap and flight change');
  eq(/pairing/.test(res.matches[0].why), true, 'matched via the pairing tier');
}
/* …but two rooms sharing one pairing code must not cross-match */
{
  const mA = rec('master', { names: ['ADAMS ALICE'], ciD: '22JUL26', pair: 'P1', srcRow: 10 });
  const mB = rec('master', { names: ['BAKER BOB'],  ciD: '22JUL26', pair: 'P1', srcRow: 11 });
  const hA = rec('hotel',  { names: ['ADAMS ALICE'], ciD: '22JUL26', pair: 'P1', srcRow: 1 });
  const hB = rec('hotel',  { names: ['BAKER BOB'],  ciD: '22JUL26', pair: 'P1', srcRow: 2 });
  const res = C.matchRows([mA, mB], [hB, hA]);
  eq(res.matches.length, 2, 'both rooms matched');
  res.matches.forEach(x => eq(C.nameSetKey(x.m), C.nameSetKey(x.h), 'rooms paired by shared name, not crossed'));
}
/* TBA placeholder crews: exact stay dates pair the rows so names flow in */
{
  const m = rec('master', { names: ['REAL CAPTAIN', 'REAL OFFICER'], ciD: '26JUL26', coD: '27JUL26' });
  const h = rec('hotel',  { names: ['TBA CA', 'TBA FO'], ciD: '26JUL26', coD: '27JUL26', confs: ['111', '222', ''] });
  const res = C.matchRows([m], [h]);
  eq(res.matches.length, 1, 'TBA row matched by exact stay dates');
  const items = C.diffPair(m, h);
  eq(items.filter(i => i.cat === 'name').length, 2, 'both TBA slots become name changes');
}

/* header-driven column mapping: the real VMO layout (Arrive to/from columns
   shift everything, no pairing column, UTC timestamps anchor day numbers) */
{
  const vmo = [
    ['Hotel Name', 'Hotel Location', 'Arrive to', 'Check-in Time', 'Check-in Date', 'Inbound FLT', 'Arrive From',
     'Check-Out Time', 'Check-Out Date', 'Outbound FLT', 'Depart to', 'Name 1', 'Name 2', 'Name 3',
     'Check-in(UTC)', 'Check-Out(UTC)', 'Hotel Location(ICAO)'].map(v => ({ v })),
    [{ v: 'LIM - Pullman Lima Miraflores' }, { v: 'LIM' }, { v: 'LIM' }, { v: '23:10' }, { v: '9' }, { v: 'DL151' }, { v: 'ATL' },
     { v: '19:05' }, { v: '10' }, { v: '5508' }, { v: 'GYE' }, { v: 'Joe, Jeffrey' }, { v: 'Bob, Jason' }, null,
     { v: '2026-07-10T04:10' }, { v: '2026-07-11T00:05' }, { v: 'SPJC' }]
  ];
  const rows = C.parseRows(vmo, 'master');
  eq(rows.length, 1, 'VMO row parsed');
  const r = rows[0];
  eq(r.ciTime, '23:10', 'check-in time from mapped column');
  eq(r.ciDate, '2026-07-09', 'day 9 anchored via UTC (which is already the 10th)');
  eq(r.coDate, '2026-07-10', 'check-out day 10 anchored');
  eq(r.inFlt, 'DL151', 'inbound flight mapped');
  eq(r.names[0], 'Joe, Jeffrey', 'name 1 mapped');
  eq(r.pairing, '', 'no pairing column in VMO');
  eq(r.disp[3], '9-Jul', 'display date rendered like the hotel sheets');
  eq(r.disp[11], '', 'canonical display has empty pairing slot');
}
eq(C.anchorDayToUTC('D:30', '2026-07-01T02:10'), '2026-06-30', 'month rollover: local 30th, UTC 1st');
eq(C.anchorDayToUTC('D:07', '2026-07-07T10:18'), '2026-07-07', 'same-day anchor');
eq(C.anchorDayToUTC('D:07', 'garbage'), null, 'bad UTC text -> null');

/* silent pairing split: two one-name master rows, one two-name hotel row */
{
  const m1 = rec('master', { names: ['Bob, Nancy'], ciD: '8JUL26', coD: '10JUL26', inF: '1507', pair: 'SDKJ', srcRow: 3 });
  const m2 = rec('master', { names: ['Bob, Tai Wai David'], ciD: '8JUL26', coD: '10JUL26', inF: '1507', pair: 'KJWE', srcRow: 4 });
  const h = rec('hotel', { names: ['Bob, Nancy', 'Bob, Tai Wai David'], ciD: '8JUL26', coD: '10JUL26', inF: '1507',
    pair: 'Pairing short code SDKJ', ciT: '05:32', coT: '03:45', srcRow: 2 });
  const res = C.foldSplitPairings(C.matchRows([m1, m2], [h]));
  eq(res.matches.length, 1, 'one match after fold');
  eq(res.newMaster.length, 0, 'no new row proposed for the split pairing');
  const items = C.diffPair(res.matches[0].m, h);
  eq(items.filter(i => i.cat === 'name').length, 0, 'no name changes on the folded row');
  const pairItem = items.find(i => i.col === 11);
  eq(pairItem.newText, 'Pairing short code SDKJ, KJWE', 'combined pairing in the required format');
}

/* check-in immutability: past check-ins locked, check-out still updatable */
{
  const m = rec('master', { names: ['JOE, VINCENT'], ciD: '7JUL26', ciT: '06:00', inF: '1507', coD: '9JUL26', coT: '04:15' });
  const h = rec('hotel',  { names: ['JOE, VINCENT'], ciD: '7JUL26', ciT: '05:18', inF: '1507', coD: '9JUL26', coT: '05:00' });
  const open = C.diffPair(m, h);
  eq(open.map(i => i.label).sort(), ['Check-in time', 'Check-out time'], 'unlocked: both diffs proposed');
  const locked = C.diffPair(m, h, { lockCI: true });
  eq(locked.map(i => i.label), ['Check-out time'], 'locked: check-in change suppressed, check-out kept');
}

/* hotel similarity */
assert(C.hotelSimilarity('Hilton Anchorage', 'HILTON - ANCHORAGE DOWNTOWN') > 0.5, 'similar hotels score high');
assert(C.hotelSimilarity('Hilton Anchorage', 'Marriott Fairbanks') === 0, 'different hotels score 0');

/* pairing writes (split-combined codes) carry no highlight for the hotel */
{
  const m1 = rec('master', { names: ['Bob, Nancy'], ciD: '8JUL26', coD: '10JUL26', inF: '1507', pair: 'SDKJ', srcRow: 3 });
  const m2 = rec('master', { names: ['Bob, Tai Wai David'], ciD: '8JUL26', coD: '10JUL26', inF: '1507', pair: 'KJWE', srcRow: 4 });
  const h = rec('hotel', { names: ['Bob, Nancy', 'Bob, Tai Wai David'], ciD: '8JUL26', coD: '10JUL26', inF: '1507',
    pair: 'Pairing short code SDKJ', srcRow: 1 });
  const res = C.foldSplitPairings(C.matchRows([m1, m2], [h]));
  const items = C.diffPair(res.matches[0].m, h);
  const pi = items.find(i => i.col === 11);
  eq(pi.noFill, true, 'pairing item flagged noFill');
  const grid = [[{ v: 'Hotel Name' }], [{ v: 'H' }, null, null, null, null, null, null, null, null, null, null, { v: 'Pairing short code SDKJ' }]];
  const out = C.buildOutput(grid, [{ srcRow: 1, items: [pi] }], [], [], [{ srcRow: 1, ciDate: '', coDate: '' }]);
  eq(out[1][11].text, 'Pairing short code SDKJ, KJWE', 'combined code written');
  eq(out[1][11].fill, null, 'no highlight on the pairing cell');
}

/* grey wash for bookings that already checked out */
{
  const grid = [
    [{ v: 'Hotel Name' }],
    [{ v: 'H' }, null, null, { v: '6-Jul' }, null, null, { v: '8-Jul' }, null, { v: 'Out, Olivia' }],
    [{ v: 'H' }, null, null, { v: '8-Jul' }, null, null, { v: '9-Jul' }, null, { v: 'Today, Tom' }],
    [{ v: 'H' }, null, null, { v: '10-Jul' }, null, null, { v: '11-Jul' }, null, { v: 'Future, Fred' }],
    [{ v: 'H' }, null, null, { v: '27' }, null, null, { v: '28' }, null, { v: 'Late, Month' }],
    [{ v: 'H' }, null, null, { v: '30' }, null, null, { v: '1' }, null, { v: 'Rollover, Ray' }]
  ];
  const hRows = [
    { srcRow: 1, ciDate: C.parseDateText('6-Jul'), coDate: C.parseDateText('8-Jul') },
    { srcRow: 2, ciDate: C.parseDateText('8-Jul'), coDate: C.parseDateText('9-Jul') },
    { srcRow: 3, ciDate: C.parseDateText('10-Jul'), coDate: C.parseDateText('11-Jul') },
    { srcRow: 4, ciDate: 'D:27', coDate: 'D:28' },
    { srcRow: 5, ciDate: 'D:30', coDate: 'D:1' }
  ];
  const out = C.buildOutput(grid, [], [], [], hRows, '2026-07-09');
  eq(out[1][0].fill, C.C_OLD, 'checked-out row washed grey A...');
  eq(out[1][15].fill, C.C_OLD, '...through P');
  eq(out[2][0].fill, null, 'checks out today -> not grey yet');
  eq(out[3][0].fill, null, 'future stay untouched');
  eq(out[4][0].fill, null, 'FIELD BUG: end-of-month day numbers are NEXT month, not last month');
  eq(out[5][0].fill, null, 'month-rollover check-out (30 -> 1) is future, not past');
}

/* chronological stay resolution: sheets are read in row order */
{
  const st = C.resolveStays([
    { srcRow: 1, ciDate: 'D:1',  coDate: 'D:2' },
    { srcRow: 2, ciDate: 'D:9',  coDate: 'D:11' },
    { srcRow: 3, ciDate: 'D:25', coDate: 'D:26' },
    { srcRow: 4, ciDate: 'D:28', coDate: 'D:2' }
  ], '2026-07-10');
  eq(st[1].ci, '2026-07-01', 'first row anchors nearest to today');
  eq(st[1].co, '2026-07-02', 'check-out follows its check-in');
  eq(st[3].ci, '2026-07-25', 'tie day (15 back / 15 forward) stays chronological');
  eq(st[4].ci, '2026-07-28', 'end-of-month day stays in the current month');
  eq(st[4].co, '2026-08-02', 'check-out rolls into the next month, never backwards');
  eq(C.candDates('0000-06-31', '2026-07-10').length, 0, 'impossible dates dropped');
  eq(JSON.stringify(C.candDates('2026-07-22', '2026-07-10')), '["2026-07-22"]', 'full dates are themselves');
}

/* stale change highlights from earlier pages are not copied forward */
{
  const grid = [
    [{ v: 'Hotel Name' }],
    [{ v: 'H' }, { v: 'x' }, { v: 'y' }]
  ];
  grid._styles = { '1,0': { fill: 'FFFF00' }, '1,1': { fill: 'D9D9D9', strike: true }, '1,2': { fill: 'FF0000' } };
  const out = C.buildOutput(grid, [], [], [], [{ srcRow: 1, ciDate: '', coDate: '' }]);
  eq(out[1][0].fill, null, 'yellow change highlight from an earlier page dropped');
  eq(out[1][1].fill, '#d9d9d9', 'record-keeping grey fill kept');
  eq(out[1][1].strike, true, 'strikethrough kept');
  eq(out[1][2].fill, '#ff0000', 'cancellation red kept');
}

/* THE MONEY GUARD: two separate stays for the same pilot must never merge */
{
  const hA = rec('hotel',  { names: ['Diaz, Pilot'], ciD: '7-Jul', ciT: '05:34', coD: '8-Jul', coT: '05:18', srcRow: 2 });
  const mB = rec('master', { names: ['Diaz, Pilot'], ciD: '10-Jul', ciT: '02:10', coD: '10-Jul', coT: '05:45' });
  const res = C.matchRows([mB], [hA], '2026-07-09');
  eq(res.matches.length, 0, 'stays 3 days apart NEVER match (no silent stay-stretching)');
  eq(res.newMaster.length, 1, 'the 10JUL booking is proposed as NEW');
  eq(res.cancelledHotel.length, 1, 'the 07JUL row goes to the past guard, not a merge');
  eq(C.dateDistDays(C.parseDateText('7-Jul'), C.parseDateText('10-Jul'), '2026-07-09'), 3, 'distance resolved across yearless dates');
  // 1-day schedule slides still match (Garcia case)
  const mG = rec('master', { names: ['GARCIA GLEN'], ciD: '28JUL', inF: 'AB980' });
  const hG = rec('hotel',  { names: ['GARCIA GLEN'], ciD: '27JUL', inF: 'AB980' });
  eq(C.matchRows([mG], [hG], '2026-07-09').matches.length, 1, 'a 1-day slide still matches');
}

/* removals: red, struck, name kept on the sheet */
{
  const m = rec('master', { names: ['ADAMS ALICE'], ciD: '25JUL', inF: 'AB941' });
  const h = rec('hotel',  { names: ['ADAMS ALICE', 'BAKER BOB'], ciD: '25JUL', inF: 'AB941', confs: ['1', '2', ''], srcRow: 1 });
  const items = C.diffPair(m, h);
  eq(items.length, 1, 'one removal item');
  eq(items[0].cat, 'removal', 'removal category (renders red, listed with cancellations)');
  eq(items[0].newText, 'BAKER BOB', 'name kept on the sheet, not blanked');
  const grid = [[{ v: 'Hotel Name' }, { v: 'Name 1' }],
    [{ v: 'H' }, null, null, null, null, null, null, null, { v: 'ADAMS ALICE' }, { v: 'BAKER BOB' }]];
  const out = C.buildOutput(grid, [{ srcRow: 1, items: [items[0]] }], [], [], [{ srcRow: 1, ciDate: '' }]);
  eq(out[1][9].fill, '#ff0000', 'removed name painted red');
  eq(out[1][9].strike, true, 'removed name struck through');
  eq(out[1][9].text, 'BAKER BOB', 'removed name still visible on the page');
}

/* dead names: grey/struck cells are cancelled-earlier records, left alone */
{
  const grid = [
    ['Hotel Name', 'Hotel Location', 'Check-in Time', 'Check-in Date', 'Inbound FLT', 'Check-Out Time',
     'Check-Out Date', 'Outbound FLT', 'Name 1', 'Name 2', 'Name 3', 'Pairing Shortcode',
     'Confirmation Numbers', '', '', 'Comments'].map(v => v ? { v } : null),
    [{ v: 'H' }, { v: 'X' }, { v: '14:00' }, { v: '10-Jul' }, { v: 'AB1' }, null, null, null,
     { v: 'Live, Larry' }, { v: 'Dead, Denny' }],
    [{ v: 'H' }, { v: 'X' }, { v: '15:00' }, { v: '10-Jul' }, { v: 'AB2' }, null, null, null,
     { v: 'Gone, Gary' }]
  ];
  grid._styles = {
    '1,9': { strike: true, greyFont: true, fcolor: '808080', fill: null },
    '2,0': { strike: true, greyFont: false, fcolor: null, fill: 'D9D9D9' },
    '2,2': { strike: true }, '2,3': { strike: true }, '2,4': { strike: true }, '2,8': { strike: true }
  };
  const rows = C.parseRows(grid, 'hotel');
  eq(rows[0].deadNames[1], true, 'greyed+struck name flagged dead');
  eq(rows[0].nameKeys[1], '', 'dead name excluded from matching keys');
  eq(rows[1].cancelledPrior, true, 'fully struck row flagged as cancelled earlier');
  const m = rec('master', { names: ['Live, Larry'], ciD: '10-Jul', inF: 'AB1' });
  const res = C.matchRows([m], [rows[0]], '2026-07-09');
  eq(res.matches.length, 1, 'row matches on live crew alone');
  eq(C.diffPair(m, rows[0]).length, 0, 'NO name change proposed — dead name left alone');
}

/* style extraction: strike/grey recovered by joining sheet XML with style tables */
(async () => {
  const fsm = require('fs');
  const buf = new Uint8Array(fsm.readFileSync(__dirname + '/styled-test.xlsx'));
  const wb = global.XLSX.read(buf, { type: 'buffer', cellStyles: true });
  const sg = await C.readStyleGrid(buf, 'S', wb.Styles);
  eq(!!sg, true, 'style grid extracted from the xlsx zip');
  eq(sg['2,0'].strike, true, 'font strikethrough detected (CE alone cannot see this)');
  eq(sg['2,0'].greyFont, true, 'grey font colour detected');
  eq(sg['2,0'].fill, 'D9D9D9', 'grey fill detected');
  eq(sg['2,2'].fill, 'FF0000', 'red fill detected');
  eq(C.isDeadStyle(sg['2,0']), true, 'grey+struck = dead');
  eq(C.isDeadStyle(sg['1,0'] || null), false, 'plain cells are not dead');
  /* appendSheetToXlsx: new page written INTO the workbook, originals verbatim */
  {
    const src = new Uint8Array(fsm.readFileSync(__dirname + '/fixtures/real1.hotel.xlsx'));
    const before = global.XLSX.read(src, { type: 'buffer' });
    const mk = (t, o) => Object.assign({ text: t, fill: null, strike: false }, o || {});
    const out = [];
    for (let r = 0; r < 3; r++) {
      const row = [];
      for (let c = 0; c < 16; c++) row.push(mk(r === 0 ? 'H' + c : (r === 1 && c === 12 ? '007' : 'r' + r + 'c' + c)));
      out.push(row);
    }
    out[1][0] = mk('YEL', { fill: '#ffff00' });
    out[1][1] = mk('CAN', { fill: '#ff0000', strike: true });
    out[2][0] = mk('GRY', { fill: '#808080' });
    out[2][1] = mk('', { fill: '#b5e6a2' });          /* empty cell keeps its fill */
    const bytes = await C.appendSheetToXlsx(src, 'JUL 10 AK N', out);
    const wb2 = global.XLSX.read(bytes, { type: 'buffer' });
    eq(wb2.SheetNames.length, before.SheetNames.length + 1, 'one sheet added');
    before.SheetNames.forEach((nm, i) => eq(wb2.SheetNames[i], nm, 'original tab kept: ' + nm));
    eq(wb2.SheetNames[wb2.SheetNames.length - 1], 'JUL 10 AK N', 'new tab named like the page');
    /* original sheet content untouched (raw entries copied byte-for-byte) */
    const s0 = before.SheetNames[0];
    const a1 = k => (before.Sheets[s0][k] || {}).v, b1 = k => (wb2.Sheets[s0][k] || {}).v;
    ['A1', 'A5', 'C5', 'H5'].forEach(k => eq(String(b1(k)), String(a1(k)), 'original cell ' + k + ' unchanged'));
    const ns = wb2.Sheets['JUL 10 AK N'];
    eq(ns['A1'].v, 'H0', 'new sheet A1 value');
    eq(String(ns['M2'].v), '007', 'confirmation column kept as text (leading zero survives)');
    /* styles landed in styles.xml and the sheet references them */
    const sty2 = await C.zipRead(bytes, 'xl/styles.xml');
    for (const hex of ['FFFFFF00', 'FFFF0000', 'FF808080', 'FFB5E6A2'])
      eq(sty2.includes(hex), true, 'fill ' + hex + ' present in styles.xml');
    eq(sty2.includes('<strike/>'), true, 'strike font added');
    eq(sty2.includes('numFmtId="49"'), true, 'text format for confirmation columns');
    eq(sty2.includes('wrapText="1"'), true, 'wrap alignment applied');
    const names = C.zipEntries(bytes).map(e => e.name);
    eq(names.length, C.zipEntries(src).length + 1, 'exactly one zip entry added');
    /* duplicate tab name gets a suffix instead of corrupting the workbook */
    const bytes2 = await C.appendSheetToXlsx(bytes, 'JUL 10 AK N', out);
    const wb3 = global.XLSX.read(bytes2, { type: 'buffer' });
    eq(wb3.SheetNames[wb3.SheetNames.length - 1], 'JUL 10 AK N (2)', 'clashing tab name suffixed');
  }

  /* =================== .msg engine =================== */
  const X = global.XLSX;
  function buildBaseMsg(o) {
    o = o || {};
    const cfb = X.CFB.utils.cfb_new();
    const put = (pp, b) => X.CFB.utils.cfb_add(cfb, pp, Array.from(b));
    const subj = C.msgU16(o.subject || 'Crew accommodation update');
    const cls = C.msgU16('IPM.Note');
    const bodyTxt = o.body != null ? o.body : 'Hello,\nSee attached.\nRegards,\n[NAME]\nCargojet';
    const body = C.msgU16(bodyTxt);
    put('/__substg1.0_0037001F', subj);
    put('/__substg1.0_001A001F', cls);
    put('/__substg1.0_1000001F', body);
    let rows = [
      C.propRowFixed(0x0E070003, 0x1),
      C.propRowVar(0x0037001F, C.propVarSize(0x0037001F, subj.length)),
      C.propRowVar(0x001A001F, C.propVarSize(0x001A001F, cls.length)),
      C.propRowVar(0x1000001F, C.propVarSize(0x1000001F, body.length))
    ];
    if (o.html) {
      const h = C.msgLatinBytes('<html><body><p>Table stays <b>bold</b>.</p><p>Regards,<br>[NAME]</p></body></html>');
      put('/__substg1.0_10130102', h);
      rows.push(C.propRowVar(0x10130102, h.length));
    }
    if (o.rtf) {
      const w = C.lzfuWrapRaw('{\\rtf1\\ansi Regards, [NAME] end}');
      put('/__substg1.0_10090102', w);
      rows.push(C.propRowVar(0x10090102, w.length));
    }
    put('/__properties_version1.0', C.propsBuild(new Uint8Array(32), rows));
    put('/__nameid_version1.0/__substg1.0_00020102', [0, 0, 0, 0]);
    const out = X.CFB.write(cfb, { type: 'buffer' });
    return new Uint8Array(out);
  }

  /* compressed-RTF codec */
  {
    const round = C.lzfuDecompress(C.lzfuWrapRaw('{\\rtf1 hello}'));
    eq(round, '{\\rtf1 hello}', 'raw (MELA) round-trip');
    /* hand-built LZFu: one dictionary reference into the spec dictionary, then end marker */
    const lz = new Uint8Array(16 + 5);
    C.msgWr32(lz, 0, 17); C.msgWr32(lz, 4, 6); C.msgWr32(lz, 8, 0x75465A4C); C.msgWr32(lz, 12, 0);
    lz.set([0x03, 0x00, 0x04, 0x0D, 0x50], 16);   /* ref(off 0,len 6), end(off 213) */
    eq(C.lzfuDecompress(lz), '{\\rtf1', 'true LZFu dictionary reference decoded');
    eq(C.rtfEscape('a\\b{c}'), 'a\\\\b\\{c\\}', 'rtf escaping');
  }

  /* base parse (preview info) */
  {
    const info = C.msgParse(buildBaseMsg({ html: true }));
    eq(info.subject, 'Crew accommodation update', 'msg subject read');
    eq(info.tokenCount, 2, '[NAME] counted across body + html');
    eq(info.hasHtml, true, 'html body detected');
    eq(info.attachCount, 0, 'no attachments in base');
    eq(info.bodyPreview.includes('Regards'), true, 'body preview text');
  }

  /* the generation contract: clone = same email, new envelope only */
  {
    const wbBytes = new Uint8Array(fsm.readFileSync(__dirname + '/fixtures/real1.hotel.xlsx'));
    const base = buildBaseMsg({ html: true });
    const out = C.msgClone(base, {
      to: ['frontdesk@bqkhotel.com'],
      cc: ['crewtravel@cargojet.com', 'ops@cargojet.com'],
      attachment: { name: 'Hotel Requirements BQK.xlsx', bytes: wbBytes },
      token: '[NAME]', name: 'Andrew K'
    });
    const cfb = X.CFB.read(out, { type: 'buffer' });
    const get = pp => { const e = X.CFB.find(cfb, pp); return e && e.content ? new Uint8Array(e.content) : null; };
    eq(C.msgFromU16(get('/__substg1.0_0037001F')), 'Crew accommodation update', 'subject untouched');
    const body = C.msgFromU16(get('/__substg1.0_1000001F'));
    eq(body.includes('[NAME]'), false, 'token gone from plain body');
    eq(body.includes('Andrew K'), true, 'operator name in plain body');
    const html = C.msgLatin(get('/__substg1.0_10130102'));
    eq(html.includes('[NAME]'), false, 'token gone from html body');
    eq(html.includes('<b>bold</b>'), true, 'authored formatting untouched');
    eq(C.msgFromU16(get('/__recip_version1.0_#00000000/__substg1.0_3003001F')), 'frontdesk@bqkhotel.com', 'To recipient written');
    eq(C.msgFromU16(get('/__recip_version1.0_#00000002/__substg1.0_3003001F')), 'ops@cargojet.com', 'second CC written');
    const r1p = get('/__recip_version1.0_#00000001/__properties_version1.0');
    const r1rows = C.propsParse(r1p, 8);
    let rtype = null;
    r1rows.forEach(r => { if (C.msgRd32(r, 0) === 0x0C150003) rtype = C.msgRd32(r, 8); });
    eq(rtype, 2, 'CC recipient typed as CC');
    const att = get('/__attach_version1.0_#00000000/__substg1.0_37010102');
    eq(att.length, wbBytes.length, 'attachment byte count');
    eq(Buffer.compare(Buffer.from(att), Buffer.from(wbBytes)), 0, 'attachment bytes identical to the sheet');
    eq(C.msgFromU16(get('/__attach_version1.0_#00000000/__substg1.0_3707001F')), 'Hotel Requirements BQK.xlsx', 'attachment filename');
    const props = get('/__properties_version1.0');
    eq(C.msgRd32(props, 16), 3, 'recipient count = 3');
    eq(C.msgRd32(props, 20), 1, 'attachment count = 1');
    const rows2 = C.propsParse(props, 32);
    let flags = 0, hasRtfRow = false;
    rows2.forEach(r => {
      if (C.msgRd32(r, 0) === 0x0E070003) flags = C.msgRd32(r, 8);
      if (C.msgRd32(r, 0) === 0x10090102) hasRtfRow = true;
    });
    eq((flags & 0x8) !== 0, true, 'MSGFLAG_UNSENT set -> opens as a draft');
    eq(hasRtfRow, false, 'no stale RTF row when html is authoritative');
    eq(C.msgFromU16(get('/__substg1.0_0E04001F')), 'frontdesk@bqkhotel.com', 'display-To line');
    eq(C.msgFromU16(get('/__substg1.0_0E03001F')), 'crewtravel@cargojet.com; ops@cargojet.com', 'display-CC line');
    const info2 = C.msgParse(out);
    eq(info2.tokenCount, 0, 'no token anywhere after clone');
    eq(info2.attachCount, 1, 'parse sees the attachment');
    eq(info2.recipCount, 3, 'parse sees the recipients');
  }

  /* RTF-only base: token swapped inside the (re-wrapped) RTF */
  {
    const out = C.msgClone(buildBaseMsg({ rtf: true }), { to: ['a@b.co'], cc: [], attachment: null, name: 'AK' });
    const cfb = X.CFB.read(out, { type: 'buffer' });
    const e = X.CFB.find(cfb, '/__substg1.0_10090102');
    const rtf = C.lzfuDecompress(new Uint8Array(e.content));
    eq(rtf.includes('[NAME]'), false, 'token gone from RTF');
    eq(rtf.includes('AK'), true, 'name in RTF');
    const props = new Uint8Array(X.CFB.find(cfb, '/__properties_version1.0').content);
    eq(C.msgRd32(props, 20), 0, 'no attachment on the no-changes clone');
  }

  /* batch plumbing */
  eq(C.isHotelReqFile('Hotel Requirements BQK JUL.xlsx'), true, 'prefix match');
  eq(C.isHotelReqFile('hotel requirements anc.XLSX'), true, 'case-insensitive');
  eq(C.isHotelReqFile('Hotel Requirements old.xls'), false, 'xls rejected');
  eq(C.isHotelReqFile('~$Hotel Requirements BQK.xlsx'), false, 'Excel lock file rejected');
  eq(C.isHotelReqFile('Master VMO.xlsx'), false, 'non-matching name');
  eq(C.isHotelReqFile('REQ ANC.xlsx', 'req'), true, 'configurable prefix');
  {
    const contacts = [
      { hotelKey: 'BQK', to: 'b@h.com' },
      { hotelKey: 'ANC', to: 'a@h.com' },
      { hotelKey: 'ANC EAST', to: 'ae@h.com' }
    ];
    eq(C.matchContactToFile('Hotel Requirements BQK.xlsx', contacts).to, 'b@h.com', 'key matched in filename');
    eq(C.matchContactToFile('Hotel Requirements ANC EAST 2.xlsx', contacts).to, 'ae@h.com', 'longest key wins');
    eq(C.matchContactToFile('Hotel Requirements LIM.xlsx', contacts), null, 'no key -> null');
  }
  {
    const d = new Date(2026, 6, 10);
    eq(C.resolveDateDir(['2024', '2025', '2026'], 'year', d), '2026', 'year folder');
    eq(C.resolveDateDir(['Archive 2026', 'Misc'], 'year', d), 'Archive 2026', 'year substring');
    eq(C.resolveDateDir(['06 JUN', '07 JUL', '08 AUG'], 'month', d), '07 JUL', 'month folder by name');
    eq(C.resolveDateDir(['6', '7', '8'], 'month', d), '7', 'bare month number');
    eq(C.resolveDateDir(['July', 'June'], 'month', d), 'July', 'full month name');
    eq(C.resolveDateDir(['JUL A', 'JUL B'], 'month', d), null, 'ambiguous -> null (operator confirms)');
  }
  eq(C.validEmail('crew@cargojet.com'), true, 'valid email');
  eq(C.validEmail('not-an-email'), false, 'invalid email');
  eq(C.validEmail('a b@c.com'), false, 'space rejected');

  /* comparePipeline: the whole engine as one call (batch mode entry point) */
  {
    const m1 = rec('master', { names: ['BROWN BILL'], ciD: '25JUL26', inF: 'AB955', ciT: '16:30' });
    const m2 = rec('master', { names: ['SAME SUE'], ciD: '26JUL26', inF: 'AB1', ciT: '10:00' });
    const h1 = rec('hotel', { names: ['BROWN BILL'], ciD: '25JUL26', inF: 'AB955', ciT: '15:00', srcRow: 1 });
    const h2 = rec('hotel', { names: ['SAME SUE'], ciD: '26JUL26', inF: 'AB1', ciT: '10:00', srcRow: 2 });
    const R = C.comparePipeline([m1, m2], [h1, h2], { todayISO: '2026-07-10', nowHM: '12:00' });
    eq(R.updates.length, 1, 'pipeline: one changed booking');
    eq(R.unchanged.length, 1, 'pipeline: one verified unchanged');
    eq(R.updates[0].items[0].ck, false, 'pipeline: proposals start unapproved');
    eq(R.proposalCount, 1, 'pipeline: proposal count');
    eq(R.hotelPick, 'AIRPORT GRAND', 'pipeline: hotel auto-picked from the sheet');
  }

  console.log('ALL ' + n + ' ASSERTIONS PASSED (+ inline asserts)');
})().catch(e => { console.error(e); process.exit(1); });

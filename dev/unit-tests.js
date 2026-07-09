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

/* pairing code change alone must NOT split the match */
{
  const m = rec('master', { names: ['SMITH JOHN', 'DOE JANE'], ciD: '25JUL', inF: 'AB941', pair: 'P999' });
  const h = rec('hotel',  { names: ['SMITH JOHN', 'DOE JANE'], ciD: '25JUL', inF: 'AB941', pair: 'P123' });
  const res = C.matchRows([m], [h]);
  eq(res.matches.length, 1, 'pairing change still matches');
  eq(C.diffPair(m, h).map(i => i.label), ['Pairing code'], 'pairing flagged as field change');
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
    [2], [newRec]);
  eq(out.length, 4, 'rows: header + 2 data + 1 new');
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
  assert(html.includes('background:#ffff00'), 'clipboard has yellow');
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
  eq(out.length, 4, 'header + 2 rows + inserted new');
  eq(out[2][8].text, 'WILSON WENDY', 'new row inserted at index 2 (before 30JUL)');
  eq(out[3][8].text, 'BBB', '30JUL row pushed down');
}

/* pairing "keep both" */
eq(C.pairingBothText('ABCD', 'DCBA'), 'ABCD, DCBA', 'keep-both text');
eq(C.pairingBothText('', 'DCBA'), 'DCBA', 'keep-both with no old code');
{
  const m = rec('master', { names: ['SMITH JOHN'], ciD: '25JUL', inF: 'AB941', pair: 'DCBA' });
  const h = rec('hotel',  { names: ['SMITH JOHN'], ciD: '25JUL', inF: 'AB941', pair: 'ABCD' });
  const items = C.diffPair(m, h);
  eq(items.length, 1, 'pairing-only change');
  eq(items[0].canBoth, true, 'pairing item offers keep-both');
  eq(items[0].mode, 'replace', 'default mode is replace');
}

/* clipboard carries the paste geometry */
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

/* hotel similarity */
assert(C.hotelSimilarity('Hilton Anchorage', 'HILTON - ANCHORAGE DOWNTOWN') > 0.5, 'similar hotels score high');
assert(C.hotelSimilarity('Hilton Anchorage', 'Marriott Fairbanks') === 0, 'different hotels score 0');

console.log('ALL ' + n + ' ASSERTIONS PASSED (+ inline asserts)');

// Golden-fixture harness: runs real .xlsx pairs through the ACTUAL core logic
// (same call sequence as doCompare in the tool) and checks the proposals
// against an expected.json. Also prints a full decision report so any wrong
// suggestion can be traced to the exact canonical value that caused it.
//
// Fixture layout (in ./fixtures):
//   <name>.master.xlsx     required
//   <name>.hotel.xlsx      required
//   <name>.expected.json   optional — without it, the report prints and the
//                          fixture "passes" (report-only mode)
//
// expected.json schema (all fields optional except "expect"):
// {
//   "masterSheet": "Sheet1",          // default: first sheet
//   "hotelSheet": "05JUL AKN",        // default: last sheet
//   "hotels": ["Airport Grand"],      // master hotel names to tick; default: auto-detect like the UI
//   "window": { "from": "04JUL26", "to": "10JUL26" },  // default: auto like the UI
//   "expect": {
//     "updates":  [ { "who": "SMITH JOHN", "fields": ["Check-in time"] } ],
//     "new":      [ "WILSON WENDY" ],
//     "cancel":   [ "MILLER MIKE" ],
//     "outside":  [ "PETERS PAUL" ],
//     "unchanged": [ "DOE JANE" ]     // or "unchangedCount": 3
//   }
// }
const fs = require('fs');
const path = require('path');
const C = require('./core.js');
const XLSX = global.XLSX;

const FIX_DIR = path.join(__dirname, 'fixtures');
let failures = 0;

function loadSheet(file, pick) {
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  const name = pick === 'last' ? wb.SheetNames[wb.SheetNames.length - 1] : wb.SheetNames[0];
  return { wb, name };
}

function fmtRow(r) {
  const names = r.names.filter(Boolean).join(' · ') || '(no names)';
  return `r${String(r.srcRow + 1).padStart(3)}  ${names.padEnd(38).slice(0, 38)} ` +
    `ciD=${String(r.ciDate).padEnd(11)} ciT=${String(r.ciTime).padEnd(6)} inF=${String(r.inFlt).padEnd(7)} ` +
    `coD=${String(r.coDate).padEnd(11)} coT=${String(r.coTime).padEnd(6)} outF=${String(r.outFlt).padEnd(7)} pair=${r.pairing}`;
}

function who(rec) {
  return (rec.names.find(n => C.normWS(n) !== '') || '(no names)').toUpperCase().replace(/\s+/g, ' ').trim();
}

async function runFixture(name) {
  console.log('\n════════ fixture: ' + name + ' ════════');
  const mFile = path.join(FIX_DIR, name + '.master.xlsx');
  const hFile = path.join(FIX_DIR, name + '.hotel.xlsx');
  const eFile = path.join(FIX_DIR, name + '.expected.json');
  const exp = fs.existsSync(eFile) ? JSON.parse(fs.readFileSync(eFile, 'utf8')) : null;

  // --- load & parse exactly like the tool ---
  const mBuf = new Uint8Array(fs.readFileSync(mFile));
  const hBuf = new Uint8Array(fs.readFileSync(hFile));
  const mWb = XLSX.read(mBuf, { type: 'buffer', cellStyles: true });
  const hWb = XLSX.read(hBuf, { type: 'buffer', cellStyles: true });
  const mSheet = (exp && exp.masterSheet) || mWb.SheetNames[0];
  const hSheet = (exp && exp.hotelSheet) || hWb.SheetNames[hWb.SheetNames.length - 1];
  console.log(`master: ${path.basename(mFile)} [${mSheet}]   hotel: ${path.basename(hFile)} [${hSheet}]`);

  const mGrid = C.sheetToGrid(mWb.Sheets[mSheet]);
  const hGrid = C.sheetToGrid(hWb.Sheets[hSheet]);
  hGrid._styles = await C.readStyleGrid(hBuf, hSheet, hWb.Styles);
  const mRows = C.parseRows(mGrid, 'master');
  const hRows = C.parseRows(hGrid, 'hotel');

  console.log('\n--- master rows as parsed (canonical values) ---');
  mRows.forEach(r => console.log(fmtRow(r) + '  hotel=' + r.hotel));
  console.log('\n--- hotel rows as parsed (canonical values) ---');
  hRows.forEach(r => console.log(fmtRow(r) + '  conf=' + (r.disp[12] || '')));

  // --- hotel selection: explicit list or the UI's auto-detect ---
  let canons;
  if (exp && exp.hotels) {
    canons = exp.hotels.map(C.canonText);
  } else {
    const hotels = C.distinctHotels(mRows);
    const dom = C.dominantHotelName(hRows);
    let best = -1, bs = 0;
    hotels.forEach((h, i) => { const s = C.hotelSimilarity(h.name, dom); if (s > bs) { bs = s; best = i; } });
    canons = best >= 0 ? [hotels[best].canon] : [];
    console.log(`\nauto hotel pick: ${best >= 0 ? hotels[best].name : 'NONE (similarity 0 — the UI would tick nothing!)'}`);
  }
  const masterRows = mRows.filter(r => canons.indexOf(r.hotel) >= 0);

  // --- window: explicit or the UI's auto-fill ---
  const win = (exp && exp.window)
    ? C.windowFromInputs(C.parseDateText(exp.window.from || ''), C.parseDateText(exp.window.to || ''))
    : C.masterDateWindow(mRows);
  console.log('window: ' + (win ? C.fmtWindow(win) : '(none — everything in scope)'));

  // same pipeline as the tool's doCompare (expected.json may pin "today"/"now"
  // so past/future classification stays stable no matter when the suite runs)
  const now = new Date();
  const todayISO = (exp && exp.today) ||
    C.isoParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const nowHM = (exp && exp.now) ||
    (('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2));

  const inScope = [], outside = [], gone = [];
  hRows.forEach(h => {
    if (h.cancelledPrior) gone.push(h);
    else if (C.inWindow(win, h.ciDate)) inScope.push(h);
    else outside.push(h);
  });

  const res = C.foldSplitPairings(C.matchRows(masterRows, inScope, todayISO));
  const updates = [], unchanged = [];
  res.matches.forEach(mt => {
    const items = C.diffPair(mt.m, mt.h, { lockCI: C.isPastDT(mt.h.ciDate, mt.h.ciTime, todayISO, nowHM) });
    if (items.length) updates.push({ m: mt.m, h: mt.h, why: mt.why, items });
    else unchanged.push(mt);
  });
  const past = [];
  res.cancelledHotel = res.cancelledHotel.filter(h => {
    if (C.isPastDT(h.ciDate, h.ciTime, todayISO, nowHM)) { past.push(h); return false; }
    return true;
  });
  res.newMaster = res.newMaster.filter(m => !C.isPastDT(m.ciDate, m.ciTime, todayISO, nowHM));

  console.log('\n--- decisions ---');
  updates.forEach(u => {
    console.log(`CHANGED   ${who(u.h)}  (matched: ${u.why})`);
    u.items.forEach(it => console.log(`            ${it.label}: "${it.oldText}" -> "${it.newText}"  [${it.cat}]`));
  });
  unchanged.forEach(mt => console.log(`UNCHANGED ${who(mt.h)}  (matched: ${mt.why})`));
  res.newMaster.forEach(m => console.log(`NEW       ${who(m)}  ciD=${m.ciDate}`));
  res.cancelledHotel.forEach(h => console.log(`CANCEL?   ${who(h)}  ciD=${h.ciDate}`));
  outside.forEach(h => console.log(`OUTSIDE   ${who(h)}  ciD=${h.ciDate}`));
  past.forEach(h => console.log(`PAST      ${who(h)}  ciD=${h.ciDate}`));
  gone.forEach(h => console.log(`GONE      ${who(h)}  (grey/struck — cancelled earlier)`));

  // --- compare with expectations ---
  if (!exp || !exp.expect) { console.log('\n(no expected.json — report only)'); return; }
  const E = exp.expect;
  const errs = [];
  const namesOf = list => list.map(x => who(x.h || x.m || x)).sort();
  const wantNames = list => (list || []).map(s => s.toUpperCase()).sort();

  function checkSet(label, actual, wanted) {
    const a = JSON.stringify(actual), w = JSON.stringify(wanted);
    if (a !== w) errs.push(`${label}: expected ${w}, got ${a}`);
  }
  checkSet('new bookings', namesOf(res.newMaster), wantNames(E.new));
  checkSet('cancellations', namesOf(res.cancelledHotel), wantNames(E.cancel));
  checkSet('outside window', namesOf(outside), wantNames(E.outside));
  if (E.past) checkSet('historical', namesOf(past), wantNames(E.past));
  if (E.gone) checkSet('cancelled earlier', namesOf(gone), wantNames(E.gone));
  checkSet('changed bookings', namesOf(updates), wantNames((E.updates || []).map(u => u.who)));
  (E.updates || []).forEach(eu => {
    const u = updates.find(x => who(x.h) === eu.who.toUpperCase());
    if (!u) return; // already reported by the set check
    const got = u.items.map(i => i.label).sort();
    const want = (eu.fields || []).slice().sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      errs.push(`fields for ${eu.who}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  });
  if (E.unchanged) checkSet('unchanged', namesOf(unchanged), wantNames(E.unchanged));
  else if (E.unchangedCount != null && unchanged.length !== E.unchangedCount)
    errs.push(`unchanged count: expected ${E.unchangedCount}, got ${unchanged.length}`);

  if (errs.length) {
    failures++;
    console.log('\n✗ FIXTURE FAILED:');
    errs.forEach(e => console.log('   - ' + e));
  } else {
    console.log('\n✓ fixture matches expected outcome exactly');
  }
}

if (!fs.existsSync(FIX_DIR)) { console.log('no fixtures/ directory — nothing to check'); process.exit(0); }
const names = [...new Set(fs.readdirSync(FIX_DIR)
  .filter(f => f.endsWith('.master.xlsx'))
  .map(f => f.replace(/\.master\.xlsx$/, '')))].sort();
if (!names.length) { console.log('no fixtures found — nothing to check'); process.exit(0); }
(async () => {
  for (const nm of names) await runFixture(nm);
  console.log('\n' + (failures ? `GOLDEN FAILED: ${failures} fixture(s) wrong` : `GOLDEN PASSED: ${names.length} fixture(s) clean`));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

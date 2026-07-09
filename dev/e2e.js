// End-to-end test: drives the built single-file tool in real Chromium.
// v2: Cargojet theme, side-by-side grid view with hover-tooltip approvals.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const here = __dirname;

function fail(msg) { console.error('E2E FAIL: ' + msg); process.exit(1); }
function ok(msg) { console.log('  ✓ ' + msg); }

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  page.on('pageerror', e => fail('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); });

  await page.goto('file://' + path.join(here, 'built.html'));
  await page.waitForSelector('#drop-master');
  ok('page loads with CSP, no errors');

  async function dropFile(selector, filePath) {
    const b64 = fs.readFileSync(filePath).toString('base64');
    await page.evaluate(async ({ selector, b64, name }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.querySelector(selector).dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    }, { selector, b64, name: path.basename(filePath) });
  }

  await dropFile('#drop-master', path.join(here, 'master.xlsx'));
  await page.waitForSelector('#drop-master.loaded');
  await dropFile('#drop-hotel', path.join(here, 'hotel.xlsx'));
  await page.waitForSelector('#drop-hotel.loaded');
  ok('both files loaded via drag & drop');

  const hotelTab = await page.inputValue('#sheet-hotel');
  if (hotelTab !== '01JUL AKN') fail('hotel default tab should be "01JUL AKN", got ' + hotelTab);

  await page.waitForSelector('#step2:not(.hidden)');
  const label = await page.$eval('.hotelck:checked', ck => ck.parentElement.textContent);
  if (!/Airport Grand Anchorage/i.test(label)) fail('auto-picked wrong hotel: ' + label);
  ok('correct hotel auto-detected: ' + label.trim());

  // ---- compare can never silently do nothing: unticking disables the button with a reason ----
  if (await page.isDisabled('#btn-compare')) fail('compare should be enabled with a hotel ticked');
  await page.uncheck('.hotelck:checked');
  if (!await page.isDisabled('#btn-compare')) fail('compare should disable with no hotel ticked');
  const why = await page.textContent('#cmp-scope');
  if (!why.includes('Tick at least one hotel')) fail('disabled reason missing, got: ' + why);
  await page.check('.hotelck');
  if (await page.isDisabled('#btn-compare')) fail('compare should re-enable after ticking');
  ok('compare button disables itself with a plain-English reason when nothing is ticked');

  const peek = await page.textContent('#drop-master .peek summary');
  if (!/Preview parsed rows/.test(peek)) fail('parse preview missing');
  ok('parse-preview panel available on loaded files');

  // ---- editable date range auto-filled from the master ----
  const winFrom = await page.inputValue('#win-from');
  const winTo = await page.inputValue('#win-to');
  if (winFrom !== '25JUL26' || winTo !== '28JUL26')
    fail('window autofill wrong: ' + winFrom + ' / ' + winTo);
  const winNote = await page.textContent('#win-note');
  if (!winNote.includes('25JUL–28JUL')) fail('window note wrong: ' + winNote);
  ok('date range auto-filled (25JUL26–28JUL26) and editable');

  await page.click('#btn-compare');
  await page.waitForSelector('#step3:not(.hidden)');

  const chips = await page.textContent('#chips');
  for (const want of ['2 schedule', '1 name', '1 new', '2 possible cancellation', '1 unchanged', '2 outside window']) {
    if (!chips.includes(want)) fail('chip missing "' + want + '" — got: ' + chips);
  }
  ok('summary chips correct: ' + chips.replace(/\s+/g, ' ').trim());

  // ---- delta filtering is the default: untouched rows hidden until asked for ----
  if (await page.isChecked('#show-unch')) fail('"Show all rows" must default to unchecked');
  if (await page.locator('#gridwrap .bk.k-unchanged').first().isVisible())
    fail('unchanged cards should be hidden by default');
  await page.check('#show-unch');
  if (!await page.locator('#gridwrap .bk.k-unchanged').first().isVisible())
    fail('ticking "Show all rows" should reveal untouched cards');
  ok('review defaults to changed items only; checkbox reveals the full list');

  // ---- ordinary pairing-code churn is not a proposal ----
  if (await page.locator('#gridwrap td.d', { hasText: 'P5519' }).count() !== 0)
    fail('a pairing-code difference alone must not be an outlined proposal');
  ok('pairing-code churn (P5519 vs P5520) produces no proposal');

  // ---- master window: 30JUL and 02AUG bookings are out of range, NOT cancellations ----
  for (const marker of ['30JUL', '02AUG']) {
    const card = page.locator('#gridwrap .bk', { hasText: marker });
    if (await card.count() !== 1) fail('expected one booking card containing ' + marker);
    const tag = await card.locator('.rowtag').textContent();
    if (!/out of range/i.test(tag)) fail(marker + ' card tagged "' + tag + '", expected Out of range');
    if (await card.locator('td.d').count() !== 0) fail(marker + ' card must have no clickable proposal cells');
  }
  ok('30JUL and 02AUG bookings marked Out of range — untouchable, not cancellations');

  // ---- grid view is the default ----
  const gridVisible = await page.isVisible('#gridpane');
  if (!gridVisible) fail('grid pane should be the default view');
  const counts = await page.evaluate(() => ({
    sched: document.querySelectorAll('#gridwrap td.d.c-sched').length,
    name: document.querySelectorAll('#gridwrap td.d.c-name').length,
    newC: document.querySelectorAll('#gridwrap td.d.c-new').length,
    can: document.querySelectorAll('#gridwrap td.d.c-cancel').length,
    masterRows: document.querySelectorAll('#gridwrap tr.rmaster').length
  }));
  if (counts.sched !== 2) fail('expected 2 outlined schedule cells, got ' + counts.sched);
  if (counts.name !== 1) fail('expected 1 outlined name cell, got ' + counts.name);
  if (counts.newC !== 16) fail('expected 16 green cells (1 new row), got ' + counts.newC);
  if (counts.can !== 32) fail('expected 32 red cells (2 cancel rows), got ' + counts.can);
  if (counts.masterRows !== 4) fail('expected 4 master rows (3 changed + 1 unchanged pair), got ' + counts.masterRows);
  ok('side-by-side grid: master+hotel row pairs with correctly outlined diff cells');

  // ---- hover tooltip -> approve via tooltip button ----
  // let the smooth-scroll to step 3 finish (scrolling auto-hides the tooltip)
  await page.waitForTimeout(1200);
  const brownCell = page.locator('#gridwrap td.d.c-sched', { hasText: '15:00' });
  await brownCell.hover();
  await page.waitForSelector('#tip.show');
  const tipText = await page.textContent('#tip');
  if (!tipText.includes('Check-in time') || !tipText.includes('15:00') || !tipText.includes('16:30'))
    fail('tooltip content wrong: ' + tipText);
  ok('hover tooltip shows "Check-in time: 15:00 → 16:30" with match reason');
  await page.click('#tip button');
  await page.keyboard.press('Escape');
  const brownAppr = await page.locator('#gridwrap td.d.c-sched.appr', { hasText: '16:30' }).count();
  if (brownAppr !== 1) fail('Brown cell not approved/filled after tooltip approve');
  ok('tooltip Approve fills the cell yellow with the new value 16:30 ✓');

  // ---- approve the rest by clicking cells directly ----
  for (const text of ['27JUL', 'BAKER BOB']) {
    await page.locator('#gridwrap td.d:not(.appr)', { hasText: text }).first().click();
    await page.keyboard.press('Escape');
  }
  await page.locator('#gridwrap td.d.c-new').first().click();       // new booking row
  await page.keyboard.press('Escape');
  const millerRow = page.locator('#gridwrap tr', { hasText: 'MILLER MIKE' });
  await millerRow.locator('td.d.c-cancel').first().click();          // ONLY Miller's cancellation
  await page.keyboard.press('Escape');

  const count = await page.textContent('#approve-count');
  if (!count.includes('5') || !count.includes('of 6')) fail('expected 5 of 6 approved, got: ' + count);
  ok('5 of 6 approved by clicking grid cells (loadmaster row left alone)');

  const newConf = await page.locator('#gridwrap tr', { hasText: 'WILSON WENDY' }).locator('td').nth(13).textContent();
  if (!newConf.includes('NEW')) fail('approved new row conf1 should show NEW, got ' + newConf);
  const lenaAppr = await page.locator('#gridwrap tr', { hasText: 'LARSSON LENA' }).locator('td.appr').count();
  if (lenaAppr !== 0) fail('loadmaster row must not be approved');
  ok('grid reflects state: Wendy conf NEW, Larsson untouched');

  // ---- card view stays in sync ----
  await page.click('#view-cards');
  const sync = await page.evaluate(() => ({
    checked: [...document.querySelectorAll('#groups input[type=checkbox]')].filter(c => c.checked).length,
    total: document.querySelectorAll('#groups input[type=checkbox]').length
  }));
  if (sync.checked !== 5 || sync.total !== 6) fail('card view out of sync: ' + JSON.stringify(sync));
  ok('change-list view shows the same 5/6 approvals (views share state)');
  await page.click('#view-grid');

  // ---- build output ----
  await page.click('#btn-build');
  await page.waitForSelector('#step4:not(.hidden)');
  const check = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#previewbox table tr')].map(tr =>
      [...tr.children].map(td => ({ t: td.textContent, s: td.getAttribute('style') || '' })));
    const body = rows.slice(1);
    const find = name => body.find(r => r.some(c => c.t.includes(name)));
    const out = {};
    const brown = find('BROWN BILL'); out.brownTime = brown && brown[2];
    const adams = find('ADAMS ALICE'); out.adamsName2 = adams && adams[9];
    out.adamsConf2 = adams && adams[13].t; out.adamsPair = adams && adams[11];
    const miller = find('MILLER MIKE'); out.miller = miller && miller[8];
    const lena = find('LARSSON LENA'); out.lena = lena && lena[8];
    const wendy = find('WILSON WENDY');
    out.wendy = wendy && { name: wendy[8], conf1: wendy[12], notes: wendy[15] };
    const garcia = find('GARCIA GLEN'); out.garciaDate = garcia && garcia[3];
    out.totalRows = body.length;
    return out;
  });
  const has = (o, txt, styleFrag, what) => {
    if (!o) fail(what + ': row not found');
    if (txt !== null && o.t.toUpperCase() !== txt.toUpperCase()) fail(what + ': text "' + o.t + '" != "' + txt + '"');
    if (styleFrag && !o.s.includes(styleFrag)) fail(what + ': style "' + o.s + '" missing ' + styleFrag);
    if (styleFrag === null && o.s) fail(what + ': expected no style, got ' + o.s);
  };
  has(check.brownTime, '16:30', 'background:#ffff00', 'Brown time change yellow');
  has(check.adamsName2, 'CARTER CHRIS', 'background:#a6c9ec', 'Adams FO name blue');
  if (check.adamsConf2.trim() !== 'CNF88614') fail('conf number changed! ' + check.adamsConf2);
  has(check.adamsPair, 'P5519', null, 'pairing code untouched despite churn');
  has(check.garciaDate, '28JUL', 'background:#ffff00', 'Garcia date shift yellow');
  has(check.miller, 'MILLER MIKE', 'background:#ff0000', 'Miller cancelled red');
  if (!check.miller.s.includes('line-through')) fail('Miller not struck through');
  has(check.lena, 'LARSSON LENA (LOADMASTER)', null, 'Loadmaster row untouched');
  has(check.wendy.name, 'WILSON WENDY', 'background:#b5e6a2', 'Wendy new row green');
  has(check.wendy.conf1, 'NEW', 'background:#b5e6a2', 'Wendy conf1 = NEW');
  if (check.wendy.notes.t !== 'Late arrival') fail('notes not mapped M->P');
  if (check.totalRows !== 11) fail('expected 11 output rows (header + 8 hotel + 1 new + footer), got ' + check.totalRows);
  const lastRow = await page.evaluate(() => {
    const rows = document.querySelectorAll('#previewbox table tr');
    return rows[rows.length - 1].textContent;
  });
  if (!lastRow.includes('Property of CargoJet Crew Scheduling Group')) fail('property footer missing, got: ' + lastRow);
  ok('property footer appended as the final row');
  const outCheck = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#previewbox table tr')].slice(1);
    const hit = rows.find(r => [...r.children].some(td => td.textContent.includes('PETERS PAUL')));
    return hit ? [...hit.children].map(td => td.getAttribute('style') || '').join('') : null;
  });
  if (outCheck === null) fail('out-of-window row missing from output');
  if (outCheck !== '') fail('out-of-window row must pass through with NO styling, got: ' + outCheck);
  ok('out-of-window bookings pass through the output page completely untouched');

  // ---- chronological order: Wendy (27JUL) must sit BEFORE the 30JUL row, not at the end ----
  const orderCheck = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#previewbox table tr')].map(r => r.textContent);
    return {
      wendy: rows.findIndex(t => t.includes('WILSON WENDY')),
      jul30: rows.findIndex(t => t.includes('30JUL')),
      aug02: rows.findIndex(t => t.includes('02AUG'))
    };
  });
  if (!(orderCheck.wendy > 0 && orderCheck.wendy < orderCheck.jul30 && orderCheck.jul30 < orderCheck.aug02))
    fail('new booking not in chronological position: ' + JSON.stringify(orderCheck));
  ok('approved new booking inserted chronologically (27JUL before 30JUL and 02AUG)');
  ok('output page identical to v1 spec: yellow/blue/green/red + strikethrough correct');

  // ---- clipboard ----
  await page.click('#btn-copy');
  await page.waitForFunction(() => document.getElementById('copymsg').textContent.includes('Paste into cell A1'));
  const clip = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    for (const it of items) if (it.types.includes('text/html'))
      return await (await it.getType('text/html')).text();
    return '';
  });
  if (!clip.includes('background-color:#ffff00') || !clip.includes('text-decoration:line-through') ||
      !clip.includes('mso-number-format') || !clip.includes('WILSON WENDY'))
    fail('clipboard HTML incomplete');
  for (const geom of ['<col width="127">', '<col width="56">', '<col width="162">',
                      'text-align:left', 'vertical-align:middle', 'white-space:normal']) {
    if (!clip.includes(geom)) fail('clipboard missing paste geometry: ' + geom);
  }
  ok('clipboard carries fills, strikethrough, column widths, wrap and alignment');
  if (!clip.includes('Property of CargoJet Crew Scheduling Group')) fail('clipboard missing property footer');

  // ---- Excel download ----
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-download')]);
  const fname = dl.suggestedFilename();
  if (!/\.xls$/.test(fname)) fail('download should be a .xls file, got ' + fname);
  ok('Download for Excel produces ' + fname);

  await browser.close();
  console.log('E2E PASSED');
})().catch(e => fail(e.stack || String(e)));

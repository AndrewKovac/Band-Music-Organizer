const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path'); const here = __dirname;
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('pageerror', e => { console.log('PAGEERROR', e.message); process.exit(1); });
  await page.goto('file://' + path.join(here, 'built.html'));
  async function dropFile(selector, filePath) {
    const b64 = fs.readFileSync(filePath).toString('base64');
    await page.evaluate(({ selector, b64, name }) => {
      const bin = atob(b64); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const dt = new DataTransfer(); dt.items.add(new File([arr], name));
      document.querySelector(selector).dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    }, { selector, b64, name: path.basename(filePath) });
  }
  await dropFile('#drop-master', path.join(here, 'fixtures/real1.master.xlsx'));
  await page.waitForSelector('#drop-master.loaded .okdot');
  await dropFile('#drop-hotel', path.join(here, 'fixtures/real1.hotel.xlsx'));
  await page.waitForSelector('#step2:not(.hidden)');
  // the real hotel workbook's newest tab is the coordinator's own result page —
  // pick the ORIG page like a real run against the hotel's latest known state
  await page.selectOption('#sheet-hotel', 'ORIG JUN 25');
  await page.waitForTimeout(300);
  await page.fill('#win-from', '22JUL26');
  await page.fill('#win-to', '27JUL26');
  await page.selectOption('#initials', 'CR');
  await page.selectOption('#suffix', 'N');
  await page.screenshot({ path: 'shot-real-1.png' });
  await page.click('#btn-compare');
  await page.waitForSelector('#step3:not(.hidden)');
  await page.waitForTimeout(1300);
  const chips = await page.textContent('#chips');
  console.log('chips:', chips.replace(/\s+/g, ' '));
  await page.screenshot({ path: 'shot-real-2.png' });
  await page.click('#btn-all');
  await page.click('#btn-build');
  await page.waitForSelector('#step4:not(.hidden)');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shot-real-3.png' });
  const tab = await page.textContent('#tabname-out');
  console.log('tab name:', tab);
  await browser.close();
  console.log('REAL-FILE RUN OK');
})();

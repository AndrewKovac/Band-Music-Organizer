const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path'); const here = __dirname;
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 880 } })).newPage();
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
  await page.screenshot({ path: 'shot-0-empty.png' });
  await dropFile('#drop-master', path.join(here, 'master.xlsx'));
  await page.waitForSelector('#drop-master.loaded');
  await dropFile('#drop-hotel', path.join(here, 'hotel.xlsx'));
  await page.waitForSelector('#step2:not(.hidden)');
  await page.screenshot({ path: 'shot-1-load.png' });
  await page.click('#btn-compare');
  await page.waitForSelector('#step3:not(.hidden)');
  await page.waitForTimeout(1300);
  // approve a couple so the screenshot shows filled + outlined mix
  await page.locator('#gridwrap td.d:not(.appr)', { hasText: 'BAKER BOB' }).first().click();
  await page.keyboard.press('Escape');
  await page.locator('#gridwrap td.d.c-new').first().click();
  await page.keyboard.press('Escape');
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  // hover Brown's yellow cell so the tooltip is in shot
  await page.locator('#gridwrap td.d.c-sched', { hasText: '15:00' }).hover();
  await page.waitForSelector('#tip.show');
  await page.evaluate(() => document.querySelector('#step3').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(400);
  await page.locator('#gridwrap td.d.c-sched', { hasText: '15:00' }).hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shot-2-grid.png' });
  // cards view
  await page.click('#view-cards');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'shot-3-cards.png' });
  await page.click('#view-grid');
  // output
  await page.click('#btn-build');
  await page.waitForSelector('#step4:not(.hidden)');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shot-4-output.png' });
  await browser.close();
  console.log('shots done');
})();

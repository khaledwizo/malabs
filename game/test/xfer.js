// اختبار نسخ/استيراد رمز التقدّم
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await page.waitForTimeout(900);
  await page.evaluate(() => { const S = window.__nabd.Save; S.data.unlocked = 4; S.data.rnn = 321; S.data.charms = ['feather', 'owl']; S.data.equipped = ['owl']; S.data.notches = 4; S.data.journal = { drone: 1 }; S.persist(); window.__nabd.UI.buildSettings(); window.__nabd.UI.open('scrSettings', 'scrTitle'); });
  await page.click('#btnExport'); await page.waitForTimeout(150);
  const code = await page.$eval('#saveCode', t => t.value);
  // جهاز جديد: امسح كل شيء ثم الصق
  await page.evaluate(() => { const S = window.__nabd.Save; const keep = S.data.settings; S.data = S.defaults(); S.data.settings = keep; S.persist(); });
  await page.fill('#saveCode', ''); await page.fill('#saveCode', code);
  await page.keyboard.type(' ');
  await page.click('#btnImport'); await page.waitForTimeout(150);
  const r = await page.evaluate(() => { const d = window.__nabd.Save.data; return { u: d.unlocked, rnn: d.rnn, ch: d.charms.join(), eq: d.equipped.join(), n: d.notches, j: Object.keys(d.journal).join(), msg: document.getElementById('xferMsg').textContent, pressed: [...window.__nabd.Input.pressed] }; });
  console.log(code.slice(0, 24) + '…', JSON.stringify(r));
  const ok = r.u === 4 && r.rnn === 321 && r.ch === 'feather,owl' && r.eq === 'owl' && r.n === 4 && r.j === 'drone';
  await page.fill('#saveCode', 'garbage'); await page.click('#btnImport');
  const bad = await page.$eval('#xferMsg', m => m.textContent);
  console.log(ok ? 'PASS import restores progress' : 'FAIL import', '| bad code →', bad, '| errors', errs.length);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'x1_settings_xfer.png'), fullPage: false });
  await browser.close(); process.exit(ok && !errs.length ? 0 : 1);
})();

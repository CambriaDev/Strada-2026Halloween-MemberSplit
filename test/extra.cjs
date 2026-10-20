const { chromium } = require('playwright-core');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const URL = pathToFileURL(path.resolve(__dirname, '..', 'MemberSplit.html')).href;
const OUT = path.join(__dirname, 'out');

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓ ' + msg);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(300);

  console.log('\n[offset range B3]');
  await page.locator('#fileInput').setInputFiles(path.join(__dirname, 'fixtures', 'offset.xlsx'));
  await page.waitForFunction(() => document.querySelector('#fileName').textContent.includes('offset.xlsx'), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  assert((await page.locator('#startRowInput').inputValue()) === '4', 'offset sheet detects start row 4');
  assert((await page.locator('#nameColSelect').evaluate(el => el.selectedOptions[0].textContent)).startsWith('B'), 'offset sheet detects name column B');
  assert((await page.locator('#roleColSelect').evaluate(el => el.selectedOptions[0].textContent)).startsWith('C'), 'offset sheet detects role column C');
  assert((await page.locator('#rosterCount').textContent()).trim() === '10 人', 'offset sheet loads 10 people from B4');
  await page.locator('#seedInput').fill('offset-seed');
  await page.locator('#speedRange').evaluate(el => { el.value = '4'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#startBtn').click();
  await page.waitForFunction(() => document.querySelector('.draw-console').classList.contains('complete'), null, { timeout: 20000 });
  await page.waitForTimeout(200);
  const counts = await page.evaluate(() => ({
    a: parseInt(document.querySelector('#teamACount').textContent, 10),
    f: parseInt(document.querySelector('#teamFCount').textContent, 10),
    leads: document.querySelectorAll('#teamALead .lead-name').length + document.querySelectorAll('#teamFLead .lead-name').length,
    checks: document.querySelector('#checkSmeValue').textContent.trim()
  }));
  assert(counts.a + counts.f === 10 && counts.leads === 2, 'offset sheet groups correctly');
  assert(Math.abs(counts.a - counts.f) <= 1, 'offset sheet balance within 1');

  console.log('\n[copy results]');
  await page.locator('#copyBtn').click();
  await page.waitForTimeout(500);
  const toastText = (await page.locator('#toastText').textContent()).trim();
  assert(toastText.includes('复制'), 'copy reports success: ' + toastText);
  let clip = '';
  try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = ''; }
  if (clip) {
    assert(clip.includes('队伍\t姓名\t角色'), 'clipboard contains TSV header');
    assert(clip.includes('Zoe Bennett') || clip.includes('Owen Price'), 'clipboard contains roster names');
  } else {
    console.log('  - clipboard read unavailable in this environment; toast path verified');
  }

  console.log('\n[about dialog]');
  await page.locator('#aboutBtn').click();
  await page.waitForTimeout(300);
  assert(await page.locator('#aboutDialog').isVisible(), 'about dialog opens');
  await page.screenshot({ path: path.join(OUT, 'about.png') });
  await page.locator('#aboutClose').click();
  await page.waitForTimeout(200);
  assert(!(await page.locator('#aboutDialog').isVisible()), 'about dialog closes');

  console.log('\n[text injection safety]');
  const evil = '\uFEFFName,Role\n"<img src=x onerror=""window.__pwned=1"">,Member\n"Quote, Comma",Member\nNormal Person,Member\n';
  const evilPath = path.join(__dirname, 'fixtures', 'names-evil.csv');
  fs.writeFileSync(evilPath, evil, 'utf8');
  await page.locator('#fileInput').setInputFiles(evilPath);
  await page.waitForTimeout(700);
  assert(!(await page.evaluate(() => window.__pwned)), 'HTML in a name is not executed');
  const roleNames = await page.locator('#roleList .role-name').allTextContents();
  assert(roleNames.some(n => n.includes('<img src=x')), 'HTML in a name is displayed as text');
  fs.unlinkSync(evilPath);

  console.log('\n[mobile toolbar]');
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(URL);
  await mobile.waitForTimeout(300);
  await mobile.locator('#emptyDemoBtn').click();
  await mobile.waitForTimeout(700);
  await mobile.locator('#speedRange').evaluate(el => { el.value = '4'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await mobile.locator('#stageStartBtn').click();
  await mobile.waitForFunction(() => document.querySelector('.draw-console').classList.contains('complete'), null, { timeout: 20000 });
  await mobile.waitForTimeout(4600);
  await mobile.evaluate(() => document.querySelector('#stageMain').scrollIntoView({ block: 'start' }));
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: path.join(OUT, 'mobile-toolbar.png') });

  assert(errors.length === 0, 'no runtime errors: ' + (errors.join(' | ') || 'none'));
  console.log('\nEXTRA TESTS PASSED');
  await browser.close();
})().catch(err => { console.error('EXTRA FAILED:', err.message); process.exit(1); });

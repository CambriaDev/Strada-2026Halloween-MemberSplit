const { chromium } = require('playwright-core');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const XLSX = require('../src/vendor/xlsx.full.min.js');

const ROOT = path.resolve(__dirname, '..');
const URL = pathToFileURL(path.join(ROOT, 'MemberSplit.html')).href;
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓ ' + msg);
}

async function setSpeed(page, value = 4) {
  await page.locator('#speedRange').evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function startAndWait(page, via = 'sidebar') {
  if (via === 'sidebar') await page.locator('#startBtn').click();
  else await page.locator('#stageStartBtn').click();
  await page.waitForFunction(() => document.querySelector('.draw-console').classList.contains('complete'), null, { timeout: 25000 });
  await page.waitForTimeout(150);
}

async function readBoard(page) {
  return await page.evaluate(() => {
    const texts = sel => Array.from(document.querySelectorAll(sel)).map(n => n.textContent.trim());
    const aCount = document.querySelector('#teamACount').textContent.trim();
    const fCount = document.querySelector('#teamFCount').textContent.trim();
    return {
      aLead: texts('#teamALead .lead-name'),
      fLead: texts('#teamFLead .lead-name'),
      aMembers: texts('#teamAList .member-name'),
      fMembers: texts('#teamFList .member-name'),
      aSme: texts('#teamAList .member.is-sme .member-name'),
      fSme: texts('#teamFList .member.is-sme .member-name'),
      aCount: parseInt(aCount, 10),
      fCount: parseInt(fCount, 10),
      aAll: [...texts('#teamALead .lead-name'), ...texts('#teamAList .member-name')],
      fAll: [...texts('#teamFLead .lead-name'), ...texts('#teamFList .member-name')],
      checks: {
        lead: document.querySelector('#checkLeadValue').textContent.trim(),
        sme: document.querySelector('#checkSmeValue').textContent.trim(),
        balance: document.querySelector('#checkBalanceValue').textContent.trim()
      }
    };
  });
}

function verifyConstraints(board, total, label) {
  assert(board.aCount + board.fCount === total, `${label}: team totals sum to ${total}`);
  assert(board.aLead.length === 1 && board.fLead.length === 1, `${label}: exactly one lead per team`);
  assert(Math.abs(board.aCount - board.fCount) <= 3, `${label}: team size diff <= 3 (${board.aCount}/${board.fCount})`);
  const smeA = board.aSme.length, smeF = board.fSme.length;
  assert((smeA === 2 && smeF === 3) || (smeA === 3 && smeF === 2), `${label}: SMEs split 2/3 (${smeA}/${smeF})`);
  assert(board.checks.lead === '1 / 1', `${label}: lead check shows 1 / 1`);
  assert(board.checks.sme === `${smeA} / ${smeF}`, `${label}: SME check matches board`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on('request', r => requests.push(r.url()));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  console.log('\n[1] initial state');
  await page.goto(URL);
  await page.waitForTimeout(400);
  assert(await page.locator('#emptyState').isVisible(), 'hero is visible before import');
  assert(await page.locator('#startBtn').isDisabled(), 'start is disabled with no roster');
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  })();
  assert((await page.locator('#seedInput').inputValue()) === today, 'seed defaults to yyyyMMdd today');

  console.log('\n[2] demo roster + grouping + reproducibility');
  await page.locator('#emptyDemoBtn').click();
  await page.waitForTimeout(250);
  assert((await page.locator('#leadCount').textContent()).includes('2/2'), 'demo has 2 leads');
  assert((await page.locator('#smeCount').textContent()).includes('5/5'), 'demo has 5 SMEs');
  await page.locator('#seedInput').fill('20261020');
  await setSpeed(page, 4);
  await startAndWait(page);
  const first = await readBoard(page);
  verifyConstraints(first, 28, 'demo');
  await page.screenshot({ path: path.join(OUT, 'demo-result.png') });

  await startAndWait(page);
  const second = await readBoard(page);
  assert(JSON.stringify([...first.aAll].sort()) === JSON.stringify([...second.aAll].sort()), 'same seed reproduces Team A exactly');
  assert(JSON.stringify([...first.fAll].sort()) === JSON.stringify([...second.fAll].sort()), 'same seed reproduces Team F exactly');

  await page.locator('#seedInput').fill('20261021');
  await startAndWait(page);
  const third = await readBoard(page);
  const different = JSON.stringify([...first.aAll].sort()) !== JSON.stringify([...third.aAll].sort()) ||
    JSON.stringify([...first.fAll].sort()) !== JSON.stringify([...third.fAll].sort());
  assert(different, 'different seed produces a different draw');
  verifyConstraints(third, 28, 'demo-different-seed');

  console.log('\n[3] blank seed -> millisecond timestamp');
  await page.locator('#seedInput').fill('');
  await startAndWait(page);
  const meta = await page.locator('#stageMeta').textContent();
  assert(/种子 \d{13}/.test(meta.replace(/\s+/g, ' ')), 'blank seed uses a 13-digit timestamp and displays it');
  assert((await page.locator('#topSeedText').textContent()).includes('种子'), 'top bar shows the effective seed');

  console.log('\n[4] team rename + exports');
  await page.locator('#teamAName').fill('Alpha Squad');
  await page.waitForTimeout(100);
  assert((await page.locator('#teamATitle').inputValue()) === 'Alpha Squad', 'team rename syncs to board header');
  assert((await page.locator('#panelA .team-name-input').inputValue()) === 'Alpha Squad', 'board header shows renamed team');

  const xlsxDownloadPromise = page.waitForEvent('download');
  await page.locator('#exportXlsxBtn').click();
  const xlsxDownload = await xlsxDownloadPromise;
  const xlsxPath = path.join(OUT, 'export.xlsx');
  await xlsxDownload.saveAs(xlsxPath);
  const wb = XLSX.read(fs.readFileSync(xlsxPath), { type: 'array' });
  assert(wb.SheetNames.includes('分组结果') && wb.SheetNames.includes('分组信息'), 'export workbook has result and info sheets');
  const exportRows = XLSX.utils.sheet_to_json(wb.Sheets['分组结果'], { header: 1, defval: '' });
  assert(exportRows[0].join(',') === '队伍,姓名,角色', 'export header is correct');
  assert(exportRows.length === 29, 'export has 28 members + header');
  assert(exportRows.some(r => r[0] === 'Alpha Squad'), 'export uses renamed team');
  const counts = exportRows.slice(1).reduce((acc, r) => { acc[r[0]] = (acc[r[0]] || 0) + 1; return acc; }, {});
  assert(Math.abs((counts['Alpha Squad'] || 0) - (counts['Team F'] || 0)) <= 3, 'exported team sizes respect the cap');
  const info = XLSX.utils.sheet_to_json(wb.Sheets['分组信息'], { header: 1, defval: '' });
  assert(info.some(r => r[0] === '种子'), 'info sheet includes the seed');

  const csvDownloadPromise = page.waitForEvent('download');
  await page.locator('#exportCsvBtn').click();
  const csvDownload = await csvDownloadPromise;
  const csvPath = path.join(OUT, 'export.csv');
  await csvDownload.saveAs(csvPath);
  const csvText = fs.readFileSync(csvPath, 'utf8');
  assert(csvText.charCodeAt(0) === 0xFEFF, 'CSV starts with UTF-8 BOM');
  assert(csvText.includes('队伍,姓名,角色'), 'CSV header is present');
  assert(csvText.includes('Alpha Squad'), 'CSV contains renamed team');

  console.log('\n[5] xlsx import + auto detection + sheet switching');
  await page.locator('#fileInput').setInputFiles(path.join(ROOT, 'sample-roster.xlsx'));
  await page.waitForFunction(() => document.querySelector('#fileName').textContent.includes('sample-roster.xlsx'), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  assert((await page.locator('#sheetSelect option').count()) === 2, 'both sheets are listed');
  assert((await page.locator('#startRowInput').inputValue()) === '2', 'header auto-detected at row 1 -> start row 2');
  assert((await page.locator('#nameColSelect').evaluate(el => el.selectedOptions[0].textContent)).startsWith('A'), 'name column auto-detected as A');
  assert((await page.locator('#roleColSelect').evaluate(el => el.selectedOptions[0].textContent)).startsWith('B'), 'role column auto-detected as B');
  assert((await page.locator('#rosterCount').textContent()).trim() === '28 人', 'xlsx roster has 28 people');
  assert((await page.locator('#leadCount').textContent()).includes('2/2'), 'xlsx roles auto-detected (leads)');
  assert((await page.locator('#smeCount').textContent()).includes('5/5'), 'xlsx roles auto-detected (SMEs)');
  await page.locator('#seedInput').fill('sample-seed-01');
  await startAndWait(page);
  const xlsxBoard = await readBoard(page);
  verifyConstraints(xlsxBoard, 28, 'xlsx');
  await page.screenshot({ path: path.join(OUT, 'xlsx-result.png') });

  await page.locator('#sheetSelect').selectOption('备用名单');
  await page.waitForTimeout(500);
  assert((await page.locator('#startRowInput').inputValue()) === '4', 'alt sheet detects header row 3 -> start row 4');
  assert((await page.locator('#nameColSelect').evaluate(el => el.selectedOptions[0].textContent)).startsWith('B'), 'alt sheet detects name column B');
  assert((await page.locator('#roleColSelect').evaluate(el => el.selectedOptions[0].textContent)).startsWith('C'), 'alt sheet detects role column C');
  assert((await page.locator('#rosterCount').textContent()).trim() === '18 人', 'alt roster has 18 people');
  assert((await page.locator('#leadCount').textContent()).includes('2/2'), 'alt Chinese roles: 2 leads');
  assert((await page.locator('#smeCount').textContent()).includes('5/5'), 'alt Chinese roles: 5 SMEs');
  await page.locator('#seedInput').fill('alt-sheet-42');
  await startAndWait(page);
  const altBoard = await readBoard(page);
  verifyConstraints(altBoard, 18, 'alt-sheet');

  console.log('\n[6] role editing validation');
  const firstSelect = page.locator('#roleList .role-row select').first();
  await firstSelect.selectOption('member');
  await page.waitForTimeout(150);
  assert(await page.locator('#startBtn').isDisabled(), 'start disabled when lead count drops below 2');
  assert((await page.locator('#validationText').textContent()).includes('Team Lead'), 'validation explains the lead requirement');
  assert(await page.locator('#staleBanner').isVisible(), 'existing result is marked stale after role change');
  assert(await page.locator('#exportXlsxBtn').isDisabled(), 'export disabled for stale result');
  await firstSelect.selectOption('lead');
  await page.waitForTimeout(150);
  assert(!(await page.locator('#startBtn').isDisabled()), 'start re-enabled when roles are valid again');

  console.log('\n[7] csv import');
  await page.locator('#fileInput').setInputFiles(path.join(ROOT, 'sample-roster.csv'));
  await page.waitForFunction(() => document.querySelector('#fileName').textContent.includes('sample-roster.csv'), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  assert((await page.locator('#rosterCount').textContent()).trim() === '12 人', 'csv roster has 12 people');
  assert((await page.locator('#leadCount').textContent()).includes('2/2'), 'csv roles detected (2 leads)');
  assert((await page.locator('#smeCount').textContent()).includes('5/5'), 'csv roles detected (5 SMEs)');
  await page.locator('#seedInput').fill('csv-seed');
  await startAndWait(page);
  const csvBoard = await readBoard(page);
  verifyConstraints(csvBoard, 12, 'csv');

  console.log('\n[7b] manual start row configuration');
  await page.locator('#startRowInput').fill('3');
  await page.locator('#startRowInput').press('Enter');
  await page.waitForTimeout(550);
  assert((await page.locator('#rosterCount').textContent()).trim() === '11 人', 'start row 3 skips the first data row');
  assert((await page.locator('#leadCount').textContent()).includes('1/2'), 'skipping the first lead disables grouping');
  assert(await page.locator('#startBtn').isDisabled(), 'start disabled with an invalid roster');
  assert((await page.locator('#configHint').textContent()).includes('第 3 行起'), 'config hint reflects the manual start row');
  await page.locator('#startRowInput').fill('2');
  await page.locator('#startRowInput').press('Enter');
  await page.waitForTimeout(550);
  assert((await page.locator('#rosterCount').textContent()).trim() === '12 人', 'start row back to 2 restores the roster');
  assert((await page.locator('#leadCount').textContent()).includes('2/2'), 'roles restored from the column');

  console.log('\n[7c] legacy .xls import');
  await page.locator('#fileInput').setInputFiles(path.join(__dirname, 'fixtures', 'legacy.xls'));
  await page.waitForFunction(() => document.querySelector('#fileName').textContent.includes('legacy.xls'), null, { timeout: 10000 });
  await page.waitForTimeout(600);
  assert((await page.locator('#rosterCount').textContent()).trim() === '10 人', '.xls roster has 10 people');
  assert((await page.locator('#leadCount').textContent()).includes('2/2'), '.xls roles detected (2 leads)');
  assert((await page.locator('#smeCount').textContent()).includes('5/5'), '.xls roles detected (5 SMEs)');
  await page.locator('#seedInput').fill('legacy-seed');
  await startAndWait(page);
  const legacyBoard = await readBoard(page);
  verifyConstraints(legacyBoard, 10, 'legacy-xls');

  console.log('\n[7d] roster without role column: manual roles');
  await page.locator('#fileInput').setInputFiles(path.join(__dirname, 'fixtures', 'names-only.csv'));
  await page.waitForFunction(() => document.querySelector('#fileName').textContent.includes('names-only.csv'), null, { timeout: 10000 });
  await page.waitForTimeout(600);
  assert((await page.locator('#rosterCount').textContent()).trim() === '10 人', 'names-only roster has 10 people');
  assert((await page.locator('#roleColSelect').evaluate(el => el.selectedOptions[0].textContent)).includes('不指定'), 'no role column detected');
  assert((await page.locator('#leadCount').textContent()).includes('0/2'), 'starts with zero leads');
  assert(await page.locator('#startBtn').isDisabled(), 'start disabled until roles are assigned');
  assert((await page.locator('#roleHint').textContent()).includes('手动'), 'role hint explains manual assignment');
  const roleSelects = page.locator('#roleList .role-row select');
  for (let i = 0; i < 2; i++) await roleSelects.nth(i).selectOption('lead');
  for (let i = 2; i < 7; i++) await roleSelects.nth(i).selectOption('sme');
  await page.waitForTimeout(250);
  assert((await page.locator('#leadCount').textContent()).includes('2/2'), 'manual assignment: 2 leads');
  assert((await page.locator('#smeCount').textContent()).includes('5/5'), 'manual assignment: 5 SMEs');
  assert(!(await page.locator('#startBtn').isDisabled()), 'start enabled after manual role assignment');
  await page.locator('#seedInput').fill('manual-roles-seed');
  await startAndWait(page);
  const manualBoard = await readBoard(page);
  verifyConstraints(manualBoard, 10, 'manual-roles');

  console.log('\n[8] skip animation');
  await page.locator('#seedInput').fill('skip-test');
  await page.locator('#startBtn').click();
  await page.waitForTimeout(350);
  const skipVisible = await page.locator('#skipBtn').isVisible();
  assert(skipVisible, 'skip button appears during animation');
  await page.locator('#skipBtn').click();
  await page.waitForTimeout(250);
  assert((await page.locator('#drawPhase').textContent()).trim() === '分组完成', 'skip completes the reveal');
  assert(await page.locator('.draw-console').evaluate(el => el.classList.contains('complete')), 'console reaches complete state after skip');
  const skipBoard = await readBoard(page);
  verifyConstraints(skipBoard, 10, 'skip');

  console.log('\n[9] offline check');
  const external = requests.filter(u => /^https?:/i.test(u));
  assert(external.length === 0, 'no HTTP(S) requests (fully offline)');
  assert(errors.length === 0, 'no console errors or page errors: ' + (errors.join(' | ') || 'none'));

  console.log('\n[10] mobile screenshots');
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  const mobileErrors = [];
  mobile.on('pageerror', e => mobileErrors.push(e.message));
  await mobile.goto(URL);
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: path.join(OUT, 'mobile-initial.png'), fullPage: false });
  await mobile.locator('#emptyDemoBtn').click();
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: path.join(OUT, 'mobile-ready.png'), fullPage: false });
  await mobile.locator('#stageStartBtn').click();
  await mobile.waitForFunction(() => document.querySelector('.draw-console').classList.contains('complete'), null, { timeout: 25000 });
  await mobile.waitForTimeout(4500);
  await mobile.screenshot({ path: path.join(OUT, 'mobile-result.png'), fullPage: true });
  assert(mobileErrors.length === 0, 'no errors on mobile viewport');

  console.log('\nALL TESTS PASSED');
  await browser.close();
})().catch(async err => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});

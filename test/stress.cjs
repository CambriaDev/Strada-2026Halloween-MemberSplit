const { chromium } = require('playwright-core');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const URL = pathToFileURL(path.resolve(__dirname, '..', 'MemberSplit.html')).href;
const SIZES = [7, 8, 9, 10, 11, 50];
const SEEDS = 8;

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT: ' + msg);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL);
  await page.waitForTimeout(300);
  await page.locator('#fileInput').setInputFiles(path.join(__dirname, 'fixtures', 'stress.xlsx'));
  await page.waitForTimeout(700);
  await page.locator('#speedRange').evaluate(el => { el.value = '4'; el.dispatchEvent(new Event('input', { bubbles: true })); });

  let runs = 0;
  for (const n of SIZES) {
    await page.locator('#sheetSelect').selectOption(`N${n}`);
    await page.waitForTimeout(450);
    const rosterCount = (await page.locator('#rosterCount').textContent()).trim();
    assert(rosterCount === `${n} 人`, `N${n}: roster count ${rosterCount}`);
    for (let s = 0; s < SEEDS; s++) {
      await page.locator('#seedInput').fill(`stress-${n}-${s}`);
      await page.locator('#startBtn').click();
      await page.waitForSelector('#skipBtn', { state: 'visible', timeout: 5000 });
      await page.locator('#skipBtn').click();
      await page.waitForFunction(() => document.querySelector('.draw-console')?.classList.contains('complete'), null, { timeout: 10000 });
      const board = await page.evaluate(() => {
        const t = sel => Array.from(document.querySelectorAll(sel)).map(n => n.textContent.trim());
        return {
          aLead: t('#teamALead .lead-name'),
          fLead: t('#teamFLead .lead-name'),
          aSme: t('#teamAList .member.is-sme').length,
          fSme: t('#teamFList .member.is-sme').length,
          aMembers: t('#teamAList .member-name'),
          fMembers: t('#teamFList .member-name'),
          aCount: parseInt(document.querySelector('#teamACount').textContent, 10),
          fCount: parseInt(document.querySelector('#teamFCount').textContent, 10),
          checks: {
            lead: document.querySelector('#checkLeadValue').textContent.trim(),
            sme: document.querySelector('#checkSmeValue').textContent.trim(),
            balance: document.querySelector('#checkBalanceValue').textContent.trim()
          }
        };
      });
      const aAll = [...board.aLead, ...board.aMembers];
      const fAll = [...board.fLead, ...board.fMembers];
      const all = [...aAll, ...fAll];
      assert(board.aCount + board.fCount === n, `N${n} seed ${s}: team totals`);
      assert(aAll.length === board.aCount && fAll.length === board.fCount, `N${n} seed ${s}: counts match DOM`);
      assert(new Set(all).size === n, `N${n} seed ${s}: all members unique`);
      assert(board.aLead.length === 1 && board.fLead.length === 1, `N${n} seed ${s}: one lead per team`);
      assert((board.aSme === 2 && board.fSme === 3) || (board.aSme === 3 && board.fSme === 2), `N${n} seed ${s}: SME 2/3`);
      const diff = Math.abs(board.aCount - board.fCount);
      assert(diff <= 1, `N${n} seed ${s}: compensated diff <= 1 (got ${diff})`);
      assert(board.checks.lead === '1 / 1', `N${n} seed ${s}: lead check`);
      assert(board.checks.balance.startsWith(String(diff)), `N${n} seed ${s}: balance check reflects diff`);
      runs++;
    }
    console.log(`  ✓ N=${n}: ${SEEDS} seeds verified`);
  }
  console.log(`\nSTRESS PASSED: ${runs} seeded draws checked; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  if (errors.length) throw new Error('browser errors');
  await browser.close();
})().catch(err => { console.error('STRESS FAILED:', err.message); process.exit(1); });

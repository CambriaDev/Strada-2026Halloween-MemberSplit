const { chromium } = require('playwright-core');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const URL = pathToFileURL(path.resolve(__dirname, '..', 'MemberSplit.html')).href;
const CASES = [
  { sheet: 'N4-L2S2', n: 4, leads: 2, smes: 2 },
  { sheet: 'N7-L2S5', n: 7, leads: 2, smes: 5 },
  { sheet: 'N8-L3S2', n: 8, leads: 3, smes: 2 },
  { sheet: 'N9-L4S3', n: 9, leads: 4, smes: 3 },
  { sheet: 'N11-L5S4', n: 11, leads: 5, smes: 4 },
  { sheet: 'N12-L3S9', n: 12, leads: 3, smes: 9 },
  { sheet: 'N50-L7S15', n: 50, leads: 7, smes: 15 }
];
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
  for (const c of CASES) {
    await page.locator('#sheetSelect').selectOption(c.sheet);
    await page.waitForTimeout(450);
    const rosterCount = (await page.locator('#rosterCount').textContent()).trim();
    assert(rosterCount === `${c.n} 人`, `${c.sheet}: roster count ${rosterCount}`);
    const smeChip = (await page.locator('#smeCount').textContent()).trim();
    assert(smeChip.includes(`${c.smes}/≥2`), `${c.sheet}: SME chip shows ${c.smes}/≥2`);
    const leadChip = (await page.locator('#leadCount').textContent()).trim();
    assert(leadChip.includes(`${c.leads}/≥2`), `${c.sheet}: Lead chip shows ${c.leads}/≥2`);
    for (let s = 0; s < SEEDS; s++) {
      const seed = `stress-${c.sheet}-${s}`;
      await page.locator('#seedInput').fill(seed);
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
      assert(board.aCount + board.fCount === c.n, `${c.sheet} seed ${s}: team totals`);
      assert(aAll.length === board.aCount && fAll.length === board.fCount, `${c.sheet} seed ${s}: counts match DOM`);
      assert(new Set(all).size === c.n, `${c.sheet} seed ${s}: all members unique`);
      assert(board.aLead.length + board.fLead.length === c.leads, `${c.sheet} seed ${s}: all ${c.leads} leads placed`);
      assert(Math.abs(board.aLead.length - board.fLead.length) <= 1, `${c.sheet} seed ${s}: lead diff <= 1`);
      assert(board.aSme + board.fSme === c.smes, `${c.sheet} seed ${s}: all ${c.smes} SMEs placed`);
      assert(Math.abs(board.aSme - board.fSme) <= 1, `${c.sheet} seed ${s}: SME diff <= 1`);
      const diff = Math.abs(board.aCount - board.fCount);
      assert(diff <= 1, `${c.sheet} seed ${s}: compensated diff <= 1 (got ${diff})`);
      assert(board.checks.lead === `${board.aLead.length} / ${board.fLead.length}`, `${c.sheet} seed ${s}: lead check matches board`);
      assert(board.checks.sme === `${board.aSme} / ${board.fSme}`, `${c.sheet} seed ${s}: SME check matches board`);
      assert(board.checks.balance.startsWith(String(diff)), `${c.sheet} seed ${s}: balance check reflects diff`);
      runs++;
    }
    console.log(`  ✓ ${c.sheet}: ${SEEDS} seeds verified`);
  }
  console.log(`\nSTRESS PASSED: ${runs} seeded draws checked; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  if (errors.length) throw new Error('browser errors');
  await browser.close();
})().catch(err => { console.error('STRESS FAILED:', err.message); process.exit(1); });

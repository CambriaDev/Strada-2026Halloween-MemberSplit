const { chromium } = require('playwright-core');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const URL = pathToFileURL(path.join(ROOT, 'MemberSplit.html')).href;
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓ ' + msg);
}

const PEOPLE = [
  ['Avery Stone', 'Team Lead'],
  ['Jordan Blake', 'Team Lead'],
  ['Riley Chen', 'SME'],
  ['Sam Rivera', 'SME'],
  ['Taylor Kim', 'SME'],
  ['Morgan Reed', 'SME'],
  ['Casey Patel', 'SME'],
  ['Jamie Fox', 'Member'],
  ['Robin Hale', 'Member'],
  ['Drew Palmer', 'Member'],
  ['Quinn Avery', 'Member'],
  ['Skyler Brooks', 'Member'],
  ['Emery Cole', 'Member'],
  ['Rowan Diaz', 'Member'],
  ['Sage Ellis', 'Member'],
  ['Parker Flynn', 'Member'],
  ['Dakota Gray', 'Member'],
  ['Reese Hart', 'Member'],
  ['Finley Ito', 'Member']
];
const SEEDS = ['order-1', 'order-2', 'order-3', 'order-4', 'order-5'];
const RENAME_SUFFIX = ' [R]';

function csvCell(value) {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(filename, rows) {
  const text = '\uFEFF' + [['Name', 'Role'], ...rows]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n');
  const file = path.join(OUT, filename);
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

// A coprime stride produces a deterministic permutation of all 19 rows.
const INTERLEAVED = PEOPLE.map((_, i) => PEOPLE[(i * 7 + 3) % PEOPLE.length]);
const RENAMED = PEOPLE.map(([name, role]) => [role === 'Member' ? name + RENAME_SUFFIX : name, role]);
const FILES = {
  base: writeCsv('order-base.csv', PEOPLE),
  reversed: writeCsv('order-reversed.csv', [...PEOPLE].reverse()),
  interleaved: writeCsv('order-interleaved.csv', INTERLEAVED),
  renamed: writeCsv('order-renamed.csv', RENAMED)
};

function stripSuffix(name) {
  return name.endsWith(RENAME_SUFFIX) ? name.slice(0, -RENAME_SUFFIX.length) : name;
}
function normalized(board) {
  return {
    aAll: board.aAll.map(stripSuffix),
    fAll: board.fAll.map(stripSuffix),
    aSme: board.aSme.length,
    fSme: board.fSme.length,
    aCount: board.aCount,
    fCount: board.fCount
  };
}

async function setSpeed(page, value = 4) {
  await page.locator('#speedRange').evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function loadRoster(page, file) {
  await page.locator('#fileInput').setInputFiles(file);
  await page.waitForFunction(
    name => document.querySelector('#fileName').textContent.includes(name),
    path.basename(file),
    { timeout: 10000 }
  );
  await page.waitForTimeout(550);
  const count = (await page.locator('#rosterCount').textContent()).trim();
  assert(count === '19 人', `${path.basename(file)} loads 19 people`);
}

async function readBoard(page) {
  const board = await page.evaluate(() => {
    const texts = sel => Array.from(document.querySelectorAll(sel)).map(n => n.textContent.trim());
    return {
      aLead: texts('#teamALead .lead-name'),
      fLead: texts('#teamFLead .lead-name'),
      aSme: texts('#teamAList .member.is-sme .member-name'),
      fSme: texts('#teamFList .member.is-sme .member-name'),
      aMembers: texts('#teamAList .member-name'),
      fMembers: texts('#teamFList .member-name'),
      aCount: parseInt(document.querySelector('#teamACount').textContent, 10),
      fCount: parseInt(document.querySelector('#teamFCount').textContent, 10)
    };
  });
  board.aAll = [...board.aLead, ...board.aMembers];
  board.fAll = [...board.fLead, ...board.fMembers];
  return board;
}

async function run(page, seed, skip) {
  await page.locator('#seedInput').fill(seed);
  await page.locator('#startBtn').click();
  await page.waitForSelector('#skipBtn', { state: 'visible', timeout: 5000 });
  if (skip) await page.locator('#skipBtn').click();
  await page.waitForFunction(
    () => document.querySelector('.draw-console').classList.contains('complete'),
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(150);
  return readBoard(page);
}

function verifyConstraints(board, label) {
  const a = normalized(board);
  assert(a.aCount + a.fCount === 19, `${label}: team totals sum to 19`);
  assert(board.aLead.length + board.fLead.length >= 2, `${label}: at least 2 leads`);
  assert(Math.abs(board.aLead.length - board.fLead.length) <= 1, `${label}: lead split within 1 (${board.aLead.length}/${board.fLead.length})`);
  assert(a.aSme + a.fSme === 5, `${label}: all 5 SMEs placed`);
  assert(Math.abs(a.aSme - a.fSme) <= 1, `${label}: SME split within 1 (${a.aSme}/${a.fSme})`);
  assert(Math.abs(a.aCount - a.fCount) <= 1, `${label}: balanced sizes (${a.aCount}/${a.fCount})`);
}

function sameList(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function sameSet(a, b) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.waitForTimeout(350);
  await setSpeed(page, 4);

  console.log('\n[load permutations]');
  const results = {};
  for (const [key, file] of Object.entries(FILES)) {
    await loadRoster(page, file);
    results[key] = {};
    for (const seed of SEEDS) {
      results[key][seed] = normalized(await run(page, seed, true));
    }
    console.log(`  - ${key}: ${SEEDS.length} seeds drawn`);
  }

  console.log('\n[order independence]');
  for (const seed of SEEDS) {
    const ref = results.base[seed];
    for (const key of ['reversed', 'interleaved']) {
      const other = results[key][seed];
      assert(sameList(other.aAll, ref.aAll), `${key} / ${seed}: Team A identical in both membership and order`);
      assert(sameList(other.fAll, ref.fAll), `${key} / ${seed}: Team F identical in both membership and order`);
      assert(other.aCount === ref.aCount && other.fCount === ref.fCount, `${key} / ${seed}: team sizes match`);
    }
  }
  verifyConstraints(await run(page, 'order-check', true), 'order-check');

  console.log('\n[reveal order independence]');
  await loadRoster(page, FILES.base);
  const animatedBase = normalized(await run(page, 'order-anim', false));
  await loadRoster(page, FILES.reversed);
  const animatedReversed = normalized(await run(page, 'order-anim', false));
  assert(sameList(animatedReversed.aAll, animatedBase.aAll), 'animated Team A order matches after reordering');
  assert(sameList(animatedReversed.fAll, animatedBase.fAll), 'animated Team F order matches after reordering');

  console.log('\n[names affect the draw]');
  let changed = 0;
  for (const seed of SEEDS) {
    const base = results.base[seed];
    const renamed = results.renamed[seed];
    if (!sameSet(base.aAll, renamed.aAll) || !sameSet(base.fAll, renamed.fAll)) changed++;
  }
  assert(changed > 0, `renaming members changes the draw (${changed}/${SEEDS.length} seeds)`);

  assert(errors.length === 0, 'no console or page errors: ' + (errors.join(' | ') || 'none'));
  console.log('\nORDER TESTS PASSED');
  await browser.close();
})().catch(err => { console.error('ORDER FAILED:', err.message); process.exit(1); });

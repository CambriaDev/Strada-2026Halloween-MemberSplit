/* MemberSplit application logic */
(function () {
  'use strict';

  /* ---------------- constants ---------------- */

  const DEFAULT_TEAMS = ['Team A', 'Team F'];
  const LS_KEY = 'membersplit.prefs.v1';
  const MAX_ROWS = 5000;
  const MAX_COLS = 64;
  const MAX_FILE_SIZE = 30 * 1024 * 1024;
  const ROLE_RANK = { lead: 0, sme: 1, member: 2 };

  const PUMPKIN_MARK = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5.7C11 3.8 11.5 2.4 13.1 1.6c.3 1.5 0 2.8-1 3.8" stroke="#8fd14f" stroke-width="1.6" stroke-linecap="round"/><path d="M12 5.2c-4.9 0-8 3.1-8 7.3 0 4.9 3.6 8.1 8 8.1s8-3.2 8-8.1c0-4.2-3.1-7.3-8-7.3Z" fill="currentColor"/><path d="m8.3 11.2 1.5 1.8 1.3-2M12.9 13l1.3-2 1.5 1.8M9.5 16.1c1.6.9 3.4.9 5 0" stroke="#03110B" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const NAME_HEADERS = [
    '姓名', '名字', '成员姓名', '人员姓名', '员工姓名', '成员', '人员', '员工', '队员',
    '参与人', '参会人', '名字', 'name', 'full name', 'fullname', 'member', 'member name',
    'members', 'participant', 'participants', 'employee', 'attendee'
  ];
  const ROLE_HEADERS = [
    '角色', '身份', '人员类型', '成员类型', '职位', '职级', '职能',
    'role', 'roles', 'team role', 'title', 'position', 'function', 'seniority'
  ];

  const DEMO_PEOPLE = [
    { name: '林知远', role: 'lead' },
    { name: 'Maya Chen', role: 'lead' },
    { name: '周若琳', role: 'sme' },
    { name: '陈默', role: 'sme' },
    { name: 'Priya Nair', role: 'sme' },
    { name: '高桥健', role: 'sme' },
    { name: 'Lucas Meyer', role: 'sme' },
    { name: '王芳', role: 'member' },
    { name: '李雷', role: 'member' },
    { name: '韩梅梅', role: 'member' },
    { name: '张伟', role: 'member' },
    { name: '刘洋', role: 'member' },
    { name: '陈晨', role: 'member' },
    { name: '赵敏', role: 'member' },
    { name: '孙悦', role: 'member' },
    { name: '周杰', role: 'member' },
    { name: '吴倩', role: 'member' },
    { name: '郑爽', role: 'member' },
    { name: '冯程', role: 'member' },
    { name: '蒋雯', role: 'member' },
    { name: '沈括', role: 'member' },
    { name: '何夕', role: 'member' },
    { name: '宋佳', role: 'member' },
    { name: '唐宁', role: 'member' },
    { name: '薛峰', role: 'member' },
    { name: '邓超', role: 'member' },
    { name: '曹颖', role: 'member' },
    { name: '彭飞', role: 'member' }
  ];

  /* ---------------- state + elements ---------------- */

  const state = {
    wb: null,
    sheetNames: [],
    sheetName: '',
    fileName: '',
    fileSize: 0,
    sourceKind: 'none',
    rows: [],
    maxCols: 0,
    truncated: false,
    startRow: 1,
    nameCol: 0,
    roleCol: -1,
    participants: [],
    teamNames: DEFAULT_TEAMS.slice(),
    seedInput: '',
    speed: 1,
    plan: null,
    stale: false,
    animating: false,
    revealCounts: [emptyCounts(), emptyCounts()],
    anim: { token: 0, timer: null, rollTimer: null }
  };

  const el = {};
  const EL_IDS = [
    'topSeed', 'topSeedText', 'aboutBtn', 'footerGuide', 'aboutDialog', 'aboutClose',
    'fileInput', 'dropzone', 'dzIdle', 'browseBtn', 'demoBtn',
    'fileRow', 'fileName', 'fileMeta', 'replaceFileBtn', 'fileClear',
    'sourceConfig', 'sheetSelect', 'startRowInput', 'nameColSelect', 'roleColSelect',
    'configHint', 'demoNote', 'sourceStatus', 'sourceStatusText',
    'rolesStatus', 'rolesStatusText', 'leadCount', 'smeCount', 'rosterCount', 'rolesPanel',    'roleSearch', 'roleResetBtn', 'roleList', 'roleEmpty', 'roleHint',
    'teamAName', 'teamFName', 'seedInput', 'seedTodayBtn', 'seedDiceBtn', 'seedHint',
    'speedRange', 'speedLabel', 'speedHint', 'startBtn', 'startBtnText', 'validation', 'validationText',
    'emptyState', 'emptyBrowseBtn', 'emptyDemoBtn',
    'stageMain', 'stageStatus', 'stageStatusText', 'stageMeta', 'stageStartBtn',
    'replayBtn', 'regroupBtn', 'copyBtn', 'exportCsvBtn', 'exportXlsxBtn',
    'staleBanner', 'staleRegroupBtn',
    'checkLead', 'checkLeadValue', 'checkSme', 'checkSmeValue', 'checkBalance', 'checkBalanceValue',
    'drawConsole', 'drawStatus', 'drawPhase', 'drawCounter', 'slotCard', 'slotAvatar',
    'slotName', 'slotRole', 'destValue', 'skipBtn', 'progressBar',
    'panelA', 'panelF', 'teamATitle', 'teamFTitle', 'teamACount', 'teamFCount',
    'teamALeadCount', 'teamASmeCount', 'teamAMemberCount',
    'teamFLeadCount', 'teamFSmeCount', 'teamFMemberCount',
    'teamALead', 'teamFLead', 'teamAList', 'teamFList',
    'toast', 'toastText', 'confetti', 'dragOverlay'
  ];

  /* ---------------- small utilities ---------------- */

  function emptyCounts() { return { lead: 0, sme: 0, member: 0, total: 0 }; }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function todaySeed() {
    const d = new Date();
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  }
  function formatDateTime(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function fileStamp() {
    const d = new Date();
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  }
  function formatSize(bytes) {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function cleanCell(v) {
    return String(v == null ? '' : v).replace(/\uFEFF/g, '').replace(/\s+/g, ' ').trim();
  }
  function cell(row, index) {
    if (!row || index < 0 || index >= row.length) return '';
    return row[index] == null ? '' : String(row[index]);
  }
  function columnName(index) {
    let n = index + 1, s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  function truncate(s, len) {
    s = String(s == null ? '' : s);
    return Array.from(s).length > len ? Array.from(s).slice(0, len).join('') + '…' : s;
  }
  function normHeader(v) {
    return String(v == null ? '' : v).trim().toLowerCase().replace(/[\s_\-—–·:：()（）\[\]【】]/g, '');
  }
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }
  // Names are the only stable identity when a roster is reordered, so draw
  // keys come from the seed and the name, never from the row position.
  function seedKey(seed, salt, name) {
    return hashString(`${seed}\u0000${salt}\u0000${name}`);
  }
  function orderBySeed(pool, seed, salt) {
    return pool.slice().sort((a, b) => {
      const diff = seedKey(seed, salt, a.name) - seedKey(seed, salt, b.name);
      if (diff) return diff;
      // Hash collisions are broken by name; two entries with the same name
      // are indistinguishable in the output.
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }
  function seedCoin(seed, label) {
    return (hashString(`${seed}\u0000${label}`) & 1) === 1;
  }
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length > 1) {
      const a = Array.from(parts[0])[0] || '';
      const b = Array.from(parts[parts.length - 1])[0] || '';
      return (a + b).toUpperCase();
    }
    return Array.from(parts[0]).slice(0, 2).join('').toUpperCase();
  }
  function hueFor(name) {
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  function isReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------------- role parsing ---------------- */

  function parseRole(value) {
    const s = String(value == null ? '' : value).trim().toLowerCase();
    if (!s) return null;
    if (/team\s*leads?|(^|[^a-z])leads?([^a-z]|$)|(^|[^a-z])lead(?:er)?s?([^a-z]|$)|(^|[^a-z])tl([^a-z]|$)|队长|组长|领队|负责人/.test(s)) return 'lead';
    if (/(^|[^a-z])smes?([^a-z]|$)|subject\s*matter\s*expert|专家/.test(s)) return 'sme';
    if (/^(member|members|普通成员|成员|组员|员工)$/.test(s)) return 'member';
    return null;
  }

  function headerNameScore(value) {
    const s = normHeader(value);
    if (!s) return 0;
    let score = 0;
    for (const raw of NAME_HEADERS) {
      const k = normHeader(raw);
      if (!k) continue;
      if (s === k) score = Math.max(score, 5);
      else if (/[\u4e00-\u9fff]/.test(k) && s.includes(k)) score = Math.max(score, 4);
      else if (k === 'member' && /^members?(name)?$/.test(s)) score = Math.max(score, 3);
      else if (k === 'name' && s.endsWith('name') && !/^(username|filename|lastname|firstname|surname|companyname|teamname)$/.test(s)) score = Math.max(score, 2);
    }
    if (/^(role|roles|角色|身份|职位|职级)$/.test(s)) score = 0;
    return score;
  }

  function headerRoleScore(value) {
    const s = normHeader(value);
    if (!s) return 0;
    let score = 0;
    for (const raw of ROLE_HEADERS) {
      const k = normHeader(raw);
      if (!k) continue;
      if (s === k) score = Math.max(score, 5);
      else if (/[\u4e00-\u9fff]/.test(k) && s.includes(k)) score = Math.max(score, 3);
      else if (k === 'role' && s.includes('role')) score = Math.max(score, 3);
    }
    return score;
  }

  function columnHasRoleValues(rows, startRow, col) {
    const end = Math.min(rows.length, startRow - 1 + 300);
    for (let r = startRow - 1; r < end; r++) {
      const role = parseRole(cell(rows[r], col));
      if (role === 'lead' || role === 'sme') return true;
    }
    return false;
  }

  function pickNameColumn(rows) {
    const sample = rows.slice(0, Math.min(rows.length, 140));
    const maxCols = Math.min(Math.max(1, ...sample.map(r => r.length)), MAX_COLS);
    let bestCol = 0, bestScore = -1;
    for (let c = 0; c < maxCols; c++) {
      let nonEmpty = 0, numeric = 0, email = 0, roleish = 0;
      const unique = new Set();
      for (const row of sample) {
        const v = cleanCell(cell(row, c));
        if (!v) continue;
        nonEmpty++;
        unique.add(v.toLowerCase());
        if (/^[-+]?\d+([.,]\d+)?$/.test(v)) numeric++;
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) email++;
        if (parseRole(v)) roleish++;
      }
      if (!nonEmpty) continue;
      const uniqueRatio = unique.size / nonEmpty;
      const score = unique.size * (1 - numeric / nonEmpty) * (1 - email / nonEmpty) * (1 - roleish / nonEmpty) + uniqueRatio;
      if (score > bestScore) { bestScore = score; bestCol = c; }
    }
    return bestCol;
  }

  function detectConfig(rows) {
    const limit = Math.min(rows.length, 12);
    // Pick the most convincing header row, weighing a name header and a role
    // header together. This prevents data values like "Member" from being
    // mistaken for the header further down the sheet.
    let headerRow = -1;
    let headerScore = 0;
    let headerNameCol = -1;
    let headerRoleCol = -1;
    for (let r = 0; r < limit; r++) {
      const row = rows[r] || [];
      let bestName = 0, bestNameCol = -1, bestRole = 0, bestRoleCol = -1;
      const maxC = Math.min(row.length, MAX_COLS);
      for (let c = 0; c < maxC; c++) {
        const ns = headerNameScore(row[c]);
        if (ns > bestName) { bestName = ns; bestNameCol = c; }
        const rs = headerRoleScore(row[c]);
        if (rs > bestRole) { bestRole = rs; bestRoleCol = c; }
      }
      const total = bestName + bestRole;
      if (bestName > 0 && total > headerScore) {
        headerScore = total;
        headerRow = r;
        headerNameCol = bestNameCol;
        headerRoleCol = bestRole > 0 ? bestRoleCol : -1;
      }
    }

    let startRow = 1;
    let nameCol = 0;
    let roleCol = -1;
    if (headerRow >= 0) {
      startRow = headerRow + 2;
      nameCol = headerNameCol;
      if (headerRoleCol >= 0 && headerRoleCol !== nameCol && columnHasRoleValues(rows, startRow, headerRoleCol)) {
        roleCol = headerRoleCol;
      }
    } else {
      nameCol = pickNameColumn(rows);
    }

    if (roleCol < 0) {
      const maxC = Math.min(MAX_COLS, Math.max(1, ...rows.slice(0, Math.min(rows.length, 200)).map(r => r.length)));
      let bestRole = { score: 0, col: -1 };
      for (let c = 0; c < maxC; c++) {
        if (c === nameCol) continue;
        let lead = 0, sme = 0;
        const end = Math.min(rows.length, startRow - 1 + 300);
        for (let r = startRow - 1; r < end; r++) {
          const role = parseRole(cell(rows[r], c));
          if (role === 'lead') lead++;
          else if (role === 'sme') sme++;
        }
        const sc = lead * 3 + sme * 2;
        if (sc > bestRole.score) bestRole = { score: sc, col: c };
      }
      if (bestRole.score > 0) roleCol = bestRole.col;
    }

    return { startRow, nameCol, roleCol };
  }

  /* ---------------- preferences ---------------- */

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (Array.isArray(p.teams) && p.teams.length === 2) {
        const t0 = String(p.teams[0] || '').trim();
        const t1 = String(p.teams[1] || '').trim();
        if (t0) state.teamNames[0] = t0.slice(0, 28);
        if (t1) state.teamNames[1] = t1.slice(0, 28);
      }
      if (typeof p.speed === 'number' && Number.isFinite(p.speed)) {
        state.speed = clamp(p.speed, 0.5, 4);
      }
    } catch (e) { /* storage is optional */ }
  }
  function savePrefs() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ teams: state.teamNames, speed: state.speed }));
    } catch (e) { /* storage is optional */ }
  }

  /* ---------------- init / events ---------------- */

  function init() {
    EL_IDS.forEach(id => { el[id] = document.getElementById(id); });
    const missing = EL_IDS.filter(id => !el[id]);
    if (missing.length && window.console) console.warn('Missing elements:', missing);

    loadPrefs();
    state.seedInput = todaySeed();

    el.seedInput.value = state.seedInput;
    el.speedRange.value = String(state.speed);
    syncTeamNameInputs();
    bindEvents();
    updateSourceStatus();
    renderRoleList();
    updateRoleSummary();
    updateSpeedUI();
    updateSeedHint();
    updateTopSeed();
    refreshValidation();
    refreshStage();
  }

  function bindEvents() {
    el.browseBtn.addEventListener('click', e => { e.stopPropagation(); openFilePicker(); });
    el.dropzone.addEventListener('click', openFilePicker);
    el.dropzone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker(); }
    });
    el.emptyBrowseBtn.addEventListener('click', openFilePicker);
    el.replaceFileBtn.addEventListener('click', openFilePicker);
    el.demoBtn.addEventListener('click', loadDemo);
    el.emptyDemoBtn.addEventListener('click', loadDemo);
    el.fileClear.addEventListener('click', clearSource);
    el.fileInput.addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) handleFile(f);
    });

    el.sheetSelect.addEventListener('change', onSheetChange);
    el.startRowInput.addEventListener('change', onStartRowChange);
    el.startRowInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onStartRowChange(); } });
    let startRowTimer = null;
    el.startRowInput.addEventListener('input', () => {
      if (startRowTimer) clearTimeout(startRowTimer);
      startRowTimer = setTimeout(() => { startRowTimer = null; onStartRowChange(); }, 420);
    });
    el.nameColSelect.addEventListener('change', onNameColChange);
    el.roleColSelect.addEventListener('change', onRoleColChange);

    el.roleList.addEventListener('click', onRolePick);
    el.roleSearch.addEventListener('input', applyRoleFilter);
    el.roleResetBtn.addEventListener('click', resetRolesFromColumn);

    el.teamAName.addEventListener('input', () => onTeamNameInput(0, el.teamAName.value, el.teamAName));
    el.teamFName.addEventListener('input', () => onTeamNameInput(1, el.teamFName.value, el.teamFName));
    el.teamATitle.addEventListener('input', () => onTeamNameInput(0, el.teamATitle.value, el.teamATitle));
    el.teamFTitle.addEventListener('input', () => onTeamNameInput(1, el.teamFTitle.value, el.teamFTitle));
    [[el.teamAName, 0], [el.teamFName, 1], [el.teamATitle, 0], [el.teamFTitle, 1]].forEach(([inp, i]) => {
      inp.addEventListener('blur', () => onTeamNameBlur(i));
    });

    el.seedInput.addEventListener('input', onSeedInput);
    el.seedTodayBtn.addEventListener('click', () => {
      el.seedInput.value = todaySeed();
      onSeedInput();
      toast('已使用今天日期作为种子');
    });
    el.seedDiceBtn.addEventListener('click', () => {
      el.seedInput.value = String(Math.floor(10000000 + Math.random() * 90000000));
      onSeedInput();
      toast('已生成随机种子');
    });
    el.speedRange.addEventListener('input', onSpeedInput);

    el.startBtn.addEventListener('click', () => startGrouping());
    el.stageStartBtn.addEventListener('click', () => startGrouping());
    el.regroupBtn.addEventListener('click', () => startGrouping({ newSeed: true }));
    el.staleRegroupBtn.addEventListener('click', () => startGrouping({ newSeed: true }));

    el.replayBtn.addEventListener('click', replay);
    el.exportXlsxBtn.addEventListener('click', exportXlsx);
    el.exportCsvBtn.addEventListener('click', exportCsv);
    el.copyBtn.addEventListener('click', copyResults);
    el.skipBtn.addEventListener('click', skipReveal);
    el.topSeed.addEventListener('click', () => {
      el.seedInput.focus();
      if (el.seedInput.select) el.seedInput.select();
      el.seedInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    el.aboutBtn.addEventListener('click', openAbout);
    el.footerGuide.addEventListener('click', openAbout);
    el.aboutClose.addEventListener('click', () => el.aboutDialog.close());
    el.aboutDialog.addEventListener('click', e => {
      if (e.target === el.aboutDialog) el.aboutDialog.close();
    });

    el.dropzone.addEventListener('dragenter', e => e.preventDefault());
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.animating && !el.aboutDialog.open) {
        e.preventDefault();
        skipReveal();
      }
    });
  }

  function openFilePicker() {
    el.fileInput.click();
  }

  /* ---------------- file handling ---------------- */

  function onDragEnter(e) {
    if (!hasFileDrag(e)) return;
    e.preventDefault();
    el.dragOverlay.classList.add('show');
  }
  function onDragOver(e) {
    if (!hasFileDrag(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    el.dragOverlay.classList.add('show');
  }
  function onDragLeave(e) {
    if (!hasFileDrag(e)) return;
    if (e.relatedTarget && document.documentElement.contains(e.relatedTarget)) return;
    el.dragOverlay.classList.remove('show');
  }
  function onDrop(e) {
    e.preventDefault();
    el.dragOverlay.classList.remove('show');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  }
  function hasFileDrag(e) {
    if (!e.dataTransfer) return false;
    const types = e.dataTransfer.types;
    if (!types) return false;
    for (let i = 0; i < types.length; i++) if (types[i] === 'Files') return true;
    return false;
  }

  async function handleFile(file) {
    if (typeof XLSX === 'undefined') {
      toast('内置 Excel 解析引擎未加载，无法读取文件。', 'error');
      return;
    }
    if (!/\.(xlsx|xlsm|xlsb|xls|csv)$/i.test(file.name)) {
      toast('仅支持 .xlsx / .xls / .xlsm / .xlsb / .csv 文件。', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast('文件超过 30 MB，请精简名单后再试。', 'error');
      return;
    }

    let wb;
    try {
      const buffer = await file.arrayBuffer();
      wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
    } catch (err) {
      console.error(err);
      toast('无法读取该文件，请确认它是有效的 Excel / CSV。', 'error');
      return;
    }
    if (!wb || !wb.SheetNames || !wb.SheetNames.length) {
      toast('工作簿中没有可用的工作表。', 'error');
      return;
    }

    cancelReveal();
    state.wb = wb;
    state.sheetNames = wb.SheetNames.slice();
    state.sheetName = wb.SheetNames[0];
    state.fileName = file.name;
    state.fileSize = file.size;
    state.sourceKind = 'file';
    state.plan = null;
    state.stale = false;

    el.fileName.textContent = file.name;
    el.fileName.title = file.name;
    updateFileMeta();
    showSourceUI('file');
    buildSheetSelect();
    loadSheet(state.sheetName, { auto: true });
    revealOnMobile();
    toast(`已读取 ${file.name}`, 'success');
  }

  function updateFileMeta() {
    if (state.sourceKind === 'file') {
      el.fileMeta.textContent = `${state.sheetNames.length} 个工作表 · ${formatSize(state.fileSize)}`;
    } else if (state.sourceKind === 'demo') {
      el.fileMeta.textContent = `内置数据 · ${state.participants.length} 人`;
    } else {
      el.fileMeta.textContent = '—';
    }
  }

  function showSourceUI(kind) {
    el.dzIdle.hidden = kind !== 'none';
    el.fileRow.hidden = kind === 'none';
    el.sourceConfig.hidden = kind !== 'file';
    el.demoNote.hidden = kind !== 'demo';
    if (kind === 'none') {
      el.sourceStatusText.textContent = '未导入';
      el.sourceStatus.classList.remove('live');
    }
  }

  function buildSheetSelect() {
    el.sheetSelect.innerHTML = '';
    state.sheetNames.forEach(name => {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      el.sheetSelect.appendChild(o);
    });
    el.sheetSelect.value = state.sheetName;
    el.sheetSelect.disabled = !state.sheetNames.length;
  }

  function onSheetChange() {
    if (!state.wb) return;
    const name = el.sheetSelect.value;
    if (!name || name === state.sheetName) return;
    cancelReveal();
    state.plan = null;
    state.stale = false;
    loadSheet(name, { auto: true });
  }

  function parseWorksheet(ws) {
    if (!ws || !ws['!ref']) return { rows: [], maxCols: 0, truncated: false };
    let range;
    try { range = XLSX.utils.decode_range(ws['!ref']); } catch (e) { return { rows: [], maxCols: 0, truncated: false }; }
    const endR = Math.min(range.e.r, range.s.r + MAX_ROWS - 1);
    const endC = Math.min(range.e.c, range.s.c + MAX_COLS - 1);
    const truncated = range.e.r > endR || range.e.c > endC;
    let raw;
    try {
      raw = XLSX.utils.sheet_to_json(ws, {
        header: 1, raw: false, defval: '', blankrows: true,
        range: { s: { r: range.s.r, c: range.s.c }, e: { r: endR, c: endC } }
      });
    } catch (e) {
      console.error(e);
      raw = [];
    }
    const rows = [];
    for (let i = 0; i < range.s.r; i++) rows.push([]);
    for (const rawRow of raw) {
      const row = new Array(range.s.c).fill('');
      for (const v of rawRow) row.push(cleanCell(v));
      rows.push(row);
    }
    let maxCols = range.s.c;
    for (const row of rows) maxCols = Math.max(maxCols, row.length);
    for (const row of rows) while (row.length < maxCols) row.push('');
    return { rows, maxCols, truncated };
  }

  function loadSheet(name, opts) {
    const auto = !opts || opts.auto !== false;
    cancelReveal();
    state.plan = null;
    state.stale = false;
    const ws = state.wb && state.wb.Sheets[name];
    if (!ws) { toast('无法读取该工作表。', 'error'); return; }

    state.sheetName = name;
    const parsed = parseWorksheet(ws);
    state.rows = parsed.rows;
    state.maxCols = parsed.maxCols;
    state.truncated = parsed.truncated;

    const cfg = auto ? detectConfig(state.rows) : { startRow: state.startRow, nameCol: state.nameCol, roleCol: state.roleCol };
    state.startRow = clamp(parseInt(cfg.startRow, 10) || 1, 1, Math.max(1, state.rows.length));
    state.nameCol = clamp(parseInt(cfg.nameCol, 10) || 0, 0, Math.max(0, state.maxCols - 1));
    state.roleCol = (cfg.roleCol >= 0 && cfg.roleCol < state.maxCols) ? cfg.roleCol : -1;

    el.sheetSelect.value = name;
    el.startRowInput.max = String(Math.max(1, state.rows.length));
    el.startRowInput.value = String(state.startRow);
    refreshColumnOptions();
    rebuildRoster();
    updateSourceStatus();
    updateFileMeta();
    refreshStage();
    updateTopSeed();
    updateSpeedUI();
    if (parsed.truncated) toast('工作表较大，仅读取前 5000 行 / 64 列。', 'info');
  }

  function collectColumns() {
    const cols = [];
    if (!state.rows.length) return cols;
    const headerRow = state.startRow >= 2 ? state.rows[state.startRow - 2] : null;
    const max = Math.min(state.maxCols, MAX_COLS);
    for (let c = 0; c < max; c++) {
      let sample = '';
      let hasData = headerRow && cleanCell(cell(headerRow, c)) ? true : false;
      const end = Math.min(state.rows.length, state.startRow - 1 + 200);
      for (let r = state.startRow - 1; r < end; r++) {
        const v = cleanCell(cell(state.rows[r], c));
        if (v) { if (!sample) sample = v; hasData = true; break; }
      }
      if (!hasData && c !== state.nameCol && c !== state.roleCol) continue;
      const header = headerRow ? cleanCell(cell(headerRow, c)) : '';
      let label = columnName(c);
      if (header) label += ` · ${header}`;
      if (sample && (!header || sample !== header)) label += ` · ${sample}`;
      cols.push({ index: c, label: truncate(label, 44) });
    }
    return cols;
  }

  function refreshColumnOptions() {
    const cols = collectColumns();
    if (!cols.length) cols.push({ index: 0, label: 'A' });

    el.nameColSelect.innerHTML = '';
    cols.forEach(c => {
      const o = document.createElement('option');
      o.value = String(c.index);
      o.textContent = c.label;
      el.nameColSelect.appendChild(o);
    });
    const hasName = cols.some(c => c.index === state.nameCol);
    state.nameCol = hasName ? state.nameCol : cols[0].index;
    el.nameColSelect.value = String(state.nameCol);

    el.roleColSelect.innerHTML = '';
    const noRole = document.createElement('option');
    noRole.value = '-1';
    noRole.textContent = '不指定（手动标记）';
    el.roleColSelect.appendChild(noRole);
    cols.forEach(c => {
      if (c.index === state.nameCol) return;
      const o = document.createElement('option');
      o.value = String(c.index);
      o.textContent = c.label;
      el.roleColSelect.appendChild(o);
    });
    const roleOk = state.roleCol >= 0 && state.roleCol !== state.nameCol && cols.some(c => c.index === state.roleCol);
    if (!roleOk) state.roleCol = -1;
    el.roleColSelect.value = String(state.roleCol);

    el.roleResetBtn.disabled = state.roleCol < 0 || !state.participants.length;
  }

  function rebuildRoster() {
    const roleCol = state.roleCol;
    const list = [];
    for (let r = state.startRow - 1; r < state.rows.length; r++) {
      const row = state.rows[r];
      const name = cleanCell(cell(row, state.nameCol));
      if (!name) continue;
      const rawRole = roleCol >= 0 ? cleanCell(cell(row, roleCol)) : '';
      const role = roleCol >= 0 ? (parseRole(rawRole) || 'member') : 'member';
      list.push({ id: `p${r}_${list.length}`, index: list.length, name, role, row: r + 1, sourceRole: rawRole });
    }
    state.participants = list;

    renderRoleList();
    updateRoleSummary();
    updateConfigHint();
    updateSourceStatus();
    updateFileMeta();
    refreshValidation();
    updateSpeedUI();
    if (state.plan) {
      markStale();
    } else {
      refreshStage();
      updateTopSeed();
    }
  }

  function updateConfigHint() {
    if (state.sourceKind !== 'file') return;
    if (!state.rows.length) {
      el.configHint.textContent = '当前工作表为空，请选择其他工作表。';
      el.configHint.classList.add('warn');
      return;
    }
    const n = state.participants.length;
    const parts = [];
    parts.push(`第 ${state.startRow} 行起`);
    parts.push(`姓名列 ${columnName(state.nameCol)}`);
    if (state.roleCol >= 0) parts.push(`角色列 ${columnName(state.roleCol)}`);
    parts.push(`${n} 人`);
    if (state.truncated) parts.push('仅读取前 5000 行 / 64 列');
    let text = parts.join(' · ');
    if (n === 0) {
      text += '。未读取到姓名，请检查起始行与姓名列。';
      el.configHint.classList.add('warn');
    } else {
      const counts = new Map();
      state.participants.forEach(p => counts.set(p.name, (counts.get(p.name) || 0) + 1));
      const dup = Array.from(counts.entries()).filter(([, c]) => c > 1);
      if (dup.length) text += ` · 有 ${dup.length} 个重复姓名`;
      if (state.roleCol < 0) text += ' · 未指定角色列，可手动标记角色';
      el.configHint.classList.remove('warn');
    }
    el.configHint.textContent = text;
  }

  function updateSourceStatus() {
    if (state.sourceKind === 'none') {
      el.sourceStatusText.textContent = '未导入';
      el.sourceStatus.classList.remove('live');
      return;
    }
    if (state.sourceKind === 'demo') {
      el.sourceStatusText.textContent = state.participants.length ? '示例数据' : '示例为空';
      el.sourceStatus.classList.toggle('live', state.participants.length > 0);
      return;
    }
    el.sourceStatusText.textContent = state.participants.length ? '已读取' : '未读取到姓名';
    el.sourceStatus.classList.toggle('live', state.participants.length > 0);
  }

  function onStartRowChange() {
    if (state.sourceKind !== 'file' || !state.rows.length) return;
    let sr = parseInt(el.startRowInput.value, 10);
    if (!Number.isFinite(sr)) sr = 1;
    sr = clamp(sr, 1, Math.max(1, state.rows.length));
    if (sr === state.startRow) { el.startRowInput.value = String(sr); return; }
    state.startRow = sr;
    el.startRowInput.value = String(sr);
    refreshColumnOptions();
    rebuildRoster();
  }

  function onNameColChange() {
    if (state.sourceKind !== 'file' || !state.rows.length) return;
    const nc = parseInt(el.nameColSelect.value, 10);
    if (!Number.isFinite(nc)) return;
    state.nameCol = nc;
    if (state.roleCol === nc) state.roleCol = -1;
    refreshColumnOptions();
    rebuildRoster();
  }

  function onRoleColChange() {
    if (state.sourceKind !== 'file' || !state.rows.length) return;
    const rc = parseInt(el.roleColSelect.value, 10);
    const newRole = Number.isFinite(rc) ? rc : -1;
    state.roleCol = (newRole >= 0 && newRole !== state.nameCol) ? newRole : -1;
    el.roleColSelect.value = String(state.roleCol);
    if (state.roleCol === -1) {
      // Switching to manual mode keeps the currently assigned roles.
      el.roleResetBtn.disabled = true;
      updateConfigHint();
      updateRoleSummary();
      refreshValidation();
      if (state.plan) markStale(); else refreshStage();
    } else {
      rebuildRoster();
    }
  }

  function resetRolesFromColumn() {
    if (state.roleCol < 0 || !state.participants.length) {
      toast('当前没有可重新识别的角色列。', 'error');
      return;
    }
    state.participants.forEach(p => {
      const raw = cleanCell(cell(state.rows[p.row - 1], state.roleCol));
      p.sourceRole = raw;
      p.role = parseRole(raw) || 'member';
    });
    renderRoleList();
    updateRoleSummary();
    refreshValidation();
    if (state.plan) markStale(); else refreshStage();
    toast('已按角色列重新识别角色。', 'success');
  }

  function clearSource() {
    cancelReveal();
    state.wb = null;
    state.sheetNames = [];
    state.sheetName = '';
    state.fileName = '';
    state.fileSize = 0;
    state.sourceKind = 'none';
    state.rows = [];
    state.maxCols = 0;
    state.truncated = false;
    state.startRow = 1;
    state.nameCol = 0;
    state.roleCol = -1;
    state.participants = [];
    state.plan = null;
    state.stale = false;
    el.fileInput.value = '';
    el.sheetSelect.innerHTML = '';
    el.nameColSelect.innerHTML = '';
    el.roleColSelect.innerHTML = '';
    el.startRowInput.value = '1';
    el.configHint.textContent = '载入文件后自动识别表头与姓名列。';
    el.configHint.classList.remove('warn');
    showSourceUI('none');
    updateSourceStatus();
    renderRoleList();
    updateRoleSummary();
    updateConfigHint();
    refreshValidation();
    refreshStage();
    updateTopSeed();
    updateSpeedUI();
    toast('已清除当前名单。');
  }

  function loadDemo() {
    cancelReveal();
    state.wb = null;
    state.sheetNames = [];
    state.sheetName = '';
    state.fileName = '内置示例名单';
    state.fileSize = 0;
    state.sourceKind = 'demo';
    state.rows = [];
    state.maxCols = 0;
    state.truncated = false;
    state.startRow = 1;
    state.nameCol = 0;
    state.roleCol = -1;
    state.plan = null;
    state.stale = false;
    state.participants = DEMO_PEOPLE.map((p, i) => ({
      id: `demo-${i}`, index: i, name: p.name, role: p.role, row: i + 2, sourceRole: p.role
    }));
    el.fileName.textContent = '内置示例名单';
    el.fileName.title = '内置示例名单';
    showSourceUI('demo');
    updateSourceStatus();
    updateFileMeta();
    renderRoleList();
    updateRoleSummary();
    updateConfigHint();
    refreshValidation();
    refreshStage();
    updateTopSeed();
    updateSpeedUI();
    revealOnMobile();
    toast('已载入内置示例名单，可直接开始分组。', 'success');
  }

  function revealOnMobile() {
    if (!window.matchMedia('(max-width:1020px)').matches) return;
    setTimeout(() => {
      const target = getValidation().ok ? el.stageMain : el.rolesPanel;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 90);
  }

  /* ---------------- role UI ---------------- */

  function renderRoleList() {
    el.roleList.innerHTML = '';
    const hasPeople = state.participants.length > 0;
    el.roleList.hidden = !hasPeople;
    el.roleEmpty.hidden = hasPeople;
    el.roleSearch.disabled = !hasPeople;
    el.roleSearch.value = '';
    if (!hasPeople) return;

    const frag = document.createDocumentFragment();
    for (const p of state.participants) {
      const row = document.createElement('div');
      row.className = `role-row role-${p.role}`;
      row.dataset.pid = p.id;

      const av = document.createElement('span');
      av.className = 'role-avatar';
      av.style.setProperty('--h', String(hueFor(p.name)));
      av.textContent = initials(p.name);

      const name = document.createElement('span');
      name.className = 'role-name';
      name.textContent = p.name;
      name.title = p.name;

      const group = document.createElement('div');
      group.className = 'role-swatches';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', `${p.name} 的角色`);
      [['member', 'Member'], ['lead', 'Team Lead'], ['sme', 'SME']].forEach(([v, t]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `role-swatch role-${v}`;
        btn.dataset.role = v;
        btn.setAttribute('aria-label', t);
        btn.setAttribute('aria-pressed', String(p.role === v));
        group.appendChild(btn);
      });

      row.append(av, name, group);
      frag.appendChild(row);
    }
    el.roleList.appendChild(frag);
  }

  function applyRoleFilter() {
    const q = el.roleSearch.value.trim().toLowerCase();
    const rows = el.roleList.querySelectorAll('.role-row');
    rows.forEach(row => {
      const name = row.querySelector('.role-name');
      const text = name ? name.textContent.toLowerCase() : '';
      row.hidden = !!q && !text.includes(q);
    });
  }

  function onRolePick(e) {
    const btn = e.target.closest('.role-swatch');
    if (!btn) return;
    const row = btn.closest('.role-row');
    if (!row) return;
    const p = state.participants.find(x => x.id === row.dataset.pid);
    if (!p || p.role === btn.dataset.role) return;
    p.role = btn.dataset.role;
    row.className = `role-row role-${p.role}`;
    row.querySelectorAll('.role-swatch').forEach(b => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    updateRoleSummary();
    refreshValidation();
    if (state.plan) markStale(); else refreshStage();
  }

  function updateRoleSummary() {
    const leads = state.participants.filter(p => p.role === 'lead').length;
    const smes = state.participants.filter(p => p.role === 'sme').length;
    const n = state.participants.length;
    const valid = leads >= 2 && smes >= 2;

    el.leadCount.innerHTML = `<span class="cdot"></span>${leads}/≥2`;
    el.smeCount.innerHTML = `<span class="cdot"></span>${smes}/≥2`;
    el.leadCount.className = 'count-chip lead' + (leads >= 2 ? ' ok' : '');
    el.smeCount.className = 'count-chip sme' + (smes >= 2 ? ' ok' : '');
    el.rosterCount.textContent = `${n} 人`;

    if (n === 0) {
      el.rolesStatusText.textContent = '待载入';
      el.rolesStatus.classList.remove('live');
    } else {
      el.rolesStatusText.innerHTML = `<i class="rs-dot lead"></i><span class="rs-num lead">${leads}</span><i class="rs-dot sme"></i><span class="rs-num sme">${smes}</span>`;
      el.rolesStatus.classList.toggle('live', valid);
    }

    let hint = '';
    let cls = 'role-hint';
    if (n === 0) {
      hint = '角色将决定分组约束：金色与紫色角色各至少 2 名。';
    } else if (valid) {
      hint = '角色配置符合要求：金色 ≥ 2 / 紫色 ≥ 2。';
      cls += ' ok';
    } else if (state.roleCol < 0) {
      hint = `未指定角色列。请在列表中手动设置：金色与紫色角色各至少 2 名（当前金色 ${leads}、紫色 ${smes}）。`;
      cls += ' warn';
    } else {
      hint = `需要金色与紫色角色各至少 2 名（当前金色 ${leads}、紫色 ${smes}）。可直接在列表中调整。`;
      cls += ' warn';
    }
    el.roleHint.textContent = hint;
    el.roleHint.className = cls;
    el.roleResetBtn.disabled = state.roleCol < 0 || n === 0;
  }

  /* ---------------- team names ---------------- */

  function teamName(i) {
    return (state.teamNames[i] || '').trim() || DEFAULT_TEAMS[i];
  }

  function syncTeamNameInputs(except) {
    const pairs = [[el.teamAName, el.teamATitle, 0], [el.teamFName, el.teamFTitle, 1]];
    for (const [side, head, i] of pairs) {
      const v = state.teamNames[i];
      if (side && side !== except && side.value !== v) side.value = v;
      if (head && head !== except && head.value !== v) head.value = v;
    }
  }

  function onTeamNameInput(i, value, source) {
    state.teamNames[i] = String(value).slice(0, 28);
    syncTeamNameInputs(source);
    savePrefs();
  }

  function onTeamNameBlur(i) {
    if (!String(state.teamNames[i] || '').trim()) {
      state.teamNames[i] = DEFAULT_TEAMS[i];
    } else {
      state.teamNames[i] = String(state.teamNames[i]).trim();
    }
    syncTeamNameInputs();
    savePrefs();
  }

  /* ---------------- validation / speed / seed ---------------- */

  function getValidation() {
    const n = state.participants.length;
    const leads = state.participants.filter(p => p.role === 'lead').length;
    const smes = state.participants.filter(p => p.role === 'sme').length;
    if (n === 0) return { ok: false, msg: '请先导入 Excel 名单，或载入内置示例名单。' };
    if (n < 4) return { ok: false, msg: `名单至少需要 4 名成员（金色与紫色角色各 2 名，当前 ${n} 人）。` };
    if (leads < 2) return { ok: false, msg: `金色角色至少需要 2 名（当前 ${leads} 名）。` };
    if (smes < 2) return { ok: false, msg: `紫色角色至少需要 2 名（当前 ${smes} 名）。` };
    return { ok: true, msg: `名单与角色已就绪 · ${n} 人 · 金色 ${leads} / 紫色 ${smes}。` };
  }

  function refreshValidation() {
    const v = getValidation();
    const hasPeople = state.participants.length > 0;
    el.validation.className = 'validation' + (v.ok ? ' ok' : hasPeople ? ' err' : '');
    el.validationText.textContent = v.msg;
    el.startBtn.disabled = !v.ok;
    el.stageStartBtn.disabled = !v.ok;
    el.startBtn.title = v.ok ? '' : v.msg;
    let label = '开始分组';
    if (state.plan) label = state.stale ? '按新配置重新分组' : '重新分组';
    el.startBtnText.textContent = label;
    updateSpeedUI();
  }

  function computeTiming(n) {
    const speed = clamp(Number(state.speed) || 1, 0.25, 8);
    const total = Math.max(5000, n * 60) / speed;
    const per = total / Math.max(n, 1);
    return {
      total,
      roll: Math.max(35, per * 0.72),
      gap: Math.max(14, per * 0.28)
    };
  }

  function formatSpeed(s) {
    const n = Math.round(s * 100) / 100;
    return `${n}×`;
  }

  function updateSpeedUI() {
    el.speedLabel.textContent = formatSpeed(state.speed);
    if (!state.participants.length) {
      el.speedHint.textContent = '载入名单后显示预计时长。';
      return;
    }
    const t = computeTiming(state.participants.length);
    const sec = (t.total + 500 / state.speed) / 1000;
    el.speedHint.textContent = `预计约 ${sec.toFixed(1)} 秒揭晓全部（${state.participants.length} 人）。`;
  }

  function onSpeedInput() {
    const v = parseFloat(el.speedRange.value);
    state.speed = Number.isFinite(v) ? clamp(v, 0.5, 4) : 1;
    updateSpeedUI();
    savePrefs();
  }

  function onSeedInput() {
    state.seedInput = el.seedInput.value;
    updateTopSeed();
    updateSeedHint();
    if (state.plan) markStale();
    else updateStageChrome();
  }

  function updateSeedHint() {
    if (!state.seedInput.trim()) {
      el.seedHint.textContent = '留空：开始分组时使用当前毫秒时间戳。';
    } else {
      el.seedHint.textContent = '相同姓名、角色与种子 = 相同结果（与名单顺序无关）。';
    }
  }

  function updateTopSeed() {
    const text = state.plan
      ? `种子 ${state.plan.seedUsed}`
      : (state.seedInput.trim() ? `种子 ${state.seedInput.trim()}` : '种子 · 时间戳');
    el.topSeedText.textContent = text;
    el.topSeed.title = state.plan
      ? `本次分组种子：${state.plan.seedUsed}${state.plan.seedWasBlank ? '（时间戳）' : ''}`
      : '点击修改种子；留空时使用毫秒时间戳';
  }

  /* ---------------- group planning ---------------- */

  function buildPlan(participants, seedUsed, seedWasBlank) {
    const seed = String(seedUsed);
    const leads = orderBySeed(participants.filter(p => p.role === 'lead'), seed, 'lead');
    const smes = orderBySeed(participants.filter(p => p.role === 'sme'), seed, 'sme');
    const members = orderBySeed(participants.filter(p => p.role === 'member'), seed, 'member');

    if (leads.length < 2 || smes.length < 2) throw new Error('角色数量不符合要求');

    const total = participants.length;
    const leadExtraA = seedCoin(seed, 'lead-split');
    // When both pools are odd, give the two odd extras to opposite teams so
    // the role bases stay within one person of each other.
    const smeExtraA = leads.length % 2 === 1 && smes.length % 2 === 1
      ? !leadExtraA
      : seedCoin(seed, 'sme-split');
    const leadCountA = Math.floor(leads.length / 2) + (leads.length % 2 === 1 && leadExtraA ? 1 : 0);
    const smeCountA = Math.floor(smes.length / 2) + (smes.length % 2 === 1 && smeExtraA ? 1 : 0);
    const teamOf = new Map();

    // Each role pool is split as evenly as possible, so the two teams never
    // differ by more than one lead or one SME.
    leads.forEach((p, i) => {
      teamOf.set(p.id, i < leadCountA ? 0 : 1);
    });
    smes.forEach((p, i) => {
      teamOf.set(p.id, i < smeCountA ? 0 : 1);
    });

    const baseA = leadCountA + smeCountA;
    const baseF = (leads.length - leadCountA) + (smes.length - smeCountA);
    // Even rosters split exactly in half; odd rosters give one team the extra
    // seat by a seed-derived coin. Role bases can force a one-person difference
    // when there are too few members to compensate.
    let targetA = Math.floor(total / 2) + (total % 2 === 1 && seedCoin(seed, 'odd-extra') ? 1 : 0);
    targetA = Math.max(baseA, Math.min(total - baseF, targetA));

    // Compensation: fill towards balanced target sizes, never exceeding the
    // role bases. The final difference is 0 or 1 (well within the <= 3 rule).
    const memberOrder = orderBySeed(members, seed, 'member-fill');
    const needA = targetA - baseA;
    memberOrder.forEach((p, i) => {
      teamOf.set(p.id, i < needA ? 0 : 1);
    });

    const copies = new Map(participants.map(p => [p.id, Object.assign({}, p)]));
    const teamA = [];
    const teamF = [];
    for (const p of participants) {
      const cp = copies.get(p.id);
      (teamOf.get(p.id) === 0 ? teamA : teamF).push(cp);
    }
    // Presentation order is name-based too, so exports do not change when the
    // source roster is reordered.
    const sorter = (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role]
      || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    teamA.sort(sorter);
    teamF.sort(sorter);

    // Reveal order gets its own seed keys so team assignment does not clump.
    const revealOrder = [];
    orderBySeed(members, seed, 'reveal-member').forEach(p => revealOrder.push({ person: copies.get(p.id), team: teamOf.get(p.id) }));
    orderBySeed(smes, seed, 'reveal-sme').forEach(p => revealOrder.push({ person: copies.get(p.id), team: teamOf.get(p.id) }));
    orderBySeed(leads, seed, 'reveal-lead').forEach(p => revealOrder.push({ person: copies.get(p.id), team: teamOf.get(p.id) }));

    const leadA = teamA.filter(p => p.role === 'lead').length;
    const leadF = teamF.filter(p => p.role === 'lead').length;
    const smeA = teamA.filter(p => p.role === 'sme').length;
    const smeF = teamF.filter(p => p.role === 'sme').length;
    const diff = Math.abs(teamA.length - teamF.length);
    const checks = {
      leads: leadA + leadF === leads.length && Math.abs(leadA - leadF) <= 1,
      smes: smeA + smeF === smes.length && Math.abs(smeA - smeF) <= 1,
      balance: diff <= 3
    };
    if (!checks.leads || !checks.smes || !checks.balance) throw new Error('约束校验失败');

    return {
      seedUsed: String(seedUsed),
      seedWasBlank: !!seedWasBlank,
      generatedAt: new Date(),
      total,
      teamA,
      teamF,
      revealOrder,
      allPeople: participants.map(p => copies.get(p.id)),
      counts: { a: teamA.length, f: teamF.length, leadA, leadF, smeA, smeF, diff },
      checks
    };
  }

  function startGrouping(opts) {
    const newSeed = !!(opts && opts.newSeed);
    if (newSeed) {
      el.seedInput.value = String(Date.now());
      state.seedInput = el.seedInput.value;
      updateTopSeed();
      updateSeedHint();
    }
    // Apply a pending start-row edit immediately so the draw never uses a
    // roster that differs from the visible configuration.
    if (state.sourceKind === 'file' && el.startRowInput.value !== String(state.startRow)) {
      onStartRowChange();
    }
    const v = getValidation();
    if (!v.ok) {
      toast(v.msg, 'error');
      shake(el.startBtn);
      return;
    }

    const rawSeed = state.seedInput.trim();
    const seedUsed = rawSeed || String(Date.now());
    let plan;
    try {
      plan = buildPlan(state.participants, seedUsed, rawSeed === '');
    } catch (err) {
      console.error(err);
      toast(`分组失败：${err.message}`, 'error');
      return;
    }

    cancelReveal();
    state.plan = plan;
    state.stale = false;
    state.animating = false;
    updateTopSeed();
    renderPlanBoard(plan);

    if (window.matchMedia('(max-width:1020px)').matches) {
      el.stageMain.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    startReveal();
  }

  function markStale() {
    if (!state.plan) return;
    state.stale = true;
    if (!state.animating) {
      el.drawConsole.classList.remove('running');
    }
    updateStageChrome();
  }

  /* ---------------- stage chrome ---------------- */

  function refreshStage() {
    const hasSource = state.sourceKind !== 'none';
    el.emptyState.hidden = hasSource;
    el.stageMain.hidden = !hasSource;
    if (!hasSource) {
      updateTopSeed();
      updateSpeedUI();
      return;
    }
    if (!state.plan) {
      renderReadyStage();
    } else {
      updateStageChrome();
    }
    updateTopSeed();
    updateSpeedUI();
  }

  function updateStageChrome() {
    const plan = state.plan;
    const v = getValidation();

    let status = '准备就绪';
    let statusCls = '';
    if (state.animating) { status = '抽取中'; statusCls = 'running'; }
    else if (plan && state.stale) { status = '结果已过期'; statusCls = 'stale'; }
    else if (plan) { status = '已完成'; statusCls = 'done'; }
    el.stageStatusText.textContent = status;
    el.stageStatus.className = `status-pill ${statusCls}`.trim();

    el.stageStartBtn.hidden = !!plan;
    el.stageStartBtn.disabled = !v.ok;
    const showResult = !!plan;
    [el.replayBtn, el.regroupBtn, el.copyBtn, el.exportCsvBtn, el.exportXlsxBtn].forEach(b => { b.hidden = !showResult; });
    el.replayBtn.disabled = state.animating || state.stale;
    el.regroupBtn.disabled = state.animating || !v.ok;
    el.copyBtn.disabled = state.animating || state.stale || !plan;
    el.exportCsvBtn.disabled = state.animating || state.stale || !plan;
    el.exportXlsxBtn.disabled = state.animating || state.stale || !plan;
    el.staleBanner.hidden = !(plan && state.stale);
    el.staleRegroupBtn.disabled = !v.ok;
    el.skipBtn.hidden = !state.animating;

    if (plan) {
      const meta = [
        { text: `种子 ${plan.seedUsed}${plan.seedWasBlank ? '（时间戳）' : ''}`, cls: 'mono' },
        formatDateTime(plan.generatedAt),
        `${plan.total} 人`
      ];
      setStageMeta(meta);
    } else if (state.participants.length) {
      const leads = state.participants.filter(p => p.role === 'lead').length;
      const smes = state.participants.filter(p => p.role === 'sme').length;
      setStageMeta([
        `${state.participants.length} 人`,
        { text: `● ${leads}`, cls: 'meta-role meta-lead' },
        { text: `● ${smes}`, cls: 'meta-role meta-sme' },
        { text: `种子 ${state.seedInput.trim() || '时间戳（留空）'}`, cls: 'mono' }
      ]);
    } else {
      setStageMeta([{ text: '等待有效的名单与角色', cls: 'mono' }]);
    }

    renderChecks(plan, !!plan && !state.animating);
    el.startBtnText.textContent = plan ? (state.stale ? '按新配置重新分组' : '重新分组') : '开始分组';
  }

  function setStageMeta(parts) {
    el.stageMeta.textContent = '';
    parts.forEach((part, i) => {
      if (i) {
        const sep = document.createElement('span');
        sep.className = 'msep';
        el.stageMeta.appendChild(sep);
      }
      const span = document.createElement('span');
      if (part && typeof part === 'object') {
        span.className = part.cls || '';
        span.textContent = part.text;
      } else {
        span.textContent = String(part);
      }
      el.stageMeta.appendChild(span);
    });
  }

  function renderChecks(plan, verified) {
    const ids = [
      [el.checkLead, el.checkLeadValue],
      [el.checkSme, el.checkSmeValue],
      [el.checkBalance, el.checkBalanceValue]
    ];
    const ok = !!plan && verified;
    ids.forEach(([chip]) => chip.classList.toggle('ok', ok));

    if (plan && verified) {
      el.checkLeadValue.textContent = `${plan.counts.leadA} / ${plan.counts.leadF}`;
      el.checkSmeValue.textContent = `${plan.counts.smeA} / ${plan.counts.smeF}`;
      el.checkBalanceValue.textContent = `${plan.counts.diff} ≤ 3`;
    } else if (plan) {
      el.checkLeadValue.textContent = '—';
      el.checkSmeValue.textContent = '—';
      el.checkBalanceValue.textContent = '—';
    } else {
      el.checkLeadValue.textContent = '差 ≤ 1';
      el.checkSmeValue.textContent = '差 ≤ 1';
      el.checkBalanceValue.textContent = '≤ 3';
    }
  }

  /* ---------------- rendering teams ---------------- */

  function setSlotPumpkin() {
    el.slotAvatar.innerHTML = PUMPKIN_MARK;
    el.slotAvatar.classList.add('glyph');
    el.slotAvatar.style.removeProperty('--h');
  }

  function clearSlotGlyph() {
    el.slotAvatar.classList.remove('glyph');
  }

  function resetTeamPanels() {
    syncTeamNameInputs();
    state.revealCounts = [emptyCounts(), emptyCounts()];
    const panels = [
      { lead: el.teamALead, list: el.teamAList, count: el.teamACount },
      { lead: el.teamFLead, list: el.teamFList, count: el.teamFCount }
    ];
    panels.forEach(p => {
      p.lead.className = 'lead-slot';
      p.lead.innerHTML = '<span class="lead-placeholder">待抽取</span>';
      p.list.innerHTML = '<div class="list-placeholder">成员将在这里落位</div>';
      p.count.textContent = '0';
    });
    updateTeamHeader(0);
    updateTeamHeader(1);
  }

  function updateTeamHeader(i) {
    const c = state.revealCounts[i];
    const countEl = i === 0 ? el.teamACount : el.teamFCount;
    const leadEl = i === 0 ? el.teamALeadCount : el.teamFLeadCount;
    const smeEl = i === 0 ? el.teamASmeCount : el.teamFSmeCount;
    const memberEl = i === 0 ? el.teamAMemberCount : el.teamFMemberCount;
    if (countEl) countEl.textContent = String(c.total);
    if (leadEl) leadEl.textContent = String(c.lead);
    if (smeEl) smeEl.textContent = String(c.sme);
    if (memberEl) memberEl.textContent = String(c.member);
  }

  function addMember(teamIdx, person, animate) {
    const c = state.revealCounts[teamIdx];
    c[person.role]++;
    c.total++;
    if (person.role === 'lead') fillLeadSlot(teamIdx, person, animate);
    else appendMemberCard(teamIdx, person, animate);
    updateTeamHeader(teamIdx);
  }

  function fillLeadSlot(teamIdx, person, animate) {
    const slot = teamIdx === 0 ? el.teamALead : el.teamFLead;
    const placeholder = slot.querySelector('.lead-placeholder');
    if (placeholder) placeholder.remove();
    slot.className = 'lead-slot filled';
    const card = document.createElement('div');
    card.className = 'lead-card' + (animate ? ' enter' : '');
    const av = document.createElement('div');
    av.className = 'lead-avatar';
    av.textContent = initials(person.name);
    const copy = document.createElement('div');
    copy.className = 'lead-copy';
    const name = document.createElement('div');
    name.className = 'lead-name';
    name.textContent = person.name;
    name.title = person.name;
    copy.appendChild(name);
    card.append(av, copy);
    slot.appendChild(card);
  }

  function appendMemberCard(teamIdx, person, animate) {
    const list = teamIdx === 0 ? el.teamAList : el.teamFList;
    const placeholder = list.querySelector('.list-placeholder');
    if (placeholder) placeholder.remove();
    const card = createMemberCard(person, animate);
    const rank = ROLE_RANK[person.role];
    const existing = Array.from(list.children).filter(child => child.classList.contains('member'));
    let before = null;
    for (const child of existing) {
      if (Number(child.dataset.rank || 9) > rank) { before = child; break; }
    }
    if (before) list.insertBefore(card, before);
    else list.appendChild(card);
  }

  function createMemberCard(person, animate) {
    const card = document.createElement('div');
    card.className = 'member' + (person.role === 'sme' ? ' is-sme' : '') + (animate ? ' enter' : '');
    card.dataset.rank = String(ROLE_RANK[person.role]);
    card.dataset.pid = person.id;

    const av = document.createElement('div');
    av.className = 'avatar';
    av.style.setProperty('--h', String(hueFor(person.name)));
    av.textContent = initials(person.name);

    const name = document.createElement('div');
    name.className = 'member-name';
    name.textContent = person.name;
    name.title = person.name;

    card.append(av, name);
    return card;
  }

  function revealAllMembers(plan) {
    resetTeamPanels();
    [plan.teamA, plan.teamF].forEach((team, idx) => {
      for (const p of team) addMember(idx, p, false);
    });
    updateTeamHeader(0);
    updateTeamHeader(1);
  }

  function renderReadyStage() {
    resetTeamPanels();
    const n = state.participants.length;
    el.drawConsole.className = 'draw-console';
    el.drawConsole.removeAttribute('data-team');
    el.drawStatus.textContent = 'READY';
    el.drawPhase.textContent = n ? '等待抽取' : '未读取到成员';
    el.drawCounter.textContent = `0 / ${n}`;
    el.slotCard.className = 'dc-slot';
    if (n) {
      setSlotPumpkin();
    } else {
      clearSlotGlyph();
      el.slotAvatar.textContent = '—';
      el.slotAvatar.style.removeProperty('--h');
    }
    el.slotName.textContent = n ? '准备开始' : '等待名单';
    el.slotRole.textContent = n ? `${n} 位成员已就位` : '请导入名单或调整读取设置';
    el.destValue.textContent = n ? '等待开始' : '—';
    el.progressBar.style.width = '0%';
    el.skipBtn.hidden = true;
    updateStageChrome();
  }

  function renderPlanBoard(plan) {
    resetTeamPanels();
    el.drawConsole.className = 'draw-console';
    el.drawConsole.removeAttribute('data-team');
    el.drawStatus.textContent = 'READY';
    el.drawPhase.textContent = '准备抽取';
    el.drawCounter.textContent = `0 / ${plan.total}`;
    el.slotCard.className = 'dc-slot';
    setSlotPumpkin();
    el.slotName.textContent = '准备开始';
    el.slotRole.textContent = `${plan.total} 位成员`;
    el.destValue.textContent = '抽取中…';
    el.progressBar.style.width = '0%';
    el.skipBtn.hidden = true;
    renderChecks(plan, false);
    updateStageChrome();
  }

  /* ---------------- animation ---------------- */

  function clearAnimTimers() {
    if (state.anim.timer) { clearTimeout(state.anim.timer); state.anim.timer = null; }
    if (state.anim.rollTimer) { clearInterval(state.anim.rollTimer); state.anim.rollTimer = null; }
  }

  function cancelReveal() {
    state.anim.token++;
    clearAnimTimers();
    state.animating = false;
    if (el.skipBtn) el.skipBtn.hidden = true;
    if (el.drawConsole) el.drawConsole.classList.remove('running');
  }

  function startReveal() {
    const plan = state.plan;
    if (!plan) return;
    clearAnimTimers();
    const token = ++state.anim.token;
    state.animating = true;
    const timing0 = computeTiming(plan.total);

    el.drawConsole.classList.remove('complete');
    el.drawConsole.classList.add('running');
    el.drawConsole.removeAttribute('data-team');
    el.drawStatus.textContent = 'DRAWING';
    el.drawPhase.textContent = '准备抽取';
    el.drawCounter.textContent = `0 / ${plan.total}`;
    el.skipBtn.hidden = false;
    el.skipBtn.disabled = false;
    updateStageChrome();

    let i = 0;
    const people = plan.allPeople;

    const step = () => {
      if (token !== state.anim.token) return;
      if (i >= plan.revealOrder.length) { finalizeReveal(false); return; }

      const entry = plan.revealOrder[i];
      const timing = computeTiming(plan.total);
      el.drawPhase.textContent = '抽取成员';
      el.destValue.textContent = '抽取中…';
      el.drawConsole.removeAttribute('data-team');
      el.slotCard.className = `dc-slot rolling role-${entry.person.role}`;
      el.slotRole.textContent = '抽取中…';

      const flipEvery = clamp(timing.roll / 3, 30, 85);
      clearInterval(state.anim.rollTimer);
      state.anim.rollTimer = setInterval(() => {
        if (token !== state.anim.token) return;
        const p = people[Math.floor(Math.random() * people.length)];
        el.slotName.textContent = p.name;
        clearSlotGlyph();
        el.slotAvatar.textContent = initials(p.name);
        el.slotAvatar.style.setProperty('--h', String(hueFor(p.name)));
      }, flipEvery);

      state.anim.timer = setTimeout(() => {
        if (token !== state.anim.token) return;
        if (state.anim.rollTimer) { clearInterval(state.anim.rollTimer); state.anim.rollTimer = null; }
        lockEntry(entry);
        i++;
        el.drawCounter.textContent = `${i} / ${plan.total}`;
        el.progressBar.style.width = `${(i / plan.total) * 100}%`;
        if (i >= plan.total) {
          state.anim.timer = setTimeout(() => {
            if (token !== state.anim.token) return;
            finalizeReveal(false);
          }, Math.max(160, 520 / clamp(state.speed, 0.25, 8)));
          return;
        }
        state.anim.timer = setTimeout(step, timing.gap);
      }, timing.roll);
    };

    state.anim.timer = setTimeout(step, Math.max(160, 620 / clamp(state.speed, 0.25, 8)));
  }

  function lockEntry(entry) {
    const idx = entry.team;
    const tName = teamName(idx);
    el.drawConsole.dataset.team = String(idx);
    el.slotCard.className = `dc-slot locked team-${idx === 0 ? 'a' : 'f'} role-${entry.person.role}`;
    el.slotName.textContent = entry.person.name;
    clearSlotGlyph();
    el.slotAvatar.textContent = initials(entry.person.name);
    el.slotAvatar.style.removeProperty('--h');
    el.slotRole.textContent = '已入队';
    el.destValue.textContent = `→ ${tName}`;
    addMember(idx, entry.person, true);
  }

  function finalizeReveal(skipped) {
    const plan = state.plan;
    if (!plan) return;
    clearAnimTimers();
    state.animating = false;
    if (skipped) revealAllMembers(plan);
    // Ensure counters match the plan exactly.
    state.revealCounts = [
      { lead: plan.counts.leadA, sme: plan.counts.smeA, member: plan.counts.a - plan.counts.leadA - plan.counts.smeA, total: plan.counts.a },
      { lead: plan.counts.leadF, sme: plan.counts.smeF, member: plan.counts.f - plan.counts.leadF - plan.counts.smeF, total: plan.counts.f }
    ];
    updateTeamHeader(0);
    updateTeamHeader(1);

    el.drawConsole.classList.remove('running');
    el.drawConsole.classList.add('complete');
    el.drawConsole.removeAttribute('data-team');
    el.drawStatus.textContent = 'COMPLETE';
    el.drawPhase.textContent = '分组完成';
    el.drawCounter.textContent = `${plan.total} / ${plan.total}`;
    el.slotCard.className = 'dc-slot complete';
    clearSlotGlyph();
    el.slotAvatar.textContent = '✓';
    el.slotAvatar.style.removeProperty('--h');
    el.slotName.textContent = '分组完成';
    el.slotRole.textContent = `${plan.total} 位成员已就位`;
    el.destValue.textContent = '全部入队';
    el.progressBar.style.width = '100%';
    el.skipBtn.hidden = true;
    renderChecks(plan, true);
    updateStageChrome();
    if (!skipped) burstConfetti();
  }

  function skipReveal() {
    if (!state.animating || !state.plan) return;
    state.anim.token++;
    clearAnimTimers();
    state.animating = false;
    finalizeReveal(true);
  }

  function replay() {
    if (!state.plan || state.animating || state.stale) return;
    cancelReveal();
    renderPlanBoard(state.plan);
    startReveal();
  }

  /* ---------------- export ---------------- */

  function canExport() {
    if (!state.plan) { toast('还没有可导出的分组结果。', 'error'); return false; }
    if (state.stale) { toast('名单或角色已更新，请先重新分组。', 'error'); return false; }
    if (state.animating) { toast('动画尚未结束，请稍候或跳过动画。', 'error'); return false; }
    return true;
  }

  function exportRows() {
    const plan = state.plan;
    const rows = [];
    const rowCount = Math.max(plan.teamA.length, plan.teamF.length);
    // Side-by-side layout: Team A names in column A, an empty separator in
    // column B, Team F names in column C. No role column and no header row.
    for (let i = 0; i < rowCount; i++) {
      rows.push([
        plan.teamA[i] ? plan.teamA[i].name : '',
        '',
        plan.teamF[i] ? plan.teamF[i].name : ''
      ]);
    }
    return rows;
  }

  function exportInfoRows() {
    const plan = state.plan;
    const source = state.sourceKind === 'demo' ? '内置示例名单' : state.fileName || '—';
    return [
      ['MemberSplit 分组信息', ''],
      ['队伍一', `${teamName(0)}（${plan.counts.a} 人｜Lead ${plan.counts.leadA}｜SME ${plan.counts.smeA}）`],
      ['队伍二', `${teamName(1)}（${plan.counts.f} 人｜Lead ${plan.counts.leadF}｜SME ${plan.counts.smeF}）`],
      ['人数差', `${plan.counts.diff}（规则上限 3）`],
      ['种子', `${plan.seedUsed}${plan.seedWasBlank ? '（留空，使用毫秒时间戳）' : ''}`],
      ['生成时间', formatDateTime(plan.generatedAt)],
      ['数据来源', source],
      ['工作表', state.sourceKind === 'file' ? state.sheetName : '—'],
      ['起始行', state.sourceKind === 'file' ? state.startRow : '—'],
      ['姓名列', state.sourceKind === 'file' ? columnName(state.nameCol) : '内置数据'],
      ['角色列', state.sourceKind === 'file' ? (state.roleCol >= 0 ? columnName(state.roleCol) : '手动指定') : '内置数据'],
      ['约束', 'Team Lead 两队人数差 ≤ 1；SME 两队人数差 ≤ 1；人数差 ≤ 3'],
      ['复现说明', '相同姓名、角色与种子会得到相同结果，与名单行顺序无关；改名会改变结果'],
      ['工具', 'MemberSplit v1.2 · Halloween Edition · 离线运行']
    ];
  }

  function baseFilename() {
    const a = teamName(0).replace(/[\\/:*?"<>|\s]+/g, '_');
    const b = teamName(1).replace(/[\\/:*?"<>|\s]+/g, '_');
    return truncate(`MemberSplit_${a}_vs_${b}_${fileStamp()}`, 100);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1600);
  }

  function exportXlsx() {
    if (!canExport()) return;
    if (typeof XLSX === 'undefined') { toast('Excel 引擎未加载。', 'error'); return; }
    try {
      const rows = exportRows();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 22 }, { wch: 4 }, { wch: 22 }];
      const wsInfo = XLSX.utils.aoa_to_sheet(exportInfoRows());
      wsInfo['!cols'] = [{ wch: 18 }, { wch: 72 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '分组结果');
      XLSX.utils.book_append_sheet(wb, wsInfo, '分组信息');
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
      triggerDownload(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${baseFilename()}.xlsx`);
      toast('已导出 Excel 文件。', 'success');
    } catch (err) {
      console.error(err);
      toast('导出 Excel 失败，请重试。', 'error');
    }
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    if (!canExport()) return;
    try {
      const rows = exportRows();
      const csv = '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
      triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${baseFilename()}.csv`);
      toast('已导出 CSV 文件。', 'success');
    } catch (err) {
      console.error(err);
      toast('导出 CSV 失败，请重试。', 'error');
    }
  }

  async function copyResults() {
    if (!canExport()) return;
    const rows = exportRows();
    const text = rows.map(r => r.join('\t')).join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast('已复制分组结果到剪贴板。', 'success');
        return;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('已复制分组结果到剪贴板。', 'success');
    } catch (err) {
      console.error(err);
      toast('复制失败，请使用导出功能。', 'error');
    }
  }

  /* ---------------- toast / misc ---------------- */

  let toastTimer = null;
  function toast(msg, type) {
    if (!el.toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    el.toastText.textContent = String(msg);
    el.toast.className = `toast show${type === 'error' ? ' error' : type === 'success' ? ' success' : ''}`;
    toastTimer = setTimeout(() => {
      el.toast.classList.remove('show');
      toastTimer = null;
    }, type === 'error' ? 4200 : 2800);
  }

  function shake(node) {
    if (!node) return;
    node.classList.remove('shake');
    void node.offsetWidth;
    node.classList.add('shake');
    setTimeout(() => node.classList.remove('shake'), 400);
  }

  function openAbout() {
    if (!el.aboutDialog) return;
    if (el.aboutDialog.open) return;
    if (typeof el.aboutDialog.showModal === 'function') el.aboutDialog.showModal();
    else el.aboutDialog.setAttribute('open', '');
  }

  function burstConfetti() {
    if (isReducedMotion()) return;
    const canvas = el.confetti;
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#ff963f', '#b18cff', '#00df72', '#ffc857', '#f2efe3'];
    const parts = [];
    const originX = window.innerWidth / 2;
    const originY = window.innerHeight * 0.3;
    for (let i = 0; i < 130; i++) {
      parts.push({
        x: originX + (Math.random() - 0.5) * 260,
        y: originY + (Math.random() - 0.5) * 50,
        vx: (Math.random() - 0.5) * 10,
        vy: -Math.random() * 9 - 2,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.34,
        life: 1,
        decay: 0.008 + Math.random() * 0.008,
        shape: Math.random() < 0.28 ? 'circle' : (Math.random() < 0.5 ? 'tri' : 'rect')
      });
    }
    const start = performance.now();
    function frame(t) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let alive = false;
      for (const p of parts) {
        if (p.life <= 0) continue;
        alive = true;
        p.vy += 0.16;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.rot += p.vr;
        p.life -= p.decay;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'tri') {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        }
        ctx.restore();
      }
      if (alive && t - start < 4200) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
    requestAnimationFrame(frame);
  }

  init();
})();

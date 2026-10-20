const XLSX = require('../src/vendor/xlsx.full.min.js');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, 'fixtures');
fs.mkdirSync(dir, { recursive: true });

const legacy = [
  ['Avery Stone', 'Team Lead'],
  ['Jordan Blake', 'Team Lead'],
  ['Riley Chen', 'SME'],
  ['Sam Rivera', 'SME'],
  ['Taylor Kim', 'SME'],
  ['Morgan Reed', 'SME'],
  ['Casey Patel', 'SME'],
  ['Jamie Fox', 'Member'],
  ['Robin Hale', 'Member'],
  ['Drew Palmer', 'Member']
];
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([['Employee Name', 'Job Role'], ...legacy]);
XLSX.utils.book_append_sheet(wb, ws, 'Legacy');
fs.writeFileSync(path.join(dir, 'legacy.xls'), Buffer.from(XLSX.write(wb, { bookType: 'xls', type: 'array' })));

const namesOnly = [
  ['Ana Silva', 'Design'],
  ['Ben Carter', 'Design'],
  ['Chloe Adams', 'Data'],
  ['Diego Moraes', 'Data'],
  ['Eva Novak', 'Ops'],
  ['Felix Wong', 'Ops'],
  ['Grace Lee', 'Platform'],
  ['Hugo Martin', 'Platform'],
  ['Iris Khan', 'Research'],
  ['Jon Park', 'Research']
];
const csv = '\uFEFF' + [['Name', 'Department'], ...namesOnly]
  .map(row => row.map(v => /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(','))
  .join('\r\n');
fs.writeFileSync(path.join(dir, 'names-only.csv'), csv, 'utf8');

// Workbook whose used range starts at B3 (no A column), to exercise offsets.
const offsetWs = {};
XLSX.utils.sheet_add_aoa(offsetWs, [
  ['Full Name', 'Role'],
  ['Zoe Bennett', 'Team Lead'],
  ['Owen Price', 'Team Lead'],
  ['Nora Diaz', 'SME'],
  ['Liam Moss', 'SME'],
  ['Ava Park', 'SME'],
  ['Eli Ray', 'SME'],
  ['Mia Cole', 'SME'],
  ['Leo Grant', 'Member'],
  ['Ivy Shaw', 'Member'],
  ['Max Bell', 'Member']
], { origin: 'B3' });
offsetWs['!ref'] = 'B3:C13';
const offsetWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(offsetWb, offsetWs, 'Offset');
fs.writeFileSync(path.join(dir, 'offset.xlsx'), Buffer.from(XLSX.write(offsetWb, { bookType: 'xlsx', type: 'array' })));

console.log('Wrote fixtures');

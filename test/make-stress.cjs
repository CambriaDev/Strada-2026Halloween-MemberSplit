const XLSX = require('../src/vendor/xlsx.full.min.js');
const fs = require('node:fs');
const path = require('node:path');

// Each sheet exercises a different roster size with varied numbers of leads
// and SMEs, including the 4-person minimum and rosters with no plain members.
const CASES = [
  { sheet: 'N4-L2S2', n: 4, leads: 2, smes: 2 },
  { sheet: 'N7-L2S5', n: 7, leads: 2, smes: 5 },
  { sheet: 'N8-L3S2', n: 8, leads: 3, smes: 2 },
  { sheet: 'N9-L4S3', n: 9, leads: 4, smes: 3 },
  { sheet: 'N11-L5S4', n: 11, leads: 5, smes: 4 },
  { sheet: 'N12-L3S9', n: 12, leads: 3, smes: 9 },
  { sheet: 'N50-L7S15', n: 50, leads: 7, smes: 15 }
];
const wb = XLSX.utils.book_new();
for (const { sheet, n, leads, smes } of CASES) {
  const rows = [['Name', 'Role']];
  for (let i = 1; i <= n; i++) {
    let role = 'Member';
    if (i <= leads) role = 'Team Lead';
    else if (i <= leads + smes) role = 'SME';
    rows.push([`Person ${String(i).padStart(2, '0')}`, role]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, sheet);
}
fs.writeFileSync(path.join(__dirname, 'fixtures', 'stress.xlsx'), Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
console.log('Wrote stress.xlsx');

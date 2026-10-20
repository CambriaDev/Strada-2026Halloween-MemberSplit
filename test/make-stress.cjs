const XLSX = require('../src/vendor/xlsx.full.min.js');
const fs = require('node:fs');
const path = require('node:path');

const sizes = [7, 8, 9, 10, 11, 50];
const wb = XLSX.utils.book_new();
for (const n of sizes) {
  const rows = [['Name', 'Role']];
  for (let i = 1; i <= n; i++) {
    let role = 'Member';
    if (i <= 2) role = 'Team Lead';
    else if (i <= 7) role = 'SME';
    rows.push([`Person ${String(i).padStart(2, '0')}`, role]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, `N${n}`);
}
fs.writeFileSync(path.join(__dirname, 'fixtures', 'stress.xlsx'), Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
console.log('Wrote stress.xlsx');

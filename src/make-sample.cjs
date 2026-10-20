const XLSX = require('./vendor/xlsx.full.min.js');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const people = [
  ['林知远', 'Team Lead', 'Platform'],
  ['Maya Chen', 'Team Lead', 'Experience'],
  ['周若琳', 'SME', 'Platform'],
  ['陈默', 'SME', 'Data'],
  ['Priya Nair', 'SME', 'Experience'],
  ['高桥健', 'SME', 'Data'],
  ['Lucas Meyer', 'SME', 'Platform'],
  ['王芳', 'Team Member', 'Experience'],
  ['李雷', 'Team Member', 'Data'],
  ['韩梅梅', 'Team Member', 'Platform'],
  ['张伟', 'Team Member', 'Data'],
  ['刘洋', 'Team Member', 'Experience'],
  ['陈晨', 'Team Member', 'Platform'],
  ['赵敏', 'Team Member', 'Data'],
  ['孙悦', 'Team Member', 'Experience'],
  ['周杰', 'Team Member', 'Platform'],
  ['吴倩', 'Team Member', 'Experience'],
  ['郑爽', 'Team Member', 'Data'],
  ['冯程', 'Team Member', 'Platform'],
  ['蒋雯', 'Team Member', 'Experience'],
  ['沈括', 'Team Member', 'Data'],
  ['何夕', 'Team Member', 'Platform'],
  ['宋佳', 'Team Member', 'Experience'],
  ['唐宁', 'Team Member', 'Data'],
  ['薛峰', 'Team Member', 'Platform'],
  ['邓超', 'Team Member', 'Experience'],
  ['曹颖', 'Team Member', 'Data'],
  ['彭飞', 'Team Member', 'Platform']
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([['Name', 'Role', 'Department'], ...people]);
ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 18 }];
ws['!autofilter'] = { ref: `A1:C${people.length + 1}` };
XLSX.utils.book_append_sheet(wb, ws, 'Roster');

const altPeople = [
  ['TL-01', '林知远', '队长', '平台组'],
  ['TL-02', 'Maya Chen', '队长', '体验组'],
  ['SME-01', '周若琳', 'SME', '平台组'],
  ['SME-02', '陈默', 'SME', '数据组'],
  ['SME-03', 'Priya Nair', 'SME', '体验组'],
  ['SME-04', '高桥健', 'SME', '数据组'],
  ['SME-05', 'Lucas Meyer', 'SME', '平台组'],
  ['M-01', '王芳', '成员', '体验组'],
  ['M-02', '李雷', '成员', '数据组'],
  ['M-03', '韩梅梅', '成员', '平台组'],
  ['M-04', '张伟', '成员', '数据组'],
  ['M-05', '刘洋', '成员', '体验组'],
  ['M-06', '陈晨', '成员', '平台组'],
  ['M-07', '赵敏', '成员', '数据组'],
  ['M-08', '孙悦', '成员', '体验组'],
  ['M-09', '周杰', '成员', '平台组'],
  ['M-10', '吴倩', '成员', '体验组'],
  ['M-11', '郑爽', '成员', '数据组']
];
const alt = XLSX.utils.aoa_to_sheet([
  ['2026 Q4 跨团队工作坊 · 备用名单'],
  [],
  ['序号', '成员姓名', '身份', '所属小组'],
  ...altPeople
]);
alt['!cols'] = [{ wch: 9 }, { wch: 20 }, { wch: 10 }, { wch: 14 }];
XLSX.utils.book_append_sheet(wb, alt, '备用名单');

fs.writeFileSync(path.join(root, 'sample-roster.xlsx'), Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));

const csvPeople = people.slice(0, 12);
const csv = '\uFEFF' + [['Name', 'Role', 'Department'], ...csvPeople]
  .map(row => row.map(v => /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(','))
  .join('\r\n');
fs.writeFileSync(path.join(root, 'sample-roster.csv'), csv, 'utf8');

console.log('Wrote sample-roster.xlsx and sample-roster.csv');

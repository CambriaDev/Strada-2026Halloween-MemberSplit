import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const templatePath = path.join(here, 'template.html');
const vendorPath = path.join(here, 'vendor', 'xlsx.full.min.js');
const appPath = path.join(here, 'app.js');
const outPath = path.join(root, 'MemberSplit.html');
const XLSX_PLACEHOLDER = '/*__XLSX_LIB__*/';
const APP_PLACEHOLDER = '/*__APP_JS__*/';

const template = fs.readFileSync(templatePath, 'utf8');
const vendor = fs.readFileSync(vendorPath, 'utf8');
const app = fs.readFileSync(appPath, 'utf8');

if (!template.includes(XLSX_PLACEHOLDER)) {
  throw new Error(`Build placeholder ${XLSX_PLACEHOLDER} not found in template.`);
}
if (!template.includes(APP_PLACEHOLDER)) {
  throw new Error(`Build placeholder ${APP_PLACEHOLDER} not found in template.`);
}
if (vendor.includes('</script')) {
  throw new Error('Vendor bundle contains a closing script tag and cannot be inlined safely.');
}
if (app.includes('</script')) {
  throw new Error('Application code contains a closing script tag and cannot be inlined safely.');
}

const banner = '/*! SheetJS Community Edition v0.20.3 | (C) 2013-present SheetJS LLC | Apache-2.0 | https://sheetjs.com */\n';
const output = template
  .replace(XLSX_PLACEHOLDER, () => banner + vendor)
  .replace(APP_PLACEHOLDER, () => app);

fs.writeFileSync(outPath, output, 'utf8');
console.log(`Built ${path.relative(root, outPath)} (${(Buffer.byteLength(output) / 1024).toFixed(1)} KB)`);

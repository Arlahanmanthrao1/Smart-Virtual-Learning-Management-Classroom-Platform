// Run after the local verification build; no browser or network access.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const brand = JSON.parse(read('src/branding/brand.json'));
const html = read('.jaas-build-check/index.html');
assert.ok(html.includes(`<title>${brand.name}</title>`));
assert.ok(html.includes(`name="application-name" content="${brand.name}"`));
assert.ok(html.includes(`name="description" content="${brand.description}"`));
assert.ok(html.includes(`name="theme-color" content="${brand.themeColor}"`));
assert.ok(html.includes('href="/brand-mark.svg"'));
assert.equal(read('public/brand-mark.svg'), read('.jaas-build-check/brand-mark.svg'));
for (const oldName of ['LMS Platform', 'Smart Virtual Learning', 'EduAdmin Pro']) {
  assert.ok(!html.includes(oldName));
}
console.log('PASS built metadata and favicon match EKEEKRTA source');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const platform of ['desktop', 'mobile']) {
  const src = path.resolve(__dirname, '../..', platform, 'src');
  const frames = path.join(src, 'icons/frames');
  assert.ok(!fs.existsSync(frames) || fs.readdirSync(frames).length === 0);
  assert.doesNotMatch(fs.readFileSync(path.join(src, 'index.html'), 'utf8'), /profile-frames\.js/);
}
console.log('PASS: desktop and mobile exclude decorative avatar frames.');

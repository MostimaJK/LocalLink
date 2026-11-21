'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { archiveFolder } = require('../src/js/network/folder-archive');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'll-folder-test-'));
  const source = path.join(root, 'source');
  const cache = path.join(root, 'outbox');
  try {
    await fs.mkdir(source);
    await fs.mkdir(cache);
    const bytes = Buffer.alloc(512 * 1024, 123);
    await fs.writeFile(path.join(source, 'binary'), bytes);
    for (const stage of ['scan', 'pack']) {
      const controller = new AbortController();
      await assert.rejects(archiveFolder(source, cache, undefined, {
        signal: controller.signal,
        onProgress(state) {
          if (state.phase === stage && (state.count > 0 || state.bytes > 0)) controller.abort();
        }
      }), { name:'AbortError' });
      assert.deepEqual(await fs.readdir(cache), []);
      assert.deepEqual(await fs.readFile(path.join(source, 'binary')), bytes);
    }
    const measured = [];
    const zip = await archiveFolder(source, cache, undefined, {
      onProgress(state) { if (state.phase === 'pack') measured.push(state.bytes); }
    });
    assert.equal(measured.at(-1), bytes.length);
    assert.ok(measured.some(n => n > 0 && n < bytes.length));
    assert.ok((await fs.readFile(zip)).includes(bytes));
    console.log('PASS folder scan and pack cancellation, source preservation and measured byte progress');
  } finally {
    await fs.rm(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

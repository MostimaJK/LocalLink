'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

async function archiveFolder(source, cache, maxBytes = Number.MAX_SAFE_INTEGER, { signal, onProgress = () => {} } = {}) {
  const root = await fs.promises.realpath(source);
  const entries = [];
  let total = 0;
  async function walk(dir) {
    for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
      signal?.throwIfAborted();
      const file = path.join(dir, entry.name);
      const stat = await fs.promises.lstat(file);
      if (stat.isSymbolicLink()) throw new Error('Folder contains a symbolic link; remove it before sending');
      if (!stat.isDirectory() && !stat.isFile()) continue;
      total += stat.isFile() ? stat.size : 0;
      if (entries.length >= 10000 || !Number.isSafeInteger(total) || total > maxBytes) {
        throw new Error('Folder exceeds transfer limit');
      }
      const name = path.relative(path.dirname(root), file).split(path.sep).join('/');
      entries.push({ file, name, stat });
      onProgress({ phase: 'scan', count: entries.length });
      if (stat.isDirectory()) await walk(file);
    }
  }

  onProgress({ phase: 'scan', count: 0 });
  await walk(root);
  signal?.throwIfAborted();
  const { ZipArchive } = await import('archiver');
  await fs.promises.mkdir(cache, { recursive: true });
  const dir = await fs.promises.mkdtemp(path.join(cache, 'folder-'));
  const dest = path.join(dir, path.basename(root) + '.zip');
  try {
    await new Promise((resolve, reject) => {
      const archive = new ZipArchive({ store: true });
      const output = fs.createWriteStream(dest, { flags: 'wx' });
      let bytes = 0, index = 0, failure, input;
      const fail = error => {
        if (failure) return;
        failure = error;
        input?.destroy();
        archive.abort();
        output.destroy();
      };
      const cancel = () => fail(signal.reason);
      output.once('close', () => {
        signal?.removeEventListener('abort', cancel);
        failure ? reject(failure) : resolve();
      });
      output.on('error', fail);
      archive.on('error', fail);
      archive.on('warning', fail);
      archive.pipe(output);
      signal?.addEventListener('abort', cancel, { once: true });
      onProgress({ phase: 'pack', bytes, total });
      if (signal?.aborted) return cancel();

      async function* readFile(file) {
        input = fs.createReadStream(file, { signal });
        for await (const chunk of input) {
          bytes += chunk.length;
          onProgress({ phase: 'pack', bytes, total });
          yield chunk;
        }
      }
      function next() {
        if (failure) return;
        const entry = entries[index++];
        if (!entry) {
          archive.finalize().catch(fail);
          return;
        }
        const metadata = { name: entry.name, date: entry.stat.mtime, mode: entry.stat.mode };
        if (entry.stat.isDirectory()) {
          archive.append('', { ...metadata, type: 'directory' });
        } else {
          const stream = Readable.from(readFile(entry.file));
          stream.on('error', fail);
          archive.append(stream, metadata);
        }
      }
      archive.on('entry', next);
      if (entries.length) next();
      else archive.append('', { name: path.basename(root) + '/', type: 'directory' });
    });
    if ((await fs.promises.stat(dest)).size > maxBytes) throw new Error('Folder archive exceeds transfer limit');
    return dest;
  } catch (error) {
    await fs.promises.rm(dir, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { archiveFolder };

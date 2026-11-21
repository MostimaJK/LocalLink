'use strict';

const http = require('node:http');
const https = require('node:https');
const { isIP } = require('node:net');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, randomUUID, randomInt, X509Certificate } = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { safeName } = require('../src/js/network/localsend');
const { publishFile } = require('../src/js/network/receive-file');

const lifetime = 15 * 60 * 1000;
const uploadBudget = 1024 ** 3;
const web = path.join(__dirname, '../src/browser-share');
function fail(status) { throw Object.assign(new Error(), { status }); }

function usesTLS() {
  return ['LOCALLINK_SHARE_HOST','LOCALLINK_SHARE_CERT','LOCALLINK_SHARE_KEY'].some(key=>!!process.env[key]);
}
async function startShare({ address, receiveDir, record, allowHttp = false, onPaired, onStopped }) {
  let tls, hostname = address;
  if (usesTLS()) {
    hostname = process.env.LOCALLINK_SHARE_HOST;
    if (!hostname || !/^[a-z0-9.-]+$/i.test(hostname)) throw new Error('Invalid sharing hostname');
    tls = {cert:await fs.readFile(process.env.LOCALLINK_SHARE_CERT), key:await fs.readFile(process.env.LOCALLINK_SHARE_KEY), minVersion:'TLSv1.2'};
    const cert = new X509Certificate(tls.cert);
    if (!(isIP(hostname) ? cert.checkIP(hostname) : cert.checkHost(hostname)) ||
        Date.now() < Date.parse(cert.validFrom) || Date.now()+lifetime >= Date.parse(cert.validTo)) throw new Error('Invalid sharing certificate');
  } else if (!allowHttp) throw new Error('HTTP sharing requires confirmation');
  const prefix = '/' + randomBytes(24).toString('hex') + '/';
  const code = String(randomInt(1000000)).padStart(6,'0');
  let cookie, attempts = 0;
  const files = new Map();
  const peerId = 'web:browser';
  let closed = false, uploading = false, remaining = uploadBudget, count = 0;
  const controller = new AbortController();
  const server = (tls ? https : http).createServer({ ...tls, headersTimeout: 15000, requestTimeout: lifetime }, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    route(req, res).catch(error => {
      if (res.headersSent || res.destroyed) return res.destroy();
      res.writeHead(error.status || 500, { Connection: 'close' }).end();
    });
  });
  server.maxConnections = 16;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, address, resolve);
  });
  const origin = (tls ? 'https://' : 'http://') + hostname.toLowerCase() + ':' + server.address().port;
  const host = new URL(origin).host;
  const expires = Date.now() + lifetime;
  const timer = setTimeout(stop, lifetime);
  function stop() {
    if (closed) return;
    closed = true;
    controller.abort();
    server.close();
    server.closeAllConnections();
    clearTimeout(timer);
    onStopped?.();
  }
  function list() {
    return Array.from(files, ([id, file]) => ({ id, name: path.basename(file.path), size: file.stat.size }));
  }
  async function add(paths) {
    for (const selected of paths) {
      if (closed || files.size >= 100) break;
      const stat = await fs.lstat(selected);
      if (stat.isFile() && ![...files.values()].some(file => file.path === selected)) {
        files.set(randomUUID(), { path: selected, stat });
      }
    }
    return list();
  }
  async function route(req, res) {
    if (closed || (!cookie && Date.now() >= expires) || req.headers.host !== host || !req.url.startsWith(prefix)) fail(404);
    const action = req.url.slice(prefix.length);
    if (req.method === 'GET') {
      if (action === '' || action === 'page.js') {
        const script = action === 'page.js';
        const data = await fs.readFile(path.join(web, script ? 'page.js' : 'index.html'));
        res.writeHead(200, { 'Content-Type': script ? 'application/javascript' : 'text/html; charset=utf-8' }).end(data);
        return;
      }
    }
    if (req.method === 'POST' && req.headers.origin !== origin) fail(403);
    if (action === 'pair' && req.method === 'POST') {
      if (cookie) fail(409);
      if (attempts >= 5) fail(429);
      if (req.headers['x-pair-code'] !== code) { attempts++; fail(attempts >= 5 ? 429 : 403); }
      cookie = 'llshare=' + randomBytes(32).toString('hex');
      clearTimeout(timer);
      res.writeHead(204, { 'Set-Cookie':cookie+'; HttpOnly; SameSite=Strict; Path='+prefix+(tls?'; Secure':'') }).end();
      onPaired?.();
      return;
    }
    if (!cookie || !(req.headers.cookie || '').split(/;\s*/).includes(cookie)) fail(401);
    if (req.method === 'GET') {
      if (action === 'files') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(list()));
        return;
      }
      const file = files.get(action);
      if (!file) fail(404);
      const handle = await fs.open(file.path, 'r').catch(() => fail(410));
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || ['dev','ino','size','mtimeMs'].some(key => stat[key] !== file.stat[key])) fail(410);
        const name = path.basename(file.path);
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': stat.size,
          'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16)) });
        if (stat.size) await pipeline(handle.createReadStream({end:stat.size-1}), res);
        else res.end();
        record({ peerId, id: randomUUID(), name, path: file.path, size: stat.size, bytes: stat.size,
          direction: 'outgoing', status: 'delivered', startedAt: Date.now() });
      } finally { await handle.close(); }
      return;
    }
    if (req.method !== 'POST' || action !== 'upload') fail(404);
    if (uploading) fail(409);
    let name;
    try { name = decodeURIComponent(req.headers['x-file-name'] || ''); } catch { fail(400); }
    const size = Number(req.headers['x-file-size']);
    if (!safeName(name) || !Number.isSafeInteger(size) || size < 0) fail(400);
    if (size > remaining || count >= 100) fail(413);
    uploading = true;
    let partial, bytes = 0;
    try {
      const dir = receiveDir();
      await fs.mkdir(dir, { recursive: true });
      const disk = await fs.statfs(dir);
      if (disk.bavail * disk.bsize < size) fail(507);
      const temp = path.join(dir, '.locallink-' + randomUUID() + '.part');
      const handle = await fs.open(temp, 'wx', 0o600);
      partial = temp;
      const meter = new Transform({ transform(chunk, _, next) {
        bytes += chunk.length;
        next(bytes > size ? new Error('Size mismatch') : null, chunk);
      } });
      await pipeline(req, meter, handle.createWriteStream(), { signal: controller.signal });
      if (closed || bytes !== size) fail(400);
      const dest = await publishFile(partial, dir, name);
      remaining -= size;
      count++;
      record({ peerId, id: randomUUID(), name, path: dest, size, bytes, direction: 'incoming',
        status: 'received', startedAt: Date.now() });
      res.writeHead(201).end();
    } finally {
      try { if (partial) await fs.unlink(partial); } finally { uploading = false; }
    }
  }
  return { url: origin + prefix, code, expires, add, stop, get closed() { return closed; },
    snapshot() { return {address, paired:!!cookie, files:list(), url:cookie?null:origin+prefix, code:cookie?null:code, expires:cookie?null:expires}; }
  };
}
module.exports = { startShare, usesTLS };

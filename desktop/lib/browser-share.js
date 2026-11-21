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

const {thumbnail}=require('./share-thumbnail');
const lifetime = 15 * 60 * 1000;
const uploadBudget = 1024 ** 3;
const web = path.join(__dirname, '../src/browser-share');
function fail(status) { throw Object.assign(new Error(), { status }); }

function usesTLS() {
  return ['LOCALLINK_SHARE_HOST','LOCALLINK_SHARE_CERT','LOCALLINK_SHARE_KEY'].some(key=>!!process.env[key]);
}
async function startShare({ address, receiveDir, record, accept, previewPath, allowHttp = false, multiple = true, onChanged, onPaired, onStopped }) {
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
  const clients = new Map();
  const maxClients = multiple ? 8 : 1;
  let attempts = 0;
  const canInvite = () => clients.size < maxClients && attempts < 5 && Date.now() < expires;
  const files = new Map();
  const {BrowserRoom} = require('./browser-room');
  const room = new BrowserRoom({record,receiveDir,changed:onChanged});
  const peerId = 'web:browser';
  let closed = false, remaining = uploadBudget, count = 0;
  const controller = new AbortController();
  const active=new Set();
  let cleanup;
  const server = (tls ? https : http).createServer({ ...tls, headersTimeout: 15000, requestTimeout: lifetime }, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; img-src 'self' blob:; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const task=route(req, res).catch(error => {
      if (res.headersSent || res.destroyed) return res.destroy();
      res.writeHead(error.status || 500, { Connection: 'close' }).end();
    });
    active.add(task);
    task.finally(()=>active.delete(task));
  });
  server.maxConnections = 16;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, address, resolve);
  });
  const origin = (tls ? 'https://' : 'http://') + hostname.toLowerCase() + ':' + server.address().port;
  const host = new URL(origin).host;
  const expires = Date.now() + lifetime;
  const timer = setTimeout(() => clients.size ? onPaired?.() : stop(), lifetime);
  function stop() {
    if (closed) return cleanup;
    closed = true;
    controller.abort();
    room.cancelPending();
    server.close();
    server.closeAllConnections();
    clearTimeout(timer);
    cleanup=Promise.allSettled([...active]).then(()=>room.close()).finally(()=>{clients.clear();files.clear();});
    cleanup.catch(error=>console.warn('Browser room cleanup',error.message));
    onStopped?.();
    return cleanup;
  }
  function list() {
    return Array.from(files, ([id, file]) => ({ id, name: path.basename(file.path), size: file.stat.size,time:file.time,hasPreview:!!file.preview }));
  }
  async function add(paths,outcome={}) {
    let added=0;
    for (const selected of paths) {
      if (closed || files.size >= 100) break;
      const stat = await fs.lstat(selected).catch(()=>null);
      if (stat?.isFile() && ![...files.values()].some(file => file.path === selected)) {
        const preview = previewPath && /\.(png|jpe?g|gif|webp|bmp|avif|heic)$/i.test(selected) ? await previewPath(selected).catch(()=>null) : null;
        if(closed || files.size>=100) break;
        if([...files.values()].some(file=>file.path===selected))continue;
        added++;
        files.set(randomUUID(), {path:selected,stat,time:Date.now(),preview});
      }
    }
    outcome.skipped=paths.length-added;
    return list();
  }
  async function route(req, res) {
    if (closed || (!clients.size && Date.now() >= expires) || req.headers.host !== host || !req.url.startsWith(prefix)) fail(404);
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
    const cookies = (req.headers.cookie || '').split(/;\s*/);
    const client = cookies.map(value => clients.get(value)).find(Boolean);
    if (action === 'pair' && req.method === 'POST') {
      if (client) { res.writeHead(204).end(); return; }
      if (Date.now() >= expires) fail(410);
      if (clients.size >= maxClients) fail(409);
      if (attempts >= 5) fail(429);
      if (req.headers['x-pair-code'] !== code) { attempts++; if (attempts === 5) onPaired?.(); fail(attempts >= 5 ? 429 : 403); }
      const cookie = 'llshare=' + randomBytes(32).toString('hex');
      clients.set(cookie, {number:clients.size+1, platform:/iphone/i.test(req.headers['user-agent'])?'iPhone':/ipad/i.test(req.headers['user-agent'])?'iPad':/android/i.test(req.headers['user-agent'])?'Android':'Browser', choices:new Map(), approved:new Map(), requesting:false, uploading:false});
      res.writeHead(204, { 'Set-Cookie':cookie+'; HttpOnly; SameSite=Strict; Path='+prefix+(tls?'; Secure':'') }).end();
      onPaired?.();
      return;
    }
    if (!client) fail(401);
    const approved = client.approved;
    if(req.method==='GET' && action.startsWith('preview/')) {
      const id=action.slice(8);
      const relay=room.files.get(id);
      const preview=files.get(id)?.preview || ((relay?.sender===client.number || relay?.recipients.has(client.number)) && relay.preview);
      if(!preview) fail(404);
      res.writeHead(200,{'Content-Type':'image/png'}).end(preview);return;
    }
    if (action === 'room' && req.method === 'GET') {
      res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({
        me:client.number, members:clients.size+1, messages:room.messages,
        files:[...room.localFiles.filter(f=>f.sender===client.number).map(f=>({...f,decision:'sent'})),...list().map(f=>({...f,sender:0,ready:true,decision:client.choices.get(f.id)||'pending'})),...room.list(client.number)]
      }));
      return;
    }
    if (action === 'message' && req.method === 'POST') {
      const chunks=[]; let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>8192)fail(413);chunks.push(chunk);}
      if(!room.message(client.number,Buffer.concat(chunks).toString()))fail(400);
      res.writeHead(204).end();return;
    }
    if (action === 'decision' && req.method === 'POST') {
      const id=req.headers['x-file-id'], value=req.headers['x-decision'];
      if (!['accept','reject'].includes(value)) fail(400);
      if(files.has(id) && !client.choices.has(id)) client.choices.set(id,value);
      else if(!room.decide(id,client.number,value)) fail(409);
      res.writeHead(204).end();return;
    }
    if (req.method === 'GET') {
      if (action === 'files') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(list()));
        return;
      }
      const relayed = room.files.get(action);
      const file = files.get(action) || relayed;
      if (file && (relayed ? relayed.recipients.get(client.number) : client.choices.get(action)) !== 'accept') fail(403);
      if (relayed && !relayed.stat) fail(409);
      if (!file) fail(404);
      const handle = await fs.open(file.path, 'r').catch(() => fail(410));
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || ['dev','ino','size','mtimeMs'].some(key => stat[key] !== file.stat[key])) fail(410);
        const name = relayed ? relayed.name : path.basename(file.path);
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': stat.size,
          'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16)) });
        if (stat.size) await pipeline(handle.createReadStream({end:stat.size-1}), res);
        else res.end();
        record({ peerId, roomId:room.id, recipient:client.number, id:randomUUID(), name, ...(relayed?{}:{path:file.path}), size:stat.size, bytes:stat.size,
          direction: 'outgoing', status: 'delivered', startedAt: Date.now() });
      } finally { await handle.close(); }
      return;
    }
    if (req.method === 'POST' && action === 'offer') {
      if (client.requesting || client.uploading) fail(409);
      client.requesting = true;
      for (const f of approved.values()) if(f.relay) room.files.delete(f.relay.id);
      approved.clear();
      try {
        const chunks = [];
        let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 3 * 1024 * 1024) fail(413);
          chunks.push(chunk);
        }
        if(closed || res.destroyed)fail(410);
        let batch;
        try { batch = JSON.parse(Buffer.concat(chunks).toString()); } catch { fail(400); }
        if (!Array.isArray(batch) || !batch.length || batch.length > 100-count) fail(413);
        let total = 0;
        for (const file of batch) {
          if (!safeName(file?.name) || !Number.isSafeInteger(file.size) || file.size < 0) fail(400);
          file.preview=thumbnail(file.pixels);
          delete file.pixels;
          total += file.size;
        }
        if (total > remaining) fail(413);
        const confirm = response=>accept?.({files:batch.map(({name,size,preview})=>({name,size,preview:preview?'data:image/png;base64,'+preview.toString('base64'):null})),total,peerId:'web-room:'+room.id,number:client.number,ip:req.socket.remoteAddress},response);
        const others = [...clients.values()].filter(c=>c!==client).map(c=>c.number);
        let relays;
        if (others.length) {
          if (batch.length + room.files.size > 250) fail(429);
          relays = await room.offer(batch,client.number,others,confirm,res);
          if (!relays.some(Boolean)) fail(403);
        } else if (!await confirm(res)) fail(403);
        if (closed || res.destroyed) fail(403);
        const tokens = batch.map((file,i) => {
          if (relays && !relays[i]) return null;
          const token = randomUUID();
          approved.set(token, {name:file.name,size:file.size,relay:relays?.[i]});
          return token;
        });
        res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify(tokens));
      } finally { client.requesting = false; }
      return;
    }
    if (req.method !== 'POST' || action !== 'upload') fail(404);
    if (client.uploading) fail(409);
    let name;
    try { name = decodeURIComponent(req.headers['x-file-name'] || ''); } catch { fail(400); }
    const size = Number(req.headers['x-file-size']);
    if (!safeName(name) || !Number.isSafeInteger(size) || size < 0) fail(400);
    if (size > remaining || count >= 100) fail(413);
    const token = req.headers['x-upload-token'];
    const file = approved.get(token);
    if (!file || file.name !== name || file.size !== size) fail(403);
    approved.delete(token);
    client.uploading = true;
    remaining -= size;
    count++;
    let saved = false;
    let partial, bytes = 0;
    try {
      const dir = file.relay ? await room.directory() : receiveDir();
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
      if(file.relay) {
        await room.ready(file.relay,partial);
        partial=null;
      } else {
        const dest = await publishFile(partial, dir, name);
        room.received({id:randomUUID(),name,size,sender:client.number,time:Date.now(),host:true,ready:true});
        record({ peerId, roomId:room.id, sender:client.number, id: randomUUID(), name, path: dest, size, bytes, direction: 'incoming',
        status: 'received', startedAt: Date.now() });
      }
      saved=true;
    } finally {
      try { if (partial) await fs.rm(partial,{force:true}); } finally {
        if (!saved && file.relay) room.files.delete(file.relay.id);
        if (!saved) { remaining += size; count--; }
        client.uploading = false;
      }
    }
    res.writeHead(201).end();
  }
  return { url: origin + prefix, code, expires, add, stop, message:text=>room.message(0,text), get closed() { return closed; },
    snapshot() { return {address, multiple, roomId:room.id, members:[...clients.values()].map(({number,platform})=>({number,platform})), messages:room.messages, sharedFiles:room.summary(), paired:clients.size > 0, pairedCount:clients.size, files:list(), url:canInvite()?origin+prefix:null, code:canInvite()?code:null, expires}; }
  };
}
module.exports = { startShare, usesTLS };

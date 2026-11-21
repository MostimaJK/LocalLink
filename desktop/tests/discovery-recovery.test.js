'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const dgram = require('node:dgram');
const { LocalSend } = require('../src/js/network/localsend');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'll-discovery-'));
  const occupied = dgram.createSocket('udp4');
  await new Promise((resolve, reject) => {
    occupied.once('error', reject);
    occupied.bind(0, '0.0.0.0', resolve);
  });
  const discoveryPort = occupied.address().port;
  const nodes = [];
  try {
    for (const name of ['Mac fixture', 'Windows fixture']) {
      const dir = path.join(root, name);
      await fs.mkdir(dir);
      const node = new LocalSend({
        dataDir:dir, receiveDir:dir, alias:()=>name, port:0,
        discoveryPort, discovery:nodes.length===0, accept:async()=>true
      });
      nodes.push(node);
      await node.start();
    }
    const [a,b] = nodes;
    assert.match(a.discoveryError,/EADDRINUSE|EACCES/);
    const peer = await a.discover('127.0.0.1:'+b.port);
    const source = path.join(a.opts.dataDir,'互通 #1.txt');
    const content = Buffer.from('LocalLink \u0000 HTTPS');
    await fs.writeFile(source,content);
    assert.equal((await a.send(peer.id,source)).status,'delivered');
    const received = path.join(b.opts.receiveDir,path.basename(source));
    assert.deepEqual(await fs.readFile(received),content);
    assert.equal((await b.send('localsend:'+a.fingerprint,received)).status,'delivered');
    assert.deepEqual(await fs.readFile(path.join(a.opts.receiveDir,'互通 #1 (1).txt')),content);
    await new Promise(resolve=>occupied.close(resolve));
    await Promise.all([a.rediscover(),a.rediscover()]);
    assert.equal(a.discoveryError,null);
    assert.equal(a.udp.address().port,discoveryPort);
    console.log('PASS bidirectional manual transfer during UDP conflict and discovery recovery');
  } finally {
    try { occupied.close(); } catch {}
    for (const node of nodes) node.stop();
    await fs.rm(root,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

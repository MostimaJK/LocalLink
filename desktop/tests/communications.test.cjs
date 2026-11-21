const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {LocalSend}=require('../src/js/network/localsend');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-comms-'));const received=[],trusted=new Set();let allow=true,proved;
 const make=name=>{const dataDir=path.join(root,name);fs.mkdirSync(dataDir);return new LocalSend({dataDir,receiveDir:path.join(dataDir,'files'),port:0,discovery:false,maxBytes:1024*1024,alias:()=>name,pair:async peer=>{trusted.add(peer.id);return true;},accept:async offer=>{proved=offer.authenticatedPeerId;return allow||trusted.has(proved);},result:r=>received.push({...r})});};
 const a=make('a'),b=make('b'),attacker=make('attacker');
 try{
  await a.start();await b.start();await attacker.start();const peer=a.observe(b.info(),'127.0.0.1');
  await a.sendMessage(peer.id,'你好，原生文字');assert.equal(received.find(r=>r.status==='received').text,'你好，原生文字');assert.equal(received.find(r=>r.status==='received').path,undefined);assert.equal(proved,'localsend:'+a.fingerprint);
  allow=false;await assert.rejects(a.sendMessage(peer.id,'declined'),/403/);
  assert.equal((await a.request(peer,'locallink-pair',{info:a.info()})).paired,true);
  await a.sendMessage(peer.id,'paired message');
  await assert.rejects(attacker.request(peer,'locallink-pair',{info:a.info()}),/403/);
  await assert.rejects(attacker.request(peer,'locallink-message',{info:a.info(),text:'spoof'}),/403/);
  trusted.clear();await assert.rejects(a.sendMessage(peer.id,'revoked'),/403/);
  await assert.rejects(a.sendMessage(peer.id,'x'.repeat(65537)),/65\.536 KB/);
  console.log('PASS: native text ack/refusal, TLS identity pairing, spoof rejected, revocation, size bound');
 }finally{a.stop();b.stop();attacker.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});

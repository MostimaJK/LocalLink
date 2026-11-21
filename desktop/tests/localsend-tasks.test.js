const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),https=require('https');
const {LocalSend}=require('../src/js/network/localsend');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-tasks-'));const outgoing=[],incoming=[],peers=[];
 const make=(name,result)=>{const dataDir=path.join(root,name);fs.mkdirSync(dataDir);return new LocalSend({dataDir,receiveDir:path.join(dataDir,'files'),alias:()=>name,maxBytes:1e7,port:0,discovery:false,accept:async()=>true,result,peer:p=>peers.push(p),cleanupIntervalMs:30,idleTimeoutMs:300});};
 const a=make('a',r=>outgoing.push(r)),b=make('b',r=>incoming.push(r));
 try{
  await a.start();await b.start();
  const peer=await a.discover('127.0.0.1:'+b.port);assert.equal(peer.fingerprint,b.fingerprint);
  a.observe({...b.info(),deviceType:'mobile'},'127.0.0.1');assert.equal(peers.at(-1).deviceType,'mobile');
  const files=['中文.txt','empty.bin'].map((name,i)=>{const p=path.join(root,name);fs.writeFileSync(p,i?'':'hello');return p;});
  let secured=0;
  const countConnection=()=>secured++;
  b.server.on('secureConnection',countConnection);
  await assert.rejects(a.request(peer,'prepare-upload',Buffer.alloc(32*1024*1024+1)),/File list too large/);
  assert.equal(secured,0);
  const sent=await a.sendBatch(peer.id,files);assert.equal(sent.length,2);assert.ok(sent.every(r=>r.status==='delivered'));
  b.server.off('secureConnection',countConnection);assert.equal(secured,1);
  assert.ok(incoming.filter(r=>r.status==='received').every(r=>incoming.some(q=>q.id===r.id&&q.status==='queued')));
  assert.equal(fs.readFileSync(incoming.find(r=>r.status==='received'&&r.name==='中文.txt').path,'utf8'),'hello');
  const receipts=new Map();
  b.opts.lookupReceipt=(peerId,id)=>receipts.get(peerId+id);
  const collect=b.opts.result;
  b.opts.result=r=>{collect(r);if(r.status==='received')receipts.set(r.peerId+r.receiptId,{...r,diskIdentity:require('../lib/transfer-staging').identity(r.path,true)});};
  const sendRequest=a.request.bind(a);
  a.request=async(...args)=>{const response=await sendRequest(...args);if(args[1].startsWith('upload?'))throw Error('Lost receipt');return response;};
  await assert.rejects(a.send(peer.id,files[0]),/Lost receipt/);
  a.request=sendRequest;
  const failed=outgoing.at(-1),before=incoming.filter(r=>r.status==='received').length;
  assert.equal((await a.send(peer.id,files[0],{retryMap:new Map([[files[0],failed]])})).status,'delivered');
  assert.equal(incoming.filter(r=>r.status==='received').length,before);
  a.peers.get(peer.id).seen-=46000;
  assert.equal((await a.send(peer.id,files[0])).status,'delivered');
  // Continuously active request survives longer than the configured idle deadline.
  const prep=await a.request(peer,'prepare-upload',{info:a.info(),files:{slow:{fileName:'slow.bin',size:10}}});
  const answer=new Promise((resolve,reject)=>{
   const req=https.request({host:'127.0.0.1',port:b.port,path:'/api/localsend/v2/upload?'+new URLSearchParams({sessionId:prep.sessionId,fileId:'slow',token:prep.files.slow}),method:'POST',rejectUnauthorized:false,headers:{'Content-Length':10}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
   req.on('error',reject);
   (async()=>{for(let i=0;i<10;i++){req.write(Buffer.from([i]));await delay(80);}req.end();})().catch(reject);
  });
  assert.equal(await answer,200);
  // An accepted session with an expired idle deadline records failure, not disappearance.
  const expired=await a.request(peer,'prepare-upload',{info:a.info(),files:{idle:{fileName:'idle.bin',size:1}}});
  b.sessions.get(expired.sessionId).expires=0;b.sweep();assert.equal(incoming.at(-1).status,'failed');
  // Real active upload cancellation closes the stream, removes partial bytes and persists status.
  const cancel=await a.request(peer,'prepare-upload',{info:a.info(),files:{c:{fileName:'cancel.bin',size:100}}});
  const disconnected=new Promise(resolve=>{
   const req=https.request({host:'127.0.0.1',port:b.port,path:'/api/localsend/v2/upload?'+new URLSearchParams({sessionId:cancel.sessionId,fileId:'c',token:cancel.files.c}),method:'POST',rejectUnauthorized:false,headers:{'Content-Length':100}});
   req.on('error',resolve);req.write('x');
  });
  await delay(80);const task=incoming.findLast(r=>r.name==='cancel.bin');assert.equal(b.cancelTask(task.id),true);
  await disconnected;await delay(50);assert.equal(incoming.findLast(r=>r.id===task.id).status,'cancelled');
  assert.equal(b.sessions.size,0);
  // PIN and completed-in-preparation are protocol responses, not false errors.
  const route=b.route.bind(b);
  b.route=async(req,res)=>{
   if(req.url.includes('prepare-upload')&&!req.url.includes('pin=123456')){req.resume();res.writeHead(401);res.end();return;}
   return route(req,res);
  };
  await assert.rejects(a.send(peer.id,files[0]),/401/);
  assert.equal((await a.send(peer.id,files[0],{pin:'123456'})).status,'delivered');
  b.route=async(req,res)=>{if(req.url.includes('prepare-upload')){req.resume();res.writeHead(204);res.end();return;}return route(req,res);};
  assert.equal((await a.send(peer.id,files[0],{text:'hello'})).status,'delivered');
  b.route=route;
  // Cancel while waiting for receiver confirmation; no later success is allowed.
  let accept;b.opts.accept=()=>new Promise(resolve=>{accept=resolve;});
  const pending=a.send(peer.id,files[0]);while(!accept)await delay(10);
  const id=outgoing.at(-1).id;a.cancelTask(id);accept(true);await assert.rejects(pending);
  assert.equal(outgoing.findLast(r=>r.id===id).status,'cancelled');
  console.log('PASS: HTTPS manual discovery, batch/zero bytes, receive lifecycle, active idle timeout, cancellation');
 }finally{a.stop();b.stop();}
})().catch(error=>{console.error(error);process.exitCode=1;});

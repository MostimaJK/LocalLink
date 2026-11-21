const assert=require('node:assert/strict');
const fs=require('fs');const os=require('os');const path=require('path');
const {LocalSend,safeName}=require('../src/js/network/localsend');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'locallink-protocol-'));
 const results=[];let allow=true;
 const make=(name)=>{const dataDir=path.join(root,name);fs.mkdirSync(dataDir);return new LocalSend({dataDir,receiveDir:path.join(dataDir,'received'),port:0,discovery:false,maxBytes:10*1024*1024,alias:()=>name,accept:async()=>allow,result:r=>results.push(r)});};
 const a=make('a'),b=make('b');
 try{
  await a.start();await b.start();
  const peer={...b.info(),ip:'127.0.0.1'};a.observe(b.info(),'127.0.0.1');
  const id='localsend:'+b.fingerprint;
  const source=path.join(root,'sample.bin');const bytes=require('crypto').randomBytes(2*1024*1024+1);fs.writeFileSync(source,bytes);
  await a.send(id,source);
  assert.deepEqual(fs.readFileSync(results.find(r=>r.status==='received').path),bytes);
  assert.equal(path.dirname(results.find(r=>r.status==='received').path),b.opts.receiveDir);
  assert.equal(results.filter(r=>r.status==='delivered').length,1);
  const sent=results.filter(r=>r.direction==='outgoing');
  assert.deepEqual([...new Set(sent.map(r=>r.status))],['queued','preparing','awaiting','transferring','confirming','delivered']);
  assert.equal(sent.at(-1).bytes,bytes.length);
  assert.ok(sent.every(r=>(r.bytes||0)<=r.size));
  assert.equal(new Set(sent.map(r=>r.id)).size,1);
  assert.equal(new Set(sent.map(r=>r.startedAt)).size,1);
  allow=false;await assert.rejects(a.send(id,source),/403/);allow=true;
  assert.equal(results.at(-1).status,'failed');
  assert.equal(results.at(-1).id,results.at(-2).id);
  assert.equal(results.filter(r=>r.status==='delivered').length,1);
  const prep=await a.request(peer,'prepare-upload',{info:a.info(),files:{bad:{fileName:'bad.bin',size:bytes.length,sha256:'0'.repeat(64)}}});
  await assert.rejects(a.request(peer,'upload?'+new URLSearchParams({sessionId:prep.sessionId,fileId:'bad',token:'wrong'}),{}),/403/);
  await assert.rejects(a.request(peer,'upload?'+new URLSearchParams({sessionId:prep.sessionId,fileId:'bad',token:prep.files.bad}),null,{path:source,size:bytes.length}),/422/);
  assert.equal(results.filter(r=>r.status==='received').length,1);
  const failure=results.findLast(r=>r.direction==='incoming'&&r.name==='bad.bin');
  assert.equal(failure.status,'failed');assert.match(failure.error,/integrity/);
  assert.ok(results.some(r=>r.id===failure.id&&r.status==='queued'));
  await assert.rejects(a.request({...peer,fingerprint:'0'.repeat(64)},'register',a.info()),/certificate changed/);
  for(const name of ['../x','a\\b','CON.txt','a:stream','..'])assert.equal(safeName(name),false);
  await assert.rejects(a.request(peer,'prepare-upload',{info:a.info(),files:{x:{fileName:'../bad',size:1}}}),/400/);
  await a.send(id,source);
  assert.deepEqual(fs.readFileSync(path.join(b.opts.receiveDir,'sample (1).bin')),bytes);
  assert.deepEqual(fs.readFileSync(path.join(b.opts.receiveDir,'sample.bin')),bytes);
  assert.equal(fs.existsSync(path.join(b.opts.receiveDir,'.locallink-partials')),false);
  assert.deepEqual(fs.readdirSync(b.opts.receiveDir).sort(),['sample (1).bin','sample.bin']);
  // Both prompts saw enough space, but only one reservation fits at approval time.
  const third=make('third'),statfs=fs.statfsSync,approvals=[];
  try{
   await third.start();
   fs.statfsSync=()=>({bavail:60,bsize:1});
   b.opts.accept=offer=>new Promise(resolve=>approvals.push({offer,resolve}));
   const prepare=node=>node.request(peer,'prepare-upload',{info:node.info(),files:{sample:{fileName:'sample',size:40}}});
   const settled=Promise.allSettled([prepare(a),prepare(third)]);
   for(let i=0;i<200 && approvals.length<2;i++)await new Promise(resolve=>setTimeout(resolve,10));
   assert.equal(approvals.length,2);
   assert(approvals.every(({offer})=>offer.freeBytes===60));
   approvals.forEach(({resolve})=>resolve(true));
   const replies=await settled;
   assert.equal(replies.filter(r=>r.status==='fulfilled').length,1);
   assert.equal(replies.find(r=>r.status==='rejected').reason.statusCode,507);
   b.cancel(replies.find(r=>r.status==='fulfilled').value.sessionId);
   b.opts.accept=async offer=>{assert.equal(offer.freeBytes,60);return true;};
   b.cancel((await prepare(a)).sessionId);
  }finally{approvals.forEach(({resolve})=>resolve(false));fs.statfsSync=statfs;third.stop();}
  console.log('PASS: HTTPS byte-exact flat receive, collision numbering, temporary cleanup, refusal, checksum and TLS pin');
 }finally{a.stop();b.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});

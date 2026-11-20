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
  assert.equal(results.filter(r=>r.status==='delivered').length,1);
  allow=false;await assert.rejects(a.send(id,source),/403/);allow=true;
  assert.equal(results.filter(r=>r.status==='delivered').length,1);
  const prep=await a.request(peer,'prepare-upload',{info:a.info(),files:{bad:{fileName:'bad.bin',size:bytes.length,sha256:'0'.repeat(64)}}});
  await assert.rejects(a.request(peer,'upload?'+new URLSearchParams({sessionId:prep.sessionId,fileId:'bad',token:'wrong'}),{}),/403/);
  await assert.rejects(a.request(peer,'upload?'+new URLSearchParams({sessionId:prep.sessionId,fileId:'bad',token:prep.files.bad}),null,{path:source,size:bytes.length}),/422/);
  assert.equal(results.filter(r=>r.status==='received').length,1);
  await assert.rejects(a.request({...peer,fingerprint:'0'.repeat(64)},'register',a.info()),/certificate changed/);
  for(const name of ['../x','a\\b','CON.txt','a:stream','..'])assert.equal(safeName(name),false);
  await assert.rejects(a.request(peer,'prepare-upload',{info:a.info(),files:{x:{fileName:'../bad',size:1}}}),/400/);
  console.log('PASS: HTTPS byte-exact transfer, acknowledgement, refusal, token, checksum, TLS pin, safe filenames');
 }finally{a.stop();b.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});

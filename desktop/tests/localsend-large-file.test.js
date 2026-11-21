const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const {LocalSend}=require('../src/js/network/localsend');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-large-test-'));const size=500*1024*1024;
 const results=[];const make=name=>{const dir=path.join(root,name);fs.mkdirSync(dir);return new LocalSend({dataDir:dir,receiveDir:path.join(dir,'received'),alias:()=>name,maxBytes:size,port:0,discovery:false,accept:async()=>true,result:r=>{if(['received','delivered','failed'].includes(r.status))results.push(r);}});};
 const a=make('a'),b=make('b');let timer;
 try{
  await a.start();await b.start();a.observe(b.info(),'127.0.0.1');
  const source=path.join(root,'500MiB.bin');const fd=fs.openSync(source,'w');fs.ftruncateSync(fd,size);fs.closeSync(fd);
  const baseline=process.memoryUsage().rss;let peak=baseline;timer=setInterval(()=>peak=Math.max(peak,process.memoryUsage().rss),20);
  const start=performance.now();await a.send('localsend:'+b.fingerprint,source);
  const received=results.find(r=>r.status==='received');assert.ok(received);assert.equal(fs.statSync(received.path).size,size);
  assert.equal(results.find(r=>r.status==='delivered').bytes,size);
  console.log(JSON.stringify({bytes:size,seconds:Number(((performance.now()-start)/1000).toFixed(2)),baselineRSSMiB:Math.round(baseline/1048576),peakRSSMiB:Math.round(peak/1048576),twoPeersInOneNodeProcess:true}));
 }finally{
  clearInterval(timer);a.stop();b.stop();
  // Only this test's freshly created directory, checked against the temp root.
  if(path.dirname(root)===path.resolve(os.tmpdir())&&path.basename(root).startsWith('ll-large-test-'))fs.rmSync(root,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

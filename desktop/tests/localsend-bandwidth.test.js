const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const {LocalSend}=require('../src/js/network/localsend');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-bandwidth-'));const received=[];
 const make=name=>{const dir=path.join(root,name);fs.mkdirSync(dir);return new LocalSend({dataDir:dir,receiveDir:dir,alias:()=>name,maxBytes:10000000,port:0,discovery:false,accept:async()=>true,result:r=>{if(r.status==='received')received.push(r);}});};
 const a=make('a'),b=make('b');
 try{
  await a.start();await b.start();a.observe(b.info(),'127.0.0.1');
  const file=path.join(root,'payload.bin'),bytes=require('crypto').randomBytes(2000000);fs.writeFileSync(file,bytes);
  for(const direction of ['upload','download']){
   a.setBandwidth({upload:direction==='upload'?1:0});b.setBandwidth({download:direction==='download'?1:0});
   const start=performance.now();await a.send('localsend:'+b.fingerprint,file);const seconds=(performance.now()-start)/1000;
   assert.ok(seconds>=1.7&&seconds<6,direction+': '+seconds);assert.deepEqual(fs.readFileSync(received.at(-1).path),bytes);
   console.log(JSON.stringify({direction,MB:2,limitMBps:1,seconds:+seconds.toFixed(2)}));
  }
 }finally{a.stop();b.stop();if(path.dirname(root)===path.resolve(os.tmpdir())&&path.basename(root).startsWith('ll-bandwidth-'))fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

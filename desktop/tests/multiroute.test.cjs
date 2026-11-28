const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {LocalSend}=require('../src/js/network/localsend');
const {candidates}=require('../src/js/network/routes');
const adapters=[{name:'无线',kind:'wifi',sendBps:1e9},{name:'直连',description:'Thunderbolt 5 Networking',sendBps:4e10}];
const iface=ip=>[{address:ip,netmask:'255.255.255.0',family:'IPv4'}];
const routes=candidates(['192.168.1.2','192.168.7.2'].map(ip=>({ip,seen:Date.now()})),adapters,{'无线':iface('192.168.1.1'),'直连':iface('192.168.7.1')});
assert.deepEqual(routes.map(r=>r.label),['Thunderbolt 5','Wi-Fi']);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-multiroute-'));
const interfaces=Object.entries(os.networkInterfaces()).flatMap(([name,rows])=>rows.filter(r=>r.family==='IPv4').map(r=>({...r,name})));
const loop=interfaces.find(r=>r.internal),lan=interfaces.find(r=>!r.internal);
const records=[],pref={};
function make(name){
 const dir=path.join(root,name);fs.mkdirSync(dir);
 return new LocalSend({dataDir:dir,receiveDir:dir,alias:()=>name,port:0,discovery:false,accept:async()=>true,
 canTestSpeed:()=>true,routePreference:()=>pref[name],result:r=>{if(r.status==='received')records.push(r);}});
}
(async()=>{
 const a=make('a'),b=make('b');
 try{
  await a.start();await b.start();
  const data=Buffer.from('LocalLink route test'),file=path.join(root,'input');fs.writeFileSync(file,data);
  for(const [sender,receiver,name] of [[a,b,'a'],[b,a,'b']]){
   for(const n of [loop,lan].filter(Boolean))sender.observe(receiver.info(),n.address);
   const id='localsend:'+receiver.fingerprint;
   for(const n of [loop,lan].filter(Boolean)){
    pref[name]=n.name;await sender.send(id,file);
    const receipt=records.at(-1);
    assert.equal(receipt.routeLocal,n.address);assert.equal(receipt.routeRemote,n.address);
    assert.deepEqual(fs.readFileSync(receipt.path),data);
   }
   pref[name]='unplugged';const measured=await sender.measureSpeed(id,loop.name);assert(measured.upload>0&&measured.download>0);assert(measured.routeLabel);await assert.rejects(sender.reachable(id),/offline/);
  }
  console.log('PASS bidirectional bound IPs, file integrity, unplugged preference and USB generation labels');
 }finally{await a.stop();await b.stop();fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});


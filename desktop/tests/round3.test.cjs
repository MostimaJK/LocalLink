const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {archiveFolder}=require('../src/js/network/folder-archive');
const {LocalSend}=require('../src/js/network/localsend');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-round3-'));
 const folder=path.join(root,'中文資料');fs.mkdirSync(path.join(folder,'empty'),{recursive:true});fs.writeFileSync(path.join(folder,'file.txt'),'original');
 const zip=await archiveFolder(folder,path.join(root,'cache'));const data=fs.readFileSync(zip);
 assert.ok(data.includes(Buffer.from('中文資料/file.txt')));assert.ok(data.includes(Buffer.from('original')));assert.ok(data.includes(Buffer.from('中文資料/empty/')));
 await assert.rejects(archiveFolder(folder,path.join(root,'cache'),1),/limit/);
 const original=os.networkInterfaces;const calls=[];
 const transport=new LocalSend({alias:()=> 'Test'});transport.interfaces=new Set();transport.udp={addMembership:(...a)=>calls.push(['add',...a]),dropMembership:(...a)=>calls.push(['drop',...a]),setMulticastInterface:ip=>calls.push(['send-via',ip]),send:(bytes,port,host,done)=>setImmediate(done)};
 try{
  os.networkInterfaces=()=>({wifi:[{address:'192.168.1.2',family:'IPv4',internal:false}],lan:[{address:'10.0.0.2',family:'IPv4',internal:false}]});
  await transport.announce();assert.equal(calls.filter(c=>c[0]==='add').length,2);assert.equal(calls.filter(c=>c[0]==='send-via').length,2);
  os.networkInterfaces=()=>({lan:[{address:'10.0.0.3',family:'IPv4',internal:false}]});await transport.announce();assert.equal(calls.filter(c=>c[0]==='drop').length,2);assert.deepEqual([...transport.interfaces],['10.0.0.3']);
 }finally{os.networkInterfaces=original;}
 console.log('PASS: lossless folder ZIP with Unicode/empty directories, limits, multi-interface membership and changes');
})().catch(e=>{console.error(e);process.exitCode=1;});

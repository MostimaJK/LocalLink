const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {publishFile}=require('../src/js/network/receive-file');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-receive-')),partial=path.join(root,'partial'),dest=path.join(root,'received');fs.mkdirSync(dest);fs.writeFileSync(partial,'verified bytes');
 fs.writeFileSync(path.join(dest,'File.exe'),'existing');
 const outputs=await Promise.all(Array.from({length:3},()=>publishFile(partial,dest,'File.exe')));
 assert.equal(new Set(outputs).size,3);assert.equal(fs.readFileSync(path.join(dest,'File.exe'),'utf8'),'existing');
 const link=fs.promises.link;fs.promises.link=async()=>{throw Object.assign(Error('No hard links'),{code:'ENOTSUP'});};
 try{const copied=await publishFile(partial,dest,'File.exe');assert.equal(path.basename(copied),'File (4).exe');assert.equal(fs.readFileSync(copied,'utf8'),'verified bytes');
  const fixes=['one','two'].map(name=>{const file=path.join(root,name);fs.writeFileSync(file,name);return file;});
  const moved=await Promise.all(fixes.map(file=>publishFile(file,dest,'File.exe',{consume:true})));
  assert.equal(new Set(moved).size,2);
  assert.deepEqual(moved.map(file=>fs.readFileSync(file,'utf8')),['one','two']);
  assert.ok(fixes.every(file=>!fs.existsSync(file)));
  await assert.rejects(publishFile(fixes[0],dest,'missing.txt',{consume:true}),{code:'ENOENT'});
  assert.ok(!fs.existsSync(path.join(dest,'missing.txt')));
 }finally{fs.promises.link=link;fs.rmSync(root,{recursive:true,force:true});}
 console.log('PASS: concurrent collision numbering, no overwrite and non-hardlink filesystem fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});

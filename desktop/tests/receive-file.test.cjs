const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {publishFile}=require('../src/js/network/receive-file');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-receive-')),partial=path.join(root,'partial'),dest=path.join(root,'received');fs.mkdirSync(dest);fs.writeFileSync(partial,'verified bytes');
 fs.writeFileSync(path.join(dest,'File.exe'),'existing');
 const outputs=await Promise.all(Array.from({length:3},()=>publishFile(partial,dest,'File.exe')));
 assert.equal(new Set(outputs).size,3);assert.equal(fs.readFileSync(path.join(dest,'File.exe'),'utf8'),'existing');
 const link=fs.promises.link;fs.promises.link=async()=>{throw Object.assign(Error('No hard links'),{code:'ENOTSUP'});};
 try{const copied=await publishFile(partial,dest,'File.exe');assert.equal(path.basename(copied),'File (4).exe');assert.equal(fs.readFileSync(copied,'utf8'),'verified bytes');}finally{fs.promises.link=link;}
 console.log('PASS: concurrent collision numbering, no overwrite and non-hardlink filesystem fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});

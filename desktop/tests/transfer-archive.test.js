const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const NativeDb=require('better-sqlite3');
const TransferStore=require('../src/js/database/transfers');
const {exportArchive,importArchive}=require('../src/js/database/transfer-archive');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-archive-'));
 const db=new NativeDb(':memory:');db.exec('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT)');
 const store=new TransferStore(db);const original=path.join(root,'原始资料.txt');fs.writeFileSync(original,'original bytes 原文');
 try{
  store.save({id:'one',peerId:'localsend:phone',name:'原始资料.txt',status:'received',direction:'incoming',size:fs.statSync(original).size,path:original,time:100});
  const backup=await exportArchive(store,root,true);assert.equal(backup.missing,0);
  const manifest=path.join(backup.path,'locallink-backup.json');const parsed=JSON.parse(fs.readFileSync(manifest));
  assert.equal(parsed.records[0].path,undefined);assert.equal(parsed.fingerprint,undefined);
  store.replace([]);await importArchive(store,manifest,path.join(root,'restored'));
  assert.notEqual(store.get('one').path,original);assert.deepEqual(fs.readFileSync(store.get('one').path),fs.readFileSync(original));
  // A corrupted original never becomes a successful restored record.
  fs.appendFileSync(path.join(backup.path,parsed.records[0].archiveFile.file),'corrupt');
  const good=store.get('one');await assert.rejects(importArchive(store,manifest,path.join(root,'restored')),/integrity/);assert.deepEqual(store.get('one'),good);
  // Neither an absolute path nor traversal can be imported from a manifest.
  parsed.records[0].archiveFile.file='../outside.txt';fs.writeFileSync(manifest,JSON.stringify(parsed));
  await assert.rejects(importArchive(store,manifest,path.join(root,'restored')),/Invalid archive file/);
  const metadata=await exportArchive(store,root,false);store.replace([]);
  await importArchive(store,path.join(metadata.path,'locallink-backup.json'),path.join(root,'restored'));
  assert.equal(store.get('one').path,undefined);
  // Bounded pages still reach records beyond the first thousand.
  const start=performance.now();db.transaction(()=>{for(let i=0;i<10000;i++)store.save({id:'r'+i,peerId:'localsend:phone',name:'file-'+i+'.txt',status:'delivered',direction:'outgoing',time:i});})();
  const queryStart=performance.now();const page=store.list({peerId:'localsend:phone',limit:100,offset:9000});
  assert.equal(page.length,100);assert.ok(page.some(r=>r.id==='r999'));
  console.log('PASS: original-file archive, rebased paths, integrity/traversal rejection, metadata-only restore');
  console.log(JSON.stringify({rows:10000,insertMs:Math.round(queryStart-start),pageMs:Math.round(performance.now()-queryStart)}));
 }finally{db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

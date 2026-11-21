// Run with Electron's Node mode: the installed SQLite addon targets Electron.
const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),zlib=require('zlib');
const NativeDb=require('better-sqlite3');
const Db=require('../src/js/database/database');
const migrations=require('../src/js/database/migrations');
const TransferStore=require('../src/js/database/transfers');
(async()=>{
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-storage-test-'));
const db=Object.create(Db.prototype);db.db=new NativeDb(':memory:');db.userDataPath=root;
migrations.run(db.db);db.initStatements();
try{
 const rows=[{id:'old',peerId:'phone',name:'中文 100%.txt',size:10,path:'C:/retained.txt',status:'received',direction:'incoming',time:1}];
 db.db.prepare('INSERT INTO settings VALUES (?,?)').run('locallink.transfers',JSON.stringify(rows));
 db.transfers=new TransferStore(db.db);
 assert.equal(db.transfers.get('old').path,'C:/retained.txt');
 assert.equal(db.db.prepare('SELECT value FROM settings WHERE key=?').get('locallink.transfers'),undefined);
 assert.equal(db.transfers.list({query:'100%'}).length,1);
 assert.equal(db.transfers.list({query:'_'}).length,0);
 assert.equal(db.transfers.list({statuses:['received'],filesOnly:true}).length,1);
 assert.equal(db.transfers.list({statuses:['failed','cancelled']}).length,0);
 db.transfers.save({id:'photo',peerId:'laptop',name:'PHOTO.JPG',status:'delivered',direction:'outgoing',startedAt:100});
 db.transfers.save({id:'zip',peerId:'phone',name:'folder.zip',status:'failed',direction:'outgoing',startedAt:200});
 assert.deepEqual(db.transfers.list({from:100,to:200}).map(r=>r.id),['photo']);
 assert.deepEqual(db.transfers.list({peerId:'phone',status:'failed',direction:'outgoing',kind:'archive'}).map(r=>r.id),['zip']);
 assert.deepEqual(db.transfers.list({kind:'image'}).map(r=>r.id),['photo']);
 assert.deepEqual(db.transfers.list({kind:'text',direction:'incoming'}).map(r=>r.id),['old']);
 for(const call of [null,JSON.stringify({type:'video',duration:30})]){
  db.db.prepare('INSERT OR REPLACE INTO messages(id,chatId,sender,text,timestamp,call) VALUES (?,?,?,?,?,?)').run('m','phone','me','hello',123,call);
  const target=path.join(root,'backup.orzip');db.exportBackupAsOrzip(target);
  assert.equal(db.restoreBackup(target).ok,true);
  assert.equal(db.db.prepare('SELECT call FROM messages WHERE id=?').get('m').call,call);
  assert.equal(db.transfers.get('old').name,rows[0].name);
 }
 const invalid=db.buildBackupPackage();invalid.data.messages[0].id=null;invalid.data.transfers=[{id:'bad'}];
 const bad=path.join(root,'bad.orzip');fs.writeFileSync(bad,zlib.gzipSync(JSON.stringify(invalid)));
 assert.equal(db.restoreBackup(bad).ok,false);
 assert.equal(db.db.prepare('SELECT text FROM messages WHERE id=?').get('m').text,'hello');
 assert.equal(db.transfers.get('old').name,rows[0].name);
 // Restore an old metadata backup, and convert interrupted tasks to a truthful failure.
 const legacy=db.buildBackupPackage();delete legacy.data.transfers;legacy.version=1;
 legacy.data.settings.push({key:'locallink.transfers',value:JSON.stringify([{...rows[0],status:'receiving'}])});
 const old=path.join(root,'legacy.orzip');fs.writeFileSync(old,zlib.gzipSync(JSON.stringify(legacy)));
 assert.equal(db.restoreBackup(old).ok,true);assert.equal(db.transfers.get('old').status,'failed');
 const zip=path.join(root,'backup with spaces.zip');await db.exportBackupAsZip(zip);assert.equal(db.restoreBackup(zip).ok,true);
 db.transfers.replace([]);assert.equal(db.transfers.list().length,0);
 console.log('PASS: indexed migration/search, message and call backup, legacy restore, transactional rollback');
}finally{db.db.close();}

})().catch(e=>{console.error(e);process.exitCode=1;});

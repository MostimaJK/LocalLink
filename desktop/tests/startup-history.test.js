const assert=require('node:assert/strict');
const Database=require('better-sqlite3');
const TransferStore=require('../src/js/database/transfers');
const db=new Database(':memory:');db.exec('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT)');
try{
 const store=new TransferStore(db);
 db.transaction(()=>{for(let i=0;i<20000;i++)store.save({id:String(i),peerId:'peer',name:'file.bin',status:'delivered',startedAt:i});store.save({id:'pending',peerId:'peer',status:'receiving'});})();
 let start=performance.now();const old=store.list({all:true}).filter(r=>['queued','preparing','awaiting','transferring','confirming','receiving','verifying'].includes(r.status));const oldMs=performance.now()-start;
 assert.equal(old.length,1);start=performance.now();store.interrupt();const indexedMs=performance.now()-start;
 assert.equal(store.get('pending').status,'failed');assert.equal(store.list({status:'delivered',all:true}).length,20000);
 console.log(JSON.stringify({historyRows:20001,oldScanMs:+oldMs.toFixed(2),indexedRecoveryMs:+indexedMs.toFixed(2)}));
}finally{db.close();}

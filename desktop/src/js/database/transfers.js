'use strict';

// One indexed row per file. The JSON payload leaves older records forward-compatible.
class TransferStore {
 constructor(db) {
  this.db=db;
  db.exec(`CREATE TABLE IF NOT EXISTS locallink_transfers (
   id TEXT PRIMARY KEY, peerId TEXT NOT NULL, startedAt INTEGER NOT NULL,
   name TEXT NOT NULL, status TEXT NOT NULL, direction TEXT NOT NULL, payload TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS ll_transfers_peer_time ON locallink_transfers(peerId,startedAt,id);
  CREATE INDEX IF NOT EXISTS ll_transfers_status ON locallink_transfers(status);`);
  this.put=db.prepare(`INSERT INTO locallink_transfers VALUES (@id,@peerId,@startedAt,@name,@status,@direction,@payload)
   ON CONFLICT(id) DO UPDATE SET peerId=excluded.peerId,startedAt=excluded.startedAt,name=excluded.name,
   status=excluded.status,direction=excluded.direction,payload=excluded.payload`);
  const old=db.prepare('SELECT value FROM settings WHERE key=?').get('locallink.transfers');
  if(old) db.transaction(()=>{
   const rows=JSON.parse(old.value);if(!Array.isArray(rows))throw new Error('Invalid transfer history');
   rows.forEach(r=>this.save(r));db.prepare('DELETE FROM settings WHERE key=?').run('locallink.transfers');
  })();
 }
 save(r){
  if(!r?.id||!r.peerId)throw new Error('Invalid transfer record');
  this.put.run({id:r.id,peerId:r.peerId,startedAt:r.startedAt||r.time||0,name:r.name||'',status:r.status||'failed',direction:r.direction||(r.status==='received'?'incoming':'outgoing'),payload:JSON.stringify(r)});
 }
 get(id){const row=this.db.prepare('SELECT payload FROM locallink_transfers WHERE id=?').get(id);return row?JSON.parse(row.payload):null;}
 list({peerId,query='',status,direction,from,to,kind,statuses,filesOnly,limit=200,offset=0,all=false}={}){
  const where=[],params=[];
  if(peerId){where.push('peerId=?');params.push(peerId);}
  if(query){where.push("name LIKE ? ESCAPE '\\'");params.push('%'+String(query).replace(/[\\%_]/g,'\\$&')+'%');}
  if(status){where.push('status=?');params.push(status);}
  if(Array.isArray(statuses)&&statuses.length){where.push('status IN ('+statuses.map(()=>'?').join(',')+')');params.push(...statuses);}
  if(filesOnly)where.push("(json_extract(payload,'$.path') IS NOT NULL OR json_extract(payload,'$.fileRemoved')=1)");
  if(direction){where.push('direction=?');params.push(direction);}
  if(from){where.push('startedAt>=?');params.push(Number(from));}
  if(to){where.push('startedAt<?');params.push(Number(to));}
  if(kind==='image')where.push("(lower(name) GLOB '*.png' OR lower(name) GLOB '*.jpg' OR lower(name) GLOB '*.jpeg' OR lower(name) GLOB '*.webp' OR lower(name) GLOB '*.gif')");
  if(kind==='text')where.push("(lower(name) GLOB '*.txt')");
  if(kind==='archive')where.push("(lower(name) GLOB '*.zip' OR lower(name) GLOB '*.7z' OR lower(name) GLOB '*.rar')");
  let sql='SELECT payload FROM locallink_transfers'+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY startedAt DESC,id DESC';
  if(!all){sql+=' LIMIT ? OFFSET ?';params.push(Math.max(1,Math.min(Number(limit)||200,1000)),Math.max(0,Number(offset)||0));}
  return this.db.prepare(sql).all(...params).map(r=>JSON.parse(r.payload));
 }
 replace(rows){this.db.transaction(()=>{this.db.exec('DELETE FROM locallink_transfers');rows.forEach(r=>this.save(r));})();}
 interrupt(){for(const row of this.list({all:true,statuses:['queued','preparing','awaiting','transferring','confirming','receiving','verifying']}))this.save({...row,status:'failed',error:'Transfer interrupted',time:Date.now()});}
 remove(id){return this.db.prepare('DELETE FROM locallink_transfers WHERE id=?').run(id).changes;}
}
module.exports=TransferStore;

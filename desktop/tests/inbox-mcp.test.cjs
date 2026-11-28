const assert = require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-inbox-test-'));
const dbPath=path.join(root,'test.db'),db=new DatabaseSync(dbPath);
try{
 db.exec('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE locallink_transfers(id TEXT,peerId TEXT,status TEXT,direction TEXT,name TEXT, startedAt INTEGER,payload TEXT)');
 const image=path.join(root,'sample.png');fs.writeFileSync(image,Buffer.from([1,2,3]));
 const r={id:'1',peerId:'desk',name:'sample.png',path:image,authenticated:true,diskIdentity:require('../lib/transfer-staging').identity(image,true)};
 const insert=db.prepare("INSERT INTO locallink_transfers VALUES(?,?,'received','incoming',?,1,?)");
 insert.run(r.id,r.peerId,r.name,JSON.stringify(r));
 insert.run('2','desk','Message',JSON.stringify({kind:'text',text:'private'}));
 const set=(key,v)=>db.prepare('INSERT OR REPLACE INTO settings VALUES(?,?)').run(key,JSON.stringify(v));
 function call(name,args={}){
  const req={jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}};
  return JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'../lib/inbox-mcp.cjs'),dbPath],{input:JSON.stringify(req)+'\n',encoding:'utf8',env:{...process.env,NODE_NO_WARNINGS:'1'}})).result;
 }
 assert(call('list_devices').isError);set('agent.enabled',true);set('agent.peer.desk',true);
 assert.equal(JSON.parse(call('list_received_items').content[0].text).length,1);
 assert.equal(call('read_attachment',{id:'1'}).content[0].data,'AQID');
 set('agent.attachments',false);assert(call('read_attachment',{id:'1'}).isError);
 assert.equal(JSON.parse(call('list_received_items').content[0].text).length,1);set('agent.attachments',true);
 fs.writeFileSync(image,'replaced');assert(call('read_attachment',{id:'1'}).isError);
 assert(call('read_message',{id:'2'}).isError);set('agent.item.2',true);
 assert.equal(call('read_message',{id:'2'}).content[0].text,'private');
 set('agent.item.2',false);assert(call('read_message',{id:'2'}).isError);
 console.log('PASS MCP stdio grants, revoke, authenticated sources, replacement and image content');
}finally{db.close();fs.rmSync(root,{recursive:true,force:true});}

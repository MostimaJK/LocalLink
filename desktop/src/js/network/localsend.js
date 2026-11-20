'use strict';
// LocalSend v2 upload API. No implicit trust and no automatic acceptance.
const https = require('https');
const http = require('http');
const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const PREFIX = '/api/localsend/v2/';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const normalize = value => String(value || '').replace(/:/g, '').toLowerCase();
async function jsonBody(req) {
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>1024*1024)throw new Error('Metadata too large');chunks.push(chunk);}
 return JSON.parse(Buffer.concat(chunks).toString());
}
function safeName(name) {
 return typeof name==='string' && name.length>0 && name.length<=180 && !/[<>:"/\\|?*\x00-\x1f]/.test(name) && !/[. ]$/.test(name) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) && name!=='.' && name!=='..';
}
class LocalSend {
 constructor(opts){this.opts=opts;this.peers=new Map();this.sessions=new Map();this.pending=false;this.sockets=new Set();this.closed=false;}
 info(){return {alias:this.opts.alias(),version:'2.2',deviceModel:process.platform,deviceType:'desktop',fingerprint:this.fingerprint,port:this.port,protocol:'https',download:false};}
 async start(){
  const certFile=path.join(this.opts.dataDir,'locallink-tls.json');
  let pem;
  if(fs.existsSync(certFile))pem=JSON.parse(fs.readFileSync(certFile,'utf8'));
  else {pem=await require('selfsigned').generate([{name:'commonName',value:'LocalLink'}],{keySize:2048,algorithm:'sha256'});fs.writeFileSync(certFile,JSON.stringify({private:pem.private,cert:pem.cert}),{mode:0o600,flag:'wx'});}
  if(this.closed)throw new Error('Transport stopped');
  this.fingerprint=hash(new crypto.X509Certificate(pem.cert).raw);
  this.server=https.createServer({key:pem.private,cert:pem.cert},(req,res)=>{this.route(req,res).catch(error=>{if(!res.headersSent)res.writeHead(400);res.end();this.opts.error?.(error.message);});});
  this.server.requestTimeout=10*60*1000;this.server.headersTimeout=15000;
  const listen=port=>new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(port,'0.0.0.0',()=>{this.server.removeListener('error',reject);resolve();});});
  try{await listen(this.opts.port??53317);}catch(error){if(error.code==='EADDRINUSE'&&this.opts.port==null)await listen(0);else throw error;}
  this.port=this.server.address().port;
  this.server.on('connection',socket=>{this.sockets.add(socket);socket.on('close',()=>this.sockets.delete(socket));});
  this.cleanup=setInterval(()=>{for(const [id,s] of this.sessions)if(Date.now()>s.expires)this.cancel(id);},5000);
  if(this.opts.discovery!==false){
   this.udp=dgram.createSocket({type:'udp4',reuseAddr:true});
   this.udp.on('error',error=>this.opts.error?.(error.message));
   this.udp.on('message',(bytes,r)=>{if(bytes.length>65536)return;try{const p=JSON.parse(bytes);this.observe(p,r.address);if(p.announce===true&&p.fingerprint!==this.fingerprint)this.announce(false);}catch{}});
   await new Promise((resolve,reject)=>{this.udp.once('error',reject);this.udp.bind(53317,resolve);});
   this.udp.addMembership('224.0.0.167');this.udp.setMulticastTTL(1);this.announce(true);
   this.beacons=setInterval(()=>this.announce(true),10000);
  }
  return this.info();
 }
 announce(announce=true){if(this.udp&&!this.closed)this.udp.send(Buffer.from(JSON.stringify({...this.info(),announce})),53317,'224.0.0.167');}
 observe(p,ip){
  if(!p||typeof p.alias!=='string'||p.alias.length>100||!net.isIP(ip)||!['http','https'].includes(p.protocol)||!Number.isInteger(p.port)||p.port<1||p.port>65535||!p.version?.startsWith('2.')||typeof p.fingerprint!=='string'||p.fingerprint.length>128||!p.fingerprint)return;
  if(normalize(p.fingerprint)===this.fingerprint)return;
  const id='localsend:'+normalize(p.fingerprint);
  const peer={...p,ip,id,seen:Date.now()};this.peers.set(id,peer);
  this.opts.peer?.({userId:id,username:p.alias,usertag:'LocalSend',status:'online',ip,transport:'localsend',lastSeen:Date.now()});
 }
 async route(req,res){
  const url=new URL(req.url,'https://localhost');const action=url.pathname.slice(PREFIX.length);
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(data?JSON.stringify(data):'');};
  if(!url.pathname.startsWith(PREFIX))return reply(404);
  const ip=req.socket.remoteAddress.replace(/^::ffff:/,'');
  if(action==='info'&&req.method==='GET')return reply(200,this.info());
  if(req.method!=='POST')return reply(405);
  if(action==='register'){const p=await jsonBody(req);this.observe(p,ip);return reply(200,this.info());}
  if(action==='prepare-upload'){
   if(this.pending||this.sessions.size>=4)return reply(409);
   this.pending=true;
   try{
    const body=await jsonBody(req);this.observe(body.info,ip);const entries=Object.entries(body.files||{});
    if(!body.info?.fingerprint||!entries.length||entries.length>100)return reply(400);
    let total=0;
    for(const [id,f] of entries){if(!id||id.length>128||!safeName(f.fileName)||!Number.isSafeInteger(f.size)||f.size<0||f.size>this.opts.maxBytes|| (f.sha256 && !/^[0-9a-f]{64}$/i.test(f.sha256)))return reply(400);total+=f.size;}
    if(total>this.opts.maxBytes)return reply(400);
    const allowed=await this.opts.accept({alias:String(body.info?.alias||ip).slice(0,100),ip,files:entries.map(([,f])=>({name:f.fileName,size:f.size})),total});
    if(!allowed||this.closed||res.destroyed)return reply(403);
    const sessionId=crypto.randomUUID();const files=new Map();
    for(const [id,f] of entries)files.set(id,{...f,token:crypto.randomUUID(),state:'ready'});
    this.sessions.set(sessionId,{ip,files,expires:Date.now()+10*60*1000,peerId:'localsend:'+normalize(body.info?.fingerprint),alias:String(body.info?.alias||ip).slice(0,100)});
    return reply(200,{sessionId,files:Object.fromEntries([...files].map(([id,f])=>[id,f.token]))});
   }finally{this.pending=false;}
  }
  const sid=url.searchParams.get('sessionId');const session=this.sessions.get(sid);
  if(!session||session.ip!==ip)return reply(403);
  if(action==='cancel'){this.cancel(sid);return reply(200);}
  if(action!=='upload')return reply(404);
  const file=session.files.get(url.searchParams.get('fileId'));
  if(!file||file.token!==url.searchParams.get('token'))return reply(403);
  if(file.state!=='ready')return reply(409);
  file.state='receiving';file.req=req;const startedAt=Date.now();
  fs.mkdirSync(this.opts.receiveDir,{recursive:true});
  const dir=fs.mkdtempSync(path.join(this.opts.receiveDir,'transfer-'));const partial=path.join(dir,'.partial');const dest=path.join(dir,file.fileName);
  const sha=crypto.createHash('sha256');let received=0;
  try{
   await pipeline(req,new Transform({transform(chunk,enc,cb){received+=chunk.length;if(received>file.size)return cb(new Error('Size exceeded'));sha.update(chunk);cb(null,chunk);}}),fs.createWriteStream(partial,{flags:'wx'}));
   if(received!==file.size||(file.sha256&&normalize(file.sha256)!==sha.digest('hex'))){fs.rmSync(partial,{force:true});fs.rmdirSync(dir);file.state='failed';return reply(422);}
   fs.renameSync(partial,dest);file.state='complete';
   this.opts.result?.({id:crypto.randomUUID(),peerId:session.peerId,name:file.fileName,size:received,path:dest,status:'received',direction:'incoming',startedAt,time:Date.now()});
   reply(200);
  }catch(error){file.state='failed';fs.rmSync(partial,{force:true});try{fs.rmdirSync(dir);}catch{}this.opts.error?.(error.message);if(!res.destroyed)reply(500);}
  finally{file.req=null;if([...session.files.values()].every(f=>['complete','failed'].includes(f.state)))this.sessions.delete(sid);}
 }
 cancel(id){const session=this.sessions.get(id);if(session)for(const f of session.files.values())f.req?.destroy();this.sessions.delete(id);}
 async request(peer,action,body,file){
  const raw=file?null:Buffer.from(JSON.stringify(body||{}));
  return new Promise((resolve,reject)=>{
   const client=peer.protocol==='https'?https:http;
   const req=client.request({host:peer.ip,port:peer.port,path:PREFIX+action,method:'POST',agent:false,rejectUnauthorized:false,headers:{'Content-Type':file?'application/octet-stream':'application/json','Content-Length':file?file.size:raw.length}},res=>{
    const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>1024*1024)res.destroy(new Error('Response too large'));else chunks.push(chunk);});res.on('error',reject);res.on('end',()=>{if(res.statusCode!==200)return reject(new Error('LocalSend HTTP '+res.statusCode));try{resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{});}catch(error){reject(error);}});
   });
   req.setTimeout(120000,()=>req.destroy(new Error('Transfer timed out')));req.on('error',reject);
   const send=()=>{if(file){const input=fs.createReadStream(file.path);input.on('error',e=>req.destroy(e));req.on('close',()=>input.destroy());input.pipe(req);}else req.end(raw);};
   if(peer.protocol==='https')req.on('socket',socket=>socket.once('secureConnect',()=>{const cert=socket.getPeerCertificate();if(!cert.raw||hash(cert.raw)!==normalize(peer.fingerprint))return req.destroy(new Error('Device certificate changed; rediscover the device'));send();}));else send();
  });
 }
 async send(peerId,filePath){
  const task={id:crypto.randomUUID(),peerId,name:path.basename(filePath),size:0,path:filePath,direction:'outgoing',startedAt:Date.now()};
  const publish=status=>{const record={...task,status,time:Date.now()};this.opts.result?.(record);return record;};
  try{
  const peer=this.peers.get(peerId);if(!peer||Date.now()-peer.seen>45000)throw new Error('Device is no longer nearby');
  const stat=fs.statSync(filePath);if(!stat.isFile()||stat.size>this.opts.maxBytes)throw new Error('File exceeds transfer limit');
  task.size=stat.size;publish('preparing');
  const sha=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(filePath))sha.update(chunk);
  const id=task.id;const file={id,fileName:task.name,size:stat.size,fileType:'application/octet-stream',sha256:sha.digest('hex')};
  publish('awaiting');
  const prepared=await this.request(peer,'prepare-upload',{info:this.info(),files:{[id]:file}});
  if(!prepared.sessionId||!prepared.files?.[id])throw new Error('Receiver did not accept the file');
  publish('transferring');
  try{await this.request(peer,'upload?'+new URLSearchParams({sessionId:prepared.sessionId,fileId:id,token:prepared.files[id]}),null,{path:filePath,size:stat.size});}
  catch(error){await this.request(peer,'cancel?'+new URLSearchParams({sessionId:prepared.sessionId})).catch(()=>{});throw error;}
  return publish('delivered');
  }catch(error){task.error=error.message;publish('failed');throw error;}
 }
 stop(){this.closed=true;clearInterval(this.cleanup);clearInterval(this.beacons);for(const id of this.sessions.keys())this.cancel(id);try{this.udp?.close();}catch{}for(const socket of this.sockets)socket.destroy();this.server?.close();}
}
module.exports={LocalSend,safeName};

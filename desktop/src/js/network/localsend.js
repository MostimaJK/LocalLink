'use strict';
// LocalSend v2 upload API. No implicit trust and no automatic acceptance.
const https = require('https');
const http = require('http');
const dgram = require('dgram');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const {Budget,normalizeLimits} = require('./bandwidth');
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
 constructor(opts){this.uploadBudget=new Budget();this.downloadBudget=new Budget();this.setBandwidth(opts.bandwidth);this.opts={...opts,maxBytes:opts.maxBytes ?? Number.MAX_SAFE_INTEGER};this.peers=new Map();this.sessions=new Map();this.pending=false;this.sockets=new Set();this.closed=false;this.outgoing=new Map();this.requests=new Set();this.idleMs=opts.idleTimeoutMs||120000;}
 setBandwidth(value){const limits=normalizeLimits(value);this.uploadBudget.set(limits.upload);this.downloadBudget.set(limits.download);}
 info(){return {alias:this.opts.alias(),version:'2.2',deviceModel:process.platform,deviceType:'desktop',fingerprint:this.fingerprint,port:this.port,protocol:'https',download:false,locallink:{messages:1}};}
 async start(){
  const certFile=path.join(this.opts.dataDir,'locallink-tls.json');
  let pem;
  if(fs.existsSync(certFile))pem=JSON.parse(fs.readFileSync(certFile,'utf8'));
  else {pem=await require('selfsigned').generate([{name:'commonName',value:'LocalLink'}],{keySize:2048,algorithm:'sha256'});fs.writeFileSync(certFile,JSON.stringify({private:pem.private,cert:pem.cert}),{mode:0o600,flag:'wx'});}
  if(this.closed)throw new Error('Transport stopped');
  this.fingerprint=hash(new crypto.X509Certificate(pem.cert).raw);
  this.pem=pem;
  this.server=https.createServer({key:pem.private,cert:pem.cert,requestCert:true,rejectUnauthorized:false},(req,res)=>{this.route(req,res).catch(error=>{if(!res.headersSent)res.writeHead(400);res.end();this.opts.error?.(error.message);});});
  this.server.requestTimeout=0;this.server.setTimeout(this.idleMs,socket=>socket.destroy());this.server.headersTimeout=15000;
  const listen=port=>new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(port,'0.0.0.0',()=>{this.server.removeListener('error',reject);resolve();});});
  try{await listen(this.opts.port??53317);}catch(error){if(error.code==='EADDRINUSE'&&this.opts.port==null)await listen(0);else throw error;}
  this.port=this.server.address().port;
  this.server.on('connection',socket=>{this.sockets.add(socket);socket.on('close',()=>this.sockets.delete(socket));});
  this.cleanup=setInterval(()=>this.sweep(),this.opts.cleanupIntervalMs||5000);
  // Receiving and manual registration only need HTTPS. Keep them available
  // when multicast is unavailable, and let Discover again retry the bind.
  await this.rediscover().catch(()=>{});
  if(this.closed)throw new Error('Transport stopped');
  return this.info();
 }
 async rediscover(){
  if(this.opts.discovery===false)return;
  if(this.closed)throw new Error('Transport stopped');
  if(this.discoveryStarting)return this.discoveryStarting;
  if(this.udp)return this.announce(true);
  this.discoveryStarting=this.startDiscovery();
  try{await this.discoveryStarting;}finally{this.discoveryStarting=null;}
 }
 async startDiscovery(){
  const socket=dgram.createSocket({type:'udp4',reuseAddr:true});
  try{
   await new Promise((resolve,reject)=>{
    socket.once('error',reject);
    socket.bind(this.opts.discoveryPort??53317,()=>{socket.removeListener('error',reject);resolve();});
   });
   if(this.closed)throw new Error('Transport stopped');
   socket.on('error',error=>this.opts.error?.(error.message));
   this.udp=socket;
   this.interfaces=new Set();
   socket.setMulticastTTL(1);
   socket.on('message',(bytes,r)=>{if(bytes.length>65536)return;try{const p=JSON.parse(bytes);this.observe(p,r.address);if(p.announce===true&&p.fingerprint!==this.fingerprint)this.announce(false);}catch{}});
   await this.announce(true);
   if(this.closed)throw new Error('Transport stopped');
   this.discoveryError=null;
   this.beacons=setInterval(()=>this.announce(true),10000);
  }catch(error){
   this.udp=null;
   this.discoveryError=error.message;
   try{socket.close();}catch{}
   throw error;
  }
 }
 refreshInterfaces(){
  const addresses=new Set(Object.values(os.networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal).map(a=>a.address));
  for(const ip of this.interfaces||[])if(!addresses.has(ip)){try{this.udp.dropMembership('224.0.0.167',ip);}catch{}this.interfaces.delete(ip);}
  for(const ip of addresses)if(!this.interfaces.has(ip))try{this.udp.addMembership('224.0.0.167',ip);this.interfaces.add(ip);}catch(error){this.opts.error?.(error.message);}
 }
 async announce(announce=true){
  if(!this.udp||this.closed||this.announcing)return;
  this.announcing=true;
  try{
   this.refreshInterfaces();const bytes=Buffer.from(JSON.stringify({...this.info(),announce}));
   // send() completes asynchronously. Do not change the socket interface before
   // the previous datagram has actually been submitted to the operating system.
   for(const ip of [...this.interfaces]){
    if(this.closed)break;
    try{this.udp.setMulticastInterface(ip);await new Promise((resolve,reject)=>this.udp.send(bytes,this.opts.discoveryPort??53317,'224.0.0.167',error=>error?reject(error):resolve()));}
    catch(error){this.opts.error?.(error.message);}
   }
  }finally{this.announcing=false;}
 }
 observe(p,ip){
  if(!p||typeof p.alias!=='string'||p.alias.length>100||!net.isIP(ip)||!['http','https'].includes(p.protocol)||!Number.isInteger(p.port)||p.port<1||p.port>65535||!p.version?.startsWith('2.')||typeof p.fingerprint!=='string'||p.fingerprint.length>128||!p.fingerprint)return;
  if(normalize(p.fingerprint)===this.fingerprint)return;
  const id='localsend:'+normalize(p.fingerprint);
  const peer={...p,ip,id,seen:Date.now()};this.peers.set(id,peer);
  this.opts.peer?.({userId:id,username:p.alias,usertag:'LocalSend',status:'online',ip,transport:'localsend',lastSeen:Date.now(),deviceType:p.deviceType,deviceModel:p.deviceModel});
  return peer;
 }
 async route(req,res){
  const url=new URL(req.url,'https://localhost');const action=url.pathname.slice(PREFIX.length);
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(data?JSON.stringify(data):'');};
  if(!url.pathname.startsWith(PREFIX))return reply(404);
  const ip=req.socket.remoteAddress.replace(/^::ffff:/,'');
  const clientCert=req.socket.getPeerCertificate?.();
  const authenticatedPeerId=clientCert?.raw?'localsend:'+hash(clientCert.raw):null;
  if(action==='info'&&req.method==='GET')return reply(200,this.info());
  if(req.method!=='POST')return reply(405);
  if(action==='register'){const p=await jsonBody(req);this.observe(p,ip);return reply(200,this.info());}
  if(action==='locallink-pair'){
   if(this.pending)return reply(409);
   this.pending=true;
   try{const body=await jsonBody(req);const peer=this.observe(body.info,ip);
    if(!peer||peer.id!==authenticatedPeerId||!this.opts.pair)return reply(403);
    if(!await this.opts.pair(peer))return reply(403);
    return reply(200,{paired:true});
   }finally{this.pending=false;}
  }
  if(action==='locallink-message'){
   if(this.pending)return reply(409);
   this.pending=true;
   try{
    const body=await jsonBody(req);
    if(typeof body.text!=='string'||!body.text.trim()||Buffer.byteLength(body.text)>65536)return reply(400);
    const peer=this.observe(body.info,ip);if(!peer)return reply(400);
    const allowed=await this.opts.accept({authenticatedPeerId:peer.id===authenticatedPeerId?authenticatedPeerId:null,alias:peer.alias,ip,files:[{name:body.text.slice(0,160),size:Buffer.byteLength(body.text)}],total:Buffer.byteLength(body.text)});
    if(!allowed||this.closed||res.destroyed)return reply(403);
    const task={id:crypto.randomUUID(),peerId:peer.id,name:'Message',kind:'text',text:body.text,direction:'incoming',startedAt:Date.now(),size:Buffer.byteLength(body.text),bytes:Buffer.byteLength(body.text)};
    this.publish(task,'received');return reply(200,{received:true});
   }finally{this.pending=false;}
  }
  if(action==='prepare-upload'){
   if(this.pending||this.sessions.size>=4)return reply(409);
   this.pending=true;
   try{
    const body=await jsonBody(req);this.observe(body.info,ip);const entries=Object.entries(body.files||{});
    if(!body.info?.fingerprint||!entries.length||entries.length>100)return reply(400);
    let total=0;
    for(const [id,f] of entries){if(!id||id.length>128||!safeName(f.fileName)||!Number.isSafeInteger(f.size)||f.size<0||f.size>this.opts.maxBytes|| (f.sha256 && !/^[0-9a-f]{64}$/i.test(f.sha256)))return reply(400);total+=f.size;}
    if(!Number.isSafeInteger(total)||total>this.opts.maxBytes)return reply(400);
    const allowed=await this.opts.accept({authenticatedPeerId:'localsend:'+normalize(body.info.fingerprint)===authenticatedPeerId?authenticatedPeerId:null,alias:String(body.info?.alias||ip).slice(0,100),ip,files:entries.map(([,f])=>({name:f.fileName,size:f.size})),total});
    if(!allowed||this.closed||res.destroyed)return reply(403);
    const sessionId=crypto.randomUUID();const files=new Map();
    for(const [id,f] of entries)files.set(id,{...f,token:crypto.randomUUID(),state:'ready',task:{id:crypto.randomUUID(),peerId:'localsend:'+normalize(body.info.fingerprint),name:f.fileName,size:f.size,direction:'incoming',startedAt:Date.now()+files.size,bytes:0}});
    this.sessions.set(sessionId,{ip,files,expires:Date.now()+10*60*1000,receiveDir:this.opts.receiveDir,peerId:'localsend:'+normalize(body.info?.fingerprint),alias:String(body.info?.alias||ip).slice(0,100)});
    for(const f of files.values())this.publish(f.task,'queued');
    return reply(200,{sessionId,files:Object.fromEntries([...files].map(([id,f])=>[id,f.token]))});
   }finally{this.pending=false;}
  }
  const sid=url.searchParams.get('sessionId');const session=this.sessions.get(sid);
  if(!session||session.ip!==ip)return reply(403);
  if(action==='cancel'){this.cancel(sid,'Cancelled by sender');return reply(200);}
  if(action!=='upload')return reply(404);
  const file=session.files.get(url.searchParams.get('fileId'));
  if(!file||file.token!==url.searchParams.get('token'))return reply(403);
  if(file.state!=='ready')return reply(409);
  file.state='receiving';file.req=req;session.expires=Date.now()+this.idleMs;
  const task=file.task;task.transferStartedAt=Date.now();let dir,partial,dest,tempRoot;
  this.publish(task,'receiving');
  const sha=crypto.createHash('sha256');let received=0;
  try{
   fs.mkdirSync(session.receiveDir,{recursive:true});
   const disk=fs.statfsSync(session.receiveDir);
   if(Number(disk.bavail)*Number(disk.bsize)<file.size)throw new Error('Not enough disk space');
   tempRoot=path.join(session.receiveDir,'.locallink-partials');
   fs.mkdirSync(tempRoot,{recursive:true});
   if(fs.lstatSync(tempRoot).isSymbolicLink())throw new Error('Invalid temporary directory');
   dir=fs.mkdtempSync(path.join(tempRoot,'transfer-'));
   partial=path.join(dir,'.partial');
   const transport=this;
   await pipeline(req,this.downloadBudget.stream(),new Transform({transform(chunk,enc,cb){
    received+=chunk.length;if(received>file.size)return cb(new Error('Size exceeded'));
    session.expires=Date.now()+transport.idleMs;sha.update(chunk);
    transport.progress(task,received,'receiving');cb(null,chunk);
   }}),fs.createWriteStream(partial,{flags:'wx'}));
   if(['cancelled','failed'].includes(task.status))throw new Error(task.error||'Cancelled');
   this.publish(task,'verifying');
   if(received!==file.size||(file.sha256&&normalize(file.sha256)!==sha.digest('hex'))){
    const error=new Error('File integrity check failed');error.statusCode=422;throw error;
   }
   dest=await require('./receive-file').publishFile(partial,session.receiveDir,file.fileName);
   if(['cancelled','failed'].includes(task.status)){await fs.promises.unlink(dest);dest=null;throw new Error(task.error||'Cancelled');}
   file.state='complete';task.path=dest;task.bytes=received;
   if(file.fileType==='text/plain'&&typeof file.preview==='string'&&received<=1024*1024){task.kind='text';task.text=fs.readFileSync(dest,'utf8');}
   this.publish(task,'received');reply(200);
  }catch(error){
   file.state='failed';if(partial)fs.rmSync(partial,{force:true});if(dir)try{fs.rmdirSync(dir);}catch{}
   if(!['cancelled','failed'].includes(task.status)){task.error=error.message;this.publish(task,'failed');}
   if(!res.destroyed)reply(error.statusCode||500);
  }finally{
   if(partial)try{fs.unlinkSync(partial);}catch{}
   if(dir)try{fs.rmdirSync(dir);}catch{}
   if(tempRoot)try{fs.rmdirSync(tempRoot);}catch{}
   file.req=null;
   if([...session.files.values()].every(f=>['complete','failed','cancelled'].includes(f.state)))this.sessions.delete(sid);
   else if(![...session.files.values()].some(f=>f.state==='receiving'))session.expires=Date.now()+10*60*1000;
  }
 }
 publish(task,status){
  task.status=status;task.time=Date.now();
  const record={...task};delete record.lastProgress;
  this.opts.result?.(record);return record;
 }
 progress(task,bytes,status){
  task.bytes=Math.min(bytes,task.size);
  const now=Date.now();
  if(now-(task.lastProgress||0)<250&&bytes!==task.size)return;
  task.lastProgress=now;
  task.rate=Math.round(bytes*1000/Math.max(1,now-(task.transferStartedAt||task.startedAt)));
  this.publish(task,status);
 }
 sweep(){for(const [id,s] of this.sessions)if(Date.now()>s.expires)this.cancel(id,'Transfer timed out','failed');}
 cancel(id,reason='Cancelled',status='cancelled'){
  const session=this.sessions.get(id);
  if(session)for(const f of session.files.values()){
   if(['complete','failed','cancelled'].includes(f.state))continue;
   f.state=status;f.task.error=reason;this.publish(f.task,status);f.req?.destroy(new Error(reason));
  }
  this.sessions.delete(id);
 }
 cancelTask(id){
  const batch=this.outgoing.get(id);if(batch){batch.controller.abort(new Error('Cancelled'));return true;}
  for(const [sid,s] of this.sessions)if([...s.files.values()].some(f=>f.task.id===id)){this.cancel(sid);return true;}
  return false;
 }
 async discover(address){
  const url=typeof address==='string'?URL.parse(address.includes('://')?address:'https://'+address):null;
  if(!url)throw new Error('Enter an IP address with an optional port');
  const ip=url.hostname.replace(/^\[|\]$/g,'');
  if(!net.isIP(ip)||!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Enter an IP address with an optional port');
  const endpoint={ip,port:Number(url.port||53317),protocol:url.protocol.slice(0,-1)};
  // First contact discovers identity from the TLS certificate; it does not grant trust.
  const data=await this.request(endpoint,'register',this.info(),null,{discover:true,timeout:10000});
  const peer=this.observe({...data,...endpoint,fingerprint:endpoint.fingerprint||data.fingerprint},ip);
  if(!peer)throw new Error('Not a compatible nearby device');return peer;
 }
 async request(peer,action,body,file,options={}){
  const raw=file?null:Buffer.from(JSON.stringify(body||{}));
  return new Promise((resolve,reject)=>{
   const client=peer.protocol==='https'?https:http;
   const req=client.request({host:peer.ip,port:peer.port,path:PREFIX+action,method:'POST',agent:false,rejectUnauthorized:false,cert:this.pem?.cert,key:this.pem?.private,signal:options.signal,headers:{'Content-Type':file?'application/octet-stream':'application/json','Content-Length':file?file.size:raw.length}},res=>{
    const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>1024*1024)res.destroy(new Error('Response too large'));else chunks.push(chunk);});res.on('error',reject);res.on('end',()=>{if(![200,204].includes(res.statusCode)){const e=new Error(({401:'PIN required or incorrect',403:'Receiver declined the transfer',409:'Receiver is busy',422:'File integrity check failed',429:'Too many attempts'}[res.statusCode]||'LocalSend error')+' (HTTP '+res.statusCode+')');e.statusCode=res.statusCode;return reject(e);}try{resolve(res.statusCode===204?{finished:true}:chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{});}catch(error){reject(error);}});
   });
   this.requests.add(req);req.once('close',()=>this.requests.delete(req));
   req.setTimeout(options.timeout||this.idleMs,()=>req.destroy(new Error('Transfer timed out')));req.on('error',reject);
   const send=()=>{
    if(!file){req.end(raw);return;}
    const input=fs.createReadStream(file.path),limiter=this.uploadBudget.stream();
    let bytes=0;
    limiter.on('data',chunk=>{bytes+=chunk.length;options.progress?.(bytes);});
    req.once('finish',()=>options.flushed?.());
    pipeline(input,limiter,req).catch(error=>req.destroy(error));
   };
   if(peer.protocol==='https')req.on('socket',socket=>socket.once('secureConnect',()=>{const cert=socket.getPeerCertificate();if(options.discover&&cert.raw)peer.fingerprint=hash(cert.raw);if(!cert.raw||hash(cert.raw)!==normalize(peer.fingerprint))return req.destroy(new Error('Device certificate changed; rediscover the device'));send();}));else send();
  });
 }
 async send(peerId,filePath,options={}){return (await this.sendBatch(peerId,[filePath],options))[0];}
 async sendMessage(peerId,text){
  if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>65536)throw new Error('Text must contain 1 byte to 64 KiB');
  const peer=this.peers.get(peerId);
  if(!peer||Date.now()-peer.seen>45000)throw new Error('Device is no longer nearby');
  if(peer.protocol!=='https'||peer.locallink?.messages!==1)throw new Error('Native messages are not supported');
  const task={id:crypto.randomUUID(),peerId,name:'Message',kind:'text',text,direction:'outgoing',startedAt:Date.now(),size:Buffer.byteLength(text),bytes:0};
  const controller=new AbortController();this.outgoing.set(task.id,{peerId,controller});
  this.publish(task,'awaiting');
  try{const result=await this.request(peer,'locallink-message',{info:this.info(),text},null,{signal:controller.signal});if(result.received!==true)throw new Error('Message was not acknowledged');task.bytes=task.size;return this.publish(task,'delivered');}
  catch(error){task.error=error.message;this.publish(task,controller.signal.aborted?'cancelled':'failed');throw error;}
  finally{this.outgoing.delete(task.id);}
 }
 async sendBatch(peerId,paths,options={}){
  if(!Array.isArray(paths)||!paths.length||paths.length>100)throw new Error('Choose 1–100 files');
  if([...this.outgoing.values()].some(b=>b.peerId===peerId))throw new Error('A transfer to this device is already running');
  const batch={peerId,controller:new AbortController()};const signal=batch.controller.signal;
  const batchStartedAt=Date.now();
  const tasks=paths.map((filePath,index)=>({id:crypto.randomUUID(),peerId,name:path.basename(filePath),size:0,path:filePath,direction:'outgoing',startedAt:batchStartedAt+index,bytes:0,...(options.text!=null?{kind:'text',text:options.text}:{})}));
  tasks.forEach(t=>{this.outgoing.set(t.id,batch);this.publish(t,'queued');options.onRegistered?.(t.path);});
  let peer,prepared;
  try{
   peer=this.peers.get(peerId);if(!peer||Date.now()-peer.seen>45000)throw new Error('Device is no longer nearby');
   let total=0;const files={};
   for(const task of tasks){
    signal.throwIfAborted();const stat=await fs.promises.stat(task.path);total+=stat.size;
    if(!stat.isFile()||!Number.isSafeInteger(stat.size)||!Number.isSafeInteger(total)||!safeName(task.name)||total>this.opts.maxBytes)throw new Error('File selection exceeds transfer limit or has an unsupported name');
    task.size=stat.size;this.publish(task,'preparing');
    const sha=crypto.createHash('sha256');
    for await(const chunk of fs.createReadStream(task.path,{signal}))sha.update(chunk);
    const mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',txt:'text/plain',pdf:'application/pdf',mp4:'video/mp4'};
    files[task.id]={id:task.id,fileName:task.name,size:task.size,fileType:mime[path.extname(task.name).slice(1).toLowerCase()]||'application/octet-stream',sha256:sha.digest('hex'),...(options.text!=null?{preview:options.text}:{})};
    this.publish(task,'awaiting');
   }
   const action='prepare-upload'+(options.pin?'?'+new URLSearchParams({pin:options.pin}):'');
   prepared=await this.request(peer,action,{info:this.info(),files},null,{signal});
   if(prepared.finished)return tasks.map(t=>{t.bytes=t.size;return this.publish(t,'delivered');});
   if(!prepared.sessionId)throw new Error('Receiver did not create a transfer session');
   for(const task of tasks){
    signal.throwIfAborted();
    if(!prepared.files?.[task.id]){task.error='Receiver did not accept this file';this.publish(task,'failed');continue;}
    task.transferStartedAt=Date.now();this.publish(task,'transferring');
    await this.request(peer,'upload?'+new URLSearchParams({sessionId:prepared.sessionId,fileId:task.id,token:prepared.files[task.id]}),null,{path:task.path,size:task.size},{signal,
     progress:bytes=>this.progress(task,bytes,'transferring'),flushed:()=>this.publish(task,'confirming')});
    task.bytes=task.size;this.publish(task,'delivered');
   }
   return tasks.map(t=>({...t}));
  }catch(error){
   for(const task of tasks)if(!['delivered','failed'].includes(task.status)){task.error=signal.aborted?'Cancelled':error.message;this.publish(task,signal.aborted?'cancelled':'failed');}
   if(prepared?.sessionId)await this.request(peer,'cancel?'+new URLSearchParams({sessionId:prepared.sessionId}),null,null,{timeout:3000}).catch(()=>{});
   throw error;
  }finally{tasks.forEach(t=>this.outgoing.delete(t.id));}
 }
 stop(){this.closed=true;for(const b of this.outgoing.values())b.controller.abort(new Error('Transport stopped'));for(const req of this.requests)req.destroy(new Error('Transport stopped'));clearInterval(this.cleanup);clearInterval(this.beacons);for(const id of this.sessions.keys())this.cancel(id);try{this.udp?.close();}catch{}for(const socket of this.sockets)socket.destroy();this.server?.close();}
}
module.exports={LocalSend,safeName};

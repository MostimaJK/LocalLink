'use strict';
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { publishFile } = require('../src/js/network/receive-file');

class BrowserRoom {
  constructor({record, receiveDir, changed, receiptMinutes=()=>0, staging}) {
    this.id = randomUUID();
    this.receiptMinutes=receiptMinutes;
    this.staging=staging;
    this.files = new Map();
    this.messages = [];
    this.localFiles = [];
    this.closed = false;
    this.changed = changed;
    this.record = record;
    this.receiveDir = receiveDir;
    this.pending = new Set();
  }
  message(sender, text) {
    if (this.closed || typeof text !== 'string' || !text.trim() || Buffer.byteLength(text) > 8192) return false;
    this.messages.push({id:randomUUID(), sender, text:text.trim(), time:Date.now()});
    if (this.messages.length > 120) this.messages.shift();
    this.changed?.();
    return true;
  }
  summary() {
    return [...this.localFiles,...Array.from(this.files.values(), f=>({id:f.id,name:f.name,sender:f.sender,size:f.size,time:f.time,ready:!!f.path,saved:!!f.saved,saveFailed:!!f.saveFailed,host:f.hostApproved}))];
  }
  received(file) {
    this.localFiles.push(file);
    this.changed?.();
  }
  async directory() {
    this.temp ??= fs.mkdtemp(path.join(os.tmpdir(),'locallink-room-')).then(dir=>{this.tracked=this.staging?.track(dir,'room');return dir;});
    return this.temp;
  }
  list(number) {
    return Array.from(this.files.values()).filter(f => f.sender === number || f.recipients.has(number)).map(f => ({
      id:f.id, name:f.name, size:f.size, sender:f.sender,time:f.time,ready:!!f.path,hasPreview:!!f.preview,decision:f.sender===number?'sent':f.recipients.get(number)
    }));
  }
  depart(number){
    for(const f of this.files.values()){
      if(f.recipients.get(number)==='pending'){
        f.recipients.set(number,'reject');f.notify?.();
      }
    }
  }
  decide(id, number, answer) {
    const f = this.files.get(id);
    if (!f || f.recipients.get(number) !== 'pending' || !['accept','reject'].includes(answer)) return false;
    f.recipients.set(number,answer);
    f.notify?.();
    return true;
  }
  async offer(batch, sender, others, hostDecision, response) {
    const lifecycle = new EventEmitter();
    let resolve, settled = false;
    const accepted = new Promise(done => { resolve = done; });
    let host = 'pending';
    const items = batch.map(({name,size,preview}) => {
      const f = {id:randomUUID(), name, size, preview,sender,time:Date.now(), recipients:new Map(others.map(n=>[n,'pending']))};
      this.files.set(f.id,f);
      return f;
    });
    const check = () => {
      // A batch uploads only files with at least one willing recipient.
      if (host === 'pending' && !items.every(f=>[...f.recipients.values()].includes('accept'))) return;
      if (host === 'reject' && items.some(f=>![...f.recipients.values()].includes('accept') && [...f.recipients.values()].includes('pending'))) return;
      finish(items.map(f=>host === 'accept' || [...f.recipients.values()].includes('accept') ? f : null));
    };
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      response.off('close',cancel);
      resolve(result);
    };
    const cancel = () => {
      lifecycle.destroyed = true;
      lifecycle.emit('close');
      finish([]);
    };
    const minutes=Number(this.receiptMinutes());
    const timer = minutes>0 ? setTimeout(() => {
      for (const f of items) for (const [n,v] of f.recipients) if(v==='pending') f.recipients.set(n,'reject');
      if(host==='pending') { host='reject'; lifecycle.emit('close'); }
      check();
    },Math.min(minutes,1440)*60000) : null;
    this.pending.add(cancel);
    let hostDone=false;
    response.once('close',cancel);
    for (const f of items) f.notify=check;
    Promise.resolve().then(()=>hostDecision(lifecycle)).then(async yes => {
      if (this.closed || lifecycle.destroyed) return;
      host = yes ? 'accept' : 'reject';
      for (const f of items) f.hostApproved = yes;
      check();
      this.changed?.();
      if (yes) await Promise.all(items.filter(f=>f.path).map(f=>this.save(f)));
    }).catch(()=>{host='reject';check();}).finally(()=>{hostDone=true;if(settled)this.pending.delete(cancel);});
    const result = await accepted;
    if(hostDone)this.pending.delete(cancel);
    for (const f of items) {
      delete f.notify;
      if (!result.includes(f)) this.files.delete(f.id);
    }
    return result;
  }
  async save(f) {
    if(this.closed || !f.hostApproved || !f.path)return false;
    if(f.saved)return true;
    if (f.saving) return f.saving;
    f.saving = (async()=>{
      const dir=this.receiveDir();
      await fs.mkdir(dir,{recursive:true});
      const dest=f.savedPath??=await publishFile(f.path,dir,f.name,{staging:this.staging});
      this.record({id:f.id,peerId:'web:browser',sender:f.sender,roomId:this.id,name:f.name,size:f.size,bytes:f.size,path:dest,direction:'incoming',status:'received',startedAt:f.time||Date.now()});
      f.saved=true;f.saveFailed=false;
      return true;
    })().catch(error=>{
      f.saveFailed=true;
      this.record({id:f.id,peerId:'web:browser',sender:f.sender,roomId:this.id,name:f.name,size:f.size,direction:'incoming',status:'failed',error:error.message,startedAt:Date.now()});
      return false;
    }).finally(()=>{f.saving=null;this.changed?.();});
    return f.saving;
  }
  async ready(f, temp) {
    const finalPath=path.join(await this.directory(),f.id);
    await fs.rename(temp,finalPath);
    f.stat=await fs.stat(finalPath);
    f.path=finalPath;
    if (f.hostApproved) await this.save(f);
    this.changed?.();
  }
  cancelPending() {
    this.closed=true;
    for(const cancel of this.pending) cancel();
  }
  async close() {
    this.cancelPending();
    await Promise.allSettled([...this.files.values()].map(f=>f.saving).filter(Boolean));
    this.files.clear();
    this.messages.length=0;
    this.localFiles.length=0;
    if(this.temp) await fs.rm(await this.temp,{recursive:true,force:true,maxRetries:4,retryDelay:150});
    this.staging?.forgetIfGone(this.tracked);
  }
}
module.exports={BrowserRoom};

"use strict";
const {Transform} = require('node:stream');
const {setTimeout: sleep} = require('node:timers/promises');
const {performance} = require('node:perf_hooks');

// Decimal MB/s, per application and direction, not per file. Zero is unlimited.
function normalizeLimits(value = {}) {
 const valid = n => typeof n === 'number' && Number.isFinite(n) && n >= 0.1 && n <= 1000 ? n : 0;
 return {upload: valid(value?.upload), download: valid(value?.download)};
}
class Budget {
 constructor(){this.rate=0;this.tokens=0;this.last=performance.now();}
 set(mbps){this.rate=mbps*1000000;this.tokens=0;this.last=performance.now();}
 async take(bytes, signal){
  while(this.rate){
   signal.throwIfAborted();
   const now=performance.now();
   this.tokens=Math.min(Math.max(16384,Math.min(262144,this.rate/10)),this.tokens+(now-this.last)*this.rate/1000);
   this.last=now;
   if(this.tokens>=bytes){this.tokens-=bytes;return;}
   await sleep(Math.min(50,Math.max(1,(bytes-this.tokens)*1000/this.rate)),null,{signal});
  }
 }
 stream(){
  const budget=this,controller=new AbortController();
  return new Transform({
   transform(chunk,encoding,callback){
    if(!budget.rate){callback(null,chunk);return;}
    (async()=>{
     for(let offset=0;offset<chunk.length;offset+=16384){
      const part=chunk.subarray(offset,offset+16384);
      await budget.take(part.length,controller.signal);
      controller.signal.throwIfAborted();this.push(part);
     }
    })().then(()=>callback(),callback);
   },
   destroy(error,callback){controller.abort();callback(error);}
  });
 }
}
module.exports={Budget,normalizeLimits};

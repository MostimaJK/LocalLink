const assert=require('node:assert/strict');
const {Readable,Writable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {Budget,normalizeLimits}=require('../src/js/network/bandwidth');
async function run(budget,size){let count=0;await pipeline(Readable.from([Buffer.alloc(size)]),budget.stream(),new Writable({write(c,e,cb){count+=c.length;cb();}}));assert.equal(count,size);}
(async()=>{
 assert.deepEqual(normalizeLimits({upload:-1,download:Infinity}),{upload:0,download:0});
 const b=new Budget();b.set(1);let start=performance.now();
 await Promise.all([run(b,1000000),run(b,1000000)]);
 const seconds=(performance.now()-start)/1000;
 assert.ok(seconds>=1.7&&seconds<5,'aggregate limit: '+seconds);
 b.set(0.1);start=performance.now();const task=run(b,1000000);setTimeout(()=>b.set(0),150);await task;
 assert.ok(performance.now()-start<1500,'live unlimited');
 b.set(0.1);const limiter=b.stream();const cancelled=pipeline(Readable.from([Buffer.alloc(1000000)]),limiter,new Writable({write(c,e,cb){cb();}}));
 setTimeout(()=>limiter.destroy(new Error('cancelled')),30);await assert.rejects(cancelled,/cancelled/);
 console.log('PASS aggregate budget, live changes, unlimited, cancellation; aggregate seconds='+seconds.toFixed(2));
})().catch(e=>{console.error(e);process.exitCode=1;});

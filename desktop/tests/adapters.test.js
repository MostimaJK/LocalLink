const assert=require('node:assert/strict');
const {normalizeAdapters,createAdapterReader}=require('../src/js/network/adapters');
(async()=>{
 const rows=normalizeAdapters([{Name:'wifi',Status:'Disconnected',MediaType:'Native 802.11',HardwareInterface:true,TransmitLinkSpeed:2402000000},{Name:'lan',Status:'Up',MediaType:'802.3',HardwareInterface:true,TransmitLinkSpeed:1000000000,ReceiveLinkSpeed:1000000000},{Name:'vpn',Status:'Up',HardwareInterface:false,TransmitLinkSpeed:10000000000}]);
 assert.equal(rows.find(r=>r.name==='wifi').sendBps,null);assert.equal(rows.find(r=>r.name==='wifi').kind,'wifi');assert.equal(rows.find(r=>r.name==='lan').kind,'ethernet');assert.equal(rows.find(r=>r.name==='vpn').kind,'virtual');
 let calls=0,now=100;const read=createAdapterReader({platform:'win32',now:()=>now,run:async(file,args,opts)=>{calls++;assert.equal(opts.windowsHide,true);assert.equal(opts.timeout,10000);return {stdout:JSON.stringify({Name:'single',Status:'Up',TransmitLinkSpeed:0})};}});
 await Promise.all([read(),read()]);assert.equal(calls,1);await read();assert.equal(calls,1);now+=5001;await read();assert.equal(calls,2);
 const mac=await createAdapterReader({platform:'darwin',interfaces:()=>({
  lo0:[{internal:true,family:'IPv4',address:'127.0.0.1'}],en1:[{internal:false,family:'IPv4',address:'192.0.2.3'},{internal:false,family:'IPv6',address:'fe80::1'}]
 })})();
 assert.deepEqual(mac.adapters,[{name:'en1',description:'192.0.2.3'}]);
 assert.equal(mac.addressesOnly,true);
 assert.equal((await createAdapterReader({platform:'linux'})()).reason,'unsupported');
 assert.equal((await createAdapterReader({platform:'win32',run:async()=>{throw Error('timeout');}})()).reason,'unavailable');
 assert.equal((await createAdapterReader({platform:'win32',run:async()=>({stdout:'invalid'})})()).ok,false);
 console.log('PASS adapter types, stale disconnected speed, unknown speed, single result, shared cache, timeout and unsupported platform');
})().catch(e=>{console.error(e);process.exitCode=1;});

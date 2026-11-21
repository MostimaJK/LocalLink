// Isolated idle profiler: no LAN discovery or real user data.
const {_electron}=require('@playwright/test');
const fs=require('fs'),os=require('os'),path=require('path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const software=process.argv.includes('--software');
 const label=(process.argv[2]||'current').replace(/[^a-zA-Z0-9_-]/g,'_'),data=fs.mkdtempSync(path.join(os.tmpdir(),'ll-resource-profile-'));
 const start=performance.now();
 const app=await _electron.launch({args:['.','--user-data-dir='+data,...(software?['--disable-gpu']:[]),'--no-sandbox'],cwd:path.resolve(__dirname,'..'),env:{...process.env,LOCALLINK_TEST_NO_DISCOVERY:'1'}});
 try{
 const page=await app.firstWindow();await page.waitForSelector('#middle-sidebar-container');await page.waitForFunction(()=>window.localSendStatus?.ok);
 const readyMs=Math.round(performance.now()-start);console.log(label+' ready '+readyMs+' ms');
 await page.evaluate(()=>{window.__profile={mapCalls:0,friendsUpdates:0};const draw=window.SettingsModal._drawNetworkMap;window.SettingsModal._drawNetworkMap=function(...args){window.__profile.mapCalls++;return draw.apply(this,args);};window.store.subscribe((state,changed)=>{if(changed?.friends)window.__profile.friendsUpdates++;});});
 const results=[];
 for(const mode of ['foreground','settings','hidden']){
  if(mode==='settings')await page.evaluate(()=>window.SettingsModal.open('account'));
  if(mode==='hidden'){await page.evaluate(()=>window.SettingsModal.close());await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].hide());}
  await sleep(1200);await page.evaluate(()=>{window.__profile.mapCalls=0;window.__profile.friendsUpdates=0;});
  const before=await app.evaluate(({app})=>app.getAppMetrics());const began=performance.now();await sleep(16000);
  const metrics=await app.evaluate(({app})=>app.getAppMetrics());const seconds=(performance.now()-began)/1000;
  const prior=new Map(before.map(p=>[p.pid,p.cpu.cumulativeCPUUsage]));
  results.push({mode,seconds:+seconds.toFixed(2),workingMiB:+(metrics.reduce((n,p)=>n+p.memory.workingSetSize,0)/1024).toFixed(1),privateMiB:+(metrics.reduce((n,p)=>n+(p.memory.privateBytes||0),0)/1024).toFixed(1),cpuOneCorePercent:+(100*metrics.reduce((n,p)=>n+Math.max(0,p.cpu.cumulativeCPUUsage-(prior.get(p.pid)||0)),0)/seconds).toFixed(2),...await page.evaluate(()=>({...window.__profile,domNodes:document.querySelectorAll('*').length,jsHeapMiB:Math.round(performance.memory.usedJSHeapSize/1048576)}))});
  console.log(JSON.stringify(results.at(-1)));
 }
 const output=path.resolve(__dirname,'../.agent/resource-'+label+'.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({label,readyMs,conditions:'Fresh isolated data; discovery disabled; GPU '+(software?'disabled':'enabled')+'; 16-second samples; CPU is one-core equivalent.',results},null,2));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const {_electron}=require('@playwright/test');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),{execFileSync,spawn}=require('child_process');
const updater=require('../lib/update-restart');const {hashFile}=updater;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-update-package-')),data=path.join(root,'資料'),target=path.join(root,'LocalLink.exe');fs.mkdirSync(data);
 const source=path.resolve(process.env.LOCALLINK_NEW_PORTABLE||'dist/refresh-1.0.1-portable/LocalLink-1.0.1-Portable.exe');
 fs.copyFileSync(path.resolve(process.env.LOCALLINK_OLD_PORTABLE||'../release/1.0.0/LocalLink-1.0.0-Portable.exe'),target);
 const before=await hashFile(target),digest=await hashFile(source);assert.notEqual(before,digest,'Test must replace old bytes with new bytes');
 const app=await _electron.launch({executablePath:path.resolve('dist/refresh-1.0.1-installer/win-unpacked/LocalLink.exe'),args:['--user-data-dir='+data,'--disable-gpu','--no-sandbox'],env:{...process.env,LOCALLINK_TEST_NO_DISCOVERY:'1',PORTABLE_EXECUTABLE_FILE:target}});
 let result;
 try{
  const page=await app.firstWindow();await page.waitForSelector('#middle-sidebar-container');
  await page.evaluate(()=>window.Identity.update({username:'Update preserved'}));
  await page.waitForFunction(()=>window.localSendStatus?.ok===true);
  const identity=fs.readFileSync(path.join(data,'locallink-tls.json'),'utf8');
  await app.evaluate(async ({app},{source,digest,root})=>{
   app.setPath('downloads',root);
   const fs=process.mainModule.require('node:fs'),stream=process.mainModule.require('node:stream');
   global.fetch=async url=>String(url).endsWith('SHA256SUMS.txt')?new Response(digest+'  LocalLink-1.0.1-Portable.exe\n'):new Response(stream.Readable.toWeb(fs.createReadStream(source)));
  },{source,digest,root});
  const download=await page.evaluate(()=>window.orbitAPI.downloadUpdate({url:'https://github.com/MostimaJK/LocalLink/releases/download/v1.0.1/LocalLink-1.0.1-Portable.exe',name:'LocalLink-1.0.1-Portable.exe',manifestUrl:'https://github.com/MostimaJK/LocalLink/releases/download/v1.0.1/SHA256SUMS.txt'}));
  assert.equal(download.ok,true,JSON.stringify(download));
  // An active call must prevent quitting, even with a verified update available.
  await page.evaluate(()=>{window.CallManager.activeCall={};});
  assert.equal((await page.evaluate(file=>window.orbitAPI.installUpdate(file),download.path)).error,'active-transfers');
  await page.evaluate(()=>{window.CallManager.activeCall=null;});
  // Playwright owns and kills the Electron process tree on exit. Run the handoff
  // outside its ownership, using the same verified download and real packaged target.
  await app.close();
  const parent=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{windowsHide:true,stdio:'ignore'});
  const jobInfo=await updater.prepare({file:download.path,sha256:digest,target,userData:data,portable:true,pid:parent.pid,version:'1.0.1'});
  process.env.LOCALLINK_TEST_NO_DISCOVERY='1';
  await updater.start(jobInfo);parent.kill();
  const jobs=path.join(data,'locallink-updates');const job=path.join(jobs,fs.readdirSync(jobs)[0]);
  for(let i=0;i<500&&!fs.existsSync(path.join(job,'result.json'));i++)await sleep(250);
  result=JSON.parse(fs.readFileSync(path.join(job,'result.json'),'utf8').replace(/^\uFEFF/,''));
  assert.equal(result.status,'updated',JSON.stringify(result));assert.equal(await hashFile(target),digest);
  assert.equal(fs.readFileSync(path.join(data,'locallink-tls.json'),'utf8'),identity);
  assert.ok(fs.readFileSync(path.join(data,'orbit.db')).includes(Buffer.from('Update preserved')));
  console.log('PASS: packaged download IPC, active-call guard, verified portable replacement, real new EXE restart/ready handshake and retained identity/data');
 }finally{
  await Promise.race([app.close().catch(()=>{}),sleep(3000)]);
  const cleanup=path.join(root,'stop-test.ps1');fs.writeFileSync(cleanup,'param([string]$DataRoot)\nGet-CimInstance Win32_Process | Where-Object { $_.Name -eq "LocalLink.exe" -and $_.CommandLine -and $_.CommandLine.Contains($DataRoot) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }');
  execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',cleanup,'-DataRoot',data],{windowsHide:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});



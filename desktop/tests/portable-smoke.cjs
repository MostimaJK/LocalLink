const {chromium}=require('@playwright/test');const {spawn,execFileSync}=require('child_process');const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert'),net=require('net');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'ll-portable-'));const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const child=spawn(path.resolve(process.env.LOCALLINK_PORTABLE_TEST_EXE||'dist/portable/LocalLink-'+require('../package.json').version+'-Portable.exe'),['--user-data-dir='+data,'--remote-debugging-port='+port,'--disable-gpu','--no-sandbox'],{windowsHide:true,stdio:'ignore',env:{...process.env,LOCALLINK_TEST_NO_DISCOVERY:'1'}});let browser;
 try{
  let ready=false;for(let i=0;i<180;i++){try{const result=await fetch('http://127.0.0.1:'+port+'/json/version');if(result.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'Portable application started');
  browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);const page=browser.contexts()[0].pages()[0];await page.waitForSelector('#middle-sidebar-container');
  assert.equal(await page.evaluate(()=>window.orbitAPI.getAppVersion()),require('../package.json').version);assert.equal(await page.evaluate(()=>window.I18n.locale),'en');
  assert.equal(await page.evaluate(()=>window.orbitAPI.portable),true);
  await page.evaluate(()=>window.SettingsModal.open('about'));await page.locator('#settings-btn-check-update').waitFor({state:'visible'});
  await page.evaluate(()=>window.SettingsModal.open('account'));await page.locator('#input-username').fill('Portable test');await page.locator('#btn-save-account').click();
  assert.equal(await page.evaluate(()=>window.store.getState().currentUser.username),'Portable test');assert.ok(fs.existsSync(path.join(data,'orbit.db')));
  console.log('PASS: single portable EXE self-extracts, launches the expected version, renders UI, writes isolated SQLite');
 }finally{await browser?.close();try{execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});}catch{}}
})().catch(e=>{console.error(e);process.exitCode=1;});

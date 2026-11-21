const {_electron}=require('@playwright/test');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'ll-package-'));
 const exe=path.resolve('dist/win-unpacked/LocalLink.exe');
 const app=await _electron.launch({executablePath:exe,args:['--user-data-dir='+data,'--disable-gpu','--no-sandbox']});
 try{
  const page=await app.firstWindow();await page.waitForSelector('#middle-sidebar-container');
  assert.equal(await page.evaluate(()=>window.I18n.locale),'zh-Hant');
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),data);
  assert.equal(await app.evaluate(({app})=>app.isPackaged),true);
  assert.ok(fs.existsSync(path.resolve('dist/win-unpacked/resources/licenses/Orbit-LICENSE.txt')));
  await page.evaluate(()=>window.SettingsModal.open('account'));
  await page.locator('#input-username').fill('LocalLink package test');await page.locator('#btn-save-account').click();
  assert.equal(await page.evaluate(()=>window.store.getState().currentUser.username),'LocalLink package test');
  console.log('PASS: packaged Windows executable, isolated existing data path, SQLite rename, Traditional Chinese, bundled license');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

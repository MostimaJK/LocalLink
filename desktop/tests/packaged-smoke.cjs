const {_electron}=require('@playwright/test');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'ll-package-'));
 const exe=path.resolve(process.env.LOCALLINK_PACKAGED_TEST_EXE||'dist/win-unpacked/LocalLink.exe');
 const app=await _electron.launch({executablePath:exe,env:{...process.env,LOCALLINK_TEST_NO_DISCOVERY:'1'},args:['--user-data-dir='+data,'--disable-gpu','--no-sandbox']});
 try{
  const page=await app.firstWindow();await page.waitForSelector('#middle-sidebar-container');
  assert.equal(await page.evaluate(()=>window.I18n.locale),'en');
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),data);
  assert.equal(await app.evaluate(({app})=>app.isPackaged),true);
  assert.equal(await page.evaluate(()=>window.orbitAPI.portable),false);
  await page.evaluate(()=>window.SettingsModal.open('about'));await page.locator('#settings-btn-check-update').waitFor({state:'visible'});
  assert.ok(fs.existsSync(path.join(path.dirname(exe),'resources/licenses/Orbit-LICENSE.txt')));
  await page.evaluate(()=>window.SettingsModal.open('account'));
  await page.locator('#input-username').fill('LocalLink package test');await page.locator('#btn-save-account').click();
  assert.equal(await page.evaluate(()=>window.store.getState().currentUser.username),'LocalLink package test');
  console.log('PASS: packaged Windows executable, isolated existing data path, SQLite rename, English default, bundled license');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

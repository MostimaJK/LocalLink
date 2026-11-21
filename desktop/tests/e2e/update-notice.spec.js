const {test,expect}=require('@playwright/test');
const {launchApp,tmpUserDataDir}=require('./helpers');
const crypto=require('node:crypto');

test('GitHub updates: settings, package selection, verified download and rejection',async()=>{
 const directory=tmpUserDataDir('updates');
 const {app,page}=await launchApp(directory,[],{fixtureLocale:false});
 try {
  await page.evaluate(()=>window.SettingsModal.open('about'));
  await expect(page.locator('#settings-btn-check-update')).toHaveText('Check for updates');
  await expect(page.locator('#ll-auto-update')).not.toBeChecked();
  await page.locator('#ll-auto-update').check();
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.updateCheck'))).toBe(true);
  await page.evaluate(()=>{
   const engine=window.Orbit.UpdateCheck;
   if(engine.REPO!=='MostimaJK/LocalLink') throw Error('wrong repo');
   const assets=['LocalLink-9.0.0-Portable.exe','LocalLink-Setup-9.0.0.exe'].map(name=>({name,browser_download_url:'https://github.com/MostimaJK/LocalLink/releases/download/v9.0.0/'+name}));
   if(engine.pickAsset({assets},'win32','x64',true).name!==assets[0].name) throw Error('portable');
   if(engine.pickAsset({assets},'win32','x64',false).name!==assets[1].name) throw Error('setup');
   if(window.orbitAPI.platform==='darwin'){
     const name='LocalLink-9.0.0-'+window.orbitAPI.arch+'.dmg';
     assets.push({name,browser_download_url:'https://github.com/MostimaJK/LocalLink/releases/download/v9.0.0/'+name});
   }
   assets.push({name:'SHA256SUMS.txt',browser_download_url:'https://github.com/MostimaJK/LocalLink/releases/download/v9.0.0/SHA256SUMS.txt'});
   return window.UpdateNotice.checkManual({fetchImpl:async()=>({ok:true,json:async()=>[{tag_name:'v9.0.0',assets,body:'- Better transfers',html_url:'https://github.com/MostimaJK/LocalLink/releases/tag/v9.0.0'}]})});
  });
  await expect(page.locator('#update-notice-modal')).toBeVisible();
  await expect(page.locator('#update-open-file')).toBeHidden();
  const hash=crypto.createHash('sha256').update('fixture update bytes').digest('hex');
  await app.evaluate(({app,net},{directory,hash})=>{
   app.setPath('downloads',directory);
   net.fetch=async url=>String(url).endsWith('SHA256SUMS.txt')
    ? new Response(hash+'  LocalLink-Setup-9.0.0.exe\n'+hash+'  LocalLink-9.0.0-'+process.arch+'.dmg\n')
    : new Response('fixture update bytes');
  },{directory,hash});
  await page.locator('#update-modal-download').click();
  await expect(page.locator('#update-download-status')).toContainText('Checksum verified');
  await expect(page.locator('#update-reveal-file')).toBeVisible();
  await expect(page.locator('#update-open-file')).toBeVisible({visible:process.platform==='win32'});
  // Never execute the fixture. Exercise backend rejection with the real IPC handler.
  const rejected=await page.evaluate(()=>window.orbitAPI.downloadUpdate({url:'https://github.com/other/repo/releases/download/v1/test.exe',name:'test.exe'}));
  expect(rejected.ok).toBe(false);
  await app.evaluate(({net})=>{net.fetch=async url=>String(url).endsWith('SHA256SUMS.txt')?new Response('0'.repeat(64)+'  bad.exe'):new Response('bad bytes');});
  const bad=await page.evaluate(()=>window.orbitAPI.downloadUpdate({url:'https://github.com/MostimaJK/LocalLink/releases/download/v9/bad.exe',name:'bad.exe',manifestUrl:'https://github.com/MostimaJK/LocalLink/releases/download/v9/SHA256SUMS.txt'}));
  expect(bad.ok).toBe(false);expect(bad.error).toMatch(/checksum/);
  await app.evaluate(({net})=>{net.fetch=async (url,options)=>new Promise((resolve,reject)=>{
   options.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});
  });});
  const cancelled=await page.evaluate(async()=>{
   const pending=window.orbitAPI.downloadUpdate({url:'https://github.com/MostimaJK/LocalLink/releases/download/v9/cancel.exe',name:'cancel.exe',manifestUrl:'https://github.com/MostimaJK/LocalLink/releases/download/v9/SHA256SUMS.txt'});
   setTimeout(()=>window.orbitAPI.cancelUpdateDownload(),100);
   return pending;
  });
  expect(cancelled.cancelled).toBe(true);
  await page.locator('#update-modal-close').click();
  await page.evaluate(()=>{window.I18n.set('zh-Hant');window.SettingsModal.open('about');});
  await expect(page.locator('#settings-btn-check-update')).toHaveText('檢查更新');
  await page.evaluate(()=>{window.I18n.set('zh-Hans');window.SettingsModal.open('about');});
  await expect(page.locator('#settings-btn-check-update')).toHaveText('检查更新');
  const unavailable=await page.evaluate(()=>window.UpdateNotice.checkManual({fetchImpl:async()=>({ok:false,status:404})}));
  expect(unavailable.ok).toBe(false);
  const current=await page.evaluate(()=>window.UpdateNotice.checkManual({fetchImpl:async()=>({ok:true,json:async()=>[{tag_name:'v1.0.0',body:'- Current release',assets:[]}]})}));
  expect(current.hasUpdate).toBe(false);
 } finally {await app.close();}
});

test('About shows recovery for an interrupted Setup update',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('recovery-ui'),[],{fixtureLocale:false});
 try{
  test.skip(process.platform!=='win32','Windows Setup recovery');
  await app.evaluate(({ipcMain})=>{
   ipcMain.removeHandler('locallink-update-recovery');
   ipcMain.handle('locallink-update-recovery',(_,arg)=>arg?.action?{error:'active-transfers'}:{id:'fixture',version:'1.0.7',updated:false,available:true});
  });
  await page.evaluate(()=>window.SettingsModal.open('about'));
  const panel=page.locator('#ll-last-update');
  await expect(panel).toContainText('Previous update did not finish');
  await panel.getByRole('button',{name:'Run installer again'}).click();
  await expect(panel).toContainText('Finish transfers and sharing first.');
 }finally{await app.close();}
});

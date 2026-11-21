const {test,expect}=require('@playwright/test');
const {launchApp,tmpUserDataDir,chooseSetting}=require('./helpers');
const path=require('path');
test('network adapters are detected on demand and safely displayed in settings',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('adapters'),[],{keepBootState:true});
 try{
  await page.evaluate(()=>window.SettingsModal.open('general'));
  await page.locator('#ll-check-adapters').click();
  await expect(page.locator('#ll-check-adapters')).toBeEnabled({timeout:15000});
  const info=await page.evaluate(()=>window.orbitAPI.invoke('locallink-network-adapters'));
  expect(info.ok).toBe(true);expect(info.adapters.length).toBeGreaterThan(0);
  for(const adapter of info.adapters)await expect(page.locator('#ll-adapters-result')).toContainText(adapter.name);
  await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('locallink-network-adapters');ipcMain.handle('locallink-network-adapters',()=>({ok:true,adapters:[{name:'Ethernet <img src=x onerror=alert(1)>',description:'Test adapter',connected:true,kind:'ethernet',sendBps:1000000000,receiveBps:1000000000},{name:'Wi-Fi',description:'Wireless adapter',connected:false,kind:'wifi',sendBps:null,receiveBps:null}]}));});
  await page.locator('#ll-check-adapters').click();
  await expect(page.locator('#ll-adapters-result')).toContainText('125 MB/s');
  await expect(page.locator('#ll-adapters-result img')).toHaveCount(0);
  await page.screenshot({path:path.resolve('../artifacts/network-adapters-settings.png')});
  for(const locale of ['en','zh-Hans']){await chooseSetting(page,'interface-language',locale);await page.locator('#ll-check-adapters').click();await expect(page.locator('#ll-adapters-result')).toContainText('125 MB/s');}
 }finally{await app.close();}
});

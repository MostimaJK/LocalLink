const { test, expect } = require('@playwright/test');
const {tmpUserDataDir, launchApp} = require('./helpers');
const path = require('path');
test('centered window, nearby sightings and explicit favorites have separate lifetimes', async () => {
  const dir = tmpUserDataDir('device-browser');
  let {app, page} = await launchApp(dir, [], {keepBootState:true});
  try {
    const bounds = await app.evaluate(({BrowserWindow,screen}) => {
      const win = BrowserWindow.getAllWindows()[0];
      return {bounds:win.getBounds(), area:screen.getDisplayMatching(win.getBounds()).workArea, maximized:win.isMaximized(), fullscreen:win.isFullScreen()};
    });
    expect(bounds.maximized).toBe(false);
    expect(bounds.fullscreen).toBe(false);
    expect(Math.abs(bounds.bounds.x + bounds.bounds.width/2 - (bounds.area.x + bounds.area.width/2))).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.bounds.y + bounds.bounds.height/2 - (bounds.area.y + bounds.area.height/2))).toBeLessThanOrEqual(1);
    await expect(page.locator('#chat-welcome-host')).toContainText('在你的裝置之間傳輸');
    await expect(page.locator('#friends-list-container')).not.toContainText('Local demo');
    await page.evaluate(() => window.store.addOrUpdatePeer({userId:'wan-only', username:'Internet peer', status:'online', usertag:'0001'}));
    await expect(page.locator('#friends-list-container')).not.toContainText('Internet peer');
    // Inject the main-process discovery notification; no physical LAN peer is claimed.
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.send('locallink-lan-seen', {userId:'lan-test', username:'Test laptop', usertag:'0002', status:'online', ip:'192.0.2.2'}));
    await expect(page.locator('#friends-list-container')).toContainText('Test laptop');
    await page.locator('[data-favorite-id="lan-test"]').click();
    await page.evaluate(() => {
      const d = window.LocalLinkDevices;
      d.nearby.set(d.key('lan-test'), Date.now()-46000);
      window.store.setState({friends:[...window.store.getState().friends]});
    });
    await expect(page.locator('#friends-list-container')).not.toContainText('Test laptop');
    await page.locator('[data-device-scope="favorites"]').click();
    await expect(page.locator('#friends-list-container')).toContainText('Test laptop');
    await page.screenshot({path:path.resolve('../artifacts/phase2-home.png')});
    await app.close();
    ({app,page} = await launchApp(dir, [], {keepBootState:true}));
    await expect(page.locator('#friends-list-container')).not.toContainText('Test laptop');
    await page.locator('[data-device-scope="favorites"]').click();
    await expect(page.locator('#friends-list-container')).toContainText('Test laptop');
    await page.locator('[data-favorite-id="lan-test"]').click();
    await expect(page.locator('#friends-list-container')).not.toContainText('Test laptop');
    await page.locator('[data-device-scope="history"]').click();
    await expect(page.locator('#friends-list-container')).toContainText('Test laptop');
  } finally { await app.close(); }
});

test('manual discovery preserves local metadata and suppresses unchanged heartbeats',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('manual-refresh'),[],{keepBootState:true});
 try{
  await page.evaluate(()=>{
   const d=window.LocalLinkDevices,p={userId:'localsend:refresh-fixture',username:'Laptop',status:'online',deviceType:'laptop',lastSeen:Date.now()};
   d.observe(p);window.orbitAPI.dbSetSetting(d.key(p.userId),{...d.get(p),alias:'My laptop',favorite:true});
   window.store.setState({friends:[...window.store.getState().friends]});
   window.__peerUpdates=0;window.store.subscribe((state,changed)=>{if(changed.friends)window.__peerUpdates++;});
   d.observe({...p,lastSeen:Date.now()+1});
  });
  expect(await page.evaluate(()=>window.__peerUpdates)).toBe(0);
  await app.evaluate(({ipcMain})=>{global.__refreshCount=0;ipcMain.removeHandler('locallink-rediscover');ipcMain.handle('locallink-rediscover',()=>{global.__refreshCount++;return {ok:true};});});
  await page.locator('[data-device-refresh]').click();await expect(page.locator('[data-device-refresh]')).toBeDisabled();
  await page.evaluate(()=>window.LocalLinkDevices.refresh());
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('locallink-lan-seen',{userId:'localsend:new-device',username:'New phone',status:'online',deviceType:'mobile',lastSeen:Date.now()}));
  await expect(page.locator('#friends-list-container')).toContainText('New phone');
  await expect(page.locator('[data-device-refresh]')).toBeDisabled();
  await expect(page.locator('[data-device-refresh]')).toBeEnabled();expect(await app.evaluate(()=>global.__refreshCount)).toBe(1);
  expect(await page.evaluate(()=>window.LocalLinkDevices.get({userId:'localsend:refresh-fixture'}))).toMatchObject({alias:'My laptop',favorite:true});
  for(const [locale,label] of [['en','Refresh devices'],['zh-Hans','刷新设备'],['zh-Hant','重新搜尋裝置']]){
   await page.evaluate(locale=>window.I18n.set(locale),locale);await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();
  }
  await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('locallink-rediscover');ipcMain.handle('locallink-rediscover',()=>({ok:false,error:'Network unavailable'}));});
  await page.locator('[data-device-refresh]').click();await expect(page.locator('#ll-device-refresh-status')).toContainText('Network unavailable');await expect(page.locator('[data-device-refresh]')).toBeEnabled();
  await page.evaluate(()=>{const d=window.LocalLinkDevices;d.nearby.set(d.key('localsend:refresh-fixture'),Date.now()-46000);d.expireNearby();});
  await page.locator('[data-device-scope="favorites"]').click();await expect(page.locator('#friends-list-container')).toContainText('My laptop');
  await expect(page.locator('[data-id="localsend:refresh-fixture"]')).toHaveAttribute('data-debug',/Status: offline/);
 }finally{await app.close();}
});

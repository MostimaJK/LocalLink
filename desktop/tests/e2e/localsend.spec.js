const {test,expect}=require('@playwright/test');
const {tmpUserDataDir,launchApp}=require('./helpers');
const path=require('path');
const fs=require('fs');
const peer={userId:'localsend:test',username:'ROGDESK',usertag:'LocalSend',status:'online',ip:'192.0.2.2'};
const screen=name=>path.resolve('../artifacts/'+name+'.png');

test('file conversation preserves order, direction, status, history and scroll',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('localsend-chat'),[],{keepBootState:true});
 try{
  await expect.poll(()=>page.evaluate(()=>window.localSendStatus)).toEqual({ok:true});
  await app.evaluate(({BrowserWindow},p)=>BrowserWindow.getAllWindows()[0].webContents.send('locallink-lan-seen',p),peer);
  await page.locator('.list-row[data-id="localsend:test"]').click();
  await expect(page.locator('#localsend-send')).toBeVisible();
  await expect(page.locator('#chat-input')).toHaveCount(0);
  await page.screenshot({path:screen('conversation-empty')});
  // Fixtures are presentation data, not real transfer evidence.
  await page.evaluate(()=>{
   const day=new Date();day.setHours(9,0,0,0);const start=day.getTime();
   const rows=[
    {id:'a',name:'專案資料.zip',size:25165824,status:'delivered',startedAt:start,time:start+120000},
    {id:'b',name:'設計草圖.png',size:4300000,status:'received',startedAt:start+60000,time:start+70000},
    {id:'c',name:'會議記錄.pdf',size:230000,status:'awaiting',startedAt:start+180000,time:start+180000}
   ].map(r=>({...r,peerId:'localsend:test',path:'C:\\Users\\Example\\Downloads\\LocalLink\\'+r.name}));
   window.orbitAPI.dbSetSetting('locallink.transfers',rows);
   window.LocalSendPanel.render(window.store.getState().friends.find(p=>p.userId==='localsend:test'),window.ChatPanel.container);
  });
  const cards=page.locator('.ll-transfer');
  expect(await cards.evaluateAll(els=>els.map(el=>el.dataset.transferId))).toEqual(['a','b','c']);
  await expect(page.locator('[data-transfer-id="b"]')).toHaveClass(/ll-incoming/);
  await expect(page.locator('[data-transfer-id="a"]')).toHaveClass(/ll-outgoing/);
  await expect(page.locator('[data-transfer-id="c"]')).toContainText('等待對方接收');
  await expect(page.locator('[data-transfer-id="c"] [data-open]')).toHaveCount(0);
  await expect(page.locator('.ll-date')).toHaveCount(1);
  const bounds=await page.locator('#localsend-send').boundingBox();
  expect(bounds.y+bounds.height).toBeLessThanOrEqual(await page.evaluate(()=>innerHeight));
  await page.screenshot({path:screen('conversation-dark')});
  // A final status must update the original card in place in chronological order.
  await page.evaluate(()=>{
   const rows=window.orbitAPI.dbGetSetting('locallink.transfers',[]);rows[2]={...rows[2],status:'failed',error:'Receiver declined the transfer'};
   window.orbitAPI.dbSetSetting('locallink.transfers',rows);
   window.LocalSendPanel.render(window.store.getState().friends.find(p=>p.userId==='localsend:test'),window.ChatPanel.container);
  });
  await expect(cards).toHaveCount(3);
  await expect(page.locator('[data-transfer-id="c"]')).toContainText('傳輸失敗');
  await page.locator('[data-transfer-id="a"] summary').click();
  await page.evaluate(()=>{
   const rows=window.orbitAPI.dbGetSetting('locallink.transfers',[]);
   for(let i=0;i<15;i++)rows.push({...rows[0],id:'extra'+i,startedAt:rows[2].startedAt+60000*(i+1)});
   window.orbitAPI.dbSetSetting('locallink.transfers',rows);
   const peer=window.store.getState().friends.find(p=>p.userId==='localsend:test');
   window.LocalSendPanel.render(peer,window.ChatPanel.container);
   document.querySelector('.ll-timeline').scrollTop=50;
   window.LocalSendPanel.render(peer,window.ChatPanel.container);
  });
  expect(Math.abs(await page.locator('.ll-timeline').evaluate(el=>el.scrollTop)-50)).toBeLessThan(1); // Windows DPI rounds to device pixels.
  await expect(page.locator('[data-transfer-id="a"] details')).toHaveAttribute('open','');
  await page.evaluate(()=>{
   window.LocalLinkDevices.nearby.clear();
   window.LocalSendPanel.render(window.store.getState().friends.find(p=>p.userId==='localsend:test'),window.ChatPanel.container);
  });
  await expect(page.locator('#localsend-send')).toBeDisabled();
  await expect(cards).toHaveCount(18);
  // Missing files fail visibly, without opening an unrelated path.
  await page.locator('[data-transfer-id="a"] [data-open]').click();
  await expect(page.locator('#localsend-feedback')).toContainText('File is no longer available');
  await page.evaluate(()=>{
   const rows=window.orbitAPI.dbGetSetting('locallink.transfers',[]).slice(0,3);window.orbitAPI.dbSetSetting('locallink.transfers',rows);
   window.LocalSendPanel.feedback.clear();
   window.store.setState({settings:{...window.store.getState().settings,theme:'light'}});
   window.LocalSendPanel.render(window.store.getState().friends.find(p=>p.userId==='localsend:test'),window.ChatPanel.container);
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(page.locator('html')).not.toHaveClass(/theme-transitioning/);
  await expect(page.locator('.ll-file-copy strong').first()).toHaveCSS('color','rgb(26, 29, 46)');
  await page.screenshot({path:screen('conversation-light')});
  // An asynchronous send completion must not steal the newly selected conversation.
  await app.evaluate(({ipcMain})=>{
   ipcMain.removeHandler('locallink-send-selected');
   ipcMain.handle('locallink-send-selected',()=>new Promise(resolve=>{globalThis.__finishSend=resolve;}));
  });
  await page.evaluate(()=>{
   const peer=window.store.getState().friends.find(p=>p.userId==='localsend:test');
   window.LocalLinkDevices.observe(peer);window.LocalSendPanel.render(peer,window.ChatPanel.container);
  });
  await page.locator('#localsend-send').click();
  await page.evaluate(()=>{
   window.store.addOrUpdatePeer({userId:'localsend:other',username:'Other device',usertag:'LocalSend',status:'offline'});
   window.store.setState({activeChatId:'localsend:other'});
  });
  await app.evaluate(()=>globalThis.__finishSend({cancelled:true}));
  await expect.poll(()=>page.evaluate(()=>window.LocalSendPanel.busy.has('localsend:test'))).toBe(false);
  await expect(page.locator('.ll-peer-heading h2')).toHaveText('Other device');
 }finally{await app.close();}
});

test('settings retain Orbit cards, localize language, and keep notices in license details',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('settings-polish'),[],{keepBootState:true});
 try{
  await page.locator('#btn-profile').click();
  await expect(page.locator('#settings-content')).toContainText('裝置名稱');
  await expect(page.locator('#transport-mode')).toHaveCount(0);
  await expect(page.locator('#settings-content')).not.toContainText('Language /');
  await page.screenshot({path:screen('settings-device-refined')});
  await page.locator('#input-username').fill('未保存的设备名');
  await page.locator('#interface-language').selectOption('en');
  await expect(page.locator('#settings-content')).toContainText('Interface language');
  await expect(page.locator('#input-username')).toHaveValue('未保存的设备名');
  await page.locator('#interface-language').selectOption('zh-Hans');
  await expect(page.locator('#settings-content')).toContainText('界面语言');
  await page.locator('#interface-language').selectOption('zh-Hant');
  await page.locator('.settings-tab[data-tab="network"]').click();
  await expect(page.locator('#settings-content')).toContainText('區域網路傳輸');
  await page.locator('#settings-content summary').click();
  await expect(page.locator('#transport-mode')).toHaveValue('localsend');
  await page.locator('#transport-mode').selectOption('orbit');
  await expect(page.locator('#transport-save-msg')).toContainText('重新啟動');
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.transport'))).toBe('orbit');
  await page.locator('#transport-mode').selectOption('localsend');
  await page.locator('.settings-tab[data-tab="about"]').click();
  await expect(page.locator('.ll-about-brand')).toContainText('LocalLink');
  await expect(page.locator('#settings-content pre')).not.toBeVisible();
  await page.screenshot({path:screen('about-locallink-refined')});
  await page.locator('#settings-content summary').click();
  const license=fs.readFileSync(path.resolve('../LICENSE'),'utf8').replace(/\r\n/g,'\n').trim();
  expect((await page.locator('#settings-content pre').innerText()).trim()).toBe(license);
  // Also verify controls fit a shorter normal desktop window.
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,680));
  await page.locator('.settings-tab[data-tab="account"]').click();
  await expect(page.locator('#btn-save-account')).toBeInViewport();
  await expect(page.locator('#interface-language')).toBeInViewport();
 }finally{await app.close();}
});

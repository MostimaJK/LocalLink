const {test,expect}=require('@playwright/test');
const {launchApp,tmpUserDataDir,chooseSetting}=require('./helpers');
const path=require('path');

test('general settings prioritize folders and retain preferences across sections',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('general-settings'),[],{keepBootState:true});
 try {
  await page.evaluate(()=>window.SettingsModal.open('network'));
  await expect(page.locator('.settings-tab.active')).toHaveText('通用');
  await expect(page.locator('.settings-tab[data-tab="network"],.settings-tab[data-tab="data"],.settings-tab[data-tab="notifications"]')).toHaveCount(0);
  await expect(page.locator('#ll-choose-directory')).toBeInViewport();
  expect(await page.locator('[data-general-section]').evaluateAll(nodes=>nodes.map(n=>n.dataset.generalSection))).toEqual(['account','network','notifications','data']);
  const order=process.platform==='win32'?['language','admin','receiving','name']:['language','receiving','name'];
  expect(await page.locator('#settings-content > section, #settings-content > [data-general-section="account"]').evaluateAll((nodes,count)=>nodes.slice(0,count).map(node=>
    node.querySelector('#interface-language')?'language':node.querySelector('#ll-admin-launch')?'admin':node.querySelector('#ll-receive-path')?'receiving':node.querySelector('#input-username')?'name':'other'
  ),order.length)).toEqual(order);
  await expect(page.locator('#settings-content')).not.toContainText('單次傳輸上限');
  expect(await page.locator('#ll-show-history').evaluate(el=>!!el.closest('section').nextElementSibling.querySelector('#ll-run-in-background'))).toBe(true);
  await expect(page.locator('#transport-mode option[value=localsend]')).toHaveText('LocalSend');
  await expect(page.locator('#ll-check-adapters')).toHaveCount(0);
  await expect(page.locator('#settings-content > :last-child.ll-cache-row output')).toHaveText('0 B');
  const parent=tmpUserDataDir('folder-input');
  const receive=page.locator('#ll-receive-path'),update=page.locator('#ll-update-path');
  await expect(receive).not.toHaveValue('');
  await expect(update).not.toHaveValue('');
  await receive.fill(path.join(parent,'received'));await receive.press('Enter');
  await expect.poll(()=>page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.receiveDir'))).toBe(path.join(parent,'received'));
  await update.fill(parent);await update.press('Enter');
  await expect(update).toHaveValue(path.join(parent,'LocalLink Updates'));
  await update.press('Enter');
  await expect.poll(()=>page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.updateParent'))).toBe(parent);
  await page.locator('.ll-folder-tools summary').click();
  await page.locator('#ll-update-reset').click();
  await expect(update).not.toHaveValue(path.join(parent,'LocalLink Updates'));
  expect(await page.locator('#settings-content [id]').evaluateAll(nodes=>{const ids=nodes.map(n=>n.id);return ids.length===new Set(ids).size;})).toBe(true);
  await page.screenshot({path:path.resolve('../artifacts/settings-general-top.png')});
  await chooseSetting(page,'ll-upload-limit','5');
  await chooseSetting(page,'ll-download-limit','10');
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.bandwidth'))).toEqual({upload:5,download:10});
  await page.screenshot({path:path.resolve('../artifacts/settings-bandwidth.png')});
  const limit=page.locator('#ll-large-transfer-limit');
  await limit.fill('2.5');await limit.press('Tab');
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.largeTransferGB'))).toBe(2.5);
  await page.locator('.ll-receive-options').screenshot({path:path.resolve('../artifacts/receiving-options.png')});
  await page.locator('#ll-open-after-receive').check();
  await page.locator('#ll-transfer-notifications').uncheck();
  await page.locator('#ll-export-records').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.resolve('../artifacts/settings-general-data.png')});
  await page.locator('.settings-tab[data-tab="appearance"]').click();
  await page.locator('.settings-tab[data-tab="account"]').click();
  await expect(page.locator('#ll-upload-limit')).toHaveValue('5');
  await expect(page.locator('#ll-download-limit')).toHaveValue('10');
  await expect(page.locator('#ll-open-after-receive')).toBeChecked();
  await expect(page.locator('#ll-transfer-notifications')).not.toBeChecked();
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.openAfterReceive'))).toBe(true);
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.transferNotifications'))).toBe(false);
  await chooseSetting(page,'interface-language','en');
  await expect(page.locator('.settings-tab.active')).toHaveText('General');
  await chooseSetting(page,'interface-language','zh-Hans');
  await expect(page.locator('.settings-tab.active')).toHaveText('通用');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,680));
  await page.locator('.settings-tab[data-tab="account"]').click();
  await expect(page.locator('#ll-choose-directory')).toBeInViewport();
  await page.evaluate(()=>window.SettingsModal.open('about'));
  await expect(page.locator('#settings-btn-check-update')).toBeVisible();
 }finally {await app.close();}
});


test('idle polling avoids unchanged renders and network-map work follows visibility',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('idle-work'),[],{keepBootState:true});
 try{
  expect(await page.locator('#chat-welcome-host').evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('none');
  const result=await page.evaluate(()=>{
   const original=window.setInterval;let check;
   window.setInterval=function(fn,delay,...args){if(delay===15000)check=fn;return original(fn,delay,...args);};
   try{window.store.setState({settings:{...window.store.getState().settings,experimentalPerformanceMode:false}});}finally{window.setInterval=original;}
   if(!check)throw Error('Offline poller not captured');
   const old=window.store.getState().friends;
   window.store.setState({friends:[{userId:'idle-fixture',username:'Idle fixture',status:'online',lastSeen:Date.now()}]});
   let changes=0;const unsubscribe=window.store.subscribe((state,changed)=>{if(changed.friends)changes++;});
   check();const unchanged=changes;
   window.store.getState().friends[0].lastSeen=Date.now()-60000;check();
   const expired=window.store.getState().friends[0].status;const changed=changes;
   unsubscribe();window.store.setState({friends:old});return {unchanged,changed,expired};
  });
  expect(result).toEqual({unchanged:0,changed:1,expired:'offline'});
  await page.evaluate(()=>window.SettingsModal.open('account'));
  expect(await page.evaluate(()=>window.SettingsModal._networkMapTimer)).toBeNull();
  for(const locale of ['en','zh-Hant','zh-Hans']){
   await page.evaluate(locale=>{window.I18n.set(locale);window.SettingsModal.open('account');},locale);
   await expect(page.locator('#transport-mode option[value=localsend]')).toHaveText('LocalSend');
  }
  await page.evaluate(()=>{window.orbitAPI.dbSetSetting('locallink.transport','orbit');window.SettingsModal.open('account');});
  await expect.poll(()=>page.evaluate(()=>!!window.SettingsModal._networkMapTimer)).toBe(true);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].hide());
  await expect.poll(()=>page.evaluate(()=>window.SettingsModal._networkMapTimer)).toBeNull();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  await expect.poll(()=>page.evaluate(()=>!!window.SettingsModal._networkMapTimer)).toBe(true);
  await page.evaluate(()=>window.SettingsModal.close());
  expect(await page.evaluate(()=>({timer:window.SettingsModal._networkMapTimer,observer:window.SettingsModal._mapResizeObserver}))).toEqual({timer:null,observer:null});
 }finally{await app.close();}
});

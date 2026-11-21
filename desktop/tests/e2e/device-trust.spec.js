const {test,expect}=require('@playwright/test');
const {launchApp,tmpUserDataDir}=require('./helpers');
const peer={userId:'localsend:trust-fixture',username:'My laptop',usertag:'LocalSend',status:'online'};
test('trust shield, receiver permission, persistence and offline revocation',async()=>{
 const dir=tmpUserDataDir('device-trust');let {app,page}=await launchApp(dir,[],{fixtureLocale:false});
 try{
  await page.evaluate(p=>{window.LocalLinkDevices.observe(p);window.LocalLinkDevices.toggleFavorite(p);window.store.setState({activeChatId:p.userId});},peer);
  await expect(page.locator('#ll-trust-shield')).not.toHaveClass(/ll-trusted/);
  const refused=await page.evaluate(id=>window.orbitAPI.invoke('locallink-set-trust',{peerId:id,action:'autoReceive',enabled:true}),peer.userId);
  expect(refused.ok).toBe(false);
  // A persisted authenticated pairing fixture; favorites alone above granted nothing.
  await page.evaluate(id=>{window.orbitAPI.dbSetSetting('locallink.trust.'+id,{paired:true,autoReceive:false,alias:'My laptop'});window.LocalLinkDevices.refreshTrust();},peer.userId);
  await expect(page.locator('#ll-trust-shield')).toHaveClass(/ll-trusted/);
  await expect(page.locator('#ll-trust-shield svg')).toBeVisible();
  await expect(page.locator('#ll-trust-shield')).toHaveAttribute('aria-label','Trusted · Ask before receiving');
  await page.locator('#ll-trust-shield').click();
  await expect(page.locator('[data-auto-receive]')).not.toBeChecked();
  await page.locator('[data-auto-receive]').check();
  await expect(page.locator('#ll-trust-shield')).toHaveAttribute('aria-label','Trusted · Automatic receive');
  await expect(page.locator('[data-auto-receive]')).toBeChecked();
  await page.screenshot({path:require('path').resolve('../artifacts/device-trust.png')});
  await app.close();({app,page}=await launchApp(dir,[],{fixtureLocale:false}));
  await page.evaluate(p=>{window.store.addOrUpdatePeer(p);window.store.setState({activeChatId:p.userId});},peer);
  await expect(page.locator('#ll-trust-shield')).toHaveClass(/ll-trusted/);
  expect(await page.evaluate(id=>window.orbitAPI.dbGetSetting('locallink.trust.'+id).autoReceive,peer.userId)).toBe(true);
  await page.evaluate(()=>window.SettingsModal.open('account'));
  await page.locator('.ll-folder-tools summary').click();
  await page.locator('#ll-manage-trusted').click();
  await expect(page.locator('#ll-trusted-dialog')).toContainText('My laptop');
  const toggle=page.locator('#ll-trusted-dialog [data-auto-receive]');
  await expect(toggle).toHaveCSS('width','40px');await expect(toggle).toHaveCSS('height','24px');
  await expect(toggle).toHaveCSS('background-color','rgb(10, 132, 255)');
  await toggle.uncheck();
  await expect(toggle).toHaveCSS('width','40px');
  await toggle.focus();await page.keyboard.press('Space');await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.screenshot({path:require('path').resolve('.agent/trust-switch-fixed.png')});
  await expect(page.locator('#ll-trust-shield')).toHaveAttribute('aria-label','Trusted · Ask before receiving');
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
  await page.locator('#ll-trusted-dialog [data-trust-action]').click();
  await expect(page.locator('#ll-trust-shield')).not.toHaveClass(/ll-trusted/);
  await expect(page.locator('#ll-trusted-dialog [data-auto-receive]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.orbitAPI.invoke('locallink-list-trusted'))).toEqual([]);
  expect(await page.evaluate(p=>window.LocalLinkDevices.isFavorite(p),peer)).toBe(true);
  await page.locator('#ll-trusted-dialog .ll-dialog-close').click();
  await page.evaluate(()=>window.SettingsModal.close());
  for(const locale of ['zh-Hant','zh-Hans']){
   await page.evaluate(locale=>window.I18n.set(locale),locale);
   await page.locator('#ll-trust-shield').click();
   await expect(page.locator('#device-details-dialog [data-trust-action]')).toHaveText(locale==='zh-Hant'?'配對此裝置':'配对此设备');
   await page.locator('#device-details-dialog .ll-dialog-close').click();
  }
 }finally{await app.close();}
});

test('authenticated pairing enables receive consent once; revocation restores prompts',async()=>{
 const {LocalSend}=require('../../src/js/network/localsend');
 const fs=require('fs'),path=require('path');
 const dir=tmpUserDataDir('trust-receiver'),senderDir=tmpUserDataDir('trust-sender');
 const sender=new LocalSend({dataDir:senderDir,receiveDir:path.join(senderDir,'received'),port:0,discovery:false,alias:()=> 'Personal laptop',accept:async()=>true});
 await sender.start();let app;
 try{
  const launched=await launchApp(dir,[],{fixtureLocale:false});app=launched.app;const page=launched.page;
  const receiveDir=path.join(dir,'received');fs.mkdirSync(receiveDir);
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},receiveDir);
  await page.evaluate(()=>window.orbitAPI.invoke('locallink-choose-directory'));
  await app.evaluate(({dialog})=>{globalThis.__trustPrompts=[];dialog.showMessageBox=async(win,options)=>{globalThis.__trustPrompts.push(options.checkboxLabel||null);return {response:1,checkboxChecked:true};};});
  const discovery=await page.evaluate(address=>window.orbitAPI.invoke('locallink-discover',address),'127.0.0.1:'+sender.port);
  expect(discovery.ok).toBe(true);
  const receiver=[...sender.peers.values()][0],senderId='localsend:'+sender.fingerprint;
  await Promise.all([sender.sendMessage(receiver.id,'Not trusted yet'),page.locator('.ll-receipt-accept').click()]);
  expect(await app.evaluate(()=>globalThis.__trustPrompts)).toEqual([]);
  expect(await page.evaluate(id=>window.orbitAPI.dbGetSetting('locallink.trust.'+id,{}),senderId)).toEqual({});
  expect((await sender.request(receiver,'locallink-pair',{info:sender.info()})).paired).toBe(true);
  await page.evaluate(id=>window.store.setState({activeChatId:id}),senderId);
  await expect(page.locator('#ll-trust-shield')).toHaveClass(/ll-trusted/);
  await Promise.all([sender.sendMessage(receiver.id,'Remember my permission'),(async()=>{await page.locator('.ll-receipt-card input').check();await page.locator('.ll-receipt-accept').click();})()]);
  expect(await app.evaluate(()=>globalThis.__trustPrompts.at(-1))).toBe(null);
  expect(await page.evaluate(id=>window.orbitAPI.dbGetSetting('locallink.trust.'+id).autoReceive,senderId)).toBe(true);
  const count=await app.evaluate(()=>globalThis.__trustPrompts.length);
  const file=path.join(senderDir,'trusted-file.txt');fs.writeFileSync(file,'original bytes');
  await sender.send(receiver.id,file);
  const received=await page.evaluate(()=>window.orbitAPI.sendSync('locallink-list-transfers',{direction:'incoming'}).find(r=>r.name==='trusted-file.txt'));
  expect(received.path.startsWith(receiveDir+path.sep)).toBe(true);
  expect(fs.readFileSync(received.path,'utf8')).toBe('original bytes');
  expect(await app.evaluate(()=>globalThis.__trustPrompts.length)).toBe(count);
  await page.evaluate(id=>window.orbitAPI.invoke('locallink-set-trust',{peerId:id,action:'revoke'}),senderId);
  await expect(page.locator('#ll-trust-shield')).not.toHaveClass(/ll-trusted/);
  await Promise.all([sender.sendMessage(receiver.id,'Confirm again'),page.locator('.ll-receipt-accept').click()]);
  expect(await app.evaluate(()=>globalThis.__trustPrompts.length)).toBe(count+1);
  expect(await app.evaluate(()=>globalThis.__trustPrompts.at(-1))).toBe(null);
 }finally{if(app)await app.close();sender.stop();}
});

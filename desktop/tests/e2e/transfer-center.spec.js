const {test,expect}=require('@playwright/test');const {launchApp,tmpUserDataDir,chooseSetting}=require('./helpers');const path=require('path');
test('task and received navigation filters real store records and keeps device history',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('center'),[],{keepBootState:true});
 try{
  await page.evaluate(()=>{window.store.addOrUpdatePeer({userId:'localsend:center',username:'Laptop',status:'offline'});window.orbitAPI.dbSetSetting('locallink.transfers',[
   {id:'active',peerId:'localsend:center',name:'sending.zip',status:'transferring',direction:'outgoing',size:1000,bytes:200,startedAt:Date.now()-3000},
   {id:'failed',peerId:'localsend:center',name:'failed.zip',status:'failed',direction:'outgoing',size:100,startedAt:Date.now()-2000,error:'Transfer interrupted'},
   {id:'received',peerId:'localsend:center',name:'photo.png',status:'received',direction:'incoming',size:100,startedAt:Date.now()-1000,path:'C:/example/photo.png'},
   {id:'text',peerId:'localsend:center',name:'Message',kind:'text',text:'hello',status:'received',direction:'incoming',startedAt:Date.now()}
  ]);});
  await page.locator('#btn-nav-gallery').click();await expect(page.locator('.ll-center h2')).toHaveText('傳輸任務');await expect(page.locator('.ll-center-card')).toHaveCount(1);await expect(page.locator('progress')).toHaveAttribute('value','200');await expect(page.locator('.ll-task-badge')).toHaveText('1');
  await app.evaluate(({ipcMain})=>{globalThis.__centerActions=[];for(const channel of ['locallink-cancel-transfer','locallink-retry-transfer']){ipcMain.removeHandler(channel);ipcMain.handle(channel,(event,args)=>{globalThis.__centerActions.push({channel,args});return {ok:true};});}});
  await page.locator('[data-cancel="active"]').click();expect(await app.evaluate(()=>globalThis.__centerActions[0])).toEqual({channel:'locallink-cancel-transfer',args:'active'});
  await chooseSetting(page,'ll-center-filter','failed');await expect(page.locator('[data-retry="failed"]')).toBeVisible();await page.locator('[data-retry="failed"]').click();expect(await app.evaluate(()=>globalThis.__centerActions[1].args.id)).toBe('failed');
  await page.screenshot({path:path.resolve('../artifacts/transfer-center-tasks.png')});
  await page.locator('#btn-nav-storage').click();await expect(page.locator('.ll-center h2')).toHaveText('已接收檔案');await expect(page.locator('.ll-center-card')).toHaveCount(1);await expect(page.locator('[data-open="received"]')).toBeVisible();
  await page.locator('[data-clean]').check();await expect(page.locator('#ll-center-clean')).toBeEnabled();
  await page.locator('#ll-center-search').fill('missing');await expect(page.locator('.ll-center-card')).toHaveCount(0);await expect(page.locator('#ll-center-clean')).toBeDisabled();await page.locator('#ll-center-search').fill('photo');
  await page.screenshot({path:path.resolve('../artifacts/transfer-center-received.png')});
  await page.locator('[data-device]').click();await expect(page.locator('.ll-peer-heading')).toContainText('Laptop');
  await page.locator('#btn-nav-gallery').click();await expect(page.locator('#ll-center-filter')).toHaveValue('failed');
  await page.locator('#btn-nav-dms').click();await expect(page.locator('.ll-center')).toHaveCount(0);
 }finally{await app.close();}
});

test('restart restores failed batch details and outbox cleanup protects retry files',async()=>{
 const fs=require('node:fs');
 const root=tmpUserDataDir('recovery'),outbox=path.join(root,'locallink-outbox');
 fs.mkdirSync(outbox);
 const retained=path.join(outbox,'Image-1000000000000-1234abcd.png');
 const orphan=path.join(outbox,'Image-1000000000000-1234abce.png');
 for(const file of [retained,orphan])fs.writeFileSync(file,'fixture');
 const id='localsend:restored',batchId='stored-batch';
 let {app,page}=await launchApp(root,[],{keepBootState:true});
 try{
  await page.evaluate(({id,batchId,retained})=>{
   const rows=Array.from({length:9},(_,i)=>({id:'record-'+i,peerId:id,batchId,batchCount:9,name:'file'+i,status:i?'delivered':'failed',direction:'outgoing',path:i?null:retained,startedAt:100+i}));
   window.orbitAPI.dbSetSetting('locallink.transfers',rows);
  },{id,batchId,retained});
  await app.close();
  ({app,page}=await launchApp(root,[],{keepBootState:true}));
  await page.evaluate(id=>{window.store.addOrUpdatePeer({userId:id,username:'Restored',status:'offline'});window.store.setState({activeChatId:id});},id);
  const failed=page.locator('[data-failed-batch]');
  await expect(failed).toBeVisible();await failed.click();await expect(page.locator('.ll-history-row')).toHaveCount(1);
  const cache=await page.evaluate(()=>window.orbitAPI.invoke('locallink-sent-cache-size'));
  expect(cache).toMatchObject({count:1,bytes:7,retained:7});
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
  expect((await page.evaluate(()=>window.orbitAPI.invoke('locallink-clean-sent-cache'))).count).toBe(1);
  expect(fs.existsSync(orphan)).toBe(false);expect(fs.existsSync(retained)).toBe(true);
 }finally{await app.close();}
});

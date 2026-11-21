const {test,expect}=require('@playwright/test');
const {tmpUserDataDir,launchApp}=require('./helpers');
const {LocalSend}=require('../../src/js/network/localsend');
const fs=require('fs'),path=require('path');

test('real file conversation: manual discovery, text, batch, paste, folder and history',async()=>{
 test.setTimeout(90000);
 const dir=tmpUserDataDir('workflow'),receiverDir=tmpUserDataDir('receiver'),incoming=[];
 const receiver=new LocalSend({dataDir:receiverDir,receiveDir:path.join(receiverDir,'files'),alias:()=> 'Test laptop',maxBytes:1e7,port:0,discovery:false,accept:async()=>true,result:r=>incoming.push(r)});
 await receiver.start();let app;
 try{
  const launched=await launchApp(dir,[],{keepBootState:true});app=launched.app;const page=launched.page;
  await page.evaluate(()=>window.LocalLinkDevices.connectDialog());
  await page.locator('#ll-device-address').fill('not an address');await page.locator('#ll-connect-submit').click();
  await expect(page.locator('#ll-connect-error')).not.toBeEmpty();
  await page.locator('#ll-device-address').fill('127.0.0.1:'+receiver.port);await page.locator('#ll-connect-submit').click();
  await expect(page.locator('.ll-peer-heading h2')).toHaveText('Test laptop');
  await page.locator('#ll-message-input').fill('你好，這是 LocalLink 的文字與連結。\nhttps://localsend.org');
  await page.locator('#ll-send-text').click();
  await expect(page.locator('[data-status="delivered"]')).toHaveCount(1);
  await expect(page.locator('.ll-text-content')).toContainText('https://localsend.org');
  expect(incoming.find(r=>r.status==='received').text).toContain('你好');
  await expect(page.locator('#ll-message-input')).toHaveValue('');
  const files=['Notes.txt','中文空文件.txt'].map((name,i)=>{const file=path.join(dir,name);fs.writeFileSync(file,i?'':'a file with original bytes');return file;});
  await app.evaluate(({dialog},paths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:paths});},files);
  await page.locator('#localsend-send').click();
  await expect(page.locator('[data-status="delivered"]')).toHaveCount(3);
  expect(incoming.filter(r=>r.status==='received').length).toBe(3);
  const png=await require('sharp')({create:{width:300,height:160,channels:3,background:'#2463ba'}}).png().toBuffer();
  await page.evaluate(bytes=>{
   const clipboardData=new DataTransfer();clipboardData.items.add(new File([new Uint8Array(bytes)],'pasted.png',{type:'image/png'}));
   document.getElementById('ll-message-input').dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));
  },[...png]);
  await expect(page.locator('[data-status="delivered"]')).toHaveCount(4);
  await expect(page.locator('.ll-image-preview')).toBeVisible();
  expect(fs.readFileSync(incoming.find(r=>r.status==='received'&&r.name.endsWith('.png')).path)).toEqual(png);
  await page.locator('#ll-search-files').fill('中文');await expect(page.locator('.ll-transfer')).toHaveCount(1);
  await page.locator('#ll-search-files').fill('');await expect(page.locator('.ll-transfer')).toHaveCount(4);
  await page.evaluate(()=>window.LocalSendPanel.history());
  await page.locator('#ll-history-dialog input[type=search]').fill('Notes');await expect(page.locator('.ll-history-row')).toHaveCount(1);
  await page.locator('#ll-history-dialog .ll-dialog-close').click();
  const folder=path.join(dir,'Documents');fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'nested.txt'),'folder bytes');
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);
  await page.locator('#ll-send-folder').click();await expect(page.locator('[data-status="delivered"]')).toHaveCount(5);
  const zipped=incoming.find(r=>r.status==='received'&&r.name==='Documents.zip');expect(fs.readFileSync(zipped.path).includes(Buffer.from('folder bytes'))).toBe(true);
  const receiveDir=path.join(dir,'custom-received');fs.mkdirSync(receiveDir);
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});dialog.showMessageBox=async()=>({response:1});},receiveDir);
  await page.evaluate(()=>window.SettingsModal.open('network'));await page.locator('#ll-choose-directory').click();
  await expect(page.locator('#ll-receive-path')).toHaveText(receiveDir);await page.locator('#btn-close-settings').click();
  // register supplied the app endpoint to this independent receiver.
  const peer=[...receiver.peers.values()][0];await receiver.send(peer.id,files[0]);
  await expect(page.locator('[data-status="received"]')).toHaveCount(1);
  expect(fs.readdirSync(receiveDir).length).toBe(1);
  await page.screenshot({path:path.resolve('../artifacts/transfer-workflow-dark.png')});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,680));
  await expect(page.locator('#ll-send-text')).toBeInViewport();await expect(page.locator('#ll-message-input')).toBeInViewport();
  await page.screenshot({path:path.resolve('../artifacts/transfer-workflow-compact.png')});
  const received=await page.evaluate(()=>window.orbitAPI.sendSync('locallink-list-transfers',{direction:'incoming'})[0]);
  const rejected=await page.evaluate(()=>window.orbitAPI.invoke('locallink-storage-cleanup',[window.orbitAPI.sendSync('locallink-list-transfers',{direction:'outgoing'})[0].id]));
  expect(rejected.ok).toBe(false);
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0});});
  const cancelled=await page.evaluate(id=>window.orbitAPI.invoke('locallink-storage-cleanup',[id]),received.id);
  expect(cancelled.cancelled).toBe(true);expect(fs.existsSync(received.path)).toBe(true);
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
  await page.evaluate(()=>window.LocalSendPanel.history());
  await page.locator('#ll-history-status-trigger').click();await page.getByRole('option',{name:'已接收',exact:true}).click();
  await expect(page.locator('.ll-history-row')).toHaveCount(1);
  await page.screenshot({path:path.resolve('../artifacts/history-round3.png')});
  await page.locator('[data-cleanup-id]').check();
  await page.locator('#ll-history-dialog .ll-load-more').click();
  await expect(page.locator('[data-trash-file]')).toHaveCount(0);expect(fs.existsSync(received.path)).toBe(false);
  expect(fs.existsSync(files[0])).toBe(true);

 }finally{if(app)await app.close();receiver.stop();}
});

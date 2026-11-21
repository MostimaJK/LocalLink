const {test,expect}=require('@playwright/test');
const {tmpUserDataDir,launchApp}=require('./helpers');
const {LocalSend}=require('../../src/js/network/localsend');
const fs=require('fs'),path=require('path');

test('home QR opens a temporary browser session for sending and receiving',async()=>{
 const dir=tmpUserDataDir('browser-share'), received=path.join(dir,'received');
 const source=path.join(dir,'desktop.txt');
 fs.writeFileSync(source,'from desktop');
 const {app,page}=await launchApp(dir,[],{keepBootState:true});
 try {
  await app.evaluate(({dialog},source)=>{
   process.getBuiltinModule('os').networkInterfaces=()=>({'vEthernet (WSL)':[ {family:'IPv4',internal:false,address:'172.31.192.1'} ],Ethernet:[{family:'IPv4',internal:false,address:'127.0.0.1'}]});
   dialog.showOpenDialog=async()=>({canceled:false,filePaths:[source]});
  },source);
  await page.evaluate(dir=>window.orbitAPI.dbSetSetting('locallink.receiveDir',dir),received);
  await page.locator('#home-phone-share').click();
  const picker=page.locator('#ll-share-address-trigger');
  await expect(picker).toHaveText('127.0.0.1');
  await picker.click();
  await expect(page.getByRole('option').last()).toContainText('WSL');
  await picker.press('Escape');
  await page.locator('.share-start').click();
  const image=page.locator('.share-code img');
  await expect(image).toBeVisible();
  const readCode=()=>image.evaluate(async img=>{
   await img.decode();
   const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
   const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
   return window.jsQR(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height).data;
  });
  const url=await readCode();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ll-browser-share')).toHaveCount(0);
  await page.locator('.share-quick-add').click();
  await page.locator('.share-indicator').click();
  await expect(page.locator('.share-files summary')).toContainText('1');
  expect(await readCode()).toBe(url);
  const opened=app.waitForEvent('window');
  await app.evaluate(async({BrowserWindow},url)=>{
   const guest=new BrowserWindow({show:false,webPreferences:{sandbox:true}});
   await guest.loadURL(url);
  },url);
  const guest=await opened;
  await expect(guest.locator('#pick')).not.toBeVisible();
  const code=(await page.locator('.share-pin').innerText()).match(/\d{6}/)[0];
  await page.locator('.share-hide').click();
  await guest.locator('#pin').fill(code);
  await guest.locator('#confirm').click();
  await expect(guest.locator('#files a')).toHaveText('desktop.txt');
  const link=await guest.locator('#files a').getAttribute('href');
  expect((await fetch(new URL(link,url))).status).toBe(401);
  expect(await guest.evaluate(async link=>(await fetch(link)).text(),link)).toBe('from desktop');
  await guest.locator('#pick').setInputFiles({name:'手機.txt',mimeType:'text/plain',buffer:Buffer.from('from phone')});
  await expect(guest.locator('#status')).toContainText('1/1');
  await expect.poll(()=>fs.existsSync(path.join(received,'手機.txt'))).toBe(true);
  expect(fs.readFileSync(path.join(received,'手機.txt'),'utf8')).toBe('from phone');
  const history=await page.evaluate(()=>window.orbitAPI.sendSync('locallink-list-transfers',{peerId:'web:browser'}));
  expect(history.map(r=>r.direction).sort()).toEqual(['incoming','outgoing']);
  await page.locator('.share-indicator').click();
  await expect(image).toHaveCount(0);
  await page.locator('.share-stop').click();
  await expect(page.locator('#ll-sharing-bar')).toBeHidden();
  await expect(page.locator('.share-start')).toBeFocused();
  await expect.poll(async()=>fetch(url).then(()=>false,()=>true)).toBe(true);
  await page.evaluate(()=>window.orbitAPI.dbSetSetting('locallink.runInBackground',true));
  await page.locator('.share-start').click();
  await expect(image).toBeVisible();
  const secondUrl=await readCode();
  await page.evaluate(()=>window.orbitAPI.send('window-controls','close'));
  expect((await fetch(secondUrl)).status).toBe(200);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:')).show());
  await page.locator('.share-stop').click();
  await expect.poll(async()=>fetch(secondUrl).then(()=>false,()=>true)).toBe(true);
 } finally {await app.close();}
});

test('packaged resources retain the icon library and a working native database', async () => {
  test.skip(!process.env.LOCALLINK_TEST_EXECUTABLE, 'Requires a packaged executable');
  const {app} = await launchApp(tmpUserDataDir('packaged-dependencies'), [], {keepBootState:true});
  try {
    const result = await app.evaluate(async ({app}) => {
      const {createRequire} = process.getBuiltinModule('module');
      const path = process.getBuiltinModule('path');
      const root = app.getAppPath();
      const load = createRequire(path.join(root, 'package.json'));
      const fs = load('node:fs');
      const sqlite = path.dirname(load.resolve('better-sqlite3/package.json'));
      const prebuilds = path.join(sqlite, 'prebuilds');
      const allowed = [process.platform + '-' + process.arch + '.node'];
      if (process.platform === 'linux') allowed.push('linuxmusl-' + process.arch + '.node');
      const Database = load('better-sqlite3');
      const backup = path.join(app.getPath('userData'), 'backup-check.sqlite');
      const db = new Database(':memory:');
      try {
        db.exec('CREATE TABLE probe (value INTEGER); INSERT INTO probe VALUES (42)');
        await db.backup(backup);
      } finally { db.close(); }
      const restored = new Database(backup, {readonly:true});
      try {
        return {
          restored: restored.prepare('SELECT value FROM probe').pluck().get(),
          foreignBindings: fs.existsSync(prebuilds) ? fs.readdirSync(prebuilds).filter(name => name.endsWith('.node') && !allowed.includes(name)) : [],
          unexpected: ['dist','tests','mobile-harness.js','node_modules/@capacitor/android','node_modules/@capacitor/core','node_modules/lucide/dist/esm','node_modules/better-sqlite3/deps'].filter(name => fs.existsSync(path.join(root, name))),
          icons: fs.readdirSync(path.join(root,'node_modules/lucide/dist/umd')),
        };
      } finally { restored.close(); }
    });
    expect(result).toEqual({restored:42, foreignBindings:[], unexpected:[], icons:['lucide.min.js']});
  } finally { await app.close(); }
});

test('real file conversation: manual discovery, text, batch, paste, folder and history',async()=>{
 test.setTimeout(90000);
 const dir=tmpUserDataDir('workflow'),receiverDir=tmpUserDataDir('receiver'),incoming=[];
 const receiver=new LocalSend({dataDir:receiverDir,receiveDir:path.join(receiverDir,'files'),alias:()=> 'Test laptop',maxBytes:1e7,port:0,discovery:false,pair:async()=>true,accept:async()=>true,result:r=>incoming.push(r)});
 await receiver.start();let app;
 try{
  const launched=await launchApp(dir,[],{keepBootState:true});app=launched.app;const page=launched.page;
  const offline=await page.evaluate(()=>window.orbitAPI.invoke('locallink-send-content',{peerId:'offline-fixture',type:'image/png',bytes:[1]}));
  expect(offline.ok).toBe(false);
  expect(fs.readdirSync(path.join(dir,'locallink-outbox'))).toEqual([]);
  await page.evaluate(()=>window.LocalLinkDevices.connectDialog());
  await page.locator('#ll-device-address').fill('not an address');await page.locator('#ll-connect-submit').click();
  await expect(page.locator('#ll-connect-error')).toContainText('IP');
  await page.locator('#ll-device-address').fill('127.0.0.1:'+receiver.port);await page.locator('#ll-connect-submit').click();
  await expect(page.locator('.ll-peer-heading h2')).toHaveText('Test laptop');
  await expect(page.locator('.tabs-container')).not.toBeVisible();
  await expect(page.locator('#localsend-send svg')).toHaveAttribute('data-lucide','file');
  await expect(page.locator('#ll-open-receive-folder')).toBeVisible();
  const composer=page.locator('#ll-message-input');
  await composer.fill('你好，這是 LocalLink 的文字與連結。');
  await composer.press('End');await composer.press('Shift+Enter');
  await expect(composer).toHaveValue('你好，這是 LocalLink 的文字與連結。\n');
  await composer.fill('你好，這是 LocalLink 的文字與連結。\nhttps://localsend.org');
  await composer.dispatchEvent('keydown',{key:'Enter',isComposing:true});
  await expect(page.locator('[data-status="delivered"]')).toHaveCount(0);
  await expect(composer).not.toHaveValue('');
  await composer.press('Enter');
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
  await expect(page.locator('#ll-receive-path')).toHaveText(receiveDir);
  await expect(page.locator('#ll-open-after-receive')).not.toBeChecked();await page.locator('#ll-open-after-receive').check();
  await app.evaluate(({shell})=>{globalThis.__llShown=[];shell.showItemInFolder=file=>globalThis.__llShown.push(file);});
  await expect.poll(()=>page.locator('#ll-open-after-receive').evaluate(el=>getComputedStyle(el,'::after').transform)).toBe('matrix(1, 0, 0, 1, 16, 0)');
  await page.screenshot({path:path.resolve('../artifacts/receive-settings-refined.png')});
  await page.locator('#btn-close-settings').click();
  await app.evaluate(({shell})=>{shell.openPath=async folder=>{globalThis.__llOpened=folder;return '';};});
  await page.locator('#ll-open-receive-folder').click();expect(await app.evaluate(()=>globalThis.__llOpened)).toBe(receiveDir);
  // register supplied the app endpoint to this independent receiver.
  const peer=[...receiver.peers.values()][0];await receiver.send(peer.id,files[0]);
  await expect(page.locator('[data-status="received"]')).toHaveCount(1);
  expect(fs.readdirSync(receiveDir).length).toBe(1);
  const shown=await app.evaluate(()=>globalThis.__llShown);expect(shown).toHaveLength(1);expect(shown[0].startsWith(receiveDir+path.sep)).toBe(true);expect(fs.readFileSync(shown[0])).toEqual(fs.readFileSync(files[0]));
  await expect(page.locator('#btn-profile')).toHaveCount(0);await expect(page.locator('#btn-nav-dms svg')).toHaveAttribute('data-lucide','monitor-smartphone');
  await expect(page.locator('.ll-device-row.is-selected [data-favorite-id]')).toBeVisible();
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
  const cleaned=await page.evaluate(()=>window.orbitAPI.invoke('locallink-clean-sent-cache'));expect(cleaned.ok).toBe(true);expect(cleaned.count).toBeGreaterThanOrEqual(2);expect(fs.existsSync(files[0])).toBe(true);
  const peerId='localsend:'+receiver.fingerprint;
  expect((await page.evaluate(id=>window.orbitAPI.invoke('locallink-manage-trust',id),peerId)).ok).toBe(true);
  expect(await page.evaluate(id=>window.orbitAPI.dbGetSetting('locallink.trust.'+id).autoReceive,peerId)).toBe(false);
  await page.evaluate(id=>window.orbitAPI.invoke('locallink-manage-trust',id),peerId);
  expect(await page.evaluate(id=>window.orbitAPI.dbGetSetting('locallink.trust.'+id).autoReceive,peerId)).toBe(true);
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:2});});
  await page.evaluate(id=>window.orbitAPI.invoke('locallink-manage-trust',id),peerId);
  expect(await page.evaluate(id=>window.orbitAPI.dbGetSetting('locallink.trust.'+id).paired,peerId)).toBeUndefined();


 }finally{if(app)await app.close();receiver.stop();}
});

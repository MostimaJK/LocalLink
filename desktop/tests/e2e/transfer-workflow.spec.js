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
  await expect(page.locator('.share-multiple input')).toBeChecked();
  const actionEdge=async selector=>page.locator(selector).evaluate(btn=>Math.abs(btn.parentElement.getBoundingClientRect().right-btn.getBoundingClientRect().right));
  expect(await actionEdge('.share-start')).toBeLessThanOrEqual(1);
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
  await expect(page.locator('#ll-browser-share .share-files')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(async()=>(await window.orbitAPI.invoke('locallink-web-share',{action:'state'})).session.files.length)).toBe(1);
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
  await guest.setViewportSize({width:320,height:640});
  const pinBox=await guest.locator('#pin').boundingBox(),buttonBox=await guest.locator('#confirm').boundingBox();
  expect(pinBox.y).toBe(buttonBox.y);
  expect(pinBox.height).toBe(buttonBox.height);
  expect(buttonBox.x+buttonBox.width).toBeLessThanOrEqual(320);
  await guest.locator('#pin').fill(code);
  await guest.locator('#confirm').click();
  await guest.setViewportSize({width:320,height:640});
  await guest.locator('[data-decision=accept]').click();
  await expect(guest.locator('#files a')).toBeVisible();
  await expect(guest.locator('#files li').first()).toContainText('desktop.txt');
  await guest.locator('#draft').fill('From phone to group');
  await guest.locator('#send').click();
  await page.locator('.ll-group-members button').last().click();
  await expect(page.locator('.ll-group-feed')).toContainText('From phone to group');
  await page.locator('.ll-group-chat textarea').fill('Desk reply');
  const input=page.locator('.ll-group-input');
  await input.press('Shift+Enter');
  await expect(input).toHaveValue('Desk reply\n');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  const attachBox=await guest.locator('#attach').boundingBox(),draftBox=await guest.locator('#draft').boundingBox();
  expect(attachBox.y+attachBox.height).toBeLessThanOrEqual(draftBox.y);
  await expect(guest.locator('#messages')).toContainText('Desk reply');
  const png=Buffer.from(await guest.evaluate(()=>{
    const c=document.createElement('canvas');c.width=400;c.height=300;
    const ctx=c.getContext('2d');ctx.fillStyle='#3377aa';ctx.fillRect(0,0,400,300);
    return c.toDataURL('image/png').split(',')[1];
  }),'base64');
  const link=await guest.locator('#files a').getAttribute('href');
  expect((await fetch(new URL(link,url))).status).toBe(401);
  expect(await guest.evaluate(async link=>(await fetch(link)).text(),link)).toBe('from desktop');
  await guest.locator('#pick').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
  const card=page.locator('.ll-receipt-card');
  await expect.poll(()=>card.locator('img').evaluate(img=>img.naturalWidth)).toBe(192);
  await expect(card).toContainText('photo.png');
  expect(fs.existsSync(path.join(received,'photo.png'))).toBe(false);
  await card.locator('.ll-receipt-reject').click();
  await expect(guest.locator('#pick')).toBeEnabled();
  expect(fs.existsSync(path.join(received,'photo.png'))).toBe(false);
  await guest.locator('#pick').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
  await card.locator('.ll-receipt-accept').click();
  await expect(guest.locator('#status')).toContainText('1/1');
  await expect.poll(()=>fs.existsSync(path.join(received,'photo.png'))).toBe(true);
  expect(fs.readFileSync(path.join(received,'photo.png'))).toEqual(png);
  const history=await page.evaluate(()=>window.orbitAPI.sendSync('locallink-list-transfers',{peerId:'web:browser'}));
  expect(history.map(r=>r.direction).sort()).toEqual(['incoming','outgoing']);
  const photo=path.join(dir,'from-desktop.png');fs.writeFileSync(photo,png);
  await app.evaluate(({dialog},photo)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[photo]});},photo);
  // Drag a disk-backed Electron File so webUtils resolves its real path.
  await page.evaluate(()=>{
    const input=document.createElement('input');input.type='file';input.multiple=true;input.id='drop-fixture';input.hidden=true;document.body.append(input);
  });
  await page.locator('#drop-fixture').setInputFiles([photo,source]);
  await page.evaluate(()=>{
    const dataTransfer=new DataTransfer();
    for(const file of document.querySelector('#drop-fixture').files)dataTransfer.items.add(file);
    const feed=document.querySelector('.ll-group-feed');
    for(const type of ['dragover','drop'])feed.dispatchEvent(new DragEvent(type,{dataTransfer,bubbles:true,cancelable:true}));
  });
  await expect(page.locator('.ll-group-feedback')).toContainText('1');
  await expect(page.locator('.ll-drop-ready')).toHaveCount(0);
  const photoCard=guest.locator('#messages li').filter({hasText:'from-desktop.png'});
  await expect.poll(()=>photoCard.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  await expect(photoCard.locator('a')).toHaveCount(0);
  await expect(photoCard.locator('[data-decision=accept]')).toBeInViewport();
  await photoCard.locator('[data-decision=reject]').click();
  await expect(photoCard.locator('img')).toHaveCount(0);
  await page.locator('.share-indicator').click();
  await expect(image).toBeVisible();
  await page.locator('.share-stop').click();
  await expect(page.locator('#ll-sharing-bar')).toBeHidden();
  await expect(page.locator('.share-start')).toBeFocused();
  await expect.poll(async()=>fetch(url).then(()=>false,()=>true)).toBe(true);
  await page.evaluate(()=>window.orbitAPI.dbSetSetting('locallink.runInBackground',true));
  await page.locator('.share-hide').click();
  const ended=page.locator('.ll-room-ended');
  await expect(ended.locator('h2')).toBeVisible();
  await expect(ended).toHaveCSS('justify-content','center');
  await ended.locator('button').click();
  await page.locator('.share-multiple input').check();
  await page.locator('.share-start').click();
  await expect(image).toBeVisible();
  const secondUrl=await readCode();
  const pin=(await page.locator('.share-pin').innerText()).match(/\d{6}/)[0];
  const pairPhone=()=>fetch(secondUrl+'pair',{method:'POST',headers:{Origin:new URL(secondUrl).origin,'X-Pair-Code':pin}});
  const firstPair=await pairPhone();expect(firstPair.status).toBe(204);
  await expect(page.locator('.share-badge span')).toContainText('1');
  expect(await readCode()).toBe(secondUrl);
  const nextPair=await pairPhone();expect(nextPair.status).toBe(204);
  await expect(page.locator('.share-badge span')).toContainText('2');
  expect(await readCode()).toBe(secondUrl);
  await page.evaluate(()=>window.orbitAPI.send('window-controls','close'));
  expect((await fetch(secondUrl)).status).toBe(200);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:')).show());
  const auth=r=>({Cookie:r.headers.get('set-cookie').split(';')[0],Origin:new URL(secondUrl).origin});
  const author=auth(firstPair),reader=auth(nextPair);
  const pending=fetch(secondUrl+'offer',{method:'POST',headers:author,body:JSON.stringify([{name:'relay.txt',size:3}])});
  const cardInRoom=async()=>(await (await fetch(secondUrl+'room',{headers:reader})).json()).files[0];
  await expect.poll(cardInRoom).toBeTruthy();
  const id=(await cardInRoom()).id;
  await fetch(secondUrl+'decision',{method:'POST',headers:{...reader,'X-File-Id':id,'X-Decision':'accept'}});
  const [token]=await (await pending).json();
  expect((await fetch(secondUrl+'upload',{method:'POST',headers:{...author,'X-Upload-Token':token,'X-File-Name':'relay.txt','X-File-Size':'3'},body:'abc'})).status).toBe(201);
  const temp=require('os').tmpdir();
  const cached=fs.readdirSync(temp).filter(n=>n.startsWith('locallink-room-')).map(n=>path.join(temp,n)).find(p=>fs.existsSync(path.join(p,id)));
  expect(cached).toBeTruthy();
  const exited=app.waitForEvent('close');
  await app.evaluate(({app})=>{setTimeout(()=>app.quit(),0);});
  await exited;
  expect(fs.existsSync(cached)).toBe(false);
  expect(fs.readFileSync(path.join(received,'photo.png'))).toEqual(png);
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
 const batchSize=process.env.LOCALLINK_STRESS_BATCH==='1'?10000:120;
 test.setTimeout(batchSize===120?90000:300000);
 const dir=tmpUserDataDir('workflow'),receiverDir=tmpUserDataDir('receiver'),incoming=[];
 const receiver=new LocalSend({dataDir:receiverDir,receiveDir:path.join(receiverDir,'files'),alias:()=> 'Test laptop',maxBytes:1e7,port:0,discovery:false,pair:async()=>true,accept:async()=>true,result:r=>incoming.push(r)});
 await receiver.start();let app;
 try{
  // Exercise the Windows elevation handoff after the original launcher has already exited.
  const handoff=process.platform==='win32'&&process.env.LOCALLINK_TEST_EXECUTABLE?['--locallink-parent=2147483647']:[];
  const launched=await launchApp(dir,handoff,{keepBootState:true});app=launched.app;const page=launched.page;
  if(process.platform==='win32'&&process.env.LOCALLINK_TEST_EXECUTABLE){
   await page.evaluate(()=>window.SettingsModal.open('account'));
   const admin=page.locator('#ll-admin-launch');
   await expect(admin).toBeEnabled();
   await expect(admin).not.toBeChecked();
   expect(await admin.evaluate(input=>input.closest('section').previousElementSibling.contains(document.querySelector('#interface-language')))).toBe(true);
   await admin.check();await page.locator('dialog[open] button[value=cancel]').click();await expect(admin).not.toBeChecked();
   const state=await page.evaluate(()=>window.orbitAPI.invoke('locallink-get-privileges'));
   expect(typeof state.elevated).toBe('boolean');
   expect((await page.evaluate(()=>window.orbitAPI.invoke('locallink-set-admin-launch',false))).ok).toBe(true);
   await page.locator('#btn-close-settings').click();
  }
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
  await page.evaluate(paths=>{
   const panel=window.LocalSendPanel,bind=panel.bindFileDrop;
   panel.bindFileDrop=function(surface,enabled,add){bind.call(this,surface,enabled,add);window.addDropped=add;};
   window.store.setState({friends:[...window.store.getState().friends]});
   const peer=window.store.getState().friends.find(p=>p.userId===window.store.getState().activeChatId);
   panel.render(peer,document.querySelector('#chat-container'));
   window.addDropped([paths[0]]);window.addDropped(paths);
  },files);
  await expect(page.locator('.ll-composer')).toContainText('待傳送 · 2');
  await expect(page.locator('.ll-draft-bubble')).toContainText('Notes.txt');
  await page.locator('.ll-draft-actions').getByRole('button',{name:'取消',exact:true}).click();
  await expect(page.locator('.ll-draft-bubble')).toHaveCount(0);
  expect(incoming.filter(r=>r.status==='received')).toHaveLength(1);
  await page.evaluate(paths=>window.addDropped(paths),files);
  await page.locator('.ll-draft-confirm').click();
  await expect(page.locator('[data-status="delivered"]')).toHaveCount(3);
  expect(incoming.filter(r=>r.status==='received').length).toBe(3);
  const png=await require('sharp')({create:{width:900,height:480,channels:3,background:'#2463ba'}}).png().toBuffer();
  await page.evaluate(bytes=>{
   const clipboardData=new DataTransfer();clipboardData.items.add(new File([new Uint8Array(bytes)],'pasted.png',{type:'image/png'}));
   document.getElementById('ll-message-input').dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));
  },[...png]);
  await expect(page.locator('[data-status="delivered"]')).toHaveCount(4);
  await expect(page.locator('.ll-image-preview')).toBeVisible();
  // Capture the native clipboard payload without touching the user's clipboard.
  await app.evaluate(({clipboard})=>{
   global.originalWrite=clipboard.write;
   global.capturePng=async items=>{
    const png=Buffer.from(await (await items[0].getType('image/png')).arrayBuffer());
    global.copiedImageSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
   };
   clipboard.write=global.capturePng;
  });
  try{
   await page.locator('[data-copy-image]').click();
   await expect.poll(()=>app.evaluate(()=>global.copiedImageSize)).toEqual({width:900,height:480});
  }finally{await app.evaluate(({clipboard})=>{clipboard.write=global.originalWrite;});}
  await expect(page.locator('#ll-clean-chat')).toHaveCount(0);
  await expect(page.locator('[data-copy-image] + [data-trash-image]')).toBeEnabled();
  const textFooter=page.locator('.ll-message-footer:has([data-copy])').first();
  const fileFooter=page.locator('.ll-message-footer:has([data-folder])').last();
  for(const footer of [textFooter,fileFooter]){
   const layout=await footer.evaluate(el=>{
    const state=el.querySelector('.ll-file-state').getBoundingClientRect();
    const last=el.querySelector('button:last-child').getBoundingClientRect();
    return {rightGap:el.getBoundingClientRect().right-last.right,sameRow:last.top<state.bottom&&last.bottom>state.top};
   });
   expect(Math.abs(layout.rightGap)).toBeLessThan(2);
   expect(layout.sameRow).toBe(true);
  }
  const narrowFits=await fileFooter.evaluate(el=>{
   el.style.width='145px';
   try{return el.scrollWidth<=el.clientWidth+1;}
   finally{el.style.removeProperty('width');}
  });
  expect(narrowFits).toBe(true);
  expect(fs.readFileSync(incoming.find(r=>r.status==='received'&&r.name.endsWith('.png')).path)).toEqual(png);
  await page.locator('#ll-search-files').fill('中文');await expect(page.locator('.ll-transfer')).toHaveCount(1);
  await page.locator('#ll-search-files').fill('');await expect(page.locator('.ll-transfer')).toHaveCount(4);
  await page.evaluate(()=>window.LocalSendPanel.history());
  await page.locator('#ll-history-dialog input[type=search]').fill('Notes');await expect(page.locator('.ll-history-row')).toHaveCount(1);
  await page.locator('#ll-history-dialog .ll-dialog-close').click();
  const folder=path.join(dir,'Documents');fs.mkdirSync(folder);fs.mkdirSync(path.join(folder,'Empty'));fs.writeFileSync(path.join(folder,'nested.txt'),'folder bytes');
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);
  await page.locator('#ll-send-folder').click();await expect(page.locator('[data-status="delivered"]')).toHaveCount(5);
  await page.locator('.ll-skipped-folders summary').click();
  await expect(page.locator('.ll-skipped-folders')).toContainText('Empty');
  const nested=incoming.find(r=>r.status==='received'&&r.name==='Documents/nested.txt');expect(nested.path.endsWith(path.join('Documents','nested.txt'))).toBe(true);expect(fs.readFileSync(nested.path,'utf8')).toBe('folder bytes');
  const receiveDir=path.join(dir,'custom-received');fs.mkdirSync(receiveDir);
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});dialog.showMessageBox=async()=>({response:1});},receiveDir);
  await page.evaluate(()=>window.SettingsModal.open('network'));await page.locator('#ll-choose-directory').click();
  await expect(page.locator('#ll-receive-path')).toHaveValue(receiveDir);
  await expect(page.locator('#ll-open-after-receive')).not.toBeChecked();await page.locator('#ll-open-after-receive').check();
  await app.evaluate(({shell})=>{globalThis.__llShown=[];shell.showItemInFolder=file=>globalThis.__llShown.push(file);});
  await expect.poll(()=>page.locator('#ll-open-after-receive').evaluate(el=>getComputedStyle(el,'::after').transform)).toBe('matrix(1, 0, 0, 1, 16, 0)');
  await page.screenshot({path:path.resolve('../artifacts/receive-settings-refined.png')});
  await page.locator('#btn-close-settings').click();
  await app.evaluate(({shell})=>{shell.openPath=async folder=>{globalThis.__llOpened=folder;return '';};});
  await page.locator('#ll-open-receive-folder').click();expect(await app.evaluate(()=>globalThis.__llOpened)).toBe(receiveDir);
  // register supplied the app endpoint to this independent receiver.
  const peer=[...receiver.peers.values()][0];
  const timeline=page.locator('.ll-timeline');
  const gapToLatest=()=>timeline.evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop);
  await timeline.evaluate(el=>{el.scrollTop=0;});
  const request=receiver.send(peer.id,files[0]).catch(()=>{});
  const chatCard=page.locator('.ll-timeline .ll-receipt-card');
  await expect(chatCard).toContainText(path.basename(files[0]));
  await expect.poll(gapToLatest).toBeLessThan(3);
  expect(fs.readdirSync(receiveDir)).toEqual([]);
  await chatCard.locator('.ll-receipt-reject').click();
  await request;
  expect(fs.readdirSync(receiveDir)).toEqual([]);
  await Promise.all([receiver.send(peer.id,files[0]),chatCard.locator('.ll-receipt-accept').click()]);
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
  await page.locator('#ll-history-dialog .ll-dialog-close').click();
  const clipboardFixture=process.env.LOCALLINK_CLIPBOARD_TEST_IMAGE;
  const sourceImage=path.join(receiverDir,clipboardFixture?'one-click.png':'one-click.jpg');
  if(clipboardFixture)fs.copyFileSync(clipboardFixture,sourceImage);else await require('sharp')(png).jpeg().toFile(sourceImage);
  await Promise.all([receiver.send(peer.id,sourceImage),chatCard.locator('.ll-receipt-accept').click()]);
  const receivedImage=path.join(receiveDir,path.basename(sourceImage));
  await expect(page.locator('.ll-incoming .ll-image-preview')).toBeVisible();
  if(clipboardFixture)await app.evaluate(({clipboard})=>clipboard.writeText('LocalLink clipboard test: previous text'));
  if(!clipboardFixture)await app.evaluate(({clipboard})=>{clipboard.write=global.capturePng;});
  // Measure the same interval the user experiences, without Playwright's click/poll overhead.
  await page.evaluate(()=>{
   const button=document.querySelector('.ll-incoming [data-copy-image]');
   button.addEventListener('click',()=>{
    const start=performance.now();
    const observer=new MutationObserver(()=>{
     if(document.querySelector('.ll-incoming .ll-copy-notice')){
      window.copyNoticeMs=Math.round(performance.now()-start);observer.disconnect();
     }
    });
    observer.observe(document.body,{subtree:true,childList:true});
   },{once:true,capture:true});
  });
  try{
   await page.locator('.ll-incoming [data-copy-image]').click();
   const notice=page.locator('.ll-incoming .ll-copy-notice');
   await expect(notice).toHaveText('已複製');
   if(clipboardFixture){
    console.log('Received image click to clipboard confirmation:',await page.evaluate(()=>window.copyNoticeMs),'ms');
    await page.evaluate(()=>{
     const box=document.createElement('div');box.contentEditable='true';box.id='test-paste-target';
     document.body.append(box);box.focus();
     box.onpaste=event=>{event.preventDefault();box.dataset.type=event.clipboardData.files[0]?.type||'text';};
    });
    await page.keyboard.press('Control+v');
    await expect(page.locator('#test-paste-target')).toHaveAttribute('data-type','image/png');
    await page.locator('#test-paste-target').evaluate(el=>el.remove());
   }
   await expect(notice).toHaveCount(0,{timeout:5000});
  }finally{await app.evaluate(({clipboard})=>{clipboard.write=global.originalWrite;});}
  await expect.poll(()=>fs.existsSync(receivedImage)).toBe(true);
  await app.evaluate(({dialog})=>{global.cleanupPrompts=0;dialog.showMessageBox=async()=>{global.cleanupPrompts++;return {response:0};};});
  await app.evaluate(({shell})=>{
   const original=shell.trashItem;
   shell.trashItem=async()=>{shell.trashItem=original;throw Error('simulated file in use');};
  });
  await page.locator('.ll-incoming [data-trash-image]').first().click();
  await expect(page.locator('.ll-incoming [role=alert]')).toContainText('simulated file in use');
  expect(fs.existsSync(receivedImage)).toBe(true);
  if(process.platform==='win32')await app.evaluate(({shell})=>{
   const original=shell.trashItem;
   shell.trashItem=async()=>{shell.trashItem=original;throw Error('Operation was aborted');};
  });
  for(const direction of ['incoming','outgoing']){
   const trash=page.locator('.ll-'+direction+' [data-trash-image]').first();
   const card=page.locator('[data-transfer-id="'+await trash.getAttribute('data-trash-image')+'"]');
   const count=await page.locator('[data-transfer-id]').count();
   await trash.click();await expect(card.locator('.ll-cleanup-result')).toBeVisible();
   await expect(card.locator('button,img,.ll-bubble')).toHaveCount(0);
   await expect(page.locator('[data-transfer-id]')).toHaveCount(count);
  }
  expect(await app.evaluate(()=>global.cleanupPrompts)).toBe(0);
  expect(fs.existsSync(receivedImage)).toBe(false);expect(fs.existsSync(sourceImage)).toBe(true);
  await expect(page.locator('[data-copy-image]')).toHaveCount(0);
  expect(fs.existsSync(files[0])).toBe(true);
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
  const peerId='localsend:'+receiver.fingerprint;
  expect((await page.evaluate(id=>window.orbitAPI.invoke('locallink-manage-trust',id),peerId)).ok).toBe(true);
  expect(await page.evaluate(id=>window.orbitAPI.dbGetSetting('locallink.trust.'+id).autoReceive,peerId)).toBe(false);
  await page.evaluate(id=>window.orbitAPI.invoke('locallink-manage-trust',id),peerId);
  expect(await page.evaluate(id=>window.orbitAPI.dbGetSetting('locallink.trust.'+id).autoReceive,peerId)).toBe(true);
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:2});});
  await page.evaluate(id=>window.orbitAPI.invoke('locallink-manage-trust',id),peerId);
  expect(await page.evaluate(id=>window.orbitAPI.dbGetSetting('locallink.trust.'+id).paired,peerId)).toBeUndefined();


  const tree=path.join(dir,'RetryFixture');
  for(const branch of ['A','B']){
   const sub=path.join(tree,branch,'inner');fs.mkdirSync(sub,{recursive:true});
   fs.writeFileSync(path.join(sub,'report.txt'),branch);
  }
  const accept=receiver.opts.accept;receiver.opts.accept=async()=>false;
  const refusedTree=await page.evaluate(args=>window.orbitAPI.invoke('locallink-send-paths',args),{peerId,paths:[tree,path.join(tree,"A"),path.join(tree,"A","inner","report.txt")]});
  expect(refusedTree.ok).toBe(false);receiver.opts.accept=accept;
  const retryRecords=await page.evaluate(peerId=>window.orbitAPI.sendSync('locallink-list-transfers',{peerId,limit:100}),peerId);
  expect(retryRecords.filter(r=>r.name.startsWith('RetryFixture/'))).toHaveLength(2);
  for(const branch of ['B','A']){
   const record=retryRecords.find(r=>r.name==='RetryFixture/'+branch+'/inner/report.txt');
   expect(record.status).toBe('failed');
   expect((await page.evaluate(id=>window.orbitAPI.invoke('locallink-retry-transfer',{id}),record.id)).ok).toBe(true);
   expect(fs.readFileSync(path.join(receiver.opts.receiveDir,record.name),'utf8')).toBe(branch);
  }
  const empty=path.join(dir,'only-empty');fs.mkdirSync(empty);
  const noFiles=await page.evaluate(args=>window.orbitAPI.invoke('locallink-send-paths',args),{peerId,paths:[empty]});
  expect(noFiles.error).toBe('Only empty folders selected');
  const mixed=await page.evaluate(args=>window.orbitAPI.invoke('locallink-send-paths',args),{peerId,paths:[empty,files[0]]});
  expect(mixed.emptyFolders).toEqual(['only-empty']);
  const fixtures=Array.from({length:batchSize},(_,index)=>{
   const file=path.join(dir,'batch-'+index+'.txt');fs.writeFileSync(file,'fixture '+index);return file;
  });
  await page.evaluate(()=>{
   window.chatMaxGap=0;let last=performance.now();
   window.chatHeartbeat=setInterval(()=>{const now=performance.now();window.chatMaxGap=Math.max(window.chatMaxGap,now-last);last=now;},50);
  });
  const started=Date.now();
  const sending=receiver.sendBatch(peer.id,fixtures);
  try{
   await expect(chatCard).toBeVisible();
   const detail=chatCard.locator('details');
   await expect(detail.locator('div')).toHaveCount(0);
   await detail.locator('summary').click();await expect(detail.locator('div')).toHaveCount(50);
   await detail.locator('button').click();await expect(detail.locator('div')).toHaveCount(100);
   await chatCard.locator('.ll-receipt-accept').click();
   await sending;
  }finally{receiver.stop();await sending.catch(()=>{});}
  await expect(page.locator('[data-show-batch]').first()).toBeVisible();
  const finished=await page.evaluate(n=>[...window.LocalSendPanel.batches.values()].find(b=>b.total===n),batchSize);
  expect(finished.finished).toBe(batchSize);expect(finished.failed).toBe(0);
  expect(await app.evaluate(()=>globalThis.__llShown.length)).toBe(3);
  await page.locator('[data-show-batch]').first().click();
  await expect(page.locator('[data-status="received"]')).toHaveCount(100);
  const jump=page.locator('.ll-jump-latest');
  await timeline.evaluate(el=>{el.scrollTop=0;});
  await expect(jump).toBeVisible();
  await composer.fill('scroll regression: reading history');
  await composer.press('Enter');
  await expect(jump).toHaveAccessibleName(/新傳送訊息/);
  expect(await timeline.evaluate(el=>el.scrollTop)).toBeLessThan(3);
  await jump.click();
  await expect.poll(gapToLatest).toBeLessThan(3);
  await timeline.evaluate(el=>{el.scrollTop=el.scrollHeight-el.clientHeight-40;});
  await composer.fill('scroll regression: following latest');
  await composer.press('Enter');
  await expect(page.locator('.ll-text-content').last()).toHaveText('scroll regression: following latest');
  await expect.poll(gapToLatest).toBeLessThan(3);
  const summary=await page.evaluate(id=>window.orbitAPI.sendSync('locallink-batch-summary',id),finished.id);
  expect(summary.finished).toBe(batchSize);
  const gap=await page.evaluate(()=>{clearInterval(window.chatHeartbeat);return window.chatMaxGap;});
  console.log(batchSize+' files with chat open: '+(Date.now()-started)+' ms; longest renderer heartbeat interval: '+Math.round(gap)+' ms');
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
  const target=await page.evaluate(()=>window.orbitAPI.sendSync('locallink-list-transfers',{direction:'incoming',limit:1})[0]);
  fs.renameSync(target.path,target.path+'.original');fs.writeFileSync(target.path,'a different file');
  const protect=await page.evaluate(id=>window.orbitAPI.invoke('locallink-storage-cleanup',[id]),target.id);
  expect(protect.ok).toBe(false);expect(fs.readFileSync(target.path,'utf8')).toBe('a different file');
 }finally{
  if(app)await app.close();receiver.stop();
  if(batchSize>120){
   const temp=fs.realpathSync(require('node:os').tmpdir());
   for(const [folder,prefix] of [[dir,'orbit-e2e-workflow-'],[receiverDir,'orbit-e2e-receiver-']]){
    const verified=fs.realpathSync(folder);
    if(path.dirname(verified)===temp&&path.basename(verified).startsWith(prefix)){
     await fs.promises.rm(verified,{recursive:true,force:true,maxRetries:3});
    }
   }
  }
 }
});

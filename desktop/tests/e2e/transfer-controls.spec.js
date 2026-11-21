const {test,expect}=require('@playwright/test');
const {tmpUserDataDir,launchApp}=require('./helpers');
const {LocalSend}=require('../../src/js/network/localsend');
const fs=require('fs'),path=require('path');
test('cancel and PIN retry work from the conversation without losing a draft',async()=>{
 const dir=tmpUserDataDir('controls'),target=tmpUserDataDir('controls-target');let accept;
 const receiver=new LocalSend({dataDir:target,receiveDir:path.join(target,'received'),alias:()=> 'Receiver',maxBytes:1e7,port:0,discovery:false,accept:()=>new Promise(resolve=>{accept=resolve;})});
 await receiver.start();let app;
 try{
  const launched=await launchApp(dir,[],{keepBootState:true});app=launched.app;const page=launched.page;
  await page.evaluate(async address=>{const r=await window.orbitAPI.invoke('locallink-discover',address);window.store.setState({activeChatId:r.peer.id});},'127.0.0.1:'+receiver.port);
  const file=path.join(dir,'cancel-and-retry.txt');fs.writeFileSync(file,'original');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
  await page.locator('#ll-message-input').fill('保留我的草稿');await page.locator('#localsend-send').click();
  await expect(page.locator('[data-status="awaiting"]')).toHaveCount(1);
  await page.locator('[data-cancel]').click();accept?.(false);
  await expect(page.locator('[data-status="cancelled"]')).toHaveCount(1);
  await expect(page.locator('#ll-message-input')).toHaveValue('保留我的草稿');
  receiver.opts.accept=async()=>true;const route=receiver.route.bind(receiver);
  receiver.route=async(req,res)=>{if(req.url.includes('prepare-upload')&&!req.url.includes('pin=123456')){req.resume();res.writeHead(401);res.end();return;}return route(req,res);};
  await page.locator('[data-retry]').click();await expect(page.locator('[data-status="failed"]')).toHaveCount(1);
  await page.locator('[data-status="failed"] [data-retry]').click();
  await page.getByRole('textbox',{name:'PIN'}).fill('123456');
  await page.locator('dialog form .ll-send').click();
  await expect(page.locator('[data-status="delivered"]')).toHaveCount(1);
  await expect(page.locator('#ll-message-input')).toHaveValue('保留我的草稿');
 }finally{if(app)await app.close();receiver.stop();}
});

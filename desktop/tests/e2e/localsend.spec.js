const {test,expect}=require('@playwright/test');
const {tmpUserDataDir,launchApp}=require('./helpers');
const path=require('path');
test('LocalSend starts as the only default transport and opens a transfer panel', async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('localsend-ui'),[],{keepBootState:true});
 try{
  await expect.poll(()=>page.evaluate(()=>window.localSendStatus)).toEqual({ok:true});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('locallink-lan-seen',{userId:'localsend:test',username:'Test LocalSend',usertag:'LocalSend',status:'online',ip:'192.0.2.2'}));
  await page.locator('.list-row[data-id="localsend:test"]').click();
  await expect(page.locator('#localsend-send')).toBeVisible();
  await expect(page.locator('#chat-input')).toHaveCount(0);
  await page.screenshot({path:path.resolve('../artifacts/localsend-transfer-preview.png')});
 }finally{await app.close();}
});

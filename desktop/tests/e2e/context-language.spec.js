const {test,expect}=require('@playwright/test');const {launchApp,tmpUserDataDir}=require('./helpers');
test('device context menu and shared actions follow all three languages',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('context-language'),[],{keepBootState:true});
 try{
  for(const [locale,label] of [['zh-Hant','收藏裝置'],['zh-Hans','收藏设备'],['en','Favorite device']]){
   await page.evaluate(locale=>{window.I18n.set(locale);window.SettingsModal.close();window.LocalLinkDevices.observe({userId:'localsend:menu-test',username:'Menu device',status:'online',deviceType:'desktop'});},locale);
   await page.locator('.list-row[data-id="localsend:menu-test"]').click({button:'right'});
   const menu=page.locator('#context-menu-container');await expect(menu).toContainText(label);await expect(menu).not.toContainText('Report');await expect(menu).not.toContainText('Connect over');
   if(locale==='zh-Hant')await page.screenshot({path:require('path').resolve('../artifacts/context-menu-translated.png')});
   await page.keyboard.press('Escape');
   const labels=await page.evaluate(()=>Object.keys({...window.ContextMenu.labels,...window.ContextMenu.extraLabels}).map(key=>[key,window.ContextMenu.label(key)]));
   for(const [original,translated] of labels){if(locale==='en')expect(translated).toBe(original);else expect(translated).not.toBe(original);}
  }
 }finally{await app.close();}
});

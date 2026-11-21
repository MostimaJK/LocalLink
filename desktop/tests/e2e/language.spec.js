const {chooseSetting}=require('./helpers');
const {test,expect}=require('@playwright/test');
const {tmpUserDataDir,launchApp}=require('./helpers');
const path=require('path');
test('language defaults to English, switches and survives restart', async()=>{
 const dir=tmpUserDataDir('language');let {app,page}=await launchApp(dir,[],{keepBootState:true,fixtureLocale:false});
 try{
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.evaluate(()=>window.I18n.set('zh-Hant'));
  await page.locator('#btn-nav-settings').click();
  await expect(page.locator('#settings-content')).toContainText('裝置名稱');
  await page.locator('#input-username').fill('未保存的设备名');
  await chooseSetting(page,'interface-language','en');
  await expect(page.locator('#settings-content')).toContainText('Device name');
  await expect(page.locator('#input-username')).toHaveValue('未保存的设备名');
  await chooseSetting(page,'interface-language','zh-Hans');
  await expect(page.locator('#settings-content')).toContainText('设备名称');
  await chooseSetting(page,'interface-language','zh-Hant');
  await page.screenshot({path:path.resolve('../artifacts/language-settings.png')});
  await chooseSetting(page,'interface-language','en');
  await app.close();({app,page}=await launchApp(dir,[],{keepBootState:true,fixtureLocale:false}));
  await page.locator('#btn-nav-settings').click();
  await expect(page.locator('#interface-language')).toHaveValue('en');
  await expect(page.locator('#settings-content')).toContainText('Device name');
 }finally{await app.close();}
});
test('appearance and retained legacy settings translate without changing preference values',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('settings-translations'),[],{keepBootState:true});
 try{
  await page.evaluate(()=>window.SettingsModal.open('appearance'));
  await expect(page.locator('#settings-content')).toContainText('文字大小');
  await chooseSetting(page,'ll-font','Large');
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('settings').fontSize)).toBe('Large');
  await page.screenshot({path:path.resolve('../artifacts/appearance-round3.png')});
  await page.evaluate(()=>window.orbitAPI.dbSetSetting('locallink.transport','orbit'));
  for(const [locale,network,backup,theme] of [['zh-Hant','已儲存裝置','匯出備份','文字與版面'],['zh-Hans','已保存设备','导出备份','文字与布局'],['en','Total Friends','Export Backup','Text & Layout']]){
   await page.evaluate(locale=>window.I18n.set(locale),locale);
   for(const [tab,text] of [['network',network],['data',backup],['appearance',theme]]){
    await page.evaluate(tab=>window.SettingsModal.renderTab(tab),tab);
    await expect(page.locator('#settings-content')).toContainText(text);
    await expect(page.locator('#settings-content')).not.toContainText("' + t(");
   }
   expect(await page.locator('#set-font').inputValue()).toBe('Large');
  }
 }finally{await app.close();}
});

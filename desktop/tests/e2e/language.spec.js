const {test,expect}=require('@playwright/test');
const {tmpUserDataDir,launchApp}=require('./helpers');
const path=require('path');
test('language defaults to Traditional Chinese, switches and survives restart', async()=>{
 const dir=tmpUserDataDir('language');let {app,page}=await launchApp(dir,[],{keepBootState:true});
 try{
  await expect(page.locator('html')).toHaveAttribute('lang','zh-Hant');
  await page.locator('#btn-profile').click();
  await expect(page.locator('#settings-content')).toContainText('裝置名稱');
  await page.locator('#input-username').fill('未保存的设备名');
  await page.locator('#interface-language').selectOption('en');
  await expect(page.locator('#settings-content')).toContainText('Device name');
  await expect(page.locator('#input-username')).toHaveValue('未保存的设备名');
  await page.locator('#interface-language').selectOption('zh-Hans');
  await expect(page.locator('#settings-content')).toContainText('设备名称');
  await page.locator('#interface-language').selectOption('zh-Hant');
  await page.screenshot({path:path.resolve('../artifacts/language-settings.png')});
  await page.locator('#interface-language').selectOption('en');
  await app.close();({app,page}=await launchApp(dir,[],{keepBootState:true}));
  await page.locator('#btn-profile').click();
  await expect(page.locator('#interface-language')).toHaveValue('en');
  await expect(page.locator('#settings-content')).toContainText('Device name');
 }finally{await app.close();}
});

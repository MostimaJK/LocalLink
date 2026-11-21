const {test,expect}=require('@playwright/test');
const {launchApp,tmpUserDataDir,chooseSetting}=require('./helpers');
const path=require('path');

test('general settings prioritize folders and retain preferences across sections',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('general-settings'),[],{keepBootState:true});
 try {
  await page.evaluate(()=>window.SettingsModal.open('network'));
  await expect(page.locator('.settings-tab.active')).toHaveText('通用');
  await expect(page.locator('.settings-tab[data-tab="network"],.settings-tab[data-tab="data"],.settings-tab[data-tab="notifications"]')).toHaveCount(0);
  await expect(page.locator('#ll-choose-directory')).toBeInViewport();
  expect(await page.locator('[data-general-section]').evaluateAll(nodes=>nodes.map(n=>n.dataset.generalSection))).toEqual(['network','account','notifications','data']);
  expect(await page.locator('#settings-content [id]').evaluateAll(nodes=>{const ids=nodes.map(n=>n.id);return ids.length===new Set(ids).size;})).toBe(true);
  await page.screenshot({path:path.resolve('../artifacts/settings-general-top.png')});
  await chooseSetting(page,'ll-upload-limit','5');
  await chooseSetting(page,'ll-download-limit','10');
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.bandwidth'))).toEqual({upload:5,download:10});
  await page.screenshot({path:path.resolve('../artifacts/settings-bandwidth.png')});
  await page.locator('#ll-open-after-receive').check();
  await page.locator('#ll-transfer-notifications').uncheck();
  await page.locator('#ll-export-records').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.resolve('../artifacts/settings-general-data.png')});
  await page.locator('.settings-tab[data-tab="appearance"]').click();
  await page.locator('.settings-tab[data-tab="account"]').click();
  await expect(page.locator('#ll-upload-limit')).toHaveValue('5');
  await expect(page.locator('#ll-download-limit')).toHaveValue('10');
  await expect(page.locator('#ll-open-after-receive')).toBeChecked();
  await expect(page.locator('#ll-transfer-notifications')).not.toBeChecked();
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.openAfterReceive'))).toBe(true);
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.transferNotifications'))).toBe(false);
  await chooseSetting(page,'interface-language','en');
  await expect(page.locator('.settings-tab.active')).toHaveText('General');
  await chooseSetting(page,'interface-language','zh-Hans');
  await expect(page.locator('.settings-tab.active')).toHaveText('通用');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,680));
  await page.locator('.settings-tab[data-tab="account"]').click();
  await expect(page.locator('#ll-choose-directory')).toBeInViewport();
 }finally {await app.close();}
});

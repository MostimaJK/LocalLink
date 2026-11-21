const {test,expect}=require('@playwright/test');
const {tmpUserDataDir,launchApp}=require('./helpers');
const path=require('path');

test('rounded menus support keyboard, dismissal, short windows and modal close',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('chrome-menu'),[],{keepBootState:true});
 try {
  await page.locator('#btn-nav-settings').click();
  const trigger=page.locator('#interface-language-trigger');
  await expect(trigger).toHaveAttribute('role','combobox');
  await trigger.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('option',{name:'繁體中文'})).toHaveAttribute('aria-selected','true');
  await page.screenshot({path:path.resolve('../artifacts/settings-menu-dark.png')});
  await trigger.press('ArrowDown');
  expect(await page.evaluate(()=>window.I18n.locale)).toBe('zh-Hant');
  await trigger.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.locator('#settings-overlay')).toBeVisible();
  await trigger.press('Enter');
  await trigger.press('End');
  await trigger.press('Enter');
  await expect(trigger).toHaveText('English');
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');await trigger.press('Home');await trigger.press('Enter');
  await expect(trigger).toHaveText('繁體中文');
  await trigger.click();await page.locator('#input-username').click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await trigger.click();await trigger.press('Tab');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  // The close control stays at the top right, and preserves an unsaved name on reopen.
  await page.locator('#input-username').fill('名稱草稿');
  const box=await page.locator('.ll-settings-window').boundingBox(),close=await page.locator('#btn-close-settings').boundingBox();
  expect(close.x).toBeGreaterThan(box.x+box.width-60);expect(close.y).toBeLessThan(box.y+40);
  await page.locator('#btn-close-settings').click();
  await expect(page.locator('#settings-overlay')).not.toBeVisible();
  await expect(page.locator('#btn-nav-settings')).toBeFocused();
  await page.locator('#btn-nav-settings').click();
  await expect(page.locator('#input-username')).toHaveValue('名稱草稿');
  await page.locator('.settings-tab[data-tab="appearance"]').click();
  const bodies=page.locator('#settings-content .collapsible-body');
  for(let i=0;i<await bodies.count();i++)await expect(bodies.nth(i)).toBeVisible();
  await expect(page.locator('#settings-content .collapse-icon')).toHaveCount(0);
  await page.locator('input[name="theme"][value="light"]').click();
  await expect(page.locator('html')).not.toHaveClass(/theme-transitioning/);
  await page.locator('.settings-tab[data-tab="account"]').click();
  await trigger.click();
  await page.screenshot({path:path.resolve('../artifacts/settings-menu-light.png')});
  await trigger.press('Escape');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(900,600));
  await trigger.click();
  const menu=await page.getByRole('listbox').boundingBox();
  const viewport=await page.evaluate(()=>({w:innerWidth,h:innerHeight}));
  expect(menu.x).toBeGreaterThanOrEqual(0);expect(menu.y).toBeGreaterThanOrEqual(0);
  expect(menu.x+menu.width).toBeLessThanOrEqual(viewport.w);expect(menu.y+menu.height).toBeLessThanOrEqual(viewport.h);
  await trigger.press('Escape');await trigger.press('Escape');
  await expect(page.locator('#settings-overlay')).not.toBeVisible();
 }finally{await app.close();}
});

test('caption buttons minimize, maximize, restore and close with correct small glyphs',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('caption'),[],{keepBootState:true});
 let closed=false;const process=app.process();
 try {
  for(const id of ['btn-minimize','btn-maximize','btn-close']) {
   await expect(page.locator('#'+id+' svg')).toHaveCSS('width','12px');
   await expect(page.locator('#'+id)).toHaveAttribute('aria-label',/.+/);
  }
  await page.locator('#btn-maximize').click();
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMaximized())).toBe(true);
  await expect(page.locator('#btn-maximize')).toHaveAttribute('data-maximized','true');
  await expect(page.locator('#btn-maximize')).toHaveAttribute('aria-label','還原');
  await page.locator('#btn-maximize').click();
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMaximized())).toBe(false);
  await expect(page.locator('#btn-maximize')).toHaveAttribute('data-maximized','false');
  await page.locator('#btn-minimize').click();
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized())).toBe(true);
  await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.restore();win.show();});
  await page.locator('#btn-close').hover();
  await expect(page.locator('#btn-close')).toHaveCSS('background-color','rgb(196, 43, 28)');
  await page.screenshot({path:path.resolve('../artifacts/window-chrome-refined.png')});
  const exit=app.waitForEvent('close');
  await page.locator('#btn-close').click();await exit;closed=true;
  await expect.poll(()=>process.exitCode).not.toBeNull();
 }finally{if(!closed)await app.close();}
});


test('background switch persists and native close follows the chosen policy',async()=>{
 const dir=tmpUserDataDir('background');let session=await launchApp(dir,[],{keepBootState:true,fixtureLocale:false});let closed=false;
 try{
  await session.page.evaluate(()=>window.SettingsModal.open('account'));
  const toggle=session.page.locator('#ll-run-in-background');await expect(toggle).not.toBeChecked();
  await toggle.check();await session.page.locator('#btn-close-settings').click();
  await session.page.locator('#btn-close').click();
  await expect.poll(()=>session.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
  // Explicit quit must still exit even when closing to the tray is enabled.
  await session.app.close();
  session=await launchApp(dir,[],{keepBootState:true,fixtureLocale:false});
  await session.page.evaluate(()=>window.SettingsModal.open('account'));await expect(session.page.locator('#ll-run-in-background')).toBeChecked();
  for(const [locale,label] of [['zh-Hant','關閉視窗後在背景執行'],['zh-Hans','关闭窗口后在后台运行'],['en','Keep running after closing the window']]){
   await session.page.evaluate(locale=>{window.I18n.set(locale);window.SettingsModal.open('account');},locale);
   await expect(session.page.getByRole('switch',{name:label})).toBeChecked();
  }
  await session.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  await expect.poll(()=>session.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
  await session.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  await session.page.locator('#ll-run-in-background').uncheck();
  const process=session.app.process(),exit=session.app.waitForEvent('close');
  await session.app.evaluate(({BrowserWindow})=>{setImmediate(()=>BrowserWindow.getAllWindows()[0].close());});
  await exit;closed=true;await expect.poll(()=>process.exitCode).not.toBeNull();
 }finally{if(!closed)await session.app.close();}
});

const {test,expect} = require('@playwright/test');
const {tmpUserDataDir,launchApp} = require('./helpers');
const path = require('path');
test('lean device settings and About do not expose Orbit social features or updates', async () => {
 const {app,page} = await launchApp(tmpUserDataDir('lean-settings'), [], {keepBootState:true});
 try {
  await page.locator('#btn-nav-settings').click();
  await expect(page.locator('#input-username')).toBeVisible();
  await expect(page.locator('#input-avatar, #input-banner, #input-bio, .frame-option')).toHaveCount(0);
  await page.screenshot({path:path.resolve('../artifacts/simplified-settings.png')});
  await page.locator('[data-tab="about"]').click();
  await expect(page.locator('#settings-content')).toContainText('关于 LocalLink');
  await expect(page.locator('#settings-content')).toContainText('LocalSend 互通尚未实现');
  await expect(page.locator('#settings-btn-check-update, #settings-btn-changelog, #settings-btn-replay-tour')).toHaveCount(0);
  const calls = await page.evaluate(async () => {
    let count = 0;
    const old = window.UpdateNotice._engine;
    window.UpdateNotice._engine = () => { count++; throw new Error('Must not reach Orbit updater'); };
    try { window.UpdateNotice.init(); await window.UpdateNotice.checkManual(); } finally { window.UpdateNotice._engine = old; }
    return count;
  });
  expect(calls).toBe(0);
  await page.screenshot({path:path.resolve('../artifacts/simplified-about.png')});
 } finally {await app.close();}
});

const {chooseSetting}=require('./helpers');
const {test, expect} = require('@playwright/test');
const {tmpUserDataDir, launchApp} = require('./helpers');
const path = require('path');
test('device rename and local metadata preserve identity and survive restart', async () => {
  const dir = tmpUserDataDir('locallink');
  let {app, page} = await launchApp(dir);
  try {
    const before = await page.evaluate(() => window.store.getState().currentUser);
    // Old records may still carry a frame number; rendering must ignore it.
    await page.evaluate(() => window.ProfileCard.render({...window.store.getState().currentUser, profileFrame:55}));
    await expect(page.locator('#profile-card-container img[src*="frames/"]')).toHaveCount(0);
    await page.evaluate(() => window.SettingsModal.open('account'));
    await page.locator('#input-username').fill('我的笔记本');
    await page.locator('#btn-save-account').click();
    await expect(page.locator('#save-msg')).toHaveText(await page.evaluate(()=>window.I18n.t('s19')));
    const renamed = await page.evaluate(() => window.store.getState().currentUser);
    expect(renamed.userId).toBe(before.userId);
    expect(renamed.usertag).toBe(before.usertag);
    expect(renamed.username).toBe('我的笔记本');
    await page.locator('#input-username').fill('   ');
    await page.locator('#btn-save-account').click();
    await expect(page.locator('#save-msg')).toContainText('1–32');
    await page.evaluate(() => {
      window.SettingsModal.close();
      window.store.addOrUpdatePeer({userId:'test-device', username:'Original name', usertag:'1234', status:'offline', avatar:null});
      window.store.setState({activeChatId:'test-device'});
    });
    await page.locator('#btn-device-details').click();
    await page.locator('#device-alias').fill('书房电脑');
    await chooseSetting(page,'device-type','desktop');
    await expect(page.locator('#device-type')).not.toBeVisible();
    await expect(page.locator('#device-type-trigger')).toHaveText(await page.evaluate(()=>window.I18n.t('s35')));
    await expect(page.locator('#device-details-dialog')).not.toContainText('These labels');
    await expect(page.locator('#device-details-dialog .ll-dialog-close')).toBeVisible();
    await page.screenshot({path:path.resolve('../artifacts/device-details-refined.png')});
    await page.locator('#device-save').click();
    await expect(page.locator('#chat-header-strip')).toContainText('书房电脑');
    await page.locator('[data-device-scope="history"]').click();
    await expect(page.locator('#friends-list-container')).toContainText('书房电脑');
    expect(await page.evaluate(() => window.store.getState().friends.find(p => p.userId === 'test-device').username)).toBe('Original name');
    await page.screenshot({path:path.resolve('../artifacts/simplified-device-dark.png')});
    await page.evaluate(() => window.SettingsModal.open('appearance'));
    await page.locator('input[name="theme"][value="light"]').click();
    await page.evaluate(() => window.SettingsModal.close());
    await page.locator('div[style*="z-index: 999999"]').waitFor({state:'detached'});
    await page.screenshot({path:path.resolve('../artifacts/simplified-device-light.png')});
    await app.close();
    ({app,page} = await launchApp(dir));
    expect(await page.evaluate(() => window.store.getState().currentUser.userId)).toBe(before.userId);
    expect(await page.evaluate(() => window.store.getState().currentUser.username)).toBe('我的笔记本');
    expect(await page.evaluate(() => window.LocalLinkDevices.get({userId:'test-device'}))).toEqual({alias:'书房电脑',type:'desktop'});
  } finally { await app.close(); }
});

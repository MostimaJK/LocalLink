const { test, expect } = require('@playwright/test');
const {tmpUserDataDir, launchApp} = require('./helpers');
const path = require('path');
test('centered window, nearby sightings and explicit favorites have separate lifetimes', async () => {
  const dir = tmpUserDataDir('device-browser');
  let {app, page} = await launchApp(dir, [], {keepBootState:true});
  try {
    const bounds = await app.evaluate(({BrowserWindow,screen}) => {
      const win = BrowserWindow.getAllWindows()[0];
      return {bounds:win.getBounds(), area:screen.getDisplayMatching(win.getBounds()).workArea, maximized:win.isMaximized(), fullscreen:win.isFullScreen()};
    });
    expect(bounds.maximized).toBe(false);
    expect(bounds.fullscreen).toBe(false);
    expect(Math.abs(bounds.bounds.x + bounds.bounds.width/2 - (bounds.area.x + bounds.area.width/2))).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.bounds.y + bounds.bounds.height/2 - (bounds.area.y + bounds.area.height/2))).toBeLessThanOrEqual(1);
    await expect(page.locator('#chat-welcome-host')).toContainText('在你的设备之间传输');
    await expect(page.locator('#friends-list-container')).not.toContainText('Local demo');
    await page.evaluate(() => window.store.addOrUpdatePeer({userId:'wan-only', username:'Internet peer', status:'online', usertag:'0001'}));
    await expect(page.locator('#friends-list-container')).not.toContainText('Internet peer');
    // Inject the main-process discovery notification; no physical LAN peer is claimed.
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.send('locallink-lan-seen', {userId:'lan-test', username:'Test laptop', usertag:'0002', status:'online', ip:'192.0.2.2'}));
    await expect(page.locator('#friends-list-container')).toContainText('Test laptop');
    await page.locator('[data-favorite-id="lan-test"]').click();
    await page.evaluate(() => {
      const d = window.LocalLinkDevices;
      d.nearby.set(d.key('lan-test'), Date.now()-46000);
      window.store.setState({friends:[...window.store.getState().friends]});
    });
    await expect(page.locator('#friends-list-container')).not.toContainText('Test laptop');
    await page.locator('[data-device-scope="favorites"]').click();
    await expect(page.locator('#friends-list-container')).toContainText('Test laptop');
    await page.screenshot({path:path.resolve('../artifacts/phase2-home.png')});
    await app.close();
    ({app,page} = await launchApp(dir, [], {keepBootState:true}));
    await expect(page.locator('#friends-list-container')).not.toContainText('Test laptop');
    await page.locator('[data-device-scope="favorites"]').click();
    await expect(page.locator('#friends-list-container')).toContainText('Test laptop');
    await page.locator('[data-favorite-id="lan-test"]').click();
    await expect(page.locator('#friends-list-container')).not.toContainText('Test laptop');
    await page.locator('[data-device-scope="history"]').click();
    await expect(page.locator('#friends-list-container')).toContainText('Test laptop');
  } finally { await app.close(); }
});

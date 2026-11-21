const { test, expect } = require('@playwright/test');
const { launchApp, tmpUserDataDir } = require('./helpers');

test('Mac window controls, background close and Dock activation', async () => {
  test.skip(process.platform !== 'darwin', 'Requires a native macOS window');
  const { app, page } = await launchApp(tmpUserDataDir('mac-window'), [], {keepBootState:true});
  try {
    await expect(page.locator('html')).toHaveAttribute('data-platform', 'darwin');
    await expect(page.locator('#titlebar .controls')).toBeHidden();
    await page.evaluate(() => window.orbitAPI.dbSetSetting('locallink.runInBackground', true));
    const id = await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.close();
      return window.id;
    });
    await expect.poll(() => app.evaluate(({ BrowserWindow }, id) =>
      BrowserWindow.fromId(id)?.isVisible(), id)).toBe(false);
    await app.evaluate(({ app }) => app.emit('activate'));
    await expect.poll(() => app.evaluate(({ BrowserWindow }, id) =>
      BrowserWindow.fromId(id)?.isVisible(), id)).toBe(true);
    await page.evaluate(() => window.SettingsModal.open('general'));
    await page.locator('#ll-check-adapters').click();
    const info = await page.evaluate(() => window.orbitAPI.invoke('locallink-network-adapters'));
    expect(info.addressesOnly).toBe(true);
    for (const adapter of info.adapters) {
      await expect(page.locator('#ll-adapters-result')).toContainText(adapter.name);
    }
  } finally {
    await app.close();
  }
});

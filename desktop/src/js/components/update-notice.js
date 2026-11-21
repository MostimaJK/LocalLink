// LocalLink GitHub Release updates. Downloads require SHA256SUMS verification.
window.UpdateNotice = {
  _modal: null,
  _busy: false,
  _t(tw, cn, en) { return window.LocalSendPanel.text(tw, cn, en); },
  _esc(value) { return window.Sanitize.escapeHtml(String(value || '')); },
  _engine() { return window.Orbit.UpdateCheck; },
  _openExternal(url) { return window.orbitAPI.openExternal(url); },
  init() {
    // Opt-in, delayed, throttled; never competes with the first render.
    if (!window.orbitAPI.dbGetSetting('locallink.updateCheck', false)) return;
    setTimeout(() => this._engine().checkThrottled().then(result => {
      if (result.ok && result.hasUpdate) window.Toast.show('LocalLink',
        this._t('有新版本，請至設定 → 關於查看。','有新版本，请到设置 → 关于查看。','An update is available in Settings → About.'), 'info');
    }), 10000);
  },
  async checkManual(opts) {
    if (this._checking) return;
    this._checking = true;
    try {
      const result = await this._engine().checkThrottled({...opts, force:true});
      if (!result.ok) window.Toast.show('LocalLink', this._t(
        '無法讀取 GitHub 更新。請檢查網路，並確認發行版本公開。',
        '无法读取 GitHub 更新。请检查网络，并确认发行版本公开。',
        'Cannot read GitHub updates. Check your connection and that releases are public.'), 'error');
      else if (result.hasUpdate) this.openModal(result);
      else window.Toast.show('LocalLink', result.reason === 'no-releases'
        ? this._t('尚無公開版本。','暂无公开版本。','No published releases found.')
        : this._t('目前沒有更新版本。','目前没有更新版本。','No newer version is available.'), 'info');
      return result;
    } finally { this._checking = false; }
  },
  closeModal() {
    if (this._busy) return;
    this._modal?.remove(); this._modal = null;
    document.removeEventListener('keydown', this._key);
  },
  hideCard() {},
  openModal(result) {
    if (this._busy) return;
    this.closeModal();
    const t = this._t.bind(this), esc = this._esc;
    const overlay = document.createElement('div');
    overlay.id = 'update-notice-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#0009;display:grid;place-items:center';
    overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="ll-update-title" style="position:relative;width:520px;max-width:90vw;max-height:85vh;overflow:auto;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:16px;padding:28px">
      <button id="update-modal-close" aria-label="${t('關閉','关闭','Close')}" style="position:absolute;right:16px;top:12px" class="ll-action-button">×</button>
      <h3 id="ll-update-title">LocalLink ${esc(result.latest)}</h3>
      <p>${t('目前版本','当前版本','Current version')}: ${esc(result.current)}${result.prerelease ? ' · '+t('預覽版','预览版','Prerelease') : ''}</p>
      <p>${window.orbitAPI.portable
        ? t('免安裝版：下載後退出舊版，將新檔案放到原位置並啟動。設定與記錄會保留。','免安装版：下载后退出旧版，将新文件放到原位置并启动。设置与记录会保留。','Portable: quit the old app, replace its EXE with the download, then launch it. Settings and history are retained.')
        : t('下載並校驗完成後，退出 LocalLink，再執行安裝程式。','下载并校验完成后，退出 LocalLink，再运行安装程序。','After download and verification, quit LocalLink and run the installer.')}</p>
      <ul>${(result.highlights || []).map(note=>`<li>${esc(note)}</li>`).join('')}</ul>
      <p>${esc(result.asset?.name)} ${result.asset?.size ? '('+(result.asset.size/1048576).toFixed(1)+' MiB)' : ''}</p>
      <p id="update-download-status" role="status" aria-live="polite"></p>
      <progress id="update-download-bar" max="100" value="0" hidden style="width:100%"></progress>
      <div class="ll-file-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
        <button class="ll-action-button" id="update-modal-notes">${t('發行說明','发行说明','Release notes')}</button>
        <button class="ll-action-button" id="update-reveal-file" hidden>${t('開啟資料夾','打开文件夹','Open folder')}</button>
        <button class="ll-action-button" id="update-open-file" hidden>${t('執行安裝程式','运行安装程序','Run installer')}</button>
        <button class="ll-action-button" id="update-modal-download">${t('下載更新','下载更新','Download update')}</button>
      </div></section>`;
    document.body.appendChild(overlay); this._modal = overlay;
    const find = id => overlay.querySelector('#'+id);
    find('update-modal-close').onclick = () => this.closeModal();
    this._key = event => { if (event.key === 'Escape') this.closeModal(); };
    document.addEventListener('keydown', this._key);
    find('update-modal-notes').onclick = () => this._openExternal(result.releaseUrl);
    const button = find('update-modal-download');
    button.disabled = !result.asset || !result.manifestUrl;
    if (button.disabled) find('update-download-status').textContent = t('此版本缺少適用的更新包或校驗檔。','此版本缺少适用的更新包或校验文件。','This release has no compatible package or checksum manifest.');
    button.onclick = async () => {
      if (this._busy) { window.orbitAPI.cancelUpdateDownload(); button.disabled = true; return; }
      this._busy = true;
      find('update-modal-close').disabled = true;
      button.textContent = t('取消','取消','Cancel');
      const status = find('update-download-status'), bar = find('update-download-bar');
      status.textContent = t('正在下載…','正在下载…','Downloading…'); bar.hidden = false;
      const unsubscribe = window.orbitAPI.onUpdateDownloadProgress(progress => {
        if (progress.total) bar.value = Math.min(100, progress.percent); else bar.removeAttribute('value');
        status.textContent = (progress.received/1048576).toFixed(1)+' MiB'+(progress.total ? ' / '+(progress.total/1048576).toFixed(1)+' MiB' : '') +
          (progress.percent >= 100 ? ' · '+t('正在校驗…','正在校验…','Verifying…') : '');
      });
      try {
        const out = await window.orbitAPI.downloadUpdate({url:result.asset.url, name:result.asset.name, manifestUrl:result.manifestUrl});
        if (!out?.ok) {
          status.textContent = out?.cancelled ? t('下載已取消。','下载已取消。','Download cancelled.') : t('下載或校驗失敗，請重試。','下载或校验失败，请重试。','Download or checksum verification failed. Please retry.');
          return;
        }
        status.textContent = t('校驗通過，已儲存：','校验通过，已保存：','Checksum verified. Saved: ')+out.path;
        button.hidden = true;
        find('update-reveal-file').hidden = false;
        find('update-reveal-file').onclick = () => window.orbitAPI.revealDownloadedFile(out.path);
        // Portable updates are replaced manually after exit; do not launch two copies.
        if (!window.orbitAPI.portable) {
          find('update-open-file').hidden = false;
          find('update-open-file').onclick = async () => {
            const opened = await window.orbitAPI.openDownloadedFile(out.path);
            if (!opened?.ok) status.textContent = t('無法啟動，請從資料夾執行。','无法启动，请从文件夹运行。','Could not launch. Open the installer from its folder.');
          };
        }
      } catch (error) { status.textContent = t('下載失敗，請重試。','下载失败，请重试。','Download failed. Please retry.'); }
      finally {
        unsubscribe(); this._busy = false; button.disabled = false;
        button.textContent = t('下載更新','下载更新','Download update');
        find('update-modal-close').disabled = false;
      }
    };
    find('update-modal-close').focus();
  }
};

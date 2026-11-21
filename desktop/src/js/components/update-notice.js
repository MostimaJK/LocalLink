// LocalLink GitHub Release updates. Downloads require SHA256SUMS verification.
window.UpdateNotice = {
  _modal: null,
  _busy: false,
  _t(tw, cn, en) { return window.LocalSendPanel.text(tw, cn, en); },
  _esc(value) { return window.Sanitize.escapeHtml(String(value || '')); },
  _engine() { return window.Orbit.UpdateCheck; },
  _openExternal(url) { return window.orbitAPI.openExternal(url); },
  init() {
    if(!this._checkedAttempt){this._checkedAttempt=true;this.lastAttempt();}
    // Opt-in, delayed, throttled; never competes with the first render.
    if (!window.orbitAPI.dbGetSetting('locallink.updateCheck', false)) return;
    setTimeout(() => this._engine().checkThrottled().then(result => {
      if (result.ok && result.hasUpdate) window.Toast.show('LocalLink',
        this._t('有新版本，請至設定 → 關於查看。','有新版本，请到设置 → 关于查看。','An update is available in Settings → About.'), 'info');
    }), 10000);
  },
  async lastAttempt(container){
    if(window.orbitAPI.platform!=='win32')return;
    const attempt=await window.orbitAPI.invoke('locallink-update-recovery').catch(()=>null);
    if(!attempt)return;
    const t=this._t.bind(this);
    const message=attempt.updated?t('已更新至','已更新至','Updated to')+' LocalLink '+attempt.version:
      t('上次更新未完成','上次更新未完成','Previous update did not finish')+' · LocalLink '+attempt.version;
    if(!container){
      const key=attempt.id+(attempt.updated?'-ok':'-pending');
      if(window.orbitAPI.dbGetSetting('locallink.lastUpdateNotice','')!==key){
        window.Toast.show('LocalLink',message+(attempt.updated?'':t('。請至設定 → 關於查看。','。请到设置 → 关于查看。','. Open Settings → About.')),attempt.updated?'success':'info');
        window.orbitAPI.dbSetSetting('locallink.lastUpdateNotice',key);
      }
      return;
    }
    container.hidden=false;
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent=message;container.append(status);
    if(attempt.updated)return;
    if(!attempt.available){status.textContent+=t('。請重新下載更新包。','。请重新下载更新包。','. Download the update package again.');return;}
    const actions=document.createElement('div');actions.className='ll-file-actions';container.append(actions);
    for(const [action,label] of [['reveal',t('開啟所在資料夾','打开所在目录','Open folder')],['retry',t('重新執行安裝程式','重新运行安装包','Run installer again')]]){
      const btn=document.createElement('button');btn.textContent=label;actions.append(btn);
      btn.onclick=async()=>{
        btn.disabled=true;
        if(action==='retry')status.textContent=this.startingMessage();
        try{
          const res=await window.orbitAPI.invoke('locallink-update-recovery',{id:attempt.id,action});
          if(!res?.ok)status.textContent=res?.error==='active-transfers'?t('請先結束傳輸與共享。','请先结束传输与共享。','Finish transfers and sharing first.'):t('無法使用此安裝包，請重新下載。','无法使用此安装包，请重新下载。','Cannot use this installer. Download the update again.');
        }catch{status.textContent=t('操作失敗，請重試。','操作失败，请重试。','Action failed. Try again.');}
        finally{btn.disabled=false;}
      };
    }
  },
  startingMessage(){
    return this._t('正在準備安裝。Windows 可能會要求管理員授權。','正在准备安装。Windows 可能会请求管理员授权。','Preparing installation. Windows may ask for administrator approval.');
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
    const windowsUpdate = window.orbitAPI.platform === 'win32';
    const overlay = document.createElement('div');
    overlay.id = 'update-notice-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#0009;display:grid;place-items:center';
    overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="ll-update-title" style="position:relative;width:520px;max-width:90vw;max-height:85vh;overflow:auto;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:16px;padding:28px">
      <button id="update-modal-close" aria-label="${t('關閉','关闭','Close')}" style="position:absolute;right:16px;top:12px" class="ll-action-button">×</button>
      <h3 id="ll-update-title">LocalLink ${esc(result.latest)}</h3>
      <p>${t('目前版本','当前版本','Current version')}: ${esc(result.current)}${result.prerelease ? ' · '+t('預覽版','预览版','Prerelease') : ''}</p>
      <p>${windowsUpdate ? t('校驗完成後可更新並重新啟動，設定與記錄會保留。請先完成傳輸與通話。','校验完成后可更新并重启，设置与记录会保留。请先完成传输和通话。','After verification, update and restart while keeping settings and history. Finish transfers and calls first.') : t('校驗完成後，開啟下載資料夾並手動安裝。','校验完成后，打开下载文件夹并手动安装。','After verification, open the download folder to install the update manually.')}</p>
      <ul>${(result.highlights || []).map(note=>`<li>${esc(note)}</li>`).join('')}</ul>
      <p>${esc(result.asset?.name)} ${result.asset?.size ? '('+(result.asset.size/1e6).toFixed(1)+' MB)' : ''}</p>
      <p id="update-download-status" role="status" aria-live="polite"></p>
      <progress id="update-download-bar" max="100" value="0" hidden style="width:100%"></progress>
      <div class="ll-file-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
        <button class="ll-action-button" id="update-modal-notes">${t('發行說明','发行说明','Release notes')}</button>
        <button class="ll-action-button" id="update-reveal-file" hidden>${t('開啟資料夾','打开文件夹','Open folder')}</button>
        <button class="ll-action-button" id="update-open-file" hidden>${t('更新並重新啟動','更新并重启','Update and restart')}</button>
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
        status.textContent = (progress.received/1e6).toFixed(1)+' MB'+(progress.total ? ' / '+(progress.total/1e6).toFixed(1)+' MB' : '') +
          (progress.percent >= 100 ? ' · '+t('正在校驗…','正在校验…','Verifying…') : '');
      });
      try {
        const out = await window.orbitAPI.downloadUpdate({url:result.asset.url, name:result.asset.name, manifestUrl:result.manifestUrl});
        if (!out?.ok) {
          bar.hidden = true;
          const reasons = {
            'manifest unavailable':t('無法下載校驗清單，請檢查網路或系統代理。','无法下载校验清单，请检查网络或系统代理。','Could not download the checksum list. Check your network or system proxy.'),
            'missing checksum':t('發行清單缺少此檔案的校驗值。','发行清单缺少此文件的校验值。','The release has no checksum for this file.'),
            'checksum mismatch':t('檔案校驗不符，請重新下載。','文件校验不符，请重新下载。','Checksum mismatch. Download the file again.')
          };
          status.textContent = out?.cancelled ? t('下載已取消。','下载已取消。','Download cancelled.') :
            reasons[out?.error] || t('下載失敗','下载失败','Download failed') + ' · ' + (out?.error || t('請重試','请重试','Please retry'));
          return;
        }
        status.textContent = t('校驗通過，已儲存：','校验通过，已保存：','Checksum verified. Saved: ')+out.path;
        button.hidden = true;
        find('update-reveal-file').hidden = false;
        find('update-reveal-file').onclick = () => window.orbitAPI.revealDownloadedFile(out.path);
        if (!windowsUpdate) return;
        find('update-open-file').hidden = false;
        find('update-open-file').onclick = async () => {
          const install=find('update-open-file');install.disabled=true;
          status.textContent=this.startingMessage();
          try {
            const opened=await window.orbitAPI.installUpdate(out.path);
            if(!opened?.ok) status.textContent=opened?.error==='active-transfers'
              ? t('請先完成或取消傳輸，並結束通話，再更新。','请先完成或取消传输，并结束通话，再更新。','Finish or cancel transfers and end calls before updating.')
              : opened?.error==='packaged-windows-only'
                ? t('請在 Windows 安裝版或免安裝版中使用自動更新。','请在 Windows 安装版或免安装版中使用自动更新。','Automatic replacement requires a packaged Windows app.')
                : t('無法更新，程式未退出。請確認資料夾可寫入，或從資料夾手動更新。','无法更新，程序未退出。请确认文件夹可写入，或从文件夹手动更新。','Could not update; the app is still open. Check folder permissions or update manually from the download folder.');
          } catch(error){status.textContent=t('更新失敗，請重試。','更新失败，请重试。','Update failed. Please retry.');}
          finally{install.disabled=false;}
        };
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

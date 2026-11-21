// Local-only presentation metadata. Never broadcast aliases or infer trust.
window.LocalLinkDevices = {
  nearby: new Map(),
  observe(peer) {
    if (!peer || !peer.userId || peer.userId === 'local-echo') return;
    this.nearby.set(this.key(peer.userId), Date.now());
    if(peer.deviceType)window.orbitAPI.dbSetSetting(this.key(peer.userId),{...this.get(peer),detectedType:peer.deviceType});
    window.store.addOrUpdatePeer(peer);
  },
  isNearby(peer, now = Date.now()) {
    const seen = this.nearby.get(this.key(peer.userId));
    return seen != null && now - seen < 45000;
  },
  isFavorite(peer) { return this.get(peer).favorite === true; },
  toggleFavorite(peer) {
    const meta = this.get(peer);
    window.orbitAPI.dbSetSetting(this.key(peer.userId), {...meta, favorite: !meta.favorite});
    window.store.setState({friends: [...window.store.getState().friends]});
  },
  key(id) { return 'locallink.device.' + window.store.getState().currentUser.userId + '.' + id; },
  get(peer) { return window.orbitAPI.dbGetSetting(this.key(peer.userId), {}) || {}; },
  name(peer) { if (peer.userId === 'local-echo') return 'Local demo (Echo)'; return this.get(peer).alias || peer.username || 'Unnamed device'; },
  icon(peer) { const meta=this.get(peer);const type=meta.type&&meta.type!=='unknown'?meta.type:peer.deviceType||meta.detectedType;return {phone:'smartphone',mobile:'smartphone',desktop:'monitor',laptop:'laptop',tablet:'tablet',server:'server',headless:'server',web:'globe'}[type]||'monitor-smartphone'; },
  connectDialog(){
    if(document.getElementById('ll-connect-dialog'))return;
    const t=window.LocalSendPanel.text.bind(window.LocalSendPanel),esc=window.Sanitize.escapeHtml;
    const dialog=document.createElement('dialog');dialog.id='ll-connect-dialog';dialog.className='ll-connect-dialog';
    dialog.innerHTML=`<form><button type="button" class="ll-dialog-close" aria-label="${t('關閉','关闭','Close')}">×</button><h2>${t('連接裝置','连接设备','Connect device')}</h2>
    <label for="ll-device-address">${t('裝置 IP 位址','设备 IP 地址','Device IP address')}</label><input id="ll-device-address" placeholder="192.168.1.10:53317" required autocomplete="off" spellcheck="false">
    <p id="ll-connect-error" role="status"></p><button class="ll-send" id="ll-connect-submit">${t('尋找裝置','查找设备','Find device')}</button></form>`;
    dialog.querySelector('.ll-dialog-close').onclick=()=>dialog.close();
    dialog.onclose=()=>dialog.remove();
    dialog.querySelector('form').onsubmit=async event=>{
      event.preventDefault();const button=dialog.querySelector('#ll-connect-submit');button.disabled=true;
      const result=await window.orbitAPI.invoke('locallink-discover',dialog.querySelector('input').value.trim());
      if(!dialog.isConnected)return;button.disabled=false;
      if(result.ok){dialog.close();window.store.setState({activeChatId:result.peer.id});}
      else dialog.querySelector('#ll-connect-error').textContent=window.LocalSendPanel.errorLabel(result.error);
    };
    document.body.appendChild(dialog);dialog.showModal();dialog.querySelector('input').focus();
  },
  validateName(value) {
    if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > 32 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)) {
      throw new Error('Device name must contain 1–32 characters without control characters.');
    }
    return value.trim();
  },
  edit(peer) {
    if (document.getElementById('device-details-dialog')) return;
    const meta = this.get(peer);
    const dialog = document.createElement('dialog');
    dialog.id = 'device-details-dialog';
    dialog.style.cssText = 'position:relative;margin:auto;padding:24px;border:1px solid var(--border-subtle);border-radius:12px;background:var(--bg-surface);color:var(--text-primary);width:420px;max-width:90vw;';
    dialog.innerHTML = '<form method="dialog"><h2 style="margin-bottom:16px"><span data-i18n="s30">Device details</span></h2><p id="device-reported-name"></p><label for="device-alias"><span data-i18n="s31">Local remark (optional)</span></label><input id="device-alias" maxlength="64" style="display:block;width:100%;margin:8px 0 16px;padding:8px"><label for="device-type"><span data-i18n="s32">Device type (set locally)</span></label><select id="device-type" style="display:block;width:100%;margin:8px 0 16px;padding:8px"><option value="unknown"><span data-i18n="s33">Unknown</span></option><option value="phone"><span data-i18n="s34">Phone</span></option><option value="desktop"><span data-i18n="s35">Desktop</span></option><option value="laptop"><span data-i18n="s36">Laptop</span></option><option value="tablet"><span data-i18n="s37">Tablet</span></option></select><p id="device-error" role="alert"></p><div style="display:flex;justify-content:flex-end;gap:16px;margin-top:20px"><button value="cancel"><span data-i18n="s28">Cancel</span></button><button id="device-save" type="button"><span data-i18n="s29">Save</span></button></div></form>';
    dialog.querySelectorAll('input, select, button').forEach(control => {
      control.style.background = 'var(--bg-base)';
      control.style.color = 'var(--text-primary)';
      control.style.border = '1px solid var(--border-subtle)';
      control.style.borderRadius = '6px';
      control.style.padding = '8px';
    });
    dialog.querySelector('#device-reported-name').textContent = peer.username;
    dialog.querySelector('#device-reported-name').style.cssText='color:var(--text-secondary);margin-bottom:20px';
    dialog.querySelector('#device-alias').value = meta.alias || '';
    dialog.querySelector('#device-type').value = meta.type || 'unknown';
    dialog.querySelector('#device-save').onclick = () => {
      try {
        const raw = dialog.querySelector('#device-alias').value;
        const alias = raw.trim() ? this.validateName(raw) : '';
        window.orbitAPI.dbSetSetting(this.key(peer.userId), {...this.get(peer), alias, type:dialog.querySelector('#device-type').value});
        window.store.setState({friends: [...window.store.getState().friends]});
        dialog.close();
      } catch (error) { dialog.querySelector('#device-error').textContent = error.message; }
    };
    dialog.addEventListener('close', () => dialog.remove());
    document.body.appendChild(dialog);
    const close=document.createElement('button');close.type='button';close.className='ll-dialog-close';close.setAttribute('aria-label',window.I18n.t('s9'));close.title=window.I18n.t('s9');
    close.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    close.onclick=()=>dialog.close();dialog.appendChild(close);
    const typeLabels={unknown:'s33',phone:'s34',desktop:'s35',laptop:'s36',tablet:'s37'};
    dialog.querySelectorAll('#device-type option').forEach(option=>{option.textContent=window.I18n.t(typeLabels[option.value]);});
    window.I18n.apply();
    window.LocalLinkSelect.enhance(dialog);
    dialog.addEventListener('close',()=>window.LocalLinkSelect.close());
    dialog.showModal();
  }
};
document.addEventListener('click', function(event) {
  if (!event.target.closest('#btn-device-details')) return;
  const state = window.store.getState();
  const peer = state.friends.find(p => p.userId === state.activeChatId);
  if (peer) window.LocalLinkDevices.edit(peer);
});

// LAN sightings are session-only, distinct from persisted history and favorites.
if (window.orbitAPI) window.orbitAPI.on('locallink-lan-seen', peer => window.LocalLinkDevices.observe(peer));
setInterval(() => {
  if (!window.store || !window.store.getState().currentUser) return;
  let expired = false;
  const now = Date.now();
  window.LocalLinkDevices.nearby.forEach((seen, key) => {
    if (now - seen >= 45000) { window.LocalLinkDevices.nearby.delete(key); expired = true; }
  });
  if (expired) window.store.setState({friends: [...window.store.getState().friends]});
}, 5000);

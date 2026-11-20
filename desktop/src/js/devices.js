// Local-only presentation metadata. Never broadcast aliases or infer trust.
window.LocalLinkDevices = {
  nearby: new Map(),
  observe(peer) {
    if (!peer || !peer.userId || peer.userId === 'local-echo') return;
    this.nearby.set(this.key(peer.userId), Date.now());
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
  icon(peer) { return {phone:'smartphone', desktop:'monitor', laptop:'laptop', tablet:'tablet'}[this.get(peer).type] || 'monitor-smartphone'; },
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
    dialog.style.cssText = 'margin:auto;padding:24px;border:1px solid var(--border-subtle);border-radius:12px;background:var(--bg-surface);color:var(--text-primary);width:420px;max-width:90vw;';
    dialog.innerHTML = '<form method="dialog"><h2 style="margin-bottom:16px">Device details</h2><p id="device-reported-name"></p><p style="margin:12px 0;color:var(--text-muted)">These labels stay on this computer. Connecting does not establish trust.</p><label for="device-alias">Local remark (optional)</label><input id="device-alias" maxlength="64" style="display:block;width:100%;margin:8px 0 16px;padding:8px"><label for="device-type">Device type (set locally)</label><select id="device-type" style="display:block;width:100%;margin:8px 0 16px;padding:8px"><option value="unknown">Unknown</option><option value="phone">Phone</option><option value="desktop">Desktop</option><option value="laptop">Laptop</option><option value="tablet">Tablet</option></select><p id="device-error" role="alert"></p><div style="display:flex;justify-content:flex-end;gap:16px;margin-top:20px"><button value="cancel">Cancel</button><button id="device-save" type="button">Save</button></div></form>';
    dialog.querySelectorAll('input, select, button').forEach(control => {
      control.style.background = 'var(--bg-base)';
      control.style.color = 'var(--text-primary)';
      control.style.border = '1px solid var(--border-subtle)';
      control.style.borderRadius = '6px';
      control.style.padding = '8px';
    });
    dialog.querySelector('#device-reported-name').textContent = 'Reported name: ' + peer.username;
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

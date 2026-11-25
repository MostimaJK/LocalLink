// src/js/views/sidebar-left.js

window.SidebarLeft = {
  init() {
    this.container = document.getElementById('left-sidebar-container');
    this.container.style.cssText = 'display:flex; flex-direction:column; flex:1; align-items:center; overflow:hidden;';
    this.render();
    window.LocalLinkNav.mount(this.container, '.sidebar-top .icon-btn');
    this.attachEvents();
    
    this.unsubscribe = window.store.subscribe((state, changedState) => {
      if (!changedState) {
        this.render();
        this.attachEvents(); // render() replaces innerHTML → re-wire click handlers
        this.renderAvatar(state.currentUser);
        return;
      }
      if ('settings' in changedState || 'activeChatId' in changedState) {
        // Folders rail button is gated on enableExperimental — re-render so it
        // appears/disappears when the experimental toggle flips.
        this.render();
        this.attachEvents(); // render() replaces innerHTML → re-wire click handlers
        this.renderAvatar(state.currentUser);
      } else if ('currentUser' in changedState) {
        this.renderAvatar(state.currentUser);
      }
    });
    this.renderAvatar(window.store.getState().currentUser);
  },

  renderAvatar(user) {
    if (!this.container) return;
    const profileBtn = this.container.querySelector('#btn-profile');
    if (!profileBtn) return;
    profileBtn.innerHTML = '<i data-lucide="monitor-smartphone"></i>';
    profileBtn.title = '本设备';
    lucide.createIcons({ root: profileBtn });
  },

  render() {
    const focused = this.container.contains(document.activeElement) && document.activeElement.id;
    var s = (window.store.getState().settings || {}).sidebarButtons || {};
    var localSend=window.orbitAPI.dbGetSetting('locallink.transport','localsend')==='localsend';
    var showActivity = !localSend && s.activity !== false;
    var showGallery = s.gallery !== false;
    var showStorage = s.storage !== false;
    var showFolders = (window.store.getState().settings || {}).enableExperimental === true;
    var activeView = window.store.getState().activeView;
    var activeTab = window.store.getState().activeTab;
    // The gallery is tracked by activeTab, not activeView — and the old template only
    // asked "are we in folders?", so DMs lit up whenever you were anywhere else
    // (including the gallery). Any re-render then stole the gallery's highlight and
    // handed it back to DMs, which is why changing the gallery display style reset the
    // sidebar to DMs.
    var center=window.store.getState().activeChatId;
    var inGallery = activeTab === 'gallery'||center==='locallink-view:tasks';
    var inReceived=center==='locallink-view:received';
    var inFolders = activeView === 'folders';

    this.container.innerHTML = `
      <div class="sidebar-top">
        <!-- Logo -->
        <button class="icon-btn ${(!inGallery && !inFolders && !inReceived) ? 'active' : ''}" id="btn-nav-dms" title="设备与传输">
          <i data-lucide="monitor-smartphone"></i>
        </button>
        <div class="sidebar-separator" style="width:24px;height:1px;background:var(--border-subtle);margin-top:8px;margin-bottom:8px;margin-left:auto;margin-right:12px;"></div>
        ${showFolders ? '<button class="icon-btn' + (inFolders ? ' active' : '') + '" id="btn-nav-folders" title="Folders"><i data-lucide="folder"></i></button>' : ''}
        ${showActivity ? '<button class="icon-btn" id="btn-nav-activity" title="Activity Center"><i data-lucide="bell"></i></button>' : ''}
        ${showGallery ? '<button class="icon-btn' + (inGallery ? ' active' : '') + '" id="btn-nav-gallery" title="Gallery"><i data-lucide="arrow-left-right"></i></button>' : ''}
        ${showStorage ? '<button class="icon-btn'+(inReceived?' active':'')+'" id="btn-nav-storage" title="Storage"><i data-lucide="folder-down"></i></button>' : ''}
      </div>
      
      <div class="sidebar-spacer" style="flex: 1;"></div>
      
      <div class="sidebar-bottom">
        <button class="icon-btn" id="btn-nav-settings" title="Settings">
          <i data-lucide="settings"></i>
        </button>

      </div>
    `;
    const lang=window.I18n?.locale||'zh-Hant',t=(tw,cn,en)=>lang==='en'?en:lang==='zh-Hans'?cn:tw;
    const labels={'btn-nav-dms':t('裝置與傳輸','设备与传输','Devices and transfers'),'btn-nav-gallery':localSend?t('傳輸任務','传输任务','Transfers'):t('媒體庫','媒体库','Gallery'),'btn-nav-storage':localSend?t('已接收檔案','已接收文件','Received files'):t('記錄與備份','记录与备份','History and backup'),'btn-nav-settings':t('設定','设置','Settings'),'btn-profile':t('本裝置','本设备','This device')};
    for(const [id,label] of Object.entries(labels)){const b=this.container.querySelector('#'+id);if(b){b.title=label;b.setAttribute('aria-label',label);}}
    window.TransferCenter?.badge();
    // Re-initialize icons for newly added HTML
    lucide.createIcons({ root: this.container });
    if (focused) document.getElementById(focused)?.focus({preventScroll:true});
  },

  attachEvents() {
    // Nav buttons logic
    const btns = this.container.querySelectorAll('.icon-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (btn.id === 'btn-nav-activity') {
          if (window.ActivityCenter) window.ActivityCenter.show();
          return;
        }
        if (btn.id === 'btn-nav-folders') {
          btns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          window.store.setState({ activeView: 'folders', activeFolder: null });
          return;
        }
        if (btn.id === 'btn-nav-storage') {
          if(window.orbitAPI.dbGetSetting('locallink.transport','localsend')==='localsend')window.TransferCenter.open('received');else if (window.SettingsModal) window.SettingsModal.open('data');
          return;
        }
        if(btn.id !== 'btn-profile' && btn.id !== 'btn-nav-settings') {
          btns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          if (btn.id === 'btn-nav-gallery' && window.orbitAPI.dbGetSetting('locallink.transport','localsend')==='localsend') {
            window.TransferCenter.open('tasks');
          } else if (btn.id === 'btn-nav-gallery') {
            window.store.setState({ activeTab: 'gallery' });
          } else {
            // Return to the transfer home without discarding per-device history.
            window.store.setState({ activeTab: 'dms', activeView: 'friends', activeFolder: null, activeChatId: null });
          }
        }
      });
    });

    var settingsBtn = document.getElementById('btn-nav-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if(window.SettingsModal) window.SettingsModal.open();
      });
    }

    var profileBtn = document.getElementById('btn-profile');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        window.SettingsModal.open('account');
      });
      profileBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.SettingsModal.open('account');
      });
    }
  }
};

// src/js/views/settings-modal.js

/**
 * The default profile banner.
 *
 * ⚠⚠ ONE DEFINITION, USED TWICE — AND IT WAS NOT, WHICH COST A ROUND TRIP.
 *
 * This gradient was written out in two places: the render path and the
 * live-preview path (which rebuilds the banner as you type in the field). The
 * v0.9.0 fix changed the render path and left the preview one alone, so the old
 * colour came straight back the moment anyone touched the banner input. A test
 * that reads THIS FILE for the retired hex is what found the second copy —
 * reading the line I had changed would never have shown it.
 *
 * ⚠⚠ AND THEN IT WAS STILL THREE DEFINITIONS ACROSS THE APP. The same default
 * was written out again in the profile sidebar and in the Manage Group modal —
 * both still ending in the retired #6C5CE7. Fixing one file and asserting on one
 * file is what let the other two survive.
 *
 * ⚠ The VALUE now lives in styles/variables.css as `--banner-default`, which is
 * the one place all three call sites read. This constant is only a NAME for it,
 * so the two settings call sites below cannot drift apart again.
 *
 * ⚠ It used to run accent → #6C5CE7: a HARDCODED PURPLE, and therefore a second
 * brand colour in a design that has exactly one. It is a wash of the THEME's
 * accent instead, so a nord or sunset user gets their own colour here rather than
 * Orbit blue.
 */
var DEFAULT_BANNER = 'var(--banner-default)';

window.SettingsModal = {
  isOpen: false,

  init() {
    this.container = document.createElement('div');
    this.container.id = 'settings-overlay';
    this.container.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;';
    document.body.appendChild(this.container);
    this.render();
    var self = this;
    document.addEventListener('visibilitychange', () => this._syncNetworkMapTimer());
    window.orbitAPI.on('locallink-window-visible', visible => {this._windowVisible = visible;this._syncNetworkMapTimer();});
    this.container.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!window.LocalLinkSelect.active){e.preventDefault();e.stopPropagation();this.close();}
      if(e.key==='Tab'){
        const items=[...this.container.querySelectorAll('button,input,textarea,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
        const first=items[0],last=items.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    });
    // Close theme dropdown on outside click
    this.container.addEventListener('click', function(e) {
      if (e.target.closest('#theme-custom-menu') || e.target.closest('#theme-custom-trigger')) return;
      var menu = document.getElementById('theme-custom-menu');
      if (menu && menu.style.display !== 'none') {
        menu.style.display = 'none';
        var arrow = document.getElementById('theme-custom-arrow');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
      }
    });
  },

  render() {
    var s = window.store.getState().settings || {};
    var showSecurity = s.enableExperimental;

    // ⚠ AN ICON PER ITEM, AND THE LIST IS BUILT FROM ONE ARRAY. Eight bare words in a
    // 240px rail is a list you have to READ; an icon column is one you can SCAN, and
    // it is the last thing in this modal that did not have one. The array also makes
    // the Security item's condition a property rather than a string concatenation
    // spliced into the middle of the markup.
    //
    // ⚠ The inline styles are gone — the layer owns `.settings-tab` outright now, so
    // the active state is a class and there is no second writer left to fight it.
    var navItems = [
      { tab: 'account', icon: 'sliders-horizontal', label: window.LocalSendPanel.text('通用','通用','General') },
      { tab: 'appearance', icon: 'palette', label: window.I18n.t('s2') },
      { tab: 'security', icon: 'shield', label: window.I18n.t('s6'), experimental: true },
      { tab: 'advanced', icon: 'sliders-horizontal', label: window.orbitAPI.dbGetSetting('locallink.transport','localsend')==='localsend'?(window.I18n.locale==='en'?'Diagnostics':window.I18n.locale==='zh-Hans'?'诊断':'診斷'):window.I18n.t('s7') },
      { tab: 'about', icon: 'info', label: window.I18n.t('s8') }
    ].filter(function (it) { return !it.experimental || showSecurity; }).map(function (it) {
      return '<button class="settings-tab' + (it.tab === 'account' ? ' active' : '') + '" data-tab="' + it.tab + '">' +
        '<i data-lucide="' + it.icon + '"></i><span>' + it.label + '</span></button>';
    }).join('');

    this.container.innerHTML =
      '<div class="ll-settings-window" role="dialog" aria-modal="true" aria-labelledby="settings-heading" style="width:800px;height:600px;background:var(--bg-surface);border-radius:var(--radius-lg);display:flex;overflow:hidden;box-shadow:var(--shadow-xl);border:1px solid var(--border-subtle);">' +
        '<div style="width:240px;background:var(--bg-base);padding:24px;border-right:1px solid var(--border-subtle);display:flex;flex-direction:column;">' +
          // ⚠ The heading and the collapse control share a row, so the h2 is no longer
          // a DIRECT child of the rail — the layer's selector for it moved with it.
          '<div class="settings-rail-head">' +
            '<h2 id="settings-heading" style="font-family:var(--font-display);font-size:20px;margin-bottom:24px;color:var(--text-primary);font-weight:bold;"><span data-i18n="s0">Settings</span></h2>' +
            // ⚠ Rendered ALWAYS and hidden by `_syncNavToggle` when the redesign is off.
            // Deciding it here would read `OrbitRedesign` during init, and init runs on
            // DOMContentLoaded — before the settings are hydrated and, on some load
            // orders, before app.js has defined the object. That is the same trap the
            // gallery's view mode fell into.
            '<button id="settings-nav-toggle" class="settings-rail-toggle" type="button" title="Collapse to icons">' +
              '<i data-lucide="chevrons-left"></i>' +
            '</button>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
            navItems +
          '</div>' +
          '<div style="flex:1;"></div>' +
        '</div>' +
        '<div id="settings-content" style="flex:1;padding:32px;overflow-y:auto;background:var(--bg-surface);"></div>' +
        '<button type="button" id="btn-close-settings" class="ll-dialog-close" aria-label="' + window.I18n.t('s9') + '" title="' + window.I18n.t('s9') + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>' +
      '</div>';
    // ⚠⚠ THE NAV'S ICONS HAVE TO BE CONVERTED HERE, AND THEY NEVER WERE. `render()`
    // writes `<i data-lucide="…">` into the rail and then called only `attachEvents()`;
    // every one of the eight `createIcons` calls in this file is scoped to
    // `#settings-content`, so the RAIL was never converted by anything in this file.
    // The icons appeared on first load only because app.js runs a global
    // `lucide.createIcons()` at boot — which happens to sweep whatever is in the DOM at
    // that moment.
    //
    // ⚠⚠ So any RE-RENDER lost them, and the experimental-features toggle is a
    // re-render: turning it on made the Security item appear and every other icon
    // vanish. Dan reported it as "the security doesn't have an icon" — measured, ALL
    // EIGHT lose theirs. The item that just appeared is the one that looks guilty.
    if (window.lucide) window.lucide.createIcons({ root: this.container });
    this.attachEvents();
  },

  /**
   * Apply the collapsed-nav preference — and decide whether the control exists at all.
   *
   * ⚠⚠ CALLED FROM open() AS WELL AS attachEvents(). The modal renders ONCE, in
   * init(), which runs on DOMContentLoaded — BEFORE the settings are hydrated from the
   * database. A render-time read of `settingsNavCollapsed` therefore always sees the
   * default, which is exactly how the gallery's saved view mode came to look like it
   * never saved. open() is the first moment the value is real.
   */
  _syncNavToggle() {
    var btn = this.container && this.container.querySelector('#settings-nav-toggle');
    if (!btn) return;
    // ⚠ A REDESIGN-ONLY control. With the layer off there is no button and no class, so
    // the classic rail is always the full 240px. The rules that act on the class live
    // in the layer anyway, so this is belt and braces — but a control that visibly does
    // nothing is worse than one that is not there.
    var redesigned = !!(window.OrbitRedesign && window.OrbitRedesign.isOn());
    var collapsed = !!(window.store.getState().settings || {}).settingsNavCollapsed;
    btn.style.display = redesigned ? '' : 'none';
    this.container.classList.toggle('nav-collapsed', redesigned && collapsed);
    btn.title = collapsed ? 'Show labels' : 'Collapse to icons';
    // ⚠ Re-emitted rather than two stacked icons toggled by CSS: lucide replaces the
    // <i> with an <svg>, and whether a class on the <i> survives that is not something
    // to bet a control on.
    btn.innerHTML = '<i data-lucide="' + (collapsed ? 'chevrons-right' : 'chevrons-left') + '"></i>';
    if (window.lucide) window.lucide.createIcons({ root: btn });
  },

  attachEvents() {
    var self = this;
    var tabs = this.container.querySelectorAll('.settings-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function(e) {
        // ⚠ The class is the ONLY writer now. This used to also set `background` and
        // `color` inline on every tab — a second writer for a state the stylesheet
        // already owns, which is why every rule for `.settings-tab` in the layer needs
        // `!important` to be seen at all. It is one class toggle.
        tabs.forEach(function(t) { t.classList.remove('active'); });
        e.currentTarget.classList.add('active');
        self.renderTab(e.currentTarget.getAttribute('data-tab'));
      });
    });
    this.container.querySelector('#btn-close-settings').addEventListener('click', function() { self.close(); });

    // ⚠ The rail collapse. The STORE moves as well as the disk — persisting without it
    // is how the gallery's view mode came to be silently reverted by its own
    // subscription on the next settings change.
    var navToggle = this.container.querySelector('#settings-nav-toggle');
    if (navToggle) {
      navToggle.addEventListener('click', function() {
        // ⚠⚠ A RAIL COLLAPSE IS NOT AN APP-WIDE SETTINGS CHANGE, SO IT MUST NOT
        // TRAVEL THE APP-WIDE PATH. `setState({ settings })` notifies every
        // subscriber, and app.js's subscriber runs applySettings — which restarted
        // a document-wide `theme-transitioning` transition, rewrote the chat
        // wallpaper, the font size, a dozen root classes and the offline poller.
        // Dan: "it seems to refresh the whole app UI ??? (which it shouldn't cuz it
        // may lag some devices)". It did.
        //
        // The store still MOVES: the settings object is mutated in place, so a
        // later `Object.assign({}, state.settings, …)` from any other control
        // carries this value forward. That was the lesson from the gallery's view
        // mode — persisting to disk WITHOUT the store let the next settings change
        // silently revert it. Here the store holds it and nothing repaints.
        var live = window.store.getState().settings;
        if (!live) return;
        live.settingsNavCollapsed = !live.settingsNavCollapsed;
        if (window.Storage) window.Storage.set('settings', live);
        if (window.orbitAPI && window.orbitAPI.dbSetSetting) window.orbitAPI.dbSetSetting('settings', live);
        self._syncNavToggle();
      });
    }
    self._syncNavToggle();
  },

  renderGeneral() {
    this._stopNetworkMap();
    window.LocalLinkSelect.close();
    const content = this.container.querySelector('#settings-content');
    const draft = content.querySelector('#input-username');
    if (draft) this.accountDraft = draft.value;
    content.innerHTML = '<h3 class="ll-settings-title">' + window.LocalSendPanel.text('通用', '通用', 'General') + '</h3>';
    this.container.querySelectorAll('.settings-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === 'account');
    });
    // Render directly into attached sections so existing handlers keep their own scope.
    for (const name of ['network', 'account', 'notifications', 'data']) {
      const section = document.createElement('div');
      section.dataset.generalSection = name;
      if (name === 'data') section.style.paddingBottom = '20px';
      content.appendChild(section);
      this.renderTab(name, section);
      section.querySelector(':scope > h3')?.remove();
    }
    // Protocol switching is infrequent: keep it after everyday controls and backups.
    const transport = content.querySelector('#transport-mode')?.closest('section');
    if (transport) content.appendChild(transport);
    const first = content.querySelector('[data-general-section="network"] .ll-settings-card-head');
    if (first && window.orbitAPI.dbGetSetting('locallink.transport', 'localsend') === 'localsend') {
      first.innerHTML = '<i data-lucide="folder-down"></i>' + window.LocalSendPanel.text('接收與儲存', '接收与保存', 'Receiving and saving');
    }
    // Move the actual cards (and their bound handlers), preserving DOM/tab order.
    const languageCard = content.querySelector('#interface-language')?.closest('section');
    const receivingCard = content.querySelector('#ll-receive-path')?.closest('section');
    const accountSection = content.querySelector('[data-general-section="account"]');
    const networkSection = content.querySelector('[data-general-section="network"]');
    const heading = content.querySelector(':scope > h3');
    if (languageCard) heading.after(languageCard);
    if (receivingCard) languageCard.after(receivingCard);
    if (accountSection && networkSection) networkSection.before(accountSection);
    const t = window.LocalSendPanel.text;
    const behavior = document.createElement('section');
    behavior.className = 'll-settings-card';
    behavior.innerHTML = `<div class="ll-settings-card-head"><i data-lucide="app-window"></i>${t('視窗行為','窗口行为','Window behavior')}</div><div class="ll-settings-card-body"><label class="ll-setting-row" for="ll-run-in-background">${t('關閉視窗後在背景執行','关闭窗口后在后台运行','Keep running after closing the window')}<input id="ll-run-in-background" type="checkbox" role="switch" class="ll-switch" aria-describedby="ll-background-help"></label><p id="ll-background-help" class="ll-settings-copy">${t('關閉時，點擊 × 會完全退出程式，並中斷進行中的傳輸與通話。開啟後則縮小至系統匣，繼續接收檔案。','关闭时，点击 × 会完全退出程序，并中断进行中的传输与通话。开启后则隐藏到托盘，继续接收文件。','When off, × quits the app and interrupts active transfers and calls. When on, it hides to the system tray and keeps receiving files.')}</p></div>`;
    const background = behavior.querySelector('#ll-run-in-background');
    background.checked = window.orbitAPI.dbGetSetting('locallink.runInBackground', false) === true;
    background.onchange = () => window.orbitAPI.dbSetSetting('locallink.runInBackground', background.checked);
    const historyCard = content.querySelector('#ll-show-history')?.closest('section');
    if (historyCard) historyCard.after(behavior); else content.appendChild(behavior);
    const cacheRow=content.querySelector('.ll-cache-row');
    if(cacheRow)content.appendChild(cacheRow);
    window.lucide.createIcons({root: content});
    content.scrollTop = 0;
    this._syncNetworkMapTimer();
  },

  renderTab(tabName, target) {
    if (!target) this._stopNetworkMap();
    if(!target&&['account','network','notifications','data','general'].includes(tabName)){this.renderGeneral();return;}
    window.LocalLinkSelect.close();
    var content = target || this.container.querySelector('#settings-content');
    const nameDraft=content.querySelector('#input-username');if(nameDraft)this.accountDraft=nameDraft.value;
    const t = (...labels) => window.LocalSendPanel.text(...labels);
    const esc = window.Sanitize.escapeHtml;
    var state = window.store.getState();
    var user = state.currentUser;
    var experimentalBadge = '<span style="display:inline-block;font-size:8px;font-weight:700;color:#fff;background:var(--accent-warning);border-radius:3px;padding:1px 5px;text-transform:uppercase;line-height:1.4;vertical-align:middle;margin-left:6px;">EXPERIMENTAL</span>';
    // ⚠ Same pill, different word and colour, because it means something
    // different. "Experimental" says it might be unstable; "Beta" says it is
    // still changing but you can rely on it. The redesign is the second kind: it
    // ships alongside the old UI and keeps being improved, so it is not going to
    // be pulled out from under anyone.
    var betaBadge = '<span style="display:inline-block;font-size:8px;font-weight:700;color:#fff;background:var(--accent-primary);border-radius:3px;padding:1px 5px;text-transform:uppercase;line-height:1.4;vertical-align:middle;margin-left:6px;">BETA</span>';

    if (tabName === 'account') {
      content.innerHTML = `
        <h3 class="ll-settings-title">${t('本裝置','本设备','This device')}</h3>
        <section class="ll-settings-card">
          <div class="ll-settings-card-head"><i data-lucide="monitor-smartphone"></i>${t('裝置名稱','设备名称','Device name')}</div>
          <div class="ll-settings-card-body">
            <div class="ll-name-row"><input class="ll-field" id="input-username" aria-label="${t('裝置名稱','设备名称','Device name')}" maxlength="32"><button class="ll-primary-button" id="btn-save-account">${t('儲存','保存','Save')}</button></div>
            <p id="save-msg" role="status" class="ll-settings-copy" style="margin-bottom:0"></p>
          </div>
        </section>
        <section class="ll-settings-card"><div class="ll-settings-card-body ll-setting-row">
          <div><label for="interface-language">${t('介面語言','界面语言','Interface language')}</label></div>
          <select class="ll-field" id="interface-language"><option value="zh-Hant">繁體中文</option><option value="zh-Hans">简体中文</option><option value="en">English</option></select>
        </div></section>`;
      if (window.Identity.getAll().length > 1) {
        const legacy=document.createElement('button');
        legacy.textContent=t('查看舊身份記錄','查看旧身份记录','Previous identities');
        legacy.className='ll-field';legacy.onclick=()=>{this.close();window.AccountSwitcher.toggle();};content.appendChild(legacy);
      }
      const language=content.querySelector('#interface-language');
      language.value=window.I18n.locale;
      language.onchange=event=>{
        const draft=content.querySelector('#input-username').value;
        window.I18n.set(event.target.value);
        this.container.querySelector('#input-username').value=draft;
      };
      window.lucide.createIcons({root:content});
      content.querySelector('#input-username').value = this.accountDraft ?? user.username ?? '';
      content.querySelector('#btn-save-account').onclick = () => {
        const message = content.querySelector('#save-msg');
        try {
          window.Identity.update({username: content.querySelector('#input-username').value});
          this.accountDraft=null;
          message.style.color = 'var(--text-primary)';
          message.textContent = window.I18n.t('s19');
        } catch (error) {
          message.style.color = 'var(--accent-danger)';
          message.textContent = error.message;
        }
      };
    } else if (tabName === 'appearance' && window.orbitAPI.dbGetSetting('locallink.transport','localsend')==='localsend') {
      const settings=state.settings;
      const themes=[['dark',t('深色','深色','Dark')],['light',t('淺色','浅色','Light')],['system',t('跟隨系統','跟随系统','System')]];
      content.innerHTML=`<h3 class="ll-settings-title">${t('外觀','外观','Appearance')}</h3><section class="ll-settings-card"><div class="ll-settings-card-head">${t('主題','主题','Theme')}</div><div class="ll-settings-card-body"><div class="ll-setting-row">${themes.map(([value,label])=>'<label><input type="radio" name="theme" value="'+value+'" '+(settings.theme===value?'checked':'')+'> '+label+'</label>').join('')}</div><div class="ll-setting-row" style="margin-top:20px"><label for="ll-custom-theme">${t('配色','配色','Color theme')}</label><select id="ll-custom-theme"><option value="">${t('標準','标准','Standard')}</option><option value="dark-purple">${t('深紫','深紫','Dark purple')}</option><option value="midnight">${t('午夜','午夜','Midnight')}</option><option value="sunset">${t('日落','日落','Sunset')}</option><option value="seasonal">${t('四季','四季','Seasonal')}</option><option value="nord">${t('北歐','北欧','Nord')}</option></select></div></div></section><section class="ll-settings-card"><div class="ll-settings-card-body"><label class="ll-setting-row">${t('文字大小','文字大小','Text size')}<select id="ll-font"><option value="Small">${t('小','小','Small')}</option><option value="Medium">${t('中','中','Medium')}</option><option value="Large">${t('大','大','Large')}</option></select></label><label class="ll-setting-row" style="margin-top:20px">${t('介面縮放','界面缩放','Interface scale')}<input id="ll-scale" type="range" min="80" max="150" step="5"><output id="ll-scale-value"></output></label><label class="ll-setting-row" style="margin-top:20px">${t('減少動態效果','减少动态效果','Reduce motion')}<input id="ll-reduce-motion" type="checkbox" role="switch" class="ll-switch"></label></div></section>`;
      const update=(key,value)=>{const next={...window.store.getState().settings,[key]:value};window.store.setState({settings:next});window.Storage.set('settings',next);window.orbitAPI.dbSetSetting('settings',next);window.App?.applySettings(next);};
      content.querySelectorAll('[name="theme"]').forEach(input=>input.onchange=()=>update('theme',input.value));
      const custom=content.querySelector('#ll-custom-theme');custom.value=themes.some(([value])=>value===settings.theme)?'':settings.theme;custom.onchange=()=>update('theme',custom.value||'dark');
      const font=content.querySelector('#ll-font');font.value=settings.fontSize||'Medium';font.onchange=()=>update('fontSize',font.value);
      const scale=content.querySelector('#ll-scale');scale.value=settings.appZoom||100;content.querySelector('output').value=scale.value+'%';scale.oninput=()=>{content.querySelector('output').value=scale.value+'%';};scale.onchange=()=>update('appZoom',Number(scale.value));
      const motion=content.querySelector('#ll-reduce-motion');motion.checked=!!settings.reduceMotion;motion.onchange=()=>update('reduceMotion',motion.checked);
    } else if (tabName === 'appearance') {
      var s = state.settings;

      var defaultThemes = [
        { value: 'dark', icon: 'moon', label: window.I18n.t('s25') },
        { value: 'light', icon: 'sun', label: window.I18n.t('s26') },
        { value: 'system', icon: 'monitor', label: window.I18n.t('s27') }
      ];

      var customThemes = [
        { value: 'dark-purple', icon: 'palette', label: 'Dark Purple' },
        { value: 'midnight', icon: 'cloud-moon', label: 'Midnight' },
        { value: 'sunset', icon: 'sunset', label: 'Sunset' },
        { value: 'seasonal', icon: 'calendar', label: 'Seasonal' },
        { value: 'nord', icon: 'snowflake', label: 'Nord' }
      ];

      var isCustomTheme = customThemes.some(function(t) { return t.value === s.theme; });
      var currentCustom = customThemes.find(function(t) { return t.value === s.theme; });

      var themeBtnHtml = defaultThemes.map(function(t) {
        return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 12px;flex:1;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);transition:border-color 0.15s;' + (s.theme === t.value ? 'border-color:var(--accent-primary);' : '') + '">' +
          '<input type="radio" name="theme" value="' + t.value + '" ' + (s.theme === t.value ? 'checked' : '') + ' style="accent-color:var(--accent-primary);">' +
          '<i data-lucide="' + t.icon + '" style="width:14px;height:14px;color:var(--text-muted);flex-shrink:0;"></i>' +
          '<span style="font-size:12px;color:var(--text-primary);">' + t.label + '</span>' +
        '</label>';
      }).join('');

      var customDropdownHtml =
        '<div style="position:relative;">' +
          '<button id="theme-custom-trigger" style="display:flex;align-items:center;gap:6px;width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);font-size:12px;cursor:pointer;outline:none;' + (isCustomTheme ? 'border-color:var(--accent-primary);' : '') + '">' +
            '<i data-lucide="' + (currentCustom ? currentCustom.icon : 'palette') + '" style="width:14px;height:14px;color:var(--text-muted);flex-shrink:0;"></i>' +
            '<span style="flex:1;text-align:left;">' + (currentCustom ? currentCustom.label : 'Custom') + '</span>' +
            '<i data-lucide="chevron-down" id="theme-custom-arrow" style="width:12px;height:12px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</button>' +
          '<div id="theme-custom-menu" style="display:none;position:absolute;top:calc(100% + 4px);left:0;width:100%;background:var(--bg-surface);border:1px solid var(--border-strong);border-radius:8px;box-shadow:var(--shadow-lg);z-index:200;overflow:hidden;">' +
            customThemes.map(function(opt) {
              return '<button class="theme-custom-option" data-value="' + opt.value + '" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;background:transparent;border:none;color:var(--text-primary);font-size:13px;cursor:pointer;text-align:left;transition:background 0.1s;' + (opt.value === s.theme ? 'background:var(--bg-hover);' : '') + '">' +
                '<i data-lucide="' + opt.icon + '" style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0;"></i>' +
                '<span>' + opt.label + '</span>' +
                (opt.value === s.theme ? '<i data-lucide="check" style="width:14px;height:14px;color:var(--accent-primary);margin-left:auto;"></i>' : '') +
              '</button>';
            }).join('') +
          '</div>' +
        '</div>';

      content.innerHTML =
        '<h3 style="font-family:var(--font-display);font-size:24px;margin-bottom:24px;"><span data-i18n="s2">Appearance</span></h3>' +

        // ⚠ The "Look" card that used to sit here — and FIRST in this tab — has
        // moved to Advanced → Experimental Features, with a BETA badge. The
        // redesign is not a one-off: it ships alongside the old UI and keeps being
        // improved, so switching between them is a beta feature rather than a
        // first-class appearance choice. Its markup and its change handler moved
        // together; the handler now lives in the advanced branch below.

        // Section: Theme
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:visible;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="palette" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + t("主題","主题","Theme") + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="padding:16px;display:block;">' +
            '<div style="display:flex;gap:8px;margin-bottom:8px;">' + themeBtnHtml + '</div>' +
            customDropdownHtml +
            (s.enableCustomColors
              ? '<button id="theme-custom-colors-btn" style="display:flex;align-items:center;gap:6px;width:100%;padding:8px 12px;margin-top:8px;border-radius:8px;border:1px dashed var(--border-subtle);background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;text-align:center;justify-content:center;transition:border-color 0.15s,color 0.15s;">' +
                '<i data-lucide="palette" style="width:14px;height:14px;"></i>' +
                '<span>' + t("自訂配色","自定义配色","Custom Colors") + '</span>' + experimentalBadge +
              '</button>'
              : '') +
            // A way BACK to the saved custom colours. Applying in the editor sets
            // theme='custom', but nothing in this list offered that value — so
            // choosing any other theme dropped you out of your own colours with no
            // route back except reopening the editor and pressing Apply again.
            ((s.enableCustomColors && s.customThemeColors && Object.keys(s.customThemeColors).length)
              ? '<button id="theme-use-custom-btn" style="display:flex;align-items:center;gap:6px;width:100%;padding:8px 12px;margin-top:6px;border-radius:8px;border:1px solid ' + (s.theme === 'custom' ? 'var(--accent-primary)' : 'var(--border-subtle)') + ';background:var(--bg-base);color:var(--text-primary);font-size:12px;cursor:pointer;justify-content:center;transition:border-color 0.15s;">' +
                '<i data-lucide="check" style="width:14px;height:14px;' + (s.theme === 'custom' ? 'color:var(--accent-primary);' : 'color:var(--text-muted);') + '"></i>' +
                '<span>' + (s.theme === 'custom' ? 'Using your custom colors' : 'Use your custom colors') + '</span>' +
              '</button>'
              : '') +
            '<label style="display:flex;align-items:center;gap:12px;font-size:14px;color:var(--text-primary);cursor:pointer;margin-top:16px;padding-top:12px;border-top:1px solid var(--border-subtle);">' +
              '<input id="set-24h" type="checkbox" '+(s.timeFormat24?'checked':'')+'>' +
              '<div><div>24-hour Time</div><div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + t("使用 24 小時制顯示時間","使用 24 小时制显示时间","Show timestamps in 24-hour format") + '</div></div>' +
            '</label>' +
          '</div>' +
        '</div>' +
        
        // Section: Text & Layout
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="type" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + t("文字與版面","文字与布局","Text & Layout") + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="padding:16px;display:block;">' +
            '<div style="margin-bottom:16px;">' +
              '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">' + t("文字大小","文字大小","Font Size") + '</label>' +
              '<select id="set-font" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);outline:none;font-size:13px;">' +
                '<option '+(s.fontSize==='Small'?'selected':'')+'>Small</option><option '+(s.fontSize==='Medium'?'selected':'')+'>Medium</option><option '+(s.fontSize==='Large'?'selected':'')+'>Large</option>' +
              '</select>' +
            '</div>' +
            '<div style="margin-bottom:16px;">' +
              '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">' + t("訊息氣泡","消息气泡","Message Bubbles") + '</label>' +
              '<select id="set-bubbles" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);outline:none;font-size:13px;">' +
                '<option '+(s.messageBubbles==='Modern'?'selected':'')+'>Modern (Rounded)</option><option '+(s.messageBubbles==='Compact'?'selected':'')+'>Compact (Square)</option>' +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label for="set-zoom" style="display:block;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">' + t("介面縮放","界面缩放","App Zoom") + '</label>' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="font-size:11px;color:var(--text-muted);">80%</span>' +
                '<input id="set-zoom" type="range" min="80" max="150" value="'+s.appZoom+'" style="flex:1;accent-color:var(--accent-primary);">' +
                '<span style="font-size:11px;color:var(--text-muted);">150%</span>' +
              '</div>' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">' +
                '<span id="zoom-val-label" style="font-size:13px;font-weight:600;color:var(--accent-primary);">' + s.appZoom + '%</span>' +
                '<span style="font-size:11px;color:var(--text-muted);">(restart required)</span>' +
              '</div>' +
              '<div id="zoom-preview" style="margin-top:10px;border:1px solid var(--border-subtle);border-radius:8px;overflow:hidden;background:var(--bg-base);">' +
                '<div style="padding:8px 10px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border-subtle);background:var(--bg-surface);">' +
                  '<div style="width:20px;height:20px;border-radius:50%;background:var(--accent-primary);display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:600;">O</div>' +
                  '<div style="flex:1;height:6px;border-radius:3px;background:var(--border-subtle);"></div>' +
                  '<div style="width:16px;height:16px;border-radius:4px;background:var(--border-subtle);"></div>' +
                '</div>' +
                '<div style="padding:10px;display:flex;gap:8px;align-items:flex-start;">' +
                  '<div style="width:24px;height:24px;border-radius:50%;background:var(--border-subtle);flex-shrink:0;"></div>' +
                  '<div style="flex:1;">' +
                    '<div style="height:6px;width:60%;border-radius:3px;background:var(--border-subtle);margin-bottom:4px;"></div>' +
                    '<div style="height:24px;border-radius:4px;background:var(--accent-primary);opacity:0.15;"></div>' +
                  '</div>' +
                '</div>' +
                '<div id="zoom-preview-scale" style="display:flex;align-items:center;justify-content:center;gap:4px;padding:6px;border-top:1px solid var(--border-subtle);font-size:10px;color:var(--text-muted);">' +
                  '<i data-lucide="search" style="width:10px;height:10px;"></i>' +
                  '<span id="zoom-preview-label">' + s.appZoom + '%</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-subtle);">' +
              '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:10px;">' + t("側邊欄按鈕","侧边栏按钮","Sidebar Buttons") + '</label>' +
              '<div style="display:flex;flex-direction:column;gap:8px;">' +
                '<label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-primary);cursor:pointer;">' +
                  '<input type="checkbox" class="sidebar-btn-toggle" data-btn="activity" '+(s.sidebarButtons&&s.sidebarButtons.activity!==false?'checked':'')+'>' +
                  '<i data-lucide="bell" style="width:14px;height:14px;color:var(--text-muted);"></i>' +
                  '<span>' + t("活動中心","活动中心","Activity Center") + '</span>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-primary);cursor:pointer;">' +
                  '<input type="checkbox" class="sidebar-btn-toggle" data-btn="gallery" '+(s.sidebarButtons&&s.sidebarButtons.gallery!==false?'checked':'')+'>' +
                  '<i data-lucide="archive" style="width:14px;height:14px;color:var(--text-muted);"></i>' +
                  '<span>' + t("圖庫","图库","Gallery") + '</span>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-primary);cursor:pointer;">' +
                  '<input type="checkbox" class="sidebar-btn-toggle" data-btn="storage" '+(s.sidebarButtons&&s.sidebarButtons.storage!==false?'checked':'')+'>' +
                  '<i data-lucide="hard-drive" style="width:14px;height:14px;color:var(--text-muted);"></i>' +
                  '<span>' + t("儲存空間","存储空间","Storage") + '</span>' +
                '</label>' +
              '</div>' +
            '</div>' +
          '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-subtle);">' +
            '<label style="display:flex;align-items:center;gap:12px;font-size:14px;color:var(--text-primary);cursor:pointer;">' +
              '<input id="set-translate" type="checkbox" '+(s.messageTranslate||s.experimentalMessageTranslate?'checked':'')+'>' +
              '<div><div>' + t("訊息翻譯","消息翻译","Message Translation") + '</div><div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + t("使用 MyMemory API 翻譯訊息","使用 MyMemory API 翻译消息","Show a translate button on messages via MyMemory API") + '</div></div>' +
            '</label>' +
            '<div id="translate-options" style="' + ((s.messageTranslate || s.experimentalMessageTranslate) ? '' : 'display:none;') + '">' +
              '<div style="margin-top:12px;">' +
                '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">' + t("翻譯為","翻译为","Translate to") + '</label>' +
                '<select id="set-translate-lang" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);outline:none;font-size:13px;">' +
                  '<option value="" '+(s.translateTargetLang===''?'selected':'')+'>Auto (browser language)</option>' +
                  '<option value="en" '+(s.translateTargetLang==='en'?'selected':'')+'>English</option>' +
                  '<option value="vi" '+(s.translateTargetLang==='vi'?'selected':'')+'>Vietnamese</option>' +
                  '<option value="es" '+(s.translateTargetLang==='es'?'selected':'')+'>Spanish</option>' +
                  '<option value="fr" '+(s.translateTargetLang==='fr'?'selected':'')+'>French</option>' +
                  '<option value="de" '+(s.translateTargetLang==='de'?'selected':'')+'>German</option>' +
                  '<option value="it" '+(s.translateTargetLang==='it'?'selected':'')+'>Italian</option>' +
                  '<option value="pt" '+(s.translateTargetLang==='pt'?'selected':'')+'>Portuguese</option>' +
                  '<option value="ru" '+(s.translateTargetLang==='ru'?'selected':'')+'>Russian</option>' +
                  '<option value="zh-CN" '+(s.translateTargetLang==='zh-CN'?'selected':'')+'>Chinese (Simplified)</option>' +
                  '<option value="zh-TW" '+(s.translateTargetLang==='zh-TW'?'selected':'')+'>Chinese (Traditional)</option>' +
                  '<option value="ja" '+(s.translateTargetLang==='ja'?'selected':'')+'>Japanese</option>' +
                  '<option value="ko" '+(s.translateTargetLang==='ko'?'selected':'')+'>Korean</option>' +
                  '<option value="ar" '+(s.translateTargetLang==='ar'?'selected':'')+'>Arabic</option>' +
                  '<option value="hi" '+(s.translateTargetLang==='hi'?'selected':'')+'>Hindi</option>' +
                  '<option value="tr" '+(s.translateTargetLang==='tr'?'selected':'')+'>Turkish</option>' +
                  '<option value="nl" '+(s.translateTargetLang==='nl'?'selected':'')+'>Dutch</option>' +
                  '<option value="pl" '+(s.translateTargetLang==='pl'?'selected':'')+'>Polish</option>' +
                  '<option value="sv" '+(s.translateTargetLang==='sv'?'selected':'')+'>Swedish</option>' +
                  '<option value="th" '+(s.translateTargetLang==='th'?'selected':'')+'>Thai</option>' +
                  '<option value="id" '+(s.translateTargetLang==='id'?'selected':'')+'>Indonesian</option>' +
                  '<option value="el" '+(s.translateTargetLang==='el'?'selected':'')+'>Greek</option>' +
                  '<option value="cs" '+(s.translateTargetLang==='cs'?'selected':'')+'>Czech</option>' +
                  '<option value="ro" '+(s.translateTargetLang==='ro'?'selected':'')+'>Romanian</option>' +
                  '<option value="uk" '+(s.translateTargetLang==='uk'?'selected':'')+'>Ukrainian</option>' +
                  '<option value="hu" '+(s.translateTargetLang==='hu'?'selected':'')+'>Hungarian</option>' +
                  '<option value="he" '+(s.translateTargetLang==='he'?'selected':'')+'>Hebrew</option>' +
                  '<option value="da" '+(s.translateTargetLang==='da'?'selected':'')+'>Danish</option>' +
                  '<option value="fi" '+(s.translateTargetLang==='fi'?'selected':'')+'>Finnish</option>' +
                  '<option value="no" '+(s.translateTargetLang==='no'?'selected':'')+'>Norwegian</option>' +
                  '<option value="ms" '+(s.translateTargetLang==='ms'?'selected':'')+'>Malay</option>' +
                '</select>' +
              '</div>' +
              '<label style="display:flex;align-items:center;gap:12px;font-size:14px;color:var(--text-primary);cursor:pointer;margin-top:12px;">' +
                '<input id="set-translate-autodetect" type="checkbox" '+(s.autoDetectSource?'checked':'')+'>' +
                '<div><div>' + t("自動偵測原文語言","自动检测原文语言","Auto-detect Source Language") + '</div><div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + t("自動偵測訊息語言","自动检测消息语言","Detect message language instead of assuming English") + '</div></div>' +
              '</label>' +
            '</div>' +
          '</div>' +
          '</div>' +
        '</div>' +

        // Section: Animation
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="sparkles" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + t("動態效果","动画","Animation") + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="padding:16px;display:none;">' +
            '<div style="display:flex;flex-direction:column;gap:12px;">' +
              '<div style="display:flex;align-items:center;gap:12px;">' +
                '<label style="font-size:13px;color:var(--text-primary);min-width:90px;">' + t("速度","速度","Speed") + '</label>' +
                '<select id="set-anim-speed" style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);outline:none;font-size:13px;">' +
                  '<option value="slow"'+(s.animSpeed==='slow'?' selected':'')+'>Slow</option>' +
                  '<option value="normal"'+(s.animSpeed==='normal'?' selected':'')+'>Normal</option>' +
                  '<option value="fast"'+(s.animSpeed==='fast'?' selected':'')+'>Fast</option>' +
                '</select>' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:12px;">' +
                '<label style="font-size:13px;color:var(--text-primary);min-width:90px;">' + t("訊息","消息","Messages") + '</label>' +
                '<select id="set-msg-anim" style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);outline:none;font-size:13px;">' +
                  '<option value="slide"'+(s.messageAnim==='slide'?' selected':'')+'>Slide</option>' +
                  '<option value="fade"'+(s.messageAnim==='fade'?' selected':'')+'>Fade</option>' +
                  '<option value="instant"'+(s.messageAnim==='instant'?' selected':'')+'>Instant</option>' +
                '</select>' +
              '</div>' +
              '<div style="border-top:1px solid var(--border-subtle);padding-top:12px;">' +
                '<label style="display:flex;align-items:center;gap:12px;font-size:14px;color:var(--text-primary);cursor:pointer;">' +
                  '<input id="set-anim" type="checkbox" '+(s.animations===false?'':'checked')+'>' +
                  '<div><div>' + t("介面動態效果","界面动画","UI Animations") + '</div><div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + t("啟用轉場及動態效果","启用过渡和动画效果","Enable animated transitions and effects") + '</div></div>' +
                '</label>' +
              '</div>' +
              '<div>' +
                '<label style="display:flex;align-items:center;gap:12px;font-size:14px;color:var(--text-primary);cursor:pointer;">' +
                  '<input id="set-reduce-motion" type="checkbox" '+(s.reduceMotion?'checked':'')+'>' +
                   '<div><div>' + t("減少動態效果","减少动态效果","Reduce Motion") + '</div><div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + t("停用動畫、GIF 預覽及頭像特效","停用动画、GIF 预览和头像特效","Disable animations, freeze GIF previews, and stop avatar effects") + '</div></div>' +
                '</label>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Section: Save/Load Themes
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="download" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + t("儲存與載入主題","保存与加载主题","Save/Load Themes") + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="padding:16px;display:none;">' +
            '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;line-height:1.4;">' + t("匯出目前主題或匯入已儲存的主題。","导出当前主题或导入已保存的主题。","Export your current theme settings to a file or import a previously saved theme.") + '</div>' +
            '<div id="save-load-theme-buttons" style="display:flex;align-items:center;gap:8px;margin-top:8px;">' +
              '<button id="btn-export-theme" style="padding:10px 20px;border-radius:10px;background:var(--accent-primary);color:white;border:none;cursor:pointer;font-weight:600;font-size:13px;">' + t("匯出主題","导出主题","Export Theme") + '</button>' +
              '<button id="btn-import-theme" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);cursor:pointer;font-weight:500;font-size:13px;">' + t("匯入主題","导入主题","Import Theme") + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Section: Chat
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="message-square" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + t("對話","会话","Chat") + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="padding:16px;display:none;">' +
            '<div style="margin-bottom:16px;">' +
              '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">' + t("對話背景","会话背景","Chat Wallpaper") + '</label>' +
              '<div style="display:flex;align-items:center;gap:12px;">' +
                '<button id="btn-upload-wallpaper" style="padding:8px 12px;background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);cursor:pointer;font-size:13px;font-weight:500;"><i data-lucide="image" style="width:14px;height:14px;margin-right:6px;vertical-align:middle;"></i>' + t("選擇圖片","选择图片","Choose Image") + '</button>' +
                (s.chatWallpaper ? '<button id="btn-clear-wallpaper" style="padding:8px 12px;background:transparent;border:none;color:var(--accent-danger);cursor:pointer;font-size:13px;font-weight:500;">' + t("移除","移除","Remove") + '</button>' : '') +
              '</div>' +
              (s.chatWallpaper ? '<div style="margin-top:8px;font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + window.Sanitize.escapeHtml(s.chatWallpaper) + '">' + t("已套用自訂背景","已应用自定义背景","Custom wallpaper applied") + '</div>' : '') +
            '</div>' +
            '<div style="margin-bottom:16px;">' +
              '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">' + t("背景圖樣","背景图案","Background Pattern") + '</label>' +
              '<select id="set-pattern" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);outline:none;font-size:13px;">' +
                '<option '+(s.bgPattern==='None'?'selected':'')+'>None</option><option '+(s.bgPattern==='Dots'?'selected':'')+'>Dots</option><option '+(s.bgPattern==='Grid'?'selected':'')+'>Grid</option><option '+(s.bgPattern==='Diagonal Stripes'?'selected':'')+'>Diagonal Stripes</option><option '+(s.bgPattern==='Crosshatch'?'selected':'')+'>Crosshatch</option><option '+(s.bgPattern==='Circles'?'selected':'')+'>Circles</option>' +
              '</select>' +
            '</div>' +
            '<label style="display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 0;border-top:1px solid var(--border-subtle);">' +
              '<input id="set-enter-send" type="checkbox" '+(s.enterToSend!==false?'checked':'')+' style="accent-color:var(--accent-primary);">' +
              '<div><div>' + t("按 Enter 傳送","按 Enter 发送","Enter to Send") + '</div><div style="font-size:11px;color:var(--text-muted);font-weight:400;">' + t("Enter 傳送，Shift+Enter 換行","Enter 发送，Shift+Enter 换行","Press Enter to send, Shift+Enter for new line") + '</div></div>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 0;border-top:1px solid var(--border-subtle);">' +
              '<input id="set-chat-avatars" type="checkbox" '+(s.showChatAvatars!==false?'checked':'')+' style="accent-color:var(--accent-primary);">' +
              '<div><div>' + t("顯示頭像","显示头像","Show Avatars") + '</div><div style="font-size:11px;color:var(--text-muted);font-weight:400;">' + t("在訊息旁顯示頭像","在消息旁显示头像","Display user avatars next to messages") + '</div></div>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 0;border-top:1px solid var(--border-subtle);">' +
              '<input id="set-group-created" type="checkbox" '+(s.showGroupCreated!==false?'checked':'')+' style="accent-color:var(--accent-primary);">' +
              '<div><div>' + t("顯示群組建立日期","显示群组创建日期","Show Group Created Date") + '</div><div style="font-size:11px;color:var(--text-muted);font-weight:400;">' + t("在群組資訊中顯示建立日期","在群组信息中显示创建日期","Show when a group was created in its info") + '</div></div>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 0;border-top:1px solid var(--border-subtle);">' +
              '<input id="set-image-previews" type="checkbox" '+(s.showImagePreviews!==false?'checked':'')+' style="accent-color:var(--accent-primary);">' +
              '<div><div>' + t("圖片預覽","图片预览","Image Previews") + '</div><div style="font-size:11px;color:var(--text-muted);font-weight:400;">' + t("在對話中預覽圖片","在会话中预览图片","Show inline image previews in chat") + '</div></div>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 0;border-top:1px solid var(--border-subtle);">' +
              '<input id="set-link-previews" type="checkbox" '+(s.showLinkPreviews!==false?'checked':'')+' style="accent-color:var(--accent-primary);">' +
              '<div><div>' + t("連結預覽","链接预览","Link Previews") + '</div><div style="font-size:11px;color:var(--text-muted);font-weight:400;">' + t("預覽分享的連結","预览分享的链接","Show rich previews for shared links") + '</div></div>' +
            '</label>' +
            // ⚠ THE DESKTOP NEVER HAD THIS ROW; THE MOBILE DID, and it belongs with
            // the other message-appearance toggles rather than under Text & Layout.
            // ⚠ A CHECKBOX, not the `.orbit-switch` — this section is all checkboxes,
            // and a lone toggle among them reads as a different kind of control.
            // The rule lives in components.css, so it does something in BOTH UIs.
            '<label style="display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 0;border-top:1px solid var(--border-subtle);">' +
              '<input id="set-classic-bubbles" type="checkbox" '+(s.classicBubbles===true?'checked':'')+' style="accent-color:var(--accent-primary);">' +
              '<div><div>' + t("經典氣泡","经典气泡","Classic Bubbles") + '</div><div style="font-size:11px;color:var(--text-muted);font-weight:400;">' + t("用強調色顯示自己傳送的訊息","用强调色显示自己发送的消息","Colour your own messages with the accent") + '</div></div>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 0;border-top:1px solid var(--border-subtle);">' +
              '<input id="set-compact-spacing" type="checkbox" '+(s.experimentalCompactSpacing?'checked':'')+' style="accent-color:var(--accent-primary);">' +
              '<div><div>' + t("緊湊間距","紧凑间距","Compact Spacing") + '</div><div style="font-size:11px;color:var(--text-muted);font-weight:400;">' + t("減少訊息之間的空白","减少消息之间的空白","Tighter message layout with reduced padding") + '</div></div>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 0;border-top:1px solid var(--border-subtle);">' +
              '<input id="set-swipe-reply" type="checkbox" '+(s.swipeToReply!==false?'checked':'')+' style="accent-color:var(--accent-primary);">' +
              '<div><div>' + t("滑動回覆","滑动回复","Swipe to Reply") + '</div><div style="font-size:11px;color:var(--text-muted);font-weight:400;">' + t("向左滑動或拖曳訊息以回覆","向左滑动或拖动消息以回复","Swipe or drag left on a message to reply") + '</div></div>' +
            '</label>' +
          '</div>' +
        '</div>';

      if (window.lucide) window.lucide.createIcons({ root: content });

      var updateSettings = function(key, val) {
        // Record undo/redo action
        if (window.UndoManager && !window.UndoManager._paused) {
          var _oldVal = window.store.getState().settings[key];
          var _key = key;
          var _newVal = val;
          if (_oldVal !== _newVal) {
            window.UndoManager.pushAction('Change ' + _key, function() {
              var s = { ...window.store.getState().settings };
              s[_key] = _oldVal;
              window.store.setState({ settings: s });
              window.Storage.set('settings', s);
              if (window.App && window.App.applySettings) window.App.applySettings(s);
            }, function() {
              var s = { ...window.store.getState().settings };
              s[_key] = _newVal;
              window.store.setState({ settings: s });
              window.Storage.set('settings', s);
              if (window.App && window.App.applySettings) window.App.applySettings(s);
            });
          }
        }
        var beforeSettings = window.store.getState().settings;
        var newSettings = { ...beforeSettings };
        newSettings[key] = val;
        window.store.setState({ settings: newSettings });
        window.Storage.set('settings', newSettings);
        
        if (window.App && window.App.applySettings) {
          window.App.applySettings(newSettings);
        }

        // Tell my other devices, if anything on the whitelist actually moved. worthSending()
        // compares the BUILT payloads rather than the settings objects, so a change to a key
        // outside the whitelist costs nothing and a keystroke in a colour field does not send a
        // packet per character.
        if (window.OrbitSettingsSync && window.OrbitSettingsSync.worthSending(beforeSettings, newSettings)) {
          window.store.broadcastSettings(newSettings);
        }

        // Sync profileFrame to currentUser for beacon broadcast
        if (key === 'profileFrame') {
          var cu = window.store.getState().currentUser;
          if (cu) {
            var updated = { ...cu, profileFrame: val || null };
            window.store.setState({ currentUser: updated });
            if (window.orbitAPI) window.orbitAPI.dbSaveUser(updated);
          }
        }
      };

      content.querySelectorAll('input[name="theme"]').forEach(function(radio) {
        radio.addEventListener('change', function(e) {
          if (e.target.checked) {
            updateSettings('theme', e.target.value);
            content.querySelectorAll('input[name="theme"]').forEach(function(r) {
              r.parentElement.style.borderColor = 'var(--border-subtle)';
            });
            e.target.parentElement.style.borderColor = 'var(--accent-primary)';
            if (window.SettingsModal) window.SettingsModal.renderTab('appearance');
          }
        });
      });

      content.querySelector('#theme-custom-trigger').addEventListener('click', function(e) {
        e.stopPropagation();
        var menu = content.querySelector('#theme-custom-menu');
        var arrow = content.querySelector('#theme-custom-arrow');
        var isOpen = menu.style.display !== 'none';
        menu.style.display = isOpen ? 'none' : 'block';
        if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
      });

      content.querySelectorAll('.theme-custom-option').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var val = btn.dataset.value;
          updateSettings('theme', val);
          if (window.SettingsModal) window.SettingsModal.renderTab('appearance');
        });
      });

      var customColorsBtn = content.querySelector('#theme-custom-colors-btn');
      if (customColorsBtn) {
        customColorsBtn.addEventListener('click', function() {
          if (window.CustomThemeModal) window.CustomThemeModal.open();
        });
      }

      var useCustomBtn = content.querySelector('#theme-use-custom-btn');
      if (useCustomBtn) {
        useCustomBtn.addEventListener('click', function() {
          updateSettings('theme', 'custom');
          if (window.SettingsModal) window.SettingsModal.renderTab('appearance');
        });
      }

      content.querySelector('#set-font').addEventListener('change', function(e) { updateSettings('fontSize', e.target.value); });
      content.querySelector('#set-bubbles').addEventListener('change', function(e) { updateSettings('messageBubbles', e.target.value.split(' ')[0]); });
      content.querySelector('#set-zoom').addEventListener('input', function(e) {
        var val = e.target.value;
        document.getElementById('zoom-val-label').textContent = val + '%';
        var scaleEl = document.getElementById('zoom-preview-label');
        if (scaleEl) scaleEl.textContent = val + '%';
        var preview = document.getElementById('zoom-preview');
        if (preview) preview.style.transform = 'scale(' + (val / 100) + ')';
      });
      content.querySelector('#set-zoom').addEventListener('change', function(e) {
        var val = parseInt(e.target.value);
        updateSettings('appZoom', val);
        if (window.Toast) {
          window.Toast.show('Zoom Changed', 'Restart the app to apply the new zoom level.', 'info', 5000);
        }
      });
      content.querySelector('#set-anim-speed').addEventListener('change', function(e) { updateSettings('animSpeed', e.target.value); });
      content.querySelector('#set-anim').addEventListener('change', function(e) { updateSettings('animations', e.target.checked); });
      content.querySelector('#set-reduce-motion').addEventListener('change', function(e) { updateSettings('reduceMotion', e.target.checked); });
      content.querySelector('#set-classic-bubbles').addEventListener('change', function(e) { updateSettings('classicBubbles', e.target.checked); });
      content.querySelector('#set-msg-anim').addEventListener('change', function(e) { updateSettings('messageAnim', e.target.value); });
      content.querySelector('#set-24h').addEventListener('change', function(e) { updateSettings('timeFormat24', e.target.checked); });

      // ⚠ The look toggle's handler moved with its markup — it is in the advanced
      // branch now, under Experimental Features. Look for `#set-new-ui` there; it
      // is not an Appearance control any more.
      content.querySelector('#set-translate').addEventListener('change', function(e) {
        updateSettings('messageTranslate', e.target.checked);
        updateSettings('experimentalMessageTranslate', e.target.checked);
        var opts = content.querySelector('#translate-options');
        if (opts) opts.style.display = e.target.checked ? '' : 'none';
      });
      content.querySelector('#set-translate-lang').addEventListener('change', function(e) {
        updateSettings('translateTargetLang', e.target.value);
      });
      content.querySelector('#set-translate-autodetect').addEventListener('change', function(e) {
        updateSettings('autoDetectSource', e.target.checked);
      });
      var uploadBtn = content.querySelector('#btn-upload-wallpaper');
      if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
          var input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/png, image/jpeg, image/webp, image/gif';
          input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(evt) {
              updateSettings('chatWallpaper', evt.target.result);
              if (window.SettingsModal) window.SettingsModal.renderTab('appearance');
            };
            reader.readAsDataURL(file);
          };
          input.click();
        });
      }
      var clearBtn = content.querySelector('#btn-clear-wallpaper');
      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          updateSettings('chatWallpaper', null);
          if (window.SettingsModal) window.SettingsModal.renderTab('appearance');
        });
      }

      content.querySelector('#set-pattern').addEventListener('change', function(e) { updateSettings('bgPattern', e.target.value); });
      content.querySelector('#set-enter-send').addEventListener('change', function(e) { updateSettings('enterToSend', e.target.checked); });
      content.querySelector('#set-chat-avatars').addEventListener('change', function(e) { updateSettings('showChatAvatars', e.target.checked); });
      if (content.querySelector('#set-group-created')) {
        content.querySelector('#set-group-created').addEventListener('change', function(e) { updateSettings('showGroupCreated', e.target.checked); });
      }
      content.querySelector('#set-image-previews').addEventListener('change', function(e) { updateSettings('showImagePreviews', e.target.checked); });
      content.querySelector('#set-link-previews').addEventListener('change', function(e) { updateSettings('showLinkPreviews', e.target.checked); });
      content.querySelector('#set-compact-spacing').addEventListener('change', function(e) { updateSettings('experimentalCompactSpacing', e.target.checked); });
      content.querySelector('#set-swipe-reply').addEventListener('change', function(e) { updateSettings('swipeToReply', e.target.checked); });
      content.querySelectorAll('.sidebar-btn-toggle').forEach(function(cb) {
        cb.addEventListener('change', function(e) {
          var btns = Object.assign({}, window.store.getState().settings.sidebarButtons || {});
          btns[e.target.dataset.btn] = e.target.checked;
          updateSettings('sidebarButtons', btns);
          if (window.SidebarLeft) { window.SidebarLeft.render(); window.SidebarLeft.attachEvents(); window.SidebarLeft.renderAvatar(window.store.getState().currentUser); }
        });
      });

      // Export Theme
      content.querySelector('#btn-export-theme').addEventListener('click', function() {
        var s = window.store.getState().settings || {};
        var themeData = {
          theme: s.theme || 'auto',
          messageBubbles: s.messageBubbles || 'Modern',
          fontSize: s.fontSize || 'Medium',
          animations: s.animations !== false,
          animSpeed: s.animSpeed || 'normal',
          reduceMotion: s.reduceMotion || false,
          timeFormat24: s.timeFormat24 || false,
          messageAnim: s.messageAnim || 'slide',
          bgPattern: s.bgPattern || 'None',
          appZoom: s.appZoom || 100,
          chatWallpaper: s.chatWallpaper || null,
          sidebarButtons: s.sidebarButtons || null,
          customColors: s.customColors || null
        };
        var blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'orbit-theme.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      // Import Theme
      content.querySelector('#btn-import-theme').addEventListener('click', function() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
          var file = e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function(evt) {
            try {
              var themeData = JSON.parse(evt.target.result);
              var validKeys = ['theme', 'messageBubbles', 'fontSize', 'animations', 'animSpeed', 'reduceMotion', 'noFlashbang', 'timeFormat24', 'messageAnim', 'bgPattern', 'appZoom', 'chatWallpaper', 'sidebarButtons', 'customColors'];
              validKeys.forEach(function(key) {
                if (key in themeData) {
                  updateSettings(key, themeData[key]);
                }
              });
              if (window.Toast) window.Toast.show('Theme Imported', 'Theme settings applied successfully.');
              if (window.SettingsModal) window.SettingsModal.renderTab('appearance');
            } catch(err) {
              if (window.Toast) window.Toast.show('Import Error', 'Invalid theme file: ' + err.message);
            }
          };
          reader.readAsText(file);
        };
        input.click();
      });
      
    } else if (tabName === 'data' && window.orbitAPI.dbGetSetting('locallink.transport','localsend') === 'localsend') {
      content.innerHTML=`<h3 class="ll-settings-title">${t('傳輸記錄與備份','传输记录与备份','History and backup')}</h3>

        <section class="ll-settings-card"><div class="ll-settings-card-head"><i data-lucide="archive"></i>${t('檔案備份','文件备份','File backup')}</div><div class="ll-settings-card-body"><div class="ll-setting-row"><span>${t('傳輸記錄','传输记录','Transfer history')}</span><button id="ll-show-history">${t('查看全部記錄','查看全部记录','View all records')}</button></div><p class="ll-settings-copy">${t('備份記錄，或連同原檔案一起匯出。不包含本裝置身分。','备份记录，或连同原文件一起导出。不包含本设备身份。','Export records, optionally with original files. Device identity is excluded.')}</p><div class="ll-file-actions"><button id="ll-export-records">${t('僅記錄','仅记录','Records only')}</button><button id="ll-export-files">${t('記錄與原檔案','记录与原文件','Records and files')}</button><button id="ll-import-records">${t('匯入備份','导入备份','Import backup')}</button></div><p id="ll-backup-result" role="status"></p></div></section>`;
      content.querySelector('#ll-show-history').onclick=()=>window.LocalSendPanel.history();
      const cacheRow=document.createElement('div');
      cacheRow.className='ll-setting-row ll-cache-row';
      cacheRow.innerHTML=`<span>${t('可清理的傳送快取','可清理的发送缓存','Reclaimable send cache')} · <output>…</output></span><button class="ll-primary-button">${t('清理快取','清理缓存','Clear cache')}</button>`;
      content.appendChild(cacheRow);
      const clean=cacheRow.querySelector('button'),size=cacheRow.querySelector('output');
      async function refreshCacheSize(){
        clean.disabled=true;
        try{
          const {bytes,count,active,retained}=await window.orbitAPI.invoke('locallink-sent-cache-size');
          const units=['B','KB','MB','GB','TB'];
          const index=Math.min(units.length-1,Math.floor(Math.log10(Math.max(1,bytes))/3));
          size.textContent=(bytes/1000**index).toLocaleString(undefined,{maximumFractionDigits:1})+' '+units[index];
          if(active)size.textContent+=' · '+t('傳送中','发送中','Sending')+' '+window.LocalSendPanel.size(active);
          if(retained)size.textContent+=' · '+t('保留供重試','保留供重试','Retained for retry')+' '+window.LocalSendPanel.size(retained);
          clean.disabled=count===0;
        }catch{size.textContent=t('無法讀取','无法读取','Unavailable');clean.disabled=false;}
      }
      refreshCacheSize();
      clean.onclick=async()=>{
        clean.disabled=true;
        try{
          const result=await window.orbitAPI.invoke('locallink-clean-sent-cache');
          if(!result.cancelled)window.Toast?.show('LocalLink',result.error||(t('已清理：','已清理：','Cleaned: ')+result.count),result.ok?'success':'error');
        }finally{await refreshCacheSize();}
      };

      const backup=async(channel,arg)=>{
        const buttons=[...content.querySelectorAll('.ll-file-actions button')];buttons.forEach(b=>b.disabled=true);
        const message=content.querySelector('#ll-backup-result');message.textContent=t('處理中…','处理中…','Working…');
        try{const result=await window.orbitAPI.invoke(channel,arg);message.textContent=result.error||(result.ok?t('完成','完成','Completed')+' · '+result.count+' · '+result.path+(result.missing?' · '+t('已略過的原檔案','已跳过的原文件','Skipped originals')+' ('+result.missing+'): '+result.skipped.join(', '):''):'');}
        catch(error){message.textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}
      };
      content.querySelector('#ll-export-records').onclick=()=>backup('locallink-export-transfers',false);
      content.querySelector('#ll-export-files').onclick=()=>backup('locallink-export-transfers',true);
      content.querySelector('#ll-import-records').onclick=()=>backup('locallink-import-transfers');
    } else if (tabName === 'network' && window.orbitAPI.dbGetSetting('locallink.transport','localsend') === 'localsend') {
      content.innerHTML=`<h3 class="ll-settings-title">${t('網路','网络','Network')}</h3>
        <section class="ll-settings-card"><div class="ll-settings-card-head"><i data-lucide="wifi"></i>${t('區域網路傳輸','局域网传输','Local network transfer')}</div>
        <div class="ll-settings-card-body"><dl class="ll-about-facts">
          <div><dt>${t('接收方式','接收方式','Receiving')}</dt><dd>${t('配對授權自動接收，其餘逐次確認','配对授权自动接收，其余逐次确认','Authorized paired devices receive automatically; otherwise ask')}</dd></div>
        </dl>${[['ll-receive',t('儲存位置','保存位置','Save location'),'ll-choose-directory'],['ll-update',t('更新套件資料夾','更新包文件夹','Update package folder'),'ll-update-choose']].map(([id,label,choose])=>`<form class="ll-path-form"><label for="${id}-path">${label}</label><input id="${id}-path" required spellcheck="false">${id==='ll-update'?'<small>'+t('自動使用 LocalLink Updates 子資料夾','自动使用 LocalLink Updates 子文件夹','Uses the LocalLink Updates subfolder')+'</small>':''}<div class="ll-file-actions"><button type="button" id="${choose}">${t('變更資料夾','更改目录','Change folder')}</button><button type="submit" hidden>${t('儲存','保存','Save')}</button></div></form>`).join('')}
        <details class="ll-folder-tools"><summary>${t('更多操作','更多操作','More actions')}</summary><div class="ll-file-actions"><button id="ll-update-reset">${t('還原更新資料夾','恢复默认更新目录','Reset update folder')}</button><button id="ll-open-directory">${t('開啟資料夾','打开目录','Open folder')}</button><button id="ll-rediscover">${t('重新搜尋','重新搜索','Discover again')}</button></div></details><p id="ll-network-result" role="status"></p></div></section>`;
      const receivingCard=content.querySelector('#ll-receive-path').closest('section');
      const showResult=result=>{if(!receivingCard.isConnected)return;if(result.path)setPath(receivingCard.querySelector('#ll-receive-path'),result.path);receivingCard.querySelector('#ll-network-result').textContent=result.error||'';};
      const receiveOptions=document.createElement('section');receiveOptions.className='ll-settings-card ll-receive-options';receiveOptions.innerHTML=`<div class="ll-settings-card-head"><i data-lucide="folder-check"></i>${t('接收選項','接收选项','Receiving options')}</div><div class="ll-settings-card-body"><p class="ll-settings-copy">${t('接收成功後，檔案會自動儲存在上方資料夾內。','接收成功后，文件会自动保存在上方文件夹内。','Accepted files are saved automatically inside the folder above.')}</p><label class="ll-setting-row" for="ll-open-after-receive">${t('完成後開啟所在資料夾','完成后打开所在文件夹','Open containing folder when complete')}<input id="ll-open-after-receive" type="checkbox" role="switch" class="ll-switch"></label></div>`;content.appendChild(receiveOptions);
      const bandwidth = window.orbitAPI.dbGetSetting('locallink.bandwidth', {upload:0,download:0});
      const speedCard = document.createElement('section');
      speedCard.className = 'll-settings-card';
      const speedOptions = value => [...new Set([0,1,5,10,25,50,100,Number(value)||0])].sort((a,b)=>a-b).map(n =>
        `<option value="${n}" ${n===Number(value||0)?'selected':''}>${n ? n+' MB/s' : t('不限速','不限速','Unlimited')}</option>`).join('');
      speedCard.innerHTML = `<div class="ll-settings-card-head"><i data-lucide="gauge"></i>${t('傳輸限速','传输限速','Transfer speed limits')}</div>
        <div class="ll-settings-card-body">
          <label class="ll-setting-row" for="ll-upload-limit">${t('傳送上限','发送上限','Upload limit')}<select id="ll-upload-limit">${speedOptions(bandwidth.upload)}</select></label>
          <label class="ll-setting-row" for="ll-download-limit">${t('接收上限','接收上限','Download limit')}<select id="ll-download-limit">${speedOptions(bandwidth.download)}</select></label>
          <p class="ll-settings-copy">${t('立即生效，同方向的所有檔案傳輸共用上限。1 MB/s = 8 Mbps；接收限速可能有短暫緩衝突波。','立即生效，同方向的所有文件传输共享上限。1 MB/s = 8 Mbps；接收限速可能有短暂缓冲突发。','Applies immediately across file transfers in each direction. 1 MB/s = 8 Mbps. Receive buffering may cause brief bursts.')}</p>
        </div>`;
      content.insertBefore(speedCard, receiveOptions.nextSibling);
      const saveBandwidth = () => window.orbitAPI.dbSetSetting('locallink.bandwidth', {
        upload:Number(content.querySelector('#ll-upload-limit').value),
        download:Number(content.querySelector('#ll-download-limit').value)
      });
      content.querySelector('#ll-upload-limit').onchange = saveBandwidth;
      content.querySelector('#ll-download-limit').onchange = saveBandwidth;
      const thresholdRow=document.createElement('label');
      thresholdRow.className='ll-setting-row';
      thresholdRow.innerHTML=`<span>${t('大檔案接收確認門檻','大文件确认阈值','Large transfer confirmation threshold')}</span><span class="ll-size-field"><input id="ll-large-transfer-limit" type="number" min="0.01" step="0.01" required><span>GB</span></span>`;
      receiveOptions.querySelector('.ll-settings-card-body').append(thresholdRow);
      const waitRow=document.createElement('label');waitRow.className='ll-setting-row';
      waitRow.innerHTML=`<span>${t('等待接收確認','等待接收确认','Wait for confirmation')}</span><select>${[0,1,5,15,60].map(n=>'<option value="'+n+'">'+(n?n+' '+t('分鐘','分钟','min'):t('不限時','不限时','No timeout'))+'</option>').join('')}</select>`;
      thresholdRow.after(waitRow);
      const waitSelect=waitRow.querySelector('select');
      waitSelect.value=window.orbitAPI.dbGetSetting('locallink.receiptMinutes',0);
      waitSelect.onchange=()=>window.orbitAPI.dbSetSetting('locallink.receiptMinutes',Number(waitSelect.value));
      const limitInput=thresholdRow.querySelector('input');
      limitInput.value=window.orbitAPI.dbGetSetting('locallink.largeTransferGB',window.orbitAPI.dbGetSetting('locallink.largeTransferGiB',10));
      limitInput.onchange=()=>{
        if(!limitInput.reportValidity()){limitInput.value=window.orbitAPI.dbGetSetting('locallink.largeTransferGB',window.orbitAPI.dbGetSetting('locallink.largeTransferGiB',10));return;}
        window.orbitAPI.dbSetSetting('locallink.largeTransferGB',limitInput.valueAsNumber);
      };
      const openAfter=content.querySelector('#ll-open-after-receive');openAfter.checked=window.orbitAPI.dbGetSetting('locallink.openAfterReceive',false);openAfter.onchange=()=>window.orbitAPI.dbSetSetting('locallink.openAfterReceive',openAfter.checked);
      window.orbitAPI.invoke('locallink-storage').then(showResult);
      const receiveInput=receivingCard.querySelector('#ll-receive-path'),updateInput=receivingCard.querySelector('#ll-update-path');
      function setPath(input,path){
        input.value=input.defaultValue=path;
        input.form.querySelector('[type=submit]').hidden=true;
      }
      for(const input of [receiveInput,updateInput]){
        input.oninput=()=>{input.form.querySelector('[type=submit]').hidden=input.value===input.defaultValue;};
      }
      receiveInput.form.onsubmit=async e=>{e.preventDefault();showResult(await window.orbitAPI.invoke('locallink-choose-directory',receiveInput.value));};
      async function updateFolder(action){
        try{setPath(updateInput,await window.orbitAPI.invoke('locallink-update-folder',action));showResult({});}
        catch{showResult({error:t('請輸入可寫入的完整路徑。','请输入可写入的完整路径。','Enter a writable absolute folder path.')});}
      }
      updateInput.form.onsubmit=e=>{e.preventDefault();updateFolder({path:updateInput.value});};
      receivingCard.querySelector('#ll-update-choose').onclick=()=>updateFolder('choose');
      receivingCard.querySelector('#ll-update-reset').onclick=()=>updateFolder('reset');
      updateFolder('get');
      content.querySelector('#ll-choose-directory').onclick=()=>window.orbitAPI.invoke('locallink-choose-directory').then(showResult);
      content.querySelector('#ll-open-directory').onclick=()=>window.orbitAPI.invoke('locallink-open-directory').then(showResult);
      const manageTrust=document.createElement('button');manageTrust.type='button';manageTrust.id='ll-manage-trusted';manageTrust.textContent=t('管理可信裝置','管理可信设备','Manage trusted devices');manageTrust.onclick=()=>window.LocalLinkDevices.manageTrusted();receivingCard.querySelector('#ll-rediscover').parentElement.appendChild(manageTrust);
      content.querySelector('#ll-rediscover').onclick=async()=>{
        window.orbitAPI.networkStart(window.store.getState().currentUser);
        const result=await window.orbitAPI.invoke('locallink-rediscover');showResult(result);
        if(result.ok&&receivingCard.isConnected)receivingCard.querySelector('#ll-network-result').textContent=t('已重新搜尋','已重新搜索','Discovery restarted');
      };
    } else if (tabName === 'network') {
      var n = state.networkSettings;
      var peerCount = state.friends ? state.friends.filter(function(f) { return f.status === 'online'; }).length : 0;
      var totalPeers = state.friends ? state.friends.length : 0;
      var groupCount = state.groups ? state.groups.length : 0;

      var collapsible = function(title, icon, bodyHtml, open) {
        return '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="' + icon + '" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + title + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="display:' + (open ? 'block' : 'none') + ';">' +
            '<div style="padding:4px 16px 16px;">' + bodyHtml + '</div>' +
          '</div>' +
        '</div>';
      };

      var selectRow = function(id, label, opts, current) {
        var html = '<div style="padding:8px 0 4px;"><label for="' + id + '" style="display:block;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:8px;">' + label + '</label>' +
          '<select id="' + id + '" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-primary);font-size:13px;outline:none;cursor:pointer;">';
        for (var i = 0; i < opts.length; i++) {
          html += '<option value="' + opts[i].val + '"' + (String(current) === String(opts[i].val) ? ' selected' : '') + '>' + opts[i].label + '</option>';
        }
        html += '</select></div>';
        return html;
      };

      var inputRow = function(id, label, val, unit) {
        return '<div style="padding:8px 0 4px;"><label for="' + id + '" style="display:block;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:8px;">' + label + '</label>' +
          '<div style="display:flex;align-items:center;gap:8px;"><input id="' + id + '" type="number" value="' + val + '" style="flex:1;padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-primary);font-size:13px;outline:none;">' +
          (unit ? '<span style="font-size:12px;color:var(--text-muted);min-width:30px;">' + unit + '</span>' : '') +
          '</div></div>';
      };

      var toggleRow = function(id, label, desc, checked) {
        return '<label style="display:flex;align-items:center;gap:12px;padding:10px 0;font-size:14px;color:var(--text-primary);cursor:pointer;">' +
          '<input id="' + id + '" type="checkbox" ' + (checked ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--accent-primary);cursor:pointer;">' +
          '<div><div>' + label + '</div>' + (desc ? '<div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + desc + '</div>' : '') + '</div></label>';
      };

      content.innerHTML =
        '<h3 style="font-family:var(--font-display);font-size:24px;margin-bottom:24px;"><span data-i18n="s3">Network</span></h3>' +

        // Dashboard
        '<div style="margin-bottom:20px;">' +
          '<h4 style="font-size:14px;font-weight:600;color:var(--text-primary);margin:0 0 12px;">' + t("概況","概况","Dashboard") + '</h4>' +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px;">' +
            '<div style="padding:14px;background:var(--bg-base);border-radius:10px;text-align:center;border:1px solid var(--border-subtle);">' +
              '<div style="font-size:26px;font-weight:700;color:var(--accent-success);">' + peerCount + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + t("線上裝置","在线设备","Online Peers") + '</div>' +
            '</div>' +
            '<div style="padding:14px;background:var(--bg-base);border-radius:10px;text-align:center;border:1px solid var(--border-subtle);">' +
              '<div style="font-size:26px;font-weight:700;color:var(--accent-primary);">' + totalPeers + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + t("已儲存裝置","已保存设备","Total Friends") + '</div>' +
            '</div>' +
            '<div style="padding:14px;background:var(--bg-base);border-radius:10px;text-align:center;border:1px solid var(--border-subtle);">' +
              '<div style="font-size:26px;font-weight:700;color:var(--accent-warning);">' + groupCount + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;"><span data-i18n="s11">Groups</span></div>' +
            '</div>' +
            '<div style="padding:14px;background:var(--bg-base);border-radius:10px;text-align:center;border:1px solid var(--border-subtle);">' +
              '<div style="font-size:26px;font-weight:700;' + (n.mode === 'LAN Auto-Discovery' ? 'color:var(--text-primary);' : 'color:var(--accent-primary);') + '">' + (n.mode === 'LAN Auto-Discovery' ? 'LAN' : 'Custom') + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + t("連線模式","连接模式","Network Mode") + '</div>' +
            '</div>' +
          '</div>' +
          // Peer list
          '<div style="padding:12px 14px;background:var(--bg-base);border-radius:10px;border:1px solid var(--border-subtle);">' +
            '<div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:8px;">' + t("線上裝置","在线设备","Online Peers") + '</div>' +
            (peerCount === 0
              ? '<div style="display:flex;flex-direction:column;align-items:center;padding:16px 0;color:var(--text-muted);gap:8px;"><i data-lucide="radio" style="width:28px;height:28px;opacity:0.3;"></i><div style="font-size:13px;">' + t("沒有線上裝置","没有在线设备","No peers online") + '</div></div>'
              : '<div style="display:flex;flex-direction:column;gap:5px;">' + state.friends.filter(function(f) { return f.status === 'online'; }).map(function(f) {
                return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:var(--bg-surface);">' +
                  // ⚠ `var(--presence-online)`, not a hardcoded #22c55e — that hex was
                  // the third copy of the presence palette and the one that ignored the
                  // theme outright. See the note on --presence-* in variables.css.
                  // The glyph rather than a bare dot, so this row and the chat header
                  // say "online" the same way.
                  window.OrbitPresence.glyph('online', 10) +
                  '<span style="font-size:13px;color:var(--text-primary);flex:1;">' + window.Sanitize.escapeHtml(f.username) + '</span>' +
                  '<span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">' + (f.ip || '') + '</span>' +
                '</div>';
              }).join('') + '</div>'
            ) +
          '</div>' +
        '</div>' +

        // Network Map Visualizer
        collapsible('Network Map', 'share-2',
          '<div style="text-align:center;font-size:12px;color:var(--text-muted);margin-bottom:8px;">' + t("已連接裝置的互動檢視","已连接设备的交互视图","Interactive view of connected peers") + '</div>' +
          '<div id="network-map-container" style="width:100%;height:240px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border-subtle);position:relative;overflow:hidden;">' +
            '<canvas id="network-map-canvas" style="width:100%;height:100%;"></canvas>' +
          '</div>',
          false
        ) +

        // Settings sections
        '<h4 style="font-size:14px;font-weight:600;color:var(--text-primary);margin:0 0 12px;"><span data-i18n="s0">Settings</span></h4>' +

        // Connection
        collapsible('Connection', 'cable', 
          selectRow('net-mode', 'Network Mode', [{val:'LAN Auto-Discovery',label:'LAN Auto-Discovery'},{val:'Custom IP',label:'Custom IP'}], n.mode) +
          selectRow('net-timeout', 'Connection Timeout', [{val:5,label:'5 seconds'},{val:10,label:'10 seconds'},{val:30,label:'30 seconds'},{val:60,label:'60 seconds'}], n.netTimeout) +
          selectRow('net-keepalive', 'Keep-Alive Interval', [{val:10,label:'10 seconds'},{val:30,label:'30 seconds'},{val:60,label:'60 seconds'},{val:120,label:'2 minutes'}], n.netKeepAlive) +
          toggleRow('net-reconnect', 'Auto-Reconnect', 'Automatically retry connection on disconnect', n.netAutoReconnect) +
          '<div id="net-reconnect-opts" style="padding:0 0 8px 24px;display:' + (n.netAutoReconnect ? 'block' : 'none') + ';">' +
            inputRow('net-reconnect-interval', 'Reconnect Interval', n.netReconnectInterval, 's') +
          '</div>' +
          // ⚠⚠ GATED ON CONSENT — see the change handler below. Off unless someone
          // opted in, because it is the one setting that can put traffic through a
          // relay, and the Terms and Privacy Policy describe what that means.
          toggleRow('net-nat', 'NAT Traversal', 'Reach friends outside your network. Asks you to accept the Terms and Privacy Policy first.', n.natEnabled) +
          // ⚠ THE RELAY IS A FIELD, NOT A CONSTANT. Who introduces your connections is a
          // privacy decision, and hard-coding somebody else's server would make it for
          // them. Empty means "no relay" — the LAN path needs none.
          inputRow('net-relay', 'Signalling Relay', n.natRelayUrl || 'ws://127.0.0.1:8787') +
          // ⚠ THE MOST COMMON "IT DOESN'T WORK" IS AN UNREACHABLE RELAY, and there is no way
          // to tell that apart from a friend who is simply offline. One button turns it into
          // a self-serve answer instead of a support message.
          '<div style="display:flex;align-items:center;gap:10px;margin:-4px 0 12px;padding-left:2px;">' +
            '<button id="net-relay-test" style="padding:5px 12px;border-radius:7px;border:1px solid var(--border-subtle);' +
              'background:transparent;color:var(--text-secondary);font-size:11px;font-weight:600;cursor:pointer;">' + t("測試中繼","测试中继","Test relay") + '</button>' +
            '<span id="net-relay-status" style="font-size:11px;color:var(--text-muted);"></span>' +
          '</div>',
          true
        ) +

        // Ports & Transfer
        collapsible('Ports & Transfer', 'server',
          inputRow('net-udp', 'UDP Discovery Port', n.udpPort) +
          inputRow('net-tcp', 'TCP Connection Port', n.tcpPort) +
          inputRow('net-size', 'Max File Transfer Size', n.maxFileSize, 'MB') +
          '<div style="border-top:1px solid var(--border-subtle);margin:8px 0;"></div>' +
          inputRow('net-bandwidth', 'Bandwidth Limit', n.netBandwidthLimit, 'KB/s') +
          '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + t("設為 0 表示不限速","设为 0 表示不限速","Set to 0 for unlimited transfer speed") + '</div>',
          false
        ) +

        // Advanced
        collapsible(window.I18n.t('s7'), 'settings-2',
          toggleRow('net-rtc', 'Enable WebRTC Fallback', 'Use WebRTC when direct connection fails', n.webrtcFallback) +
          selectRow('net-log', 'Connection Log Level', [{val:'None',label:'None'},{val:'Error',label:'Error'},{val:'Info',label:'Info'},{val:'Debug',label:'Debug'}], n.logLevel) +
          '<div style="padding-top:8px;"><button id="net-clear" style="padding:10px 24px;background:transparent;color:var(--accent-danger);border-radius:8px;border:1px solid var(--accent-danger);font-weight:600;cursor:pointer;width:fit-content;">' + t("清除網路快取","清除网络缓存","Clear Network Cache") + '</button></div>',
          false
        );

      if (window.lucide) window.lucide.createIcons({ root: content });

      var canvasContainer = content.querySelector('#network-map-container');
      if (canvasContainer) {
        var ro = new ResizeObserver(function(entries) {
          if (entries[0].contentRect.width > 0) {
            var canvas = content.querySelector('#network-map-canvas');
            if (!canvas) return;
            // Backing store sized at devicePixelRatio; draw in CSS px via setTransform
            var dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(entries[0].contentRect.width * dpr);
            canvas.height = Math.round(entries[0].contentRect.height * dpr);
            window.SettingsModal._mapDpr = dpr;
            window.SettingsModal._drawNetworkMap();
          }
        });
        this._mapResizeObserver?.disconnect();
        this._mapResizeObserver = ro;
        ro.observe(canvasContainer);
      }

      var updateNetwork = function(key, val) {
        var newNet = { ...window.store.getState().networkSettings };
        newNet[key] = val;
        window.store.setState({ networkSettings: newNet });
        window.Storage.set('networkSettings', newNet);
      };

      content.querySelector('#net-mode').addEventListener('change', function(e) { updateNetwork('mode', e.target.value); });
      content.querySelector('#net-udp').addEventListener('change', function(e) { updateNetwork('udpPort', parseInt(e.target.value) || 45678); });
      content.querySelector('#net-tcp').addEventListener('change', function(e) { updateNetwork('tcpPort', parseInt(e.target.value) || 46000); });
      content.querySelector('#net-size').addEventListener('change', function(e) { updateNetwork('maxFileSize', parseInt(e.target.value) || 500); });
      content.querySelector('#net-rtc').addEventListener('change', function(e) { updateNetwork('webrtcFallback', e.target.checked); });
      content.querySelector('#net-log').addEventListener('change', function(e) { updateNetwork('logLevel', e.target.value); });
      content.querySelector('#net-clear').addEventListener('click', function(e) {
         var btn = e.target;
         btn.textContent = 'Clearing...';
         btn.disabled = true;
         // Reset discovery and socket connections via IPC
         if (window.orbitAPI) {
           var user = window.store ? window.store.getState().currentUser : null;
           if (user) window.orbitAPI.networkStart(user);
         }
         setTimeout(function() {
           btn.textContent = 'Clear Network Cache';
           btn.disabled = false;
           if (window.Toast) window.Toast.show('Network cache cleared', 'info');
         }, 1500);
      });
      content.querySelector('#net-timeout').addEventListener('change', function(e) { updateNetwork('netTimeout', parseInt(e.target.value, 10) || 30); });
      content.querySelector('#net-keepalive').addEventListener('change', function(e) { updateNetwork('netKeepAlive', parseInt(e.target.value, 10) || 30); });

      // ⚠⚠ NAT IS GATED ON CONSENT, AND THE SWITCH DOES NOT FLIP UNTIL THE USER AGREES.
      // Reverting it first and only committing on "I agree" matters: a checkbox that
      // turns on and then asks has already recorded consent nobody gave, and if the
      // user dismisses the dialog the setting would be left on by accident.
      content.querySelector('#net-relay').addEventListener('change', function(e) {
        updateNetwork('natRelayUrl', String(e.target.value || '').trim());
      });

      // ⚠ Opens a real socket to the relay and reports what happened. It is not a ping —
      // a relay that accepts the connection but refuses the join would look healthy here and
      // still fail in use, so this says "reachable", not "working".
      content.querySelector('#net-relay-test').addEventListener('click', function() {
        var status = content.querySelector('#net-relay-status');
        var url = String((content.querySelector('#net-relay') || {}).value || '').trim();
        if (!url) { status.textContent = 'No relay set — LAN only.'; return; }
        if (!/^wss?:\/\//i.test(url)) { status.textContent = 'Needs ws:// or wss://'; status.style.color = 'var(--accent-warning)'; return; }
        status.textContent = 'Testing\u2026';
        status.style.color = 'var(--text-muted)';
        var settled = false;
        var socket;
        try { socket = new WebSocket(url); } catch (err) {
          status.textContent = 'Unreachable — ' + err.message;
          status.style.color = 'var(--accent-danger)';
          return;
        }
        var finish = function (text, colour) {
          if (settled) return;
          settled = true;
          status.textContent = text;
          status.style.color = colour;
          try { socket.close(); } catch (e) {}
        };
        var timer = setTimeout(function () { finish('No answer after 6s.', 'var(--accent-warning)'); }, 6000);
        socket.onopen = function () { clearTimeout(timer); finish('Reachable.', 'var(--accent-success)'); };
        socket.onerror = function () { clearTimeout(timer); finish('Unreachable — check the address and that the relay is running.', 'var(--accent-danger)'); };
      });

      content.querySelector('#net-nat').addEventListener('change', function(e) {
        var el = e.target;
        if (!el.checked) { updateNetwork('natEnabled', false); return; }

        el.checked = false;
        if (!window.OrbitLegal) { updateNetwork('natEnabled', true); el.checked = true; return; }

        var net = window.store.getState().networkSettings || {};
        if (!window.OrbitLegal.needsConsent(net)) {
          updateNetwork('natEnabled', true);
          el.checked = true;
          return;
        }

        window.OrbitLegal.openConsent().then(function(agreed) {
          if (!agreed) return;   // stays off
          updateNetwork('natConsentTermsVersion', window.OrbitLegal.TERMS_VERSION);
          updateNetwork('natConsentPrivacyVersion', window.OrbitLegal.PRIVACY_VERSION);
          updateNetwork('natEnabled', true);
          el.checked = true;
        });
      });

      content.querySelector('#net-reconnect').addEventListener('change', function(e) {
        updateNetwork('netAutoReconnect', e.target.checked);
        var opts = content.querySelector('#net-reconnect-opts');
        if (opts) opts.style.display = e.target.checked ? 'block' : 'none';
        if (window.orbitAPI && window.orbitAPI.networkSetReconnect) {
          window.orbitAPI.networkSetReconnect(e.target.checked);
        }
      });
      content.querySelector('#net-reconnect-interval').addEventListener('change', function(e) {
        var val = parseInt(e.target.value, 10) || 10;
        updateNetwork('netReconnectInterval', val);
        if (window.orbitAPI && window.orbitAPI.networkSetReconnect) {
          var enabled = document.querySelector('#net-reconnect')?.checked ?? true;
          window.orbitAPI.networkSetReconnect(enabled, val * 1000);
        }
      });
      content.querySelector('#net-bandwidth').addEventListener('change', function(e) { updateNetwork('netBandwidthLimit', parseInt(e.target.value, 10) || 0); });
    } else if (tabName === 'notifications' && window.orbitAPI.dbGetSetting('locallink.transport','localsend') === 'localsend') {
      content.innerHTML=`<h3 class="ll-settings-title">${t('通知','通知','Notifications')}</h3><section class="ll-settings-card"><div class="ll-settings-card-body"><label class="ll-setting-row" for="ll-transfer-notifications">${t('傳輸結果通知','传输结果通知','Transfer result notifications')}<input id="ll-transfer-notifications" type="checkbox" role="switch" class="ll-switch"></label></div></section>`;
      const input=content.querySelector('input');input.checked=window.orbitAPI.dbGetSetting('locallink.transferNotifications',true);
      input.onchange=()=>window.orbitAPI.dbSetSetting('locallink.transferNotifications',input.checked);
    } else if (tabName === 'notifications') {
      var s = state.settings;
      var dndActive = s.notifyDnd;

      content.innerHTML =
        '<h3 style="font-family:var(--font-display);font-size:24px;margin-bottom:24px;"><span data-i18n="s4">Notifications</span></h3>' +

        // DND status banner
        (dndActive
          ? '<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;margin-bottom:16px;">' +
              '<i data-lucide="moon" style="width:18px;height:18px;color:#ef4444;flex-shrink:0;"></i>' +
              '<span style="font-size:13px;color:#ef4444;font-weight:500;">' + t("已啟用勿擾，所有通知均已靜音。","已启用勿扰，所有通知均已静音。","Do Not Disturb is enabled — all notifications are muted.") + '</span>' +
            '</div>'
          : ''
        ) +

        // Section: General
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="bell" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + t("一般","常规","General") + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="display:block;">' +
            '<div style="padding:4px 16px 16px;">' +
              '<label style="display:flex;align-items:center;gap:12px;padding:12px 0;font-size:14px;color:var(--text-primary);cursor:pointer;border-bottom:1px solid var(--border-subtle);">' +
                '<input id="notify-preview" type="checkbox" '+(s.notifyPreview?'checked':'')+'>' +
                '<div><div>' + t("訊息預覽","消息预览","Message Previews") + '</div><div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + t("在通知中顯示訊息內容","在通知中显示消息内容","Show message content in notification toasts") + '</div></div>' +
              '</label>' +
              '<label style="display:flex;align-items:center;gap:12px;padding:12px 0;font-size:14px;color:var(--text-primary);cursor:pointer;">' +
                '<input id="notify-dnd" type="checkbox" '+(s.notifyDnd?'checked':'')+'>' +
                '<div><div>' + t("勿擾模式","勿扰模式","Do Not Disturb") + '</div><div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + t("關閉所有通知音效與提示","关闭所有通知音效和提示","Mute all notification sounds and toasts") + '</div></div>' +
              '</label>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Section: Group Notifications
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="users-round" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);"><span data-i18n="s11">Groups</span></span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="display:none;">' +
            '<div style="padding:4px 16px 16px;">' +
              '<label style="display:flex;align-items:center;gap:12px;padding:12px 0;font-size:14px;color:var(--text-primary);cursor:pointer;">' +
                '<input id="notify-mentions" type="checkbox" '+(s.notifyGroupMentions?'checked':'')+'>' +
                '<div><div>@Mentions Only</div><div style="font-size:12px;color:var(--text-muted);font-weight:400;">Only receive notifications when you\'re @mentioned in groups</div></div>' +
              '</label>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Section: Sound
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="volume-2" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + t("音效","声音","Sound") + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="display:none;">' +
            '<div style="padding:4px 16px 16px;">' +
              '<label style="display:flex;align-items:center;gap:12px;padding:12px 0;font-size:14px;color:var(--text-primary);cursor:pointer;">' +
                '<input id="notify-sound" type="checkbox" '+(s.notifySound?'checked':'')+'>' +
                '<div><div>' + t("播放音效","播放声音","Play Sound") + '</div><div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + t("收到新訊息時播放提示音","收到新消息时播放提示音","Play a notification sound when new messages arrive") + '</div></div>' +
                '<button id="btn-test-sound" style="margin-left:auto;padding:6px 12px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-secondary);cursor:pointer;font-size:11px;">' + t("測試","测试","Test") + '</button>' +
              '</label>' +

              // Volume slider
              '<div style="padding:8px 0 4px;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                  '<label style="font-size:13px;color:var(--text-primary);font-weight:500;">' + t("音量","音量","Volume") + '</label>' +
                  '<span id="volume-value" style="font-size:12px;color:var(--text-muted);min-width:32px;text-align:right;">' + (s.notifyVolume != null ? s.notifyVolume : 80) + '%</span>' +
                '</div>' +
                '<input id="notify-volume" type="range" min="0" max="100" value="' + (s.notifyVolume != null ? s.notifyVolume : 80) + '" style="width:100%;height:4px;accent-color:var(--accent-primary);cursor:pointer;">' +
              '</div>' +

              // Sound type select
              '<div style="padding:8px 0 4px;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                  '<label for="notify-sound-type" style="font-size:13px;color:var(--text-primary);font-weight:500;">' + t("音效","声音","Sound") + '</label>' +
                '</div>' +
                '<select id="notify-sound-type" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);font-size:13px;cursor:pointer;">' +
                  '<option value="chime"' + (s.notifySoundType === 'chime' ? ' selected' : '') + '>Chime</option>' +
                  '<option value="pop"' + (s.notifySoundType === 'pop' ? ' selected' : '') + '>Pop</option>' +
                  '<option value="gentle"' + (s.notifySoundType === 'gentle' ? ' selected' : '') + '>Gentle</option>' +
                  '<option value="classic"' + (s.notifySoundType === 'classic' ? ' selected' : '') + '>Classic</option>' +
                '</select>' +
              '</div>' +

            '</div>' +
          '</div>' +
        '</div>';

      if (window.lucide) window.lucide.createIcons({ root: content });

      var updateSettings = function(key, val) {
        // Record undo/redo action
        if (window.UndoManager && !window.UndoManager._paused) {
          var _oldVal = window.store.getState().settings[key];
          var _key = key;
          var _newVal = val;
          if (_oldVal !== _newVal) {
            window.UndoManager.pushAction('Change ' + _key, function() {
              var s = { ...window.store.getState().settings };
              s[_key] = _oldVal;
              window.store.setState({ settings: s });
              window.Storage.set('settings', s);
              if (window.App && window.App.applySettings) window.App.applySettings(s);
            }, function() {
              var s = { ...window.store.getState().settings };
              s[_key] = _newVal;
              window.store.setState({ settings: s });
              window.Storage.set('settings', s);
              if (window.App && window.App.applySettings) window.App.applySettings(s);
            });
          }
        }
        var newSettings = { ...window.store.getState().settings };
        newSettings[key] = val;
        window.store.setState({ settings: newSettings });
        window.Storage.set('settings', newSettings);
      };

      function refreshDndBanner() {
        var isDnd = content.querySelector('#notify-dnd').checked;
        var existing = content.querySelector('.dnd-banner');
        if (isDnd && !existing) {
          var banner = document.createElement('div');
          banner.className = 'dnd-banner';
          banner.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;margin-bottom:16px;';
          banner.innerHTML = '<i data-lucide="moon" style="width:18px;height:18px;color:#ef4444;flex-shrink:0;"></i><span style="font-size:13px;color:#ef4444;font-weight:500;">' + t("已啟用勿擾，所有通知均已靜音。","已启用勿扰，所有通知均已静音。","Do Not Disturb is enabled — all notifications are muted.") + '</span>';
          content.insertBefore(banner, content.querySelector('.settings-collapsible'));
          if (window.lucide) window.lucide.createIcons({ root: banner });
        } else if (!isDnd && existing) {
          existing.remove();
        }
      }

      content.querySelector('#notify-sound').addEventListener('change', function(e) { updateSettings('notifySound', e.target.checked); });
      content.querySelector('#btn-test-sound').addEventListener('click', function(e) {
        e.stopPropagation();
        if (window.NotificationSound) {
          var volInput = content.querySelector('#notify-volume');
          var typeInput = content.querySelector('#notify-sound-type');
          window.NotificationSound.play({
            volume: volInput ? parseInt(volInput.value, 10) : 80,
            type: typeInput ? typeInput.value : 'chime'
          });
        }
      });
      content.querySelector('#notify-preview').addEventListener('change', function(e) { updateSettings('notifyPreview', e.target.checked); });
      content.querySelector('#notify-mentions').addEventListener('change', function(e) { updateSettings('notifyGroupMentions', e.target.checked); });
      content.querySelector('#notify-dnd').addEventListener('change', function(e) { updateSettings('notifyDnd', e.target.checked); refreshDndBanner(); });
      content.querySelector('#notify-volume').addEventListener('input', function(e) {
        updateSettings('notifyVolume', parseInt(e.target.value, 10));
        var valDisplay = content.querySelector('#volume-value');
        if (valDisplay) valDisplay.textContent = e.target.value + '%';
      });
      content.querySelector('#notify-sound-type').addEventListener('change', function(e) { updateSettings('notifySoundType', e.target.value); });
      
    } else if (tabName === 'security') {
      if (!state.settings.enableExperimental) {
        content.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);text-align:center;gap:8px;padding:40px;">' +
          '<i data-lucide="lock" style="width:32px;height:32px;opacity:0.3;"></i>' +
          '<div style="font-size:15px;font-weight:600;color:var(--text-secondary);">' + t("實驗功能已停用","实验功能已停用","Experimental Features Disabled") + '</div>' +
          '<div style="font-size:13px;line-height:1.5;">Enable "Experimental Features" in Advanced settings to access Security options.</div>' +
        '</div>';
        return;
      }
      (function() {
        var pinEnabled = window.orbitAPI ? window.orbitAPI.pinStatus() : false;
        var html =
          '<h3 style="font-family:var(--font-display);font-size:24px;margin-bottom:8px;">Security <span style="display:inline-block;font-size:8px;font-weight:700;color:#fff;background:var(--accent-warning);border-radius:3px;padding:1px 5px;text-transform:uppercase;line-height:1.4;vertical-align:middle;margin-left:6px;">EXPERIMENTAL</span></h3>' +
          '<div style="font-size:13px;color:var(--text-muted);margin-bottom:24px;line-height:1.5;">' + t("管理本機安全性設定。","管理本机安全设置。","Manage your account security settings.") + '</div>' +

          '<div style="background:var(--bg-base);border-radius:12px;padding:20px;border:1px solid var(--border-subtle);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
              '<div>' +
                '<div style="font-size:15px;font-weight:600;color:var(--text-primary);">' + t("應用程式鎖定（PIN）","应用锁定（PIN）","App Lock (PIN)") + '</div>' +
                '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + t("啟動 LocalLink 時需要 PIN 碼","启动 LocalLink 时需要 PIN 码","Protect LocalLink with a PIN code on launch") + '</div>' +
              '</div>' +
              // ⚠ One shared switch — geometry, off-colour and knob travel all live
              // in §9c of styles/redesign.css. State comes from `checked`, so the
              // handler below no longer repaints anything by hand.
              '<label class="orbit-switch">' +
                '<input type="checkbox" id="pin-toggle"' + (pinEnabled ? ' checked' : '') + '>' +
                '<span class="orbit-switch-track"><span class="orbit-switch-knob"></span></span>' +
              '</label>' +
            '</div>' +
            (pinEnabled
              ? '<div id="pin-change-area" style="border-top:1px solid var(--border-subtle);padding-top:16px;">' +
                  '<button id="btn-change-pin" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-primary);font-size:13px;font-weight:500;cursor:pointer;transition:background 0.15s;">' + t("變更 PIN","更改 PIN","Change PIN") + '</button>' +
                '</div>'
              : '<div id="pin-setup-area">' +
                  '<div style="margin-bottom:12px;">' +
                    '<label style="font-size:13px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px;">' + t("設定 PIN（4–8 位數字）","设置 PIN（4–8 位数字）","Set PIN (4-8 digits)") + '</label>' +
                    '<input id="pin-new" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="Enter PIN" style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-hover);color:var(--text-primary);font-size:15px;outline:none;box-sizing:border-box;letter-spacing:4px;text-align:center;">' +
                  '</div>' +
                  '<div style="margin-bottom:16px;">' +
                    '<label style="font-size:13px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px;">' + t("確認 PIN","确认 PIN","Confirm PIN") + '</label>' +
                    '<input id="pin-confirm" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="Re-enter PIN" style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-hover);color:var(--text-primary);font-size:15px;outline:none;box-sizing:border-box;letter-spacing:4px;text-align:center;">' +
                  '</div>' +
                  '<div id="pin-setup-error" style="font-size:12px;color:var(--accent-danger);margin-bottom:8px;min-height:16px;"></div>' +
                  '<button id="btn-save-pin" style="padding:10px 24px;border-radius:10px;border:none;background:var(--accent-primary);color:white;font-size:13px;font-weight:500;cursor:pointer;transition:opacity 0.15s;">' + t("儲存 PIN","保存 PIN","Save PIN") + '</button>' +
                '</div>'
            ) +
          '</div>' +

          '<div style="margin-top:16px;padding:16px;background:var(--accent-soft);border-radius:12px;border:1px solid var(--accent-primary);">' +
            '<div style="font-size:12px;color:var(--text-muted);line-height:1.5;">' +
              '<strong style="color:var(--accent-primary);">' + t("注意：","注意：","Note:") + '</strong> PIN lock is an experimental feature. It protects access to LocalLink on this device but does not encrypt your messages or data. ' +
              'If you forget your PIN, use "Forgot PIN" on the lock screen to reset it (your account data stays intact).' +
            '</div>' +
          '</div>';

        content.innerHTML = html;

        // Toggle switch
        var toggle = content.querySelector('#pin-toggle');
        if (toggle) {
          toggle.addEventListener('change', function() {
            if (this.checked) {
              // Enabling — show setup area
              var area = content.querySelector('#pin-setup-area');
              var changeArea = content.querySelector('#pin-change-area');
              if (area) area.style.display = 'block';
              if (changeArea) changeArea.style.display = 'none';
              // Re-render to show setup fields
              window.SettingsModal.renderTab('security');
            } else {
              // Disabling — require current PIN
              var currentPin = prompt('Enter your current PIN to disable App Lock:');
              if (currentPin && window.orbitAPI) {
                var ok = window.orbitAPI.pinDisable(currentPin);
                if (ok) {
                  window.SettingsModal.renderTab('security');
                } else {
                  alert('Incorrect PIN. App Lock remains enabled.');
                  this.checked = true;
                }
              } else {
                this.checked = true;
              }
            }
          });
        }

        // Save PIN
        var saveBtn = content.querySelector('#btn-save-pin');
        if (saveBtn) {
          saveBtn.addEventListener('click', function() {
            var pinNew = content.querySelector('#pin-new').value.replace(/\D/g, '');
            var pinConfirm = content.querySelector('#pin-confirm').value.replace(/\D/g, '');
            var errorEl = content.querySelector('#pin-setup-error');

            if (pinNew.length < 4) {
              errorEl.textContent = 'PIN must be at least 4 digits.';
              return;
            }
            if (pinNew !== pinConfirm) {
              errorEl.textContent = 'PINs do not match.';
              return;
            }
            if (window.orbitAPI) {
              window.orbitAPI.pinSet(pinNew);
              window.SettingsModal.renderTab('security');
            }
          });
        }

        // Change PIN
        var changeBtn = content.querySelector('#btn-change-pin');
        if (changeBtn) {
          changeBtn.addEventListener('click', function() {
            var currentPin = prompt('Enter your current PIN:');
            if (!currentPin) return;
            var newPin = prompt('Enter new PIN (4-8 digits):');
            if (!newPin) return;
            var confirmNew = prompt('Confirm new PIN:');
            if (!confirmNew) return;
            newPin = newPin.replace(/\D/g, '');
            confirmNew = confirmNew.replace(/\D/g, '');
            if (newPin.length < 4) { alert('PIN must be at least 4 digits.'); return; }
            if (newPin !== confirmNew) { alert('PINs do not match.'); return; }
            // Verify current PIN first
            if (window.orbitAPI) {
              var valid = window.orbitAPI.pinVerify(currentPin);
              if (!valid) { alert('Current PIN is incorrect.'); return; }
              window.orbitAPI.pinSet(newPin);
              window.SettingsModal.renderTab('security');
            }
          });
        }
      })();

    } else if (tabName === 'advanced' && window.orbitAPI.dbGetSetting('locallink.transport','localsend') === 'localsend') {
      content.innerHTML=`<h3 class="ll-settings-title">${t('診斷','诊断','Diagnostics')}</h3><section class="ll-settings-card"><div class="ll-settings-card-head"><i data-lucide="network"></i>LocalSend</div><div class="ll-settings-card-body"><dl class="ll-about-facts"><div><dt>${t('服務狀態','服务状态','Service status')}</dt><dd id="ll-diagnostic-status"></dd></div><div><dt>IP</dt><dd id="ll-diagnostic-addresses"></dd></div><div><dt>${t('接收埠','接收端口','Receive port')}</dt><dd id="ll-diagnostic-port"></dd></div></dl><button class="ll-primary-button" id="ll-diagnostic-retry">${t('重試連線','重试连接','Retry connection')}</button></div></section>`;
      const adapterCard=document.createElement('section');adapterCard.className='ll-settings-card';
      const macInterfaces=window.orbitAPI.platform==='darwin';
      adapterCard.innerHTML=`<div class="ll-settings-card-head"><i data-lucide="network"></i>${macInterfaces?t('本機網路位址','本机网络地址','Local network addresses'):t('網路介面卡檢測','网络适配器检测','Network adapter diagnostics')}</div><div class="ll-settings-card-body">
        <p class="ll-settings-copy">${macInterfaces?t('手動連線時，在另一部裝置輸入這台 Mac 的區域網路位址。','手动连接时，在另一台设备输入这台 Mac 的局域网地址。','To connect manually, enter this Mac’s LAN address on the other device.'):t('查看目前連線的理論上限；不是實際傳輸速度。虛擬網卡不代表物理頻寬；多張網卡的速度不會相加。','查看当前连接的理论上限；不是实际传输速度。虚拟网卡不代表物理带宽；多张网卡的速度不会相加。','Current link ceilings, not measured transfer speed. Virtual links do not represent physical bandwidth; adapter speeds do not add up.')}</p>
        <div id="ll-adapters-result" role="status">${t('按下檢測以讀取本機網卡資訊。','点击检测读取本机网卡信息。','Check to read this computer’s adapter information.')}</div>
        <div class="ll-file-actions"><button id="ll-check-adapters">${t('檢測網卡','检测网卡','Check adapters')}</button></div></div>`;
      const probe=document.createElement('div');probe.className='ll-settings-card-body';
      const testCard=document.createElement('section');testCard.className='ll-settings-card';
      testCard.innerHTML=`<div class="ll-settings-card-head"><i data-lucide="network"></i>${t('區域網路傳輸速率測試','局域网传输速率测试','LAN throughput test')}</div>`;
      probe.innerHTML=`<label class="ll-setting-row">${t('目標裝置','目标设备','Target device')} <select></select></label><p class="ll-settings-copy">${t('選擇已配對的附近電腦，每個方向傳輸 8.39 MB。','选择已配对的附近电脑，每个方向传输 8.39 MB。','Select a nearby paired computer. Transfers 8.39 MB each way.')}</p><div class="ll-file-actions"><button>${t('重新整理','刷新设备','Refresh devices')}</button><button disabled>${t('開始測速','开始测速','Run test')}</button></div><p role="status"></p>`;
      testCard.append(probe);
      const selectPeer=probe.querySelector('select'),[refreshPeers,testSpeed]=probe.querySelectorAll('button'),report=probe.querySelector('[role=status]');
      async function loadPeers(){
        refreshPeers.disabled=true;testSpeed.disabled=true;
        try{
          const peers=await window.orbitAPI.invoke('locallink-speed-test');
          const last=selectPeer.value;selectPeer.replaceChildren(...peers.map(p=>new Option(p.alias+' · '+p.ip,p.id)));
          if(peers.some(p=>p.id===last))selectPeer.value=last;
          if(!peers.length)selectPeer.add(new Option(t('無','无','None'),''));
          testSpeed.disabled=!peers.length;
        }catch{report.textContent=t('無法讀取裝置','无法读取设备','Cannot list devices');}
        finally{refreshPeers.disabled=false;}
      }
      refreshPeers.onclick=loadPeers;loadPeers();
      selectPeer.onchange=()=>{report.textContent='';};
      testSpeed.onclick=async()=>{
        refreshPeers.disabled=testSpeed.disabled=selectPeer.disabled=true;
        report.textContent=t('測速中…','测速中…','Testing…');
        try{
          const r=await window.orbitAPI.invoke('locallink-speed-test',selectPeer.value);
          const fmt=n=>n.toFixed(1)+' Mbps ('+(n/8).toFixed(1)+' MB/s)';
          report.textContent=t('傳送','发送','Send')+' '+fmt(r.upload)+' · '+t('接收','接收','Receive')+' '+fmt(r.download);
        }catch{report.textContent=t('測速失敗，請確認雙方已配對且在線。','测速失败，请确认双方已配对且在线。','Test failed. Check that both devices are paired and online.');}
        finally{refreshPeers.disabled=testSpeed.disabled=selectPeer.disabled=false;}
      };
      content.append(adapterCard,testCard);
      adapterCard.querySelector('button').onclick=async()=>{
        const button=adapterCard.querySelector('button'),result=adapterCard.querySelector('#ll-adapters-result');
        button.disabled=true;result.textContent=t('正在檢測…','正在检测…','Checking…');
        try{
          const info=await window.orbitAPI.invoke('locallink-network-adapters');
          if(!info.ok){result.textContent=info.reason==='unsupported'?t('此平台暫不支援網卡檢測。','此平台暂不支持网卡检测。','Adapter detection is unavailable on this platform.'):t('無法讀取網卡，請稍後重試。','无法读取网卡，请稍后重试。','Unable to read adapters. Please try again.');return;}
          const speed=bps=>bps?`${(bps/1000000).toLocaleString()} Mbps ≈ ${(bps/8000000).toLocaleString(undefined,{maximumFractionDigits:2})} MB/s`:t('未知','未知','Unknown');
          result.innerHTML=info.adapters.map(adapter=>{
            if(info.addressesOnly)return `<div><strong>${esc(adapter.name)}</strong><p class="ll-settings-copy selectable">${esc(adapter.description)}</p></div>`;
            const kind=adapter.kind==='bluetooth'?t('藍牙','蓝牙','Bluetooth')+(adapter.bluetoothVersion?' '+esc(adapter.bluetoothVersion):''):adapter.kind==='wifi'?'WLAN':adapter.kind==='ethernet'?t('有線','有线','Ethernet'):adapter.kind==='virtual'?t('虛擬網卡','虚拟网卡','Virtual adapter'):t('其他','其他','Other');
            return `<div style="padding:12px 0;border-bottom:1px solid var(--border-subtle)"><strong>${esc(adapter.name)}</strong> · ${kind} · ${adapter.connected?t('已連線','已连接','Connected'):t('未連線','未连接','Disconnected')}<p class="ll-settings-copy">${esc(adapter.description)}</p>${adapter.connected?`<div>${t('傳送','发送','Send')}: ${speed(adapter.sendBps)}</div><div>${t('接收','接收','Receive')}: ${speed(adapter.receiveBps)}</div>`:''}</div>`;
          }).join('')||t('未找到網卡。','未找到网卡。','No adapters found.');
          if(adapterCard.isConnected)adapterCard.scrollIntoView({block:'start'});
        }catch{result.textContent=t('檢測失敗，請重試。','检测失败，请重试。','Detection failed. Please retry.');}
        finally{button.disabled=false;}
      };
      const load=()=>window.orbitAPI.invoke('locallink-diagnostics').then(result=>{
        if(!content.querySelector('#ll-diagnostic-status'))return;
        content.querySelector('#ll-diagnostic-status').textContent=result.discoveryError?t('可手動連線，附近裝置探索暫不可用。','可手动连接，附近设备发现暂不可用。','Manual connections available. Nearby discovery is unavailable.'):result.running?t('運作中','运行中','Running'):result.error||t('尚未啟動','尚未启动','Not running');
        content.querySelector('#ll-diagnostic-addresses').textContent=result.addresses.join(', ');
        content.querySelector('#ll-diagnostic-port').textContent=result.port||'—';
      });load();
      content.querySelector('#ll-diagnostic-retry').onclick=async()=>{window.orbitAPI.networkStart(window.store.getState().currentUser);await window.orbitAPI.invoke('locallink-rediscover');load();};
    } else if (tabName === 'advanced') {
      var s = state.settings || {};

      var toggleRow = function(id, label, desc, checked) {
        return '<label style="display:flex;align-items:center;gap:12px;padding:12px 0;font-size:14px;color:var(--text-primary);cursor:pointer;">' +
          '<input id="' + id + '" type="checkbox" ' + (checked ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--accent-primary);cursor:pointer;">' +
          '<div><div>' + label + '</div>' +
          (desc ? '<div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + desc + '</div>' : '') +
          '</div></label>';
      };

      var gatedToggleRow = function(id, label, desc, checked, enabled) {
        if (enabled) return toggleRow(id, label, desc, checked);
        return '<label style="display:flex;align-items:center;gap:12px;padding:12px 0;font-size:14px;color:var(--text-muted);cursor:not-allowed;opacity:0.5;">' +
          '<input id="' + id + '" type="checkbox" style="width:18px;height:18px;accent-color:var(--accent-primary);cursor:not-allowed;" disabled>' +
          '<div><div>' + label + '</div>' +
          (desc ? '<div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + t("啟用開發者模式以使用此設定。","启用开发者模式以使用此设置。","Enable developer mode to access this setting.") + '</div></div>' : '</div>') +
          '</label>';
      };

      content.innerHTML =
        '<h3 style="font-family:var(--font-display);font-size:24px;margin-bottom:24px;"><span data-i18n="s7">Advanced</span></h3>' +

        // Warning banner
        '<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:10px;margin-bottom:16px;">' +
          '<i data-lucide="alert-triangle" style="width:18px;height:18px;color:#f59e0b;flex-shrink:0;"></i>' +
          '<span style="font-size:13px;color:#f59e0b;font-weight:500;">' + t("這些設定供開發與除錯使用，變更可能影響效能與穩定性。","这些设置供开发和调试使用，更改可能影响性能与稳定性。","These settings are intended for debugging and development. Changing them may affect performance and stability.") + '</span>' +
        '</div>' +

        // Section: Developer Tools
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="terminal" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + t("開發者工具","开发者工具","Developer Tools") + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="display:block;">' +
            '<div style="padding:4px 16px 16px;">' +
              toggleRow('adv-dev-mode', 'Developer Mode', 'Enable developer tools and instrumentation.', s.devMode) +
            '</div>' +
          '</div>' +
        '</div>' +

        // Section: Experimental Features
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="flask-round" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + t("實驗功能","实验功能","Experimental Features") + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          // ⚠ EXPANDED BY DEFAULT, like Developer Tools above it. It used to be
          // collapsed unless Developer Mode was on, which was fine while every row
          // inside was dev-only — but the look switch is not, and a section
          // that starts collapsed is a section nobody opens. The rows themselves
          // are still gated; only the default has changed.
          '<div class="collapsible-body" style="display:block;">' +
            '<div style="padding:4px 16px 16px;">' +
              // ⚠ FIRST, AND DELIBERATELY NOT GATED. Every other row in here is
              // disabled until Developer Mode is on. This one has to work for
              // anyone — it is how you try the redesign, and how you get back out
              // of it. Gating it behind Developer Mode would hide it from exactly
              // the people it is for.
              //
              // ⚠ IT IS LABELLED FROM THE BETA'S SIDE, AND THE DEFAULT IS OFF.
              // Dan: "the new redesign is the beta look! the classic is the
              // original UI! so by default, that toggle should be on (on to show
              // the classic UI look!)". The original UI is what the app opens on,
              // so the switch that turns the beta ON is the one that has to be
              // off — and the BETA badge belongs on this row rather than on a row
              // called "Classic look", where it read as if classic were the beta.
              '<label style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;cursor:pointer;">' +
                '<div>' +
                  '<div style="font-size:14px;color:var(--text-primary);">New look' + betaBadge + '</div>' +
                  '<div style="font-size:12px;color:var(--text-muted);font-weight:400;">' + t("新版介面仍在改進，預設保留原有外觀。","新版界面仍在改进，默认保留原有外观。","The redesigned UI. Still being improved, so the original look stays the default.") + '</div>' +
                '</div>' +
                // ⚠ A <span>, not a <label>: the row IS the label, and a label inside
                // a label is invalid. See §9c in components.css.
                '<span class="orbit-switch">' +
                  '<input type="checkbox" id="set-new-ui"' + (s.newUI === true ? ' checked' : '') + '>' +
                  '<span class="orbit-switch-track"><span class="orbit-switch-knob"></span></span>' +
                '</span>' +
              '</label>' +
              '<div style="border-top:1px solid var(--border-subtle);"></div>' +
              gatedToggleRow('adv-experimental', 'Experimental Features' + experimentalBadge, 'Enable experimental features that may be unstable.', s.enableExperimental, s.devMode) +
              (s.enableExperimental && s.devMode
                ? '<div style="border-top:1px solid var(--border-subtle);margin-top:4px;"></div>' +
                  '<div style="padding-top:4px;">' +
                    gatedToggleRow('adv-custom-colors', 'Custom Colors' + experimentalBadge, 'Customize UI colors with a live preview editor.', s.enableCustomColors, true) +
                    '<div style="border-top:1px solid var(--border-subtle);"></div>' +
                    gatedToggleRow('adv-animated-avatars', 'Animated Avatars' + experimentalBadge, 'Subtle pulse animation on user avatars.', s.experimentalAnimatedAvatars, true) +
                    '<div style="border-top:1px solid var(--border-subtle);"></div>' +
                    gatedToggleRow('adv-message-fx', 'Enhanced Message FX' + experimentalBadge, 'Sparkle effect on newly sent messages.', s.experimentalMessageFx, true) +
                    '<div style="border-top:1px solid var(--border-subtle);"></div>' +
                    gatedToggleRow('adv-fps-monitor', 'FPS Monitor' + experimentalBadge, 'Display real-time frame rate counter.', s.experimentalFpsMonitor, true) +
                    '<div style="border-top:1px solid var(--border-subtle);"></div>' +
                    gatedToggleRow('adv-dev-overlay', 'Developer Overlay' + experimentalBadge, 'Show connection stats and debug info overlay.', s.experimentalDevOverlay, true) +
                    '<div style="border-top:1px solid var(--border-subtle);"></div>' +
                    gatedToggleRow('adv-perf-mode', 'Performance Mode' + experimentalBadge, 'Kill animations, disable link previews, reduce background CPU.', s.experimentalPerformanceMode, true) +
                    '<div style="border-top:1px solid var(--border-subtle);"></div>' +
                    gatedToggleRow('adv-folders', 'Chat Folders' + experimentalBadge, 'Organize chats into custom folders.', s.experimentalFolders, true) +
                  '</div>'
                : '') +
            '</div>' +
          '</div>' +
        '</div>' +

        // Section: Debug & Diagnostics
        '<div class="settings-collapsible" style="margin-bottom:12px;border-radius:10px;border:1px solid var(--border-subtle);overflow:hidden;">' +
          '<div class="collapsible-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-base);cursor:pointer;user-select:none;" onclick="var b=this.nextElementSibling;var i=this.querySelector(\'.collapse-icon\');if(b.style.display===\'none\'){b.style.display=\'block\';i.style.transform=\'rotate(0deg)\'}else{b.style.display=\'none\';i.style.transform=\'rotate(-90deg)\'}">' +
            '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="search" style="width:16px;height:16px;color:var(--text-muted);"></i><span style="font-size:13px;font-weight:600;color:var(--text-primary);">' + t("除錯與診斷","调试与诊断","Debug & Diagnostics") + '</span></div>' +
            '<i data-lucide="chevron-down" class="collapse-icon" style="width:16px;height:16px;color:var(--text-muted);transition:transform 0.2s;"></i>' +
          '</div>' +
          '<div class="collapsible-body" style="display:none;">' +
            '<div style="padding:4px 16px 16px;">' +
              // ⚠ FIRST HERE, and it is the one that decides whether the terminal
              // is usable at all. Every main-process log line — discovery beacons,
              // socket events, duration probes, the database migration — goes
              // through the gate this drives (src/js/log.js). Off by default.
              gatedToggleRow('adv-debug-logs', 'Debug Logs', 'Print main-process logs to the terminal. Needs Developer Mode.', s.debugLogs, s.devMode) +
              '<div style="border-top:1px solid var(--border-subtle);"></div>' +
              gatedToggleRow('adv-debug-display', 'Debug Display', 'Show debug overlays on messages, search results, and UI components.', s.debugDisplay, s.devMode) +
              '<div style="border-top:1px solid var(--border-subtle);"></div>' +
              gatedToggleRow('adv-show-msg-ids', 'Show Message IDs', 'Display internal message IDs below each message.', s.showMessageIds, s.devMode) +
              '<div style="border-top:1px solid var(--border-subtle);"></div>' +
              gatedToggleRow('adv-log-packets', 'Log Network Packets', 'Log all incoming and outgoing network packets to the console.', s.logNetworkPackets, s.devMode) +
              '<div style="border-top:1px solid var(--border-subtle);"></div>' +
              gatedToggleRow('adv-conn-stats', 'Show Connection Stats', 'Display live connection statistics overlay.', s.showConnectionStats, s.devMode) +
            '</div>' +
          '</div>' +
        '</div>';

      if (window.lucide) window.lucide.createIcons({ root: content });

      var updateSettings = function(key, val) {
        // Record undo/redo action
        if (window.UndoManager && !window.UndoManager._paused) {
          var _oldVal = window.store.getState().settings[key];
          var _key = key;
          var _newVal = val;
          if (_oldVal !== _newVal) {
            window.UndoManager.pushAction('Change ' + _key, function() {
              var s = { ...window.store.getState().settings };
              s[_key] = _oldVal;
              window.store.setState({ settings: s });
              window.Storage.set('settings', s);
              if (window.App && window.App.applySettings) window.App.applySettings(s);
            }, function() {
              var s = { ...window.store.getState().settings };
              s[_key] = _newVal;
              window.store.setState({ settings: s });
              window.Storage.set('settings', s);
              if (window.App && window.App.applySettings) window.App.applySettings(s);
            });
          }
        }
        var newSettings = { ...window.store.getState().settings };
        newSettings[key] = val;
        window.store.setState({ settings: newSettings });
        window.Storage.set('settings', newSettings);
      };

      // The "New look" toggle — the beta redesign. It is the first row under
      // Experimental Features, and it is off by default.
      //
      // ⚠⚠ IT CONFIRMS FIRST, AND THE SWITCH GOES BACK IMMEDIATELY. Changing the
      // look restarts the app, so this is not a control that may act on the click:
      // a switch that moves and then asks permission is showing a state that is not
      // saved. It is put back at once, and only a confirmed choice — followed by the
      // restart that applies it — may move it.
      //
      // ⚠ It does NOT go through updateSettings. That funnels into the store, whose
      // subscription repaints the window through applySettings — so the UI would
      // change under the user and *then* the app would close. See commitLook.
      var lookToggle = content.querySelector('#set-new-ui');
      if (lookToggle) {
        lookToggle.addEventListener('change', function(e) {
          var wantNewLook = e.target.checked;
          e.target.checked = !wantNewLook;

          // ⚠ A restart ends a call, and the dialog is the only place that can say
          // so. `CallManager.activeCall` is set on every call start — outgoing,
          // incoming, 1:1 and group, and a call that is still RINGING — and cleared
          // in the single cleanup(), so it is the one honest signal for this. The
          // confirm turns red when it applies, because the consequence is no longer
          // just a restart.
          var inCall = !!(window.CallManager && window.CallManager.activeCall);

          window.ConfirmModal.show({
            title: wantNewLook ? 'Switch to the new look?' : 'Switch back to the original look?',
            message: 'LocalLink will close and reopen to apply it. Nothing else changes — your messages, accounts and settings are untouched.'
              + (inCall ? ' You are in a call right now, and restarting will end it.' : ''),
            confirmText: inCall ? 'End call and restart' : 'Restart now',
            cancelText: 'Not now',
            danger: inCall,
            onConfirm: function() {
              if (window.OrbitRedesign) window.OrbitRedesign.commitLook(wantNewLook);
            }
          });
        });
      }

      content.querySelector('#adv-dev-mode').addEventListener('change', function(e) {
        if (!e.target.checked) {
          var s = { ...window.store.getState().settings };
          s.devMode = false;
          s.enableExperimental = false;
          s.enableCustomColors = false;
          s.experimentalAnimatedAvatars = false;
          s.experimentalMessageFx = false;
          s.experimentalCompactSpacing = false;
          s.experimentalFpsMonitor = false;
          s.experimentalDevOverlay = false;
          s.experimentalPerformanceMode = false;
          s.experimentalFolders = false;
          s.debugDisplay = false;
          s.debugLogs = false;
          s.showMessageIds = false;
          s.logNetworkPackets = false;
          s.showConnectionStats = false;
          window.store.setState({ settings: s });
          window.Storage.set('settings', s);
        } else {
          updateSettings('devMode', true);
        }
        if (window.SettingsModal) window.SettingsModal.renderTab('advanced');
      });
      content.querySelector('#adv-debug-logs').addEventListener('change', function(e) {
        if (!window.store.getState().settings.devMode) { e.target.checked = false; return; }
        updateSettings('debugLogs', e.target.checked);
      });
      content.querySelector('#adv-debug-display').addEventListener('change', function(e) {
        if (!window.store.getState().settings.devMode) { e.target.checked = false; return; }
        updateSettings('debugDisplay', e.target.checked);
      });
      content.querySelector('#adv-show-msg-ids').addEventListener('change', function(e) {
        if (!window.store.getState().settings.devMode) { e.target.checked = false; return; }
        updateSettings('showMessageIds', e.target.checked);
      });
      content.querySelector('#adv-log-packets').addEventListener('change', function(e) {
        if (!window.store.getState().settings.devMode) { e.target.checked = false; return; }
        updateSettings('logNetworkPackets', e.target.checked);
      });
      content.querySelector('#adv-conn-stats').addEventListener('change', function(e) {
        if (!window.store.getState().settings.devMode) { e.target.checked = false; return; }
        updateSettings('showConnectionStats', e.target.checked);
      });
      content.querySelector('#adv-experimental').addEventListener('change', function(e) {
        if (!window.store.getState().settings.devMode) {
          e.target.checked = false;
          if (window.Toast) window.Toast.show('Notice', 'Enable Developer Mode first to access experimental features.');
          return;
        }
        updateSettings('enableExperimental', e.target.checked);
        if (e.target.checked && window.Toast) {
          window.Toast.show('Experimental', 'Experimental features enabled. Some features may be unstable.');
        }
        // Toggle Security tab visibility in sidebar
        var secTab = window.SettingsModal.container.querySelector('.settings-tab[data-tab="security"]');
        if (e.target.checked && !secTab) {
          window.SettingsModal.render();
          var tabEl = window.SettingsModal.container.querySelector('.settings-tab[data-tab="advanced"]');
          if (tabEl) tabEl.click();
    this.container.querySelector('#btn-close-settings').focus({preventScroll:true});
        } else if (!e.target.checked && secTab) {
          window.SettingsModal.render();
          var tabEl = window.SettingsModal.container.querySelector('.settings-tab[data-tab="advanced"]');
          if (tabEl) tabEl.click();
    this.container.querySelector('#btn-close-settings').focus({preventScroll:true});
        } else {
          if (window.SettingsModal) window.SettingsModal.renderTab('advanced');
        }
      });

      var expToggle = function(id, key) {
        var el = content.querySelector('#' + id);
        if (el) {
          el.addEventListener('change', function(e) {
            if (!window.store.getState().settings.devMode || !window.store.getState().settings.enableExperimental) {
              e.target.checked = false;
              return;
            }
            updateSettings(key, e.target.checked);
          });
        }
      };
      expToggle('adv-custom-colors', 'enableCustomColors');
      expToggle('adv-animated-avatars', 'experimentalAnimatedAvatars');
      expToggle('adv-message-fx', 'experimentalMessageFx');
      expToggle('adv-fps-monitor', 'experimentalFpsMonitor');
      expToggle('adv-dev-overlay', 'experimentalDevOverlay');
      expToggle('adv-folders', 'experimentalFolders');
      // Performance Mode — two-step confirmation on enable
      (function() {
        var el = content.querySelector('#adv-perf-mode');
        if (el) {
          el.addEventListener('change', function(e) {
            if (!window.store.getState().settings.devMode || !window.store.getState().settings.enableExperimental) {
              e.target.checked = false;
              return;
            }
            if (!e.target.checked) {
              // Turning off — just apply
              updateSettings('experimentalPerformanceMode', false);
              return;
            }
            // Step 1: Warning modal
            if (window.ConfirmModal) {
              window.ConfirmModal.show({
                title: 'Performance Mode',
                message: 'Performance Mode disables animations, link previews, GIFs, and background tasks to reduce CPU usage. Some visual feedback will stop working while this is active.',
                confirmText: 'Continue',
                cancelText: window.I18n.t('s28'),
                onConfirm: function() {
                  // Step 2: Final confirmation
                  window.ConfirmModal.show({
                    title: 'Are you sure?',
                    message: 'This will kill all CSS animations, freeze animated GIFs, disable link preview fetching, and reduce background task frequency. The app will feel less responsive visually but may use less CPU. You can turn this off at any time.',
                    confirmText: 'Enable',
                    cancelText: window.I18n.t('s28'),
                    danger: true,
                    onConfirm: function() {
                      updateSettings('experimentalPerformanceMode', true);
                      window.Toast && window.Toast.show('Performance Mode', 'Performance Mode enabled. Some features are now disabled.', 'info');
                    },
                    onCancel: function() {
                      e.target.checked = false;
                    }
                  });
                },
                onCancel: function() {
                  e.target.checked = false;
                }
              });
            } else {
              updateSettings('experimentalPerformanceMode', true);
            }
          });
        }
      })();

    } else if (tabName === 'data') {
      var s = state.settings;
      var currentDelete = s.deleteAttachmentsAfter || 0;
      var presetOptions = [
        { label: 'Never', value: 0 },
        { label: '1 minute', value: 1 },
        { label: '5 minutes', value: 5 },
        { label: '10 minutes', value: 10 },
        { label: '25 minutes', value: 25 },
        { label: '60 minutes', value: 60 },
        { label: 'Custom', value: -1 }
      ];
      var isCustom = currentDelete > 0 && ![1,5,10,25,60].includes(currentDelete);
      var selectVal = isCustom ? -1 : currentDelete;
      var optionsHtml = '';
      presetOptions.forEach(function(opt) {
        optionsHtml += '<option value="' + opt.value + '"' + (selectVal === opt.value ? ' selected' : '') + '>' + opt.label + '</option>';
      });

      content.innerHTML =
        '<h3 style="font-family:var(--font-display);font-size:24px;margin-bottom:24px;"><span data-i18n="s5">Data Manager</span></h3>' +
        '<div style="display:flex;flex-direction:column;gap:16px;">' +
          '<div style="padding:20px;background:var(--bg-hover);border-radius:12px;border:1px solid var(--border-subtle);">' +
            '<div style="display:flex;align-items:flex-start;gap:16px;">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
              '<div style="flex:1;">' +
                '<div style="font-weight:600;color:var(--text-primary);font-size:15px;">' + t("匯出備份","导出备份","Export Backup") + '</div>' +
                '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;line-height:1.4;">' + t("將訊息、群組、裝置、設定及頭像匯出為備份檔（.orzip 或 .zip）。","将消息、群组、设备、设置和头像导出为备份文件（.orzip 或 .zip）。","Export all your messages, groups, friends, settings, and avatars into a single backup file (.orzip or .zip).") + '</div>' +
                '<div style="display:flex;gap:10px;margin-top:14px;">' +
                  '<button id="btn-backup-orzip" class="btn btn-primary" style="padding:10px 20px;border-radius:10px;background:var(--accent-primary);color:white;border:none;cursor:pointer;font-weight:600;">' + t("備份為 .orzip","备份为 .orzip","Backup as .orzip") + '</button>' +
                  '<button id="btn-backup-zip" class="btn btn-secondary" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);cursor:pointer;font-weight:500;">' + t("備份為 .zip","备份为 .zip","Backup as .zip") + '</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="padding:20px;background:var(--bg-hover);border-radius:12px;border:1px solid var(--border-subtle);">' +
            '<div style="display:flex;align-items:flex-start;gap:16px;">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>' +
              '<div style="flex:1;">' +
                '<div style="font-weight:600;color:var(--text-primary);font-size:15px;">' + t("從備份還原","从备份恢复","Restore from Backup") + '</div>' +
                '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;line-height:1.4;">' + t("從備份還原資料，這將取代目前的所有資料。","从备份恢复数据，这将替换当前所有数据。","Restore your data from a previously created backup file. This will replace all current data.") + '</div>' +
                '<div style="margin-top:14px;">' +
                  '<button id="btn-restore" class="btn btn-danger" style="padding:10px 20px;border-radius:10px;background:var(--accent-danger);color:white;border:none;cursor:pointer;font-weight:600;">' + t("還原備份","恢复备份","Restore Backup") + '</button>' +
                  '<span id="restore-status" style="margin-left:12px;font-size:13px;color:var(--text-muted);display:none;"></span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="padding:20px;background:var(--bg-hover);border-radius:12px;border:1px solid var(--border-subtle);">' +
            '<div style="display:flex;align-items:flex-start;gap:16px;">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>' +
              '<div style="flex:1;">' +
                '<div style="font-weight:600;color:var(--text-primary);font-size:15px;">' + t("資料庫健全性","数据库健康状况","Database Health") + '</div>' +
                '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;line-height:1.4;">' + t("檢查資料庫完整性及資料表狀態。","检查数据库完整性和数据表状态。","Check your database integrity and verify all tables are healthy.") + '</div>' +
                '<div style="margin-top:14px;">' +
                  '<button id="btn-db-health" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);cursor:pointer;font-weight:500;">' + t("執行檢查","运行检查","Run Health Check") + '</button>' +
                  '<span id="health-status" style="margin-left:12px;font-size:13px;color:var(--text-muted);display:none;"></span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div id="db-repair-section" style="padding:20px;background:var(--bg-hover);border-radius:12px;border:1px solid var(--border-subtle);">' +
              '<div style="flex:1;">' +
                '<div style="font-weight:600;color:var(--text-primary);font-size:15px;">' + t("資料庫修復","数据库修复","Database Repair") + '</div>' +
                '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;line-height:1.4;">' + t("修復資料庫、重建索引並移除孤立記錄。","修复数据库、重建索引并移除孤立记录。","Repair database integrity, rebuild indexes, and remove orphaned records.") + '</div>' +
                '<div style="margin-top:14px;">' +
                  '<button id="btn-db-repair" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);cursor:pointer;font-weight:500;">' + t("執行修復","运行修复","Run Repair") + '</button>' +
                  '<span id="repair-status" style="margin-left:12px;font-size:13px;color:var(--text-muted);display:none;"></span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '<div id="privacy-mode-section" style="padding:16px;background:var(--bg-hover);border-radius:12px;border:1px solid var(--border-subtle);">' +
            '<label id="privacy-mode-label" style="display:flex;align-items:center;gap:12px;font-size:16px;color:var(--text-primary);cursor:pointer;font-weight:bold;">' +
              '<input id="set-privacy" type="checkbox" '+(s.privacyMode?'checked':'')+'> Enable Privacy Mode' +
            '</label>' +
            '<p style="margin-top:8px;font-size:13px;color:var(--text-secondary);">When enabled, attachments (images, files) are NOT saved to the database. They are only kept in a temporary folder and cleared when the app closes. Messages and profile data are still saved.</p>' +
          '</div>' +
          '<div style="padding:16px;background:var(--bg-hover);border-radius:12px;border:1px solid var(--border-subtle);">' +
            '<label style="display:flex;align-items:center;gap:12px;font-size:16px;color:var(--text-primary);cursor:pointer;font-weight:bold;">' +
              '<input id="set-e2ee" type="checkbox" '+(s.e2eeEnabled?'checked':'')+'> Enable End-to-End Encryption' +
            '</label>' +
            '<p style="margin-top:8px;font-size:13px;color:var(--text-secondary);">When enabled, message content is encrypted with AES-256-GCM before leaving your device. Only the intended recipient can decrypt it. Currently works for direct messages. <span style="color:var(--accent-warning);">Requires both you and the recipient to have E2EE enabled.</span></p>' +
          '</div>' +
          '<div style="padding:16px;background:var(--bg-hover);border-radius:12px;border:1px solid var(--border-subtle);">' +
            '<label style="display:block;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:8px;">' + t("附件保留時間","附件保留时间","Delete attachments after") + '</label>' +
            '<select id="set-delete-after" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);outline:none;">' +
              optionsHtml +
            '</select>' +
            '<div id="custom-time-row" style="display:' + (isCustom ? 'flex' : 'none') + ';gap:8px;align-items:center;margin-top:12px;">' +
              '<input id="custom-time-value" type="number" min="1" max="1440" value="' + (isCustom ? currentDelete : 30) + '" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);outline:none;">' +
              '<select id="custom-time-unit" style="padding:10px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);outline:none;">' +
                '<option value="1"' + (isCustom && currentDelete < 60 ? ' selected' : '') + '>Minutes</option>' +
                '<option value="60"' + (isCustom && currentDelete >= 60 ? ' selected' : '') + '>Hours</option>' +
              '</select>' +
              '<button id="btn-custom-done" style="padding:10px 20px;background:var(--accent-primary);color:white;border-radius:8px;border:none;font-weight:600;cursor:pointer;">' + t("完成","完成","Done") + '</button>' +
            '</div>' +
            '<p style="margin-top:8px;font-size:12px;color:var(--text-muted);">Attachments older than this will be automatically removed from the database. Max: 24 hours (1440 minutes).</p>' +
          '</div>' +
           '<div id="load-all-data-section" style="padding:20px;background:var(--bg-hover);border-radius:12px;border:1px solid var(--border-subtle);">' +
            '<div style="flex:1;">' +
              '<div style="font-weight:600;color:var(--text-primary);font-size:15px;">' + t("載入所有已儲存資料","加载所有已保存数据","Load All Stored Data") + '</div>' +
              '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;line-height:1.4;">Load all messages, images, and files from the database into memory. Use this to ensure all historical data is available for search and gallery.</div>' +
              '<div style="margin-top:14px;">' +
                '<button id="btn-load-all-data" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);cursor:pointer;font-weight:500;">' + t("載入所有資料","加载所有数据","Load All Data") + '</button>' +
                '<span id="load-all-msg" style="margin-left:12px;font-size:13px;color:var(--text-muted);display:none;"></span>' +
              '</div>' +
            '</div>' +
          '</div>' +
           '<div id="export-chat-section" style="padding:20px;background:var(--bg-hover);border-radius:12px;border:1px solid var(--border-subtle);">' +
            '<div style="display:flex;align-items:flex-start;gap:16px;">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
              '<div style="flex:1;">' +
                '<div style="font-weight:600;color:var(--text-primary);font-size:15px;">' + t("匯出對話記錄","导出会话记录","Export Chat History") + '</div>' +
                '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;line-height:1.4;">' + t("將單一對話的完整記錄匯出為 JSON 或文字檔。","将单个会话的完整记录导出为 JSON 或文本文件。","Export the complete message history of a single chat as a JSON or text file.") + '</div>' +
                '<div style="margin-top:14px;">' +
                  '<select id="export-chat-select" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-base);color:var(--text-primary);outline:none;font-size:13px;margin-bottom:10px;">' +
                    '<option value="">Select a chat...</option>' +
                  '</select>' +
                  '<div style="display:flex;gap:10px;">' +
                    '<button id="btn-export-json" class="btn btn-primary" style="padding:10px 20px;border-radius:10px;background:var(--accent-primary);color:white;border:none;cursor:pointer;font-weight:600;">' + t("匯出為 JSON","导出为 JSON","Export as JSON") + '</button>' +
                    '<button id="btn-export-txt" class="btn btn-secondary" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);cursor:pointer;font-weight:500;">' + t("匯出為 TXT","导出为 TXT","Export as TXT") + '</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
           '<div style="padding:20px;background:var(--bg-hover);border-radius:12px;border:1px solid var(--border-subtle);">' +
            '<div style="flex:1;">' +
              '<div style="font-weight:600;color:var(--text-primary);font-size:15px;">' + t("儲存空間管理","存储管理","Storage Management") + '</div>' +
              '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;margin-bottom:14px;line-height:1.4;">' + t("永久刪除本機儲存檔案以釋放空間。","永久删除本机存储文件以释放空间。","Permanently delete local storage files to free up disk space.") + '</div>' +
              '<button id="btn-clear-attachments" style="padding:10px 20px;background:var(--accent-danger);color:white;border-radius:10px;border:none;font-weight:600;cursor:pointer;">' + t("清除所有已儲存附件","清除所有已保存附件","Clear All Saved Attachments") + '</button>' +
              '<span id="clear-msg" style="margin-left:16px;font-size:13px;color:var(--accent-success);"></span>' +
            '</div>' +
          '</div>' +
        '</div>';

      var updateSettings = function(key, val) {
        // Record undo/redo action
        if (window.UndoManager && !window.UndoManager._paused) {
          var _oldVal = window.store.getState().settings[key];
          var _key = key;
          var _newVal = val;
          if (_oldVal !== _newVal) {
            window.UndoManager.pushAction('Change ' + _key, function() {
              var s = { ...window.store.getState().settings };
              s[_key] = _oldVal;
              window.store.setState({ settings: s });
              window.Storage.set('settings', s);
              if (window.App && window.App.applySettings) window.App.applySettings(s);
            }, function() {
              var s = { ...window.store.getState().settings };
              s[_key] = _newVal;
              window.store.setState({ settings: s });
              window.Storage.set('settings', s);
              if (window.App && window.App.applySettings) window.App.applySettings(s);
            });
          }
        }
        var newSettings = { ...window.store.getState().settings };
        newSettings[key] = val;
        window.store.setState({ settings: newSettings });
        window.Storage.set('settings', newSettings);
      };

      // Backup buttons
      var updateStatus = function(el, text, isError) {
        el.style.display = 'inline';
        el.textContent = text;
        el.style.color = isError ? 'var(--accent-danger)' : 'var(--accent-success)';
      };

      var withLoading = function(btn, fn) {
        return async function() {
          if (btn.disabled) return;
          var origText = btn.textContent;
          btn.disabled = true;
          btn.style.opacity = '0.6';
          btn.style.cursor = 'wait';
          btn.textContent = 'Working...';
          try {
            await fn();
          } finally {
            btn.disabled = false;
            btn.style.opacity = '';
            btn.style.cursor = '';
            btn.textContent = origText;
          }
        };
      };

      content.querySelector('#btn-backup-orzip').addEventListener('click', withLoading(content.querySelector('#btn-backup-orzip'), async function() {
        if (!window.orbitAPI || !window.orbitAPI.backupCreate) { window.Toast.show('Error', 'Backup not available'); return; }
        var result = await window.orbitAPI.backupCreate('orzip');
        if (result.canceled) return;
        if (result.error) { window.Toast.show('Backup Failed', result.error); return; }
        window.Toast.show('Backup Created', 'Saved (' + (result.size / 1000).toFixed(1) + ' KB)');
      }));
      content.querySelector('#btn-backup-zip').addEventListener('click', withLoading(content.querySelector('#btn-backup-zip'), async function() {
        if (!window.orbitAPI || !window.orbitAPI.backupCreate) { window.Toast.show('Error', 'Backup not available'); return; }
        var result = await window.orbitAPI.backupCreate('zip');
        if (result.canceled) return;
        if (result.error) { window.Toast.show('Backup Failed', result.error); return; }
        window.Toast.show('Backup Created', 'Saved (' + (result.size / 1000).toFixed(1) + ' KB)');
      }));

      // Restore with confirmation
      content.querySelector('#btn-restore').addEventListener('click', function() {
        if (!window.orbitAPI || !window.orbitAPI.backupRestore) { window.Toast.show('Error', 'Restore not available'); return; }
        if (window.ConfirmModal) {
          window.ConfirmModal.show({
            title: 'Restore Backup',
            message: 'This will replace ALL current data (messages, groups, friends, settings) with data from the backup. This cannot be undone. Are you sure?',
            confirmText: 'Restore',
            danger: true,
            onConfirm: async function() {
              var statusEl = content.querySelector('#restore-status');
              updateStatus(statusEl, 'Restoring...', false);
              var result = await window.orbitAPI.backupRestore();
              if (result.canceled) { statusEl.style.display = 'none'; return; }
              if (result.ok) {
                updateStatus(statusEl, 'Restore complete! Reloading...', false);
                setTimeout(function() { window.location.reload(); }, 1500);
              } else {
                updateStatus(statusEl, result.error || 'Restore failed', true);
              }
            }
          });
        }
      });

      // Health check
      content.querySelector('#btn-db-health').addEventListener('click', function() {
        if (!window.orbitAPI || !window.orbitAPI.dbHealthCheck) { window.Toast.show('Error', 'Health check not available'); return; }
        var btn = this;
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.textContent = 'Checking...';
        var result = window.orbitAPI.dbHealthCheck();
        var statusEl = content.querySelector('#health-status');
        if (result.ok && result.errors.length === 0) {
          var warnings = result.warnings && result.warnings.length > 0 ? ' (' + result.warnings.length + ' warnings)' : '';
          updateStatus(statusEl, 'Database healthy' + warnings, false);
        } else {
          var errMsg = result.errors ? result.errors.join('; ') : 'Unknown issue';
          updateStatus(statusEl, errMsg, true);
        }
        btn.disabled = false;
        btn.style.opacity = '';
        btn.textContent = 'Run Health Check';
      });

      // Database repair
      content.querySelector('#btn-db-repair').addEventListener('click', function() {
        if (!window.orbitAPI || !window.orbitAPI.dbRepair) { window.Toast.show('Error', 'Repair not available'); return; }
        if (window.ConfirmModal) {
          window.ConfirmModal.show({
            title: 'Repair Database',
            message: 'This will rebuild indexes, remove orphaned data, and attempt to fix integrity issues. The app may become unresponsive briefly. Proceed?',
            confirmText: 'Repair',
            danger: true,
            onConfirm: function() {
              var statusEl = content.querySelector('#repair-status');
              updateStatus(statusEl, 'Repairing...', false);
              var result = window.orbitAPI.dbRepair();
              if (result.ok) {
                var msg = 'Repair complete';
                if (result.repaired && result.repaired.length > 0) {
                  msg = result.repaired.join('; ');
                }
                if (result.warnings && result.warnings.length > 0) {
                  msg += ' (warnings: ' + result.warnings.join('; ') + ')';
                }
                updateStatus(statusEl, msg, result.warnings && result.warnings.length > 0);
              } else {
                updateStatus(statusEl, result.warnings ? result.warnings.join('; ') : 'Repair failed', true);
              }
            }
          });
        }
      });

      // Privacy mode toggle
      content.querySelector('#set-privacy').addEventListener('change', function(e) {
        var isChecked = e.target.checked;
        if (isChecked) {
          e.target.checked = false;
          if (window.ConfirmModal) {
            window.ConfirmModal.show({
              title: 'Enable Privacy Mode',
              message: "WARNING! When you toggle this mode, you'll enter Privacy Mode, which will NOT save any sended Images, Files, Folders but, you keep your messages, profile data!",
              confirmText: 'Enable',
              danger: true,
              onConfirm: function() {
                e.target.checked = true;
                updateSettings('privacyMode', true);
              }
            });
          }
        } else {
          updateSettings('privacyMode', false);
        }
      });

      // E2EE toggle
      var e2eeToggle = content.querySelector('#set-e2ee');
      if (e2eeToggle) {
        e2eeToggle.addEventListener('change', function(e) {
          var isChecked = e.target.checked;
          if (isChecked) {
            if (window.ConfirmModal) {
              window.ConfirmModal.show({
                title: 'Enable E2EE',
                message: 'End-to-end encryption will encrypt message content before sending. Recipients also need E2EE enabled to decrypt. Only direct messages are encrypted. Group messages will still be sent in plaintext.',
                confirmText: 'Enable',
                danger: false,
                onConfirm: function() {
                  updateSettings('e2eeEnabled', true);
                  if (window.Toast) window.Toast.show('E2EE Enabled', 'Messages will now be encrypted end-to-end');
                }
              });
            } else {
              updateSettings('e2eeEnabled', true);
            }
          } else {
            updateSettings('e2eeEnabled', false);
            if (window.Toast) window.Toast.show('E2EE Disabled', 'Messages will be sent in plaintext');
          }
        });
      }

      // Delete attachments after
      content.querySelector('#set-delete-after').addEventListener('change', function(e) {
        var val = parseInt(e.target.value);
        if (val === -1) {
          content.querySelector('#custom-time-row').style.display = 'flex';
        } else {
          content.querySelector('#custom-time-row').style.display = 'none';
          updateSettings('deleteAttachmentsAfter', val);
        }
      });

      var btnCustomDone = content.querySelector('#btn-custom-done');
      if (btnCustomDone) {
        btnCustomDone.addEventListener('click', function() {
          var timeVal = parseInt(content.querySelector('#custom-time-value').value) || 30;
          var unitVal = parseInt(content.querySelector('#custom-time-unit').value) || 1;
          var totalMinutes = Math.min(1440, Math.max(1, timeVal * unitVal));
          content.querySelector('#custom-time-value').value = Math.floor(totalMinutes / unitVal);
          updateSettings('deleteAttachmentsAfter', totalMinutes);
          btnCustomDone.textContent = window.I18n.t('s19');
          setTimeout(function() { btnCustomDone.textContent = 'Done'; }, 1500);
        });
      }

      // Load all stored data (double confirmation)
      content.querySelector('#btn-load-all-data').addEventListener('click', function() {
        if (window.ConfirmModal) {
          window.ConfirmModal.show({
            title: 'Load All Stored Data',
            message: 'Warning: This will load ALL stored messages, images, and files from the database into memory. This may temporarily increase memory usage and cause the app to become less responsive while loading. Are you sure you want to continue?',
            confirmText: 'Continue',
            danger: true,
            onConfirm: function() {
              window.ConfirmModal.show({
                title: 'Final Confirmation',
                message: 'This action will fully load all historical data from the database, making everything available for search and gallery views. This cannot be undone unless you restart the app. Proceed?',
                confirmText: 'Yes, Load Everything',
                danger: true,
                onConfirm: function() {
                  var statusEl = content.querySelector('#load-all-msg');
                  statusEl.style.display = 'inline';
                  statusEl.textContent = 'Loading...';
                  statusEl.style.color = 'var(--text-muted)';
                  window.store.loadAllMessages();
                  statusEl.textContent = 'Loaded!';
                  statusEl.style.color = 'var(--accent-success)';
                  setTimeout(function() { statusEl.style.display = 'none'; }, 3000);
                  if (window.Toast) window.Toast.show('Data Loaded', 'All stored messages are now available in memory');
                }
              });
            }
          });
        }
      });

      // Populate export chat select
      var exportSelect = content.querySelector('#export-chat-select');
      if (exportSelect) {
        var state = window.store.getState();
        var chatIds = Object.keys(state.messages || {});
        var seen = {};
        chatIds.forEach(function(cId) {
          if (cId === 'local-echo') return;
          var label = cId;
          var friend = state.friends.find(function(f) { return f.userId === cId; });
          var group = state.groups.find(function(g) { return g.groupId === cId; });
          if (friend) label = friend.username;
          else if (group) label = group.groupName;
          if (seen[label]) return;
          seen[label] = true;
          var opt = document.createElement('option');
          opt.value = cId;
          opt.textContent = label;
          exportSelect.appendChild(opt);
        });
      }

      function doExportChat(format) {
        var select = content.querySelector('#export-chat-select');
        var chatId = select ? select.value : '';
        if (!chatId) {
          if (window.Toast) window.Toast.show('Export Error', 'Please select a chat first.');
          return;
        }
        var state = window.store.getState();
        var msgs = state.messages[chatId] || [];
        var chatName = chatId;
        var friend = state.friends.find(function(f) { return f.userId === chatId; });
        var group = state.groups.find(function(g) { return g.groupId === chatId; });
        if (friend) chatName = friend.username;
        else if (group) chatName = group.groupName;

        function getSenderName(senderId) {
          if (senderId === state.currentUser.userId) return 'You';
          var f = state.friends.find(function(fr) { return fr.userId === senderId; });
          if (f) return f.username;
          if (group) {
            var m = group.members.find(function(mem) { return mem.userId === senderId; });
            if (m) return m.username;
          }
          return senderId;
        }

        if (format === 'json') {
          var data = {
            chatId: chatId,
            chatName: chatName,
            exportedAt: new Date().toISOString(),
            messages: msgs.map(function(m) {
              return {
                id: m.id,
                sender: m.sender,
                senderName: getSenderName(m.sender),
                text: m.text || '',
                timestamp: m.timestamp,
                attachments: m.attachments || []
              };
            })
          };
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'chat-' + chatName.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          var lines = msgs.map(function(m) {
            var date = m.timestamp ? new Date(m.timestamp).toLocaleString() : 'Unknown date';
            return '[' + date + '] ' + getSenderName(m.sender) + ': ' + (m.text || '');
          });
          var text = lines.join('\n');
          var blob = new Blob([text], { type: 'text/plain' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'chat-' + chatName.replace(/[^a-zA-Z0-9]/g, '_') + '.txt';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        if (window.Toast) window.Toast.show('Chat Exported', chatName + ' history exported successfully.');
      }

      content.querySelector('#btn-export-json').addEventListener('click', function() { doExportChat('json'); });
      content.querySelector('#btn-export-txt').addEventListener('click', function() { doExportChat('txt'); });

      // Clear all attachments
      content.querySelector('#btn-clear-attachments').addEventListener('click', function() {
        if (window.ConfirmModal) {
          window.ConfirmModal.show({
            title: 'Clear Attachments',
            message: 'Are you sure you want to permanently delete all saved attachments from the database? This cannot be undone.',
            confirmText: 'Clear All',
            danger: true,
            onConfirm: function() {
              if (window.orbitAPI) {
                window.orbitAPI.dbClearAttachments();
                content.querySelector('#clear-msg').textContent = 'Attachments cleared!';
                setTimeout(function() {
                  var clearMsgEl = content.querySelector('#clear-msg');
                  if (clearMsgEl) clearMsgEl.textContent = '';
                }, 3000);
              }
            }
          });
        }
      });

    } else if (tabName === 'about') {
      const version = window.orbitAPI.getAppVersion();
      content.innerHTML=`<h3 class="ll-settings-title">${t('關於','关于','About')}</h3>
        <div class="ll-about-brand"><span class="ll-about-mark"><i data-lucide="link"></i></span><div><h2>LocalLink</h2><p>${t('版本','版本','Version')} ${esc(version)}</p></div></div>
        <p class="ll-about-description">${t('個人裝置之間的檔案傳輸工具','个人设备之间的文件传输工具','File sharing across your devices')}</p>
        <section class="ll-settings-card"><div class="ll-settings-card-head"><i data-lucide="package"></i>${t('版本資訊','版本信息','Build information')}</div>
          <div class="ll-settings-card-body"><dl class="ll-about-facts"><div><dt>${t('更新渠道','更新渠道','Updates')}</dt><dd>GitHub · MostimaJK/LocalLink</dd></div><div><dt>${t('檔案傳輸','文件传输','File transfer')}</dt><dd>LocalSend ${t('協定','协议','protocol')}</dd></div></dl>
          <div id="ll-last-update" hidden></div>
          <label class="ll-setting-row" style="margin-top:20px">${t('啟動後檢查更新','启动后检查更新','Check for updates after startup')}<input type="checkbox" role="switch" id="ll-auto-update"></label>
          <div class="ll-file-actions" style="margin-top:20px"><button class="ll-action-button" id="settings-btn-check-update">${t('檢查更新','检查更新','Check for updates')}</button></div></div>

        </section>`;
      window.UpdateNotice.lastAttempt(content.querySelector('#ll-last-update'));
      const autoUpdate=content.querySelector('#ll-auto-update');
      autoUpdate.checked=window.orbitAPI.dbGetSetting('locallink.updateCheck',false);
      autoUpdate.onchange=()=>window.orbitAPI.dbSetSetting('locallink.updateCheck',autoUpdate.checked);
      content.querySelector('#settings-btn-check-update').onclick=async event=>{
        const button=event.currentTarget;button.disabled=true;
        button.textContent=t('正在檢查…','正在检查…','Checking…');
        try {await window.UpdateNotice.checkManual();} finally {
          button.disabled=false;button.textContent=t('檢查更新','检查更新','Check for updates');
        }
      };

    } else {
      content.innerHTML = '<h3 style="font-family:var(--font-display);font-size:24px;margin-bottom:24px;">' + tabName + '</h3><p style="color:var(--text-muted);">Coming soon...</p>';
    }
    if(tabName==='network') {
      const section=document.createElement('section');section.className='ll-settings-card';
      section.innerHTML=`<div class="ll-settings-card-head">${t('進階連線選項','高级连接选项','Advanced connection options')}</div><div class="ll-settings-card-body">
        <div class="ll-setting-row"><label for="transport-mode">${t('傳輸協定','传输协议','Transport')}</label><select class="ll-field" id="transport-mode"><option value="localsend">LocalSend</option><option value="orbit">${t('舊版連線（支援通話）','旧版连接（支持通话）','Legacy connection (calls)')}</option></select></div>
        <p class="ll-settings-copy" style="margin:12px 0 0">${t('變更後重新啟動生效','更改后重启生效','Restart to apply changes')}</p><p id="transport-save-msg" class="ll-settings-copy" role="status"></p>
      </div>`;
      content.appendChild(section);
      const select=section.querySelector('select');select.value=window.orbitAPI.dbGetSetting('locallink.transport','localsend');
      select.onchange=event=>{window.orbitAPI.dbSetSetting('locallink.transport',event.target.value);section.querySelector('#transport-save-msg').textContent=t('已儲存，重新啟動後生效','已保存，重启后生效','Saved. Restart to apply.');};
    }
    window.lucide.createIcons({root:content});

    content.querySelectorAll('.collapsible-header').forEach(header=>{
      header.removeAttribute('onclick');header.removeAttribute('tabindex');header.removeAttribute('role');header.style.cursor='default';
      header.querySelector('.collapse-icon')?.remove();
      const body=header.nextElementSibling;if(body?.classList.contains('collapsible-body'))body.style.display='block';
    });
    window.LocalLinkSelect.enhance(content);
    if (!target) this._syncNetworkMapTimer();

  },

  _stopNetworkMap() {
    clearInterval(this._networkMapTimer);this._networkMapTimer = null;
    this._mapResizeObserver?.disconnect();this._mapResizeObserver = null;
  },

  _syncNetworkMapTimer() {
    clearInterval(this._networkMapTimer);this._networkMapTimer = null;
    const canvas = this.container?.querySelector('#network-map-canvas');
    if (!this.isOpen || this._windowVisible === false || document.hidden || !canvas || canvas.offsetParent === null) return;
    this._drawNetworkMap();
    this._networkMapTimer = setInterval(() => this._drawNetworkMap(), 250);
  },

  // Stable per-string hash → deterministic node placement across redraws
  _hashString(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  },

  // Live network topology renderer for #network-map-canvas (Settings → Network).
  // Self node at center; peer nodes placed on stable per-peerId angles; edges
  // only to connected peers, colored by RTT (_rtts, green<150 / yellow 150-400 /
  // red>400-or-unknown). Active transfers pulse edges + show a name/percent
  // badge; incoming-message bursts (_p2pRecvCount deltas) briefly brighten edges.
  _drawNetworkMap() {
    var recvNow = window._p2pRecvCount || 0;
    if (this._lastRecvCount !== undefined && recvNow > this._lastRecvCount) this._activityAt = Date.now();
    this._lastRecvCount = recvNow;

    if (!this.isOpen) return;
    var canvas = document.getElementById('network-map-canvas');
    if (!canvas || canvas.offsetParent === null) return;

    var dpr = this._mapDpr || window.devicePixelRatio || 1;
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    if (w < 10 || h < 10) return;

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var state = window.store ? window.store.getState() : null;
    if (!state) return;
    var friends = state.friends || [];
    var online = friends.filter(function(f) { return f.status === 'online'; });

    // Connected set: SocketManager.connections when the socket layer is exposed
    // to the renderer; otherwise fall back to beacon-implied online friends.
    var sm = window.SocketManager;
    var connectedIds = {};
    var rtts = null;
    if (sm && sm.connections) {
      sm.connections.forEach(function(sock, peerId) { connectedIds[peerId] = true; });
      rtts = (sm._rtts && sm._rtts.get) ? sm._rtts : null;
    } else {
      online.forEach(function(f) { connectedIds[f.userId] = true; });
    }

    // Node set: online friends + any connected peer not among them
    var nodes = [];
    var seen = {};
    online.forEach(function(f) {
      if (!seen[f.userId]) {
        seen[f.userId] = true;
        nodes.push({ id: f.userId, name: f.username || 'Peer', connected: !!connectedIds[f.userId] });
      }
    });
    if (sm && sm.connections) {
      sm.connections.forEach(function(sock, peerId) {
        if (!seen[peerId]) {
          seen[peerId] = true;
          nodes.push({ id: peerId, name: String(peerId).substring(0, 8), connected: true });
        }
      });
    }

    var transfers = state.transferProgress || {};
    var transferIds = Object.keys(transfers);
    var anyTransfer = transferIds.length > 0;

    // Incoming-activity pulse (fades over ~500ms after _p2pRecvCount jumps)
    var activity = this._activityAt ? Math.max(0, 1 - (Date.now() - this._activityAt) / 500) : 0;

    var cx = w / 2;
    var cy = h / 2;
    var radius = Math.min(cx, cy) * 0.6;

    // Deterministic angles from peerId hash (stable across ticks, unlike index order)
    var pos = {};
    nodes.forEach(function(node) {
      var angle = nodes.length === 1 ? 0 : (this._hashString(node.id) % 1000) / 1000 * Math.PI * 2;
      pos[node.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    }, this);

    function edgeStyle(id) {
      var rtt = rtts ? rtts.get(id) : undefined;
      if (rtt === undefined || rtt === null) return { color: '255, 69, 58' }; // unknown → red
      if (rtt < 150) return { color: '48, 209, 88' }; // green
      if (rtt <= 400) return { color: '255, 204, 0' }; // yellow
      return { color: '255, 69, 58' }; // red
    }

    var pulseT = (Date.now() % 1200) / 1200; // 0..1 traveling pulse

    // Edges: self → each connected peer
    nodes.forEach(function(node) {
      if (!node.connected) return;
      var p = pos[node.id];
      var st = edgeStyle(node.id);
      var alpha = 0.35 + activity * 0.55;
      if (anyTransfer) alpha = 0.45 + 0.4 * Math.abs(Math.sin(pulseT * Math.PI * 2));
      ctx.strokeStyle = 'rgba(' + st.color + ', ' + alpha.toFixed(2) + ')';
      ctx.lineWidth = anyTransfer ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke();
      if (anyTransfer) {
        // Traveling dot along the edge while a transfer is active
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(cx + (p.x - cx) * pulseT, cy + (p.y - cy) * pulseT, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Active transfer badge (name + percent)
    if (anyTransfer) {
      var t = transfers[transferIds[0]];
      if (t && t.name) {
        var pct = t.total > 0 ? Math.round((t.received / t.total) * 100) : 0;
        var badge = (t.isSending ? 'Sending ' : 'Receiving ') + t.name + ' — ' + pct + '%';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        var bw = ctx.measureText(badge).width + 16;
        ctx.fillStyle = 'rgba(10, 132, 255, 0.15)';
        ctx.strokeStyle = 'rgba(10, 132, 255, 0.5)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect((w - bw) / 2, 6, bw, 18, 9) : ctx.rect((w - bw) / 2, 6, bw, 18);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(badge, w / 2, 18);
      }
    }

    // Self node
    ctx.fillStyle = '#0A84FF';
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('You', cx, cy + 28);

    // Peer nodes: initial letter, RTT-colored when connected
    nodes.forEach(function(node) {
      var p = pos[node.id];
      var label = node.name.length > 8 ? node.name.substring(0, 8) + '…' : node.name;
      if (node.connected) {
        var st = edgeStyle(node.id);
        ctx.fillStyle = 'rgb(' + st.color + ')';
      } else {
        ctx.fillStyle = '#8E8E93';
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillText(node.name.charAt(0).toUpperCase(), p.x, p.y + 3.5);
      ctx.fillStyle = 'rgba(174, 174, 182, 0.95)';
      ctx.font = '500 10px system-ui, sans-serif';
      ctx.fillText(label, p.x, p.y + 24);
    });

    // Legend (top-left): RTT thresholds
    ctx.textAlign = 'left';
    var legend = [
      { c: '48, 209, 88', t: '<150ms' },
      { c: '255, 204, 0', t: '150-400ms' },
      { c: '255, 69, 58', t: '>400ms / unknown' }
    ];
    var lx = 8;
    var ly = h - 10;
    legend.forEach(function(l) {
      ctx.fillStyle = 'rgb(' + l.c + ')';
      ctx.beginPath(); ctx.arc(lx + 3, ly - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(174, 174, 182, 0.9)';
      ctx.font = '500 9px system-ui, sans-serif';
      ctx.fillText(l.t, lx + 9, ly);
      lx += ctx.measureText(l.t).width + 20;
    });
  },

  open(tab) {
    if (!tab) {
      tab = window.Storage ? window.Storage.get('lastSettingsTab', 'account') : 'account';
    }
    if(['network','notifications','data','general'].includes(tab))tab='account';
    if(!this.isOpen)this.returnFocus=document.activeElement;
    this.container.style.display = 'flex';
    this.isOpen = true;
    // ⚠ Before the tab click, and for a reason: this is the first moment the hydrated
    // settings exist. See _syncNavToggle.
    this._syncNavToggle();
    var tabEl = this.container.querySelector('.settings-tab[data-tab="' + tab + '"]');
    if (tabEl) tabEl.click();
    this.container.querySelector('#btn-close-settings').focus({preventScroll:true});
  },

  close() {
    this._stopNetworkMap();
    window.LocalLinkSelect.close();
    const draft=this.container.querySelector('#input-username');if(draft)this.accountDraft=draft.value;
    // Save active tab
    var activeTab = this.container ? this.container.querySelector('.settings-tab.active') : null;
    if (activeTab && window.Storage) {
      window.Storage.set('lastSettingsTab', activeTab.getAttribute('data-tab'));
    }
    this.container.style.display = 'none';
    this.isOpen = false;
    const trigger=this.returnFocus?.isConnected?this.returnFocus:document.getElementById(this.returnFocus?.id);
    trigger?.focus({preventScroll:true});
  }
};

document.addEventListener('DOMContentLoaded', function() {
  window.SettingsModal.init();
});

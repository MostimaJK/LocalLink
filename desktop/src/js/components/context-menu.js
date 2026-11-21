// src/js/components/context-menu.js

window.ContextMenu = {
  labels: {"Pin DM": ["置頂對話", "置顶会话"], "Unpin DM": ["取消置頂", "取消置顶"], "Mute Notifications": ["靜音通知", "静音通知"], "Unmute Notifications": ["恢復通知", "恢复通知"], "View Profile": ["裝置資訊", "设备信息"], "Connect over the internet…": ["透過網際網路連線…", "通过互联网连接…"], "Report…": ["檢舉…", "举报…"], "Copy ID": ["複製裝置 ID", "复制设备 ID"], "Close DM": ["關閉對話", "关闭会话"], "Close DM (not available)": ["無法關閉此對話", "无法关闭此会话"], "Reply": ["回覆", "回复"], "Copy Text": ["複製文字", "复制文字"], "Edit Message": ["編輯訊息", "编辑消息"], "Delete Message": ["刪除訊息", "删除消息"], "Forward": ["轉寄", "转发"], "Pin Message": ["置頂訊息", "置顶消息"], "Unpin Message": ["取消置頂訊息", "取消置顶消息"], "Search in Chat": ["搜尋對話", "搜索会话"], "Search": ["搜尋", "搜索"], "Upload Files": ["傳送檔案", "发送文件"], "Upload Folder": ["傳送資料夾", "发送文件夹"], "Upload Images": ["傳送圖片", "发送图片"], "Voice Call": ["語音通話", "语音通话"], "Video Call": ["視訊通話", "视频通话"], "View thread": ["查看討論串", "查看讨论串"], "Harassment": ["騷擾", "骚扰"], "Spam": ["垃圾訊息", "垃圾消息"], "Scam": ["詐騙", "诈骗"], "Something else": ["其他原因", "其他原因"], "Leave Group": ["離開群組", "退出群组"], "Delete Group": ["刪除群組", "删除群组"], "Group Info": ["群組資訊", "群组信息"], "Mark as Read": ["標記為已讀", "标记为已读"], "Rename": ["重新命名", "重命名"], "Delete": ["刪除", "删除"], "New Folder": ["新增資料夾", "新建文件夹"], "Remove from Folder": ["移出資料夾", "移出文件夹"]},
  extraLabels: {'Copy Invite Code':['複製邀請碼','复制邀请码'],'New Folder…':['新增資料夾…','新建文件夹…'],'Pin Group':['置頂群組','置顶群组'],'Unpin Group':['取消置頂群組','取消置顶群组']},
  label(text) { const row=this.labels[text]||this.extraLabels[text];return row&&window.I18n.locale!=='en'?row[window.I18n.locale==='zh-Hans'?1:0]:text; },
  init() {
    this.container = document.createElement('div');
    this.container.id = 'context-menu-container';
    // ⚠ The chrome is `.context-menu*` classes in styles/redesign.css now. Only the
    // POSITION stays inline, because it is computed per invocation.
    document.body.appendChild(this.container);

    var self = this;
    document.addEventListener('click', function() {
      if (self.container.style.display !== 'none') self.close();
    });
    // ⚠ Escape closes it, which it never did. A menu you can only dismiss by clicking
    // is a menu that fights the keyboard — and it is the first thing anyone tries.
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && self.container.style.display !== 'none') self.close();
    });

    // Prevent hiding if clicking inside (handled by click listeners mostly)
    this.container.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  },

  show(x, y, items) {
    if (!this.container) return;
    var self = this;

    this.container.innerHTML = '';
    items.forEach(function(item) {
      if (item === 'separator') {
        var sep = document.createElement('div');
        // ⚠ A class, not `height:1px;background:…` written inline — an inline-styled
        // element is invisible to every stylesheet, so the separator could never be
        // themed and never matched the `.context-menu-item` rule §9 of the layer
        // thought it had written.
        sep.className = 'context-menu-sep';
        self.container.appendChild(sep);
      } else {
        var btn = document.createElement('button');
        btn.className = 'context-item';
        // ⚠ The only inline left, and the only one that is genuinely dynamic:
        // destructive items are handed a danger colour by their caller.
        if (item.color) btn.style.color = item.color;
        if (item.icon) {
          var icon = document.createElement('i');
          icon.setAttribute('data-lucide', item.icon);
          btn.appendChild(icon);
        }
        btn.appendChild(document.createTextNode(self.label(item.label)));
        // ⚠ The `mouseover`/`mouseout` handlers are gone. The layer's `:hover` does
        // this now, and two writers for one state is how a hover ends up stuck on the
        // last item you touched.
        btn.addEventListener('click', function() {
          if (item.onClick) item.onClick();
          self.close();
        });
        self.container.appendChild(btn);
      }
    });

    lucide.createIcons({ root: this.container });

    // Ensure it doesn't go off screen
    this.container.style.display = 'flex';
    var rect = this.container.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 10;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10;

    this.container.style.left = x + 'px';
    this.container.style.top = y + 'px';

    // ⚠⚠ THERE IS NO AUTO-DISMISS ANY MORE, AND REMOVING IT IS THE POINT OF THIS FILE.
    // It closed itself after 1.5 SECONDS — "so cursor doesn't block buttons" — and the
    // message menu pushes six or more items, so you had a second and a half to read the
    // list and hit one. Measured in the running app before the fix: visible at 600ms,
    // GONE BY 1200ms.
    //
    // ⚠ It was never needed. All seven call sites are click-driven — a `contextmenu`
    // event or a button click, never a hover — and a click anywhere outside already
    // closes it through the document listener above. Nothing could be blocked.
  },

  close() {
    if (this.container) this.container.style.display = 'none';
  }
};

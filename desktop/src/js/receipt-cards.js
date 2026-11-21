'use strict';

(() => {
  const api = window.orbitAPI;
  if (!api) return;
  const inbox = document.getElementById('ll-receipts');
  const panel = window.LocalSendPanel;
  const t = (...labels) => panel.text(...labels);
  const cards = new Map();
  function placeCards() {
    const timeline = document.querySelector('#chat-container .ll-timeline, #chat-container .ll-group-feed');
    for (const card of cards.values()) {
      const inConversation = timeline && timeline.dataset.peerId === card.dataset.peerId && !inbox.closest('dialog');
      const target = inConversation ? timeline : inbox;
      if (card.parentNode !== target) {
        target.append(card);
        if (inConversation) timeline.scrollTop = timeline.scrollHeight;
      }
    }
    inbox.hidden = !inbox.childElementCount;
  }
  // The conversation renderer rebuilds the timeline on navigation and transfer progress.
  const observer = new MutationObserver(placeCards);
  observer.observe(document.getElementById('chat-container'), {childList:true, subtree:true});
  observer.observe(inbox.parentNode, {childList:true});
  function append(parent, tag, value) {
    const el = document.createElement(tag);
    el.textContent = value;
    parent.append(el);
    return el;
  }
  api.on('locallink-receipt', offer => {
    const card = document.createElement('article');
    card.className = 'll-receipt-card';
    if (offer.peerId) card.dataset.peerId = offer.peerId;
    const title = append(card, 'strong', (offer.largeThreshold?t('大檔案接收確認','大文件接收确认','Large transfer request'):t('接收請求','接收请求','Incoming request')) + ' · ' + offer.alias);
    title.dir = 'auto';
    if(offer.largeThreshold){
      card.classList.add('ll-large-receipt');
      const icon=document.createElement('i');
      icon.dataset.lucide='triangle-alert';
      icon.setAttribute('aria-hidden','true');
      title.prepend(icon);
      window.lucide.createIcons({root:title});
      append(card,'small',t('本次傳輸超過','本次传输超过','This transfer exceeds')+' '+offer.largeThreshold+' GiB'+t('，確認後才會開始接收。','，确认后才会开始接收。','. Confirm to start receiving.'));
    }
    const list = append(card, 'details', '');
    const formatSize = bytes => offer.largeThreshold && bytes >= 1024**3 ? (bytes/1024**3).toLocaleString(undefined,{maximumFractionDigits:2})+' GiB' : panel.size(bytes);
    const first = offer.files[0].name;
    append(list, 'summary', first + (offer.files.length > 1 ? ' (+' + (offer.files.length-1) + ')' : '') + ' · ' + formatSize(offer.total));
    append(list, 'small', offer.ip || '');
    for (const file of offer.files) append(list, 'div', file.name + ' · ' + formatSize(file.size));
    const previews=offer.files.filter(file=>file.preview?.startsWith('data:image/png;base64,'));
    if(previews.length){
      const gallery=append(card,'div','');
      gallery.className='ll-receipt-images';
      for(const file of previews){
        const figure=append(gallery,'figure','');
        const image=append(figure,'img','');
        image.className='ll-receipt-preview';image.alt=file.name;image.src=file.preview;
        if(offer.files.length>1)append(figure,'figcaption',file.name);
      }
    }
    let remember;
    if (offer.mayRemember) {
      const label = append(card, 'label', '');
      remember = document.createElement('input');
      remember.type = 'checkbox';
      label.append(remember, t('以後自動接收此裝置的內容','以后自动接收此设备的内容','Automatically receive from this device in future'));
    }
    const actions = append(card, 'div', '');
    actions.className='ll-receipt-actions';
    for (const [accept, label] of [[false,t('拒絕','拒绝','Reject')],[true,t('接受','接受','Accept')]]) {
      const button = append(actions, 'button', label);
      button.className = accept ? 'll-receipt-accept' : 'll-receipt-reject';
      const glyph=document.createElement('i');
      glyph.dataset.lucide=accept?'check':'x';
      glyph.setAttribute('aria-hidden','true');
      button.prepend(glyph);
      window.lucide.createIcons({root:button});
      button.onclick = async () => {
        for (const btn of actions.children) btn.disabled = true;
        try { await api.invoke('locallink-decide-receipt', {id:offer.id, accept, remember:!!remember?.checked}); }
        catch { for (const btn of actions.children) btn.disabled = false; }
      };
    }
    cards.set(offer.id, card);
    placeCards();
  });
  api.on('locallink-receipt-closed', id => {
    cards.get(id)?.remove();
    cards.delete(id);
    placeCards();
  });
})();

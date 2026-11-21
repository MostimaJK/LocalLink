'use strict';
(() => {
  const invoke = (action, options = {}) => window.orbitAPI.invoke('locallink-web-share', {action, ...options});
  const t = (...labels) => window.LocalSendPanel.text(...labels);
  const bar = document.getElementById('ll-sharing-bar');
  const icon = name => '<i aria-hidden="true" data-lucide="'+name+'"></i>';
  let dialog, state, serial = 0, busy = false;
  function paint() {
    if (!state) return;
    const s = state.session;
    const label = s?.paired ? t('手機已配對','手机已配对','Phone paired') : t('等待掃碼','等待扫码','Awaiting scan');
    bar.hidden = !s;
    bar.querySelector('.share-label').textContent = label;
    bar.querySelector('.share-indicator').title = t('管理手機共享','管理手机共享','Manage phone sharing');
    const send = t('選擇檔案','选择文件','Choose files');
    bar.querySelector('.share-quick-add span').textContent = send;
    bar.querySelector('.share-quick-add').disabled = busy;
    if (!dialog?.open) return;
    const q = selector => dialog.querySelector(selector);
    dialog.dataset.phase = !s ? 'idle' : s.paired ? 'paired' : 'waiting';
    q('.share-badge span').textContent = s ? label : t('尚未共享','尚未共享','Sharing off');
    q('.share-interface').hidden = !!s;
    const select = q('select');
    if (JSON.stringify(state.addresses) !== select.dataset.addresses) {
      const previous = select.value;
      select.replaceChildren(...state.addresses.map(({address,name,virtual})=>{
        const option=new Option(address,address);
        option.dataset.detail=name+(virtual?' · '+t('虛擬介面','虚拟网卡','Virtual adapter'):'');
        return option;
      }));
      if (state.addresses.some(row=>row.address===previous)) select.value = previous;
      select.dataset.addresses = JSON.stringify(state.addresses);
    }
    q('.share-hint').textContent = !s
      ? (state.tls ? t('透過 HTTPS 加密傳輸。','通过 HTTPS 加密传输。','Transfers use encrypted HTTPS.') : t('HTTP 未加密，請僅在可信任的私人網路使用。','HTTP 未加密，请仅在可信的私人网络使用。','HTTP is unencrypted. Start only on a trusted private network.'))
      : s.paired ? t('可收起此面板，從標題列繼續選擇檔案。','可收起此面板，从标题栏继续选择文件。','Dismiss this panel and choose files from the title bar.')
      : t('用手機掃碼並輸入配對碼。未配對的邀請 15 分鐘後失效。','用手机扫码并输入配对码。未配对的邀请 15 分钟后失效。','Scan and enter the code on your phone. Unused invitations expire after 15 minutes.');
    q('.share-code').hidden = !s || s.paired;
    if (s?.url && q('.share-code').dataset.url !== s.url) {
      const qr = window.qrcode(0,'M'); qr.addData(s.url); qr.make();
      const img = new Image(); img.alt = t('配對 QR 碼','配对二维码','Pairing QR code'); img.src=qr.createDataURL(5);
      q('.share-code').replaceChildren(img); q('.share-code').dataset.url=s.url;
    } else if (!s?.url) { q('.share-code').replaceChildren(); delete q('.share-code').dataset.url; }
    q('.share-pin').hidden = !s?.code;
    q('.share-pin b').textContent = s?.code || '';
    q('.share-files').hidden = !s;
    q('.share-files summary').textContent = t('已選檔案','已选文件','Selected files')+' · '+(s?.files.length || 0);
    q('.share-files ul').replaceChildren(...(s?.files || []).map(file=>{
      const item=document.createElement('li');item.textContent=file.name;return item;
    }));
    q('.share-start').hidden=!!s; q('.share-start').disabled=busy || !select.value;
    q('.share-add').hidden=!s; q('.share-add').disabled=busy;
    q('.share-stop').hidden=!s; q('.share-stop').disabled=busy;
    select.disabled=busy;
  }
  async function refresh() {
    const id=++serial, result=await invoke('state');
    if(id===serial && result.ok){state=result;paint();}
  }
  async function action(name, options) {
    if(busy)return;
    busy=true;paint();
    if(dialog?.open)dialog.querySelector('.share-error').textContent='';
    try {
      const result=await invoke(name,options);
      if(!result.ok)throw new Error();
      await refresh();
    } catch {
      const msg=t('操作失敗，請檢查網路設定後重試。','操作失败，请检查网络设置后重试。','Action failed. Check network settings and try again.');
      if(dialog?.open)dialog.querySelector('.share-error').textContent=msg;
      else window.Toast?.show('LocalLink',msg,'error');
    } finally {
      busy=false;paint();
      if(name==='stop' && dialog?.open && !state.session)dialog.querySelector('.share-start').focus();
    }
  }
  window.showBrowserShare = async () => {
    if(dialog?.open)return;
    dialog=document.createElement('dialog'); dialog.id='ll-browser-share';
    dialog.setAttribute('aria-labelledby','ll-share-title');
    const hide=t('收起面板','收起面板','Dismiss panel');
    dialog.innerHTML=`<header><span class="share-mark">${icon('smartphone')}</span><div><h2 id="ll-share-title">${window.I18n.t('s22')}</h2><div class="share-badge"><i></i><span></span></div></div><button class="share-hide" aria-label="${hide}" title="${hide}">${icon('x')}</button></header>
      <div class="share-code" hidden></div><div class="share-pin" hidden><span>${t('配對碼','配对码','Pairing code')}</span><b></b></div>
      <div class="share-interface"><label for="ll-share-address">${icon('network')}${t('本機位址','本机地址','Computer address')}</label><select id="ll-share-address"></select></div>
      <details class="share-files" hidden><summary></summary><ul></ul></details>
      <p class="share-hint"></p><p class="share-error" role="alert"></p>
      <footer><button class="share-stop" hidden>${icon('square')}${t('結束共享','结束共享','End sharing')}</button><button class="share-start" disabled>${icon('qr-code')}${t('開始共享','开始共享','Start sharing')}</button><button class="share-add" hidden>${icon('file-plus-2')}${t('選擇檔案','选择文件','Choose files')}</button></footer>`;
    const current=dialog;
    current.onclose=()=>{if(window.LocalLinkSelect.active?.trigger.closest('dialog')===current)window.LocalLinkSelect.close();current.remove();if(dialog===current)dialog=null;};
    current.querySelector('.share-hide').onclick=()=>current.close();
    current.querySelector('.share-start').onclick=()=>action('start',{address:current.querySelector('select').value,allowHttp:!state.tls});
    current.querySelector('.share-stop').onclick=()=>action('stop');
    current.querySelector('.share-add').onclick=()=>action('add');
    document.body.append(current);current.showModal();window.LocalLinkSelect.enhance(current);lucide.createIcons({root:current});
    try { await refresh();
      if(!state?.session && !state?.addresses.length)current.querySelector('.share-error').textContent=t('請先連接區域網路。','请先连接局域网。','Connect to a local network first.');
    } catch {current.querySelector('.share-error').textContent=t('無法取得共享狀態','无法获取共享状态','Sharing status unavailable');}
  };
  bar.querySelector('.share-indicator').onclick=window.showBrowserShare;
  bar.querySelector('.share-quick-add').onclick=()=>action('add');
  for(const event of ['locallink-web-share-ended','locallink-web-share-paired'])window.orbitAPI.on(event,refresh);
  window.addEventListener('locallink-language-change',paint);
  window.addEventListener('DOMContentLoaded',refresh);
})();

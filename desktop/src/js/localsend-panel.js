window.LocalSendPanel = {
 busy: new Set(),
 feedback: new Map(),
 text(tw,cn,en){return window.I18n.locale==='en'?en:window.I18n.locale==='zh-Hans'?cn:tw;},
 statusLabel(status){
  const labels={preparing:['正在準備檔案','正在准备文件','Preparing file'],awaiting:['等待對方接收','等待对方接收','Awaiting acceptance'],transferring:['傳輸中','传输中','Transferring'],delivered:['已送達','已送达','Delivered'],received:['已接收','已接收','Received'],failed:['傳輸失敗','传输失败','Failed']};
  return this.text(...(labels[status]||['狀態未知','状态未知','Unknown status']));
 },
 size(bytes){if(!Number.isFinite(bytes))return '';const units=['B','KB','MB','GB'];let u=0;while(bytes>=1024&&u<3){bytes/=1024;u++;}return (u?bytes.toFixed(1):bytes)+' '+units[u];},
 render(peer,host){
  const t=this.text.bind(this), esc=window.Sanitize.escapeHtml;
  const old=host.querySelector('.ll-timeline');
  const same=old?.dataset.peerId===peer.userId;
  const top=old?.scrollTop||0, atBottom=!same||old.scrollHeight-old.clientHeight-top<60;
  const expanded=new Set(same?[...old.querySelectorAll('details[open]')].map(el=>el.closest('[data-transfer-id]').dataset.transferId):[]);
  const activeElement=document.activeElement;
  const focused=host.contains(activeElement)?activeElement.id:null;
  const nearby=window.LocalLinkDevices.isNearby(peer), busy=this.busy.has(peer.userId);
  const name=window.LocalLinkDevices.name(peer);
  const records=window.orbitAPI.dbGetSetting('locallink.transfers',[]).filter(r=>r.peerId===peer.userId).sort((a,b)=>(a.startedAt||a.time)-(b.startedAt||b.time));
  const icon=type=>'<i data-lucide="'+type+'" aria-hidden="true"></i>';
  const locale=window.I18n.locale==='en'?'en':window.I18n.locale==='zh-Hans'?'zh-CN':'zh-TW';
  let lastDate='', feed='';
  for(const r of records){
   const date=new Date(r.startedAt||r.time), day=date.toLocaleDateString(locale,{year:'numeric',month:'long',day:'numeric'});
   if(day!==lastDate){feed+='<div class="ll-date"><span>'+esc(day)+'</span></div>';lastDate=day;}
   const incoming=r.direction==='incoming'||r.status==='received';
   const done=['delivered','received'].includes(r.status), failed=r.status==='failed';
   const ext=(r.name.split('.').pop()||'').toLowerCase();
   const fileIcon=['png','jpg','jpeg','webp','gif'].includes(ext)?'file-image':['mp4','mov','mkv'].includes(ext)?'file-video':['zip','7z','rar'].includes(ext)?'file-archive':'file-text';
   feed+='<article class="ll-transfer '+(incoming?'ll-incoming':'ll-outgoing')+'" data-transfer-id="'+esc(r.id)+'" data-status="'+esc(r.status)+'">'+
    '<div class="ll-bubble"><div class="ll-file-main"><span class="ll-file-icon">'+icon(fileIcon)+'</span><div class="ll-file-copy"><strong class="selectable">'+esc(r.name)+'</strong><span>'+this.size(r.size)+'</span></div></div>'+
    '<div class="ll-file-state '+(failed?'ll-error':'')+'">'+icon(failed?'circle-alert':done?'check-check':'clock-3')+'<span>'+esc(this.statusLabel(r.status))+'</span></div>'+
    (failed?'<p class="ll-error-detail selectable">'+esc(r.error||t('請重新選擇檔案再試一次','请重新选择文件再试一次','Choose the file to try again'))+'</p>':'')+
    (done?'<div class="ll-file-actions"><button data-open="'+esc(r.id)+'">'+icon('file')+t('開啟','打开','Open')+'</button><button data-folder="'+esc(r.id)+'">'+icon('folder-open')+t('所在資料夾','所在目录','Show in folder')+'</button></div>':'')+
    (done&&r.path?'<details class="ll-file-path"><summary>'+t('檔案位置','文件位置','File location')+'</summary><p class="selectable">'+esc(r.path)+'</p></details>':'')+'</div>'+
    '<div class="ll-message-meta">'+esc(incoming?name:t('本裝置','本设备','This device'))+' · <time datetime="'+date.toISOString()+'">'+date.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',hour12:false})+'</time></div></article>';
  }
  host.style.display='flex';host.style.flexDirection='column';
  host.innerHTML='<section class="ll-conversation">'+
   '<header class="chat-header ll-chat-header"><span class="ll-device-icon">'+icon(window.LocalLinkDevices.icon(peer))+'</span><div class="ll-peer-heading"><h2>'+esc(name)+'</h2><p><span class="ll-presence '+(nearby?'online':'')+'"></span>'+t(nearby?'附近的裝置':'裝置離線',nearby?'附近的设备':'设备离线',nearby?'Nearby device':'Device offline')+'<span class="ll-protocol"> · LocalSend</span></p></div><button id="btn-device-details" class="ll-icon-button" title="'+t('裝置詳情','设备详情','Device details')+'" aria-label="'+t('裝置詳情','设备详情','Device details')+'">'+icon('info')+'</button></header>'+
   '<div class="ll-timeline" role="region" aria-label="'+t('檔案會話','文件会话','File conversation')+'" tabindex="0" data-peer-id="'+esc(peer.userId)+'">'+(feed||'<div class="ll-conversation-empty"><span class="ll-empty-icon">'+icon('files')+'</span><h3>'+t('與此裝置分享檔案','与此设备分享文件','Share files with this device')+'</h3><p>'+t('傳送和接收的檔案會依時間顯示在這裡','发送和接收的文件会按时间显示在这里','Sent and received files appear here in order')+'</p></div>')+'</div>'+
   '<footer class="ll-composer"><p id="localsend-feedback" role="status">'+esc(this.feedback.get(peer.userId)||'')+'</p><div class="ll-compose-wrapper"><span class="ll-compose-icon">'+icon('paperclip')+'</span><span class="ll-compose-hint">'+(busy?t('等待接收或傳輸中…','等待接收或传输中…','Waiting or transferring…'):nearby?t('將檔案傳送到此裝置','将文件发送到此设备','Send a file to this device'):t('裝置離線，仍可查看歷史檔案','设备离线，仍可查看历史文件','Offline — saved history is available'))+'</span><button id="localsend-send" class="ll-send" '+(busy||!nearby?'disabled':'')+'>'+icon('plus')+t('選擇檔案','选择文件','Choose file')+'</button></div></footer></section>';
  window.lucide.createIcons({root:host});
  const timeline=host.querySelector('.ll-timeline');
  timeline.querySelectorAll('[data-transfer-id]').forEach(el=>{if(expanded.has(el.dataset.transferId)){const details=el.querySelector('details');if(details)details.open=true;}});
  timeline.scrollTop=atBottom?timeline.scrollHeight:top;
  if(focused)host.querySelector('#'+focused)?.focus({preventScroll:true});
  const stillActive=()=>window.store.getState().activeChatId===peer.userId&&host.isConnected;
  host.querySelector('#localsend-send').onclick=async()=>{
   if(this.busy.has(peer.userId))return;
   this.busy.add(peer.userId);this.feedback.delete(peer.userId);this.render(peer,host);
   try{const result=await window.orbitAPI.invoke('locallink-send-selected',peer.userId);if(!result.ok&&!result.cancelled)this.feedback.set(peer.userId,result.error);}
   catch(error){this.feedback.set(peer.userId,error.message);}
   finally{this.busy.delete(peer.userId);if(stillActive())this.render(peer,host);}
  };
  host.querySelectorAll('[data-open],[data-folder]').forEach(button=>button.onclick=async()=>{
   try{const result=await window.orbitAPI.invoke('locallink-open-transfer',{id:button.dataset.open||button.dataset.folder,folder:!!button.dataset.folder});if(!result.ok)throw new Error(result.error);}
   catch(error){this.feedback.set(peer.userId,error.message);if(stillActive())host.querySelector('#localsend-feedback').textContent=error.message;}
  });
 }
};
window.orbitAPI.on('locallink-transfer-result',record=>{
 const state=window.store.getState();
 if(state.activeChatId===record.peerId){const peer=state.friends.find(p=>p.userId===record.peerId);if(peer)window.LocalSendPanel.render(peer,window.ChatPanel.container);}
 if(['delivered','received','failed'].includes(record.status))window.Toast?.show('LocalLink',record.name+' — '+window.LocalSendPanel.statusLabel(record.status),record.status==='failed'?'error':'success');
});
window.orbitAPI.on('locallink-transport-status',status=>{window.localSendStatus=status;if(!status.ok)window.Toast?.show('LocalSend',status.error,'error');});
window.orbitAPI.on('locallink-transfer-error',error=>window.Toast?.show('LocalSend',error,'error'));

window.LocalSendPanel = {
 batches:new Map(),
 expandedBatches:new Set(),
 preparations:new Map(),
 droppedFiles:new Map(),
 skippedFolders:new Map(),
 updatePreparation(host, peerId){
  const row=host.querySelector('.ll-preparation');
  if(!row)return;
  const state=this.preparations.get(peerId);
  row.hidden=!state;
  if(!state)return;
  const t=this.text.bind(this);
  const scanning=state.phase==='scan';
  row.querySelector('span').textContent=state.name+' · '+(scanning
    ? t('正在掃描','正在扫描','Scanning')+' · '+state.count
    : t('正在打包','正在打包','Packing')+' · '+this.size(state.bytes)+' / '+this.size(state.total));
  const bar=row.querySelector('progress');
  if(scanning||!state.total)bar.removeAttribute('value');
  else {bar.max=state.total;bar.value=Math.min(state.bytes,state.total);}
  row.querySelector('button').onclick=()=>window.orbitAPI.invoke('locallink-cancel-preparation',peerId);
 },
 busy: new Set(),
 feedback: new Map(),
 queries:new Map(),
 offsets:new Map(),
 drafts:new Map(),
 previews:new window.PreviewCache(id=>window.orbitAPI.invoke('locallink-preview-transfer',id)),
 text(tw,cn,en){return window.I18n.locale==='en'?en:window.I18n.locale==='zh-Hans'?cn:tw;},
 statusLabel(status){
  const labels={queued:['排隊中','排队中','Queued'],receiving:['接收中','接收中','Receiving'],verifying:['正在校驗','正在校验','Verifying'],confirming:['等待送達確認','等待送达确认','Awaiting delivery confirmation'],cancelled:['已取消','已取消','Cancelled'],preparing:['正在準備檔案','正在准备文件','Preparing file'],awaiting:['等待對方接收','等待对方接收','Awaiting acceptance'],transferring:['傳輸中','传输中','Transferring'],delivered:['已送達','已送达','Delivered'],received:['已接收','已接收','Received'],failed:['傳輸失敗','传输失败','Failed']};
  return this.text(...(labels[status]||['狀態未知','状态未知','Unknown status']));
 },
 errorLabel(error){
  const labels={
   'File size changed while preparing folder':['準備期間檔案大小已變更，請重新傳送資料夾','准备期间文件大小已更改，请重新发送文件夹','A file changed size. Send the folder again.'],
   'Device is no longer nearby':['裝置已離線，請重新搜尋','设备已离线，请重新搜索','Device is offline. Discover it again.'],
   'Device identity changed':['裝置身分已變更，請重新連接','设备身份已改变，请重新连接','Device identity changed. Connect to the device again.'],
   'Device certificate changed; rediscover the device':['裝置憑證已變更，請重新連接','设备证书已更改，请重新连接','Device certificate changed. Connect to the device again.'],
   'Cache cleanup in progress':['檔案正在清理，請重新選取','文件正在清理，请重新选择','File cleanup is in progress. Select the file again.'],
   'Only empty folders selected':['所選資料夾僅含空目錄，沒有可傳送的檔案','所选文件夹仅含空目录，没有可发送的文件','The selected folders contain no files to send'],
   'File list too large':['檔案清單過大，請按子資料夾分批傳送','文件清单过大，请按子目录分批发送','File list too large. Send subfolders separately.'],
   'Transfer interrupted':['上次傳輸已中斷，可重新傳送','上次传输已中断，可重新发送','Transfer was interrupted. You can retry.'],
   'Transfer timed out':['連線逾時，請檢查對方裝置','连接超时，请检查对方设备','Connection timed out. Check the other device.'],
   'Not enough space for temporary ZIP':['暫存 ZIP 的磁碟空間不足','临时 ZIP 所在磁盘空间不足','Not enough disk space for the temporary ZIP'],
   'Not enough disk space':['接收磁碟空間不足','接收磁盘空间不足','Not enough disk space'],
   'File integrity check failed':['檔案校驗失敗，請重試','文件校验失败，请重试','File integrity check failed. Retry the transfer.'],
   'Receiver did not accept this file':['對方未接收此檔案','对方未接收此文件','The receiver did not accept this file'],
   'File selection exceeds transfer limit or has an unsupported name':['檔案大小無效或名稱不受支援','文件大小无效或名称不受支持','Invalid file size or unsupported name'],
   'Enter an IP address with an optional port':['請輸入 IP 位址，可附加連接埠','请输入 IP 地址，可附加端口','Enter an IP address with an optional port']
  };
  if(error?.includes('HTTP 401'))return this.text('對方需要 PIN，按重試輸入','对方需要 PIN，按重试输入','The receiver requires a PIN. Choose Retry.');
  if(error?.includes('HTTP 403'))return this.text('對方已拒絕接收','对方已拒绝接收','The receiver declined the transfer');
  if(error?.includes('HTTP 507'))return this.text(...labels['Not enough disk space']);
  if(error?.includes('HTTP 409'))return this.text('對方正在處理其他傳輸','对方正在处理其他传输','The receiver is busy');
  return labels[error]?this.text(...labels[error]):error;
 },
 size(bytes){if(!Number.isFinite(bytes))return '';const units=['B','KB','MB','GB'];let u=0;while(bytes>=1000&&u<3){bytes/=1000;u++;}return (u?bytes.toFixed(1):bytes)+' '+units[u];},
 askPin(){
  const t=this.text.bind(this);
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog');dialog.className='ll-connect-dialog';let pin=null;
   dialog.innerHTML=`<form><button type="button" class="ll-dialog-close" aria-label="${t('關閉','关闭','Close')}">×</button><h2>${t('輸入對方的 PIN','输入对方的 PIN','Enter the receiver’s PIN')}</h2><input type="password" inputmode="numeric" maxlength="32" aria-label="PIN" required autocomplete="off"><button class="ll-send">${t('重試','重试','Retry')}</button></form>`;
   dialog.querySelector('form').onsubmit=e=>{e.preventDefault();pin=dialog.querySelector('input').value;dialog.close();};
   dialog.querySelector('.ll-dialog-close').onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();resolve(pin);};
   document.body.appendChild(dialog);dialog.showModal();dialog.querySelector('input[type=search],input').focus();
  });
 },
 browserLabel(){return this.text('瀏覽器互傳','浏览器互传','Browser sharing');},
 history(initialPeer, batchId){
  if(document.getElementById('ll-history-dialog'))return;
  const t=this.text.bind(this),esc=window.Sanitize.escapeHtml;
  const dialog=document.createElement('dialog');dialog.id='ll-history-dialog';dialog.className='ll-history-dialog';
  dialog.innerHTML=`<button class="ll-dialog-close" aria-label="${t('關閉','关闭','Close')}">×</button><h2>${t('傳輸記錄','传输记录','Transfer history')}</h2><div class="ll-history-filters"><input type="search" placeholder="${t('搜尋檔名','搜索文件名','Search file names')}" aria-label="${t('搜尋檔名','搜索文件名','Search file names')}"><select aria-label="${t('方向','方向','Direction')}"><option value="">${t('全部','全部','All')}</option><option value="incoming">${t('接收','接收','Received')}</option><option value="outgoing">${t('傳送','发送','Sent')}</option></select></div><div class="ll-history-rows"></div><button id="ll-history-newer">${t('上一頁','上一页','Previous page')}</button><button id="ll-history-more">${t('載入更多','加载更多','Load more')}</button>`;
  const filters=document.createElement('div');filters.className='ll-history-filters';filters.innerHTML=`<select id="ll-history-status" aria-label="${t('狀態','状态','Status')}"><option value="">${t('所有狀態','所有状态','All statuses')}</option>${['received','delivered','failed','cancelled'].map(s=>'<option value="'+s+'">'+this.statusLabel(s)+'</option>').join('')}</select><select id="ll-history-kind" aria-label="${t('檔案類型','文件类型','File type')}"><option value="">${t('所有類型','所有类型','All types')}</option><option value="image">${t('圖片','图片','Images')}</option><option value="text">${t('文字','文字','Text')}</option><option value="archive">ZIP / 7z / RAR</option></select><label class="ll-history-date">${t('開始日期','开始日期','From date')}<input id="ll-history-from" type="date" aria-label="${t('開始日期','开始日期','From date')}"></label><label class="ll-history-date">${t('結束日期','结束日期','To date')}<input id="ll-history-to" type="date" aria-label="${t('結束日期','结束日期','To date')}"></label>`;
  const device=document.createElement('select');device.id='ll-history-device';device.setAttribute('aria-label',t('裝置','设备','Device'));device.innerHTML='<option value="">'+t('所有裝置','所有设备','All devices')+'</option>'+window.store.getState().friends.filter(p=>p.userId.startsWith('localsend:')).map(p=>'<option value="'+esc(p.userId)+'">'+esc(window.LocalLinkDevices.name(p))+'</option>').join('');device.add(new Option(this.browserLabel(),'web:browser'));if(initialPeer)device.value=initialPeer;filters.appendChild(device);
  dialog.querySelector('.ll-history-rows').before(filters);
  const cleanup=document.createElement('button');cleanup.disabled=true;cleanup.className='ll-load-more';cleanup.textContent=t('清理選中的檔案','清理选中的文件','Clean up selected files');dialog.querySelector('.ll-history-rows').after(cleanup);
  cleanup.onclick=async()=>{const ids=[...dialog.querySelectorAll('[data-cleanup-id]:checked')].map(input=>input.dataset.cleanupId);if(!ids.length)return;const result=await window.orbitAPI.invoke('locallink-storage-cleanup',ids);if(result.error)window.Toast?.show('LocalLink',result.error,'error');render();};
  if(batchId){dialog.querySelector('#ll-history-status').value='failed';device.disabled=true;}
  const limit=100;let offset=0;
  const render=()=>{
   const rows=window.orbitAPI.sendSync('locallink-list-transfers',{batchId,peerId:dialog.querySelector('#ll-history-device').value||undefined,query:dialog.querySelector('input').value,direction:dialog.querySelector('select').value,status:dialog.querySelector('#ll-history-status').value,kind:dialog.querySelector('#ll-history-kind').value,from:dialog.querySelector('#ll-history-from').value?new Date(dialog.querySelector('#ll-history-from').value+'T00:00:00').getTime():undefined,to:dialog.querySelector('#ll-history-to').value?new Date(dialog.querySelector('#ll-history-to').value+'T23:59:59.999').getTime()+1:undefined,limit,offset});
   dialog.querySelector('.ll-history-rows').innerHTML=rows.map(r=>{
    const peer=window.store.getState().friends.find(p=>p.userId===r.peerId);
    return '<div class="ll-history-row">'+(r.direction==='incoming'&&r.status==='received'&&r.path?'<input type="checkbox" data-cleanup-id="'+esc(r.id)+'" aria-label="'+esc(t('選取 ','选择 ','Select ')+r.name)+'">':'')+'<button data-history-peer="'+esc(r.peerId)+'"><strong>'+esc(r.name)+'</strong><span>'+esc(r.peerId==='web:browser'?this.browserLabel():peer?window.LocalLinkDevices.name(peer):r.peerId)+' · '+esc(this.statusLabel(r.status))+' · '+new Date(r.startedAt||r.time).toLocaleString()+'</span></button>'+(['delivered','received','failed','cancelled'].includes(r.status)?'<button data-remove-record="'+esc(r.id)+'">'+t('移除記錄','移除记录','Remove record')+'</button>':'')+(r.direction==='incoming'&&r.status==='received'&&r.path?'<button data-trash-file="'+esc(r.id)+'">'+t('清理檔案','清理文件','Clean up file')+'</button>':'')+'</div>';
   }).join('')||'<p>'+t('沒有符合的記錄','没有匹配的记录','No matching records')+'</p>';
   cleanup.disabled=true;
   dialog.querySelectorAll('[data-cleanup-id]').forEach(input=>input.onchange=()=>{cleanup.disabled=!dialog.querySelector('[data-cleanup-id]:checked');});
   dialog.querySelector('#ll-history-newer').hidden=offset===0;
   dialog.querySelector('#ll-history-more').hidden=rows.length<limit;
   dialog.querySelectorAll('[data-history-peer]').forEach(button=>button.onclick=()=>{const id=button.dataset.historyPeer;if(id==='web:browser'){device.value=id;offset=0;render();window.LocalLinkSelect.enhance(dialog);return;}dialog.close();if(!window.store.getState().friends.some(p=>p.userId===id))window.store.addOrUpdatePeer({userId:id,username:id.slice(0,24),usertag:'LocalSend',status:'offline'});window.store.setState({activeChatId:id});});
   dialog.querySelectorAll('[data-trash-file]').forEach(button=>button.onclick=async()=>{const result=await window.orbitAPI.invoke('locallink-storage-cleanup',[button.dataset.trashFile]);if(result.error)window.Toast?.show('LocalLink',result.error,'error');render();});
   dialog.querySelectorAll('[data-remove-record]').forEach(button=>button.onclick=async()=>{await window.orbitAPI.invoke('locallink-delete-record',button.dataset.removeRecord);render();});
  };
  dialog.querySelector('.ll-dialog-close').onclick=()=>dialog.close();
  dialog.querySelector('input[type=search]').oninput=()=>{offset=0;render();};dialog.querySelector('select').onchange=()=>{offset=0;render();};
  filters.querySelectorAll('select,input').forEach(input=>input.onchange=()=>{offset=0;render();});
  dialog.querySelector('#ll-history-newer').onclick=()=>{offset=Math.max(0,offset-limit);render();};
  dialog.querySelector('#ll-history-more').onclick=()=>{offset+=100;render();};
  dialog.onclose=()=>{window.LocalLinkSelect.close();dialog.remove();};
  document.body.appendChild(dialog);render();window.LocalLinkSelect.enhance(dialog);dialog.showModal();dialog.querySelector('input[type=search],input').focus();
 },
 skippedFiles(count){
  return count ? this.text('未加入的項目','未加入的项目','Items skipped')+' · '+count+' ('+this.text('重複、非一般檔案或已達上限','重复、非普通文件或已达上限','duplicates, unavailable files or limit reached')+')' : '';
 },
 bindFileDrop(surface,canDrop,onFiles){
  surface.ondragover=event=>{
   if(!event.dataTransfer.types.includes('Files'))return;
   event.preventDefault();event.stopPropagation();
   const enabled=canDrop();
   event.dataTransfer.dropEffect=enabled?'copy':'none';
   surface.classList.toggle('ll-drop-ready',enabled);
  };
  surface.ondragleave=event=>{
   if(!surface.contains(event.relatedTarget))surface.classList.remove('ll-drop-ready');
  };
  surface.ondrop=event=>{
   if(!event.dataTransfer.types.includes('Files'))return;
   event.preventDefault();event.stopPropagation();surface.classList.remove('ll-drop-ready');
   if(canDrop())onFiles([...event.dataTransfer.files].map(file=>window.orbitAPI.getPathForFile(file)).filter(Boolean));
  };
 },
 render(peer,host){
  const t=this.text.bind(this), esc=window.Sanitize.escapeHtml;
  const old=host.querySelector('.ll-timeline');
  const same=old?.dataset.peerId===peer.userId;
  const top=old?.scrollTop||0, atBottom=!same||old.scrollHeight-old.clientHeight-top<60;
  const activeElement=document.activeElement;
  const focused=host.contains(activeElement)?activeElement.id:null;
  const selection=focused&&activeElement.selectionStart;
  const nearby=window.LocalLinkDevices.isNearby(peer), busy=this.busy.has(peer.userId);
  const canSend=nearby||peer.manualEndpoint===true;
  const name=window.LocalLinkDevices.name(peer);
  const query=this.queries.get(peer.userId)||'',limit=100,offset=this.offsets.get(peer.userId)||0;
  const records=window.orbitAPI.sendSync('locallink-list-transfers',{peerId:peer.userId,query,limit,offset}).reverse();
  const icon=type=>'<i data-lucide="'+type+'" aria-hidden="true"></i>';
  const locale=window.I18n.locale==='en'?'en':window.I18n.locale==='zh-Hans'?'zh-CN':'zh-TW';
  let lastDate='', feed='';
  const visibleBatches=new Set();
  for(const r of records){
   const date=new Date(r.startedAt||r.time), day=date.toLocaleDateString(locale,{year:'numeric',month:'long',day:'numeric'});
   if(day!==lastDate){feed+='<div class="ll-date"><span>'+esc(day)+'</span></div>';lastDate=day;}
   const incoming=r.direction==='incoming'||r.status==='received';
   if(r.batchCount>8 && !query){
    if(!visibleBatches.has(r.batchId)){
     visibleBatches.add(r.batchId);
     const batch=this.batches.get(r.batchId)||window.orbitAPI.sendSync('locallink-batch-summary',r.batchId);
     const caption=t('批次傳輸','批量传输','Batch transfer')+' · '+(batch?batch.finished+' / ':'')+r.batchCount;
     feed+='<article class="ll-transfer '+(incoming?'ll-incoming':'ll-outgoing')+'"><div class="ll-bubble"><strong>'+caption+'</strong>'+
      (batch?' · '+this.statusLabel(incoming?'received':'delivered')+' '+(batch.finished-batch.failed-batch.cancelled):'')+
      (batch?.failed?' · '+this.statusLabel('failed')+' '+batch.failed:'')+(batch?.cancelled?' · '+this.statusLabel('cancelled')+' '+batch.cancelled:'')+
      '<div class="ll-file-actions"><button data-show-batch="'+esc(r.batchId)+'" aria-expanded="'+this.expandedBatches.has(r.batchId)+'">'+icon('files')+t('檔案明細','文件明细','File details')+'</button>'+
       (batch?.failed?'<button data-failed-batch="'+esc(r.batchId)+'">'+icon('circle-alert')+t('查看失敗項目','查看失败项目','View failed files')+'</button>':'')+'</div></div></article>';
    }
    if(!this.expandedBatches.has(r.batchId))continue;
   }
   const done=['delivered','received'].includes(r.status), failed=r.status==='failed';
   const active=['queued','preparing','awaiting','transferring','receiving','verifying','confirming'].includes(r.status);
   const progress=Number.isFinite(r.bytes)&&['transferring','receiving','confirming'].includes(r.status);
   const ext=(r.name.split('.').pop()||'').toLowerCase();
   const fileIcon=['png','jpg','jpeg','webp','gif'].includes(ext)?'file-image':['mp4','mov','mkv'].includes(ext)?'file-video':['zip','7z','rar'].includes(ext)?'file-archive':'file-text';
   feed+='<article class="ll-transfer '+(incoming?'ll-incoming':'ll-outgoing')+'" data-transfer-id="'+esc(r.id)+'" data-status="'+esc(r.status)+'">'+
    '<div class="ll-bubble">'+(r.kind==='text'?'<p class="ll-text-content selectable">'+esc(r.text||'')+'</p>':((done&&['png','jpg','jpeg','webp','gif'].includes(ext)?'<img class="ll-image-preview" data-preview="'+esc(r.id)+'" alt="'+esc(r.name)+'" hidden>':'')+'<div class="ll-file-main"><span class="ll-file-icon">'+icon(fileIcon)+'</span><div class="ll-file-copy"><strong class="selectable">'+esc(r.name)+'</strong><span>'+this.size(r.size)+'</span></div></div>'))+
    '<div class="ll-file-state '+(failed?'ll-error':'')+'">'+icon(failed?'circle-alert':done?'check-check':'clock-3')+'<span>'+esc(this.statusLabel(r.status))+'</span></div>'+
    (progress?'<div class="ll-progress"><progress max="'+Math.max(1,r.size)+'" value="'+Math.min(r.bytes,r.size)+'" aria-label="'+esc(this.statusLabel(r.status))+'"></progress><span>'+this.size(r.bytes)+' / '+this.size(r.size)+(r.rate?' · '+this.size(r.rate)+'/s':'')+'</span></div>':'')+
    (active?'<div class="ll-file-actions"><button data-cancel="'+esc(r.id)+'">'+icon('x')+t('取消本批次','取消本批次','Cancel batch')+'</button></div>':'')+
    ((!incoming&&(failed||r.status==='cancelled'))?'<div class="ll-file-actions"><button data-retry="'+esc(r.id)+'" '+(!canSend||busy?'disabled':'')+'>'+icon('rotate-ccw')+t('重試','重试','Retry')+'</button></div>':'')+
    (failed?'<p class="ll-error-detail selectable">'+esc(this.errorLabel(r.error)||t('請重新選擇檔案再試一次','请重新选择文件再试一次','Choose the file to try again'))+'</p>':'')+
    (done&&r.kind==='text'&&!r.path?'<div class="ll-file-actions"><button data-copy="'+esc(r.id)+'">'+icon('copy')+t('複製','复制','Copy')+'</button></div>':'')+
    (done&&r.path?'<div class="ll-file-actions">'+(r.kind==='text'?'<button data-copy="'+esc(r.id)+'">'+icon('copy')+t('複製','复制','Copy')+'</button>':'')+'<button data-open="'+esc(r.id)+'">'+icon('file')+t('開啟','打开','Open')+'</button><button data-folder="'+esc(r.id)+'">'+icon('folder-open')+t('所在資料夾','所在目录','Show in folder')+'</button></div>':'')+
    ''+'</div>'+
    '<div class="ll-message-meta">'+esc(incoming?name:t('本裝置','本设备','This device'))+' · <time datetime="'+date.toISOString()+'">'+date.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',hour12:false})+'</time></div></article>';
  }
  host.style.display='flex';host.style.flexDirection='column';
  host.innerHTML='<section class="ll-conversation">'+
   '<header class="chat-header ll-chat-header"><span class="ll-device-icon">'+icon(window.LocalLinkDevices.icon(peer))+'</span><div class="ll-peer-heading"><h2>'+esc(name)+'</h2><p><span class="ll-presence '+(nearby?'online':'')+'"></span>'+t(nearby?'附近的裝置':'裝置離線',nearby?'附近的设备':'设备离线',nearby?'Nearby device':'Device offline')+'<span class="ll-protocol"> · LocalSend</span></p></div><button id="ll-open-receive-folder" class="ll-header-folder" title="'+t('開啟接收資料夾','打开接收文件夹','Open receive folder')+'">'+icon('folder-open')+'<span>'+t('開啟資料夾','打开文件夹','Open folder')+'</span></button><button id="btn-device-details" class="ll-icon-button" title="'+t('裝置詳情','设备详情','Device details')+'" aria-label="'+t('裝置詳情','设备详情','Device details')+'">'+icon('info')+'</button></header>'+
   '<div class="ll-conversation-tools"><input id="ll-search-files" type="search" value="'+esc(query)+'" placeholder="'+t('搜尋此裝置的檔案','搜索此设备的文件','Search files on this device')+'" aria-label="'+t('搜尋檔案','搜索文件','Search files')+'"></div>'+
   '<div class="ll-timeline" role="region" aria-label="'+t('檔案會話','文件会话','File conversation')+'" tabindex="0" data-peer-id="'+esc(peer.userId)+'">'+(offset?'<button id="ll-newer-records" class="ll-load-more">'+t('較新記錄','较新记录','Newer records')+'</button>':'')+(records.length===limit?'<button id="ll-more-records" class="ll-load-more">'+t('載入更早記錄','加载更早记录','Load earlier records')+'</button>':'')+(feed||(query?'<p class="ll-conversation-empty">'+t('沒有符合的檔案','没有匹配的文件','No matching files')+'</p>':'<div class="ll-conversation-empty"><span class="ll-empty-icon">'+icon('files')+'</span><h3>'+t('與此裝置分享檔案','与此设备分享文件','Share files with this device')+'</h3><p>'+t('傳送和接收的檔案會依時間顯示在這裡','发送和接收的文件会按时间显示在这里','Sent and received files appear here in order')+'</p></div>'))+'</div>'+
   '<footer class="ll-composer"><p id="localsend-feedback" role="status">'+esc(this.feedback.get(peer.userId)||'')+'</p><div class="ll-compose-wrapper"><button id="localsend-send" class="ll-icon-button" title="'+t('選擇檔案','选择文件','Choose files')+'" aria-label="'+t('選擇檔案','选择文件','Choose files')+'" '+(busy||!canSend?'disabled':'')+'>'+icon('file')+'</button><textarea id="ll-message-input" rows="1" maxlength="65000" placeholder="'+t(canSend?'輸入文字、連結，或拖入檔案':'裝置離線，仍可查看記錄',canSend?'输入文字、链接，或拖入文件':'设备离线，仍可查看记录',canSend?'Write text, a link, or drop files':'Offline — saved history is available')+'" aria-label="'+t('文字或連結','文字或链接','Text or link')+'">'+esc(this.drafts.get(peer.userId)||'')+'</textarea><button id="ll-send-text" class="ll-send" '+(busy||!canSend||!this.drafts.get(peer.userId)?.trim()?'disabled':'')+'>'+icon('send')+t('傳送','发送','Send')+'</button></div></footer></section>';
  window.lucide.createIcons({root:host});
  const preparation=document.createElement('div');
  preparation.className='ll-preparation';
  preparation.innerHTML='<span role="status"></span><progress aria-label="'+t('打包進度','打包进度','Packing progress')+'"></progress><button type="button">'+t('取消準備','取消准备','Cancel preparation')+'</button>';
  host.querySelector('.ll-compose-wrapper').before(preparation);
  this.updatePreparation(host,peer.userId);
  const omitted=this.skippedFolders.get(peer.userId);
  if(omitted?.length){
   const details=document.createElement('details'),summary=document.createElement('summary');
   details.className='ll-skipped-folders';
   summary.textContent=t('已略過空目錄','已跳过空目录','Skipped empty folders')+' · '+omitted.length;
   details.append(summary);
   const more=document.createElement('button');
   more.textContent=t('顯示更多','显示更多','Show more');details.append(more);
   let shown=0;
   const showFolders=()=>{
    for(const name of omitted.slice(shown,shown+50)){
     const row=document.createElement('div');row.textContent=name;more.before(row);shown++;
    }
    more.hidden=shown===omitted.length;
   };
   more.onclick=showFolders;
   details.ontoggle=()=>{if(details.open&&!shown)showFolders();};
   host.querySelector('.ll-compose-wrapper').before(details);
  }
  const timeline=host.querySelector('.ll-timeline');
  timeline.scrollTop=atBottom?timeline.scrollHeight:top;
  if(focused){const el=host.querySelector('#'+focused);el?.focus({preventScroll:true});if(typeof selection==='number'&&el?.setSelectionRange)el.setSelectionRange(selection,selection);}
  const stillActive=()=>window.store.getState().activeChatId===peer.userId&&host.isConnected;
  const run=async(channel,payload)=>{
   if(!stillActive()||this.busy.has(peer.userId))return;
   this.busy.add(peer.userId);this.feedback.delete(peer.userId);this.skippedFolders.delete(peer.userId);this.render(peer,host);
   try{const result=await window.orbitAPI.invoke(channel,payload);if(result.preparationCancelled)this.feedback.set(peer.userId,t('已取消準備','已取消准备','Preparation cancelled'));else if(!result.ok&&!result.cancelled)this.feedback.set(peer.userId,this.errorLabel(result.error));else if(result.emptyFolders?.length)this.skippedFolders.set(peer.userId,result.emptyFolders);else if(result.ok&&channel==='locallink-send-content'&&payload.text===this.drafts.get(peer.userId))this.drafts.delete(peer.userId);return result;}
   catch(error){this.feedback.set(peer.userId,error.message);}
   finally{this.busy.delete(peer.userId);if(stillActive())this.render(peer,host);}
  };
  const trust=document.createElement('button');trust.className='ll-icon-button';trust.id='ll-trust-shield';trust.dataset.trustShield=peer.userId;trust.innerHTML=icon('shield-check');trust.onclick=()=>window.LocalLinkDevices.edit(peer);host.querySelector('#localsend-send').before(trust);window.lucide.createIcons({root:trust});window.LocalLinkDevices.refreshTrust();
  host.querySelector('#ll-open-receive-folder').onclick=async()=>{
   try{const result=await window.orbitAPI.invoke('locallink-open-directory');if(!result.ok)throw new Error(result.error||t('無法開啟資料夾','无法打开文件夹','Could not open folder'));}
   catch(error){this.feedback.set(peer.userId,error.message);if(stillActive())host.querySelector('#localsend-feedback').textContent=error.message;}
  };
  host.querySelector('#localsend-send').onclick=()=>run('locallink-send-selected',peer.userId);
  const folder=document.createElement('button');folder.className='ll-icon-button';folder.id='ll-send-folder';folder.title=t('傳送資料夾','发送文件夹','Send folder');folder.setAttribute('aria-label',folder.title);folder.innerHTML=icon('folder-plus');folder.disabled=busy||!canSend;folder.onclick=()=>run('locallink-send-folder',peer.userId);host.querySelector('#localsend-send').after(folder);window.lucide.createIcons({root:folder});
  const message=host.querySelector('#ll-message-input');
  message.oninput=()=>{this.drafts.set(peer.userId,message.value);host.querySelector('#ll-send-text').disabled=busy||!canSend||!message.value.trim();};
  const sendText=()=>{if(canSend&&!this.busy.has(peer.userId)&&message.value.trim())run('locallink-send-content',{peerId:peer.userId,text:message.value});};
  host.querySelector('#ll-send-text').onclick=sendText;
  message.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();sendText();}};
  host.onpaste=async event=>{
   if(!canSend||this.busy.has(peer.userId))return;
   const files=[...(event.clipboardData?.files||[])];if(!files.length)return;
   event.preventDefault();
   const paths=files.map(file=>window.orbitAPI.getPathForFile(file)).filter(Boolean);
   if(paths.length===files.length){run('locallink-send-paths',{peerId:peer.userId,paths});return;}
   const file=files[0];if(!file.type.startsWith('image/')||file.size>32*1024*1024){this.feedback.set(peer.userId,t('請選擇約 33.55 MB 以內的圖片','请选择约 33.55 MB 以内的图片','Choose an image up to about 33.55 MB'));this.render(peer,host);return;}
   run('locallink-send-content',{peerId:peer.userId,type:file.type,bytes:new Uint8Array(await file.arrayBuffer())});
  };
  host.querySelectorAll('[data-failed-batch]').forEach(button=>button.onclick=()=>this.history(peer.userId,button.dataset.failedBatch));
  host.querySelectorAll('[data-show-batch]').forEach(button=>button.onclick=()=>{
   const id=button.dataset.showBatch;
   if(this.expandedBatches.has(id))this.expandedBatches.delete(id);else this.expandedBatches.add(id);
   this.render(peer,host);
  });
  host.querySelectorAll('[data-copy]').forEach(button=>button.onclick=()=>window.orbitAPI.send('write-clipboard',records.find(r=>r.id===button.dataset.copy)?.text||''));
  host.querySelectorAll('[data-preview]').forEach(async img=>{
   const id=img.dataset.preview;
   const src=await this.previews.get(id,()=>img.isConnected);if(src&&img.isConnected){const follow=timeline.scrollHeight-timeline.clientHeight-timeline.scrollTop<60;const before=timeline.scrollTop;img.onload=()=>{if(follow&&Math.abs(timeline.scrollTop-before)<2)timeline.scrollTop=timeline.scrollHeight;};img.src=src;img.hidden=false;}
  });

  host.querySelector('#ll-search-files').oninput=event=>{this.queries.set(peer.userId,event.target.value);this.offsets.delete(peer.userId);this.render(peer,host);};
  host.querySelector('#ll-more-records')?.addEventListener('click',()=>{this.offsets.set(peer.userId,offset+limit);this.render(peer,host);});
  host.querySelector('#ll-newer-records')?.addEventListener('click',()=>{this.offsets.set(peer.userId,Math.max(0,offset-limit));this.render(peer,host);});
  host.querySelectorAll('[data-retry]').forEach(button=>button.onclick=async()=>{const r=records.find(r=>r.id===button.dataset.retry);let pin;if(r?.error?.includes('HTTP 401')){pin=await this.askPin();if(pin===null)return;}run('locallink-retry-transfer',{id:button.dataset.retry,pin});});
  host.querySelectorAll('[data-cancel]').forEach(button=>button.onclick=async()=>{button.disabled=true;await window.orbitAPI.invoke('locallink-cancel-transfer',button.dataset.cancel);});
  const mergeSelection=items=>[...new Map(items.map(item=>[typeof item==='string'?item:item.path,item])).values()];
  const staged=this.droppedFiles.get(peer.userId)||[];
  if(staged.length){
   const bar=document.createElement('div');bar.className='ll-file-actions';
   const label=document.createElement('span');label.textContent=t('待傳送','待发送','Selected')+' · '+staged.length;label.title=staged.map(item=>item.path||item).join('\n');
   const clear=document.createElement('button');clear.textContent=t('清空','清空','Clear');
   clear.onclick=()=>{this.droppedFiles.delete(peer.userId);this.render(peer,host);};
   const send=document.createElement('button');send.disabled=busy||!canSend;send.textContent=t('傳送檔案','发送文件','Send files');
   send.onclick=async()=>{
    this.droppedFiles.delete(peer.userId);
    const result=await run('locallink-send-paths',{peerId:peer.userId,paths:staged});
    const retry=result?.remaining??(result?.ok?[]:staged);
    if(retry.length){
     this.droppedFiles.set(peer.userId,mergeSelection([...(this.droppedFiles.get(peer.userId)||[]),...retry]));
     if(stillActive())this.render(peer,host);
    }
   };
   bar.append(label,clear,send);host.querySelector('.ll-compose-wrapper').before(bar);
  }
  this.bindFileDrop(host.querySelector('.ll-conversation'),()=>canSend,paths=>{
   this.droppedFiles.set(peer.userId,mergeSelection([...paths,...staged]));this.render(peer,host);
  });
  host.querySelectorAll('[data-open],[data-folder]').forEach(button=>button.onclick=async()=>{
   try{const result=await window.orbitAPI.invoke('locallink-open-transfer',{id:button.dataset.open||button.dataset.folder,folder:!!button.dataset.folder});if(!result.ok)throw new Error(result.error);}
   catch(error){this.feedback.set(peer.userId,error.message);if(stillActive())host.querySelector('#localsend-feedback').textContent=error.message;}
  });
 }
};
window.orbitAPI.on('locallink-transfer-result',record=>{
 const state=window.store.getState();
 if(state.activeChatId===record.peerId){
  const panel=window.LocalSendPanel,host=window.ChatPanel.container;
  const card=[...host.querySelectorAll('[data-transfer-id]')].find(el=>el.dataset.transferId===record.id);
  if(card?.dataset.status===record.status&&['transferring','receiving'].includes(record.status)&&card.querySelector('progress')){
   card.querySelector('progress').value=Math.min(record.bytes||0,record.size);
   card.querySelector('.ll-progress span').textContent=panel.size(record.bytes||0)+' / '+panel.size(record.size)+(record.rate?' · '+panel.size(record.rate)+'/s':'');
  }else{const peer=state.friends.find(p=>p.userId===record.peerId);if(peer)panel.render(peer,host);}
 }
 if(['delivered','received','failed'].includes(record.status)&&!state.settings.notifyDnd&&window.orbitAPI.dbGetSetting('locallink.transferNotifications',true))window.Toast?.show('LocalLink',record.name+' — '+window.LocalSendPanel.statusLabel(record.status),record.status==='failed'?'error':'success');
});
window.orbitAPI.on('locallink-batch-progress',batch=>{
 const panel=window.LocalSendPanel,state=window.store.getState();
 panel.batches.set(batch.id,batch);
 if(panel.batches.size>128){
  for(const [id,item] of panel.batches)if(item.finished===item.total){panel.batches.delete(id);panel.expandedBatches.delete(id);break;}
 }
 if(state.activeChatId===batch.peerId){
  const peer=state.friends.find(p=>p.userId===batch.peerId);
  if(peer)panel.render(peer,window.ChatPanel.container);
 }
 if(batch.finished===batch.total&&!state.settings.notifyDnd&&window.orbitAPI.dbGetSetting('locallink.transferNotifications',true)){
  const message=panel.text('批次傳輸','批量传输','Batch transfer')+' · '+(batch.total-batch.failed-batch.cancelled)+' / '+batch.total;
  window.Toast?.show('LocalLink',message,batch.failed?'error':'info');
 }
});
window.orbitAPI.on('locallink-transport-status',status=>{window.localSendStatus=status;if(!status.ok)window.Toast?.show('LocalSend',status.error,'error');});
window.orbitAPI.on('locallink-transfer-error',error=>window.Toast?.show('LocalSend',error,'error'));

window.orbitAPI.on('locallink-history-changed',()=>{
 window.LocalSendPanel.previews.clear();const state=window.store.getState();
 const peer=state.friends.find(p=>p.userId===state.activeChatId);
 if(peer?.userId.startsWith('localsend:'))window.LocalSendPanel.render(peer,window.ChatPanel.container);
});

window.orbitAPI.on('locallink-folder-progress', state=>{
 const panel=window.LocalSendPanel;
 if(state.phase==='done')panel.preparations.delete(state.peerId);
 else panel.preparations.set(state.peerId,state);
 const timeline=document.querySelector('.ll-timeline');
 if(timeline?.dataset.peerId===state.peerId)panel.updatePreparation(timeline.parentElement,state.peerId);
});

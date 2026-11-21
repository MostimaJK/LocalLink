// Device-wide views over the existing indexed transfer store.
window.TransferCenter={
 active:['queued','preparing','awaiting','transferring','confirming','receiving','verifying'],
 options:{tasks:{query:'',filter:'active',offset:0},received:{query:'',filter:'',offset:0}},
 open(mode){window.store.setState({activeTab:'dms',activeView:'friends',activeChatId:'locallink-view:'+mode});},
 badge(){
  const button=document.getElementById('btn-nav-gallery');if(!button||window.orbitAPI.dbGetSetting('locallink.transport','localsend')!=='localsend')return;
  const count=window.orbitAPI.sendSync('locallink-list-transfers',{statuses:this.active,limit:1000}).length;
  let badge=button.querySelector('.ll-task-badge');if(!badge){badge=document.createElement('span');badge.className='ll-task-badge';button.append(badge);}badge.textContent=count>=1000?'999+':String(count);badge.hidden=!count;
 },
 render(host,mode){
  if(!['tasks','received'].includes(mode))return;
  host.style.display='flex';this.host=host;this.mode=mode;
  const t=window.LocalSendPanel.text.bind(window.LocalSendPanel),esc=window.Sanitize.escapeHtml,o=this.options[mode];
  const choices=mode==='tasks'?[['active',t('進行中','进行中','In progress')],['failed',t('失敗與取消','失败与取消','Failed and cancelled')],['completed',t('已完成','已完成','Completed')]]:[['',t('全部類型','全部类型','All types')],['image',t('圖片','图片','Images')],['text',t('文字檔','文本文件','Text files')],['archive',t('壓縮檔','压缩文件','Archives')]];
  host.innerHTML=`<section class="ll-center"><header><h2>${mode==='tasks'?t('傳輸任務','传输任务','Transfers'):t('已接收檔案','已接收文件','Received files')}</h2><div class="ll-file-actions"><button id="ll-center-folder">${t('開啟接收資料夾','打开接收文件夹','Open receive folder')}</button></div></header><div class="ll-center-toolbar"><input type="search" id="ll-center-search" aria-label="${t('搜尋檔名','搜索文件名','Search file names')}" placeholder="${t('搜尋檔名','搜索文件名','Search file names')}" value="${esc(o.query)}"><select id="ll-center-filter" aria-label="${t('篩選','筛选','Filter')}">${choices.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')}</select>${mode==='received'?'<button class="ll-primary-button" id="ll-center-clean" disabled>'+t('清理選中檔案','清理选中文件','Clean selected files')+'</button>':''}</div><p id="ll-center-feedback" role="status"></p><div class="ll-center-rows"></div><footer class="ll-file-actions"><button id="ll-center-prev">${t('上一頁','上一页','Previous')}</button><button id="ll-center-next">${t('下一頁','下一页','Next')}</button></footer></section>`;
  const filter=host.querySelector('#ll-center-filter');filter.value=o.filter;
  filter.onchange=()=>{o.filter=filter.value;o.offset=0;this.rows();};
  host.querySelector('#ll-center-search').oninput=e=>{o.query=e.target.value;o.offset=0;this.rows();};
  host.querySelector('#ll-center-prev').onclick=()=>{o.offset=Math.max(0,o.offset-100);this.rows();};host.querySelector('#ll-center-next').onclick=()=>{o.offset+=100;this.rows();};
  host.querySelector('#ll-center-folder').onclick=()=>this.action('locallink-open-directory');
  host.querySelector('#ll-center-clean')?.addEventListener('click',()=>this.action('locallink-storage-cleanup',[...host.querySelectorAll('[data-clean]:checked')].map(e=>e.dataset.clean)));
  window.LocalLinkSelect.enhance(host);this.rows();this.badge();
 },
 async action(channel,args){
  const feedback=this.host?.querySelector('#ll-center-feedback');
  try{const result=await window.orbitAPI.invoke(channel,args);if(result?.error)throw new Error(result.error);if(feedback?.isConnected)feedback.textContent='';}
  catch(error){if(feedback?.isConnected)feedback.textContent=window.LocalSendPanel.errorLabel(error.message);}
  if(window.store.getState().activeChatId==='locallink-view:'+this.mode)this.rows();
 },
 rows(){
  const host=this.host,mode=this.mode;if(!host?.querySelector('.ll-center-rows')||window.store.getState().activeChatId!=='locallink-view:'+mode)return;
  const panel=window.LocalSendPanel,t=panel.text.bind(panel),esc=window.Sanitize.escapeHtml,o=this.options[mode];
  const statuses=o.filter==='active'?this.active:o.filter==='failed'?['failed','cancelled']:['received','delivered'];
  const rows=window.orbitAPI.sendSync('locallink-list-transfers',{query:o.query,offset:o.offset,limit:100,...(mode==='tasks'?{statuses}:{direction:'incoming',status:'received',filesOnly:true,kind:o.filter})});
  const selected=new Set([...host.querySelectorAll('[data-clean]:checked')].map(e=>e.dataset.clean));const list=host.querySelector('.ll-center-rows'),scroll=list.scrollTop;
  list.innerHTML=rows.map(r=>{
   const peer=window.store.getState().friends.find(p=>p.userId===r.peerId),name=peer?window.LocalLinkDevices.name(peer):r.peerId;
   const running=this.active.includes(r.status),retry=r.direction==='outgoing'&&['failed','cancelled'].includes(r.status),available=!!r.path;
   return `<article class="ll-center-card" data-record-id="${esc(r.id)}">${mode==='received'&&available?'<input type="checkbox" data-clean="'+esc(r.id)+'" aria-label="'+esc(t('選取 ','选择 ','Select ')+r.name)+'" '+(selected.has(r.id)?'checked':'')+'>':''}<div class="ll-center-content"><strong>${esc(r.name)}</strong><p>${esc(name)} · ${esc(panel.statusLabel(r.status))} · ${new Date(r.startedAt||r.time).toLocaleString()}</p>${r.text?'<p class="selectable">'+esc(r.text)+'</p>':''}${running?'<progress max="'+Math.max(1,r.size||0)+'" value="'+Math.min(r.bytes||0,r.size||0)+'"></progress><p>'+panel.size(r.bytes||0)+' / '+panel.size(r.size)+'</p>':''}${r.error?'<p class="ll-center-error">'+esc(panel.errorLabel(r.error))+'</p>':''}${mode==='received'&&!available?'<p>'+t('檔案已清理','文件已清理','File cleaned up')+'</p>':''}<div class="ll-file-actions"><button data-device="${esc(r.peerId)}">${t('查看裝置','查看设备','View device')}</button>${running?'<button data-cancel="'+esc(r.id)+'">'+t('取消','取消','Cancel')+'</button>':''}${retry?'<button data-retry="'+esc(r.id)+'">'+t('重試','重试','Retry')+'</button>':''}${available&&!running?'<button data-open="'+esc(r.id)+'">'+t('開啟','打开','Open')+'</button><button data-folder="'+esc(r.id)+'">'+t('所在資料夾','所在文件夹','Show in folder')+'</button>':''}${mode==='received'&&available&&/\.(png|jpe?g|webp|gif)$/i.test(r.name)?'<button data-preview="'+esc(r.id)+'">'+t('預覽','预览','Preview')+'</button>':''}</div><img class="ll-center-preview" alt="${esc(r.name)}" hidden></div></article>`;
  }).join('')||'<div class="ll-center-empty">'+t('沒有符合的項目','没有匹配的项目','No matching items')+'</div>';list.scrollTop=scroll;
  host.querySelector('#ll-center-prev').disabled=o.offset===0;host.querySelector('#ll-center-next').disabled=rows.length<100;
  const clean=host.querySelector('#ll-center-clean'),sync=()=>{if(clean)clean.disabled=!host.querySelector('[data-clean]:checked');};sync();host.querySelectorAll('[data-clean]').forEach(e=>e.onchange=sync);
  host.querySelectorAll('[data-device]').forEach(e=>e.onclick=()=>{const id=e.dataset.device;if(!window.store.getState().friends.some(p=>p.userId===id))window.store.addOrUpdatePeer({userId:id,username:id,status:'offline',usertag:'LocalSend'});window.store.setState({activeChatId:id});});
  host.querySelectorAll('[data-cancel]').forEach(e=>e.onclick=()=>this.action('locallink-cancel-transfer',e.dataset.cancel));
  host.querySelectorAll('[data-retry]').forEach(e=>e.onclick=async()=>{const r=rows.find(r=>r.id===e.dataset.retry);let pin;if(r.error?.includes('HTTP 401')){pin=await panel.askPin();if(pin===null)return;}e.disabled=true;await this.action('locallink-retry-transfer',{id:r.id,pin});});
  host.querySelectorAll('[data-open],[data-folder]').forEach(e=>e.onclick=()=>this.action('locallink-open-transfer',{id:e.dataset.open||e.dataset.folder,folder:!!e.dataset.folder}));
  host.querySelectorAll('[data-preview]').forEach(e=>e.onclick=async()=>{const img=e.closest('article').querySelector('img');const src=await window.LocalSendPanel.previews.get(e.dataset.preview,()=>img.isConnected);if(src&&img.isConnected){img.src=src;img.hidden=!img.hidden;}else if(!src)host.querySelector('#ll-center-feedback').textContent=t('無法預覽此圖片','无法预览此图片','Preview unavailable');});
 }
};
const refreshTransferCenter=()=>{if(window.TransferCenter.timer)return;window.TransferCenter.timer=setTimeout(()=>{window.TransferCenter.timer=null;window.TransferCenter.badge();window.TransferCenter.rows();},200);};
window.orbitAPI.on('locallink-transfer-result',refreshTransferCenter);
window.orbitAPI.on('locallink-history-changed',refreshTransferCenter);
window.addEventListener('locallink-language-change',()=>{const mode=window.store.getState().activeChatId?.split(':')[1];if(window.store.getState().activeChatId?.startsWith('locallink-view:'))window.TransferCenter.render(window.ChatPanel.container,mode);});

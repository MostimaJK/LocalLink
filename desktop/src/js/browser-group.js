'use strict';
(() => {
  const t=(...labels)=>window.LocalSendPanel.text(...labels);
  const title=()=>t('掃碼共享群','扫码共享群','Browser sharing group');
  let session=null;
  const member=n=> {
    if (!n) return t('本機','本机','This computer');
    const m=session?.members.find(m=>m.number===n);
    return (m?.platform==='Browser'?t('瀏覽器','浏览器','Browser'):m?.platform || t('手機','手机','Phone'))+' #'+n;
  };
  function element(parent,tag,value) {
    const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;
  }
  function sidebar(host,scope,query) {
    if (!session || !session.members.length || scope==='favorites') return;
    const group=title();
    const rows=[{name:group,icon:'users',subtitle:t('臨時群組','临时群组','Temporary group')},
      ...session.members.map(m=>({name:member(m.number),icon:'smartphone',subtitle:group}))];
    const list=document.createElement('div');list.className='ll-group-members';
    for(const row of rows.filter(row=>row.name.toLowerCase().includes(query))){
      const btn=element(list,'button','');btn.className='list-row';btn.type='button';
      const avatar=element(btn,'span','');avatar.className='avatar avatar-md list-row-avatar';
      element(avatar,'i','').dataset.lucide=row.icon;
      const info=element(btn,'span','');info.className='list-row-info';
      element(info,'span',row.name).className='list-row-title';
      element(info,'span',row.subtitle).className='list-row-subtitle';
      btn.onclick=event=>{event.stopPropagation();window.store.setState({activeChatId:'web-room:'+session.roomId});};
    }
    window.lucide.createIcons({root:list});
    const before=host.querySelector('.ll-device-row');
    host.insertBefore(list,before || null);
  }
  function render(host) {
    if (!session || window.store.getState().activeChatId !== 'web-room:'+session.roomId) {
      host.replaceChildren();
      const empty=element(host,'section','');empty.className='ll-room-ended';
      const badge=element(empty,'span','');badge.className='ll-empty-icon';element(badge,'i','').dataset.lucide='qr-code';
      element(empty,'h2',t('共享已結束','共享已结束','Sharing ended'));
      element(empty,'p',t('已接收的檔案仍保存在電腦上。','已接收的文件仍保存在电脑上。','Received files are saved on this computer.'));
      const open=element(empty,'button',session?t('查看目前共享','查看当前共享','View current sharing'):t('重新共享','重新共享','Share again'));
      open.className='ll-primary-button';open.onclick=()=>window.showBrowserShare();
      window.lucide.createIcons({root:empty});return;
    }
    let feed=host.querySelector('.ll-group-feed');
    if (!feed || feed.dataset.room!==session.roomId){
      host.replaceChildren();
      const root=element(host,'section','');root.className='ll-group-chat';
      element(root,'h2',title());
      element(root,'small','').className='ll-group-roster';
      feed=element(root,'div','');feed.className='ll-group-feed';feed.dataset.room=session.roomId;feed.dataset.peerId='web-room:'+session.roomId;
      const footer=element(root,'footer','');footer.className='ll-composer';
      const feedback=element(footer,'div','');feedback.className='ll-group-feedback';feedback.setAttribute('role','status');
      const form=element(footer,'form','');form.className='ll-compose-wrapper';
      const add=element(form,'button','');
      add.type='button';add.className='ll-icon-button';add.title=t('選擇檔案','选择文件','Choose files');add.setAttribute('aria-label',add.title);
      element(add,'i','').dataset.lucide='file';
      async function shareFiles(paths){
        try{
          const result=await window.orbitAPI.invoke('locallink-web-share',{action:paths?'drop':'add',roomId:feed.dataset.room,...(paths?{paths}:{})});
          if(!result.ok)throw Error();
          feedback.textContent=window.LocalSendPanel.skippedFiles(result.skipped);
        }catch {feedback.textContent=t('無法加入檔案，請重新選擇。','无法加入文件，请重新选择。','Could not add files. Choose them again.');}
      }
      add.onclick=()=>shareFiles();
      window.LocalSendPanel.bindFileDrop(root,()=>session?.roomId===feed.dataset.room,paths=>shareFiles(paths));
      const draft=element(form,'textarea','');draft.className='ll-group-input';
      draft.rows=1;draft.maxLength=8192;draft.placeholder=t('輸入群組訊息，或拖入檔案','输入群消息，或拖入文件','Message the group or drop files');draft.setAttribute('aria-label',draft.placeholder);
      const send=element(form,'button',t('傳送','发送','Send'));
      send.type='submit';send.className='ll-send';send.disabled=true;
      const icon=document.createElement('i');icon.dataset.lucide='send';send.prepend(icon);
      window.lucide.createIcons({root:form});
      draft.oninput=()=>{send.disabled=!draft.value.trim();};
      draft.onkeydown=event=>{
        if(event.key==='Enter' && !event.shiftKey && !event.isComposing && event.keyCode!==229){
          event.preventDefault();form.requestSubmit();
        }
      };
      let sending=false;
      form.onsubmit=async e=>{
        e.preventDefault();const text=draft.value;if(!text.trim() || sending)return;
        sending=true;send.disabled=true;
        try {
          const r=await window.orbitAPI.invoke('locallink-web-share',{action:'message',roomId:feed.dataset.room,text});
          if(r.ok && draft.value===text)draft.value='';
          if(!r.ok)window.Toast?.show('LocalLink',t('傳送失敗','发送失败','Send failed'),'error');
        }finally{sending=false;send.disabled=!draft.value.trim();}
      };
    }
    host.querySelector('.ll-group-roster').textContent=[member(0),...session.members.map(m=>member(m.number))].join(' · ');
    const atEnd=feed.scrollHeight-feed.scrollTop-feed.clientHeight<32;
    feed.replaceChildren();
    const items=[...session.messages,...session.sharedFiles,...session.files.map(f=>({...f,sender:0}))].sort((a,b)=>a.time-b.time);
    for(const msg of items){
      const row=element(feed,'article','');element(row,'small',member(msg.sender));element(row,'p',msg.text??msg.name);
      if(msg.text===undefined){const status=msg.saveFailed?t('儲存失敗','保存失败','Save failed'):msg.sender && msg.host===false?t('本機已拒絕','本机已拒绝','Declined on this computer'):'';
        element(row,'small',[window.LocalSendPanel.size(msg.size),status].filter(Boolean).join(' · '));continue;}
      const copy=element(row,'button',t('複製','复制','Copy'));
      copy.onclick=()=>{window.orbitAPI.writeClipboard(msg.text);copy.textContent=t('已複製','已复制','Copied');};
    }
    if (atEnd) feed.scrollTop=feed.scrollHeight;
  }
  window.BrowserGroup={sidebar,render,update(next){
    const rosterChanged=session?.roomId!==next?.roomId || session?.members.length!==next?.members.length;
    session=next;
    if(!window.store || !window.SidebarMiddle?.container)return;
    if(rosterChanged && !['groups','folders'].includes(window.store.getState().activeView))window.SidebarMiddle.renderList(window.store.getState());
    if(window.store.getState().activeChatId?.startsWith('web-room:'))render(window.ChatPanel.container);
  }, count:()=>session?.members.length||0};
})();

window.LocalSendPanel = {
 busy: new Set(),
 text(tw,cn,en){return window.I18n.locale==='en'?en:window.I18n.locale==='zh-Hans'?cn:tw;},
 render(peer, host) {
  const t=this.text.bind(this);host.style.display='flex';host.style.flexDirection='column';
  host.replaceChildren();
  const section=document.createElement('section');section.style.cssText='padding:28px;overflow:auto;flex:1';
  const title=document.createElement('h2');title.textContent=window.LocalLinkDevices.name(peer);section.appendChild(title);
  const info=document.createElement('p');info.style.cssText='color:var(--text-muted);margin:12px 0 24px;line-height:1.7';
  info.textContent=t('LocalSend 檔案傳輸 · 每次接收都需要確認。此連線不提供通話。','LocalSend 文件传输 · 每次接收都需要确认。此连接不提供通话。','LocalSend file transfer · Receiving requires confirmation. Calls are not available on this connection.');section.appendChild(info);
  const button=document.createElement('button');button.id='localsend-send';button.style.cssText='padding:12px 20px;background:var(--accent-primary);color:white;border-radius:10px';
  const nearby=window.LocalLinkDevices.isNearby(peer);
  button.textContent=this.busy.has(peer.userId)?t('等待接收確認或傳輸中…','等待接收确认或传输中…','Awaiting approval or transferring…'):nearby?t('選擇檔案傳送','选择文件发送','Choose a file to send'):t('裝置離線，仍可查看記錄','设备离线，仍可查看记录','Device offline — history remains available');
  button.disabled=this.busy.has(peer.userId)||!nearby;section.appendChild(button);
  const feedback=document.createElement('p');feedback.id='localsend-feedback';feedback.style.marginTop='16px';section.appendChild(feedback);
  button.onclick=async()=>{
    this.busy.add(peer.userId);button.disabled=true;button.textContent=t('等待接收確認或傳輸中…','等待接收确认或传输中…','Awaiting approval or transferring…');
    try{const result=await window.orbitAPI.invoke('locallink-send-selected',peer.userId);if(result.ok){this.render(peer,host);}else feedback.textContent=result.cancelled?t('已取消','已取消','Cancelled'):result.error;}
    catch(error){feedback.textContent=error.message;}
    finally{this.busy.delete(peer.userId);button.disabled=false;button.textContent=t('選擇檔案傳送','选择文件发送','Choose a file to send');if(window.store.getState().activeChatId===peer.userId && !host.contains(button))this.render(peer,host);}
  };
  const heading=document.createElement('h3');heading.style.marginTop='32px';heading.textContent=t('傳輸記錄','传输记录','Transfer history');section.appendChild(heading);
  const records=window.orbitAPI.dbGetSetting('locallink.transfers',[]).filter(r=>r.peerId===peer.userId).reverse();
  for(const r of records){
    const card=document.createElement('div');card.style.cssText='padding:16px;margin-top:12px;border:1px solid var(--border-subtle);border-radius:10px';
    const name=document.createElement('strong');name.textContent=r.name;card.appendChild(name);
    const detail=document.createElement('p');detail.style.cssText='font-size:12px;margin:8px 0;overflow-wrap:anywhere;color:var(--text-muted)';detail.textContent=(r.status==='failed'?t('失敗','失败','Failed')+': '+r.error:r.status==='received'?t('已接收','已接收','Received'):t('接收方已確認完成','接收方已确认完成','Confirmed by receiver'))+' · '+r.size+' bytes · '+new Date(r.time).toLocaleString()+'\n'+r.path;card.appendChild(detail);
    for(const folder of (r.status==='failed'?[]:[false,true])){const open=document.createElement('button');open.style.cssText='padding:8px;margin-right:8px;color:var(--accent-primary)';open.textContent=folder?t('開啟所在資料夾','打开所在目录','Show in folder'):t('開啟檔案','打开文件','Open file');open.onclick=async()=>{const result=await window.orbitAPI.invoke('locallink-open-transfer',{id:r.id,folder});if(!result.ok)feedback.textContent=result.error;};card.appendChild(open);}
    section.appendChild(card);
  }
  host.appendChild(section);
 }
};
window.orbitAPI.on('locallink-transfer-result',record=>{
 const state=window.store.getState();
 if(state.activeChatId===record.peerId){const peer=state.friends.find(p=>p.userId===record.peerId);if(peer)window.LocalSendPanel.render(peer,window.ChatPanel.container);}
 window.Toast?.show('LocalLink',record.name+' — '+record.status,record.status==='failed'?'error':'success');
});
window.orbitAPI.on('locallink-transport-status',status=>{
 window.localSendStatus=status;
 if(!status.ok)window.Toast?.show('LocalSend',status.error,'error');
});
window.orbitAPI.on('locallink-transfer-error',error=>window.Toast?.show('LocalSend',error,'error'));

'use strict';
const lang = navigator.language.toLowerCase();
const language = lang.startsWith('zh') ? (/tw|hk|mo|hant/.test(lang) ? 2 : 1) : 0;
document.documentElement.lang = ['en','zh-Hans','zh-Hant'][language];
const t = (en, cn, tw) => [en,cn,tw][language];
const el = id => document.getElementById(id);
el('title').textContent=t('LocalLink group','LocalLink 共享群','LocalLink 共享群');
el('hint').textContent=t('Group messages are visible to members.','群成员均可查看消息。','群組成員均可查看訊息。');
el('outgoing').textContent=t('＋ Share files','＋ 分享文件','＋ 分享檔案');
el('draft').placeholder=t('Message the group…','给群组发消息…','傳送群組訊息…');
el('draft').oninput=()=>{const d=el('draft');d.style.height='auto';d.style.height=d.scrollHeight+'px';};
el('draft').setAttribute('aria-label',el('draft').placeholder);
el('send').textContent=t('Send','发送','傳送');
const waiting=t('Start a conversation or share a file.','发条消息，或分享一个文件。','傳送訊息或分享檔案。');
el('compose').onsubmit=async event=>{
  event.preventDefault(); const draft=el('draft'), text=draft.value;
  if (!text.trim() || el('send').disabled) return;
  el('send').disabled=true;
  try {
    if (!(await fetch('message',{method:'POST',body:text})).ok) throw Error();
    if(draft.value===text){draft.value='';draft.style.height='';}
    await refresh();
  } catch {el('status').textContent=t('Message failed. Try again.','消息发送失败，请重试。','訊息傳送失敗，請重試。');}
  finally {el('send').disabled=false;}
};
const sender=(n,me)=>n===me?t('You','你','你'):n===0?t('Computer','电脑','電腦'):t('Phone','手机','手機')+' #'+n;
function append(parent,tag,text){const child=document.createElement(tag);child.textContent=text;parent.append(child);return child;}
function renderRoom(room) {
  el('members').textContent=room.members+' '+t('members','位成员','位成員');
  const feed=el('messages');
  const scroller=el('downloads');
  const atEnd=scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<60;
  feed.replaceChildren();
  const items=[...room.messages,...room.files].sort((a,b)=>a.time-b.time);
  for(const m of items){
    if(m.text!==undefined){
      const row=append(feed,'li','');
      if(m.sender===room.me)row.className='mine';
      append(row,'small',sender(m.sender,room.me));
      append(row,'p',m.text);
      continue;
    }
    const f=m;
    const row=append(feed,'li','');if(f.sender===room.me)row.className='mine';append(row,'small',sender(f.sender,room.me));
    const unit=Math.min(4,Math.floor(Math.log10(Math.max(1,f.size))/3));
    append(row,'p',f.name+' · '+(f.size/1000**unit).toLocaleString(undefined,{maximumFractionDigits:2})+' '+['B','KB','MB','GB','TB'][unit]);
    if(f.hasPreview && f.decision!=='reject'){
      const img=append(row,'img','');img.className='preview';img.alt=f.name;img.src='preview/'+f.id;
    }
    if(f.decision==='sent'){
      append(row,'small',f.ready?t('Shared','已分享','已分享'):t('Waiting','等待接收','等待接收'));
    }else if(f.decision==='pending'){
      const actions=append(row,'div','');actions.className='decision-actions';
      for(const [value,label] of [['reject',t('Reject','拒绝','拒絕')],['accept',t('Accept','接受','接受')]]){
        const button=append(actions,'button',label);button.dataset.decision=value;if(value==='reject')button.className='secondary';
        button.onclick=async()=>{
          for(const b of row.querySelectorAll('button')) b.disabled=true;
          try {if(!(await fetch('decision',{method:'POST',headers:{'X-File-Id':f.id,'X-Decision':value}})).ok)throw Error();await refresh();}
          catch {previous=undefined;el('status').textContent=t('Try again','请重试','請重試');await refresh();}
        };
      }
    }else if(f.decision==='accept' && f.ready){
      const link=append(row,'a',t('Download file','下载文件','下載檔案'));link.href=f.id;link.download=f.name;
    }else append(row,'small',f.decision==='reject'?t('Declined','已拒绝','已拒絕'):t('Waiting for upload','等待上传','等待上傳'));
  }
  if(atEnd) scroller.scrollTop=scroller.scrollHeight;
}
let previous, loading = false;
el('pin-label').textContent=t('Enter the six digits shown on the computer','输入电脑上显示的六位配对码','輸入電腦上顯示的六位配對碼');
el('confirm').textContent=t('Connect','连接','連線');
const digits=value=>value.normalize('NFKC').replace(/[^0-9]/g,'').slice(0,6);
el('pin').addEventListener('input',()=>{el('pin').value=digits(el('pin').value);el('pair-status').textContent='';});
el('pin').addEventListener('paste',event=>{
  const text=event.clipboardData?.getData('text');
  if(text){event.preventDefault();el('pin').value=digits(text);}
});
let pairing=false;
el('pair').onsubmit=async event=>{
  event.preventDefault();
  if(pairing)return;
  pairing=true;el('confirm').disabled=true;
  try {
    const result=await fetch('pair',{method:'POST',headers:{'X-Pair-Code':el('pin').value}});
    if(result.ok){el('pin').value='';await refresh();return;}
    el('pair-status').textContent=[409,410,429].includes(result.status)
      ? t('Start a new sharing session on the computer.','请在电脑上重新开始共享。','請在電腦上重新開始共享。')
      : t('Check the code and try again.','请核对配对码后重试。','請核對配對碼後重試。');
  } catch { el('pair-status').textContent=t('Check Wi-Fi or scan a new code.','请检查 Wi-Fi 或重新扫码。','請檢查 Wi-Fi 或重新掃碼。'); }
  finally {pairing=false;el('confirm').disabled=false;}
};
async function refresh() {
  if (loading || document.hidden) return;
  loading = true;
  try {
    const response = await fetch('room');
    if(response.status===401){el('pair').hidden=false;el('uploads').hidden=true;el('downloads').hidden=true;return;}
    if (!response.ok) throw new Error();
    const room = await response.json();
    el('pair').hidden=true;el('uploads').hidden=false;el('downloads').hidden=false;
    el('empty').textContent = room.files.length || room.messages.length ? '' : waiting;
    el('pick').disabled = sending;
    const key = JSON.stringify(room);
    if (key === previous) return;
    renderRoom(room);
    previous = key;
  } catch {
    el('downloads').hidden=false;
    el('members').textContent='';
    previous = undefined;
    el('messages').replaceChildren();
    el('pick').disabled = true;
    el('empty').textContent = t('Connection lost. Check Wi-Fi or scan a new code.','连接已断开，请检查 Wi-Fi 或重新扫码。','連線已中斷，請檢查 Wi-Fi 或重新掃碼。');
  } finally { loading = false; }
}
async function previewPixels(file,edge) {
  if(!/^image\/(jpeg|png|webp|gif|avif|heic|heif|bmp)$/i.test(file.type))return;
  const url=URL.createObjectURL(file);
  try {
    const img=new Image();img.src=url;await img.decode();
    const scale=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let rgb='';
    for(let i=0;i<rgba.length;i+=4)rgb+=String.fromCharCode(rgba[i],rgba[i+1],rgba[i+2]);
    return {width:canvas.width,height:canvas.height,rgb:btoa(rgb)};
  } catch {return undefined;} finally {URL.revokeObjectURL(url);}
}
let sending = false,controller;
const cancel=el('cancel-send');
cancel.textContent=t('Cancel transfer','取消本次发送','取消本次傳送');
cancel.onclick=()=>controller?.abort();
function finishSending(){
  sending=false;controller=null;cancel.hidden=true;el('pick').disabled=false;el('pick').value='';refresh();
}
const cancelled=t('Transfer cancelled','已取消发送','已取消傳送');
el('pick').onchange = async event => {
  const files = Array.from(event.target.files);
  controller=new AbortController();cancel.hidden=false;
  const {signal}=controller;
  sending = true; el('pick').disabled = true;
  let completed = 0, tokens;
  try {
    el('status').textContent = t('Waiting for a recipient…','等待成员接受…','等待成員接受…');
    const manifest=[];
    const edge=Math.min(192,Math.floor(Math.sqrt(700000/files.length)));
    for(const file of files)manifest.push({name:file.name,size:file.size,pixels:await previewPixels(file,edge)});
    const offer = await fetch('offer', {method:'POST',signal,body:JSON.stringify(manifest)});
    if (!offer.ok) throw offer.status;
    tokens = await offer.json();
  } catch (status) {
    el('status').textContent = signal.aborted?cancelled:status === 403 ? t('Declined or expired','已拒绝或请求已过期','已拒絕或請求已過期') :
      status === 413 ? t('Session limit reached','已达到本次共享上限','已達本次共享上限') : t('Request failed','请求失败','請求失敗');
    finishSending();return;
  }
  for (const [index,file] of files.entries()) {
    if (!tokens[index]) continue;
    el('status').textContent = (completed + 1) + '/' + files.length + ' · ' + file.name;
    try {
      const result = await fetch('upload', { method:'POST', signal,headers:{ 'X-Upload-Token':tokens[index], 'X-File-Name':encodeURIComponent(file.name), 'X-File-Size':String(file.size) }, body:file });
      if (!result.ok) throw result.status;
      completed++;
      el('status').textContent = t('Sent','已发送','已傳送') + ' · ' + completed + '/' + files.length;
    } catch (status) {
      const message = signal.aborted?cancelled:status === 413 ? t('Session limit reached','已达到本次共享上限','已達本次共享上限') :
        status === 507 ? t('Computer disk is full','电脑磁盘空间不足','電腦磁碟空間不足') :
        t('Could not send','发送失败','傳送失敗');
      el('status').textContent = message + ' · ' + file.name + ' (' + completed + '/' + files.length + ')';
      break;
    }
  }
  finishSending();
};
refresh(); setInterval(refresh, 3000); document.addEventListener('visibilitychange', refresh);

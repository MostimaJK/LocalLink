'use strict';
const lang = navigator.language.toLowerCase();
const language = lang.startsWith('zh') ? (/tw|hk|mo|hant/.test(lang) ? 2 : 1) : 0;
document.documentElement.lang = ['en','zh-Hans','zh-Hant'][language];
const t = (en, cn, tw) => [en,cn,tw][language];
const el = id => document.getElementById(id);
el('title').textContent = t('Share with this computer','与电脑互传','與電腦互傳');
el('hint').textContent = t('Keep this page open while sending. Upload limit per session: 1 GiB, 100 files.','发送时请保持页面打开。每次共享最多上传 1 GiB、100 个文件。','傳送時請保持頁面開啟。每次共享最多上傳 1 GiB、100 個檔案。');
el('incoming').textContent = t('From computer','电脑发来的文件','電腦傳來的檔案');
el('outgoing').textContent = t('Send to computer','发送到电脑','傳送至電腦');
const waiting = t('Files shared by the computer will appear here.','电脑选择的文件会显示在这里。','電腦選取的檔案會顯示在這裡。');
let previous, loading = false;
el('pin-label').textContent=t('Enter the six digits shown on the computer','输入电脑上显示的六位配对码','輸入電腦上顯示的六位配對碼');
el('confirm').textContent=t('Connect','连接','連線');
let pairing=false;
el('pair').onsubmit=async event=>{
  event.preventDefault();
  if(pairing)return;
  pairing=true;
  try {
    const result=await fetch('pair',{method:'POST',headers:{'X-Pair-Code':el('pin').value}});
    if(result.ok){el('pin').value='';await refresh();return;}
    el('pair-status').textContent=result.status===429 || result.status===409
      ? t('Start a new sharing session on the computer.','请在电脑上重新开始共享。','請在電腦上重新開始共享。')
      : t('Check the code and try again.','请核对配对码后重试。','請核對配對碼後重試。');
  } catch { el('pair-status').textContent=t('Check Wi-Fi or scan a new code.','请检查 Wi-Fi 或重新扫码。','請檢查 Wi-Fi 或重新掃碼。'); }
  finally {pairing=false;}
};
async function refresh() {
  if (loading || document.hidden) return;
  loading = true;
  try {
    const response = await fetch('files');
    if(response.status===401){el('pair').hidden=false;el('uploads').hidden=true;el('downloads').hidden=true;return;}
    if (!response.ok) throw new Error();
    const files = await response.json();
    el('pair').hidden=true;el('uploads').hidden=false;el('downloads').hidden=false;
    el('empty').textContent = files.length ? '' : waiting;
    el('pick').disabled = sending;
    const key = JSON.stringify(files);
    if (key === previous) return;
    el('files').replaceChildren();
    for (const file of files) {
      const row = document.createElement('li'), link = document.createElement('a');
      link.href = file.id; link.download = file.name; link.textContent = file.name;
      row.append(link); el('files').append(row);
    }
    previous = key;
  } catch {
    el('downloads').hidden=false;
    previous = undefined;
    el('files').replaceChildren();
    el('pick').disabled = true;
    el('empty').textContent = t('Connection lost. Check Wi-Fi or scan a new code.','连接已断开，请检查 Wi-Fi 或重新扫码。','連線已中斷，請檢查 Wi-Fi 或重新掃碼。');
  } finally { loading = false; }
}
let sending = false;
el('pick').onchange = async event => {
  const files = Array.from(event.target.files);
  sending = true; el('pick').disabled = true;
  let completed = 0;
  for (const file of files) {
    el('status').textContent = (completed + 1) + '/' + files.length + ' · ' + file.name;
    try {
      const result = await fetch('upload', { method:'POST', headers:{ 'X-File-Name':encodeURIComponent(file.name), 'X-File-Size':String(file.size) }, body:file });
      if (!result.ok) throw result.status;
      completed++;
      el('status').textContent = t('Sent','已发送','已傳送') + ' · ' + completed + '/' + files.length;
    } catch (status) {
      const message = status === 413 ? t('Session limit reached','已达到本次共享上限','已達本次共享上限') :
        status === 507 ? t('Computer disk is full','电脑磁盘空间不足','電腦磁碟空間不足') :
        t('Could not send','发送失败','傳送失敗');
      el('status').textContent = message + ' · ' + file.name + ' (' + completed + '/' + files.length + ')';
      break;
    }
  }
  sending = false; el('pick').value = ''; refresh();
};
refresh(); setInterval(refresh, 3000); document.addEventListener('visibilitychange', refresh);

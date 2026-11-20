// Small, fixed-size Windows-style caption glyphs; independent of Lucide defaults.
window.LocalLinkChrome={
 maximized:false,
 update(){
  const t=(tw,cn,en)=>window.I18n.locale==='en'?en:window.I18n.locale==='zh-Hans'?cn:tw;
  const labels={'btn-minimize':t('最小化','最小化','Minimize'),'btn-maximize':this.maximized?t('還原','还原','Restore'):t('最大化','最大化','Maximize'),'btn-close':t('關閉視窗','关闭窗口','Close window')};
  for(const [id,label] of Object.entries(labels)){const button=document.getElementById(id);if(button){button.title=label;button.setAttribute('aria-label',label);}}
  document.getElementById('btn-maximize')?.setAttribute('data-maximized',String(this.maximized));
 },
 init(){
  const paths={
   'btn-minimize':'<path d="M2 6.5h8"/>',
   'btn-maximize':'<path class="ll-maximize-glyph" d="M2.5 2.5h7v7h-7z"/><g class="ll-restore-glyph"><path d="M4.5 3.5v-2h6v6h-2"/><path d="M1.5 4.5h6v6h-6z"/></g>',
   'btn-close':'<path d="m2 2 8 8m0-8-8 8"/>'
  };
  for(const [id,path] of Object.entries(paths))document.getElementById(id).innerHTML='<svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1">'+path+'</svg>';
  window.orbitAPI.on('locallink-window-state',state=>{this.maximized=state.maximized;this.update();});
  this.maximized=!!window.orbitAPI.sendSync('locallink-window-state')?.maximized;this.update();
  window.addEventListener('locallink-language-change',()=>this.update());
 }
};
document.addEventListener('DOMContentLoaded',()=>window.LocalLinkChrome.init());

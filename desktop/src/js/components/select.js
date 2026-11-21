// Shared select-only combobox. The hidden native select remains the value/event source.
window.LocalLinkSelect = {
 serial:0, active:null,
 enhance(root){
  root.querySelectorAll('select:not([multiple])').forEach(select=>{
   if(select.dataset.llSelect)return;
   select.dataset.llSelect='true';select.hidden=true;
   const id=select.id||('ll-select-'+(++this.serial));select.id=id;
   const wrapper=document.createElement('span');wrapper.className='ll-select';
   for(const property of ['width','flex','margin'])if(select.style[property])wrapper.style[property]=select.style[property];
   const trigger=document.createElement('button');trigger.type='button';trigger.className='ll-select-trigger';trigger.id=id+'-trigger';
   trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',id+'-list');
   const label=[...(select.labels||[])].map(el=>el.textContent.trim()).join(' ')||select.getAttribute('aria-label')||select.parentElement.querySelector('label')?.textContent.trim()||select.title||id;
   trigger.setAttribute('aria-label',label);
   const value=document.createElement('span');value.className='ll-select-value';
   trigger.append(value);trigger.insertAdjacentHTML('beforeend','<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
   select.after(wrapper);wrapper.append(trigger);
   const sync=()=>{value.textContent=select.selectedOptions[0]?.label||'—';trigger.disabled=select.disabled;if(select.disabled&&this.active?.trigger===trigger)this.close();};sync();select.addEventListener('change',sync);
   const observer=new MutationObserver(sync);observer.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','label','selected']});
   trigger.addEventListener('click',()=>{if(this.active?.trigger===trigger)this.close();else this.open(select,trigger,sync);});
   trigger.addEventListener('keydown',event=>{
    const active=this.active?.trigger===trigger?this.active:null;
    if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)){
     event.preventDefault();event.stopPropagation();
     if(!active){this.open(select,trigger,sync);if(event.key==='Home')this.active?.move('first');if(event.key==='End')this.active?.move('last');}
     else if(event.key==='Enter'||event.key===' ')active.commit();
     else active.move(event.key==='Home'?'first':event.key==='End'?'last':event.key==='ArrowDown'?1:-1);
    }else if(event.key==='Escape'&&active){event.preventDefault();event.stopImmediatePropagation();this.close();}
    else if(event.key==='Tab'&&active)this.close();
    else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
     event.preventDefault();if(!active)this.open(select,trigger,sync);this.active?.search(event.key);
    }
   });
  });
 },
 open(select,trigger,sync){
  this.close();if(select.disabled||!trigger.isConnected)return;
  const options=[...select.options], enabled=options.map((o,i)=>!o.disabled&&!o.parentElement.disabled?i:-1).filter(i=>i>=0);
  if(!enabled.length)return;
  const popup=document.createElement('div');popup.id=select.id+'-list';popup.className='ll-select-menu';popup.setAttribute('role','listbox');popup.setAttribute('aria-label',trigger.getAttribute('aria-label'));popup.setAttribute('popover','manual');
  let index=enabled.includes(select.selectedIndex)?select.selectedIndex:enabled[0], buffer='',lastKey=0;
  options.forEach((option,i)=>{
   const row=document.createElement('div');row.id=select.id+'-option-'+i;row.className='ll-select-option';row.setAttribute('role','option');row.setAttribute('aria-selected',String(i===select.selectedIndex));
   row.setAttribute('aria-disabled',String(!enabled.includes(i)));
   const mark=document.createElement('span');mark.className='ll-select-check';mark.setAttribute('aria-hidden','true');mark.textContent=i===select.selectedIndex?'✓':'';
   const text=document.createElement('span');text.textContent=option.label;
   if(option.dataset.detail){
    const detail=document.createElement('small');detail.textContent=option.dataset.detail;text.append(detail);
    row.setAttribute('aria-label',option.label+' · '+option.dataset.detail);
   }
   row.append(mark,text);
   row.addEventListener('pointerdown',e=>e.preventDefault());
   row.addEventListener('pointermove',()=>{if(enabled.includes(i)){index=i;paint(false);}});
   row.addEventListener('click',()=>{if(enabled.includes(i)){index=i;commit();}});popup.append(row);
  });
  // Keep a native dialog's menu inside its modal subtree so it is not inert.
  (trigger.closest('dialog')||document.body).append(popup);popup.showPopover();trigger.setAttribute('aria-expanded','true');
  const paint=(scroll=true)=>{
   [...popup.children].forEach((row,i)=>row.classList.toggle('active',i===index));
   trigger.setAttribute('aria-activedescendant',popup.children[index].id);
   if(scroll){const row=popup.children[index];if(row.offsetTop<popup.scrollTop)popup.scrollTop=row.offsetTop;else if(row.offsetTop+row.offsetHeight>popup.scrollTop+popup.clientHeight)popup.scrollTop=row.offsetTop+row.offsetHeight-popup.clientHeight;}
  };
  const position=()=>{
   if(!trigger.isConnected){this.close();return;}
   const rect=trigger.getBoundingClientRect(), gap=6, margin=12;
   const below=innerHeight-rect.bottom-gap-margin,above=rect.top-gap-margin;
   const height=Math.min(popup.scrollHeight,320),up=below<height&&above>below;
   const available=Math.max(40,up?above:below);
   popup.style.width=Math.min(Math.max(rect.width,180),innerWidth-2*margin)+'px';popup.style.maxHeight=Math.min(320,available)+'px';
   const box=popup.getBoundingClientRect();
   popup.style.left=Math.max(margin,Math.min(rect.right-box.width,innerWidth-box.width-margin))+'px';
   popup.style.top=(up?Math.max(margin,rect.top-gap-box.height):rect.bottom+gap)+'px';
  };
  const commit=()=>{
   const next=options[index].value;this.close();
   if(select.value!==next){select.value=next;select.dispatchEvent(new Event('change',{bubbles:true}));}
   sync();(document.getElementById(trigger.id)||trigger).focus({preventScroll:true});
  };
  const outside=e=>{if(!trigger.contains(e.target)&&!popup.contains(e.target))this.close();};
  const scroll=e=>{if(!popup.contains(e.target))position();};
  const observer=new MutationObserver(()=>{if(!trigger.isConnected)this.close();});observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('pointerdown',outside,true);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',position);
  this.active={trigger,popup,move:step=>{const i=enabled.indexOf(index);index=step==='first'?enabled[0]:step==='last'?enabled.at(-1):enabled[(i+step+enabled.length)%enabled.length];paint();},commit,
   search:key=>{const now=Date.now();buffer=now-lastKey>700?key:buffer+key;lastKey=now;const next=enabled.find(i=>options[i].label.toLocaleLowerCase().startsWith(buffer.toLocaleLowerCase()));if(next!==undefined){index=next;paint();}},
   cleanup:()=>{observer.disconnect();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',position);}
  };
  position();paint();
 },
 close(){const active=this.active;if(!active)return;this.active=null;active.cleanup();active.trigger.setAttribute('aria-expanded','false');active.trigger.removeAttribute('aria-activedescendant');active.popup.hidePopover();active.popup.remove();}
};

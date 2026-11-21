'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {hashFile}=require('./update-restart');

function packageInfo(name) {
  const match=/^(LocalLink-Setup-|LocalLink-)(\d+)\.(\d+)\.(\d+)(\.exe|-Portable\.exe|-arm64\.dmg|-x64\.dmg)$/i.exec(name);
  return match && {kind:match[1]+match[5],version:match.slice(2,5).map(Number)};
}
async function prune(dir,current,known) {
  const next=packageInfo(current);
  if(!next)return;
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const old=packageInfo(entry.name);
    if(!entry.isFile() || !old || old.kind!==next.kind || !known[entry.name])continue;
    const difference=old.version.findIndex((n,i)=>n!==next.version[i]);
    if(difference<0 || old.version[difference]>=next.version[difference])continue;
    const file=path.join(dir,entry.name);
    try {
      if(await hashFile(file)===known[entry.name]){await fs.unlink(file);delete known[entry.name];}
    }catch(error){console.warn('Update package cleanup:',error.message);}
  }
}
module.exports={prune};

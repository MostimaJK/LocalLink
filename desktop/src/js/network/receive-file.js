'use strict';
const fs=require('fs'),path=require('path');
const {randomUUID}=require('node:crypto');
const {pipeline}=require('node:stream/promises');
// Hard-link publication is atomic and never overwrites a same-name file. On
// filesystems without hard links, reserve the name before moving owned staging data.
async function publishFile(partial,root,name,{consume=false,staging}={}){
 const ext=path.extname(name),stem=name.slice(0,name.length-ext.length);
 for(let i=0;i<10000;i++){
  const dest=path.join(root,i?`${stem} (${i})${ext}`:name);
  try{
   try{await fs.promises.link(partial,dest);}
   catch(error){
    if(!['EPERM','ENOTSUP','EOPNOTSUPP','EXDEV','ENOSYS'].includes(error.code))throw error;
    if(consume){
     const reservation=await fs.promises.open(dest,'wx');
     await reservation.close();
     try{await fs.promises.rename(partial,dest);}
     catch(moveError){await fs.promises.unlink(dest);throw moveError;}
    }else{
     const [disk,source]=await Promise.all([fs.promises.statfs(root),fs.promises.stat(partial)]);
     if(disk.bavail*disk.bsize<source.size)throw Error('Not enough disk space');
     // A relay keeps its source for other group members. Only publish a complete copy.
     const temp=path.join(root,'.locallink-'+randomUUID()+'.part');
     const handle=await fs.promises.open(temp,'wx',0o600);
     let tracked;
     try{
      tracked=staging?.track(temp,'phone');
      await pipeline(fs.createReadStream(partial),handle.createWriteStream());
      return await publishFile(temp,root,name,{consume:true});
     }finally{
      await handle.close();
      await fs.promises.rm(temp,{force:true});
      staging?.forgetIfGone(tracked);
     }
    }
   }
   return dest;
  }catch(error){if(error.code==='EEXIST')continue;throw error;}
 }
 throw new Error('Too many files with the same name');
}
module.exports={publishFile};

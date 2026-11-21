'use strict';
const fs=require('fs'),path=require('path');
// Hard-link publication is atomic and never overwrites a same-name file. On
// filesystems without hard links, exclusive copy preserves that no-overwrite rule.
async function publishFile(partial,root,name){
 const ext=path.extname(name),stem=name.slice(0,name.length-ext.length);
 for(let i=0;i<10000;i++){
  const dest=path.join(root,i?`${stem} (${i})${ext}`:name);
  try{
   try{await fs.promises.link(partial,dest);}
   catch(error){
    if(!['EPERM','ENOTSUP','EOPNOTSUPP','EXDEV','ENOSYS'].includes(error.code))throw error;
    await fs.promises.copyFile(partial,dest,fs.constants.COPYFILE_EXCL);
   }
   return dest;
  }catch(error){if(error.code==='EEXIST')continue;throw error;}
 }
 throw new Error('Too many files with the same name');
}
module.exports={publishFile};

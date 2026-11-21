'use strict';
const fs=require('fs'),path=require('path');
async function archiveFolder(source,cache,maxBytes=Number.MAX_SAFE_INTEGER){
 const root=await fs.promises.realpath(source),entries=[];let total=0;
 async function walk(dir){
  for(const entry of await fs.promises.readdir(dir,{withFileTypes:true})){
   if(entries.length>=10000)throw new Error('Folder exceeds transfer limit');
   const file=path.join(dir,entry.name),stat=await fs.promises.lstat(file);
   if(stat.isSymbolicLink())throw new Error('Folder contains a symbolic link; remove it before sending');
   if(stat.isDirectory()){entries.push({file,name:path.relative(root,file).replaceAll('\\','/')+'/',directory:true});await walk(file);}
   else if(stat.isFile()){total+=stat.size;if(!Number.isSafeInteger(total)||total>maxBytes||entries.length>=10000)throw new Error('Folder exceeds transfer limit');entries.push({file,name:path.relative(root,file).replaceAll('\\','/')});}
  }
 }
 await walk(root);await fs.promises.mkdir(cache,{recursive:true});
 const dir=await fs.promises.mkdtemp(path.join(cache,'folder-'));const dest=path.join(dir,path.basename(root)+'.zip');
 const {ZipArchive}=await import('archiver');
 try { await new Promise((resolve,reject)=>{
  const archive=new ZipArchive({store:true}),output=fs.createWriteStream(dest,{flags:'wx'});
  let failure;
  const fail=error=>{failure=error;archive.abort();output.destroy();};
  output.on('close',()=>failure?reject(failure):resolve());output.on('error',fail);archive.on('error',fail);archive.on('warning',fail);archive.pipe(output);
  if(!entries.length)archive.append('',{name:path.basename(root)+'/',type:'directory'});
  for(const e of entries)if(e.directory)archive.append('',{name:path.basename(root)+'/'+e.name,type:'directory'});else archive.file(e.file,{name:path.basename(root)+'/'+e.name});
  archive.finalize().catch(fail);
 });
 if((await fs.promises.stat(dest)).size>maxBytes)throw new Error('Folder archive exceeds transfer limit');
 } catch(error) { await fs.promises.rm(dir,{recursive:true,force:true});throw error; }
 return dest;
}
module.exports={archiveFolder};

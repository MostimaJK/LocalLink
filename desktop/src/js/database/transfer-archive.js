'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises');
const {Transform}=require('node:stream');
const {identity,statIdentity}=require('../../../lib/transfer-staging');
const {safeName}=require('../network/localsend');
const manifestName='locallink-backup.json',maxBytes=32*1024*1024,maxRows=100000;
const terminal=new Set(['received','delivered','failed','cancelled']);

function validate(r){
 if(!r||typeof r.id!=='string'||!r.id||typeof r.peerId!=='string'||!(r.peerId==='web:browser'||r.peerId.startsWith('localsend:'))||typeof r.name!=='string')throw Error('Invalid transfer record');
 if(!r.archiveFile)return;
 const {file,size,sha256}=r.archiveFile;
 if(typeof file!=='string'||!/^file-[a-f0-9-]+[.a-z0-9]*$/i.test(file)||!Number.isSafeInteger(size)||size<0||!/^[a-f0-9]{64}$/.test(sha256))throw Error('Invalid archive file');
 if(!r.name.split('/').every(safeName))throw Error('Invalid archived filename');
}
function serialize(data){
 const json=JSON.stringify(data);
 if(Buffer.byteLength(json)>maxBytes || data.records.length>maxRows)throw Error('Backup exceeds the supported manifest size');
 return json;
}
async function copyVerified(handle,dest){
 const hash=crypto.createHash('sha256');let size=0;
 const out=await fs.open(dest,'wx');
 try{
  await pipeline(handle.createReadStream({autoClose:false}),new Transform({transform(chunk,enc,cb){size+=chunk.length;hash.update(chunk);cb(null,chunk);}}),out.createWriteStream());
  return {sha256:hash.digest('hex'),size};
 }finally{await out.close();}
}
async function exportArchive(store,parent,includeFiles){
 const records=[],sources=[],skipped=[];
 for(const record of store.list({all:true})){
  const row={...record};delete row.path;delete row.diskIdentity;delete row.archiveFile;
  if(includeFiles&&record.path){
   if(!record.diskIdentity)skipped.push(record.name);
   else{
    const file='file-'+crypto.randomUUID()+path.extname(record.name).replace(/[^.a-z0-9]/gi,'').slice(0,12);
    row.archiveFile={file,size:record.size,sha256:'0'.repeat(64)};
    sources.push({record,row});
   }
  }
  validate(row);records.push(row);
 }
 const data={format:'locallink-transfers',version:1,createdAt:new Date().toISOString(),includeFiles,records};
 serialize(data);
 const dir=await fs.mkdtemp(path.join(parent,'LocalLink-backup-'));
 try{
  for(const {record,row} of sources){
   const dest=path.join(dir,row.archiveFile.file);
   let handle;
   try{
    handle=await fs.open(record.path,'r');
    if(statIdentity(await handle.stat({bigint:true}),true)===record.diskIdentity){
     const verified=await copyVerified(handle,dest);
     if(statIdentity(await handle.stat({bigint:true}),true)===record.diskIdentity){Object.assign(row.archiveFile,verified);continue;}
     await fs.unlink(dest);
    }
   }catch(e){if(e.code!=='ENOENT')throw e;}finally{await handle?.close();}
   delete row.archiveFile;skipped.push(record.name);
  }
  await fs.writeFile(path.join(dir,manifestName),serialize(data),{flag:'wx'});
  return {path:dir,count:records.length,missing:skipped.length,skipped};
 }catch(error){await fs.rm(dir,{recursive:true,force:true});throw error;}
}
async function importArchive(store,manifest,receiveDir){
 if((await fs.stat(manifest)).size>maxBytes)throw Error('Backup manifest is too large');
 const data=JSON.parse(await fs.readFile(manifest,'utf8'));
 if(data.format!=='locallink-transfers'||data.version!==1||!Array.isArray(data.records)||data.records.length>maxRows)throw Error('Unsupported transfer backup');
 const root=await fs.realpath(path.dirname(manifest)),ids=new Set(),rows=[];
 for(const r of data.records){
  validate(r);
  if(ids.has(r.id))throw Error('Duplicate record in backup');ids.add(r.id);
  if(r.archiveFile && path.dirname(await fs.realpath(path.join(root,r.archiveFile.file)))!==root)throw Error('Archive file must stay inside the backup folder');
 }
 let dir;
 try{
  for(const r of data.records){
   const row={...r};delete row.path;delete row.archiveFile;delete row.diskIdentity;
   if(r.archiveFile){
    if(!dir){await fs.mkdir(receiveDir,{recursive:true});dir=await fs.mkdtemp(path.join(receiveDir,'restored-'));}
    const parent=path.join(dir,...r.name.split('/').slice(0,-1));
    await fs.mkdir(parent,{recursive:true});
    const basename=path.posix.basename(r.name),ext=path.extname(basename),stem=path.basename(basename,ext);
    const handle=await fs.open(path.join(root,r.archiveFile.file),'r');
    try{
     for(let suffix=0;;suffix++){
      const dest=path.join(parent,suffix?stem+' ('+suffix+')'+ext:basename);
      let verified;
      try{verified=await copyVerified(handle,dest);}catch(e){if(e.code==='EEXIST')continue;throw e;}
      if(verified.sha256!==r.archiveFile.sha256||verified.size!==r.archiveFile.size)throw Error('Archive integrity check failed');
      row.path=dest;row.diskIdentity=identity(dest,true);break;
     }
    }finally{await handle.close();}
   }
   if(!terminal.has(row.status)){row.status='failed';row.error='Transfer interrupted';}
   rows.push(row);
  }
  store.db.transaction(()=>{for(const row of rows){const prior=store.get(row.id);if(prior&&!terminal.has(prior.status))throw Error('Cannot replace an active transfer');store.save(row);}})();
  return {count:rows.length,path:dir||receiveDir};
 }catch(error){if(dir)await fs.rm(dir,{recursive:true,force:true});throw error;}
}
module.exports={exportArchive,importArchive};

'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {pipeline}=require('stream/promises');
const {Transform}=require('stream');

async function copyVerified(source,dest,expected){
 const hash=crypto.createHash('sha256');let size=0;
 await pipeline(fs.createReadStream(source),new Transform({transform(chunk,enc,cb){size+=chunk.length;hash.update(chunk);cb(null,chunk);}}),fs.createWriteStream(dest,{flags:'wx'}));
 const sha256=hash.digest('hex');
 if(expected&&(expected.sha256!==sha256||expected.size!==size)){await fs.promises.unlink(dest);throw new Error('Archive integrity check failed');}
 return {sha256,size};
}
async function exportArchive(store,parent,includeFiles){
 const dir=await fs.promises.mkdtemp(path.join(parent,'LocalLink-backup-'));
 const rows=store.list({all:true});const records=[];let missing=0;
 for(const record of rows){
  const row={...record};delete row.path;
  if(includeFiles&&record.path){
   try{
    const file='file-'+crypto.randomUUID()+path.extname(record.name).replace(/[^.a-z0-9]/gi,'').slice(0,12);
    const verified=await copyVerified(record.path,path.join(dir,file));row.archiveFile={file,...verified};
   }catch(error){if(error.code==='ENOENT')missing++;else throw error;}
  }
  records.push(row);
 }
 await fs.promises.writeFile(path.join(dir,'locallink-backup.json'),JSON.stringify({format:'locallink-transfers',version:1,createdAt:new Date().toISOString(),includeFiles,records},null,2),{flag:'wx'});
 return {path:dir,count:rows.length,missing};
}
async function importArchive(store,manifest,receiveDir){
 const stat=await fs.promises.stat(manifest);if(stat.size>32*1024*1024)throw new Error('Backup manifest is too large');
 const data=JSON.parse(await fs.promises.readFile(manifest,'utf8'));
 if(data.format!=='locallink-transfers'||data.version!==1||!Array.isArray(data.records)||data.records.length>100000)throw new Error('Unsupported transfer backup');
 const root=await fs.promises.realpath(path.dirname(manifest));
 const rows=[];let dir;
 for(const r of data.records){
  if(typeof r.id!=='string'||!r.id||typeof r.peerId!=='string'||!r.peerId.startsWith('localsend:')||typeof r.name!=='string')throw new Error('Invalid transfer record');
  const existing=store.get(r.id);if(existing&&!['received','delivered','failed','cancelled'].includes(existing.status))throw new Error('Cannot replace an active transfer');
  const row={...r};delete row.path;delete row.archiveFile;
  if(r.archiveFile){
   const f=r.archiveFile;if(typeof f.file!=='string'||path.basename(f.file)!==f.file||!/^file-[a-f0-9-]+[.a-z0-9]*$/i.test(f.file))throw new Error('Invalid archive file');
   const source=await fs.promises.realpath(path.join(root,f.file));
   if(path.dirname(source)!==root)throw new Error('Archive file must stay inside the backup folder');
   await fs.promises.mkdir(receiveDir,{recursive:true});
   if(!dir)dir=await fs.promises.mkdtemp(path.join(receiveDir,'restored-'));
   const itemDir=path.join(dir,crypto.randomUUID());await fs.promises.mkdir(itemDir);
   const name=require('../network/localsend').safeName(r.name)?r.name:f.file;
   const dest=path.join(itemDir,name);
   await copyVerified(source,dest,f);row.path=dest;
  }
  if(!['received','delivered','failed','cancelled'].includes(row.status)){row.status='failed';row.error='Transfer interrupted';}
  rows.push(row);
 }
 store.db.transaction(()=>{for(const row of rows)store.save(row);})();
 return {count:rows.length,path:dir||receiveDir};
}
module.exports={exportArchive,importArchive};

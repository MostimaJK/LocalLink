'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function prepare({file,sha256,target,userData,portable,pid=process.pid,version}){
 if(!/^[a-f0-9]{64}$/.test(sha256)||await hashFile(file)!==sha256)throw Error('checksum mismatch');
 if(!path.isAbsolute(target)||!fs.existsSync(target))throw Error('Update target not found');
 const id=crypto.randomUUID(),job=path.join(userData,'locallink-updates',id);
 fs.mkdirSync(job,{recursive:true});
 const source=portable?path.join(path.dirname(target),`.locallink-update-${id}.exe`):path.join(job,'Setup.exe');
 try{
  await fs.promises.copyFile(file,source,fs.constants.COPYFILE_EXCL);
  if(await hashFile(source)!==sha256)throw Error('checksum mismatch');
  const config={id,pid,portable,target:path.resolve(target),source,sha256,oldHash:await hashFile(target),userData:path.resolve(userData),version,readyTimeout:90};
  fs.writeFileSync(path.join(job,'update.ps1'),fs.readFileSync(path.join(__dirname,'update-restart.ps1')));
  fs.writeFileSync(path.join(job,'config.json'),JSON.stringify(config),{flag:'wx'});
  return {id,job,source,config};
 }catch(error){await fs.promises.unlink(source).catch(()=>{});throw error;}
}
async function start(job){
 const log=fs.openSync(path.join(job.job,'helper.log'),'a');
 const child=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(job.job,'update.ps1'),'-ConfigPath',path.join(job.job,'config.json')],{windowsHide:true,detached:true,stdio:['ignore',log,log]});
 try{await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});}finally{fs.closeSync(log);}child.unref();
 // Do not exit the app until the helper has loaded its configuration.
 for(let i=0;i<100;i++){if(fs.existsSync(path.join(job.job,'helper-ready')))return;await new Promise(r=>setTimeout(r,100));}
 fs.writeFileSync(path.join(job.job,'cancel'),'1');throw Error('Update helper could not start');
}
function acknowledge(app,window){
 const arg=process.argv.find(a=>a.startsWith('--locallink-update-id='));if(!arg)return;
 const id=arg.split('=')[1];if(!/^[a-f0-9-]{36}$/.test(id))return;
 const job=path.join(app.getPath('userData'),'locallink-updates',id);
 try{
  const config=JSON.parse(fs.readFileSync(path.join(job,'config.json'),'utf8'));
  const target=process.env.PORTABLE_EXECUTABLE_FILE||process.execPath;
  if(path.resolve(target).toLowerCase()!==config.target.toLowerCase()||config.version!==app.getVersion())return;
  window.webContents.once('did-finish-load',()=>fs.writeFileSync(path.join(job,'app-ready'),'1'));
 }catch{}
}
module.exports={hashFile,prepare,start,acknowledge};

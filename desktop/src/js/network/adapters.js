"use strict";
const {execFile}=require('node:child_process');
const path=require('node:path');
const {promisify}=require('node:util');
const execute=promisify(execFile);
// Fixed read-only command: no renderer input is interpolated into PowerShell.
const command="[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-NetAdapter -ErrorAction Stop | Select-Object Name,InterfaceDescription,Status,MediaType,PhysicalMediaType,HardwareInterface,TransmitLinkSpeed,ReceiveLinkSpeed | ConvertTo-Json -Compress";
function normalizeAdapters(rows){
 return (Array.isArray(rows)?rows:rows?[rows]:[]).map(row=>{
  const connected=row.Status==='Up';
  const speed=n=>connected&&Number.isFinite(Number(n))&&Number(n)>0?Number(n):null;
  const media=String(row.PhysicalMediaType||'')+' '+String(row.MediaType||'');
  const kind=row.HardwareInterface===false?'virtual':/802\.11|wireless/i.test(media)?'wifi':/802\.3|ethernet/i.test(media)?'ethernet':'other';
  return {name:String(row.Name||''),description:String(row.InterfaceDescription||''),connected,kind,sendBps:speed(row.TransmitLinkSpeed),receiveBps:speed(row.ReceiveLinkSpeed)};
 }).sort((a,b)=>Number(b.connected)-Number(a.connected)||a.name.localeCompare(b.name));
}
function createAdapterReader({platform=process.platform,run=execute,now=Date.now}={}){
 let cached=null,inflight=null;
 return async()=>{
  if(platform!=='win32')return {ok:false,reason:'unsupported',adapters:[]};
  if(cached&&now()-cached.checkedAt<5000)return cached;
  if(inflight)return inflight;
  inflight=(async()=>{
   try{
    const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    const {stdout}=await run(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:10000,maxBuffer:1024*1024,encoding:'utf8'});
    cached={ok:true,checkedAt:now(),adapters:normalizeAdapters(JSON.parse(stdout.replace(/^\uFEFF/,'').trim()||'[]'))};
    return cached;
   }catch{return {ok:false,reason:'unavailable',adapters:[]};}
   finally{inflight=null;}
  })();
  return inflight;
 };
}
module.exports={normalizeAdapters,createAdapterReader};

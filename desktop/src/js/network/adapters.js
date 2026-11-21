"use strict";
const {execFile}=require('node:child_process');
const path=require('node:path');
const {promisify}=require('node:util');
const execute=promisify(execFile);
// Fixed read-only command: no renderer input is interpolated into PowerShell.
const radioSource=require("node:fs").readFileSync(path.join(__dirname,"bluetooth-radio.cs"),"utf8");
const command=`[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); $version = -1; try { Add-Type -TypeDefinition @'
${radioSource}
'@ -ErrorAction Stop; $version = [BluetoothRadio]::SingleRadioVersion() } catch {}
 Get-NetAdapter -ErrorAction Stop | Select-Object Name,InterfaceDescription,Status,MediaType,PhysicalMediaType,HardwareInterface,TransmitLinkSpeed,ReceiveLinkSpeed,@{Name='LmpVersion';Expression={$version}} | ConvertTo-Json -Compress`;
const kindOrder = ["ethernet","wifi","bluetooth","other","virtual"];
const bluetoothVersions = ["1.0b","1.1","1.2","2.0","2.1","3.0","4.0","4.1","4.2","5.0","5.1","5.2","5.3","5.4","6.0","6.1","6.2"];
function normalizeAdapters(rows){
 return (Array.isArray(rows)?rows:rows?[rows]:[]).map(row=>{
  const connected=row.Status==='Up';
  const speed=n=>connected&&Number.isFinite(Number(n))&&Number(n)>0?Number(n):null;
  const media=String(row.PhysicalMediaType||'')+' '+String(row.MediaType||'');
  const bluetooth=/bluetooth|Л{СА|А¶СА/i.test([row.InterfaceDescription,media].join(' '));
  const kind=bluetooth?'bluetooth':row.HardwareInterface===false?'virtual':/802\.11|wireless/i.test(media)?'wifi':/802\.3|ethernet/i.test(media)?'ethernet':'other';
  return {name:String(row.Name||''),description:String(row.InterfaceDescription||''),connected,kind,bluetoothVersion:bluetooth?bluetoothVersions[row.LmpVersion]||null:null,sendBps:speed(row.TransmitLinkSpeed),receiveBps:speed(row.ReceiveLinkSpeed)};
 }).sort((a,b)=>kindOrder.indexOf(a.kind)-kindOrder.indexOf(b.kind)||Number(b.connected)-Number(a.connected)||a.name.localeCompare(b.name));
}
function createAdapterReader({platform=process.platform,run=execute,now=Date.now,interfaces=require("node:os").networkInterfaces}={}){
 let cached=null,inflight=null;
 return async()=>{
  if(platform==='darwin'){
   try {
    const adapters=Object.entries(interfaces()).flatMap(([name,addresses])=>{
     const external=(addresses || []).filter(address=>!address.internal && (address.family==='IPv4' || address.family===4));
     return external.length ? [{name, description:external.map(address=>address.address).join(', ')}] : [];
    });
    return {ok:true,addressesOnly:true,checkedAt:now(),adapters};
   } catch { return {ok:false,reason:'unavailable',adapters:[]}; }
  }
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

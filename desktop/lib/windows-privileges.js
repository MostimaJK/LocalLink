'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const path=require('node:path');
const run=promisify(execFile);

function powershell(script,env=process.env){
  const executable=path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
  return run(executable,['-NoProfile','-NonInteractive','-Command',script],{env,windowsHide:true});
}

let token;
function elevated(){
  if(!token)token=powershell('([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)')
    .then(({stdout})=>stdout.trim()==='True').catch(error=>{token=null;throw error;});
  return token;
}

async function restartElevated(app){
  const target=process.env.PORTABLE_EXECUTABLE_FILE||process.execPath;
  const userDir=app.getPath('userData');
  const args='--locallink-parent='+process.pid+' "--user-data-dir='+userDir+'"';
  const script="try { Start-Process -FilePath $env:LL_RESTART_TARGET -ArgumentList $env:LL_RESTART_ARGS -Verb RunAs -ErrorAction Stop } catch { if ($_.Exception.GetBaseException().NativeErrorCode -eq 1223) { exit 1223 }; throw }";
  await powershell(script,{...process.env,LL_RESTART_TARGET:target,LL_RESTART_ARGS:args});
}

async function waitForParent(id){
  if(!/^\d{1,10}$/.test(id))throw Error('Invalid restart request');
  const script='$p=Get-Process -Id ([int]$env:LL_PARENT_PID) -ErrorAction SilentlyContinue; if ($p -and !$p.WaitForExit(30000)) {exit 1}; exit 0';
  await powershell(script,{...process.env,LL_PARENT_PID:id});
}

module.exports={elevated,restartElevated,waitForParent};

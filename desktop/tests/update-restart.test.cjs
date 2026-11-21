const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),{spawn,execFileSync}=require('child_process');
const updater=require('../lib/update-restart');
const ps=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-updater-'));
 const compile=path.join(root,'compile.ps1'),fixture=path.join(root,'fixture.exe');
 fs.writeFileSync(compile,`param([string]$Output)
Add-Type -OutputAssembly $Output -OutputType WindowsApplication -TypeDefinition @'
using System; using System.IO;
class Fixture { public static void Main(string[] args) {
 string data=null,id=null; foreach(string arg in args){if(arg.StartsWith("--user-data-dir="))data=arg.Substring(16);if(arg.StartsWith("--locallink-update-id="))id=arg.Substring(22);}
 if(data!=null && id!=null && Environment.GetEnvironmentVariable("LOCALLINK_TEST_SKIP_READY")!="1") File.WriteAllText(Path.Combine(data,"locallink-updates",id,"app-ready"),"1");
} }
'@`);
 execFileSync(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',compile,'-Output',fixture],{windowsHide:true});
 for(const rollback of [false,true]){
  const data=path.join(root,rollback?'rollback':'資料 with spaces');fs.mkdirSync(data);
  const target=path.join(data,'LocalLink.exe'),download=path.join(data,'download.exe');fs.copyFileSync(fixture,target);fs.copyFileSync(fixture,download);fs.appendFileSync(download,'new-build');
  const oldHash=await updater.hashFile(target),sha256=await updater.hashFile(download);
  await assert.rejects(updater.prepare({file:download,sha256:'0'.repeat(64),target,userData:data,portable:true,version:'1.0.1'}),/checksum/);
  const parent=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{windowsHide:true,stdio:'ignore'});
  const job=await updater.prepare({file:download,sha256,target,userData:data,portable:true,pid:parent.pid,version:'1.0.1'});
  job.config.readyTimeout=3;fs.writeFileSync(path.join(job.job,'config.json'),JSON.stringify(job.config));
  const child=spawn(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(job.job,'update.ps1'),'-ConfigPath',path.join(job.job,'config.json'),'-NoErrorDialog'],{windowsHide:true,stdio:'ignore',env:{...process.env,LOCALLINK_TEST_SKIP_READY:rollback?'1':'0'}});
  try{
   for(let i=0;i<100&&!fs.existsSync(path.join(job.job,'helper-ready'));i++)await sleep(100);
   assert.ok(fs.existsSync(path.join(job.job,'helper-ready')));assert.equal(await updater.hashFile(target),oldHash);
   parent.kill();
   for(let i=0;i<200&&!fs.existsSync(path.join(job.job,'result.json'));i++)await sleep(100);
   const result=JSON.parse(fs.readFileSync(path.join(job.job,'result.json'),'utf8').replace(/^\uFEFF/,''));
   assert.equal(result.status,rollback?'rolled-back':'updated',JSON.stringify(result));
   assert.equal(await updater.hashFile(target),rollback?oldHash:sha256);
  }finally{parent.kill();child.kill();}
 }
 // A Setup process may exit successfully without replacing the installed binary.
 const data=path.join(root,'unchanged install');
 fs.mkdirSync(data);
 const target=path.join(data,'LocalLink.exe');fs.copyFileSync(fixture,target);
 const job=await updater.prepare({file:fixture,sha256:await updater.hashFile(fixture),target,userData:data,portable:false,pid:2147483647,version:'1.0.5'});
 execFileSync(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(job.job,'update.ps1'),'-ConfigPath',path.join(job.job,'config.json'),'-NoErrorDialog'],{windowsHide:true});
 const failed=JSON.parse(fs.readFileSync(path.join(job.job,'result.json'),'utf8').replace(/^\uFEFF/,''));
 assert.equal(failed.status,'failed');assert.match(failed.message,/Expected LocalLink 1\.0\.5/);
 assert.ok(!fs.existsSync(path.join(job.job,'app-ready')));
 console.log('PASS: helper waits for exit, verifies checksum, preserves Unicode paths, replaces/relaunches and rolls back startup failure');
})().catch(e=>{console.error(e);process.exitCode=1;});

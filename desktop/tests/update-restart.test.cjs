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
[assembly: System.Reflection.AssemblyInformationalVersion("1.0.7")]
class Fixture { public static void Main(string[] args) {
 string data=null,id=null; foreach(string arg in args){if(arg.StartsWith("--user-data-dir="))data=arg.Substring(16);if(arg.StartsWith("--locallink-update-id="))id=arg.Substring(22);}
 if(data!=null && id!=null && Environment.GetEnvironmentVariable("LOCALLINK_TEST_SKIP_READY")!="1") File.WriteAllText(Path.Combine(data,"locallink-updates",id,"app-ready"),"1");
} }
'@`);
 execFileSync(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',compile,'-Output',fixture],{windowsHide:true});
 const recoveryDir=path.join(root,'recovery');
 const setup=await updater.prepare({file:fixture,target:fixture,sha256:await updater.hashFile(fixture),userData:recoveryDir,portable:false,version:'1.0.7'});
 const attempt=await updater.lastInstall(recoveryDir,fixture,'1.0.6');
 assert.equal(attempt.updated,false);assert.equal(attempt.available,true);
 assert.equal((await updater.lastInstall(recoveryDir,fixture,'1.0.7')).updated,true);
 assert.equal(await updater.lastInstall(recoveryDir,fixture,'1.0.8'),null);
 fs.appendFileSync(attempt.file,'tampered');
 await assert.rejects(updater.prepare({file:attempt.file,sha256:attempt.sha256,target:fixture,userData:recoveryDir,portable:false,version:attempt.version}),/checksum mismatch/);
 for(const rollback of [false,true]){
  const data=path.join(root,rollback?'rollback':'資料 with spaces');fs.mkdirSync(data);
  const target=path.join(data,'LocalLink.exe'),download=path.join(data,'download.exe');fs.copyFileSync(fixture,target);fs.copyFileSync(fixture,download);fs.appendFileSync(download,'new-build');
  const oldHash=await updater.hashFile(target),sha256=await updater.hashFile(download);
  await assert.rejects(updater.prepare({file:download,sha256:'0'.repeat(64),target,userData:data,portable:true,version:'1.0.1'}),/checksum/);
  const parent=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{windowsHide:true,stdio:'ignore'});
  const job=await updater.prepare({file:download,sha256,target,userData:data,portable:true,pid:parent.pid,version:'1.0.1'});
  job.config.readyTimeout=3;fs.writeFileSync(path.join(job.job,'config.json'),JSON.stringify(job.config));
  const child=rollback?spawn(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(job.job,'update.ps1'),'-ConfigPath',path.join(job.job,'config.json'),'-NoErrorDialog'],{windowsHide:true,stdio:'ignore',env:{...process.env,LOCALLINK_TEST_SKIP_READY:'1'}}):null;
  if(!rollback)await updater.start(job);
  try{
   for(let i=0;i<100&&!fs.existsSync(path.join(job.job,'helper-ready'));i++)await sleep(100);
   assert.ok(fs.existsSync(path.join(job.job,'helper-ready')));assert.equal(await updater.hashFile(target),oldHash);
   parent.kill();
   for(let i=0;i<200&&!fs.existsSync(path.join(job.job,'result.json'));i++)await sleep(100);
   const result=JSON.parse(fs.readFileSync(path.join(job.job,'result.json'),'utf8').replace(/^\uFEFF/,''));
   assert.equal(result.status,rollback?'rolled-back':'updated',JSON.stringify(result));
   assert.equal(await updater.hashFile(target),rollback?oldHash:sha256);
  }finally{parent.kill();child?.kill();}
 }
 // Exercise the actual NSIS command line when the local Windows toolchain is available.
 const nsisDir=path.resolve(__dirname,'../dist/build-tools/nsis-bundle/windows');
 const makensis=path.join(nsisDir,'makensis.exe');
 if(fs.existsSync(makensis)){
  const installDir=path.join(root,'Setup �yԇ'),profile=path.join(root,'Setup profile');
  fs.mkdirSync(installDir);fs.mkdirSync(profile);
  const installed=path.join(installDir,'LocalLink.exe');
  fs.writeFileSync(installed,'previous build');
  const installer=path.join(root,'Setup-test.exe'),recipe=path.join(root,'test.nsi');
  fs.writeFileSync(recipe,[
   'Unicode true','RequestExecutionLevel user','Name "LocalLink test fixture"','OutFile "Setup-test.exe"',
   'Section','SetOutPath "$INSTDIR"','File /oname=LocalLink.exe "fixture.exe"','SectionEnd'
  ].join('\r\n'));
  execFileSync(makensis,['/V1',recipe],{cwd:root,windowsHide:true,env:{...process.env,NSISDIR:nsisDir}});
  // The process that starts the helper must actually exit before installation.
  const launcher=path.join(root,'start-update.cjs');
  fs.writeFileSync(launcher,`const u=require(process.argv[2]);(async()=>{
   const [file,target,userData]=process.argv.slice(3);
   const job=await u.prepare({file,sha256:await u.hashFile(file),target,userData,portable:false,version:'1.0.7'});
   await u.start(job);
   require('node:assert/strict').equal(require('node:fs').readFileSync(target,'utf8'),'previous build');
   process.stdout.write(job.job);
  })().catch(e=>{console.error(e);process.exitCode=1});`);
  const jobPath=execFileSync(process.execPath,[launcher,require.resolve('../lib/update-restart'),installer,installed,profile],{windowsHide:true,encoding:'utf8',timeout:90000});
  const resultFile=path.join(jobPath,'result.json');
  for(let i=0;i<300&&!fs.existsSync(resultFile);i++)await sleep(100);
  const result=JSON.parse(fs.readFileSync(resultFile,'utf8').replace(/^\uFEFF/,''));
  assert.equal(result.status,'updated',JSON.stringify(result));
  assert.equal(await updater.hashFile(installed),await updater.hashFile(fixture));
  console.log('PASS: ordinary parent exits; real user-scope NSIS Setup installs in place and the restarted fixture acknowledges the update');
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

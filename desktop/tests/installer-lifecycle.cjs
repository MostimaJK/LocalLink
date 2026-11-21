// Isolated NSIS install/upgrade/uninstall. Never uses the production application ID.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const {spawn}=require('child_process');const {_electron}=require('@playwright/test');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ll-install-test-')),install=path.join(root,'app'),data=path.join(root,'data');fs.mkdirSync(data);
const run=(exe,args,env=process.env)=>new Promise((resolve,reject)=>{const child=spawn(exe,args,{windowsHide:true,stdio:'inherit',env});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Process failed: '+code)));});
async function open(version){
 const app=await _electron.launch({executablePath:path.join(install,'LocalLink Verification.exe'),args:['--user-data-dir='+data,'--disable-gpu','--no-sandbox']});
 const page=await app.firstWindow();await page.waitForSelector('#middle-sidebar-container');await page.waitForFunction(()=>window.localSendStatus?.ok===true);
 assert.equal(await app.evaluate(({app})=>app.getVersion()),version);
 assert.equal(await app.evaluate(({app})=>app.getPath('userData')),data);
 return {app,page};
}
(async()=>{
 const one=path.resolve('dist/verification/LocalLink-Setup-1.0.0.exe');
 await run(one,['/S','/D='+install]);
 let session=await open('1.0.0');
 await session.page.evaluate(()=>{window.Identity.update({username:'Migration device'});window.I18n.set('zh-Hans');window.orbitAPI.dbSetSetting('locallink.device.migration',{alias:'Favorite laptop',favorite:true});});
 const identity=await session.page.evaluate(()=>window.store.getState().currentUser.userId);
 await session.app.close();
 const cert=fs.readFileSync(path.join(data,'locallink-tls.json'),'utf8');
 // Seed the former JSON storage format in the real file database, using Electron ABI.
 await run(path.resolve('node_modules/electron/dist/electron.exe'),[path.resolve('tests/seed-legacy-transfer.cjs'),data],{...process.env,ELECTRON_RUN_AS_NODE:'1'});
 await run(process.execPath,['scripts/build-installer.cjs','1.1.0','--verification']);
 await run(path.resolve('dist/verification/LocalLink-Setup-1.1.0.exe'),['/S','/D='+install]);
 session=await open('1.1.0');
 assert.equal(await session.page.evaluate(()=>window.store.getState().currentUser.userId),identity);
 assert.equal(await session.page.evaluate(()=>window.store.getState().currentUser.username),'Migration device');
 assert.equal(await session.page.evaluate(()=>window.I18n.locale),'zh-Hans');
 assert.equal(await session.page.evaluate(()=>window.orbitAPI.dbGetSetting('locallink.device.migration').favorite),true);
 assert.equal(await session.page.evaluate(()=>window.orbitAPI.sendSync('locallink-list-transfers',{})[0].name),'legacy-file.txt');
 assert.equal(fs.readFileSync(path.join(data,'locallink-tls.json'),'utf8'),cert);
 await session.app.close();
 const uninstaller=fs.readdirSync(install).find(name=>/^Uninstall.*\.exe$/i.test(name));assert.ok(uninstaller);
 await run(path.join(install,uninstaller),['/S']);
 for(let i=0;i<100&&fs.existsSync(path.join(install,'LocalLink Verification.exe'));i++)await new Promise(r=>setTimeout(r,200));
 assert.equal(fs.existsSync(path.join(install,'LocalLink Verification.exe')),false);
 assert.ok(fs.existsSync(path.join(data,'orbit.db')));assert.ok(fs.existsSync(path.join(data,'legacy-file.txt')));
 console.log('PASS: isolated NSIS install, 1.0→1.1 upgrade, identity/cert/preferences/history migration, uninstall retains data');
 console.log('Test evidence: '+root);
})().catch(e=>{console.error(e);process.exitCode=1;});

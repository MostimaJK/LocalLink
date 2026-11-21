// Unsigned unpacked test build. No certificate, symlink privileges or publication.
const path=require('path');
const {build,Platform}=require('electron-builder');
(async()=>{
 if(process.platform!=='win32')throw new Error('Run this local build on Windows');
 const {rcedit}=await import('rcedit');
 await build({targets:Platform.WINDOWS.createTarget('dir'),publish:'never',config:{npmRebuild:false,win:{signAndEditExecutable:false}}});
 const pkg=require('../package.json');
 const exe=path.resolve('dist/win-unpacked/LocalLink.exe');
 await rcedit(exe,{icon:path.resolve('src/icons/app/locallink.ico'),'file-version':pkg.version,'product-version':pkg.version,'version-string':{ProductName:'LocalLink',FileDescription:'LocalLink device file transfer',CompanyName:'LocalLink contributors',OriginalFilename:'LocalLink.exe'}});
 console.log('Local Windows build: '+exe);
})().catch(error=>{console.error(error);process.exitCode=1;});

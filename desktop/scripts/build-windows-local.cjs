const {build,Platform}=require('electron-builder');
(async()=>{
 if(process.platform!=='win32')throw new Error('Run this build on Windows');
 await build({targets:Platform.WINDOWS.createTarget('dir'),publish:'never',config:{electronDist:require('path').resolve('node_modules/electron/dist'),npmRebuild:false,win:{signExecutable:false}}});
 console.log('Local Windows build: dist/win-unpacked/LocalLink.exe');
})().catch(error=>{console.error(error);process.exitCode=1;});

const {build,Platform}=require('electron-builder');
const path=require('path'),fs=require('fs');
// Optional checksum-verified local toolsets, prepared by prepare-windows-tools.ps1.
for(const [key,relative] of Object.entries({ELECTRON_BUILDER_NSIS_DIR:'nsis-bundle',ELECTRON_BUILDER_NSIS_RESOURCES_DIR:'nsis-bundle',ELECTRON_BUILDER_7ZIP_PATH:'7zip/bin/7za.exe'})){
 const local=path.resolve('dist/build-tools',relative);if(!process.env[key]&&fs.existsSync(local))process.env[key]=local;
}
const version=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
const portable=process.argv.includes('--portable');
const verification=process.argv.includes('--verification');
const config={electronDist:require('path').resolve('node_modules/electron/dist'),npmRebuild:false,win:{signExecutable:false},directories:{output:verification?'dist/verification':portable?'dist/portable':'dist/installer'},nsis:{artifactName:'LocalLink-Setup-${version}.exe',deleteAppDataOnUninstall:false,runAfterFinish:false}};
if(portable)config.portable={artifactName:process.env.LOCALLINK_PORTABLE_NAME||'LocalLink-${version}-Portable.exe',useZip:true};
if(verification){
 config.appId='dev.locallink.install-verification';config.productName='LocalLink Verification';
 config.extraMetadata={version:version||'1.0.0'};
 config.nsis={...config.nsis,createDesktopShortcut:false,createStartMenuShortcut:false,uninstallDisplayName:'LocalLink Verification'};
}
build({targets:Platform.WINDOWS.createTarget(portable?'portable':'nsis'),publish:'never',config}).catch(error=>{console.error(error);process.exitCode=1;});

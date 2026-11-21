const {spawnSync}=require('node:child_process');
const path=require('node:path');
for(const file of ['transfer-storage.test.js','transfer-archive.test.js','startup-history.test.js']){
 const result=spawnSync(require('electron'),[path.resolve(__dirname,'../tests',file)],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}

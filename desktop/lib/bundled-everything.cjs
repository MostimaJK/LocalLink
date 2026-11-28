const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {spawn, execFile} = require('node:child_process');

exports.createEngine = function createEngine(binary, dataDir) {
  const instance='LocalLink-'+crypto.createHash('sha256').update(dataDir).digest('hex').slice(0,16);
  let child, stopping=false;
  function stop(){
    if(!child || stopping)return;
    stopping=true;
    execFile(binary,['-instance',instance,'-quit'],{windowsHide:true,timeout:4000},()=>{});
  }
  return {
    stop,
    async start(){
      if(!child){
        fs.mkdirSync(dataDir,{recursive:true});
        const drives='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>c+':'+path.sep).filter(d=>fs.existsSync(d));
        child=spawn(binary,['-instance',instance,'-startup','-config',path.join(dataDir,'Everything.ini'),
          '-db',path.join(dataDir,'Everything.db'),'-folders',drives.join(';')],{cwd:dataDir,windowsHide:true,stdio:'ignore'});
        child.once('close',()=>{child=null;stopping=false;});
        child.on('error',()=>{});
      }
      return ['-instance',instance];
    }
  };
};

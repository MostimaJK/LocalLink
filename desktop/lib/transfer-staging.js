'use strict';
const fs=require('node:fs');
const path=require('node:path');

function identity(file, contents=false){
  return statIdentity(fs.lstatSync(file,{bigint:true}),contents);
}
function statIdentity(s,contents){
  if(s.isSymbolicLink() || !s.ino || (!s.isDirectory()&&!s.isFile()))return null;
  const fields=[s.dev,s.ino,s.birthtimeNs];
  if(contents){
    if(!s.isFile())return null;
    fields.push(s.size,s.mtimeNs);
  }
  return fields.join(':');
}

class StagingRegistry{
  constructor(db){
    this.db=db;
    db.exec('CREATE TABLE IF NOT EXISTS ll_staging(path TEXT PRIMARY KEY, identity TEXT NOT NULL, pid INTEGER NOT NULL, kind TEXT NOT NULL)');
  }
  track(file,kind){
    const real=fs.realpathSync(file),stamp=identity(real);
    if(!stamp)return;
    this.db.prepare('INSERT OR REPLACE INTO ll_staging VALUES(?,?,?,?)').run(real,stamp,process.pid,kind);
    return real;
  }
  forgetIfGone(real){
    if(!real)return;
    try{fs.lstatSync(real);}catch(e){
      if(e.code==='ENOENT')this.db.prepare('DELETE FROM ll_staging WHERE path=?').run(real);
    }
  }
  recover(){
    for(const row of this.db.prepare('SELECT * FROM ll_staging').all()){
      try{
        try{process.kill(row.pid,0);continue;}catch(e){if(e.code!=='ESRCH')continue;}
        if(fs.realpathSync(row.path)!==row.path || identity(row.path)!==row.identity)continue;
        if(row.kind==='phone')fs.unlinkSync(row.path);
        else{
          const files=fs.readdirSync(row.path,{withFileTypes:true});
          const owned=name=>row.kind==='desktop'?name==='.partial':/^(?:\.locallink-)?[a-f\d-]{36}(?:\.part)?$/i.test(name);
          if(files.some(f=>!f.isFile()||!owned(f.name)))continue;
          for(const f of files)fs.unlinkSync(path.join(row.path,f.name));
          fs.rmdirSync(row.path);
          if(row.kind==='desktop')try{fs.rmdirSync(path.dirname(row.path));}catch{}
        }
      }catch(e){if(e.code!=='ENOENT')console.warn('Deferred transfer cleanup',e.code);}
      this.forgetIfGone(row.path);
    }
  }
}
module.exports={identity,statIdentity,StagingRegistry};

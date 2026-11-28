const fs = require('node:fs/promises');
const path = require('node:path');
const {execFile} = require('node:child_process');
const run = require('node:util').promisify(execFile);

function inside(root, file) {
  const rel = path.relative(root, file);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

async function validate(root, file, allowDirectory=false) {
  if (!root || !path.isAbsolute(file)) throw Error('Choose a search folder first');
  const real = await fs.realpath(file);
  if (path.relative(root,await fs.realpath(root)) || !inside(root, real)) throw Error('Outside search folder');
  const stat = await fs.stat(real);
  if (!stat.isFile() && !(allowDirectory && stat.isDirectory())) throw Error('File unavailable');
  return {path:real, kind:stat.isDirectory()?"folder":"file", size:stat.isDirectory()?null:stat.size, modified:stat.mtimeMs, name:path.basename(real)};
}

async function search(root, query, es, runQuery = run, signal) {
  return searchRoots([root], query, es, runQuery,false,signal);
}

async function searchComputer(query, es, signal) {
  const candidates=process.platform==='win32'
    ? Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',letter=>letter+':'+path.sep)
    : [path.sep];
  const roots=(await Promise.all(candidates.map(async drive=>{
    try { return (await fs.stat(drive)).isDirectory()?drive:null; } catch { return null; }
  }))).filter(Boolean);
  return searchRoots(roots,query,es,run,true,signal);
}

async function searchRoots(roots, query, es, runQuery, computer=false, signal) {
  const root=roots[0];
  const term = String(query || '').trim().toLowerCase();
  if (!term || term.length > 180) throw Error('Enter a filename (1–180 characters)');
  if (!root) throw Error('Choose a search folder first');
  if(path.relative(root,await fs.realpath(root)))throw Error('Search folder changed; choose it again');
  const results = [];
  const add = async file => {
    try { const scope=computer?roots.find(r=>inside(r,file)):root; if(scope)results.push(await validate(scope, file,true)); } catch { /* disappeared or inaccessible */ }
  };
  if(path.isAbsolute(query.trim())){
    await add(query.trim());
    return {engine:'LocalLink',results,partial:false};
  }
  if (es) {
    const literal = Array.from(term, c => /[a-z0-9]/i.test(c) ? c : '\\x{' + c.codePointAt(0).toString(16) + '}').join('');
    const command=typeof es==='string'?es:es.command;
    let responded=false;
    for (const instance of [['-instance','1.5a'], [], null]) {
      try {
        if (!instance && (responded || !es.engine)) break;
        const target=instance || await es.engine.start();
        const {stdout} = await runQuery(command,[...target,...(computer?[]:['-path',root]),'-n','51','-sort','date-modified-descending','-regex',literal],{windowsHide:true,timeout:2500,signal});
        if(instance){responded=true;es.engine?.stop();}
        const files = stdout.trimEnd().split(/\r?\n/).filter(Boolean);
        for (const file of files.slice(0,50)) await add(file);
        if (results.length) return {engine:'Everything',results,partial:files.length>50};
      } catch(error) {
        signal?.throwIfAborted();
        // Only ES exit code 8 confirms that this instance is absent.
        if(instance && error.code!==8)responded=true;
      }
    }
  }
  const dirs=[...roots], deadline=Date.now()+6000;
  let seen=0, skipped=false, truncated=false;
  // Only the newest 50 entries are displayed. Bound memory for broad queries.
  function keepNewest() {
    results.sort((a,b)=>b.modified-a.modified);
    if(results.length>50){results.length=50;truncated=true;}
  }
  let cursor=0;
  while (cursor<dirs.length && Date.now()<deadline && seen<60000) {
    signal?.throwIfAborted();
    const dir=dirs[cursor++];
    let handle;
    try {
      handle=await fs.opendir(dir);
      for await (const item of handle) {
        signal?.throwIfAborted();
        if (++seen>=60000 || Date.now()>=deadline) return finish(true);
        const file=path.join(dir,item.name);
        if(item.isDirectory() && !item.isSymbolicLink()) dirs.push(file);
        if((item.isFile() || item.isDirectory()) && item.name.toLowerCase().includes(term)) {
          await add(file);
          if(results.length===100)keepNewest();
        }
      }
    } catch { signal?.throwIfAborted(); skipped=true; }
  }
  return finish(cursor<dirs.length);
  function finish(partial) {
    keepNewest();
    return {engine:'LocalLink',partial:partial||skipped||truncated,results};
  }
}
module.exports={search,validate,searchComputer};

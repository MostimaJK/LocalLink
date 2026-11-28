const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os'), path=require('node:path'), fs=require('node:fs/promises');
const {search,validate}=require('../lib/local-search.cjs');

test('folder search works without Everything and limits file access to the selected directory',async()=>{
  const tmp=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'locallink-search-'));
  try{
    const root=path.join(tmp,'workspace');
    await fs.mkdir(root);
    const name='构建 [portable].exe';
    await fs.writeFile(path.join(root,name),'sample');
    await fs.writeFile(path.join(tmp,name),'outside');
    const result=await search(root,'[portable]',null);
    assert.equal(result.engine,'LocalLink');
    assert.deepEqual(result.results.map(f=>f.name),[name]);
    await assert.rejects(validate(root,path.join(tmp,name)),/Outside search folder/);
  }finally{await fs.rm(tmp,{recursive:true,force:true});}
});

test('empty or stale index falls back and a later query reuses the ready index',async()=>{
  const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'ll-index-'));
  try {
    const file=path.join(root,'build.exe');
    await fs.writeFile(file,'sample');
    for(const stdout of ['',path.join(root,'gone.exe'),file]){
      const reply=await search(root,'exe','es',async()=>({stdout}));
      assert.equal(reply.engine,stdout===file?'Everything':'LocalLink');
      assert.equal(reply.results[0].name,'build.exe');
    }
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('fallback keeps the newest 50 matches across multiple batches',async()=>{
  const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'ll-many-'));
  try {
    for(let i=0;i<160;i++){
      const file=path.join(root,'report-'+i);
      await fs.writeFile(file,'');
      const time=1700000000+i;
      await fs.utimes(file,time,time);
    }
    const result=await search(root,'report',null);
    assert.equal(result.partial,true);
    assert.deepEqual(result.results.map(file=>file.name),
      Array.from({length:50},(_,i)=>'report-'+(159-i)));
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

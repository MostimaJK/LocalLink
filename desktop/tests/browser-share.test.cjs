'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const {startShare} = require('../lib/browser-share');

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'ll-share-tls-'));
  const options = {address:'127.0.0.1',receiveDir:()=>dir,multiple:false,record(){},accept:async()=>true};
  let share;
  try {
    for (const key of ['HOST','CERT','KEY']) delete process.env['LOCALLINK_SHARE_'+key];
    await assert.rejects(startShare(options), /confirmation/);
    share = await startShare({...options,allowHttp:true});
    const pair = code => fetch(share.url+'pair',{method:'POST',headers:{Origin:new URL(share.url).origin,'X-Pair-Code':code}});
    for(let i=0;i<5;i++) assert.equal((await pair('incorrect')).status,i===4?429:403);
    assert.equal((await pair(share.code)).status,429);
    share.stop();
    const pem = await require('selfsigned').generate([{name:'commonName',value:'localhost'}],{
      extensions:[{name:'subjectAltName',altNames:[{type:7,ip:'127.0.0.1'}]}]
    });
    process.env.LOCALLINK_SHARE_CERT = path.join(dir,'cert.pem');
    process.env.LOCALLINK_SHARE_KEY = path.join(dir,'key.pem');
    await fs.writeFile(process.env.LOCALLINK_SHARE_CERT,pem.cert);
    await fs.writeFile(process.env.LOCALLINK_SHARE_KEY,pem.private);
    process.env.LOCALLINK_SHARE_HOST = 'wrong.example';
    await assert.rejects(startShare({...options,allowHttp:true}),/certificate/);
    process.env.LOCALLINK_SHARE_HOST = options.address;
    share = await startShare(options);
    assert.ok(share.url.startsWith('https://'));
    const request=(action,method,headers={},ca=pem.cert,body)=>new Promise((resolve,reject)=>{
      const req=https.request(share.url+action,{method,headers,ca},res=>{
        const chunks=[];
        res.on('data',chunk=>chunks.push(chunk));
        res.once('end',()=>resolve({statusCode:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
      });
      req.on('error',reject);req.end(body);
    });
    await assert.rejects(request('','GET',{},[]));
    assert.equal((await request('files','GET')).statusCode,401);
    const headers={Origin:new URL(share.url).origin,'X-Pair-Code':share.code};
    const paired=await request('pair','POST',headers);
    assert.equal(paired.statusCode,204);
    const cookie=paired.headers['set-cookie'][0];
    assert.match(cookie,/; Secure/);
    assert.equal((await request('pair','POST',headers)).statusCode,409);
    const auth={Origin:headers.Origin,Cookie:cookie.split(';')[0]};
    assert.equal((await request('files','GET',auth)).statusCode,200);
    const data=Buffer.from([0,48,255]);
    const uploadHeaders={...auth,'X-File-Name':'sample.bin','X-File-Size':data.length};
    assert.equal((await request('upload','POST',uploadHeaders,pem.cert,data)).statusCode,403);
    const offer=await request('offer','POST',auth,pem.cert,JSON.stringify([{name:'sample.bin',size:data.length}]));
    assert.equal(offer.statusCode,200);
    uploadHeaders['X-Upload-Token']=JSON.parse(offer.body)[0];
    assert.equal((await request('upload','POST',uploadHeaders,pem.cert,data)).statusCode,201);
    assert.equal((await request('upload','POST',uploadHeaders,pem.cert,data)).statusCode,403);
    const [file]=await share.add([path.join(dir,'sample.bin')]);
    assert.equal((await request(file.id,'GET',auth)).statusCode,403);
    await request('decision','POST',{...auth,'X-File-Id':file.id,'X-Decision':'accept'});
    assert.deepEqual((await request(file.id,'GET',auth)).body,data);
    share.stop();
    share=await startShare({...options,multiple:true});
    const pairPhone=async()=>{
      const origin=new URL(share.url).origin;
      const res=await request('pair','POST',{Origin:origin,'X-Pair-Code':share.code});
      assert.equal(res.statusCode,204);
      return {Origin:origin,Cookie:res.headers['set-cookie'][0].split(';')[0]};
    };
    const phones=await Promise.all([pairPhone(),pairPhone()]);
    assert.notEqual(phones[0].Cookie,phones[1].Cookie);
    assert.equal(share.snapshot().url,share.url);
    const names=['first.txt','second.txt'];
    const uploads=await Promise.all(phones.map(async(auth,i)=>{
      const offer=await request('offer','POST',auth,pem.cert,JSON.stringify([{name:names[i],size:1}]));
      assert.equal(offer.statusCode,200);
      return {...auth,'X-Upload-Token':JSON.parse(offer.body)[0],'X-File-Name':names[i],'X-File-Size':1};
    }));
    assert.equal((await request('upload','POST',{...uploads[0],Cookie:phones[1].Cookie},pem.cert,'x')).statusCode,403);
    await Promise.all(uploads.map(async(headers,i)=>{
      assert.equal((await request('upload','POST',headers,pem.cert,String(i))).statusCode,201);
      assert.equal(await fs.readFile(path.join(dir,names[i]),'utf8'),String(i));
    }));
    const [shared]=await share.add([path.join(dir,'sample.bin')]);
    for(const auth of phones) { await request('decision','POST',{...auth,'X-File-Id':shared.id,'X-Decision':'accept'}); assert.deepEqual((await request(shared.id,'GET',auth)).body,data); }
    // Re-open with a host which declines every incoming file.
    share.stop();
    share=await startShare({...options,multiple:true,accept:async()=>false});
    const [author,reader,other]=await Promise.all([pairPhone(),pairPhone(),pairPhone()]);
    const groupFile={name:'relay-only.txt',size:5,pixels:{width:1,height:1,rgb:'////'}};
    const offering=request('offer','POST',author,pem.cert,JSON.stringify([groupFile]));
    const getRoom=async auth=>JSON.parse((await request('room','GET',auth)).body);
    let pending;
    for(let n=0;n<100&&!pending;n++){
      pending=(await getRoom(reader)).files[0];
      if(!pending)await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(pending.hasPreview,true);
    const preview=await request('preview/'+pending.id,'GET',reader);
    assert.equal(preview.headers['content-type'],'image/png');
    assert.equal(preview.body.readUInt32BE(16),1);
    assert.equal((await request(pending.id,'GET',reader)).statusCode,403);
    const decide=(auth,value)=>request('decision','POST',{...auth,'X-File-Id':pending.id,'X-Decision':value});
    assert.equal((await decide(other,'reject')).statusCode,204);
    assert.equal((await decide(reader,'accept')).statusCode,204);
    const token=JSON.parse((await offering).body)[0];
    assert.equal((await request('upload','POST',{...author,'X-Upload-Token':token,'X-File-Name':groupFile.name,'X-File-Size':5},pem.cert,'group')).statusCode,201);
    assert.equal((await request(pending.id,'GET',reader)).body.toString(),'group');
    assert.equal((await request(pending.id,'GET',other)).statusCode,403);
    assert.equal((await fs.readdir(dir)).includes(groupFile.name),false);
    assert.equal((await request('message','POST',author,pem.cert,'分享文字')).statusCode,204);
    assert.equal((await getRoom(reader)).messages.at(-1).text,'分享文字');
    const rooms=(await fs.readdir(os.tmpdir())).filter(name=>name.startsWith('locallink-room-'));
    const staged=await Promise.all(rooms.map(async name=>{
      const dir=path.join(os.tmpdir(),name);
      return (await fs.readdir(dir).catch(()=>[])).includes(pending.id)?dir:null;
    }));
    const cached=staged.find(Boolean);
    assert.ok(cached);
    await share.stop();
    await assert.rejects(fs.stat(cached),{code:'ENOENT'});
    share=await startShare({...options,multiple:true,memberGraceMs:250,accept:async()=>false});
    const [waiting]=await Promise.all([pairPhone(),pairPhone()]);
    const unattended=await request('offer','POST',waiting,pem.cert,JSON.stringify([{name:'pending.txt',size:1}]));
    assert.equal(unattended.statusCode,403);
    await share.stop();
    const {BrowserRoom}=require('../lib/browser-room');
    const records=[],source=path.join(dir,'relay-source');
    await fs.writeFile(source,'hello');
    let destination=source;
    const room=new BrowserRoom({receiveDir:()=>destination,record:row=>records.push(row)});
    const item={id:'retry-test',hostApproved:true,path:source,name:'receive.txt',size:5};
    assert.equal(await room.save(item),false);
    destination=path.join(dir,'retry-target');
    assert.deepEqual(await Promise.all([room.save(item),room.save(item)]),[true,true]);
    assert.deepEqual(records.map(r=>r.status),['failed','received']);
    assert.equal(records[0].id,records[1].id);
    assert.deepEqual(await fs.readdir(destination),['receive.txt']);
    assert.equal(await fs.readFile(source,'utf8'),'hello');
    const {EventEmitter}=require('node:events');
    const timed=new BrowserRoom({receiptMinutes:()=>0.0005});
    const result=await timed.offer([{name:'wait',size:1}],1,[2],()=>new Promise(()=>{}),new EventEmitter());
    assert.deepEqual(result,[null]);await timed.close();
    const noLimit=new BrowserRoom({receiptMinutes:()=>0});
    const pendingOffer=noLimit.offer([{name:'wait',size:1}],1,[2],()=>Promise.resolve(false),new EventEmitter());
    await new Promise(resolve=>setTimeout(resolve,60));
    assert.equal(noLimit.files.size,1);
    noLimit.decide([...noLimit.files.keys()][0],2,'accept');assert.equal((await pendingOffer).length,1);
    await noLimit.close();
    console.log('PASS single and multi-phone pairing, isolated simultaneous uploads and shared downloads');
  } finally {share?.stop();await fs.rm(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

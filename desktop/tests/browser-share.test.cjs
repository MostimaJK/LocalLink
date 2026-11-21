'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const {startShare} = require('../lib/browser-share');

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'ll-share-tls-'));
  const options = {address:'127.0.0.1',receiveDir:()=>dir,record(){}};
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
    assert.equal((await request('upload','POST',{...auth,'X-File-Name':'sample.bin','X-File-Size':data.length},pem.cert,data)).statusCode,201);
    const [file]=await share.add([path.join(dir,'sample.bin')]);
    assert.deepEqual((await request(file.id,'GET',auth)).body,data);
    console.log('PASS explicit HTTP, pairing lockout, certificate verification, HTTPS-only mode and one browser per session');
  } finally {share?.stop();await fs.rm(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

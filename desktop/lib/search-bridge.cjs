const http=require('node:http');
const crypto=require('node:crypto');
const os=require('node:os');
const path=require('node:path');

exports.start=function start({db,onCall,app}) {
  const id=crypto.randomUUID();
  const socket=process.platform==='win32'?'\\\\.\\pipe\\locallink-'+id:path.join(os.tmpdir(),'ll-'+id+'.sock');
  const token=crypto.randomBytes(32).toString('hex');
  const server=http.createServer(async(req,res)=>{
    try {
      if(req.method!=='POST'||req.headers.authorization!=='Bearer '+token)throw Error('Unauthorized');
      req.setEncoding('utf8');
      let body='';
      for await(const chunk of req){body+=chunk;if(body.length>16384)throw Error('Request too large');}
      const {name,args}=JSON.parse(body);
      const result=await onCall(name,args);
      res.end(JSON.stringify({result}));
    }catch(e){res.end(JSON.stringify({error:e.message}));}
  });
  server.on('error',err=>console.warn('Local MCP bridge:',err.message));
  server.listen(socket,()=>db.setSetting('agent.bridge',{socket,token}));
  server.unref();
  app.once('will-quit',()=>server.close());
};

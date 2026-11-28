const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path');
const readline=require('node:readline');
const db=new DatabaseSync(process.argv[2]||path.join(process.env.APPDATA,'orbit-beta','orbit.db'),{readOnly:true});
const setting=(key,fallback=false)=>JSON.parse(db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value??JSON.stringify(fallback));
const tools=[
 ['search_local_files','Search filenames within the configured local folder. Results include path, size and modified timestamp.',{query:'string'}],
 ['list_send_devices','List online paired devices for sending files',{}],
 ['send_local_file','Send one file from the authorized local folder to a paired device; LocalLink requests confirmation unless a matching rule exists.',{path:'string',peerId:'string'}],
 ['list_devices','List sources of shared inbox items',{}],
 ['list_received_items','List shared inbox items, newest first',{peerId:'string',after:'integer',before:'integer',kind:'string',offset:'integer'}],
 ['read_message','Read one shared incoming message',{id:'string'}],
 ['read_attachment','Read one shared incoming image or text file (up to 8 MiB)',{id:'string'}]
].map(([name,description,fields])=>({name,description,inputSchema:{type:'object',properties:Object.fromEntries(Object.entries(fields).map(([k,type])=>[k,{type}])),required:name==='send_local_file'?['path','peerId']:name==='search_local_files'?['query']:fields.id?['id']:[],additionalProperties:false}}));
const allowed=` FROM locallink_transfers t WHERE direction='incoming' AND status='received' AND
 (EXISTS(SELECT 1 FROM settings WHERE key='agent.item.'||t.id AND value='true')
 OR (json_extract(payload,'$.authenticated')=1 AND EXISTS(SELECT 1 FROM settings WHERE key='agent.peer.'||t.peerId AND value='true')))`;
const text=value=>({content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(value)}]});
async function call(name,args){
 if(['search_local_files','list_send_devices','send_local_file'].includes(name)){
   if(!setting('agent.enabled')||!setting('agent.search',true))throw Error('MCP file search disabled');
   const bridge=setting('agent.bridge');
   if(!bridge)throw Error('Open LocalLink first');
   const body=await new Promise((resolve,reject)=>{
     const req=require('node:http').request({socketPath:bridge.socket,method:'POST',headers:{Authorization:'Bearer '+bridge.token}},res=>{
       const parts=[];res.on('data',c=>parts.push(c));res.on('end',()=>resolve(Buffer.concat(parts).toString()));res.on('error',reject);
     });
     req.on('error',()=>reject(Error('Open LocalLink first')));req.end(JSON.stringify({name,args}));
   });
   const reply=JSON.parse(body);if(reply.error)throw Error(reply.error);
   return text(reply.result);
 }
 if(setting('agent.enabled')!==true)throw Error('Agent inbox disabled in LocalLink');
 if(name==='list_devices')return text(db.prepare('SELECT DISTINCT peerId'+allowed).all());
 if(name==='list_received_items'){
  let filter='';const params=[];
  if(args.peerId){filter+=' AND peerId=?';params.push(args.peerId);}
  if(args.after!=null){filter+=' AND startedAt>=?';params.push(args.after);}
  if(args.before!=null){filter+=' AND startedAt<?';params.push(args.before);}
  if(args.kind==='message')filter+=" AND json_extract(payload,'$.kind')='text'";
  else if(args.kind==='file')filter+=" AND json_extract(payload,'$.kind') IS NOT 'text'";
  else if(args.kind!=null)throw Error('kind must be message or file');
  return text(db.prepare("SELECT id,peerId,name,startedAt,json_extract(payload,'$.size') AS size"+allowed+filter+' ORDER BY startedAt DESC,id DESC LIMIT 100 OFFSET ?').all(...params,Math.max(0,Number(args.offset)||0)));
 }
 const row=db.prepare('SELECT payload'+allowed+' AND id=?').get(args.id);
 if(!row)throw Error('Item unavailable');
 const r=JSON.parse(row.payload);
 if(name==='read_message'&&r.kind==='text'&&!r.fileRemoved)return text(r.text||'');
 if(name!=='read_attachment'||!r.path||r.fileRemoved)throw Error('Content unavailable');
 if(setting('agent.attachments',true)!==true)throw Error('Attachment content access is disabled');
 const ext=path.extname(r.name).toLowerCase(), image={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[ext];
 if(!image&&!['.txt','.md','.log','.json','.csv'].includes(ext))return text({name:r.name,size:r.size,status:'metadata only'});
 const fd=fs.openSync(r.path,'r');
 try{
  const s=fs.fstatSync(fd,{bigint:true});
  if(!s.isFile()||s.size>8388608n||[s.dev,s.ino,s.birthtimeNs,s.size,s.mtimeNs].join(':')!==r.diskIdentity)throw Error('File changed, too large, or identity unavailable');
  const data=Buffer.alloc(Number(s.size));let pos=0;
  while(pos<data.length){const n=fs.readSync(fd,data,pos,data.length-pos,pos);if(!n)throw Error('File changed');pos+=n;}
  return image?{content:[{type:'image',mimeType:image,data:data.toString('base64')}]}:text(data.toString('utf8'));
 }finally{fs.closeSync(fd);}
}
readline.createInterface({input:process.stdin}).on('line',async line=>{
 let m;try{m=JSON.parse(line);}catch{return;}
 if(m.id==null)return;
 let result,error;
 if(m.method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'locallink-inbox',version:'1.0'}};
 else if(m.method==='tools/list')result={tools};
 else if(m.method==='ping')result={};
 else if(m.method==='tools/call'&&tools.some(t=>t.name===m.params?.name)){
  try{result=await call(m.params.name,m.params.arguments||{});}catch(e){result={...text(e.code?'Inbox item unavailable':e.message),isError:true};}
 }else error={code:-32601,message:'Unknown method'};
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,...(error?{error}:{result})})+'\n');
});

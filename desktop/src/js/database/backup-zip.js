'use strict';
const fs=require('fs'),zlib=require('zlib');
// Read only backup.json; never extract archive paths or invoke a shell.
module.exports=function readBackup(filePath){
 if(fs.statSync(filePath).size>512*1024*1024)throw new Error('Backup ZIP exceeds 536.87 MB');
 const data=fs.readFileSync(filePath);let end=-1;
 for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(data.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw new Error('Invalid ZIP directory');
 let offset=data.readUInt32LE(end+16);const count=data.readUInt16LE(end+10);
 for(let i=0;i<count;i++){
  if(offset+46>data.length||data.readUInt32LE(offset)!==0x02014b50)throw new Error('Invalid ZIP entry');
  const flags=data.readUInt16LE(offset+8),method=data.readUInt16LE(offset+10),crc=data.readUInt32LE(offset+16);
  const compressed=data.readUInt32LE(offset+20),size=data.readUInt32LE(offset+24),nameLength=data.readUInt16LE(offset+28);
  const extra=data.readUInt16LE(offset+30),comment=data.readUInt16LE(offset+32),local=data.readUInt32LE(offset+42);
  const name=data.subarray(offset+46,offset+46+nameLength).toString();offset+=46+nameLength+extra+comment;
  if(name!=='backup.json')continue;
  if(flags&1||![0,8].includes(method)||size>256*1024*1024)throw new Error('Unsupported backup ZIP entry');
  if(local+30>data.length||data.readUInt32LE(local)!==0x04034b50)throw new Error('Invalid ZIP data');
  const start=local+30+data.readUInt16LE(local+26)+data.readUInt16LE(local+28);
  if(start+compressed>data.length)throw new Error('Truncated backup ZIP');
  const bytes=method===0?data.subarray(start,start+compressed):zlib.inflateRawSync(data.subarray(start,start+compressed),{maxOutputLength:256*1024*1024});
  let actual=0xffffffff;for(const byte of bytes){actual^=byte;for(let j=0;j<8;j++)actual=(actual>>>1)^((actual&1)?0xedb88320:0);}
  if(bytes.length!==size||((actual^0xffffffff)>>>0)!==crc)throw new Error('Backup ZIP integrity check failed');
  return JSON.parse(bytes.toString('utf8'));
 }
 throw new Error('backup.json not found in archive');
};

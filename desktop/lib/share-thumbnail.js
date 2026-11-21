'use strict';
const {crc32, deflateSync} = require('node:zlib');

// Only bounded RGB pixels cross the receipt boundary. Re-encode them locally,
// so the preview cannot contain the original file or embedded image metadata.
function thumbnail(pixels) {
  if (!pixels) return null;
  const {width, height, rgb} = pixels;
  if (![width,height].every(n=>Number.isInteger(n) && n>0 && n<=192)) return null;
  const stride=width*3;
  if (typeof rgb!=='string' || rgb.length!==4*Math.ceil(stride*height/3)) return null;
  const data=Buffer.from(rgb,'base64');
  if (data.length!==stride*height) return null;
  const rows=Buffer.alloc((stride+1)*height);
  for(let y=0;y<height;y++) data.copy(rows,y*(stride+1)+1,y*stride,(y+1)*stride);
  function chunk(type, body) {
    const block=Buffer.alloc(12+body.length);
    block.writeUInt32BE(body.length);
    block.write(type,4,4,'ascii');
    body.copy(block,8);
    block.writeUInt32BE(crc32(block.subarray(4,-4)),block.length-4);
    return block;
  }
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
module.exports={thumbnail};

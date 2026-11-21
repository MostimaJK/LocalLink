'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { serve, boot } = require('./harness');

(async () => {
  const server = await serve();
  let browser;
  try {
    const session = await boot(server, {
      orbit_user: { id: 'receiver', name: 'Receiver', tag: '1010' },
      orbit_chats: [{ id: 'sender', name: 'Sender' }],
      orbit_friends: [{ id: 'sender', name: 'Sender', tag: '2020', status: 'online' }]
    });
    browser = session.browser;
    const page = session.page;
    await page.route('**/network/p2p-mobile.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: await response.text() +
        '\nOrbit.P2P.onMessage = callback => {window.receivePacket = callback;};' });
    });
    await page.reload();
    await page.waitForFunction(() => typeof window.receivePacket === 'function');
    for (const [label, chunks, corrupt] of [
      ['empty', [], false], ['binary', [Buffer.from([0, 128, 255])], false],
      ['multi', [Buffer.alloc(65536, 214), Buffer.from([9, 0])], false],
      ['corrupt', [Buffer.from([0, 2])], true]
    ]) {
      const bytes = Buffer.concat(chunks);
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (corrupt) chunks[0][0] ^= 1;
      const result = await page.evaluate(async ({label, data, hash, size}) => {
        let saved;
        window.BlobStoreDB.put = async (key, buf) => {saved = Array.from(new Uint8Array(buf));};
        const send = (type, fields) => window.receivePacket({connectionId:'sender'}, {
          type:Orbit.Protocol.Types[type], from:'sender', to:'receiver',
          payload:{fileId:label,...fields}
        });
        await send('FILE_TRANSFER_START', {fileName:label+'.bin',totalChunks:data.length,fileSize:size,hash});
        for (let i=0;i<data.length;i++) await send('FILE_CHUNK',{chunkIndex:i,data:data[i]});
        await send('FILE_TRANSFER_END',{hash});
        return {saved,active:!!window.activeTransfers[label]};
      }, {label,data:chunks.map(chunk=>chunk.toString('base64')),hash,size:bytes.length});
      assert.equal(result.active, false, label);
      assert.deepEqual(result.saved, corrupt ? undefined : Array.from(bytes), label);
      console.log('PASS mobile receive', label);
    }
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

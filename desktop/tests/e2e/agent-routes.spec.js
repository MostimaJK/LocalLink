const {test,expect}=require('@playwright/test');
const {tmpUserDataDir,launchApp}=require('./helpers');
test('agent access and device route controls',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('agent-routes'));
 try{
  await page.evaluate(()=>window.SettingsModal.open('agent'));
  const grant=page.locator('#ll-mcp-enabled');
  await grant.check();
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('agent.enabled',false))).toBe(true);
  await page.evaluate(()=>{
    window.SettingsModal.close();
    window.LocalLinkDevices.edit({userId:'localsend:test-route',username:'Test',status:'offline'});
  });
  await expect(page.locator('#device-details-dialog #device-transfer-route')).toHaveCount(0);
  await page.locator('#device-details-dialog input[type=checkbox]').last().check();
  await page.locator('#device-save').click();
  expect(await page.evaluate(()=>window.orbitAPI.dbGetSetting('agent.peer.localsend:test-route',false))).toBe(true);
 }finally{await app.close();}
});

test('route picker is styled before discovery completes and diagnostics show results first',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('route-startup'));
 try{
  await app.evaluate(({ipcMain})=>{
   ipcMain.removeHandler('locallink-routes');
   ipcMain.handle('locallink-routes',()=>new Promise(resolve=>{global.finishRouteLookup=()=>resolve([{key:'ethernet',label:'Ethernet',ip:'192.0.2.1'}]);}));
   ipcMain.removeHandler('locallink-speed-test');
   ipcMain.handle('locallink-speed-test',(_,payload)=>payload?{routeLabel:'Ethernet',upload:640,download:720}:[{alias:'Desktop',id:'test',ip:'192.0.2.1'}]);
  });
  await page.evaluate(()=>{
   const box=document.createElement('div');box.innerHTML='<select id="startup-route" data-peer="test"><option>Auto</option></select>';document.body.append(box);
   window.LocalLinkDevices.fillRoutes(box.firstChild,'test');
  });
  await expect(page.locator('#startup-route')).toBeHidden();
  await expect(page.locator('#startup-route-trigger')).toBeVisible();
  await app.evaluate(()=>global.finishRouteLookup());
  await expect(page.locator('#startup-route-trigger')).toContainText('Ethernet');
  await page.evaluate(()=>window.SettingsModal.open('advanced'));
  const card=page.locator('.ll-settings-card').filter({has:page.locator('.ll-speed-metrics')});
  const run=card.locator('.ll-file-actions button').last();
  await expect(card.locator('select').first().locator('option')).toContainText('Desktop');
  await app.evaluate(()=>global.finishRouteLookup());
  await run.click();
  await expect(card.locator('.ll-speed-metrics strong')).toHaveText(['80.0','90.0']);
  expect(await card.evaluate(el=>el.querySelector('.ll-speed-metrics').getBoundingClientRect().bottom<=el.querySelector('label').getBoundingClientRect().top)).toBe(true);
 }finally{await app.close();}
});

test('MCP client searches through the running app and refuses an unavailable destination',async()=>{
 const {app,page}=await launchApp(tmpUserDataDir('sender-search'));
 try{
  const config=await page.evaluate(async root=>{
    for(const [key,value] of Object.entries({'agent.enabled':true,'agent.search':true,'search.folder':root}))window.orbitAPI.dbSetSetting(key,value);
    return (await window.orbitAPI.invoke('locallink-mcp-config')).mcpServers['locallink-inbox'];
  },require('node:path').resolve(__dirname,'../../lib'));
  function call(name,args){
    const msg={jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}};
    const output=require('node:child_process').execFileSync(process.execPath,config.args,{input:JSON.stringify(msg)+'\n',encoding:'utf8',timeout:18000});
    return JSON.parse(output).result;
  }
  const files=JSON.parse(call('search_local_files',{query:'inbox-mcp'}).content[0].text).results;
  expect(files.some(f=>f.name==='inbox-mcp.cjs')).toBe(true);
  expect(call('send_local_file',{path:files[0].path,peerId:'offline-test'}).isError).toBe(true);
  await page.evaluate(()=>window.orbitAPI.dbSetSetting('agent.search',false));
  expect(call('search_local_files',{query:'inbox'}).isError).toBe(true);
 }finally{await app.close();}
});

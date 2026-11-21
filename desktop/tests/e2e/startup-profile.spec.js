const {test,expect,_electron:electron}=require('@playwright/test');
const {tmpUserDataDir}=require('./helpers');
const path=require('path');
const fs=require('fs');
test('measure first-profile and repeat startup to usable settings and transport',async()=>{
 const dir=tmpUserDataDir('startup-profile'),samples=[];
 for(let i=0;i<3;i++){
  const start=performance.now();
  const app=await electron.launch({args:['.',`--user-data-dir=${dir}`,'--disable-gpu','--no-sandbox'],cwd:path.resolve(__dirname,'../..')});
  try{
   const page=await app.firstWindow();
   await page.locator('#btn-nav-settings').click();
   await expect(page.locator('#ll-choose-directory')).toBeVisible();
   const settingsMs=Math.round(performance.now()-start);
   await page.waitForFunction(()=>window.localSendStatus?.ok===true);
   samples.push({run:i+1,profile:i===0?'new':'existing',settingsUsableMs:settingsMs,transportReadyMs:Math.round(performance.now()-start),navigation:await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {domContentLoadedMs:Math.round(n.domContentLoadedEventEnd),loadMs:Math.round(n.loadEventEnd)};})});
  }finally{await app.close();}
 }
 console.log(JSON.stringify(samples));
 fs.writeFileSync(path.resolve('../artifacts/startup-profile.json'),JSON.stringify(samples,null,2));
});

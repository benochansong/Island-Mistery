// Real browser controls and real elapsed lobby grace; no engine/state injection.
const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createServer}=require('../server/index.cjs');
const output=path.join(__dirname,'../docs');
(async()=>{
  const app=createServer({port:0,dataset:'test',lobbyReconnectMs:5000,actionMs:60000}),address=await app.listen(),url='http://127.0.0.1:'+address.port;
  const browser=await chromium.launch({channel:'chrome',headless:true}),contexts=[],report={browser:browser.version(),errors:[],capacity:false,invite:false,hostTransfer:false,graceResume:false,expiredSeat:false,expiredRecoveryForm:false,replacementStart:false,activeGameResume:false};
  async function context(){const c=await browser.newContext();contexts.push(c);return c;}
  async function page(c){const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);return p;}
  async function connected(p){await p.waitForFunction(()=>document.getElementById('online-status').textContent==='서버 연결됨');}
  try{
    const hostContext=await context(),guestContext=await context();let host=await page(hostContext);const guest=await page(guestContext);
    await host.locator('#online-button').click();await connected(host);await host.locator('#room-max').selectOption('2');await host.locator('#room-ai').uncheck();assert.equal(await host.locator('#room-max').inputValue(),'6');assert.ok(await host.locator('#room-max').isDisabled());await host.locator('#room-ai').check();assert.ok(await host.locator('#room-max').isEnabled());await host.locator('#room-max').selectOption('2');report.capacity=true;
    await host.locator('#create-nickname').fill('대기실 방장');await host.locator('#create-room-form button').click();await host.locator('#online-lobby').waitFor({state:'visible'});
    const invite=await host.locator('#invite-link').inputValue();await guest.goto(invite);await connected(guest);await guest.locator('#join-nickname').fill('남은 친구');await guest.locator('#join-room-form button').click();await guest.locator('#online-lobby').waitFor({state:'visible'});report.invite=true;
    await host.close();await guest.waitForFunction(()=>!document.getElementById('room-start').hidden);report.hostTransfer=true;
    host=await page(hostContext);await host.locator('#online-lobby').waitFor({state:'visible'});assert.equal(await host.locator('#lobby-players li').count(),2);report.graceResume=true;
    await host.close();await guest.waitForFunction(()=>document.getElementById('lobby-players').children.length===1,null,{timeout:15000});report.expiredSeat=true;
    await guest.screenshot({path:path.join(output,'phase7-repair-lobby.png')});
    host=await page(hostContext);await host.waitForFunction(()=>document.getElementById('online-error').textContent.includes('복귀 기한'));assert.ok(await host.locator('#create-room-form').isVisible());assert.ok(await host.locator('#join-room-form').isVisible());assert.equal(await host.evaluate(()=>localStorage.getItem('island-mystery.online.session.v1')),null);report.expiredRecoveryForm=true;
    const replacementContext=await context();let replacement=await page(replacementContext);await replacement.goto(invite);await connected(replacement);await replacement.locator('#join-nickname').fill('새 친구');await replacement.locator('#join-room-form button').click();await replacement.locator('#online-lobby').waitFor({state:'visible'});
    for(const p of [guest,replacement])await p.locator('#room-ready').click();await guest.locator('#room-start').click();for(const p of [guest,replacement]){await p.locator('#online-role-dialog').waitFor({state:'visible'});await p.locator('#online-role-close').click();}report.replacementStart=true;
    const role=await replacement.locator('#role-info h2').innerText();await replacement.close();await guest.waitForTimeout(6500);replacement=await page(replacementContext);await replacement.locator('#online-role-dialog').waitFor({state:'visible'});await replacement.locator('#online-role-close').click();assert.equal(await replacement.locator('#role-info h2').innerText(),role);assert.equal(await replacement.locator('#survivors .survivor').count(),6);report.activeGameResume=true;
    assert.deepEqual(report.errors,[]);
  }catch(e){report.failure=e.stack;throw e;}
  finally{fs.writeFileSync(path.join(output,'phase7-repair-lobby-results.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Conditional render fixtures, separate from the real-control full playthroughs.
const {chromium}=require('@playwright/test'),{setup,timestamp}=require('./helpers.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const g=setup(undefined,true);let s=g.state.create(timestamp,2);s.phase='voting';
g.ai={decide:v=>({kind:'vote',target:v.self.id==='seo'?null:'seo'})};
s=g.state.transition(s,{type:'ACT',kind:'vote',target:'seo'},timestamp);const voteView=g.state.viewFor(s);
const speechView=JSON.parse(JSON.stringify(voteView));speechView.phase='discussion';speechView.outcome=null;speechView.endingDetail=null;
speechView.statements=[{id:'scene-a',day:1,round:0,speakerId:'player',text:'기록을 확인했습니다.',mode:'claim'},{id:'scene-b',day:1,round:0,speakerId:'do',text:'그 주장에 반박합니다.',mode:'claim'}];
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:4173');await page.locator('#new-button').click();const saved=await page.evaluate(()=>localStorage.getItem('island-mystery.save.v4'));
  await page.evaluate(v=>{IslandMystery.ui.render(v);IslandMystery.storyUI.render(v);IslandMystery.presentation.render(v,{type:'ACT',kind:'vote'});},voteView);
  assert.match(await page.locator('.vote-leader').innerText(),/서윤 · 5표/);assert.ok(await page.locator('#survivors [data-person="seo"]').evaluate(el=>el.classList.contains('inactive')));
  await page.locator('#vote-progress').screenshot({path:path.join(__dirname,'../docs/phase5-vote-result.png')});
  await page.evaluate(v=>{IslandMystery.settings.update({autoDialogue:true,textSpeed:'instant'});IslandMystery.ui.render(v);IslandMystery.storyUI.render(v);IslandMystery.presentation.render(v,{type:'ACT',kind:'discuss'});},speechView);
  await page.waitForFunction(()=>document.getElementById('speaker-name').textContent==='도현');assert.match(await page.locator('#cinema-text').innerText(),/반박/);
  await page.locator('#dialogue-prev').click();assert.equal(await page.locator('#speaker-name').innerText(),'당신');await page.locator('#dialogue-reveal').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('island-mystery.save.v4')),saved);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(__dirname,'../docs/phase5-scene-results.json'),JSON.stringify({type:'conditional render fixtures',voteLeader:'서윤 5표',exileVisual:true,autoDialogue:true,historyNavigation:true,presentationDoesNotMutateSave:true,errors},null,2)+'\n');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

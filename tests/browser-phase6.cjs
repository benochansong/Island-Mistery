// A/B: full real-control games. C/D/E: disclosed conditional saves, then real UI/engine actions.
const {chromium}=require('@playwright/test'),{setup,withRole,timestamp}=require('./helpers.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),g=setup(undefined,true),key='island-mystery.save.v4';
function record(s,text,actorId=null,audience='public',kind='event'){const e={id:++s.sequence,day:s.day,phase:s.phase,actorId,audience,kind,text,time:s.updatedAt};s.log.push(e);return e;}
function fixture(name){
  let s=withRole(g,'engineer',2);s.resources={food:30,water:30,medicine:3,parts:10};
  if(name==='C'){
    s.phase='voting';for(const p of s.players.filter(p=>!p.isHuman)){s.secrets[p.id].suspicion.player=90;s.secrets[p.id].trust.player=0;g.perception.learn(s,p.id,{id:'fixture-proof-'+p.id,eventId:'fixture-proof',kind:'betrayal',subjectId:'player',text:'조건 테스트: 인간에 대한 직접 훼손 증거',location:'camp',reliability:1});}
  }else if(name==='D'){
    s.phase='night';s.acted=s.players.map(p=>p.id);s.resolved=true;s.resources.food=0;s.resources.water=0;for(const p of s.players)p.health=20;
  }else if(name==='E'){
    s.day=3;s.phase='afternoon';s.selectedLocation='lab';s.story.unlocked=['basement'];s.facilities.boat=13;
    for(const id of ['protocol','manifest','accident'])g.story.grant(s,'player',id,record,'public');
  }
  assert.ok(g.state.valid(s),name+' fixture is a valid save');return s;
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const report={browser:browser.version(),scenarios:[],errors:[],failures:[],timings:[],restored:[],tutorial:false,compactResults:false};
  try{
    for(const name of ['A','B','C','D','E']){
      const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
      await context.addInitScript(()=>window.addEventListener('load',()=>{window.__engineTimings=[];const old=IslandMystery.state.transition;IslandMystery.state={...IslandMystery.state,transition(s,a,...rest){const start=performance.now(),next=old(s,a,...rest);window.__engineTimings.push({day:s.day,phase:s.phase,type:a.type,ending:Boolean(next.outcome),ms:performance.now()-start});return next;}};}));
      page.on('pageerror',e=>report.errors.push({name,message:e.message}));
      const run={name,type:['A','B'].includes(name)?'full game, no injected state':'conditional save, real UI and engine afterward',steps:0,actions:[],days:[],phases:[],start:Date.now()};
      try{
        await page.goto('http://127.0.0.1:4173');run.startupMs=await page.evaluate(()=>performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd);
        const inject=['C','D','E'].includes(name);
        if(inject){await page.evaluate(({s,key})=>localStorage.setItem(key,JSON.stringify(s)),{s:fixture(name),key});await page.reload();await page.locator('#continue-button').click();}
        else{
          await page.locator('#seed-input').fill(name==='A'?'1':'5');await page.locator('#new-button').click();
          assert.ok(await page.locator('#onboarding').isVisible());await page.locator('#tutorial-open').click();assert.match(await page.locator('#help-dialog').innerText(),/공작원/);await page.locator('#close-help').click();assert.equal(await page.locator('#onboarding').isVisible(),false);report.tutorial=true;
        }
        await page.evaluate(()=>IslandMystery.settings.update({textSpeed:'instant'}));
        let restoredThisRun=new Set();
        while(!(await page.locator('#ending-panel').isVisible())&&run.steps++<100){
          const state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
          if(!run.days.includes(state.day))run.days.push(state.day);if(!run.phases.includes(state.phase))run.phases.push(state.phase);
          assert.equal(await page.locator('#action-error').innerText(),'');
          const restoreKey=state.pendingEvent?'pending':`${state.day}:${state.phase}:${state.resolved}`;
          if((state.phase==='discussion'||state.phase==='voting'&&state.resolved||state.day>1)&&!restoredThisRun.has(restoreKey)){
            restoredThisRun.add(restoreKey);const raw=await page.evaluate(k=>localStorage.getItem(k),key);report.timings.push(...await page.evaluate(()=>window.__engineTimings||[]));
            await page.reload();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),raw);await page.locator('#continue-button').click();report.restored.push(name+':'+restoreKey);
          }
          if(name==='D')assert.match(await page.locator('#context-help').innerText(),/不足|부족/);
          if(await page.locator('#event-dialog').isVisible()){
            await page.locator('#event-options button:enabled').first().click();continue;
          }
          if(await page.locator('#next-button').isEnabled()){await page.locator('#next-button').click();continue;}
          const choice=await page.evaluate(({name,key})=>{
            const g=IslandMystery,v=g.state.viewFor(JSON.parse(localStorage.getItem(key))),opts=g.state.availableActions(v),find=(k,p=()=>true)=>opts.find(a=>a.kind===k&&p(a));let a;
            if(name==='E')a=find('explore_hidden')||find('repair');
            if(name==='B'){
              if(v.phase==='discussion')a=find('lie',a=>v.self.actionHistory.some(h=>h.id===a.historyId&&['hide','sabotage'].includes(h.kind)))||find('redirect')||find('conceal');
              else if(v.phase==='voting')a=find('vote',a=>a.target===null);
              else a=find('sabotage')||find('hide')||find('explore')||find('rest');
            }
            if(name==='C'&&v.phase==='voting')a=find('vote',a=>a.target===null);
            if(!a&&v.phase==='discussion')a=find('rebut')||find('share')||find('evidence');
            a ||= g.ai.plan(v,()=>.5).action;
            const i=opts.findIndex(b=>['kind','target','facility','resource','historyId','memoryId','clueId','statementId','siteId'].every(k=>a[k]===b[k]));
            return {i,kind:a.kind,location:a.location};
          },{name,key});
          assert.ok(choice.i>=0,'legal rendered action');
          if(choice.kind==='explore'&&choice.location)await page.locator(`[data-location="${choice.location}"]`).click();
          const button=page.locator(`[data-action-index="${choice.i}"]`),details=button.locator('xpath=ancestor::details');
          if(await details.count()&&!await details.evaluate(el=>el.open))await details.locator('summary').click();
          run.actions.push(choice.kind);await button.click();
          if(choice.kind==='vote'){
            if(name==='A'){await page.locator('#cancel-vote').click();assert.equal(await page.locator('#action-list button').count()>0,true);await button.click();}
            await page.locator('#confirm-vote').click();
            if(name==='C'){const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(saved.players[0].isExiled,true);run.exiledDay=saved.day;await page.screenshot({path:path.join(root,'docs/phase6-browser-C-exile.png')});}
          }
          if(await page.locator('#turn-results details').count())report.compactResults=true;
          if(name==='E'&&choice.kind==='explore_hidden'){const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.ok(saved.secrets.player.visitedSites.includes('basement'));assert.ok(saved.secrets.player.storyClues.some(c=>c.id==='archive'));run.hiddenFound=true;}
        }
        assert.ok(await page.locator('#ending-panel').isVisible(),name+' ending');report.timings.push(...await page.evaluate(()=>window.__engineTimings||[]));
        const final=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);run.role=final.secrets.player.role;run.outcome=final.outcome;run.ending=final.endingDetail.id;run.resources=final.resources;run.elapsedSeconds=(Date.now()-run.start)/1000;
        if(name==='B'){assert.equal(run.role,'saboteur');assert.ok(run.actions.includes('lie'));assert.ok(run.actions.includes('sabotage')||run.actions.includes('hide'));}
        if(name==='C'){assert.equal(run.exiledDay,1);assert.ok(final.players[0].isExiled);}
        if(name==='D')assert.equal(final.outcome.code,'extinction');
        if(name==='E'){assert.ok(run.hiddenFound);assert.equal(final.endingDetail.id,'truth');}
        assert.equal(await page.locator('#next-button').isEnabled(),false);
        await page.waitForTimeout(850);run.audio=await page.evaluate(()=>IslandMystery.audio.diagnostics());assert.ok(run.audio.unlocked);
        await page.screenshot({path:path.join(root,`docs/phase6-browser-${name}.png`)});
        const raw=await page.evaluate(k=>localStorage.getItem(k),key);await page.reload();await page.locator('#continue-button').click();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),raw);
        await page.locator('#codex-button').click();assert.match(await page.locator('#codex-content').innerText(),/완료한 이야기 1회/);await page.locator('#close-codex').click();
        if(name==='A'){assert.equal(await page.locator('#onboarding').isVisible(),false);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(root,'docs/phase6-browser-mobile.png')});}
        report.scenarios.push(run);console.log(`Scenario ${name}: ${run.outcome.code}/${run.ending}, ${run.steps} UI steps`);
      }catch(e){report.failures.push({name,error:e.stack});await page.screenshot({path:path.join(root,`docs/phase6-browser-${name}-failure.png`)});throw e;}
      finally{await context.close();}
    }
    assert.deepEqual(report.errors,[]);assert.equal(report.scenarios.length,5);
  }finally{fs.writeFileSync(path.join(root,'docs/phase6-browser-results.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

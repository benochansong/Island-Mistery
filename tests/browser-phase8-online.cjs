// Two real browser engines, isolated storage, actual Socket.IO traffic and UI controls.
const {chromium,firefox}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.TEST_ONLINE_URL||'http://127.0.0.1:4175',root=path.resolve(__dirname,'..');
(async()=>{
  const browsers=[await chromium.launch({channel:'chrome',headless:true}),await firefox.launch({headless:true})],contexts=[],pages=[],report={browsers:[],errors:[],runs:[],reconnect:false,chat:false,privatePackets:true,rematch:false};
  try{
    for(const b of browsers){report.browsers.push(b.version());const c=await b.newContext({viewport:{width:1280,height:950}}),p=await c.newPage();contexts.push(c);pages.push(p);p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);await p.locator('#online-button').click();await p.waitForFunction(()=>document.getElementById('online-status').textContent==='서버 연결됨');}
    const [host,guest]=pages;
    await host.locator('#create-nickname').fill('바다친구');await host.locator('#create-room-name').fill('두 브라우저의 섬');await host.locator('#room-discussion').selectOption('30');await host.locator('#create-room-form button[type=submit]').click();await host.locator('#online-lobby').waitFor({state:'visible'});const code=await host.locator('#room-code').innerText();
    await guest.locator('#join-nickname').fill('숲친구');await guest.locator('#join-room-code').fill(code);await guest.locator('#join-room-form button').click();await guest.locator('#online-lobby').waitFor({state:'visible'});await host.waitForFunction(()=>document.getElementById('lobby-players').children.length===2);
    assert.equal(await guest.locator('#room-start').isVisible(),false);await host.screenshot({path:path.join(root,'docs/phase8-online-lobby.png')});
    // Capture only server-authorized snapshots via a browser-side UI diagnostic interception.
    // No server engine, secret state, role editing, or fake packet injection is used.
    for(const p of pages)await p.evaluate(()=>{window.onlineViews=[];const old=IslandMystery.ui.render;IslandMystery.ui={...IslandMystery.ui,render(v){if(v.mode==='online')window.onlineViews.push(JSON.parse(JSON.stringify(v)));return old(v);}};});
    for(let runIndex=0;runIndex<2;runIndex++){
      for(const p of pages)await p.locator('#room-ready').click();for(const p of pages)if(await p.locator('#room-start').isVisible())await p.locator('#room-start').click();for(const p of pages){await p.locator('#online-role-dialog').waitFor({state:'visible'});await p.locator('#online-role-close').click();}
      const run={roles:await Promise.all(pages.map(p=>p.locator('#role-info h2').innerText())),steps:0,chat:false,started:Date.now()};
      for(const p of pages){assert.match(await p.locator('#survivors .survivor h3').first().innerText(),/첫 생존자/);assert.equal(await p.locator('#survivors .you').count(),1);}
      while(!(await host.locator('#ending-panel').isVisible())&&run.steps++<1200){
        for(const [i,p]of pages.entries()){
          if(await p.locator('#ending-panel').isVisible())continue;
          if(await p.locator('#online-role-dialog').isVisible())await p.locator('#online-role-close').click();
          if(await p.locator('#event-dialog').isVisible()){
            const leave=p.locator('#event-options button:enabled').filter({hasText:/포기|지나간다/});if(await leave.count())await leave.first().click();else await p.locator('#event-options button:enabled').first().click();continue;
          }
          const phase=await p.evaluate(()=>document.body.dataset.phase);
          if(phase==='discussion'&&!run.chat&&i===0&&await p.locator('#online-send').isEnabled()){
            await p.locator('#online-message').fill('<img src=x onerror=alert(1)> 함께 증거를 확인해요');await p.locator('#online-send').click();await guest.waitForFunction(()=>document.getElementById('online-messages').textContent.includes('함께 증거를 확인해요'));assert.equal(await guest.locator('#online-messages img').count(),0);report.chat=true;run.chat=true;
            await p.locator('#online-chat').screenshot({path:path.join(root,'docs/phase8-online-chat.png')});
          }
          const buttons=p.locator('#action-list button:enabled');if(!await buttons.count())continue;
          const pick=await p.evaluate(()=>{const list=[...document.querySelectorAll('#action-list button:enabled')];let b=list.find(b=>/파괴|은닉/.test(b.textContent))||list.find(b=>/통신탑 수리|보트 수리/.test(b.textContent))||list.find(b=>b.textContent==='선택 지역 탐험')||list.find(b=>b.textContent==='기권')||list.find(b=>/물자 상황 공유/.test(b.textContent))||list.find(b=>/^휴식/.test(b.textContent))||list[0];return b?.dataset.actionIndex;});
          if(pick===undefined)continue;const button=p.locator(`[data-action-index="${pick}"]`),details=button.locator('xpath=ancestor::details');if(await details.count()&&!await details.evaluate(e=>e.open))await details.locator('summary').click();await button.click();if(await p.locator('#vote-dialog').isVisible())await p.locator('#confirm-vote').click();
          if(!report.reconnect&&i===0&&phase==='morning'){
            const role=await host.locator('#role-info h2').innerText();await host.reload();await host.waitForFunction(()=>!document.getElementById('game').hidden&&document.body.dataset.online==='true');if(await host.locator('#online-role-dialog').isVisible())await host.locator('#online-role-close').click();assert.equal(await host.locator('#role-info h2').innerText(),role);report.reconnect=true;
            await host.evaluate(()=>{window.onlineViews=[];const old=IslandMystery.ui.render;IslandMystery.ui={...IslandMystery.ui,render(v){if(v.mode==='online')window.onlineViews.push(JSON.parse(JSON.stringify(v)));return old(v);}};});
          }
        }
        await host.waitForTimeout(160);
      }
      for(const p of pages)await p.locator('#ending-panel').waitFor({state:'visible',timeout:15000});run.ending=await host.locator('#ending-title').innerText();assert.equal(await guest.locator('#ending-title').innerText(),run.ending);run.seconds=(Date.now()-run.started)/1000;report.runs.push(run);
      for(const p of pages){await p.locator('#growth-result .growth-xp').waitFor();await p.locator('[data-growth=profile]').first().click();await p.locator('#growth-source').selectOption('online');await p.locator('#profile-nickname').waitFor();assert.equal(await p.locator('#growth-error').innerText(),'');await p.locator('#growth-close').click();const profile=await p.evaluate(()=>IslandMystery.online.service('profile:get'));assert.equal(profile.profile.totals.completed,runIndex+1);assert.ok(profile.profile.xp>=50);}
      const boards=await Promise.all(pages.map(p=>p.evaluate(()=>IslandMystery.online.service('leaderboard:list',{kind:'casual'}))));assert.deepEqual(boards[0].rows,boards[1].rows);assert.equal(boards[0].global,false);assert.ok(boards[0].rows.length>=2);report.serverRecords=true;
      await guest.locator('[data-growth=leaderboard]').first().click();await guest.waitForFunction(()=>document.getElementById('growth-content').textContent.includes('글로벌 랭킹 비활성'));await guest.screenshot({path:path.join(root,'docs/phase8-online-ranking.png')});await guest.locator('#growth-close').click();
      await host.screenshot({path:path.join(root,`docs/phase8-online-ending-${runIndex}.png`)});
      for(const p of pages){const views=await p.evaluate(()=>window.onlineViews||[]);assert.ok(views.length);for(const v of views){assert.ok(!('secrets'in v)&&!('rng'in v)&&!('replaySeed'in v));assert.ok(v.players.every(p=>!('role'in p)&&!('memory'in p)));}assert.equal(await p.evaluate(()=>localStorage.getItem('island-mystery.save.v4')),null);}
      if(runIndex===0){for(const p of pages)if(await p.locator('#online-rematch').isVisible())await p.locator('#online-rematch').click();for(const p of pages)await p.locator('#online-lobby').waitFor({state:'visible'});report.rematch=true;}
    }
    await guest.setViewportSize({width:390,height:844});assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await guest.screenshot({path:path.join(root,'docs/phase8-online-mobile.png')});
    assert.deepEqual(report.errors,[]);
  }catch(e){report.failure=e.stack;for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:path.join(root,`docs/phase8-online-failure-${i}.png`)});throw e;}
  finally{fs.writeFileSync(path.join(root,'docs/phase8-online-browser-results.json'),JSON.stringify(report,null,2)+'\n');for(const b of browsers)await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

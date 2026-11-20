// Isolated real Chrome contexts. Gameplay uses visible controls only; no state injection.
const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  const report={browser:await browser.version(),runs:[],errors:[],failedRequests:[],restoredPending:false,voteCancellation:false};
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('requestfailed',r=>report.failedRequests.push(r.url()));
  try{
    await page.goto('http://127.0.0.1:4173');
    for(const seed of [1,2,5]){
      if(seed>1)await page.locator('#menu-button').click();
      await page.locator('#seed-input').fill(String(seed));await page.locator('#new-button').click();
      if(await page.locator('#restart-dialog').isVisible())await page.locator('#confirm-restart').click();
      await page.locator(`[data-location="${seed===1?'coast':seed===2?'lab':'tower'}"]`).click();
      const run={seed,role:await page.locator('#role-info h2').innerText(),choices:[],steps:0,ending:null};
      while(!(await page.locator('#ending-panel').isVisible())&&run.steps++<85){
        const error=await page.locator('#action-error').innerText();assert.equal(error,'');
        if(await page.locator('#event-dialog').isVisible()){
          const name=await page.locator('#event-title').innerText();assert.equal(await page.locator('#next-button').isEnabled(),false);
          if(!report.restoredPending){const before=await page.locator('#event-options').innerText();await page.reload();await page.locator('#continue-button').click();assert.equal(await page.locator('#event-title').innerText(),name);assert.equal(await page.locator('#event-options').innerText(),before);report.restoredPending=true;await page.screenshot({path:path.join(root,'docs/phase4-browser-event.png')});}
          const available=page.locator('#event-options button:enabled'),labels=await available.allTextContents();
          const selected=seed===2?labels.find(x=>/혼자|개인|보관/.test(x))||labels[0]:seed===3?labels.find(x=>/동료에게/.test(x))||labels[0]:labels[0];
          run.choices.push({name,choice:selected});await available.filter({hasText:selected}).click();continue;
        }
        if(await page.locator('#next-button').isEnabled()){await page.locator('#next-button').click();continue;}
        const stage=await page.locator('#action-title').innerText();
        if(stage.startsWith('토론 ')){
          const share=page.locator('#action-list button').filter({hasText:/^단서 공개:/});
          if(seed===2&&stage.includes('1/5')&&await share.count()){await page.locator('#action-list summary').filter({hasText:'사실과 단서'}).click();await share.first().click();}
          else await page.locator('#skip-discussion').click();
          continue;
        }
        const options=await page.locator('#action-list button').allTextContents();
        if(options.includes('기권')){
          await page.getByRole('button',{name:'기권',exact:true}).click();
          if(!report.voteCancellation){await page.locator('#cancel-vote').click();assert.ok(await page.getByRole('button',{name:'기권',exact:true}).isEnabled());await page.getByRole('button',{name:'기권',exact:true}).click();report.voteCancellation=true;}
          await page.locator('#confirm-vote').click();continue;
        }
        const choice=(seed===2?options.find(x=>x.startsWith('연구 기록 조사'))||options.find(x=>x.includes('희귀 물자')):null)||options.find(x=>/파괴|은닉/.test(x))||options.find(x=>/^보트 수리|^통신탑 수리/.test(x))||options.find(x=>x==='선택 지역 탐험')||options.find(x=>/^식수 2|^휴식/.test(x))||options[0];
        assert.ok(choice,'an enabled progression choice is available');await page.getByRole('button',{name:choice,exact:true}).click();
      }
      assert.ok(await page.locator('#ending-panel').isVisible(),'complete ending');run.ending=await page.locator('#ending-panel').innerText();
      assert.match(run.ending,/공작원의 정체/);assert.match(run.ending,/개인 목표/);assert.match(run.ending,/도감에 저장/);
      assert.equal(await page.locator('#next-button').isEnabled(),false);
      await page.screenshot({path:path.join(root,`docs/phase4-browser-ending-${seed}.png`)});
      await page.locator('#codex-button').click();const codex=await page.locator('#codex-content').innerText();assert.match(codex,new RegExp('완료한 이야기 '+(report.runs.length+1)+'회'));run.codexSummary=codex.split('\n')[0];await page.locator('#close-codex').click();
      report.runs.push(run);console.log(`Browser seed ${seed} completed: ${run.role}, ${run.steps} UI steps`);
    }
    await page.reload();await page.locator('#codex-button').click();assert.match(await page.locator('#codex-content').innerText(),/완료한 이야기 3회/);
    await page.screenshot({path:path.join(root,'docs/phase4-browser-codex.png')});await page.locator('#close-codex').click();
    await page.setViewportSize({width:390,height:844});await page.locator('#continue-button').click();
    report.mobile=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(report.mobile.scrollWidth<=report.mobile.width);
    await page.screenshot({path:path.join(root,'docs/phase4-browser-mobile.png')});assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);
  }catch(error){report.failure=error.stack;await page.screenshot({path:path.join(root,'docs/phase4-browser-failure.png')});throw error;}
  finally{fs.writeFileSync(path.join(root,'docs/phase4-browser-results.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

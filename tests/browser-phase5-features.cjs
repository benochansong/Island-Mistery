const {chromium,firefox}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:4173';
(async()=>{
  const report={browsers:[],audioTracks:[],fallbacks:[],errors:[]};
  try {
    for(const [name,engine,options]of [['Chrome',chromium,{channel:'chrome'}],['Firefox',firefox,{}]]){
      const browser=await engine.launch({headless:true,...options});
      try {
        const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(url);await page.waitForFunction(()=>document.body.classList.contains('asset-portraits'));await page.waitForTimeout(700);
        await page.locator('#settings-button').click();
        await page.locator('[data-setting="master"]').fill('0.5');await page.locator('[data-setting="musicVolume"]').fill('0.4');
        await page.locator('[data-setting="autoDialogue"]').check();await page.locator('[data-setting="textSpeed"]').selectOption('slow');
        await page.locator('#fullscreen-button').click();await page.waitForTimeout(100);assert.ok((await page.locator('#fullscreen-status').innerText()).length>0);
        await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
        await page.screenshot({path:path.join(root,`docs/phase5-${name.toLowerCase()}-settings.png`)});
        await page.locator('#close-settings').click();await page.locator('#seed-input').fill('2');await page.locator('#new-button').click();
        await page.waitForTimeout(900);
        for(const track of await page.evaluate(()=>Object.keys(IslandMystery.assets.bgm))){
          await page.evaluate(id=>IslandMystery.audio.scene(id),track);await page.waitForFunction(()=>{const d=IslandMystery.audio.diagnostics();return d.playing&&d.currentTime>0&&Math.abs(d.volume-.2)<.01;},null,{timeout:8000});
          const d=await page.evaluate(()=>IslandMystery.audio.diagnostics());assert.equal(d.desired,track);assert.ok(d.playing&&d.currentTime>0);assert.ok(Math.abs(d.volume-.2)<.01);report.audioTracks.push({browser:name,track,time:d.currentTime});
        }
        const sfx=await page.evaluate(()=>{let accepted=0;for(let i=0;i<30;i++)if(IslandMystery.audio.sfx('clue'))accepted++;return {accepted,...IslandMystery.audio.diagnostics()};});assert.equal(sfx.accepted,1);assert.ok(sfx.activeEffects<=3);
        await page.locator('#settings-button').click();await page.locator('[data-setting="music"]').uncheck();assert.equal(await page.evaluate(()=>IslandMystery.audio.diagnostics().playing),false);await page.locator('[data-setting="effects"]').uncheck();assert.equal(await page.evaluate(()=>IslandMystery.audio.sfx('win')),false);
        await page.locator('[data-setting="reducedMotion"]').check();await page.locator('#close-settings').click();
        const before=await page.evaluate(()=>localStorage.getItem('island-mystery.save.v4'));await page.locator('#settings-button').click();await page.locator('#reset-settings').click();await page.locator('#close-settings').click();assert.equal(await page.evaluate(()=>localStorage.getItem('island-mystery.save.v4')),before);
        await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);assert.equal(await page.evaluate(()=>IslandMystery.presentation.diagnostics().reduced),true);
        for(const region of ['coast','jungle','lab','tower']){await page.locator(`button[data-location="${region}"]`).click();assert.equal(await page.locator(`button[data-location="${region}"]`).getAttribute('aria-pressed'),'true');}
        const locked=page.locator('.site-pin.locked');assert.equal(await locked.count(),4);assert.ok((await locked.allTextContents()).every(t=>t.includes('미발견')));
        await page.getByRole('button',{name:'선택 지역 탐험',exact:true}).click();
        if(await page.locator('#event-dialog').isVisible())await page.locator('#event-options button:enabled').last().click();
        // Repeated visual skips never dispatch gameplay actions or mutate the saved state.
        const after=await page.evaluate(()=>localStorage.getItem('island-mystery.save.v4'));await page.evaluate(()=>{for(let i=0;i<50;i++)IslandMystery.presentation.skip();});assert.equal(await page.evaluate(()=>localStorage.getItem('island-mystery.save.v4')),after);
        assert.equal(await page.locator('#action-error').innerText(),'');await page.waitForTimeout(300);
        await page.screenshot({path:path.join(root,`docs/phase5-${name.toLowerCase()}-game.png`),fullPage:true});
        await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
        // Exercise a real background/foreground lifecycle event without dispatching game actions.
        await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.evaluate(()=>IslandMystery.audio.diagnostics().playing),false);
        await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
        assert.deepEqual(errors,[]);report.browsers.push({name,version:browser.version(),settings:true,audio:true,map:true,reducedMotion:true,skipDoesNotMutateSave:true,mobileWidth:390,errors});
        await context.close();
      }finally{await browser.close();}
    }
    const browser=await chromium.launch({channel:'chrome',headless:true});
    try {
      const page=await browser.newPage();const runtimeErrors=[];page.on('pageerror',e=>runtimeErrors.push(e.message));
      await page.route('**/assets/**/*.jpg',route=>route.abort());await page.route('**/assets/**/*.wav',route=>route.abort());await page.route('**/assets/island.svg',route=>route.abort());
      await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked by test','QuotaExceededError');};});
      await page.goto(url);await page.waitForFunction(()=>document.getElementById('asset-status').textContent.includes('기본 화면'));
      await page.locator('#settings-button').click();await page.locator('[data-setting="master"]').fill('0.2');assert.match(await page.locator('#settings-status').innerText(),/저장할 수 없습니다/);
      await page.evaluate(()=>{document.documentElement.requestFullscreen=undefined;});await page.locator('#fullscreen-button').click();assert.match(await page.locator('#fullscreen-status').innerText(),/사용할 수 없습니다/);await page.locator('#close-settings').click();
      await page.locator('#new-button').click();await page.getByRole('button',{name:'선택 지역 탐험',exact:true}).click();await page.waitForTimeout(300);
      assert.equal(await page.locator('#action-error').innerText(),'');assert.match(await page.locator('#save-status').innerText(),/저장 불가/);assert.ok(await page.locator('.portrait>span').first().isVisible());assert.deepEqual(runtimeErrors,[]);
      await page.screenshot({path:path.join(root,'docs/phase5-fallback.png')});report.fallbacks=['images unavailable','all audio unavailable','storage denied','fullscreen unsupported'];
    }finally{await browser.close();}
  }catch(e){report.errors.push(e.stack);throw e;}
  finally{fs.writeFileSync(path.join(root,'docs/phase5-browser-features.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});

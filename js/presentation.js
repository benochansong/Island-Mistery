(function (root) {
  'use strict';
  const game=root.IslandMystery, M=game.presentationModel, $=id=>document.getElementById(id);
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let view=null, visible=false, queue=[], cursor=0, textFrame=0, autoTimer=0, toastTimer=0, panFrame=0, typing=false;
  const motionQuery=root.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced=()=>game.settings.get().reducedMotion||root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const portrait=(id,expression=0)=>`<span class="portrait" role="img" aria-label="${esc(game.data.survivors.find(p=>p.id===id).name)} · ${M.expressions[expression]}" style="--face:${game.data.survivors.findIndex(p=>p.id===id)*20}%;--expression:${expression*20}%"><span>${esc(game.data.survivors.find(p=>p.id===id).initials)}</span></span>`;
  function stopText() { cancelAnimationFrame(textFrame); clearTimeout(autoTimer); typing=false; }
  function finishText() { stopText(); if(queue[cursor])$('cinema-text').textContent=queue[cursor].text; }
  function skip() { finishText(); $('fx-notice').hidden=true; clearTimeout(toastTimer); document.body.classList.remove('transitioning'); }
  function toast(title,text,kind='discovery') {
    clearTimeout(toastTimer); $('fx-title').textContent=title; $('fx-text').textContent=text; $('fx-notice').dataset.kind=kind; $('fx-notice').hidden=false;
    toastTimer=setTimeout(()=>{$('fx-notice').hidden=true;},7000);
  }
  function speaker(index) {
    stopText(); cursor=Math.max(0,Math.min(queue.length-1,index)); const line=queue[cursor]; if(!line||!view)return;
    const p=view.players.find(p=>p.id===line.speakerId), exp=M.expression(view,p,line);
    $('speaker-portrait').innerHTML=portrait(p.id,exp); $('speaker-name').textContent=p.name;
    $('speaker-context').textContent=`${line.day}일차 · ${game.config.discussionRounds[line.round]} · ${cursor+1}/${queue.length}`;
    $('cinema-text').setAttribute('aria-label',line.text); $('cinema-text').textContent='';
    document.querySelectorAll('[data-person]').forEach(el=>el.classList.toggle('speaking',el.dataset.person===p.id));
    $('cinema-dialogue').dataset.expression=M.expressions[exp];
    $('dialogue-prev').disabled=cursor===0; $('dialogue-next').disabled=cursor===queue.length-1;
    const speed=game.settings.get().textSpeed, duration=reduced()||speed==='instant'?0:line.text.length*(speed==='slow'?50:20), start=performance.now();
    function done(){typing=false;if(game.settings.get().autoDialogue&&cursor<queue.length-1&&!document.hidden)autoTimer=setTimeout(()=>speaker(cursor+1),1800);}
    function tick(now){const portion=duration?Math.max(0,Math.min(1,(now-start)/duration)):1;$('cinema-text').textContent=line.text.slice(0,Math.ceil(line.text.length*portion));if(portion<1)textFrame=requestAnimationFrame(tick);else done();}
    typing=true; textFrame=requestAnimationFrame(tick); game.audio.sfx(exp===4?'evidence':'dialogue');
  }
  function applySettings() {
    document.body.classList.toggle('reduce-motion',reduced()); document.body.classList.toggle('allow-shake',game.settings.get().shake&&!reduced());
    if(reduced())skip();
    const s=game.settings.get(); document.querySelectorAll('[data-setting]').forEach(input=>{const k=input.dataset.setting;if(input.type==='checkbox')input.checked=s[k];else input.value=s[k];});
    $('settings-status').textContent=game.settings.saved()?'설정은 이 브라우저에 저장됩니다.':'설정을 저장할 수 없습니다. 이번 실행 중에만 적용됩니다.';
    clearTimeout(autoTimer); if(s.autoDialogue && queue.length && visible && !typing && cursor < queue.length-1) autoTimer=setTimeout(()=>speaker(cursor+1),1800);
  }
  function assets() {
    const images=Object.entries(game.assets.images);let loaded=0,failed=0;
    for(const [key,url]of images){const image=new Image();image.onload=()=>{document.body.classList.add('asset-'+key);if(key==='island')document.documentElement.style.setProperty('--island-image',`url("${new URL(url, document.baseURI).href}")`);if(key==='portraits')document.documentElement.style.setProperty('--portrait-image',`url("${new URL(url, document.baseURI).href}")`);complete();};image.onerror=()=>{failed++;document.body.classList.add('missing-'+key);complete();};image.src=url;}
    function complete(){loaded++;$('asset-status').textContent=loaded<images.length?`화면 준비 ${loaded}/${images.length}`:failed?'일부 그림을 불러오지 못해 기본 화면을 사용합니다.':'화면 준비 완료';}
    document.querySelector('.island-art').addEventListener('error',e=>{e.target.hidden=true;document.querySelector('.map-key').textContent='기본 지도 · 지역 버튼으로 탐험 가능';});
  }
  function map(v) {
    const sites=game.storyData.sites;
    $('map-sites').innerHTML=sites.map((site,i)=>{const known=v.unlockedSites.includes(site.id),visited=v.self.visitedSites.includes(site.id),parent=game.data.locations.find(l=>l.id===site.parent);return `<button class="site-pin ${known?'unlocked':'locked'}" style="--x:${parent.x+(i%2?13:-11)}%;--y:${parent.y+12}%" data-map-site="${site.parent}" ${!known||v.outcome||v.pendingEvent?'disabled':''} title="${known?esc(site.name):'미발견 장소 · 인근 지역에서 단서를 찾으세요'}" aria-label="${known?esc(site.name):'미발견 장소'} · ${visited?'탐험 완료':known?'발견':'잠김'}">${visited?'✓':known?'◇':'?'}<span>${known?esc(site.name):'미발견'}</span></button>`;}).join('');
    document.querySelectorAll('[data-location]').forEach(el=>{const l=game.data.locations.find(l=>l.id===el.dataset.location);el.title=`${l.name} · 위험 ${l.risk} · ${l.resources}`;el.disabled=Boolean(v.outcome||v.pendingEvent);});
    // Secret names and contents stay hidden until the location has been unlocked.
    $('hidden-sites').querySelectorAll('article').forEach((el,i)=>{if(!v.unlockedSites.includes(sites[i].id)){el.querySelector('strong').textContent='▧ 미발견 장소';el.querySelector('button').textContent=game.discussion.place(sites[i].parent)+' 주변 조사';}});
    const selected=game.data.locations.find(l=>l.id===v.selectedLocation);
    $('location-details').insertAdjacentHTML('beforeend',`<p class="location-known">${v.self.visited.includes(selected.id)?'✓ 탐험 이력 있음':'○ 아직 탐험하지 않음'} · 보유 이야기 단서 ${v.self.storyClues.length}개</p>`);
  }
  function event(v) {
    const e=v.pendingEvent; $('event-dialog').dataset.effect=M.eventEffect(e);
    if(!e)return;const definition=game.storyData.events.find(x=>x.id===e.eventId);
    $('event-description').textContent=M.eventDescription(e.eventId);
    $('event-place').textContent=`${game.discussion.place(definition.location)} · ${e.private?'나에게만 공개된 사건':'공개 사건'}`;
  }
  function render(next,action=null) {
    const before=view, same=before?.runId===next.runId, changes=M.delta(before,next); view=next;
    if(!same){stopText();queue=[];$('fx-notice').hidden=true;}
    document.body.dataset.phase=next.outcome?'ending':next.phase;
    document.body.dataset.region=next.selectedLocation; document.body.dataset.day=String(next.day);
    $('scene-eyebrow').textContent=`DAY ${String(next.day).padStart(2,'0')} / ${next.phase.toUpperCase()}`;
    $('scene-title').textContent=next.outcome?next.endingDetail.title:['discussion','voting','night'].includes(next.phase)?({discussion:'불씨 사이의 목소리',voting:'누구를 남길 것인가',night:'빛이 닿지 않는 시간'}[next.phase]):game.data.locations.find(l=>l.id===next.selectedLocation).name;
    $('scene-caption').textContent=next.outcome?'모든 선택이 하나의 기록으로 남았다.':next.phase==='discussion'?'공개된 발언과 내가 확인한 증거를 비교하세요.':next.phase==='voting'?'후보를 선택하고 투표를 확정하세요.':next.phase==='night'?'직업 능력을 사용한 뒤 하루를 정산하세요.':'지도에서 지역을 고르고 아래 행동을 선택하세요.';
    if(!next.outcome)$('scene-caption').textContent += ' · 개인 목표: ' + game.storyData.missions.find(m=>m.id===next.self.mission.id).title;
    $('scene-party').innerHTML=next.players.map(p=>`<div data-person="${p.id}" class="scene-person ${p.isExiled||!p.isAlive?'eliminated':''}" title="${esc(p.name)} · ${!p.isAlive?'사망':p.isExiled?'추방':'체력 '+p.health}">${portrait(p.id,M.expression(next,p))}<span>${esc(p.name)}${p.isExiled?' · 추방':!p.isAlive?' · 사망':''}</span></div>`).join('');
    document.querySelectorAll('#survivors .survivor').forEach((el,i)=>{const p=next.players[i];el.dataset.person=p.id;el.querySelector('.avatar').outerHTML=portrait(p.id,M.expression(next,p));el.classList.toggle('injured',changes.injuries.includes(p.id));});
    map(next);event(next);
    const talk=next.phase==='discussion';$('cinema-dialogue').hidden=!talk;
    if(talk&&(changes.statements.length||!same||before.phase!=='discussion')){queue=next.statements.filter(s=>s.day===next.day);if(queue.length)speaker(changes.statements.length?Math.max(0,queue.length-changes.statements.length):queue.length-1);else{$('speaker-name').textContent='모닥불 회의';$('speaker-context').textContent='발언을 기다립니다';$('cinema-text').textContent='아래에서 당신의 발언을 선택하세요.';$('speaker-portrait').innerHTML=portrait('player');}}
    if(!talk)stopText();
    $('vote-progress').hidden=next.phase!=='voting';
    $('vote-progress').textContent=next.phase==='voting'?(next.resolved?'집계 완료 · 공개 기록에서 표와 추방 결과를 확인하세요.':'투표 대기 · 확정하면 활동 중인 AI가 순서대로 투표합니다.') : '';
    if(next.phase==='voting'&&next.resolved){const counts={};Object.values(next.votes).forEach(id=>{if(id)counts[id]=(counts[id]||0)+1;});$('vote-progress').textContent+=' AI 투표 '+Object.keys(next.votes).filter(id=>id!==next.self.id).length+'명 처리 · '+next.players.filter(p=>counts[p.id]).map(p=>p.name+' '+counts[p.id]+'표'+(p.isExiled?' · 추방':'')).join(' / '); const highest=Math.max(0,...Object.values(counts)); if(highest)$('vote-progress').insertAdjacentHTML('beforeend','<strong class="vote-leader">최다 득표: '+next.players.filter(p=>counts[p.id]===highest).map(p=>esc(p.name)).join(', ')+' · '+highest+'표</strong>');}
    if(action&&same){
      if(action.type==='SELECT_LOCATION')game.audio.sfx('map');
      if(action.type==='ACT'&&['explore','explore_hidden'].includes(action.kind)){
        $('scene-panel').classList.remove('searching');void $('scene-panel').offsetWidth;$('scene-panel').classList.add('searching');
        game.audio.sfx('explore');toast('탐색 완료 · '+game.discussion.place(next.self.location),next.lastResults.filter(x=>x.actorId===next.self.id&&['failure','resource','clue','story-clue','health'].includes(x.kind)).map(x=>x.text).slice(0,3).join(' / ')||'탐사 결과가 기록되었습니다.','explore');
      }
      if(action.type==='EVENT_CHOICE')toast('사건 선택 결과',next.lastResults.map(e=>e.text).slice(-4).join(' / '),M.eventEffect(before.pendingEvent));
      $('resource-deltas').innerHTML=changes.resources.map(r=>`<span class="delta ${r.amount<0?'loss':'gain'}">${r.amount<0?'−':'+'}${Math.abs(r.amount)} ${esc(r.name)}</span>`).join('');
      if(changes.resources.some(r=>r.amount>0))game.audio.sfx('resource');
      if(changes.injuries.length)game.audio.sfx('danger');
      if(changes.clues.length){game.audio.sfx('clue');toast('중요 기록 발견',changes.clues.map(c=>game.storyData.clues.find(x=>x.id===c.id).title).join(' · '),'document');}
      if(changes.unlocked.length){game.audio.sfx('unlock');toast('숨겨진 장소 발견',changes.unlocked.map(id=>game.storyData.sites.find(s=>s.id===id).name).join(' · '),'unlock');}
      if(action.kind==='repair')game.audio.sfx('repair');
      if(next.lastResults.some(e=>e.kind==='facility'&&/-[1-9]/.test(e.text)))game.audio.sfx('damage');
      if(next.phase==='voting'&&next.resolved&&!before.resolved){game.audio.sfx('result');toast('투표 집계 완료',next.lastResults.filter(e=>e.kind==='vote'||e.kind==='exile').map(e=>e.text).join(' / ')||$('vote-progress').textContent,'vote');}
      if(next.players.some(p=>p.isExiled&&!before.players.find(o=>o.id===p.id).isExiled))game.audio.sfx('exile');
      if(next.outcome&&!before.outcome){game.audio.sfx(next.outcome.winner===(next.self.role==='saboteur'?'saboteur':'survivors')?'win':'lose');$('ending-panel').classList.add('ending-arrival');skip();}
    }else $('resource-deltas').textContent='';
    if(visible)game.audio.scene(M.music(next));
    document.querySelectorAll('#action-list button').forEach(b=>{b.title=b.textContent;});
  }
  function screen(name) {visible=name==='game';stopText();document.body.dataset.screen=name;if(!visible){document.body.dataset.phase='menu';skip();}game.audio.scene(visible?M.music(view):'menu');if(!reduced()){document.body.classList.remove('transitioning');void document.body.offsetWidth;document.body.classList.add('transitioning');}}
  function init(selectLocation) {
    $('map-sites').addEventListener('click',e=>{const b=e.target.closest('[data-map-site]');if(b&&!b.disabled)selectLocation(b.dataset.mapSite);});
    $('settings-button').addEventListener('click',()=>{$('settings-dialog').showModal();applySettings();game.audio.status();});
    $('close-settings').addEventListener('click',()=>$('settings-dialog').close());
    $('settings-form').addEventListener('input',e=>{const input=e.target,k=input.dataset.setting;if(k)game.settings.update({[k]:input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value});});
    $('reset-settings').addEventListener('click',()=>game.settings.reset());
    $('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw Error();$('fullscreen-status').textContent=document.fullscreenElement?'전체화면 사용 중':'일반 화면';}catch{$('fullscreen-status').textContent='이 환경에서는 전체화면을 사용할 수 없습니다. 일반 화면으로 계속합니다.';}});
    $('skip-effects').addEventListener('click',skip);$('dialogue-reveal').addEventListener('click',finishText);$('dialogue-prev').addEventListener('click',()=>speaker(cursor-1));$('dialogue-next').addEventListener('click',()=>speaker(cursor+1));
    $('confirm-vote').addEventListener('click',()=>game.audio.sfx('vote'));
    $('action-list').addEventListener('click',e=>{const b=e.target.closest('[data-action-index]');if(b){document.querySelectorAll('.vote-candidate').forEach(el=>el.classList.remove('vote-candidate'));if(view?.phase==='voting')b.classList.add('vote-candidate');}});
    const stage=$('welcome');stage.addEventListener('pointermove',e=>{if(reduced()||document.hidden)return;cancelAnimationFrame(panFrame);panFrame=requestAnimationFrame(()=>{stage.style.setProperty('--pan-x',((e.clientX/root.innerWidth-.5)*8)+'px');stage.style.setProperty('--pan-y',((e.clientY/root.innerHeight-.5)*5)+'px');});});
    document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('page-hidden',document.hidden);if(document.hidden){finishText();cancelAnimationFrame(panFrame);}});
    game.settings.subscribe(applySettings);motionQuery.addEventListener('change',applySettings);applySettings();assets();game.audio.status();screen('welcome');
    const sidebar=document.querySelector('.survivors-panel');document.querySelector('.workspace').prepend(sidebar);
    document.querySelector('.workspace').after($('story-dashboard'));
  }
  game.presentation=Object.freeze({init,render,screen,skip,diagnostics:()=>({queue:queue.length,cursor,typing,reduced:reduced()})});
})(globalThis);

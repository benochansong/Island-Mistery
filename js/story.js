(function (root) {
  'use strict';
  const game = root.IslandMystery, D = game.storyData;
  const active = p => p.isAlive && !p.isExiled;
  const copy = v => JSON.parse(JSON.stringify(v));
  const pick = (items, random) => items[Math.floor(random() * items.length)];
  const byId = (items, id) => items.find(x => x.id === id);
  function initialize(s, random, enabled = true, legacy = false) {
    const initialSeed = s.rng;
    s.story = { enabled, runId: `${s.updatedAt}:${initialSeed}`, initialSeed: legacy ? null : s.initialSeed, seen: [], history: [], causes: [], pending: null, unlocked: [], closed: {}, flags: {}, publicClues: [], placements: {}, counts: {}, serial: 0 };
    if (enabled) D.clues.filter(c => !['orientation','final'].includes(c.id)).forEach(c => { s.story.placements[c.id] = pick(game.data.locations, random).id; });
    for (const p of s.players) {
      const m = s.secrets[p.id];
      m.storyClues = []; m.visited = []; m.visitedSites = []; m.missionStats = { medicine: 0, radio: 0 }; m.mission = null;
      m.background = `${p.name}은 기억 회복 프로그램의 서류에 서명했다. 그 사실만으로 현재의 진영을 판단할 수 없다.`;
      if (!enabled) continue;
      let pool = D.missions.map(m => m.id);
      if (m.role === 'saboteur') pool = ['cover','conceal','document','archive'];
      else {
        if (m.role === 'doctor') pool.push('medicine','protect');
        if (m.role === 'engineer') pool.push('radio','radio');
        if (m.role === 'investigator') pool.push('access','truth');
        if (m.traits.cooperation > .8) pool.push('protect','escapeTogether');
        if (m.traits.cooperation < .3) pool.push('conceal','cover');
      }
      m.mission = { id: pick(pool, random), target: pick(s.players.filter(o => o.id !== p.id), random).id, progress: 0, complete: false, score: 0 };
      if (!legacy) for (const other of s.players.filter(o => o.id !== p.id)) {
        m.trust[other.id] += Math.floor(random() * 11) - 5;
        m.suspicion[other.id] += Math.floor(random() * 7) - 3;
      }
    }
    // Legacy saves keep the random stream and existing relationships; no invented old observations.
    if (legacy || !enabled) s.rng = initialSeed;
  }
  function learn(s, who, fields) {
    game.perception.learn(s, who, { id: `story-memory-${s.story.serial++}-${who}`, eventId: `story-event-${s.story.serial}`, ...fields });
  }
  function grant(s, who, clueId, record, audience = 'actor') {
    const c = byId(D.clues, clueId);
    if (!c) throw new Error('등록되지 않은 이야기 단서입니다.');
    const recipients = audience === 'public' ? s.players.filter(active).map(p => p.id) : [who];
    for (const id of recipients) {
      const mind = s.secrets[id];
      if (mind.storyClues.some(x => x.id === clueId)) continue;
      const entry = { id: clueId, day: s.day, shared: audience === 'public', source: audience === 'public' ? 'public-record' : 'field-record' };
      mind.storyClues.push(entry);
      const memoryId = `story-clue-${clueId}-${id}`;
      game.perception.learn(s, id, { id: memoryId, eventId: `story-clue-${clueId}`, kind: 'clue', subjectId: null, text: `${c.title}: ${c.text}`, source: entry.source, direct: audience !== 'public' || who === id, reliability: .9 });
      mind.information.push({ id: memoryId, memoryId, storyId: clueId, text: `${c.title}: ${c.text}`, suspectId: null, weight: 0, shared: audience === 'public' });
    }
    if (audience === 'public' && !s.story.publicClues.includes(clueId)) {
      s.story.publicClues.push(clueId);
      for (const p of s.players) {
        const held = s.secrets[p.id].storyClues.find(c => c.id === clueId); if (held) held.shared = true;
        s.secrets[p.id].information.filter(i => i.storyId === clueId).forEach(i => { i.shared = true; });
      }
      record(s, `공개된 연구 기록 · ${c.title}: ${c.text}`, who, 'public', 'story-clue');
    } else if (audience !== 'public') record(s, `중요 단서 발견 · ${c.title}: ${c.text}`, who, who, 'story-clue');
    if (['protocol','manifest','accident'].every(id => s.story.publicClues.includes(id))) {
      s.story.flags.truthLinked = true;
      if (!s.story.publicClues.includes('final')) grant(s, who, 'final', record, 'public');
    }
  }
  function unlock(s, site, record) {
    if (!s.story.unlocked.includes(site)) {
      s.story.unlocked.push(site); record(s, `숨겨진 장소 개방 · ${byId(D.sites, site).name}`, null, 'public', 'unlock');
    }
  }
  function resource(s, key, amount, who, record, audience = 'public') {
    const before = s.resources[key]; s.resources[key] = Math.max(0, before + amount);
    record(s, `사건 정산 · ${game.data.resources.find(r => r.id === key).name} ${s.resources[key] - before >= 0 ? '+' : ''}${s.resources[key] - before} (현재 ${s.resources[key]})`, who, audience, 'resource');
    if (key === 'medicine' && amount > 0) s.secrets[who].missionStats.medicine += amount;
  }
  function damage(s, p, amount, record, audience = 'public') {
    const before = p.health; p.health = Math.max(0, Math.min(100, p.health + amount)); p.isAlive = p.health > 0;
    record(s, `사건 정산 · ${p.name} 체력 ${p.health - before >= 0 ? '+' : ''}${p.health - before} → ${p.health}`, p.id, audience, 'health');
  }
  function facility(s, key, amount, who, record) {
    const before = s.facilities[key]; s.facilities[key] = Math.max(0, Math.min(game.config.repairGoals[key], before + amount));
    if (key === 'radio' && amount > 0) s.secrets[who].missionStats.radio += s.facilities[key] - before;
    record(s, `사건 정산 · ${key === 'radio' ? '통신탑' : '보트'} ${s.facilities[key] - before >= 0 ? '+' : ''}${s.facilities[key] - before}`, who, 'public', 'facility');
  }
  function updateMissions(s, terminal = false) {
    if (!s.story.enabled) return;
    for (const p of s.players) {
      const m = s.secrets[p.id], mission = m.mission, target = s.players.find(o => o.id === mission.target), held = id => m.storyClues.some(c => c.id === id);
      const tests = {
        protect: terminal && active(target), document: held('protocol') || held('archive'), medicine: m.missionStats.medicine >= 3,
        conceal: terminal && m.storyClues.some(c => !c.shared), access: held('access'), trust: s.secrets[target.id].trust[p.id] >= 70,
        radio: m.missionStats.radio >= 3, risk: terminal && p.isAlive && m.visited.includes('jungle') && m.visitedSites.length > 0,
        truth: ['protocol','manifest','accident'].every(held), escapeTogether: terminal && s.outcome?.winner === 'survivors' && active(p) && active(target),
        archive: m.storyClues.length >= 4, cover: terminal && active(p) && s.players.filter(o => o.id !== p.id).every(o => s.secrets[o.id].suspicion[p.id] < 60)
      };
      mission.progress = mission.id === 'medicine' ? Math.min(3,m.missionStats.medicine) : mission.id === 'radio' ? Math.min(3,m.missionStats.radio) : mission.id === 'archive' ? Math.min(4,m.storyClues.length) : mission.id === 'truth' ? ['protocol','manifest','accident'].filter(held).length : Number(Boolean(tests[mission.id]));
      // Terminal objectives are evaluated at the ending. Completed action goals stay earned.
      mission.complete = mission.complete || Boolean(tests[mission.id]); mission.score = mission.complete ? 100 : 0;
    }
  }
  function afterAction(s, p, action, record, random, before) {
    if (!s.story.enabled) return;
    const mind = s.secrets[p.id];
    mind.missionStats.medicine += Math.max(0, s.resources.medicine - before.medicine);
    if (action.kind === 'repair' && action.facility === 'radio') mind.missionStats.radio += Math.max(0, s.facilities.radio - before.radio);
    if (action.kind === 'explore') {
      const revisited = mind.visited.includes(action.location);
      if (!revisited) mind.visited.push(action.location);
      if (!mind.storyClues.length) grant(s,p.id,'orientation',record);
      const candidates = Object.keys(s.story.placements).filter(id => s.story.placements[id] === action.location && !mind.storyClues.some(c => c.id === id));
      if (candidates.length && random() < .55) grant(s,p.id,pick(candidates,random),record);
      const site = D.sites.find(site => site.parent === action.location);
      if (site && (revisited || random() < .4)) unlock(s,site.id,record);
    }
    if (action.kind === 'research') {
      p.location = 'camp';
      const order = s.day === 1 ? ['orientation','cipher'] : s.day === 2 ? ['protocol','manifest','access'] : ['accident','manifest','protocol','archive'];
      const next = order.find(id => !mind.storyClues.some(c => c.id === id));
      if (next) grant(s,p.id,next,record); else { resource(s,'parts',1,p.id,record); record(s,'기록의 중복 부분을 정리하고 쓸 만한 부품을 회수했다.',p.id); }
    }
    if (action.kind === 'explore_hidden') {
      const site = byId(D.sites,action.siteId); p.location = site.parent;
      if (!mind.visited.includes(site.parent)) mind.visited.push(site.parent);
      if (!mind.visitedSites.includes(site.id)) mind.visitedSites.push(site.id);
      grant(s,p.id,site.clue,record); Object.entries(site.loot).forEach(([k,n]) => resource(s,k,n,p.id,record));
      if (random() < .4) damage(s,p,-site.risk,record);
      record(s,`${p.name}: ${site.name}에서 기록과 희귀 물자를 확보했다.`,p.id,'public','hidden-explore');
    }
    updateMissions(s);
  }
  function choices(s, pending) {
    const e = byId(D.events,pending.eventId);
    return e.choices.map(c => ({ id:c.id,label:c.label,disabled:Object.entries(c.cost).some(([k,n]) => s.resources[k] < n) || Boolean(c.delegate && s.players.filter(active).length < 2), cost:copy(c.cost) }));
  }
  function eligible(s,e) {
    if (!s.story.enabled || s.story.seen.includes(e.id) || !e.days.includes(s.day)) return false;
    const c=e.condition, alive=s.players.filter(active);
    if (!alive.length || c.active && alive.length<c.active || c.food && s.resources.food<c.food) return false;
    if (c.facility && s.facilities[c.facility]<=0 || c.resource && s.resources[c.resource]<=0) return false;
    if (c.ending && (!s.outcome || s.outcome.winner!=='survivors') || !c.ending && s.outcome) return false;
    if (c.anyFlags && !c.anyFlags.some(k=>s.story.flags[k]) || c.notFlags?.some(k=>s.story.flags[k])) return false;
    if (c.nearEscape && !Object.entries(game.config.repairGoals).some(([k,n])=>s.facilities[k]>=n*.7)) return false;
    if (c.sabotage && (!alive.some(p=>s.secrets[p.id].role==='saboteur') || !Object.values(s.facilities).some(n=>n>0))) return false;
    if (c.rumor && !s.statements.some(st=>s.secrets[st.speakerId].claimHistory.some(h=>h.statementId===st.id && h.mode==='lie'))) return false;
    if (c.conflict && !s.statements.some(a=>a.aboutLocation && s.statements.some(b=>a.id!==b.id && a.speakerId===b.speakerId && a.aboutDay===b.aboutDay && a.aboutPhase===b.aboutPhase && b.aboutLocation && a.aboutLocation!==b.aboutLocation))) return false;
    if (e.location!=='camp' && !s.facts.some(f=>f.day===s.day && f.phase===s.phase && f.location===e.location && alive.some(p=>p.id===f.actorId))) return false;
    return true;
  }
  function chooseEvent(view, random) {
    const opts=view.pendingEvent.choices.filter(c=>!c.disabled), m=view.self;
    if (m.health<25) return opts.find(c=>c.id==='leave')?.id || opts[0].id;
    if (m.role==='saboteur' || ['conceal','cover'].includes(m.mission?.id)) return opts.find(c=>['private','keep','decline','stop','strip'].includes(c.id))?.id || opts[0].id;
    if (m.traits.cooperation>.6) return opts.find(c=>['public','share','show','broadcast','ally','help','repair','restore'].includes(c.id))?.id || opts[0].id;
    return opts[Math.floor(random()*Math.min(2,opts.length))].id;
  }
  function open(s,e,record,random) {
    if (!eligible(s,e) || s.story.pending) throw new Error('현재 발생할 수 없는 사건입니다.');
    const people=s.players.filter(active), local=people.filter(p=>e.location==='camp' || s.facts.some(f=>f.actorId===p.id && f.day===s.day && f.phase===s.phase && f.location===e.location));
    const actor=local.find(p=>p.isHuman) || pick(local.length?local:people,random);
    const subject=pick(people.filter(p=>p.id!==actor.id),random) || actor;
    const pending={instance:`event-instance-${++s.story.serial}`,eventId:e.id,actorId:actor.id,subjectId:subject.id,day:s.day,phase:s.phase,location:e.location,visibility:e.visibility,damagedFacility:null};
    s.story.seen.push(e.id); s.story.counts[s.day]=(s.story.counts[s.day]||0)+1;
    if (e.cause) {
      const culprit=e.cause==='sabotage'?people.find(p=>s.secrets[p.id].role==='saboteur'):subject;
      pending.subjectId=culprit.id;
      if (e.cause==='theft') resource(s,'food',-2,culprit.id,record,culprit.id);
      else { pending.damagedFacility=s.facilities.radio>0?'radio':'boat'; facility(s,pending.damagedFacility,-2,null,record); }
      s.story.causes.push({eventId:e.id,actorId:culprit.id,kind:e.cause,day:s.day,phase:s.phase});
      record(s,e.cause==='theft'?'개인 생존을 위해 식량 2개를 숨겼다.':'탈출 장비를 은밀하게 손상시켰다.',culprit.id,culprit.id,'secret');
    }
    s.story.pending=pending;
    record(s,`사건 발생 · ${e.name}`,actor.id,e.visibility==='public'?'public':actor.id,'story-event');
    if (!actor.isHuman || e.terminal) {
      const view=game.state.viewFor(s,actor.id), choiceId=chooseEvent(view,random);
      resolve(s,pending.instance,choiceId,record,random);
    }
  }
  function resolve(s, instance, choiceId, record, random) {
    const pending=s.story.pending;
    if (!pending || pending.instance!==instance) throw new Error('이미 처리했거나 다른 사건입니다.');
    const e=byId(D.events,pending.eventId), c=e.choices.find(c=>c.id===choiceId), allowed=choices(s,pending).find(c=>c.id===choiceId);
    if (!c || allowed.disabled) throw new Error('자원이 부족하거나 사용할 수 없는 사건 선택입니다.');
    const leader=s.players.find(p=>p.id===pending.actorId); if (!active(leader) && !e.terminal) throw new Error('활동할 수 없는 사건 참여자입니다.');
    let actor=leader, audience=e.visibility==='public'?'public':leader.id;
    if (c.delegate) {
      const others=s.players.filter(p=>active(p)&&p.id!==leader.id);
      actor=others.sort((a,b)=>s.secrets[b.id].traits.cooperation-s.secrets[a.id].traits.cooperation)[0];
      // The delegate sees its own traits and goal, never the requesting character's secret.
      const mind=s.secrets[actor.id]; audience=mind.traits.cooperation>.55 && !['conceal','cover'].includes(mind.mission?.id)?'public':actor.id;
      record(s,`${actor.name}에게 조사를 맡겼다. 기록 공개 여부는 조사자가 결정한다.`,leader.id,e.visibility==='public'?'public':leader.id,'story-choice');
    }
    Object.entries(c.cost).forEach(([k,n])=>resource(s,k,-n,leader.id,record));
    const recipients=audience==='public'?s.players.filter(active):[actor];
    for (const effect of c.effects) {
      if (effect.type==='resource') resource(s,effect.key,effect.amount,actor.id,record);
      if (effect.type==='facility') facility(s,effect.key,effect.amount,actor.id,record);
      if (effect.type==='damagedRepair') facility(s,pending.damagedFacility,effect.amount,actor.id,record);
      if (effect.type==='health') damage(s,actor,effect.amount,record,audience);
      if (effect.type==='clue') grant(s,actor.id,effect.key,record,effect.audience==='public'||c.delegate&&audience==='public'?'public':'actor');
      if (effect.type==='unlock') unlock(s,effect.key,record);
      if (effect.type==='close') s.story.closed[effect.key]=s.day+effect.amount;
      if (effect.type==='flag') s.story.flags[effect.key==='declined'?`declined:${e.id}`:effect.key]=true;
      if (effect.type==='relation') {
        const ev={id:pending.instance,eventId:pending.instance,day:s.day,phase:s.phase};
        game.social.adjust(s.secrets[actor.id],pending.subjectId,effect.amount,effect.suspicion,e.name,ev,`story-relation:${pending.instance}`);
        game.social.adjust(s.secrets[pending.subjectId],actor.id,effect.amount,effect.suspicion,e.name,ev,`story-relation:${pending.instance}`);
      }
      if (effect.type==='trace') for (const p of recipients) learn(s,p.id,{eventId:pending.instance,kind:'trace',subjectId:pending.subjectId,location:e.location,text:`${e.name}: ${s.players.find(p=>p.id===pending.subjectId).name}과 연결된 불확실한 흔적. 정체를 증명하지는 않는다.`,source:'event-trace',direct:false,reliability:effect.amount});
      if (effect.type==='pastLocation') {
        const fact=s.facts.slice().reverse().find(f=>f.actorId===pending.subjectId && f.location===e.location);
        if (fact) learn(s,actor.id,{eventId:fact.id,day:fact.day,phase:fact.phase,kind:'location',subjectId:fact.actorId,location:fact.location,text:`현장 기록 확인: ${game.discussion.slot(fact)} ${s.players.find(p=>p.id===fact.actorId).name}, ${game.discussion.place(fact.location)}.`,source:'field-record',reliability:.95});
        else record(s,'추적할 만한 실제 동선 기록을 찾지 못했다.',actor.id,actor.id,'story-choice');
      }
      if (effect.type==='rumor') {
        const claim=s.statements.find(st=>st.mode==='claim' && (e.id==='event-19' ? s.secrets[st.speakerId].claimHistory.some(h=>h.statementId===st.id&&h.mode==='lie') : s.statements.some(other=>other.id!==st.id&&other.speakerId===st.speakerId&&other.aboutDay===st.aboutDay&&other.aboutPhase===st.aboutPhase&&other.aboutLocation&&st.aboutLocation&&other.aboutLocation!==st.aboutLocation)));
        if (claim) for (const p of recipients) learn(s,p.id,{eventId:claim.id,kind:claim.aboutLocation?'claim':'statement',day:claim.aboutDay,phase:claim.aboutPhase,location:claim.aboutLocation||null,subjectId:claim.speakerId,speakerId:claim.speakerId,text:`원래 발언 #${claim.id} 재검토: ${claim.text}`,source:'reported-statement',direct:false,reliability:effect.key==='repeat'?.35:.6});
      }
    }
    const entry={id:pending.instance,eventId:e.id,day:s.day,phase:s.phase,actorId:leader.id,delegateId:actor.id!==leader.id?actor.id:null,audience,choiceId:c.id,text:`${e.name} — ${c.label}`};
    s.story.history.push(entry);
    s.story.flags[`resolved:${e.id}`]=c.id!=='leave';
    for (const p of recipients) learn(s,p.id,{eventId:pending.instance,kind:'story',subjectId:actor.id,location:e.location,text:entry.text,source:audience==='public'?'public-event':'personal-event'});
    record(s,entry.text,leader.id,audience,'story-choice');
    s.story.pending=null; updateMissions(s);
  }
  function maybe(s, action, record, random) {
    if (!s.story.enabled || s.outcome || s.story.pending || !s.resolved || !['morning','afternoon'].includes(s.phase) || !['ACT','NEXT'].includes(action.type) || (s.story.counts[s.day]||0)>=2) return;
    if (s.story.history.some(e=>e.day===s.day&&e.phase===s.phase)) return;
    const candidates=D.events.filter(e=>!e.terminal&&eligible(s,e));
    if (!candidates.length) return;
    const weight=e=>e.weight*(D.events.some(parent=>s.story.flags[`resolved:${parent.id}`]&&parent.followUps.includes(e.id))?3:1);
    let roll=random()*candidates.reduce((n,e)=>n+weight(e),0);
    const selected=candidates.find(e=>(roll-=weight(e))<0)||candidates.at(-1); open(s,selected,record,random);
  }
  function finish(s,record,random) {
    if (!s.outcome || s.endingDetail || !s.story.enabled) return;
    s.story.pending=null;
    updateMissions(s,true);
    const living=s.players.filter(active), spy=s.players.find(p=>s.secrets[p.id].role==='saboteur'), human=s.secrets.player;
    let id='unknown',title='탈출했지만 남겨진 의문';
    if(s.outcome.code==='extinction'){id='stranded';title='섬에 남겨진 기록';}
    else if(s.outcome.code==='saboteur'){const covert=!spy.isExiled&&s.players.filter(p=>p.id!==spy.id).every(p=>s.secrets[p.id].suspicion[spy.id]<60);id=covert?'covert':'interference';title=covert?'의혹을 피한 공작원':'마지막 구조 신호의 단절';}
    else if(s.outcome.code==='exposed'){id='captured';title='공작원 추방 후 구조';}
    else if(s.story.publicClues.includes('final')){id='truth';title='진실을 밝힌 탈출';}
    else if(human.storyClues.some(c=>c.id==='archive')){id='research';title='연구 자료와 함께 탈출';}
    else if(human.storyClues.length<3){id='unknown';title='탈출했지만 남겨진 의문';}
    else if(living.length===6){id='together';title='여섯 명의 귀환';}
    else if(living.length<6){id='partial';title='남겨진 이름들';}
    s.endingDetail={id,title,spyId:spy.id,survivors:living.map(p=>p.id),clues:copy(human.storyClues),events:copy(s.story.history.filter(e=>e.audience==='public'||e.audience==='player')),missions:s.players.map(p=>({playerId:p.id,...copy(s.secrets[p.id].mission)})),unknownSecrets:D.clues.length-human.storyClues.length,runId:s.story.runId};
  }
  function view(s,id) {
    if(!s.story) return {};
    const p=s.story.pending, visible=p&&(p.visibility==='public'||p.actorId===id);
    return { storyEnabled:s.story.enabled, chapter:D.chapters[s.day], runId:s.story.runId, replaySeed:s.story.initialSeed, unlockedSites:s.story.unlocked, closedLocations:s.story.closed,
      storyHistory:s.story.history.filter(e=>e.audience==='public'||e.audience===id),publicStoryClues:s.story.publicClues,
      pendingEvent:visible?{instance:p.instance,eventId:p.eventId,name:byId(D.events,p.eventId).name,category:byId(D.events,p.eventId).category,actorId:p.actorId,private:p.visibility==='private',choices:choices(s,p)}:null,
      endingDetail:s.outcome?s.endingDetail||null:null };
  }
  function valid(s) {
    try {
      const st=s.story, ids=s.players.map(p=>p.id), text=v=>typeof v==='string', unique=a=>new Set(a).size===a.length;
      if(!st||typeof st.enabled!=='boolean'||!text(st.runId)||(st.initialSeed !== null && !Number.isInteger(st.initialSeed))||!Number.isInteger(st.serial)||st.serial<0) return false;
      if(!Array.isArray(st.seen)||st.seen.length>36||!unique(st.seen)||!st.seen.every(id=>byId(D.events,id)))return false;
      if(!Array.isArray(st.unlocked)||!unique(st.unlocked)||!st.unlocked.every(id=>byId(D.sites,id)))return false;
      if(!st.closed||!Object.entries(st.closed).every(([k,v])=>game.data.locations.some(l=>l.id===k)&&Number.isInteger(v)&&v>=1&&v<=4))return false;
      if(!st.flags||!Object.values(st.flags).every(v=>typeof v==='boolean')||!st.counts||!Object.entries(st.counts).every(([d,n])=>['1','2','3'].includes(d)&&Number.isInteger(n)&&n>=0&&n<=3))return false;
      if(!Array.isArray(st.publicClues)||!unique(st.publicClues)||!st.publicClues.every(id=>byId(D.clues,id)))return false;
      if(!st.placements||!Object.entries(st.placements).every(([id,l])=>byId(D.clues,id)&&game.data.locations.some(p=>p.id===l)))return false;
      if(!Array.isArray(st.history)||st.history.length>36||!unique(st.history.map(e=>e.id))||!st.history.every(e=>text(e.id)&&st.seen.includes(e.eventId)&&byId(D.events,e.eventId).choices.some(c=>c.id===e.choiceId)&&ids.includes(e.actorId)&&(e.delegateId===null||ids.includes(e.delegateId))&&['public',...ids].includes(e.audience)&&text(e.text)&&e.day>=1&&e.day<=3&&game.config.phases.includes(e.phase)))return false;
      if(!Array.isArray(st.causes)||!st.causes.every(c=>st.seen.includes(c.eventId)&&ids.includes(c.actorId)&&['theft','sabotage'].includes(c.kind)))return false;
      if(st.pending){const p=st.pending,e=byId(D.events,p.eventId);if(!e||!st.seen.includes(p.eventId)||!text(p.instance)||!ids.includes(p.actorId)||!ids.includes(p.subjectId)||p.day!==s.day||p.phase!==s.phase||p.location!==e.location||p.visibility!==e.visibility||st.history.some(h=>h.id===p.instance))return false;}
      for(const p of s.players){const m=s.secrets[p.id];if(!Array.isArray(m.storyClues)||!unique(m.storyClues.map(c=>c.id))||!m.storyClues.every(c=>byId(D.clues,c.id)&&typeof c.shared==='boolean'&&c.day>=1&&c.day<=3&&text(c.source)))return false;
        if(!Array.isArray(m.visited)||!unique(m.visited)||!m.visited.every(l=>game.data.locations.some(p=>p.id===l))||!Array.isArray(m.visitedSites)||!unique(m.visitedSites)||!m.visitedSites.every(id=>byId(D.sites,id)))return false;
        if(!m.missionStats||!Object.values(m.missionStats).every(n=>Number.isFinite(n)&&n>=0)||!text(m.background))return false;
        if(st.enabled&&(!m.mission||!byId(D.missions,m.mission.id)||!ids.includes(m.mission.target)||m.mission.target===p.id||typeof m.mission.complete!=='boolean'||!Number.isFinite(m.mission.progress)||m.mission.progress<0||m.mission.score!==(m.mission.complete?100:0)))return false;
      }
      if(s.endingDetail){const e=s.endingDetail;if(!s.outcome||!['unknown','stranded','covert','interference','captured','truth','research','together','partial'].includes(e.id)||!text(e.title)||!ids.includes(e.spyId)||!Array.isArray(e.survivors)||!e.survivors.every(id=>ids.includes(id))||!Array.isArray(e.clues)||!e.clues.every(c=>byId(D.clues,c.id))||!Array.isArray(e.events)||!e.events.every(h=>st.history.some(old=>old.id===h.id))||!Array.isArray(e.missions)||e.missions.length!==6||!e.missions.every(m=>ids.includes(m.playerId)&&byId(D.missions,m.id)&&typeof m.complete==='boolean')||e.unknownSecrets!==D.clues.length-s.secrets.player.storyClues.length||e.runId!==st.runId)return false;}
      return true;
    }catch{return false;}
  }
  game.story=Object.freeze({initialize,grant,unlock,afterAction,updateMissions,eligible,choices,open,resolve,maybe,finish,view,valid,chooseEvent});
})(globalThis);

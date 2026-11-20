const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {setup,storage,timestamp,act,next,quietAI}=require('./helpers.cjs');
const json=v=>JSON.stringify(v), fresh=()=>setup(undefined,true);
function record(s,text,actorId=null,audience='public',kind='event'){const entry={id:++s.sequence,day:s.day,phase:s.phase,actorId,audience,kind,text,time:s.updatedAt};s.log.push(entry);return entry;}
function prepared(g,e,seed=8){
  const s=g.state.create(timestamp,seed);s.day=e.days.at(-1);s.phase='morning';s.resources={food:20,water:20,medicine:10,parts:10};s.facilities={radio:e.condition.nearEscape?13:5,boat:5};
  s.story.flags={generator:true,doorOpened:true,truthLinked:true,'resolved:event-13':true};
  s.facts=[{id:'fixture-location',day:s.day,phase:s.phase,actorId:'player',location:e.location==='camp'?'lab':e.location,kind:'explore'}];
  s.statements=[{id:'claim-a',day:s.day,round:0,speakerId:'seo',mode:'claim',target:null,text:'야영지에 있었다.',replyTo:null,aboutDay:1,aboutPhase:'night',aboutLocation:'camp'},{id:'claim-b',day:s.day,round:1,speakerId:'seo',mode:'claim',target:null,text:'연구소에 있었다.',replyTo:null,aboutDay:1,aboutPhase:'night',aboutLocation:'lab'}];
  s.secrets.seo.claimHistory=[{statementId:'claim-a',mode:'lie',intent:'lie',reason:'시험용 허위 진술',evidenceId:null,replyTo:null}];
  if(e.terminal)s.outcome={code:'escape',winner:'survivors',day:s.day,title:'탈출',description:'시험 결과'};
  return s;
}
test('36 unique events, six categories of six, and 12 goals have complete data',()=>{
  const g=fresh(),d=g.storyData;assert.equal(d.events.length,36);assert.equal(new Set(d.events.map(e=>e.id)).size,36);
  for(const c of new Set(d.events.map(e=>e.category)))assert.equal(d.events.filter(e=>e.category===c).length,6);
  assert.equal(d.missions.length,12);assert.equal(d.sites.length,4);
  for(const e of d.events){assert.ok(e.choices.length>=2&&e.choices.length<=4);assert.ok(e.weight>0);assert.ok(e.choices.every(c=>c.effects.length));assert.ok(e.followUps.every(id=>d.events.some(x=>x.id===id)));}
});
for(let n=1;n<=36;n++)test(`event ${String(n).padStart(2,'0')} executes an actual branch and cannot repeat`,()=>{
  const g=fresh(),e=g.storyData.events[n-1],s=prepared(g,e),before=json({resources:s.resources,facilities:s.facilities,secrets:s.secrets,flags:s.story.flags,unlocked:s.story.unlocked});
  assert.ok(g.story.eligible(s,e));g.story.open(s,e,record,()=>.1);
  if(s.story.pending)g.story.resolve(s,s.story.pending.instance,e.choices[0].id,record,()=>.1);
  assert.equal(g.story.eligible(s,e),false);assert.equal(s.story.history.length,1);assert.ok(s.secrets.player.memory.length);
  assert.notEqual(json({resources:s.resources,facilities:s.facilities,secrets:s.secrets,flags:s.story.flags,unlocked:s.story.unlocked}),before);
  assert.equal(g.state.valid(s),true);assert.throws(()=>g.story.open(s,e,record,()=>.1));
});
test('events require usable facilities, live participants, proper days and actual prior claims',()=>{
  const g=fresh();for(const id of ['event-01','event-25','event-26']){const e=g.storyData.events.find(e=>e.id===id),s=prepared(g,e);s.facilities[e.condition.facility]=0;assert.equal(g.story.eligible(s,e),false);}
  for(const id of ['event-19','event-22']){const e=g.storyData.events.find(e=>e.id===id),s=prepared(g,e);s.statements=[];assert.equal(g.story.eligible(s,e),false);}
  const e=g.storyData.events[23],s=prepared(g,e);s.players.slice(1).forEach(p=>p.isExiled=true);assert.equal(g.story.eligible(s,e),false);
  const late=g.storyData.events[35],early=prepared(g,late);early.day=1;assert.equal(g.story.eligible(early,late),false);
});
test('unaffordable choices are disabled and rejected, with a cost-free exit',()=>{
  const g=fresh(),e=g.storyData.events[0],s=prepared(g,e);s.resources.parts=0;g.story.open(s,e,record,()=>.1);
  assert.equal(g.story.choices(s,s.story.pending).find(c=>c.id==='brace').disabled,true);
  const before=json(s);assert.throws(()=>g.story.resolve(s,s.story.pending.instance,'brace',record,()=>.1));assert.equal(json(s),before);
  g.story.resolve(s,s.story.pending.instance,'leave',record,()=>.1);assert.equal(s.resources.parts,0);
});
test('private versus public branches give different information; a declined chain stays closed',()=>{
  const g=fresh(),e=g.storyData.events[12],a=prepared(g,e),b=prepared(g,e);g.story.open(a,e,record,()=>.1);g.story.open(b,e,record,()=>.1);
  g.story.resolve(a,a.story.pending.instance,'private',record,()=>.1);g.story.resolve(b,b.story.pending.instance,'public',record,()=>.1);
  assert.equal(a.secrets.player.storyClues.some(c=>c.id==='protocol'),true);assert.equal(a.secrets.seo.storyClues.some(c=>c.id==='protocol'),false);assert.equal(b.secrets.seo.storyClues.some(c=>c.id==='protocol'),true);
  const declined=prepared(g,e);declined.story.flags={};g.story.open(declined,e,record,()=>.1);g.story.resolve(declined,declined.story.pending.instance,'leave',record,()=>.1);
  assert.equal(g.story.eligible(declined,g.storyData.events[30]),false);
});
test('pending events save exactly and block ordinary progression and duplicate choices',()=>{
  const backing=storage(),g=setup(backing,true),e=g.storyData.events[12],s=prepared(g,e);g.story.open(s,e,record,()=>.1);
  assert.ok(g.storage.save(s));assert.equal(json(g.storage.load().state),json(s));assert.throws(()=>next(g,s));assert.throws(()=>act(g,s,{kind:'rest'}));
  const action={type:'EVENT_CHOICE',instance:s.story.pending.instance,choiceId:'private'},result=g.state.transition(s,action,timestamp);
  assert.throws(()=>g.state.transition(result,action,timestamp));assert.equal(g.state.valid(result),true);
});
test('all four hidden sites unlock and have once-per-person loot, clues and possible injury',()=>{
  const g=fresh();quietAI(g);
  for(const site of g.storyData.sites){let s=g.state.create(timestamp,11);g.story.unlock(s,site.id,record);s.selectedLocation=site.parent;
    assert.ok(g.state.availableActions(g.state.viewFor(s)).some(a=>a.siteId===site.id));s=act(g,s,{kind:'explore_hidden',siteId:site.id});
    assert.ok(s.secrets.player.storyClues.some(c=>c.id===site.clue));assert.ok(s.secrets.player.visitedSites.includes(site.id));
    s.story.pending=null;s.phase='afternoon';s.resolved=false;s.acted=[];assert.ok(!g.state.availableActions(g.state.viewFor(s)).some(a=>a.siteId===site.id));
  }
});
test('a closed region expires and never blocks the research alternative',()=>{
  const g=fresh(),s=g.state.create(timestamp,2);s.story.closed.jungle=2;s.selectedLocation='jungle';assert.ok(!g.state.availableActions(g.state.viewFor(s)).some(a=>a.kind==='explore'));
  assert.throws(()=>act(g,s,{kind:'explore',location:'jungle'}));s.phase='afternoon';assert.ok(g.state.availableActions(g.state.viewFor(s)).some(a=>a.kind==='research'));
  s.day=2;s.phase='morning';assert.ok(g.state.availableActions(g.state.viewFor(s)).some(a=>a.kind==='explore'));
});
test('three independently shared core records unlock the truth without a rare event',()=>{
  const g=fresh(),s=g.state.create(timestamp,10);for(const [i,id]of ['protocol','manifest','accident'].entries())g.story.grant(s,s.players[i].id,id,record);
  assert.equal(s.story.publicClues.includes('final'),false);
  for(const [i,id]of ['protocol','manifest','accident'].entries())g.story.grant(s,s.players[i].id,id,record,'public');
  assert.equal(s.story.publicClues.includes('final'),true);assert.ok(s.players.every(p=>s.secrets[p.id].storyClues.some(c=>c.id==='final')));
});
test('personal goals alter AI action and remain private',()=>{
  const g=fresh(),s=g.state.create(timestamp,7);s.phase='afternoon';s.resources.parts=10;s.secrets.seo.mission.id='radio';
  const a=g.ai.decide(g.state.viewFor(s,'seo'),()=>0);assert.equal(a.kind,'repair');assert.equal(a.facility,'radio');
  s.secrets.seo.mission.id='archive';assert.equal(g.ai.decide(g.state.viewFor(s,'seo'),()=>0).kind,'research');
  const view=g.state.viewFor(s,'do');assert.ok(!('mission' in view.players.find(p=>p.id==='seo')));assert.ok(!('story' in view)&&!('placements' in view)&&!('causes' in view));
});
test('all 12 objectives evaluate actual completion without changing faction outcomes',()=>{
  const g=fresh();for(const goal of g.storyData.missions){const s=g.state.create(timestamp,4),m=s.secrets.player;m.mission.id=goal.id;m.mission.target='seo';m.missionStats={medicine:3,radio:3};m.visited=['jungle'];m.visitedSites=['observatory'];
    for(const id of ['protocol','manifest','accident','archive','access'])g.story.grant(s,'player',id,record);
    s.secrets.seo.trust.player=75;s.players.slice(1).forEach(p=>s.secrets[p.id].suspicion.player=20);s.outcome={code:'escape',winner:'survivors',day:1,title:'탈출',description:'기본 판정'};
    g.story.updateMissions(s,true);assert.equal(m.mission.complete,true,goal.id);assert.equal(m.mission.score,100);assert.equal(s.outcome.code,'escape');}
});
test('ending variants are separate from the four existing results',()=>{
  const g=fresh(),seen=new Set();for(const scenario of ['extinction','hidden','exposedSpy','capture','truth','research','together','partial','unknown']){
    const s=g.state.create(timestamp,8),spy=s.players.find(p=>s.secrets[p.id].role==='saboteur');
    const code=scenario==='extinction'?'extinction':['hidden','exposedSpy'].includes(scenario)?'saboteur':scenario==='capture'?'exposed':'escape';
    s.outcome={code,winner:code==='extinction'?'none':code==='saboteur'?'saboteur':'survivors',day:1,title:'기본 엔딩',description:'보존'};
    if(scenario==='exposedSpy')s.secrets[s.players.find(p=>p.id!==spy.id).id].suspicion[spy.id]=90;
    if(scenario==='truth')g.story.grant(s,'player','final',record,'public');if(scenario==='research')g.story.grant(s,'player','archive',record);
    if(['together','partial'].includes(scenario))for(const id of ['protocol','manifest','voice'])g.story.grant(s,'player',id,record);
    if(scenario==='partial')s.players[1].isExiled=true;
    g.story.finish(s,record,()=>.1);seen.add(s.endingDetail.id);assert.equal(s.outcome.code,code);assert.equal(s.endingDetail.spyId,spy.id);
  }assert.equal(seen.size,9);
});
test('codex records completed games once and never injects knowledge into a new game',()=>{
  const backing=storage(),g=setup(backing,true),s=g.state.create(timestamp,11);g.story.grant(s,'player','archive',record);
  assert.ok(g.codex.record(g.state.viewFor(s)));assert.equal(g.codex.load().data.clues.length,0);
  s.outcome={code:'escape',winner:'survivors',day:1,title:'탈출',description:'완료'};g.story.finish(s,record,()=>.1);
  assert.ok(g.codex.record(g.state.viewFor(s)));const saved=json(g.codex.load().data);assert.ok(g.codex.record(g.state.viewFor(s)));assert.equal(json(g.codex.load().data),saved);
  const fresh=setup(backing,true);assert.ok(fresh.codex.load().data.clues.includes('archive'));assert.ok(fresh.state.create(timestamp,12).players.every(p=>fresh.state.create(timestamp,12).secrets[p.id].storyClues.length===0));
});
test('v3 migration preserves private memory, roles, RNG and the source save',()=>{
  const old=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/phase3-save.json'),'utf8')),backing=storage(),raw=json(old);backing.setItem('island-mystery.save.v3',raw);
  const g=setup(backing,true),loaded=g.storage.load();assert.equal(loaded.status,'migrated');assert.equal(loaded.state.version,4);assert.equal(loaded.state.rng,old.rng);assert.equal(json(loaded.state.secrets.seo.memory),json(old.secrets.seo.memory));assert.equal(loaded.state.secrets.seo.role,old.secrets.seo.role);assert.ok(g.storage.save(loaded.state));assert.equal(backing.getItem('island-mystery.save.v3'),raw);
});
test('fixed seeds reproduce story assignments and different seeds vary relationships and goals',()=>{
  const g=fresh(),a=g.state.create(timestamp,123),b=g.state.create(timestamp,123),c=g.state.create(timestamp,124);
  assert.equal(json(a),json(b));assert.equal(a.story.initialSeed,123);assert.notEqual(json(a.story.placements),json(c.story.placements));assert.notEqual(json(a.secrets.seo.trust),json(c.secrets.seo.trust));
});
test('malformed story saves and unavailable codex storage fail safely',()=>{
  const g=fresh();for(const corrupt of [s=>s.story.seen.push('nonexistent'),s=>s.story.pending={},s=>s.secrets.player.mission.id='unknown',s=>s.secrets.player.storyClues=[{}],s=>s.story.closed.lab=-1]){const s=g.state.create(timestamp,1);corrupt(s);assert.equal(g.state.valid(s),false);assert.equal(g.storage.save(s),false);}
  const backing=storage();backing.setItem('island-mystery.codex.v1','broken');const other=setup(backing,true);assert.equal(other.codex.load().available,false);assert.equal(backing.getItem('island-mystery.codex.v1'),'broken');
});
test('every event alternative resolves legally and changes a meaningful branch',()=>{
  const g=fresh();for(const e of g.storyData.events){const outcomes=[];for(const c of e.choices){const s=prepared(g,e);g.story.open(s,e,record,()=>.1);assert.ok(s.story.pending);g.story.resolve(s,s.story.pending.instance,c.id,record,()=>.1);assert.ok(g.state.valid(s),e.id+':'+c.id);assert.ok(Object.values(s.resources).every(n=>n>=0));outcomes.push(json({resources:s.resources,facilities:s.facilities,health:s.players.map(p=>p.health),clues:s.players.map(p=>s.secrets[p.id].storyClues),relations:s.players.map(p=>[s.secrets[p.id].trust,s.secrets[p.id].suspicion]),flags:s.story.flags,closed:s.story.closed,unlocked:s.story.unlocked}));}assert.ok(new Set(outcomes).size>=2,e.id);}
});
test('sharing a story clue through the actual discussion action reaches listeners',()=>{
  const g=fresh();quietAI(g);let s=g.state.create(timestamp,12);s.phase='discussion';g.story.grant(s,'player','protocol',record);
  const c=s.secrets.player.information.find(c=>c.storyId==='protocol');s=act(g,s,{kind:'share',clueId:c.id});
  assert.ok(s.story.publicClues.includes('protocol'));assert.ok(s.secrets.seo.storyClues.some(c=>c.id==='protocol'));assert.equal(s.secrets.player.storyClues[0].shared,true);
});

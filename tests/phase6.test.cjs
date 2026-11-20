const {test}=require('node:test');
const assert=require('node:assert/strict');
const {setup,withRole,timestamp,act,next,quietAI,storage}=require('./helpers.cjs');
const proof=(g,s,observer,subject,id='proof',kind='betrayal',reliability=1)=>g.perception.learn(s,observer,{id,eventId:id,kind,subjectId:subject,location:'camp',text:'시험 조건: 현장에서 확인한 행동',reliability});

test('faction emergencies outrank personal missions and spies cannot finish escape',()=>{
  const g=setup(storage(),true);
  for(const difficulty of ['easy','normal','hard'])for(const role of Object.keys(g.config.roles)){
    const s=withRole(g,role,19);s.phase='afternoon';s.day=3;s.resources.parts=4;s.facilities.boat=13;
    for(const m of Object.values(s.secrets))m.difficulty=difficulty;s.difficulty=difficulty;
    const action=g.ai.decide(g.state.viewFor(s),()=>.5);
    assert.equal(action.kind,role==='saboteur'?'sabotage':'repair');assert.equal(action.facility,'boat');
  }
  const s=withRole(g,'investigator');s.phase='afternoon';s.resources.water=0;
  s.secrets.player.mission={...s.secrets.player.mission,id:'document',complete:false};
  assert.equal(g.ai.decide(g.state.viewFor(s),()=>.5).kind,'gather');
});

test('all difficulty levels abstain on distrust alone; direct hard evidence survives prior friendship',()=>{
  const g=setup();for(const difficulty of ['easy','normal','hard']){
    const s=g.state.create(timestamp,8,difficulty);s.phase='voting';s.secrets.seo.suspicion.do=100;
    assert.equal(g.social.chooseVote(g.state.viewFor(s,'seo'),()=>.5).target,null);
    s.secrets.seo.suspicion.do=0;s.secrets.seo.trust.do=100;proof(g,s,'seo','do');
    if(difficulty!=='easy')assert.equal(g.social.chooseVote(g.state.viewFor(s,'seo'),()=>.5).target,'do');
  }
});

test('publishing human evidence can change an AI vote without turning testimony into direct sight',()=>{
  const g=setup();quietAI(g);let s=withRole(g,'explorer');s.phase='discussion';
  s.secrets.seo.suspicion.do=50;s.secrets.seo.trust.player=90;
  proof(g,s,'player','do');
  assert.equal(g.social.chooseVote(g.state.viewFor(s,'seo'),()=>.5).target,null);
  s=act(g,s,{kind:'evidence',memoryId:'proof'});
  assert.equal(g.social.chooseVote(g.state.viewFor(s,'seo'),()=>.5).target,'do');
  assert.equal(s.secrets.seo.memory.find(m=>m.eventId==='proof').direct,false);
});

test('an accusation cannot disclose whether its speaker owns private proof',()=>{
  const g=setup();quietAI(g);let s=withRole(g,'explorer');s.phase='discussion';proof(g,s,'player','do');
  s=act(g,s,{kind:'accuse',target:'do'});
  const claim=s.secrets.seo.memory.find(m=>m.kind==='accusation'&&m.speakerId==='player');
  assert.equal(claim.supported,false);assert.ok(!s.secrets.seo.memory.some(m=>m.eventId==='proof'));
});

test('remembering the same source repeatedly cannot dilute or multiply its voting weight',()=>{
  const g=setup(),s=g.state.create(timestamp,4);proof(g,s,'seo','do');
  const before=g.social.voteScores(g.state.viewFor(s,'seo')).find(v=>v.id==='do').evidence;
  g.perception.learn(s,'seo',{id:'echo',eventId:'proof',kind:'betrayal',subjectId:'do',text:'전달된 같은 사건',direct:false,reliability:.2});
  assert.equal(g.social.voteScores(g.state.viewFor(s,'seo')).find(v=>v.id==='do').evidence,before);
});

test('difficulty changes observation attention and old-memory use without inventing remote witnesses',()=>{
  const g=setup(),observed=[];
  for(const difficulty of ['easy','normal','hard']){
    const s=g.state.create(timestamp,1,difficulty);s.facts=[{id:'a',day:1,phase:'morning',actorId:'seo',location:'lab',kind:'explore'},{id:'b',day:1,phase:'morning',actorId:'do',location:'lab',kind:'explore'},{id:'c',day:1,phase:'morning',actorId:'min',location:'tower',kind:'explore'}];
    g.perception.observe(s,()=>.3);observed.push(s.secrets.seo.memory.some(m=>m.subjectId==='do'));
    assert.ok(!s.secrets.seo.memory.some(m=>m.subjectId==='min'));
    proof(g,s,'seo','do');s.day=3;
    assert.equal(g.social.voteScores(g.state.viewFor(s,'seo')).find(v=>v.id==='do').evidence>0,difficulty!=='easy');
  }
  assert.deepEqual(observed,[false,true,true]);
});

test('five spy strategies are reachable from legal personal knowledge',()=>{
  const g=setup(),s=withRole(g,'saboteur');const seen=new Set();
  const add=()=>seen.add(g.social.strategy(g.state.viewFor(s)).id);
  s.phase='afternoon';add();s.phase='night';add();s.day=3;add();
  s.day=2;s.phase='discussion';s.discussionRound=1;proof(g,s,'player','ha','aid','sharing');add();
  s.discussionRound=0;s.secrets.player.actionHistory.push({id:'covert',day:1,phase:'night',round:null,location:'tower',kind:'sabotage',target:null});add();
  for(const id of ['cooperate','disrupt','betray','divide','misinform'])assert.ok(seen.has(id),id);
});

test('compact internal views preserve every decision and public views remain independent copies',()=>{
  const g=setup();let s=g.state.create(timestamp,4);s=act(g,s,{kind:'explore',location:'coast'});s=next(g,s);
  for(const p of s.players){const full=g.state.viewFor(s,p.id),compact=g.state.viewFor(s,p.id,true);assert.equal(compact.log.length,0);assert.deepEqual(g.ai.plan(full,()=>.5),g.ai.plan(compact,()=>.5));compact.resources.food=999;assert.notEqual(s.resources.food,999);}
});

test('AI can legally visit an unlocked hidden site outside the human map selection',()=>{
  const g=setup(storage(),true),s=g.state.create(timestamp,1);s.story.unlocked=['basement'];s.selectedLocation='coast';
  assert.ok(!g.state.availableActions(g.state.viewFor(s)).some(a=>a.siteId==='basement'));
  assert.ok(g.state.availableActions(g.state.viewFor(s,'seo')).some(a=>a.siteId==='basement'));
});

test('AI decisions record changed judgment privately and saves preserve all Phase 6 fields',()=>{
  const g=setup();let s=g.state.create(timestamp,4);s=act(g,s,{kind:'rest'});s=next(g,s);s=act(g,s,{kind:'gather',resource:'water'});
  assert.ok(Object.values(s.secrets).some(m=>m.decisionHistory.some(d=>d.reason.includes('변경'))));
  assert.ok(g.state.viewFor(s).players.every(p=>!('decisionHistory'in p)));
  assert.ok(g.storage.save(s));assert.equal(JSON.stringify(g.storage.load().state),JSON.stringify(s));
  const fresh=g.state.create(timestamp,5);assert.ok(Object.values(fresh.secrets).every(m=>!m.decisionHistory.length&&!m.memory.length));
});

test('balance configuration retains role costs, resource bounds and valid probability ranges',()=>{
  const g=setup(),c=g.config;
  for(const l of Object.values(c.locations)){for(const k of ['success','injury','clue'])assert.ok(l[k]>=0&&l[k]<=1);for(const [min,max]of Object.values(l.loot))assert.ok(min>=0&&max>=min);}
  for(const r of Object.values(c.mechanics.repair))assert.ok(r.cost>0&&r.amount>0);
  assert.equal(c.maxDays,3);assert.deepEqual(JSON.parse(JSON.stringify(c.initialResources)),{food:12,water:12,medicine:2,parts:2});
  for(const [id,weight]of Object.entries(c.storyBalance.eventWeights)){assert.ok(g.storyData.events.some(e=>e.id===id));assert.ok(weight>0);}
  assert.ok(Object.isFrozen(c.mechanics.repair.engineer));
});

test('a spy also refuses an event choice that would immediately complete an escape facility',()=>{
  const g=setup(),s=withRole(g,'saboteur'),v=g.state.viewFor(s);
  const e=g.storyData.events.find(e=>e.choices.some(c=>c.effects.some(f=>f.type==='facility'&&f.amount>0)));
  const positive=e.choices.find(c=>c.effects.some(f=>f.type==='facility'&&f.amount>0)),f=positive.effects.find(f=>f.type==='facility'&&f.amount>0);
  v.facilities[f.key]=g.config.repairGoals[f.key]-1;
  v.pendingEvent={eventId:e.id,choices:[{id:positive.id,disabled:false},{id:'leave',disabled:false}]};
  assert.equal(g.story.chooseEvent(v,()=>0),'leave');
});

test('losing every active member of any one survivor profession does not prevent an escape',()=>{
  const g=setup();for(const role of ['explorer','doctor','engineer','investigator']){
    let s=withRole(g,'explorer',3);s.phase='afternoon';s.facilities.boat=13;s.resources.parts=10;
    for(const p of s.players)if(s.secrets[p.id].role===role){p.health=0;p.isAlive=false;}
    s=s.players[0].isAlive?act(g,s,{kind:'repair',facility:'boat'}):next(g,s);
    assert.equal(s.outcome.code,'escape',role);
  }
});

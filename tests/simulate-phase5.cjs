const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {setup,storage,timestamp}=require('./helpers.cjs');
const backing=storage(),g=setup(backing,true);
const report={games:100,seeds:'1–100',completed:0,errors:[],stalls:0,events:Object.fromEntries(g.storyData.events.map(e=>[e.id,0])),clues:0,wins:{},endings:{},days:{},maxTransitions:0,informationViolations:0,aiDecisions:0,invalidDecisions:0,missions:{},unlockedSites:{},humanRoles:{},samples:[]};
const original=g.ai.plan;
function guard(v){const wrap=(o,keys)=>new Proxy(o,{get(t,k){if(keys.includes(k)){report.informationViolations++;throw Error('Forbidden information access: '+k);}return Reflect.get(t,k);}});return wrap({...v,players:v.players.map(p=>wrap(p,['role','mission','storyClues','background','memory','trust','suspicion']))},['secrets','facts','story','placements','causes','codex']);}
g.ai={...g.ai,plan(v,r){report.aiDecisions++;return original(guard(v),r);}};
for(let seed=1;seed<=report.games;seed++){
  let s=g.state.create(timestamp,seed),steps=0;report.humanRoles[s.secrets.player.role]=(report.humanRoles[s.secrets.player.role]||0)+1;
  try{
    while(!s.outcome&&steps<80){const v=g.state.viewFor(s),options=g.state.availableActions(v);let action={type:'NEXT'};
      for(const p of s.players){const scoped=g.state.viewFor(s,p.id);assert.ok(!('secrets'in scoped)&&!('story'in scoped)&&!('facts'in scoped));assert.equal(scoped.endingDetail,null);assert.ok(scoped.players.every(o=>!('role'in o)&&!('mission'in o)&&!('background'in o)));assert.ok(scoped.storyHistory.every(e=>e.audience==='public'||e.audience===p.id));assert.ok(scoped.log.every(e=>e.audience==='public'||e.audience===p.id));assert.equal(new Set(s.secrets[p.id].actionHistory.map(a=>`${a.day}:${a.phase}:${a.round}`)).size,s.secrets[p.id].actionHistory.length);}
      if(v.pendingEvent){const choices=v.pendingEvent.choices.filter(c=>!c.disabled);const chosen=seed%4===0?choices.find(c=>c.id==='leave')||choices[0]:seed%4===1?choices.find(c=>['private','keep','inspect'].includes(c.id))||choices[0]:choices[0];action={type:'EVENT_CHOICE',instance:v.pendingEvent.instance,choiceId:chosen.id};}
      else if(options.length){let choice;
        if(seed%4===0)choice=g.ai.decide(v,()=>.5);
        else if(seed%4===1)choice=options.find(a=>['research','explore_hidden','share'].includes(a.kind))||options.find(a=>['explore','discuss'].includes(a.kind)||a.kind==='vote'&&a.target===null)||options.find(a=>a.kind==='rest');
        else if(seed%4===2)choice=options.find(a=>['sabotage','hide','heal','repair','explore_hidden','explore','share'].includes(a.kind))||options.find(a=>a.kind==='discuss'||a.kind==='vote'&&a.target===null)||options[0];
        else choice=options.find(a=>a.kind==='rest'||a.kind==='discuss'||a.kind==='vote'&&a.target===null)||options[0];
        action={type:'ACT',...choice};
      }
      assert.ok(g.storage.save(s));const restored=g.storage.load();assert.equal(restored.status,'loaded');s=g.state.transition(restored.state,action,timestamp);steps++;assert.ok(g.state.valid(s));assert.ok(Object.values(s.resources).every(n=>n>=0));assert.equal(new Set(s.story.seen).size,s.story.seen.length);
      for(const day of [1,2,3])assert.ok(s.story.history.filter(e=>e.day===day).length<=2);
    }
    if(!s.outcome){report.stalls++;throw Error('No ending in 80 transitions');}
    assert.ok(s.endingDetail);assert.ok(g.codex.record(g.state.viewFor(s)));assert.throws(()=>g.state.transition(s,{type:'NEXT'}));
    report.completed++;report.wins[s.outcome.winner]=(report.wins[s.outcome.winner]||0)+1;report.endings[s.endingDetail.id]=(report.endings[s.endingDetail.id]||0)+1;report.days[s.day]=(report.days[s.day]||0)+1;report.maxTransitions=Math.max(report.maxTransitions,steps);report.invalidDecisions+=s.invalidDecisions;
    for(const id of s.story.seen)report.events[id]++;report.clues+=s.players.reduce((n,p)=>n+s.secrets[p.id].storyClues.length,0);
    for(const id of s.story.unlocked)report.unlockedSites[id]=(report.unlockedSites[id]||0)+1;
    for(const p of s.players){const m=s.secrets[p.id].mission;if(m.complete)report.missions[m.id]=(report.missions[m.id]||0)+1;}
    if(seed<=3)report.samples.push({seed,role:s.secrets.player.role,outcome:s.outcome,ending:s.endingDetail.id,events:s.story.history,clues:s.secrets.player.storyClues,mission:s.secrets.player.mission});
  }catch(error){report.errors.push({seed,steps,day:s.day,phase:s.phase,error:error.message});}
  if(seed%25===0)console.log(`Completed ${seed}/${report.games}; errors ${report.errors.length}`);
}
report.rareEvents=g.storyData.events.filter(e=>report.events[e.id]===0).map(e=>({id:e.id,name:e.name,verification:'tests/phase4.test.cjs conditional execution'}));
fs.writeFileSync(path.join(__dirname,'../docs/phase5-simulation-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,samples:undefined},null,2));if(report.errors.length||report.informationViolations||report.invalidDecisions)process.exitCode=1;

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),g=require('../server/engine.cjs'),P=g.progression;
const now='2026-11-20T06:00:00.000Z',report={games:350,completed:0,errors:[],wins:{survivors:0,saboteur:0,none:0},byChallenge:{},achievements:{},events:{},xpErrors:0,duplicateRewards:0,saveErrors:0,informationViolations:0,invalidDecisions:0,runs:[]};
let profile=P.empty('시뮬레이션'),original=g.ai.plan;
const forbidden=(obj,keys)=>new Proxy(obj,{get(t,k){if(keys.includes(k)){report.informationViolations++;throw Error('Hidden field '+k);}return Reflect.get(t,k);}});
g.ai={...g.ai,plan(v,r){const guarded=forbidden({...v,players:v.players.map(p=>forbidden(p,['role','mission','memory','trust','suspicion']))},['secrets','facts','progress']);return original(guarded,r);}};
const start=performance.now();
for(let i=0;i<report.games;i++){
  const mode=g.challenges.modes[i%7].id,seed=800001+i,difficulty=['easy','normal','hard'][Math.floor(i/7)%3];let s=g.state.create(now,seed,difficulty,true,null,mode),steps=0;
  try{
    while(!s.outcome&&steps++<110){
      const v=g.state.viewFor(s);assert.equal(v.progressionResult,null);let a;
      if(v.pendingEvent){const opts=v.pendingEvent.choices.filter(c=>!c.disabled);a={type:'EVENT_CHOICE',instance:v.pendingEvent.instance,choiceId:opts[i%opts.length].id};}
      else if(v.resolved||!v.self.isAlive||v.self.isExiled)a={type:'NEXT'};
      else{const options=g.state.availableActions(v);let pick=options.find(a=>a.kind==='explore'&&a.location===g.data.locations[(i+s.day)%4].id);if(v.phase==='morning'){s=g.state.transition(s,{type:'SELECT_LOCATION',location:g.data.locations[(i+s.day)%4].id},now);pick=g.state.availableActions(g.state.viewFor(s)).find(a=>a.kind==='explore');}pick ||= g.ai.plan(g.state.viewFor(s),()=>.5).action;a={type:'ACT',...pick};}
      s=g.state.transition(s,a,now);assert.ok(g.state.valid(s));const restored=JSON.parse(JSON.stringify(s));if(!g.state.valid(restored)){report.saveErrors++;throw Error('save invalid');}assert.deepEqual(restored,s);s=restored;
    }
    assert.ok(s.outcome,'no ending');const r=P.result(s,'player');assert.ok(r&&P.validResult(r));const settled=P.settle(profile,r),before=profile.xp;
    if(settled.profile.xp-before!==r.xp+settled.receipt.repeatXP){report.xpErrors++;throw Error('XP mismatch');}
    const repeat=P.settle(JSON.parse(JSON.stringify(settled.profile)),r);if(!repeat.duplicate||JSON.stringify(repeat.profile)!==JSON.stringify(settled.profile)){report.duplicateRewards++;throw Error('duplicate award');}
    assert.ok(P.valid(settled.profile));profile=settled.profile;report.completed++;report.wins[s.outcome.winner]++;report.invalidDecisions+=s.invalidDecisions;
    const row=report.byChallenge[mode]||={games:0,wins:{survivors:0,saboteur:0,none:0},days:0,xp:0};row.games++;row.wins[s.outcome.winner]++;row.days+=s.day;row.xp+=settled.receipt.xp;
    for(const id of settled.receipt.achievements)report.achievements[id]=(report.achievements[id]||0)+1;
    for(const id of s.story.seen)report.events[id]=(report.events[id]||0)+1;
    report.runs.push({seed,challenge:mode,difficulty,role:r.role,day:s.day,winner:s.outcome.winner,outcome:s.outcome.code,xp:settled.receipt.xp,achievements:settled.receipt.achievements,events:s.story.seen});
  }catch(e){report.errors.push({seed,challenge:mode,steps,day:s.day,phase:s.phase,error:e.stack});}
  if((i+1)%25===0)console.log(`${i+1}/${report.games}; errors=${report.errors.length}`);
}
report.elapsedSeconds=(performance.now()-start)/1000;report.finalXP=profile.xp;report.finalLevel=P.level(profile.xp).level;report.profileBytes=Buffer.byteLength(JSON.stringify(profile));report.newEvents=Object.fromEntries(g.storyData.events.slice(36).map(e=>[e.id,report.events[e.id]||0]));
fs.writeFileSync(path.join(__dirname,'../docs/phase8-simulation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,runs:undefined},null,2));if(report.errors.length||report.xpErrors||report.duplicateRewards||report.saveErrors||report.informationViolations||report.invalidDecisions)process.exitCode=1;

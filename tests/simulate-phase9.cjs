// Deterministic logic QA. Automated choices are policies, not human playtest data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os'),g=require('../server/engine.cjs');
const label=process.argv[2]||'final',limit=Number(process.argv[3]||1000),now='2026-11-20T06:00:00.000Z',P=g.progression;
if(!/^[a-z-]+$/.test(label)||!Number.isInteger(limit)||limit<1||limit>1000)throw Error('Invalid simulation parameters');
const report={label,policyVersion:1,environment:{node:process.version,platform:process.platform,cpu:os.cpus()[0].model},games:limit,completed:0,errors:[],stageErrors:0,aiErrors:0,outcomeErrors:0,saveErrors:0,duplicateResources:0,duplicateVotes:0,informationViolations:0,unsubstantiatedVotes:0,events:{},runs:[],timings:[],peakHeap:0};
const original=g.ai.plan,guard=(obj,keys)=>new Proxy(obj,{get(t,k){if(keys.includes(k)){report.informationViolations++;throw Error('Hidden access '+k);}return Reflect.get(t,k);}});
g.ai={...g.ai,plan(v,r){const scoped=guard({...v,players:v.players.map(p=>guard(p,['role','mission','memory','trust','suspicion','storyClues']))},['secrets','facts','progress','story','rng']);const result=original(scoped,r);if(v.phase==='voting'&&result.action.target&&!g.social.voteScores(v).find(x=>x.id===result.action.target)?.supported)report.unsubstantiatedVotes++;return result;}};
function command(s,i){const v=g.state.viewFor(s);if(v.pendingEvent){const choices=v.pendingEvent.choices.filter(x=>!x.disabled);return {type:'EVENT_CHOICE',instance:v.pendingEvent.instance,choiceId:choices[i%choices.length].id};}if(v.resolved||!v.self.isAlive||v.self.isExiled)return {type:'NEXT'};
 const options=g.state.availableActions(v),find=(kind,p=()=>true)=>options.find(a=>a.kind===kind&&p(a));let a;
 if(v.self.role==='saboteur'&&i%2===0){if(v.phase==='discussion')a=find('lie',a=>v.self.actionHistory.some(h=>h.id===a.historyId&&['hide','sabotage'].includes(h.kind)))||find('redirect');else if(v.phase==='voting')a=find('vote',a=>a.target===null);else a=find('sabotage',a=>a.facility===Object.keys(v.facilities).sort((a,b)=>v.facilities[b]-v.facilities[a])[0])||find('hide',a=>a.resource==='water');}
 if(v.self.role!=='saboteur'){if(i%4===1)a=find('repair');if(i%4===2)a=find('rebut')||find('share')||find('evidence')||find('research');if(i%4===3)a=find('heal',a=>v.players.find(p=>p.id===a.target).health<50)||find('gather',a=>a.resource==='water');}
 a ||= g.ai.plan(v,()=>.5).action;return {type:'ACT',...a};
}
const start=performance.now();
for(let i=0;i<limit;i++){
 const difficulty=i<200?'easy':i<600?'normal':i<800?'hard':['easy','normal','hard'][i%3],mode=i<800?'classic':g.challenges.modes[1+(i-800)%6].id,seed=900001+i;let s=g.state.create(now,seed,difficulty,true,null,mode),steps=0;
 try{
  while(!s.outcome&&steps++<120){const a=command(s,i),before=JSON.stringify(s),t=performance.now();s=g.state.transition(s,a,now);report.timings.push(performance.now()-t);
   if(!g.state.valid(s)){report.stageErrors++;throw Error('Invalid transition');}const raw=JSON.stringify(s),restored=JSON.parse(raw);if(!g.state.valid(restored)||JSON.stringify(restored)!==raw){report.saveErrors++;throw Error('Invalid save');}
   assert.equal(new Set(s.settledDays).size,s.settledDays.length,'daily accounting duplicated');
   // Replay the identical completed action: rejection or unchanged state, never second resources/vote.
   if(a.type==='ACT'){let duplicate;try{duplicate=g.state.transition(s,a,now);}catch{}if(duplicate&&JSON.stringify(duplicate)!==raw){if(a.kind==='vote')report.duplicateVotes++;else report.duplicateResources++;throw Error('Duplicate accepted');}}
   if(raw===before){report.stageErrors++;throw Error('No progress');}s=restored;
  }
  if(!s.outcome){report.stageErrors++;throw Error('No ending');}assert.ok(s.day<=3&&s.endingDetail);assert.ok(Object.values(s.resources).every(n=>Number.isInteger(n)&&n>=0));
  if(s.outcome.code==='escape'&&!Object.entries(g.config.repairGoals).some(([k,n])=>s.facilities[k]>=n)){report.outcomeErrors++;throw Error('Escape without facility');}
  const spy=s.players.find(p=>s.secrets[p.id].role==='saboteur');if(s.outcome.code==='exposed'&&!spy.isExiled){report.outcomeErrors++;throw Error('Exposure without exile');}
  assert.throws(()=>g.state.transition(s,{type:'NEXT'},now));const r=P.result(s,'player'),settled=P.settle(P.empty(),r);assert.ok(P.valid(settled.profile));assert.ok(P.settle(settled.profile,r).duplicate);
  report.completed++;report.aiErrors+=s.invalidDecisions;for(const id of s.story.seen)report.events[id]=(report.events[id]||0)+1;
  const roles={};for(const p of s.players){const m=s.secrets[p.id],row=roles[m.role]||={actors:0,repairs:0,heals:0,investigations:0,evidence:0,sabotage:0};row.actors++;for(const a of m.actionHistory){if(a.kind==='repair')row.repairs++;if(a.kind==='heal')row.heals++;if(a.kind==='investigate')row.investigations++;if(['share','evidence','rebut'].includes(a.kind))row.evidence++;if(['sabotage','hide'].includes(a.kind))row.sabotage++;}}
  report.runs.push({seed,difficulty,mode,policy:i%4,role:r.role,humanSpy:r.role==='saboteur',day:s.day,winner:s.outcome.winner,outcome:s.outcome.code,ending:s.endingDetail.id,spyExiled:spy.isExiled,shortage:s.progress.shortage,events:s.story.seen,roles,steps,saveBytes:Buffer.byteLength(JSON.stringify(s))});
 }catch(e){report.errors.push({seed,difficulty,mode,steps,day:s.day,phase:s.phase,error:e.stack});fs.writeFileSync(path.join(__dirname,`../docs/phase9-${label}-failed-${seed}.json`),JSON.stringify(s));}
 report.peakHeap=Math.max(report.peakHeap,process.memoryUsage().heapUsed);if((i+1)%25===0)console.log(`${label} ${i+1}/${limit}; completed=${report.completed}; errors=${report.errors.length}`);
}
function summarize(rows){return {games:rows.length,wins:Object.fromEntries(['survivors','saboteur','none'].map(k=>[k,rows.filter(r=>r.winner===k).length])),averageDay:rows.reduce((n,r)=>n+r.day,0)/(rows.length||1),spyExiled:rows.filter(r=>r.spyExiled).length,shortages:rows.filter(r=>r.shortage).length,humanSpy:rows.filter(r=>r.humanSpy).length};}
report.summary=summarize(report.runs);report.byDifficulty=Object.fromEntries(['easy','normal','hard'].map(k=>[k,summarize(report.runs.filter(r=>r.difficulty===k&&r.mode==='classic'))]));report.byMode=Object.fromEntries(g.challenges.modes.map(m=>[m.id,summarize(report.runs.filter(r=>r.mode===m.id))]));report.elapsedSeconds=(performance.now()-start)/1000;report.timings.sort((a,b)=>a-b);report.transitionMs={count:report.timings.length,mean:report.timings.reduce((a,b)=>a+b,0)/report.timings.length,p95:report.timings[Math.floor(report.timings.length*.95)],max:report.timings.at(-1)};delete report.timings;
fs.writeFileSync(path.join(__dirname,`../docs/phase9-${label}-simulation.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({completed:report.completed,errors:report.errors.length,summary:report.summary,seconds:report.elapsedSeconds}));if(report.errors.length||report.aiErrors||report.informationViolations||report.unsubstantiatedVotes)process.exitCode=1;

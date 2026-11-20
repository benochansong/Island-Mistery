// Reproducible policy trials, not estimates of real human win rates.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..'),label=process.argv[2]||'after',limit=Number(process.argv[3]||300),now='2026-11-20T06:00:00.000Z';
const backing={};globalThis.localStorage={getItem:k=>backing[k]??null,setItem:(k,v)=>{backing[k]=v;}};
for(const f of ['data','config','social','dialogue','discussion','perception','schema','story-data','story','missions','codex','ai','state','storage'])require(path.join(base,'js',f+'.js'));
const g=globalThis.IslandMystery,inc=(o,k,n=1)=>o[k]=(o[k]||0)+n;
const casesFile=path.join(base,'tests/fixtures/phase6-cases.json');let cases;
if(fs.existsSync(casesFile))cases=JSON.parse(fs.readFileSync(casesFile));else{
  cases=[];for(const [group,start]of [['survivor',1],['saboteur',100001],['random',200001]]){let seed=start,n=0;while(n<100){const difficulty=['easy','normal','hard'][cases.length%3],s=g.state.create(now,seed,difficulty),role=s.secrets.player.role;if(group==='random'||(group==='saboteur')===(role==='saboteur')){cases.push({group,seed,difficulty,role,policy:['cooperate','evidence','survival','escape'][n%4]});n++;}seed++;}}
  fs.writeFileSync(casesFile,JSON.stringify(cases,null,2)+'\n');
}
const report={label,policyVersion:1,games:Math.min(limit,cases.length),completed:0,errors:[],stalls:0,informationViolations:0,invalidDecisions:0,aiDecisions:0,events:Object.fromEntries(g.storyData.events.map(e=>[e.id,0])),roles:{},strategies:{},runs:[],timings:{},maxSaveBytes:0,lieStatements:0,detectedLies:0,falseContradictions:0,unsubstantiatedAIVotes:0,totalAIVotes:0};
const originalPlan=g.ai.plan;
if(label==='strategies'){
  cases=cases.filter(c=>c.group==='saboteur').slice(0,10).flatMap(c=>['easy','normal','hard'].flatMap(difficulty=>['aggressive','cooperate','misinform','divide','late'].map(mode=>({...c,difficulty,policy:'spy-'+mode}))));
  report.games=Math.min(limit,cases.length);
}
function guarded(v){const proxy=(o,keys)=>new Proxy(o,{get(t,k){if(keys.includes(k)){report.informationViolations++;throw Error('Forbidden access '+k);}return Reflect.get(t,k);}});return proxy({...v,players:v.players.map(p=>proxy(p,['role','mission','memory','trust','suspicion','background','storyClues']))},['secrets','facts','story','causes','placements','codex']);}
g.ai={...g.ai,plan(v,r){report.aiDecisions++;const plan=originalPlan(guarded(v),r);if(v.phase==='voting'&&plan.action.target){report.totalAIVotes++;if(!g.social.voteScores(v).find(s=>s.id===plan.action.target)?.supported)report.unsubstantiatedAIVotes++;}return plan;}};
function human(v,c){
  const options=g.state.availableActions(v),find=(kind,p=()=>true)=>options.find(a=>a.kind===kind&&p(a));
  if(v.pendingEvent){const allowed=v.pendingEvent.choices.filter(c=>!c.disabled);return {type:'EVENT_CHOICE',instance:v.pendingEvent.instance,choiceId:(c.policy==='survival'?allowed.find(c=>c.id==='leave'):v.self.role==='saboteur'?allowed.find(c=>['private','keep','strip','stop','decline'].includes(c.id)):allowed.find(c=>['public','share','show','broadcast','repair','restore'].includes(c.id)))?.id||allowed[0].id};}
  if(!options.length)return {type:'NEXT'};
  let action;
  if(c.policy.startsWith('spy-')){
    const mode=c.policy.slice(4),facility=Object.keys(v.facilities).sort((a,b)=>v.facilities[b]/g.config.repairGoals[b]-v.facilities[a]/g.config.repairGoals[a])[0];
    const covert=find('sabotage',a=>a.facility===facility)||find('hide',a=>a.resource==='water');
    if(v.phase==='discussion'){
      const already=v.self.claimHistory.some(c=>c.mode==='lie'&&v.statements.some(s=>s.id===c.statementId&&s.day===v.day));
      const lie=find('lie',a=>v.self.actionHistory.some(h=>h.id===a.historyId&&h.day===v.day&&['sabotage','hide'].includes(h.kind)));
      action=mode==='divide'?find('redirect',a=>a.target===g.social.voteScores(v)[0]?.id):mode==='misinform'&&!already?lie:null;
      action ||= find('feign')||find('conceal');
    }else if(v.phase==='voting')action=find('vote',a=>a.target===null);
    else if(mode!=='cooperate'&&(mode!=='late'||v.day>=2&&v.facilities[facility]/g.config.repairGoals[facility]>=.4))action=covert;
    action ||= find('gather',a=>a.resource==='water')||find('explore')||find('heal')||find('rest');
    return {type:'ACT',...action};
  }
  if(v.self.role==='saboteur'){
    if(v.phase==='discussion')action=find('lie',a=>v.self.actionHistory.some(h=>h.id===a.historyId&&['sabotage','hide'].includes(h.kind)))||find('redirect')||find('conceal');
    else if(v.phase==='voting')action=find('vote',a=>a.target===null);
    else{const target=Object.keys(v.facilities).sort((a,b)=>v.facilities[b]/g.config.repairGoals[b]-v.facilities[a]/g.config.repairGoals[a])[0];action=find('sabotage',a=>a.facility===target)||find('hide',a=>a.resource==='water')||find('explore')||find('rest');}
  }else if(v.phase==='discussion')action=c.policy==='evidence'?(find('rebut')||find('share')||find('evidence')):null;
  else if(c.policy==='escape')action=find('repair')||find('explore');
  else if(c.policy==='survival')action=find('heal',a=>v.players.find(p=>p.id===a.target)?.health<50)||find('gather',a=>a.resource==='water')||find('rest');
  else if(c.policy==='evidence')action=find('investigate')||find('research')||find('explore_hidden')||find('explore');
  if(!action){const plan=originalPlan(guarded(v),()=>.5);action=plan.action;}
  return {type:'ACT',...action};
}
const started=performance.now();
for(const c of cases.slice(0,limit)){
  let s=g.state.create(now,c.seed,c.difficulty),steps=0;const seenLog=new Set(),rows={};
  try{
    assert.equal(s.secrets.player.role,c.role);
    while(!s.outcome&&steps<90){
      const v=g.state.viewFor(s),action=human(v,c),phase=s.phase;
      assert.ok(!('story'in v)&&!('facts'in v)&&v.players.every(p=>!('role'in p)));assert.ok(v.log.every(e=>e.audience==='public'||e.audience==='player'));
      const t=performance.now();s=g.state.transition(s,action,now);const dt=performance.now()-t;(report.timings[phase]||=([])).push(dt);steps++;
      assert.ok(g.state.valid(s));assert.ok(g.storage.save(s));const load=g.storage.load();assert.equal(load.status,'loaded');assert.deepEqual(load.state,s);s=load.state;
      report.maxSaveBytes=Math.max(report.maxSaveBytes,Buffer.byteLength(JSON.stringify(s)));
      for(const p of s.players){const m=s.secrets[p.id];assert.equal(new Set(m.actionHistory.map(a=>`${a.day}:${a.phase}:${a.round}`)).size,m.actionHistory.length);}
      assert.ok(Object.values(s.resources).every(n=>n>=0));assert.equal(new Set(s.story.seen).size,s.story.seen.length);for(const day of [1,2,3])assert.ok((s.story.counts[day]||0)<=2);
      for(const e of s.log.filter(e=>!seenLog.has(e.id))){seenLog.add(e.id);if(!e.actorId)continue;const role=s.secrets[e.actorId].role,r=rows[role]||=( {resourceGain:0,repairPoints:0} );const amount=e.text.match(/([+-]\d+)/);if(e.kind==='resource'&&amount&&Number(amount[1])>0)r.resourceGain+=Number(amount[1]);if(/수리도 \+/.test(e.text)&&amount)r.repairPoints+=Number(amount[1]);}
    }
    if(!s.outcome){report.stalls++;throw Error('No ending in 90 transitions');}
    const spy=s.players.find(p=>s.secrets[p.id].role==='saboteur');assert.ok(s.endingDetail);assert.throws(()=>g.state.transition(s,{type:'NEXT'}));assert.ok(g.codex.record(g.state.viewFor(s)));
    report.completed++;report.invalidDecisions+=s.invalidDecisions;for(const id of s.story.seen)report.events[id]++;
    const strategies={};let runDetectedLies=0,runLies=0;
    for(const p of s.players){const m=s.secrets[p.id],r=report.roles[m.role]||={actors:0,actions:{},resourceGain:0,repairPoints:0,storyClues:0,investigations:0,heals:0,exiles:0};r.actors++;r.storyClues+=m.storyClues.length;r.exiles+=Number(p.isExiled);for(const a of m.actionHistory){inc(r.actions,a.kind);if(a.kind==='heal')r.heals++;if(a.kind==='investigate')r.investigations++;}for(const d of m.decisionHistory)if(d.strategy)inc(strategies,d.strategy);
      for(const claim of m.claimHistory.filter(c=>c.mode==='lie')){report.lieStatements++;runLies++;if(s.players.some(other=>other.id!==p.id&&s.secrets[other.id].memory.some(mem=>mem.statementId===claim.statementId&&mem.judgment==='직접 증거와 모순'))){report.detectedLies++;runDetectedLies++;}}
      for(const mem of m.memory.filter(m=>m.judgment==='직접 증거와 모순')){const origin=s.secrets[mem.speakerId]?.claimHistory.find(c=>c.statementId===mem.statementId);if(origin&&origin.mode!=='lie')report.falseContradictions++;}
    }
    for(const [role,r]of Object.entries(rows)){report.roles[role].resourceGain+=r.resourceGain;report.roles[role].repairPoints+=r.repairPoints;}
    for(const [id,uses]of Object.entries(strategies)){const r=report.strategies[id]||={games:0,uses:0,saboteurWins:0};r.games++;r.uses+=uses;r.saboteurWins+=Number(s.outcome.winner==='saboteur');}
    report.runs.push({...c,detectedLies:runDetectedLies,steps,day:s.day,winner:s.outcome.winner,outcome:s.outcome.code,ending:s.endingDetail.id,spyExiled:spy.isExiled,resources:s.resources,exiles:s.players.filter(p=>p.isExiled).map(p=>({id:p.id,role:s.secrets[p.id].role})),strategies,lieStatements:s.players.reduce((n,p)=>n+s.secrets[p.id].claimHistory.filter(c=>c.mode==='lie').length,0)});
  }catch(e){report.errors.push({...c,steps,day:s.day,phase:s.phase,error:e.stack});}
  if((report.completed+report.errors.length)%25===0)console.log(`${label}: ${report.completed+report.errors.length}/${report.games}, errors ${report.errors.length}`);
}
report.elapsedSeconds=(performance.now()-started)/1000;
function summarize(runs){const wins={survivors:0,saboteur:0,none:0},resources={food:0,water:0,medicine:0,parts:0};runs.forEach(r=>{wins[r.winner]++;for(const k in resources)resources[k]+=r.resources[k];});return {games:runs.length,wins,averageDay:runs.reduce((n,r)=>n+r.day,0)/(runs.length||1),spyExileRate:runs.filter(r=>r.spyExiled).length/(runs.length||1),resources:Object.fromEntries(Object.entries(resources).map(([k,v])=>[k,v/(runs.length||1)]))};}
report.summary=summarize(report.runs);report.byGroup=Object.fromEntries(['survivor','saboteur','random'].map(k=>[k,summarize(report.runs.filter(r=>r.group===k))]));report.byDifficulty=Object.fromEntries(['easy','normal','hard'].map(k=>[k,summarize(report.runs.filter(r=>r.difficulty===k))]));
report.byPolicy=Object.fromEntries([...new Set(report.runs.map(r=>r.policy))].map(k=>[k,summarize(report.runs.filter(r=>r.policy===k))]));
report.timings=Object.fromEntries(Object.entries(report.timings).map(([k,v])=>{v.sort((a,b)=>a-b);return [k,{count:v.length,meanMs:v.reduce((a,b)=>a+b,0)/v.length,p95Ms:v[Math.floor(v.length*.95)],maxMs:v.at(-1)}];}));
fs.writeFileSync(path.join(base,`docs/phase6-${label}.json`),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(base,`docs/phase6-${label}.csv`),'group,seed,difficulty,role,policy,day,winner,spyExiled,food,water,medicine,parts\n'+report.runs.map(r=>[r.group,r.seed,r.difficulty,r.role,r.policy,r.day,r.winner,r.spyExiled,...Object.values(r.resources)].join(',')).join('\n')+'\n');
console.log(JSON.stringify({completed:report.completed,errors:report.errors.length,summary:report.summary,difficulty:report.byDifficulty,elapsedSeconds:report.elapsedSeconds},null,2));if(report.errors.length||report.informationViolations||report.invalidDecisions)process.exitCode=1;

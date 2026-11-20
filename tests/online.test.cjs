const {test}=require('node:test'),assert=require('node:assert/strict'),{io}=require('socket.io-client'),crypto=require('node:crypto');
const {createServer}=require('../server/index.cjs'),game=require('../server/engine.cjs'),{config}=require('../server/config.cjs');
const options={name:'시험 방',nickname:'Host',private:true,allowAI:true,maxHumans:6,discussionSeconds:30,difficulty:'normal'};
const wait=async(fn,ms=5000)=>{const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('Timed out');await new Promise(r=>setTimeout(r,10));}};
const emit=(s,e,d={})=>new Promise((resolve,reject)=>s.timeout(4000).emit(e,d,(err,result)=>err?reject(err):resolve(result)));
const clean=a=>Object.fromEntries(Object.entries(a).filter(([k])=>['kind','target','location','facility','resource','clueId','historyId','memoryId','statementId','siteId'].includes(k)));
async function fixture(t,count=2,overrides={}){
  const app=createServer({port:0,actionMs:10000,eventMs:10000,resultMs:20,...overrides});const addr=await app.listen(),url='http://127.0.0.1:'+addr.port,clients=[],auth=[];
  t.after(async()=>{clients.forEach(s=>s.disconnect());await app.close();});
  async function client(){const s=io(url,{transports:['websocket'],forceNew:true,reconnection:false});s.on('snapshot',v=>s.latest=v);clients.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;}
  for(let i=0;i<count;i++)await client();
  const made=await emit(clients[0],'room:create',options);assert.ok(made.ok);auth.push(made);
  for(let i=1;i<count;i++){const joined=await emit(clients[i],'room:join',{code:made.code,nickname:'Guest'+i});assert.ok(joined.ok);auth.push(joined);}
  const room=app.rooms.rooms.get(made.code);
  return {app,url,clients,auth,room,client,start:async()=>{for(const s of clients.slice(0,count))assert.ok((await emit(s,'room:ready',{ready:true})).ok);assert.ok((await emit(clients[0],'room:start')).ok);await wait(()=>clients.slice(0,count).every(s=>s.latest?.view));}};
}
async function action(s,a,requestId=crypto.randomUUID(),turnId=s.latest.turnId){return emit(s,'game:action',{requestId,turnId,action:clean(a)});}
async function finish(f){let steps=0;while(!f.room.state.outcome&&steps++<160){await wait(()=>f.clients.filter(c=>c.connected&&c.latest?.view).every(c=>c.latest.turnId===f.room.turnId));const turn=f.room.turnId;if(f.room.state.resolved&&!f.room.state.story.pending){await wait(()=>f.room.turnId!==turn||f.room.state.outcome);continue;}for(const s of f.clients){const v=s.latest;if(!s.connected||!v?.view||v.turnId!==turn)continue;if(v.view.pendingEvent){const result=await emit(s,'game:action',{requestId:crypto.randomUUID(),turnId:turn,action:{kind:'event',choiceId:'leave'}});assert.ok(result.ok,result.error);continue;}if(v.view.resolved||v.submitted.includes(v.seat)||!v.view.self.isAlive||v.view.self.isExiled)continue;const opts=v.actions;const a=opts.find(a=>a.kind==='repair')||opts.find(a=>a.kind==='explore')||opts.find(a=>a.kind==='vote'&&a.target===null)||opts.find(a=>a.kind==='discuss')||opts.find(a=>a.kind==='rest');if(a){const r=await action(s,a,crypto.randomUUID(),turn);assert.ok(r.ok,r.error);}}if(f.room.turnId===turn)await wait(()=>f.room.turnId!==turn||f.room.state.outcome);}
  assert.ok(f.room.state.outcome);assert.ok(game.state.valid(f.room.state));return steps;
}
test('M1: private rooms, host authorization, ready gate, capacity and host transfer',async t=>{
  const f=await fixture(t,2),[a,b]=f.clients;
  assert.equal((await emit(b,'rooms:list')).rooms.length,0);
  assert.equal((await emit(b,'room:start')).ok,false);assert.equal((await emit(a,'room:start')).ok,false);
  await emit(a,'room:leave');await wait(()=>b.latest.room.participants.length===1);assert.equal(b.latest.room.host,b.latest.selfId);
  assert.equal((await emit(b,'room:start')).ok,false);
});
for(let count=2;count<=6;count++)test(`M2/F: ${count} human socket clients + ${6-count} AI complete a real game`,async t=>{
  const f=await fixture(t,count);await f.start();assert.equal(f.room.state.players.filter(p=>p.isHuman).length,count);assert.equal(f.room.state.players.filter(p=>f.room.state.secrets[p.id].role==='saboteur').length,1);
  assert.equal((await emit(f.clients[0],'room:start')).ok,false);const extra=await f.client();assert.equal((await emit(extra,'room:join',{code:f.room.code,nickname:'late'})).ok,false);extra.disconnect();
  await finish(f);await wait(()=>f.clients.slice(0,count).every(s=>s.latest.view.outcome));
  const result=JSON.stringify(f.clients[0].latest.view.outcome);for(const s of f.clients.slice(0,count))assert.equal(JSON.stringify(s.latest.view.outcome),result);
});
test('M2 security: scoped packets exclude seed, roles, AI memories and private clues',async t=>{
  const f=await fixture(t,6);await f.start();const s=f.room.state;
  assert.equal(s.players[0].name,'첫 생존자');assert.equal(f.clients[1].latest.view.players[0].name,'첫 생존자');
  game.perception.learn(s,'player',{id:'only-owner',eventId:'only-owner',kind:'clue',text:'OWNER_ONLY_SENTINEL'});f.app.rooms.publish(f.room);await wait(()=>f.clients[0].latest.view.self.memory.length>0);
  for(const [i,c]of f.clients.entries()){const v=c.latest.view;for(const key of ['secrets','facts','rng','initialSeed','replaySeed','online'])assert.equal(key in v,false,key);assert.equal(v.runId.includes(String(s.initialSeed)),false);assert.ok(v.players.every(p=>!('role'in p)&&!('memory'in p)&&!('mission'in p)));if(i)assert.ok(!JSON.stringify(c.latest).includes('OWNER_ONLY_SENTINEL'));assert.ok(!JSON.stringify(c.latest).includes('tokenHash'));}
  assert.equal((await action(f.clients[0],{kind:'gather',resource:'food'})).ok,false);
  assert.equal((await emit(f.clients[0],'game:action',{requestId:crypto.randomUUID(),turnId:f.room.turnId,action:{kind:'rest',resources:{food:9999}}})).ok,false);
  assert.ok(!game.storage); // server does not load browser localStorage adapters
});
test('M2 idempotency: duplicate request does not grant resources, old turns and impersonation fail',async t=>{
  const f=await fixture(t,2);await f.start();const a=f.clients[0],id=crypto.randomUUID(),turn=f.room.turnId,command={kind:'explore',location:'coast'},before=JSON.stringify(f.room.state.resources);
  assert.ok((await action(a,command,id,turn)).ok);assert.ok((await action(a,command,id,turn)).ok);assert.equal(JSON.stringify(f.room.state.resources),before);assert.equal((await action(a,command)).ok,false);
  assert.equal((await emit(a,'game:action',{requestId:crypto.randomUUID(),turnId:turn,action:{kind:'rest',actorId:f.room.members[1].seat}})).ok,false);
  assert.ok((await action(f.clients[1],{kind:'rest'})).ok);assert.equal(f.room.state.secrets.player.actionHistory.filter(a=>a.phase==='morning').length,1);
  assert.equal((await action(a,{kind:'rest'},crypto.randomUUID(),turn)).ok,false);
});
test('M3 secret voting, exact single tally, spectator rejection and synchronized result',async t=>{
  const f=await fixture(t,6,{resultMs:1000});await f.start();const s=f.room.state;s.phase='voting';s.discussionRound=4;f.app.rooms.openTurn(f.room);await wait(()=>f.clients.every(c=>c.latest.view.phase==='voting'));
  for(let i=0;i<5;i++){const c=f.clients[i],target=i===0?'seo':'player';assert.ok((await action(c,{kind:'vote',target})).ok);assert.equal(Object.keys(f.clients[5].latest.view.votes).length,0);assert.equal(f.room.state.secrets[c.latest.seat].actionHistory.length,0);}
  assert.ok((await action(f.clients[5],{kind:'vote',target:'player'})).ok);await wait(()=>f.clients.every(c=>c.latest.view.resolved));
  assert.equal(f.room.state.players[0].isExiled,true);assert.equal(Object.keys(f.room.state.votes).length,6);assert.equal((await action(f.clients[0],{kind:'rest'})).ok,false);assert.equal((await emit(f.clients[0],'chat:send',{text:'spectator'})).ok,false);
  for(const c of f.clients){assert.equal(Object.keys(c.latest.view.votes).length,6);assert.ok(!c.latest.view.players.some(p=>'role'in p));}
});
test('M3 chat: order, literal HTML, limits, block/report hooks and no semantic AI claims',async t=>{
  const f=await fixture(t,2);const [a,b]=f.clients;for(let n=0;n<5;n++)assert.ok((await emit(a,'chat:send',{text:n===0?'<img src=x onerror=alert(1)>':'line '+n})).ok);
  assert.equal((await emit(a,'chat:send',{text:'too fast'})).ok,false);assert.equal((await emit(b,'chat:send',{text:'x'.repeat(401)})).ok,false);
  await wait(()=>b.latest.chat.filter(x=>x.type==='chat').length===5);const messages=b.latest.chat.filter(x=>x.type==='chat');assert.match(messages[0].text,/<img/);assert.ok(messages.every((m,i)=>!i||m.id>messages[i-1].id));
  assert.ok((await emit(b,'chat:moderate',{action:'report',messageId:messages[0].id})).ok);assert.equal(f.room.reports.length,1);assert.ok((await emit(b,'chat:moderate',{action:'block',messageId:messages[0].id})).ok);await wait(()=>!b.latest.chat.some(m=>m.type==='chat'));
});
test('M4 reconnect tokens preserve roles and queued actions; nickname cannot steal a seat',async t=>{
  const f=await fixture(t,2);await f.start();const a=f.clients[0],original=f.room.state.secrets.player.role;assert.ok((await action(a,{kind:'rest'})).ok);a.disconnect();await wait(()=>!f.room.members[0].socketId);const newcomer=await f.client();
  assert.equal((await emit(newcomer,'session:resume',{...f.auth[0],token:'invalid'})).ok,false);
  assert.equal((await emit(newcomer,'room:join',{code:f.room.code,nickname:'Host'})).ok,false);
  assert.ok((await emit(newcomer,'session:resume',f.auth[0])).ok);await wait(()=>newcomer.latest?.view);assert.equal(newcomer.latest.view.self.role,original);assert.ok(newcomer.latest.submitted.includes('player'));assert.equal((await action(newcomer,{kind:'rest'})).ok,false);
});
test('M4 timers progress disconnected players, abandoned rooms expire, rematch resets secrets',async t=>{
  const f=await fixture(t,2,{actionMs:70,eventMs:60,resultMs:15,idleMs:20000});await f.start();const first=f.room.runId;f.clients[1].disconnect();await wait(()=>f.room.state.phase!=='morning',4000);assert.ok(f.room.state.secrets[f.room.members[1].seat].actionHistory.length);
  // Conditional terminal state, then actual host rematch command.
  clearTimeout(f.room.timer);f.room.state.outcome={code:'saboteur',winner:'saboteur',day:f.room.state.day,title:'조건 테스트',description:'종료 후 재대결'};game.story.finish(f.room.state,()=>{},()=>.5);f.app.rooms.publish(f.room);
  assert.ok((await emit(f.clients[0],'room:rematch')).ok);assert.equal(f.room.state,null);assert.equal(f.room.members.length,1);assert.equal(f.room.members[0].ready,false);assert.equal(f.room.runId,null);assert.ok(first);
  f.clients[0].disconnect();await wait(()=>!f.room.members.some(m=>m.socketId));f.room.lastActive=Date.now()-30000;f.app.rooms.sweep();assert.equal(f.app.rooms.rooms.has(f.room.code),false);
});
test('production config rejects missing/insecure origin and static server denies private files',async t=>{
  assert.throws(()=>config({NODE_ENV:'production'}));assert.throws(()=>config({NODE_ENV:'production',APP_ORIGIN:'http://example.test'}));assert.equal(config({NODE_ENV:'production',APP_DOMAIN:'example.test'}).origin,'https://example.test');
  const f=await fixture(t,2);for(const name of ['server/rooms.cjs','.env','docs/phase6-after.json','.git/config'])assert.equal((await fetch(f.url+'/'+name)).status,404);
  const health=await fetch(f.url+'/health');assert.equal(health.status,200);assert.match(health.headers.get('content-security-policy'),/script-src 'self'/);
});

for(const humanSpy of [false,true])test(`explicit ${humanSpy?'human':'AI'} saboteur scenario completes; server-only starting fixture`,async t=>{
  const f=await fixture(t,2);await f.start();clearTimeout(f.room.timer);
  // Select a naturally assigned server state; no browser/API accepts a seed or role.
  for(let n=0;n<100;n++){const candidate=game.state.create(undefined,n,'hard',true,['player','seo']);const spy=candidate.players.find(p=>candidate.secrets[p.id].role==='saboteur');if(spy.isHuman===humanSpy){f.room.state=candidate;break;}}
  assert.equal(f.room.state.players.find(p=>f.room.state.secrets[p.id].role==='saboteur').isHuman,humanSpy);
  f.app.rooms.openTurn(f.room);await finish(f);assert.ok(f.room.state.outcome);
});

test('AI planner exceptions use a legal fallback rather than hanging a room',()=>{
  const s=game.state.create(undefined,1,'normal',true,['player','seo']),old=game.ai;
  try{game.ai={...old,plan(){throw Error('Injected planner failure');}};const next=game.state.onlineRound(s,{player:{kind:'rest'},seo:{kind:'rest'}});assert.ok(next.resolved);assert.equal(next.invalidDecisions,4);assert.ok(game.state.valid(next));}
  finally{game.ai=old;}
});

test('AI-disabled lobby requires six humans; full room and stale reconnect tokens are refused',async t=>{
  const f=await fixture(t,2),a=f.clients[0],b=f.clients[1];f.room.options.allowAI=false;await emit(a,'room:ready',{ready:true});await emit(b,'room:ready',{ready:true});assert.equal((await emit(a,'room:start')).ok,false);
  f.room.options.maxHumans=2;const extra=await f.client();assert.equal((await emit(extra,'room:join',{code:f.room.code,nickname:'Full'})).ok,false);
  await emit(b,'room:leave');assert.equal((await emit(extra,'session:resume',f.auth[1])).ok,false);
});

test('night actions apply once in seat order, investigation stays private, deadline ends day three',()=>{
  let s=game.state.create(undefined,2,'normal',true,game.data.survivors.map(p=>p.id));s.phase='night';s.day=3;s.resources.parts=0;s.resources.medicine=0;s.resources.food=12;s.resources.water=12;
  const investigator=s.players.find(p=>s.secrets[p.id].role==='investigator').id,spy=s.players.find(p=>s.secrets[p.id].role==='saboteur').id;
  const actions=Object.fromEntries(s.players.map(p=>[p.id,{kind:'rest'}]));actions[investigator]={kind:'investigate',target:spy};actions[spy]={kind:'hide',resource:'water'};
  s=game.state.onlineRound(s,actions);assert.equal(s.resources.water,9);assert.equal(s.secrets[investigator].information.length,1);for(const p of s.players.filter(p=>p.id!==investigator))assert.ok(!game.state.viewFor(s,p.id).log.some(e=>e.audience===investigator));assert.throws(()=>game.state.onlineRound(s,actions));
  s=game.state.onlineAdvance(s);assert.equal(s.outcome.code,'saboteur');assert.equal(s.resources.water,3);assert.deepEqual(s.settledDays,[3]);
});

test('all human spectators automatically watch the remaining AI reach an ending',async t=>{
  const f=await fixture(t,2);await f.start();clearTimeout(f.room.timer);
  for(let n=0;n<100;n++){const s=game.state.create(undefined,n,'normal',true,['player','seo']);if(!s.players.find(p=>s.secrets[p.id].role==='saboteur').isHuman){f.room.state=s;break;}}
  f.room.state.players.filter(p=>p.isHuman).forEach(p=>p.isExiled=true);
  f.app.rooms.openTurn(f.room);assert.ok(f.room.deadline-Date.now()<=20);
  await wait(()=>f.room.state.outcome||f.room.error,8000);assert.ok(f.room.state.outcome);assert.ok(!f.room.error);
  await wait(()=>f.clients.every(c=>c.latest.view.outcome));
  for(const c of f.clients){assert.equal(c.latest.actions.length,0);assert.equal((await action(c,{kind:'rest'})).ok,false);}
});

test('public lobby discovery works and foreign browser origins cannot connect',async t=>{
  const f=await fixture(t,2);f.room.options.private=false;const outsider=await f.client();
  const listing=await emit(outsider,'rooms:list');assert.ok(listing.rooms.some(r=>r.code===f.room.code));assert.ok(!JSON.stringify(listing).includes('token'));
  const rejected=io(f.url,{transports:['websocket'],forceNew:true,reconnection:false,extraHeaders:{Origin:'https://untrusted.example'}});
  t.after(()=>rejected.disconnect());await new Promise((resolve,reject)=>{rejected.once('connect',()=>reject(Error('Cross-origin connection accepted')));rejected.once('connect_error',resolve);});
});

test('unstartable AI-disabled room settings and failed joins never leave orphan rooms',async t=>{
  const f=await fixture(t,2),outsider=await f.client(),before=f.app.rooms.rooms.size;
  const invalid=await emit(outsider,'room:create',{...options,maxHumans:2,allowAI:false});
  assert.equal(invalid.ok,false);assert.equal(f.app.rooms.rooms.size,before);
  const original=f.app.profiles.customize;
  try{f.app.profiles.customize=()=>{throw Error('Injected profile write failure');};
    const failed=await emit(outsider,'room:create',{...options,nickname:'Failure'});
    assert.equal(failed.ok,false);assert.equal(f.app.rooms.rooms.size,before);
  }finally{f.app.profiles.customize=original;}
  const valid=await emit(outsider,'room:create',{...options,allowAI:false,maxHumans:6});assert.ok(valid.ok,valid.error);await wait(()=>outsider.latest?.room.code===valid.code);assert.equal(outsider.latest.room.aiCount,0);
});

test('lobby reconnect grace preserves a seat, expires abandoned seats, and permits a replacement to start',async t=>{
  const f=await fixture(t,2,{lobbyReconnectMs:120000}),[host,guest]=f.clients;
  host.disconnect();await wait(()=>!f.room.members[0].socketId);
  assert.equal(f.room.host,f.auth[1].memberId);
  const restored=await f.client();assert.ok((await emit(restored,'session:resume',f.auth[0])).ok);
  await wait(()=>restored.latest?.room);assert.equal(restored.latest.seat,'player');assert.equal(f.room.members[0].disconnectedAt,null);
  restored.disconnect();await wait(()=>!f.room.members[0].socketId);
  // Advance only the disconnected seat's timestamp: deterministic expiry boundary.
  f.room.members[0].disconnectedAt=Date.now()-120001;f.app.rooms.sweep();
  await wait(()=>guest.latest.room.participants.length===1);assert.equal(f.room.members.length,1);
  const replacement=await f.client();assert.equal((await emit(replacement,'session:resume',f.auth[0])).ok,false);
  assert.ok((await emit(replacement,'room:join',{code:f.room.code,nickname:'Replacement'})).ok);
  for(const s of [guest,replacement])assert.ok((await emit(s,'room:ready',{ready:true})).ok);
  assert.ok((await emit(guest,'room:start')).ok);assert.equal(f.room.state.players.filter(p=>p.isHuman).length,2);
});

test('active game disconnects retain their seat and role beyond lobby grace',async t=>{
  const f=await fixture(t,2,{lobbyReconnectMs:120000});await f.start();const role=f.room.state.secrets.player.role;
  f.clients[0].disconnect();await wait(()=>!f.room.members[0].socketId);
  f.room.members[0].disconnectedAt=Date.now()-120001;f.app.rooms.sweep();assert.equal(f.room.members.length,2);
  const restored=await f.client();assert.ok((await emit(restored,'session:resume',f.auth[0])).ok);
  await wait(()=>restored.latest?.view);assert.equal(restored.latest.view.self.role,role);
});

for(const phase of ['voting','night'])test(`beta: disconnect during ${phase} preserves queued action and late acknowledgement retry cannot double apply`,async t=>{
  const f=await fixture(t,2,{resultMs:10000});await f.start();clearTimeout(f.room.timer);f.room.state.phase=phase;f.app.rooms.openTurn(f.room);await wait(()=>f.clients.every(c=>c.latest.view.phase===phase));
  const a=f.clients[0],b=f.clients[1],requestId=crypto.randomUUID(),turnId=f.room.turnId,command=phase==='voting'?{kind:'vote',target:null}:{kind:'rest'},request={requestId,turnId,action:command};
  // Delay observation of the server ACK; transport still delivered the first request.
  const delayed=new Promise((resolve,reject)=>a.timeout(4000).emit('game:action',request,(err,r)=>setTimeout(()=>err?reject(err):resolve(r),100)));
  await wait(()=>f.room.submissions.player);assert.ok((await emit(a,'game:action',request)).ok);assert.ok((await delayed).ok);
  a.disconnect();await wait(()=>!f.room.members[0].socketId);assert.ok((await action(b,command)).ok);await wait(()=>f.room.state.resolved||f.room.state.outcome);
  const before=JSON.stringify(f.room.state),restored=await f.client();assert.ok((await emit(restored,'session:resume',f.auth[0])).ok);assert.ok((await emit(restored,'game:action',request)).ok);assert.equal(JSON.stringify(f.room.state),before);assert.equal(f.room.state.secrets.player.actionHistory.filter(x=>x.phase===phase).length,1);
});

test('beta: invalid/ended room access and request flood are rejected without cross-room damage',async t=>{
  const f=await fixture(t,2),outsider=await f.client();assert.equal((await emit(outsider,'room:join',{code:'ISLAND-NOTFOUND',nickname:'Nope'})).ok,false);await f.start();await finish(f);
  assert.equal((await emit(outsider,'room:join',{code:f.room.code,nickname:'TooLate'})).ok,false);
  let limited=false;for(let i=0;i<85;i++){const r=await emit(outsider,'rooms:list');if(!r.ok){limited=true;break;}}assert.ok(limited);assert.equal((await fetch(f.url+'/health')).status,200);assert.ok(f.clients[0].connected);
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {setup,timestamp}=require('./helpers.cjs');
function modules(storage={getItem:()=>null,setItem:()=>{}}){const context=vm.createContext({IslandMystery:setup(undefined,true),localStorage:storage});for(const f of ['assets','settings','presentation-model'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+f+'.js'),'utf8'),context);return context.IslandMystery;}
test('settings normalize corrupt values, persist independently, reset and tolerate denied storage',()=>{
  let saved;const g=modules({getItem:()=>'{broken',setItem:(k,v)=>{saved={k,v};}});assert.equal(g.settings.get().master,.65);
  g.settings.update({master:4,music:false,textSpeed:'malformed'});assert.equal(g.settings.get().master,1);assert.equal(g.settings.get().textSpeed,'normal');assert.equal(saved.k,'island-mystery.settings.v1');
  g.settings.reset();assert.equal(g.settings.get().music,true);const denied=modules({getItem:()=>null,setItem:()=>{throw Error();}});assert.equal(denied.settings.update({master:.2}),false);assert.equal(denied.settings.get().master,.2);
});
test('presentation derives resource changes and discoveries without modifying authoritative state or RNG',()=>{
  const g=modules(),s=g.state.create(timestamp,2),before=g.state.viewFor(s),next=g.state.transition(s,{type:'ACT',kind:'explore',location:'lab'},timestamp),after=g.state.viewFor(next),snapshot=JSON.stringify(next);
  const delta=g.presentationModel.delta(before,after);for(const r of delta.resources)assert.equal(r.amount,after.resources[r.id]-before.resources[r.id]);assert.equal(JSON.stringify(next),snapshot);
  assert.equal(g.presentationModel.delta(after,after).resources.length,0);assert.equal(g.presentationModel.delta(null,after).clues.length,0);
});
test('six portrait states depend on health, public speech and own suspicion, never hidden roles',()=>{
  const g=modules(),v=g.state.viewFor(g.state.create(timestamp,5)),p=v.players[1],m=g.presentationModel;
  assert.equal(m.expression(v,{...p,health:30}),5);assert.equal(m.expression(v,p,{speakerId:p.id,text:'그 말에 반박합니다.'}),2);assert.equal(m.expression(v,p,{speakerId:p.id,text:'새 증거를 발견했습니다.'}),4);
  v.phase='voting';assert.equal(m.expression(v,p),3);v.phase='morning';v.self.suspicion[p.id]=80;assert.equal(m.expression(v,p),1);v.self.suspicion[p.id]=0;assert.equal(m.expression(v,p),0);
  const guarded=new Proxy(v,{get(t,k){assert.ok(!['secrets','facts','story','causes'].includes(k));return t[k];}});m.expression(guarded,p);assert.equal(m.expressions.length,6);
});
test('all 36 events have descriptions and reusable visual effects, all phases and outcomes have actual tracks',()=>{
  const g=modules();for(const e of g.storyData.events){assert.ok(g.presentationModel.eventDescription(e.id).length>15);assert.notEqual(g.presentationModel.eventEffect(e),'none');}
  for(const phase of g.config.phases)assert.ok(g.assets.bgm[g.presentationModel.music({phase})]);for(const winner of ['survivors','saboteur','none'])assert.ok(g.assets.bgm[g.presentationModel.music({outcome:{winner}})]);
});
test('all referenced assets exist and 25 original WAVs contain non-silent unclipped PCM data',()=>{
  const g=modules();for(const url of Object.values(g.assets.images))assert.ok(fs.statSync(path.join(__dirname,'..',url)).size>1000);
  assert.equal(Object.keys(g.assets.bgm).length,9);assert.equal(Object.keys(g.assets.sfx).length,16);
  for(const file of [...Object.values(g.assets.bgm),...Object.values(g.assets.sfx)]){const b=fs.readFileSync(path.join(__dirname,'..',file));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');assert.equal(b.readUInt32LE(40),b.length-44);let peak=0,energy=0;for(let i=44;i<b.length;i+=2){const n=b.readInt16LE(i);peak=Math.max(peak,Math.abs(n));energy+=n*n;}assert.ok(peak>100&&peak<32767);assert.ok(energy>0);}
});

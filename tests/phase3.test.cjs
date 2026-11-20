const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, storage, timestamp, withRole, quietAI, act, next } = require('./helpers.cjs');
const json = v => JSON.stringify(v);
function discussion(g, seed = 3) {
  let s = withRole(g, 'saboteur', seed); quietAI(g);
  s = act(g, s, { kind: 'explore', location: 'tower' }); s = next(g, s);
  s = act(g, s, { kind: 'gather', resource: 'food' }); return next(g, s);
}
test('traits and initial relationships are independent of roles, with separate memory stores', () => {
  const g = setup();
  for (let seed = 1; seed < 30; seed++) {
    const s = g.state.create(timestamp, seed);
    for (const p of s.players) {
      assert.equal(json(s.secrets[p.id].traits), json(g.config.personalities[p.id]));
      assert.ok(Object.values(s.secrets[p.id].trust).every(n => n === 50));
      assert.ok(Object.values(s.secrets[p.id].suspicion).every(n => n === 20));
    }
    s.secrets.seo.memory.push({}); assert.equal(s.secrets.min.memory.length, 0);
  }
});
test('personality changes actual discussion selection under identical public circumstances', () => {
  const g = setup(); let s = discussion(g); g.ai = setup().ai;
  const v = g.state.viewFor(s); v.self.role = 'explorer';
  v.self.traits = { ...g.config.personalities.ha }; const cooperative = g.ai.decide(v, () => .5);
  v.self.traits = { ...g.config.personalities.ji }; const privateChoice = g.ai.decide(v, () => .5);
  assert.notEqual(cooperative.kind, privateChoice.kind);
});
test('five rounds, persisted continuation and skip execute identical consequences', () => {
  const g = setup(); let s = discussion(g); g.ai = setup().ai;
  const skipped = g.state.transition(s, { type: 'SKIP_DISCUSSION' }, timestamp);
  let manual = s;
  while (manual.phase === 'discussion') manual = manual.resolved ? next(g, manual) : act(g, manual, { kind: 'discuss' });
  assert.equal(json(skipped), json(manual)); assert.equal(skipped.phase, 'voting');
  for (const p of skipped.players) assert.equal(skipped.secrets[p.id].actionHistory.filter(a => a.phase === 'discussion').length, 5);
  assert.throws(() => g.state.transition(skipped, { type: 'SKIP_DISCUSSION' }));
  s = act(g, s, { kind: 'discuss' }); assert.throws(() => act(g, s, { kind: 'discuss' }));
  assert.equal(g.storage.save(s), true); const restored = g.storage.load().state;
  assert.equal(json(next(g, restored)), json(next(g, s)));
});
test('human false claims are private intentions; exact eyewitness proof permits a grounded rebuttal', () => {
  const g = setup(); let s = discussion(g);
  const history = s.secrets.player.actionHistory[0], fact = s.facts.find(f => f.actorId === 'player' && f.phase === 'morning');
  g.perception.learn(s, 'seo', { id: 'test-proof', eventId: fact.id, day: 1, phase: 'morning', kind: 'location', location: 'tower', subjectId: 'player', text: '1일차 아침 당신을 통신탑에서 목격했다.' });
  s = act(g, s, { kind: 'lie', historyId: history.id, location: 'lab' });
  const statement = s.statements.find(m => m.speakerId === 'player');
  assert.equal(s.secrets.player.claimHistory[0].intent, 'lie');
  assert.ok(s.secrets.seo.memory.some(m => m.statementId === statement.id && m.judgment === '직접 증거와 모순'));
  assert.ok(s.secrets.ha.memory.some(m => m.statementId === statement.id && m.judgment === '미검증 주장'));
  const v = g.state.viewFor(next(g, s), 'seo');
  assert.equal('intent' in v.statements[0], false);
  assert.equal(v.statements[0].mode, 'claim', 'public metadata must not disclose whether a claim is a lie');
  const rebut = g.state.availableActions(v).find(a => a.kind === 'rebut'); assert.ok(rebut);
  g.ai = setup().ai; assert.equal(g.ai.decide(v, () => .5).kind, 'rebut');
  assert.ok(s.secrets.seo.relationshipHistory.some(r => r.target === 'player' && r.after.suspicion > r.before.suspicion));
});
test('claims cannot fabricate owned evidence; question responses link to actual prior statements', () => {
  const g = setup(); let s = discussion(g);
  assert.throws(() => act(g, s, { kind: 'share', clueId: 'nonexistent' }));
  assert.throws(() => act(g, s, { kind: 'evidence', memoryId: 'another-person-private-memory' }));
  assert.throws(() => act(g, s, { kind: 'lie', historyId: 'invented', location: 'lab' }));
  s.discussionRound = 2; g.ai = setup().ai;
  s = act(g, s, { kind: 'question', target: 'seo' });
  const q = s.statements.find(m => m.speakerId === 'player');
  assert.ok(s.statements.some(m => m.speakerId === 'seo' && m.replyTo === q.id && m.mode === 'explain'));
});
test('physical observations require co-location and transmitted evidence is hearsay', () => {
  const g = setup(); let s = discussion(g);
  for (const id of ['seo', 'do', 'ha', 'min', 'ji']) assert.ok(!s.secrets[id].memory.some(m => m.kind === 'location' && m.direct && m.subjectId === 'player' && m.phase === 'morning'));
  const memory = s.secrets.player.memory.find(m => m.kind === 'location');
  s = act(g, s, { kind: 'evidence', memoryId: memory.id });
  const shared = s.secrets.seo.memory.find(m => m.source === 'testimony:player');
  assert.ok(shared); assert.equal(shared.direct, false); assert.ok(shared.reliability < 1);
});
test('later place-specific records revise earlier lies, preserving the original event time', () => {
  const g = setup(); let s = discussion(g), history = s.secrets.player.actionHistory[0];
  s = act(g, s, { kind: 'lie', historyId: history.id, location: 'lab' });
  const claimId = s.statements[0].id;
  s.day = 2; s.phase = 'morning'; s.acted = []; s.resolved = false;
  const seo = s.players.find(p => p.id === 'seo'); seo.location = 'tower';
  s.secrets.seo.actionHistory.push({ id: 'test-day2', day: 2, phase: 'morning', round: null, kind: 'explore', target: null, location: null });
  g.perception.action(s, seo, { kind: 'explore', location: 'tower' }, () => 0);
  const remembered = s.secrets.seo.memory.find(m => m.statementId === claimId);
  assert.equal(remembered.judgment, '직접 증거와 모순'); assert.equal(remembered.day, 1); assert.equal(remembered.phase, 'morning');
});
test('voting uses private evidence and relationships, allowing divergent votes and explained abstention', () => {
  const g = setup(), s = g.state.create(timestamp, 12); s.phase = 'voting';
  let v = g.state.viewFor(s, 'seo'); assert.equal(g.ai.decide(v, () => .5).target, null);
  s.secrets.seo.suspicion.do = 80; s.secrets.min.suspicion.ji = 80;
  const a = g.ai.decide(g.state.viewFor(s, 'seo'), () => .5), b = g.ai.decide(g.state.viewFor(s, 'min'), () => .5);
  assert.equal(a.target, 'do'); assert.equal(b.target, 'ji'); assert.ok(a.reason.length);
  s.players.find(p => p.id === 'do').isExiled = true;
  assert.notEqual(g.ai.decide(g.state.viewFor(s, 'seo'), () => .5).target, 'do');
});
test('all difficulties have the same information boundary; hidden facts and plans cannot affect AI input', () => {
  const g = setup();
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const s = g.state.create(timestamp, 5, difficulty), v = g.state.viewFor(s, 'seo');
    assert.equal('facts' in v, false); assert.equal('secrets' in v, false); assert.equal(v.plannedLocation, null);
    assert.ok(v.players.filter(p => p.id !== 'seo').every(p => p.location === null && !('role' in p)));
    const before = json(g.ai.decide(v, () => .5)); s.plannedLocation = 'tower'; s.selectedLocation = 'lab';
    s.secrets.player.memory.push({ secret: true }); s.players[0].location = 'lab';
    assert.equal(json(g.ai.decide(g.state.viewFor(s, 'seo'), () => .5)), before);
  }
});
test('v2 migration preserves gameplay and source save without inventing witnessed history', () => {
  // Fixture produced by the actual v2 implementation at commit 8b2f2f6.
  const old = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/phase2-save.json'), 'utf8'));
  const backing = storage(), raw = json(old); backing.setItem('island-mystery.save.v2', raw);
  const g = setup(backing), loaded = g.storage.load(); assert.equal(loaded.status, 'migrated');
  assert.equal(json(loaded.state.resources), json(old.resources)); assert.equal(loaded.state.rng, old.rng);
  assert.ok(loaded.state.players.every(p => loaded.state.secrets[p.id].role === old.secrets[p.id].role));
  assert.equal(loaded.state.secrets.seo.memory.length, 0); assert.equal(g.storage.save(loaded.state), true);
  assert.equal(backing.getItem('island-mystery.save.v2'), raw); assert.equal(g.storage.load().status, 'loaded');
});
test('malformed extended saves are refused without modifying current gameplay', () => {
  const g = setup();
  for (const corrupt of [s => s.discussionRound = 6, s => s.difficulty = 'unknown', s => s.secrets.seo.traits.caution = NaN, s => s.secrets.seo.memory.push({}), s => s.statements.push({}), s => s.facts.push({}), s => s.secrets.player.claimHistory = null]) {
    const s = g.state.create(timestamp, 1); corrupt(s); assert.equal(g.state.valid(s), false); assert.equal(g.storage.save(s), false);
  }
});
test('saboteur divides an observed relationship instead of reading other minds', () => {
  const g = setup(); let s = discussion(g); s.day = 2; s.discussionRound = 1;
  g.perception.learn(s, 'player', { id: 'known-sharing', eventId: 'known-sharing', kind: 'sharing', subjectId: 'ha', text: '하린이 조사 기록을 공유했다.', source: 'public-statement' });
  g.ai = setup().ai; const v = g.state.viewFor(s), plan = g.ai.plan(v, () => .5);
  assert.equal(plan.strategy, 'divide'); assert.equal(plan.action.kind, 'redirect'); assert.equal(plan.action.target, 'ha');
  s = act(g, s, plan.action);
  assert.equal(s.statements[0].mode, 'speculate', 'public listeners receive a claim, not private strategic intent');
});
test('a saboteur never rebuts its own deliberate lie or volunteers the hidden route as evidence', () => {
  const g = setup(); let s = withRole(g, 'saboteur', 4); quietAI(g);
  s = act(g, s, { kind: 'rest' }); s = next(g, s); s = act(g, s, { kind: 'hide', resource: 'water' }); s = next(g, s);
  const hidden = s.secrets.player.actionHistory.find(h => h.kind === 'hide');
  s = act(g, s, { kind: 'lie', historyId: hidden.id, location: 'lab' }); s = next(g, s);
  let view = g.state.viewFor(s);
  assert.ok(!g.state.availableActions(view).some(a => a.kind === 'rebut' && a.target === 'player'));
  s.discussionRound = 3; g.ai = setup().ai; view = g.state.viewFor(s);
  const choice = g.ai.decide(view, () => .5);
  if (choice.memoryId) { const memory = view.self.memory.find(m => m.id === choice.memoryId); assert.ok(!(memory.subjectId === 'player' && memory.phase === 'afternoon')); }
});
test('secretive AI withholds information, cooperative AI defends a trusted person', () => {
  const g = setup(); let s = discussion(g); s.discussionRound = 3; g.ai = setup().ai;
  let v = g.state.viewFor(s); v.self.role = 'explorer'; v.self.traits = { ...g.config.personalities.ji };
  assert.equal(g.ai.decide(v, () => .5).kind, 'conceal');
  v.self.traits = { ...g.config.personalities.ha }; v.self.trust.seo = 80; v.self.suspicion.seo = 10;
  assert.equal(g.ai.decide(v, () => .5).kind, 'defend');
});
test('statement provenance distinguishes intentional deception, hearsay and guesses', () => {
  const g = setup(); let s = discussion(g);
  s.secrets.player.information.push({ id: 'legacy-clue', text: '확실하지 않은 조사 흔적', suspectId: null, weight: 0, shared: false });
  s = act(g, s, { kind: 'share', clueId: 'legacy-clue' }); assert.equal(s.secrets.player.claimHistory.at(-1).intent, 'hearsay');
  s = next(g, s); s = act(g, s, { kind: 'feign' }); assert.equal(s.secrets.player.claimHistory.at(-1).intent, 'lie');
  s = next(g, s); s = act(g, s, { kind: 'speculate', target: 'ha' }); assert.equal(s.secrets.player.claimHistory.at(-1).intent, 'guess');
});

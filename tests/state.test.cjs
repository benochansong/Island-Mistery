const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, storage, timestamp, withRole, quietAI, act, next, completedNight } = require('./helpers.cjs');
const serial = value => JSON.stringify(value);
test('200 starts: six characters, all five roles, exactly one saboteur, human can receive every role', () => {
  const g = setup(), seen = new Set(), orders = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const s = g.state.create(timestamp, seed), roles = Object.values(s.secrets).map(p => p.role);
    assert.equal(g.state.valid(s), true); assert.equal(s.players.filter(p => p.isHuman).length, 1);
    assert.equal(s.players.length, 6); assert.equal(new Set(s.players.map(p => p.id)).size, 6);
    assert.equal(roles.filter(r => r === 'saboteur').length, 1); assert.equal(new Set(roles).size, 5);
    assert.equal(serial(s.resources), serial({ food: 12, water: 12, medicine: 2, parts: 2 }));
    seen.add(s.secrets.player.role); orders.add(roles.join());
  }
  assert.equal(seen.size, 5); assert.ok(orders.size > 30);
});
test('map planning is preserved, immutable, and separate from actual exploration', () => {
  const g = setup(), start = g.state.create(timestamp, 1);
  let s = g.state.transition(start, { type: 'SELECT_LOCATION', location: 'lab' }, timestamp);
  s = g.state.transition(s, { type: 'PLAN_EXPEDITION' }, timestamp);
  assert.equal(start.selectedLocation, 'coast'); assert.equal(s.plannedLocation, 'lab');
  assert.equal(serial(s.resources), serial(start.resources));
  assert.equal(g.state.transition(s, { type: 'PLAN_EXPEDITION' }), s);
});
test('four regions produce varied loot, private clues, injury, failure and special events', () => {
  const g = setup(); quietAI(g); const kinds = new Set(), outcomes = new Set();
  for (const location of ['coast', 'jungle', 'lab', 'tower']) {
    let gains = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const s = act(g, withRole(g, 'investigator', seed), { kind: 'explore', location });
      assert.equal(s.resolved, true); assert.equal(s.acted.length, 6);
      assert.equal(s.secrets.player.actionHistory.length, 1);
      s.lastResults.filter(e => e.actorId === 'player').forEach(e => kinds.add(e.kind));
      gains += s.lastResults.filter(e => e.actorId === 'player' && e.kind === 'resource').length;
      outcomes.add(serial(s.resources));
    }
    assert.ok(gains > 0, location);
  }
  for (const kind of ['resource', 'clue', 'health', 'failure', 'special']) assert.ok(kinds.has(kind), kind);
  assert.ok(outcomes.size > 20);
});
test('role bonuses change exploration and clue probabilities with matched seeds', () => {
  const g = setup(); quietAI(g); let explorerSuccess = 0, doctorSuccess = 0, investigatorClues = 0, doctorClues = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (const role of ['explorer', 'doctor', 'investigator']) {
      const s = act(g, withRole(g, role, seed), { kind: 'explore', location: 'jungle' });
      const success = !s.lastResults.some(e => e.actorId === 'player' && e.kind === 'failure');
      if (role === 'explorer') explorerSuccess += success;
      if (role === 'doctor') { doctorSuccess += success; doctorClues += s.secrets.player.information.length; }
      if (role === 'investigator') investigatorClues += s.secrets.player.information.length;
    }
  }
  assert.ok(explorerSuccess > doctorSuccess); assert.ok(investigatorClues > doctorClues);
});
test('actions and advance are phase-gated; double action cannot duplicate AI or resources', () => {
  const g = setup(); let s = g.state.create(timestamp, 4);
  assert.throws(() => next(g, s)); assert.throws(() => act(g, s, { kind: 'repair', facility: 'radio' }));
  const original = serial(s); s = act(g, s, { kind: 'explore', location: 'coast' });
  assert.notEqual(serial(s), original); const snapshot = serial(s);
  assert.throws(() => act(g, s, { kind: 'explore', location: 'coast' })); assert.equal(serial(s), snapshot);
  s = next(g, s); assert.equal(s.phase, 'afternoon'); assert.equal(s.acted.length, 0); assert.equal(s.resolved, false);
  assert.throws(() => next(g, s));
});
test('doctor heals more, engineer repairs cheaper, action costs never go below zero', () => {
  const g = setup(); quietAI(g);
  for (const role of ['doctor', 'explorer']) {
    let s = withRole(g, role); s.phase = 'afternoon'; s.players[0].health = 30;
    s = act(g, s, { kind: 'heal', target: 'player' });
    assert.equal(s.players[0].health, role === 'doctor' ? 75 : 55); assert.equal(s.resources.medicine, 1);
  }
  for (const role of ['engineer', 'explorer']) {
    let s = withRole(g, role); s.phase = 'afternoon';
    s = act(g, s, { kind: 'repair', facility: 'radio' });
    assert.equal(s.facilities.radio, role === 'engineer' ? 3 : 2); assert.equal(s.resources.parts, role === 'engineer' ? 1 : 0);
  }
  const empty = withRole(g, 'doctor'); empty.phase = 'night'; empty.resources.medicine = 0;
  assert.throws(() => act(g, empty, { kind: 'heal', target: 'player' }));
});
test('saboteur sabotage and hiding affect state without publicly naming the culprit', () => {
  const g = setup(); quietAI(g); let s = withRole(g, 'saboteur'); s.phase = 'afternoon'; s.resources.water = 1;
  s = act(g, s, { kind: 'hide', resource: 'water' });
  assert.equal(s.resources.water, 0); assert.equal(s.secrets.player.inventory.length, 1);
  assert.ok(s.log.some(e => e.audience === 'player' && e.kind === 'secret'));
  assert.ok(!s.lastResults.some(e => e.audience === 'public' && e.actorId === 'player'));
  let sabotage = withRole(g, 'saboteur'); sabotage.phase = 'night'; sabotage.facilities.radio = 3;
  sabotage = act(g, sabotage, { kind: 'sabotage', facility: 'radio' }); assert.equal(sabotage.facilities.radio, 0);
  const loyal = withRole(g, 'explorer'); loyal.phase = 'night'; assert.throws(() => act(g, loyal, { kind: 'hide', resource: 'water' }));
});
test('investigator receives uncertain private evidence, not a role revelation', () => {
  const g = setup(); quietAI(g); const messages = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    let s = withRole(g, 'investigator', seed); s.phase = 'night';
    s = act(g, s, { kind: 'investigate', target: 'seo' });
    const clue = s.secrets.player.information[0]; assert.ok(clue); messages.add(clue.text);
    assert.ok(!g.state.viewFor(s, 'seo').log.some(e => e.audience === 'player'));
    assert.ok(!clue.text.includes('직업'));
  }
  assert.equal(messages.size, 2);
});
test('AI considers shortages, healing and own role; hidden roles cannot influence its input', () => {
  const g = setup(); let s = withRole(g, 'doctor'); s.resources.water = 0;
  let v = g.state.viewFor(s); assert.equal(g.ai.decide(v, () => 0.5).location, 'coast');
  s.phase = 'afternoon'; s.players[1].health = 30; v = g.state.viewFor(s);
  assert.equal(g.ai.decide(v, () => 0.5).kind, 'heal');
  const before = serial(g.ai.decide(v, () => 0.5));
  const others = s.players.slice(1).map(p => p.id);
  [s.secrets[others[0]].role, s.secrets[others[1]].role] = [s.secrets[others[1]].role, s.secrets[others[0]].role];
  assert.equal(serial(g.ai.decide(g.state.viewFor(s), () => 0.5)), before);
  assert.equal('secrets' in v, false); assert.equal('rng' in v, false);
  v.players.forEach(p => { assert.equal('role' in p, false); assert.equal('trust' in p, false); });
});
test('discussion changes relationships and repeated actions are refused', () => {
  const g = setup(); quietAI(g); let s = g.state.create(timestamp, 1); s.phase = 'discussion';
  for (const p of s.players) if (p.id !== 'player') s.secrets[p.id].trust.player = 60;
  s = act(g, s, { kind: 'accuse', target: 'seo' });
  assert.ok(s.secrets.do.suspicion.seo > 0); assert.equal(s.log.filter(e => e.kind === 'discussion').length, 6);
  assert.throws(() => act(g, s, { kind: 'accuse', target: 'seo' }));
});
test('unique leader is exiled, ties cause no exile, self-votes are rejected', () => {
  const g = setup(); quietAI(g); let s = withRole(g, 'explorer'); s.phase = 'voting';
  assert.throws(() => act(g, s, { kind: 'vote', target: 'player' }));
  s = act(g, s, { kind: 'vote', target: 'seo' }); assert.equal(s.players[1].isExiled, true);
  const ties = { seo: 'player', do: 'player', ha: 'seo', min: 'player', ji: 'seo' };
  g.ai = { decide(view) { return { kind: 'vote', target: ties[view.self.id] }; } };
  let t = withRole(g, 'explorer'); t.phase = 'voting'; t = act(g, t, { kind: 'vote', target: 'seo' });
  assert.equal(t.players.some(p => p.isExiled), false); assert.equal(Object.keys(t.votes).length, 6);
});
test('night consumes resources once, excludes dead/exiled participants, resets next day', () => {
  const g = setup(); let s = completedNight(g); s.resources.food = 30; s.resources.water = 30;
  s.players[1].isExiled = true; s.players[2].health = 0; s.players[2].isAlive = false;
  // Avoid an exile-rescue outcome by keeping the saboteur active.
  const spy = s.players.find(p => s.secrets[p.id].role === 'saboteur');
  if (!spy.isAlive || spy.isExiled) { const other = s.players.find(p => p.id !== 'player' && p.isAlive && !p.isExiled); [s.secrets[spy.id].role, s.secrets[other.id].role] = [s.secrets[other.id].role, s.secrets[spy.id].role]; }
  s = next(g, s);
  assert.equal(s.day, 2); assert.equal(s.phase, 'morning'); assert.equal(s.acted.length, 0);
  const debits = s.log.filter(e => e.kind === 'resource' && /-4/.test(e.text)); assert.equal(debits.length, 2);
  assert.equal(s.log.filter(e => e.kind === 'settlement').length, 1); assert.equal(s.settledDays.join(), '1');
  assert.throws(() => next(g, s));
});
test('shortage is clamped to zero, damages health, and can end in survival failure', () => {
  const g = setup(); let s = completedNight(g); s.resources.food = 0; s.resources.water = 0;
  s.players.forEach(p => { p.health = 40; }); s = next(g, s);
  assert.equal(s.outcome.code, 'extinction'); assert.equal(s.resources.food, 0); assert.equal(s.resources.water, 0);
  assert.ok(s.players.every(p => !p.isAlive && p.health === 0));
});
test('all four endings, priority, and terminal action locks', () => {
  const g = setup(); quietAI(g);
  let escape = withRole(g, 'engineer'); escape.phase = 'afternoon'; escape.facilities.boat = 13;
  escape = act(g, escape, { kind: 'repair', facility: 'boat' }); assert.equal(escape.outcome.code, 'escape');
  let exposed = completedNight(g); exposed.players.find(p => exposed.secrets[p.id].role === 'saboteur').isExiled = true;
  exposed = next(g, exposed); assert.equal(exposed.outcome.code, 'exposed');
  let timeout = completedNight(g); timeout.day = 3; timeout = next(g, timeout); assert.equal(timeout.outcome.code, 'saboteur');
  let collapse = withRole(g, 'saboteur'); collapse.players.slice(1).forEach(p => { p.isExiled = true; });
  collapse = act(g, collapse, { kind: 'rest' }); assert.equal(collapse.outcome.code, 'saboteur');
  let dead = completedNight(g); dead.resources.food = 0; dead.resources.water = 0; dead.players.forEach(p => { p.health = 1; });
  dead.players.find(p => dead.secrets[p.id].role === 'saboteur').isExiled = true;
  dead = next(g, dead); assert.equal(dead.outcome.code, 'extinction');
  for (const ended of [escape, exposed, timeout, dead]) {
    assert.throws(() => next(g, ended)); assert.throws(() => act(g, ended, { kind: 'rest' })); assert.equal(g.state.availableActions(g.state.viewFor(ended)).length, 0);
  }
});
test('human exile and death allow spectator completion; eliminated AI cannot act or vote', () => {
  const g = setup();
  for (const type of ['exile', 'death']) {
    let s = withRole(g, 'explorer', 12); s.players[0].isExiled = type === 'exile';
    if (type === 'death') { s.players[0].health = 0; s.players[0].isAlive = false; }
    s.players[2].isExiled = true; let steps = 0;
    assert.throws(() => act(g, s, { kind: 'rest' }));
    while (!s.outcome && steps++ < 60) { s = next(g, s); assert.equal(s.secrets.do.actionHistory.length, 0); assert.equal(Object.hasOwn(s.votes, 'do'), false); }
    assert.ok(s.outcome); assert.ok(s.day <= 3); assert.equal(s.secrets.player.actionHistory.length, 0);
  }
});
test('save restores every phase including deterministic next outcome and ended games', () => {
  const backing = storage(), g = setup(backing); let s = withRole(g, 'explorer', 18); quietAI(g);
  for (let step = 0; !s.outcome && step < 60; step++) {
    assert.equal(g.storage.save(s), true); const fresh = setup(backing); quietAI(fresh);
    const restored = fresh.storage.load(); assert.equal(restored.status, 'loaded'); assert.equal(serial(restored.state), serial(s));
    const v = g.state.viewFor(s), options = g.state.availableActions(v);
    const action = options.length ? { type: 'ACT', ...options.find(a => a.kind === 'rest' || a.kind === 'discuss' || a.kind === 'vote' && a.target === null) } : { type: 'NEXT' };
    const result = g.state.transition(s, action, timestamp); assert.equal(serial(fresh.state.transition(restored.state, action, timestamp)), serial(result)); s = result;
  }
  assert.ok(s.outcome); assert.equal(g.storage.save(s), true); assert.ok(setup(backing).storage.load().state.outcome);
});
test('legacy saves remain untouched; malformed saves and denied storage fail safely', () => {
  const backing = storage(); backing.setItem('island-mystery.save.v1', '{legacy}'); const g = setup(backing);
  assert.equal(g.storage.load().status, 'legacy'); assert.equal(g.storage.save(g.state.create(timestamp, 1)), true);
  assert.equal(backing.getItem('island-mystery.save.v1'), '{legacy}');
  for (const raw of ['{', 'null', '{}', 'x'.repeat(5000001)]) { backing.setItem('island-mystery.save.v3', raw); assert.equal(g.storage.load().status, 'invalid'); }
  for (const mutate of [s => s.version = 1, s => s.players.pop(), s => s.resources.food = -1, s => s.secrets.player = null, s => s.acted.push('invalid'), s => s.secrets.player.trust.seo = 101, s => s.log[0].text = {}, s => s.outcome = {}]) {
    const s = g.state.create(timestamp, 1); mutate(s); assert.equal(g.state.valid(s), false); assert.equal(g.storage.save(s), false);
  }
  const denied = setup({ getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } });
  assert.equal(denied.storage.load().status, 'unavailable'); assert.equal(denied.storage.save(denied.state.create(timestamp, 1)), false);
  assert.ok(act(denied, denied.state.create(timestamp, 1), { kind: 'rest' }).resolved);
});

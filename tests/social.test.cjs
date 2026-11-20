const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, timestamp } = require('./helpers.cjs');
function mind(game, id = 'seo') {
  const s = game.state.create(timestamp, 4);
  const m = { ...s.secrets[id], ...game.social.initialize(id) };
  for (const key of Object.keys(m.trust)) { m.trust[key] = 50; m.suspicion[key] = 20; }
  return m;
}
function event(overrides = {}) { return { id: 'e1', eventId: 'fact1', day: 1, phase: 'night', location: 'tower', subjectId: 'do', speakerId: 'do', text: '시험 증언', source: 'reported', direct: false, reliability: 0.8, updatedAt: timestamp, kind: 'claim', ...overrides }; }
test('personalities judge identical evidence differently and never duplicate effects', () => {
  const g = setup(), analyst = mind(g, 'seo'), emotional = mind(g, 'min');
  const trace = event({ kind: 'trace', direct: true, source: 'witness' });
  g.social.remember(analyst, trace); g.social.remember(emotional, trace);
  assert.ok(analyst.suspicion.do > emotional.suspicion.do);
  const before = JSON.stringify(analyst); g.social.remember(analyst, trace); assert.equal(JSON.stringify(analyst), before);
  g.social.remember(analyst, { ...trace, id: 'same-event-new-message' }); assert.equal(analyst.relationshipHistory.length, 1);
});
test('a lie remains unverified without evidence and is revised when exact-slot evidence arrives', () => {
  const g = setup(), m = mind(g);
  g.social.remember(m, event({ location: 'lab' })); assert.equal(m.suspicion.do, 20);
  g.social.remember(m, event({ id: 'different-day', eventId: 'f2', day: 2, kind: 'location', source: 'witness', direct: true, reliability: 1 }));
  assert.equal(m.suspicion.do, 20);
  g.social.remember(m, event({ id: 'exact-proof', eventId: 'f3', kind: 'location', source: 'witness', direct: true, reliability: 1 }));
  assert.ok(m.suspicion.do > 20); assert.ok(m.trust.do < 50);
  assert.equal(m.memory[0].judgment, '직접 증거와 모순'); assert.equal(m.memory[0].revisions.length, 1);
  assert.equal(m.memory[0].revisions[0].evidenceId, 'exact-proof');
});
test('contradictory hearsay is not established as a lie and true statements match sightings', () => {
  const g = setup(), m = mind(g);
  g.social.remember(m, event({ location: 'lab' }));
  g.social.remember(m, event({ id: 'rumor', eventId: 'rumor', speakerId: 'min' }));
  assert.equal(m.trust.do, 50); assert.equal(m.suspicion.do, 20);
  assert.ok(!m.memory.some(item => item.judgment === '직접 증거와 모순'));
  const trueMind = mind(g); g.social.remember(trueMind, event({ kind: 'location', direct: true, source: 'witness', reliability: 1 }));
  g.social.remember(trueMind, event({ id: 'truth', eventId: 'truth' }));
  assert.equal(trueMind.memory[1].judgment, '직접 목격과 일치');
});
test('verified alibi reduces suspicion without treating old locations as current proof', () => {
  const g = setup(), m = mind(g); m.suspicion.do = 70;
  g.social.remember(m, event({ kind: 'damage', subjectId: null, speakerId: null, location: 'tower' }));
  g.social.remember(m, event({ id: 'old-place', eventId: 'f2', phase: 'morning', kind: 'location', location: 'coast', direct: true, source: 'witness', reliability: 1 }));
  assert.equal(m.suspicion.do, 70);
  g.social.remember(m, event({ id: 'alibi', eventId: 'f3', kind: 'location', location: 'coast', direct: true, source: 'witness', reliability: 1 }));
  assert.ok(m.suspicion.do < 70); assert.ok(m.trust.do > 50);
});

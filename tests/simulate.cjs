const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, timestamp, storage } = require('./helpers.cjs');
const backing = storage(), game = setup(backing);
const report = { games: 300, seeds: '1–300', endings: {}, endingDays: {}, humanSaboteur: 0, humanSurvivor: 0, maxTransitions: 0, completed: 0, wins: {}, averageDay: 0, exiles: 0, invalidDecisions: 0, informationViolations: 0, auditedDecisions: 0, statementModes: {}, strategies: {}, verifiedContradictions: 0, privateLies: 0, falseAlibis: 0, failures: [], policies: ['규칙 기반 선택', '탐험·보급·기권·휴식', '직업 능력 우선'] };
const originalPlan = game.ai.plan;
function guard(view) {
  const blocked = (object, keys) => new Proxy(object, { get(target, key) { if (keys.includes(key)) { report.informationViolations++; throw new Error('Forbidden AI access: ' + key); } return Reflect.get(target, key); } });
  return blocked({ ...view, players: view.players.map(p => blocked(p, ['role', 'memory', 'actionHistory', 'trust', 'suspicion', 'secretGoal'])) }, ['secrets', 'facts', 'rng']);
}
game.ai = { ...game.ai, plan(view, random) { report.auditedDecisions++; return originalPlan(guard(view), random); } };
const examples = [];
for (let seed = 1; seed <= report.games; seed++) {
  let state = game.state.create(timestamp, seed), transitions = 0;
  state.secrets.player.role === 'saboteur' ? report.humanSaboteur++ : report.humanSurvivor++;
  try {
    while (!state.outcome && transitions < 60) {
      const view = game.state.viewFor(state), choices = game.state.availableActions(view);
      for (const person of state.players) {
        const scoped = game.state.viewFor(state, person.id);
        assert.equal('secrets' in scoped, false); assert.equal('facts' in scoped, false);
        assert.ok(scoped.statements.every(m => !['lie', 'feign', 'redirect'].includes(m.mode)));
        assert.ok(scoped.players.filter(p => p.id !== person.id).every(p => p.location === null));
        assert.ok(scoped.players.every(p => !Object.hasOwn(p, 'role') && !Object.hasOwn(p, 'actionHistory')));
        assert.ok(scoped.log.every(e => e.audience === 'public' || e.audience === person.id));
        const slots = state.secrets[person.id].actionHistory.map(a => `${a.day}:${a.phase}:${a.round}`);
        assert.equal(new Set(slots).size, slots.length, 'duplicate action');
      }
      let action = { type: 'NEXT' };
      if (choices.length) {
        let selected;
        if (seed % 3 === 0) selected = game.ai.decide(view, () => 0.5);
        else if (seed % 3 === 1) selected = choices.find(a => ['explore', 'gather', 'discuss'].includes(a.kind) || a.kind === 'vote' && a.target === null) || choices.find(a => a.kind === 'rest');
        else selected = choices.find(a => ['sabotage', 'hide', 'heal', 'repair', 'investigate', 'share'].includes(a.kind)) || choices.find(a => ['explore', 'discuss'].includes(a.kind) || a.kind === 'vote' && a.target === null) || choices[0];
        action = { type: 'ACT', ...selected };
      }
      assert.equal(game.storage.save(state), true);
      const restored = game.storage.load(); assert.equal(restored.status, 'loaded');
      const next = game.state.transition(restored.state, action, timestamp);
      assert.equal(game.state.valid(next), true);
      assert.ok(Object.values(next.resources).every(n => Number.isInteger(n) && n >= 0));
      assert.ok(next.day <= 3 && next.day >= state.day);
      assert.equal(new Set(next.settledDays).size, next.settledDays.length);
      state = next; transitions++;
    }
    assert.ok(state.outcome, 'no ending');
    assert.throws(() => game.state.transition(state, { type: 'NEXT' }, timestamp));
    report.completed++; report.averageDay += state.day;
    report.wins[state.outcome.winner] = (report.wins[state.outcome.winner] || 0) + 1;
    report.exiles += state.log.filter(e => e.kind === 'exile').length;
    report.invalidDecisions += state.invalidDecisions;
    for (const m of state.statements) report.statementModes[m.mode] = (report.statementModes[m.mode] || 0) + 1;
    for (const person of state.players) {
      const mind = state.secrets[person.id];
      report.privateLies += mind.claimHistory.filter(c => c.intent === 'lie').length;
      report.falseAlibis += mind.claimHistory.filter(c => c.mode === 'lie').length;
      for (const d of mind.decisionHistory) if (d.strategy) report.strategies[d.strategy] = (report.strategies[d.strategy] || 0) + 1;
      const revised = mind.memory.filter(m => m.judgment === '직접 증거와 모순');
      report.verifiedContradictions += revised.length;
      if (revised.length && examples.length < 4) examples.push({ seed, observer: person.name, claim: revised[0], changes: mind.relationshipHistory.filter(r => r.target === revised[0].speakerId).slice(-5), replies: state.statements.filter(m => m.replyTo === revised[0].statementId) });
    }
    report.endings[state.outcome.code] = (report.endings[state.outcome.code] || 0) + 1;
    report.endingDays[state.day] = (report.endingDays[state.day] || 0) + 1;
    report.maxTransitions = Math.max(report.maxTransitions, transitions);
  } catch (error) { report.failures.push({ seed, transitions, message: error.message }); }
  if (seed % 50 === 0) console.log(`Completed ${seed}/${report.games} seeds; failures: ${report.failures.length}`);
}
report.averageDay = report.completed ? Number((report.averageDay / report.completed).toFixed(3)) : 0;
fs.writeFileSync(path.join(__dirname, '../docs/phase3-examples.json'), JSON.stringify(examples, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, '../docs/phase3-simulation-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;

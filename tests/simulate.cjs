const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, timestamp, storage } = require('./helpers.cjs');
const backing = storage(), game = setup(backing);
const report = { games: 300, seeds: '1–300', endings: {}, endingDays: {}, humanSaboteur: 0, humanSurvivor: 0, maxTransitions: 0, failures: [], policies: ['규칙 기반 선택', '탐험·보급·기권·휴식', '직업 능력 우선'] };
for (let seed = 1; seed <= report.games; seed++) {
  let state = game.state.create(timestamp, seed), transitions = 0;
  state.secrets.player.role === 'saboteur' ? report.humanSaboteur++ : report.humanSurvivor++;
  try {
    while (!state.outcome && transitions < 35) {
      const view = game.state.viewFor(state), choices = game.state.availableActions(view);
      for (const person of state.players) {
        const scoped = game.state.viewFor(state, person.id);
        assert.equal('secrets' in scoped, false);
        assert.ok(scoped.players.every(p => !Object.hasOwn(p, 'role') && !Object.hasOwn(p, 'actionHistory')));
        assert.ok(scoped.log.every(e => e.audience === 'public' || e.audience === person.id));
        const slots = state.secrets[person.id].actionHistory.map(a => `${a.day}:${a.phase}`);
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
    report.endings[state.outcome.code] = (report.endings[state.outcome.code] || 0) + 1;
    report.endingDays[state.day] = (report.endingDays[state.day] || 0) + 1;
    report.maxTransitions = Math.max(report.maxTransitions, transitions);
  } catch (error) { report.failures.push({ seed, transitions, message: error.message }); }
}
fs.writeFileSync(path.join(__dirname, '../docs/simulation-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;

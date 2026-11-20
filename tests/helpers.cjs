const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const timestamp = '2026-11-20T04:00:00.000Z';
function storage() { const data = {}; return { data, getItem(key) { return data[key] ?? null; }, setItem(key, value) { data[key] = value; } }; }
function setup(backing = storage()) {
  const context = vm.createContext({ localStorage: backing });
  for (const file of ['data', 'config', 'ai', 'state', 'storage']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + file + '.js'), 'utf8'), context);
  return context.IslandMystery;
}
function withRole(game, role, seed = 1) {
  const s = game.state.create(timestamp, seed);
  const other = s.players.find(p => s.secrets[p.id].role === role).id;
  [s.secrets.player.role, s.secrets[other].role] = [s.secrets[other].role, s.secrets.player.role];
  for (const p of s.players) s.secrets[p.id].secretGoal = game.config.roles[s.secrets[p.id].role].goal;
  return s;
}
function quietAI(game) { game.ai = { decide(view) { return view.phase === 'voting' ? { kind: 'vote', target: null } : view.phase === 'discussion' ? { kind: 'discuss' } : { kind: 'rest' }; } }; }
function act(game, state, action) { return game.state.transition(state, { type: 'ACT', ...action }, timestamp); }
function next(game, state) { return game.state.transition(state, { type: 'NEXT' }, timestamp); }
function completedNight(game, seed = 1) {
  const s = withRole(game, 'explorer', seed); s.phase = 'night'; s.resolved = true; s.acted = s.players.map(p => p.id); return s;
}
module.exports = { setup, storage, timestamp, withRole, quietAI, act, next, completedNight };

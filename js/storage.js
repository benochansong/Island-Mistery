(function (root) {
  'use strict';
  const game = root.IslandMystery;
  const KEY = 'island-mystery.save.v3';
  function load() {
    try {
      const raw = root.localStorage.getItem(KEY);
      if (!raw) {
        const legacy = root.localStorage.getItem('island-mystery.save.v2');
        if (legacy) { if (legacy.length > 1000000) return { status: 'invalid', state: null }; const state = game.state.migrate(JSON.parse(legacy)); return { status: state ? 'migrated' : 'invalid', state }; }
        return { status: root.localStorage.getItem('island-mystery.save.v1') ? 'legacy' : 'empty', state: null };
      }
      if (raw.length > 5000000) return { status: 'invalid', state: null };
      const state = JSON.parse(raw);
      return game.state.valid(state) ? { status: 'loaded', state } : { status: 'invalid', state: null };
    } catch (error) { return { status: error instanceof SyntaxError ? 'invalid' : 'unavailable', state: null }; }
  }
  function save(state) {
    if (!game.state.valid(state)) return false;
    try { root.localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
  }
  game.storage = Object.freeze({ load, save });
})(globalThis);

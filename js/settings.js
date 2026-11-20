(function (root) {
  'use strict';
  const key = 'island-mystery.settings.v1', listeners = new Set();
  const defaults = Object.freeze({ music: true, effects: true, master: .65, musicVolume: .45, effectsVolume: .6, reducedMotion: false, shake: false, textSpeed: 'normal', autoDialogue: false });
  function normalize(input) {
    const result = { ...defaults };
    if (!input || typeof input !== 'object') return result;
    for (const k of ['music','effects','reducedMotion','shake','autoDialogue']) if (typeof input[k] === 'boolean') result[k] = input[k];
    for (const k of ['master','musicVolume','effectsVolume']) if (Number.isFinite(input[k])) result[k] = Math.max(0, Math.min(1, input[k]));
    if (['instant','normal','slow'].includes(input.textSpeed)) result.textSpeed = input.textSpeed;
    return result;
  }
  let values, saved = true;
  try { values = normalize(JSON.parse(root.localStorage.getItem(key))); } catch { values = { ...defaults }; saved = false; }
  function update(patch) {
    values = normalize({ ...values, ...patch });
    try { root.localStorage.setItem(key, JSON.stringify(values)); saved = true; } catch { saved = false; }
    listeners.forEach(fn => fn({ ...values }));
    return saved;
  }
  root.IslandMystery.settings = Object.freeze({ defaults, normalize, get: () => ({ ...values }), update, reset: () => update(defaults), saved: () => saved, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } });
})(globalThis);

(function (root) {
  'use strict';
  const base = 'assets/';
  const tracks = ['menu','morning','afternoon','discussion','voting','night','survivors','saboteur','none'];
  const effects = ['click','map','explore','resource','clue','danger','unlock','dialogue','evidence','vote','result','exile','repair','damage','win','lose'];
  root.IslandMystery.assets = Object.freeze({
    images: { island: base + 'backgrounds/island-cinematic.jpg', portraits: base + 'characters/survivors-expressions.jpg', map: base + 'island.svg' },
    bgm: Object.fromEntries(tracks.map(id => [id, base + 'audio/bgm/' + id + '.wav'])),
    sfx: Object.fromEntries(effects.map(id => [id, base + 'audio/sfx/' + id + '.wav']))
  });
})(globalThis);

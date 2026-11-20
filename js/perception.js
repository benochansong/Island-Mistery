(function (root) {
  'use strict';
  const game = root.IslandMystery;
  function event(s, fields) {
    return { day: s.day, phase: s.phase, location: null, subjectId: null, speakerId: null, source: 'direct', direct: true, reliability: 1, updatedAt: s.updatedAt, ...fields };
  }
  function learn(s, observer, fields) { game.social.remember(s.secrets[observer], event(s, fields)); }
  function action(s, p, a, random) {
    if (['discussion', 'voting'].includes(s.phase)) return;
    const history = s.secrets[p.id].actionHistory.at(-1);
    const location = a.kind === 'sabotage' ? a.facility === 'radio' ? 'tower' : 'coast' : ['heal', 'investigate', 'hide'].includes(a.kind) ? 'camp' : p.location;
    history.location = location;
    const fact = { id: `fact-${s.sequence}-${s.facts.length}`, day: s.day, phase: s.phase, actorId: p.id, location, kind: a.kind };
    s.facts.push(fact);
    const text = `${game.discussion.slot(fact)}: ${p.name}의 위치는 ${game.discussion.place(location)}.`;
    learn(s, p.id, { id: fact.id + '-own', eventId: fact.id, kind: 'location', location, subjectId: p.id, text, source: 'own-action' });
    // Resource receipts and treatment are public outcomes. Covert actions never enter this path.
    if (['gather', 'repair', 'heal'].includes(a.kind)) for (const observer of s.players.filter(o => o.isAlive && !o.isExiled)) {
      learn(s, observer.id, { id: fact.id + '-help', eventId: fact.id, kind: a.kind === 'heal' ? 'healing' : 'cooperation', subjectId: p.id, relatedIds: [p.id, a.target].filter(Boolean), location, text: `${p.name}: ${a.kind === 'heal' ? '치료' : a.kind === 'repair' ? '시설 수리' : '물자 확보'}를 완료했다.`, source: 'public-receipt' });
    }
    // Later searches can uncover an authentic record, never a fabricated omniscient deduction.
    if (a.kind === 'explore' && s.day > 1 && ['lab', 'tower'].includes(location) && random() < .65) {
      const records = s.facts.filter(f => f.day < s.day && f.location === location && f.actorId !== p.id && !s.secrets[p.id].memory.some(m => m.eventId === f.id && m.direct));
      if (records.length) {
        const found = records[Math.floor(random() * records.length)], who = s.players.find(o => o.id === found.actorId);
        learn(s, p.id, { id: found.id + '-record-' + p.id, eventId: found.id, day: found.day, phase: found.phase, kind: 'location', location, subjectId: who.id, reliability: .96, source: 'access-record', text: `현장 출입 기록: ${game.discussion.slot(found)} ${who.name}, ${game.discussion.place(location)}.` });
      }
    }
  }
  function observe(s, random) {
    if (['discussion', 'voting'].includes(s.phase)) return;
    const facts = s.facts.filter(f => f.day === s.day && f.phase === s.phase);
    for (const observer of s.players.filter(p => p.isAlive && !p.isExiled)) {
      const own = facts.find(f => f.actorId === observer.id);
      if (!own) continue;
      for (const f of facts.filter(f => f.actorId !== observer.id && f.location === own.location)) {
        const id = f.id + '-witness-' + observer.id;
        if (s.secrets[observer.id].memory.some(m => m.id === id)) continue;
        if (random() > game.config.observationChance[s.day] + s.secrets[observer.id].traits.caution * .1) continue;
        const who = s.players.find(p => p.id === f.actorId);
        learn(s, observer.id, { id, eventId: f.id, kind: 'location', location: f.location, subjectId: f.actorId, text: `직접 목격: ${game.discussion.slot(f)} ${who.name}, ${game.discussion.place(f.location)}.` });
        if (['hide', 'sabotage'].includes(f.kind) && random() < .35) learn(s, observer.id, { id: id + '-act', eventId: f.id, kind: 'betrayal', subjectId: f.actorId, location: f.location, text: `${who.name}이 ${f.kind === 'hide' ? '공동 물자를 숨기는' : '시설을 훼손하는'} 행동을 직접 보았다.` });
      }
      for (const f of facts.filter(f => ['hide', 'sabotage'].includes(f.kind))) {
        learn(s, observer.id, { id: f.id + '-damage', eventId: f.id, kind: 'damage', location: f.location, subjectId: null, source: 'public-damage', text: `${game.discussion.place(f.location)}에서 ${f.kind === 'hide' ? '물자 손실' : '시설 손상'}이 확인됐다. 원인은 미상이다.` });
      }
    }
  }
  game.perception = Object.freeze({ event, learn, action, observe });
})(globalThis);

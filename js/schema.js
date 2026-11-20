(function (root) {
  'use strict';
  const game = root.IslandMystery, ids = game.data.survivors.map(p => p.id), phases = game.config.phases;
  const text = (v, max = 2000) => typeof v === 'string' && v.length <= max;
  const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const unit = v => Number.isFinite(v) && v >= 0 && v <= 1;
  const person = id => id === null || ids.includes(id);
  const location = id => id === null || ['camp', ...game.data.locations.map(p => p.id)].includes(id);
  const list = (v, max, check) => Array.isArray(v) && v.length <= max && v.every(check);
  const unique = list => new Set(list.map(v => v.id)).size === list.length;
  const time = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
  const slot = v => int(v.day, 1, 3) && phases.includes(v.phase);
  const relation = v => v && int(v.trust, 0, 100) && int(v.suspicion, 0, 100);
  function valid(s) {
    try {
      if (!Object.hasOwn(game.config.difficulty, s.difficulty) || !int(s.discussionRound, 0, 4) || !int(s.invalidDecisions, 0, 1000)) return false;
      if (!list(s.facts, 100, f => text(f.id, 100) && slot(f) && ids.includes(f.actorId) && location(f.location) && f.location !== null && text(f.kind, 30)) || !unique(s.facts)) return false;
      if (!list(s.statements, 100, f => text(f.id, 100) && int(f.day, 1, 3) && int(f.round, 0, 4) && ids.includes(f.speakerId) && person(f.target) && text(f.mode, 30) && text(f.text) && (f.replyTo === null || text(f.replyTo, 100)) && int(f.aboutDay, 1, 3) && phases.includes(f.aboutPhase)) || !unique(s.statements)) return false;
      for (const id of ids) {
        const m = s.secrets[id];
        if (m.difficulty !== s.difficulty || !text(m.personalGoal) || !Object.keys(game.config.personalities[id]).every(k => unit(m.traits[k]))) return false;
        if (!list(m.memory, 1500, e => text(e.id, 150) && text(e.eventId, 150) && slot(e) && location(e.location) && person(e.subjectId) && person(e.speakerId) && text(e.kind, 30) && text(e.text) && text(e.source, 100) && typeof e.direct === 'boolean' && unit(e.reliability) && time(e.updatedAt) && text(e.judgment, 100) && list(e.relatedIds, 6, v => ids.includes(v)) && list(e.revisions, 10, r => text(r.from, 100) && text(r.to, 100) && text(r.evidenceId, 150) && time(r.updatedAt))) || !unique(m.memory)) return false;
        if (!list(m.appliedEffects, 2000, k => text(k, 250)) || new Set(m.appliedEffects).size !== m.appliedEffects.length) return false;
        if (!list(m.relationshipHistory, 2000, r => text(r.eventId, 150) && slot(r) && ids.includes(r.target) && text(r.reason) && relation(r.before) && relation(r.after))) return false;
        if (!list(m.claimHistory, 20, c => text(c.statementId, 100) && text(c.mode, 30) && ['fact', 'guess', 'hearsay', 'lie', 'withheld'].includes(c.intent) && text(c.reason) && (c.evidenceId === null || text(c.evidenceId, 150)) && (c.replyTo === null || text(c.replyTo, 100)))) return false;
        if (!list(m.decisionHistory, 40, d => slot(d) && int(d.round, 0, 4) && text(d.kind, 30) && text(d.reason) && (d.strategy === null || text(d.strategy, 30)))) return false;
        if (!m.actionHistory.every(a => text(a.id, 100) && location(a.location) && (a.round === null || int(a.round, 0, 4))) || !unique(m.actionHistory)) return false;
      }
      return true;
    } catch { return false; }
  }
  game.schema = Object.freeze({ valid });
})(globalThis);

(function (root) {
  'use strict';
  const game = root.IslandMystery;
  const B = game.config.social;
  const clamp = n => Math.max(0, Math.min(100, n));
  function adjust(mind, target, trust, suspicion, reason, event, key) {
    if (!Object.hasOwn(mind.trust, target) || mind.appliedEffects.includes(key)) return;
    mind.appliedEffects.push(key);
    const before = { trust: mind.trust[target], suspicion: mind.suspicion[target] };
    const p = mind.traits;
    mind.trust[target] = clamp(Math.round(before.trust + trust * (0.55 + p.emotional * 0.65 + p.cooperation * 0.2)));
    mind.suspicion[target] = clamp(Math.round(before.suspicion + suspicion * (0.6 + p.logic * 0.5) * game.config.difficulty[mind.difficulty].evidence));
    mind.relationshipHistory.push({ day: event.day, phase: event.phase, target, reason, before, after: { trust: mind.trust[target], suspicion: mind.suspicion[target] } });
  }
  function reconcile(mind, current) {
    const memories = mind.memory;
    const sameTime = (a, b) => a.day === b.day && a.phase === b.phase;
    // One action per phase makes day + phase an exact, verifiable time slot.
    for (const claim of memories.filter(m => m.kind === 'claim' && m.location)) {
      const evidence = memories.find(m => m.kind === 'location' && m.subjectId === claim.subjectId && sameTime(m, claim) && m.source !== 'reported' && m.reliability >= 0.85 && m.location !== claim.location);
      const otherClaim = memories.find(m => m.id !== claim.id && m.kind === 'claim' && m.subjectId === claim.subjectId && sameTime(m, claim) && m.location !== claim.location);
      if (evidence) {
        const key = `lie:${claim.speakerId}:${claim.subjectId}:${claim.day}:${claim.phase}:${claim.location}`;
        adjust(mind, claim.speakerId, B.lieTrust, B.contradiction, '같은 시간대의 직접 목격과 발언이 모순됨', current, key);
        if (claim.judgment !== '직접 증거와 모순') {
          claim.revisions.push({ day: current.day, phase: current.phase, from: claim.judgment, to: '직접 증거와 모순', evidenceId: evidence.id });
          claim.judgment = '직접 증거와 모순';
        }
      } else if (otherClaim && claim.judgment === '미검증 주장') {
        claim.revisions.push({ day: current.day, phase: current.phase, from: claim.judgment, to: '증언 충돌 · 판단 유보', evidenceId: otherClaim.id });
        claim.judgment = '증언 충돌 · 판단 유보';
      }
    }
    for (const damage of memories.filter(m => m.kind === 'damage')) {
      for (const location of memories.filter(m => m.kind === 'location' && sameTime(m, damage) && m.source !== 'reported' && m.reliability >= 0.85 && m.location !== damage.location)) {
        adjust(mind, location.subjectId, 0, B.alibi, '손상 시점에 다른 장소에서 직접 목격한 알리바이', current, `alibi:${damage.id}:${location.subjectId}`);
      }
    }
  }
  function remember(mind, event) {
    if (mind.memory.some(item => item.id === event.id)) return;
    const memory = { ...event, relatedIds: event.relatedIds || [event.subjectId].filter(Boolean),
      judgment: event.kind === 'claim' ? '미검증 주장' : event.source === 'reported' ? '전달받은 정보' : '직접 관찰', revisions: [] };
    mind.memory.push(memory);
    if (event.kind === 'aid') adjust(mind, event.subjectId, event.amount, 0, event.text, event, 'aid:' + event.id);
    if (event.kind === 'trace') adjust(mind, event.subjectId, event.source === 'direct' ? B.betrayal / 3 : -3, B.damageClue * event.reliability, '현장 관련 단서 · 정체 확정 아님', event, 'trace:' + event.id);
    if (event.kind === 'accusation') {
      const weight = event.reliability * (0.4 + mind.traits.emotional) * (event.supported ? 7 : 2);
      adjust(mind, event.subjectId, 0, weight, '다른 생존자의 의혹을 들음', event, `accusation:${event.speakerId}:${event.subjectId}:${event.day}`);
      if (!event.supported && mind.traits.logic > 0.7) adjust(mind, event.speakerId, -3, B.accusation, '근거 없는 고발을 경계함', event, `unsupported:${event.speakerId}:${event.day}`);
    }
    reconcile(mind, memory);
  }
  function voteScores(view) {
    const mind = view.self;
    return view.players.filter(p => p.isAlive && !p.isExiled && p.id !== mind.id).map(person => {
      const evidence = mind.memory.filter(m => m.subjectId === person.id && m.kind === 'trace').reduce((sum, m) => sum + m.reliability * 8, 0);
      const contradictions = mind.memory.filter(m => m.speakerId === person.id && m.judgment === '직접 증거와 모순').length;
      const testimony = mind.memory.filter(m => m.kind === 'accusation' && m.subjectId === person.id).reduce((sum, m) => sum + m.reliability, 0);
      const relationship = (50 - mind.trust[person.id]) * (0.15 + mind.traits.emotional * 0.35);
      const goalBias = mind.role === 'saboteur' && person.health > 65 ? 3 : 0;
      const score = mind.suspicion[person.id] + evidence * mind.traits.logic + contradictions * 8 + testimony * mind.traits.emotional + relationship + goalBias;
      return { id: person.id, score, reason: contradictions ? '직접 관찰과 발언의 모순' : evidence ? '현장 관련 단서' : testimony ? '다른 사람의 증언과 관계' : '관계와 현재 의심 수준' };
    }).sort((a, b) => b.score - a.score);
  }
  function strategy(view) {
    const s = view.self;
    const accusations = view.statements.filter(m => m.mode === 'accuse' && m.target === s.id).length;
    const progress = Math.max(view.facilities.radio / game.config.repairGoals.radio, view.facilities.boat / game.config.repairGoals.boat);
    if (accusations > 1) return { id: 'infiltrate', reason: '공개적으로 의심받아 협력으로 신뢰를 회복한다.' };
    if (progress >= 0.6) return { id: 'destroy', reason: '공개 수리도가 높아 탈출 시설을 우선 훼손한다.' };
    if (view.phase === 'night') return { id: 'cover', reason: '낮의 협력 기록을 남기고 밤에 물자를 줄인다.' };
    if (view.phase === 'discussion' && view.day > 1 && s.memory.some(m => m.kind === 'aid' && m.subjectId !== s.id)) return { id: 'divide', reason: '관찰한 협력 관계에 불확실한 의혹을 제기한다.' };
    if (view.phase === 'discussion' && s.actionHistory.some(a => ['hide', 'sabotage'].includes(a.kind))) return { id: 'misinform', reason: '자신의 방해 동선을 숨기기 위해 다른 장소를 주장한다.' };
    return { id: 'infiltrate', reason: '초반에는 실제 자원 확보로 생존자처럼 행동한다.' };
  }
  game.social = Object.freeze({ remember, adjust, voteScores, strategy });
})(globalThis);

(function (root) {
  'use strict';
  const game = root.IslandMystery, C = game.config;
  const copy = value => JSON.parse(JSON.stringify(value));
  const clamp = value => Math.max(0, Math.min(100, Math.round(value)));
  function initialize(id, difficulty = C.defaultDifficulty) {
    return { traits: { ...C.personalities[id] }, difficulty, memory: [], appliedEffects: [], relationshipHistory: [], claimHistory: [], decisionHistory: [],
      personalGoal: id === 'ji' ? '불필요한 정보 공개를 피하며 생존하기' : id === 'do' ? '집단의 판단을 이끌기' : id === 'min' ? '자신을 도운 동료와 살아남기' : id === 'ha' ? '가능한 많은 동료 지키기' : '근거를 확인하며 살아남기' };
  }
  function adjust(mind, target, trustDelta, suspicionDelta, reason, event, key) {
    if (!Object.hasOwn(mind.trust, target) || mind.appliedEffects.includes(key)) return;
    mind.appliedEffects.push(key);
    const before = { trust: mind.trust[target], suspicion: mind.suspicion[target] }, p = mind.traits;
    const trustWeight = (0.6 + p.emotionalSensitivity * 0.65) * (1 - p.caution * 0.15);
    const evidenceWeight = (0.6 + p.logicalThinking * 0.65) * (1 - p.cooperation * 0.15) * C.difficulty[mind.difficulty].evidenceWeight;
    mind.trust[target] = clamp(before.trust + trustDelta * trustWeight);
    mind.suspicion[target] = clamp(before.suspicion + suspicionDelta * evidenceWeight);
    mind.relationshipHistory.push({ eventId: event.eventId || event.id, day: event.day, phase: event.phase, target, reason, before, after: { trust: mind.trust[target], suspicion: mind.suspicion[target] } });
  }
  function apply(mind, target, rule, reason, event, key, scale = 1) {
    const [trust, suspicion] = C.relationships[rule];
    adjust(mind, target, trust * scale, suspicion * scale, reason, event, key);
  }
  function reconcile(mind, current) {
    const sameSlot = (a, b) => a.day === b.day && a.phase === b.phase && a.subjectId === b.subjectId;
    for (const claim of mind.memory.filter(m => m.kind === 'claim' && m.location && sameSlot(m, current))) {
      const direct = mind.memory.find(m => m.kind === 'location' && sameSlot(m, claim) && m.direct && m.reliability >= C.difficulty[mind.difficulty].contradictionThreshold);
      const conflict = mind.memory.find(m => m.kind === 'claim' && m.id !== claim.id && sameSlot(m, claim) && m.location !== claim.location);
      let judgment = claim.judgment, evidence = null;
      if (direct && direct.location !== claim.location) {
        judgment = '직접 증거와 모순'; evidence = direct;
        apply(mind, claim.speakerId, 'verifiedLie', '같은 시점의 직접 목격과 발언이 모순됨', current, `lie:${claim.speakerId}:${claim.subjectId}:${claim.day}:${claim.phase}:${claim.location}`);
      } else if (direct && direct.location === claim.location) { judgment = '직접 목격과 일치'; evidence = direct; }
      else if (conflict && claim.judgment === '미검증 주장') { judgment = '증언 충돌 · 판단 유보'; evidence = conflict; }
      if (judgment !== claim.judgment) {
        claim.revisions.push({ from: claim.judgment, to: judgment, evidenceId: evidence.id, updatedAt: current.updatedAt });
        claim.judgment = judgment; claim.updatedAt = current.updatedAt;
      }
    }
    // A matching time window is essential: yesterday's location is not tonight's alibi.
    for (const damage of mind.memory.filter(m => m.kind === 'damage' && m.day === current.day && m.phase === current.phase)) {
      for (const sighting of mind.memory.filter(m => m.kind === 'location' && m.direct && m.reliability >= 0.9 && m.day === damage.day && m.phase === damage.phase && m.location !== damage.location)) {
        apply(mind, sighting.subjectId, 'alibi', '손상 시점에 다른 장소에서 직접 목격함', current, `alibi:${damage.eventId}:${sighting.subjectId}`);
      }
    }
  }
  function remember(mind, event) {
    if (mind.memory.some(m => m.id === event.id)) return;
    const item = { ...copy(event), relatedIds: event.relatedIds || [event.subjectId].filter(Boolean),
      judgment: event.kind === 'claim' ? '미검증 주장' : event.direct ? '직접 관찰' : '전달받은 정보', revisions: [] };
    mind.memory.push(item);
    const key = event.eventId || event.id;
    if (['cooperation', 'sharing', 'healing'].includes(event.kind)) apply(mind, event.subjectId, event.kind, event.text, event, `${event.kind}:${key}`, event.reliability);
    if (event.kind === 'trace') apply(mind, event.subjectId, 'suspicious', '현장 단서 · 정체를 확정하지 않음', event, `trace:${key}:${event.subjectId}`, event.reliability);
    if (event.kind === 'betrayal') apply(mind, event.subjectId, 'betrayal', '훼손 행위를 직접 목격함', event, `betrayal:${key}`, event.reliability);
    if (event.kind === 'accusation') {
      const amount = event.reliability * (event.supported ? 6 : 2) * (0.4 + mind.traits.emotionalSensitivity);
      adjust(mind, event.subjectId, 0, amount, '의혹 제기를 들음 · 아직 추측', event, `accuse:${event.speakerId}:${event.subjectId}:${event.day}`);
      if (!Object.hasOwn(mind.trust, event.subjectId)) adjust(mind, event.speakerId, -8 * mind.traits.emotionalSensitivity, 3 * mind.traits.emotionalSensitivity, '나를 의심한 발언에 반감', event, `attacked:${event.speakerId}:${event.day}`);
      if (!event.supported && mind.traits.logicalThinking > 0.7) adjust(mind, event.speakerId, -3, 3, '근거 없는 고발을 경계함', event, `unsupported:${event.speakerId}:${event.day}`);
    }
    if (event.kind === 'defense' && !Object.hasOwn(mind.trust, event.subjectId)) adjust(mind, event.speakerId, 6, 0, '나를 변호해 준 발언', event, `defended:${event.speakerId}:${event.day}`);
    if (['claim', 'location', 'damage'].includes(item.kind)) reconcile(mind, item);
  }
  function voteScores(view) {
    const mind = view.self, p = mind.traits;
    return view.players.filter(other => other.isAlive && !other.isExiled && other.id !== mind.id).map(other => {
      const difficulty = C.difficulty[mind.difficulty], R = C.reasoning;
      const memory = mind.memory.filter(m => m.day > view.day - difficulty.memoryDays);
      const traces = memory.filter(m => ['trace', 'betrayal'].includes(m.kind) && m.subjectId === other.id);
      const strength = m => m.reliability * (m.kind === 'betrayal' ? R.betrayalWeight : R.traceWeight);
      const unique = [...new Map(traces.slice().sort((a, b) => strength(a) - strength(b)).map(m => [m.eventId, m])).values()];
      const evidence = Math.min(R.evidenceCap, unique.reduce((sum, m) => sum + strength(m), 0));
      const contradictions = new Set(memory.filter(m => m.speakerId === other.id && m.judgment === '직접 증거와 모순').map(m => `${m.subjectId}:${m.day}:${m.phase}`)).size;
      const testimony = new Set(memory.filter(m => m.kind === 'accusation' && m.subjectId === other.id).map(m => m.speakerId)).size;
      const relationship = (50 - mind.trust[other.id]) * (0.12 + p.emotionalSensitivity * 0.25) * difficulty.relationshipWeight;
      const goalBias = mind.role === 'saboteur' && view.statements.some(m => m.speakerId === other.id && m.target === mind.id && m.mode === 'accuse') ? 5 : 0;
      const rawScore = mind.suspicion[other.id] + evidence * p.logicalThinking * difficulty.evidenceWeight + Math.min(R.contradictionCap, contradictions * R.contradictionWeight) + testimony * p.emotionalSensitivity + relationship + goalBias;
      const directProof = unique.some(m => m.kind === 'betrayal' && m.direct && m.reliability >= .95);
      const score = Math.max(rawScore, directProof && difficulty.planning > 1 ? R.directProofFloor : 0);
      return { id: other.id, score, evidence, contradictions, reason: contradictions ? '동일 시점의 직접 목격과 발언 모순' : evidence ? '현장과 관련된 단서' : testimony ? '여러 사람의 의혹 제기와 관계' : '현재 관계와 의심 수준', supported: evidence > 0 || contradictions > 0 };
    }).sort((a, b) => b.score - a.score);
  }
  function chooseVote(view, random) {
    const scores = voteScores(view), p = view.self.traits;
    const threshold = C.reasoning.voteThreshold + p.caution * C.reasoning.cautionWeight - p.aggression * C.reasoning.aggressionWeight;
    const candidates = scores.filter(s => s.supported && s.score >= threshold);
    if (!candidates.length) return { target: null, reason: '추방할 만큼 충분한 근거가 없음', scores };
    const best = candidates.map(s => ({ ...s, tie: s.score + random() * C.difficulty[view.self.difficulty].judgmentError })).sort((a, b) => b.tie - a.tie)[0];
    return { target: best.id, reason: best.reason, scores };
  }
  function strategy(view) {
    const self = view.self;
    const pressure = view.statements.filter(m => m.target === self.id && ['accuse', 'question', 'rebut'].includes(m.mode)).length;
    const progress = Math.max(view.facilities.radio / C.repairGoals.radio, view.facilities.boat / C.repairGoals.boat);
    // Public supplies and active seats can complete an escape in one round, even below 65%.
    const helpers=view.players.filter(p=>p.id!==self.id&&p.isAlive&&!p.isExiled).length;
    const imminent=Object.entries(C.repairGoals).some(([key,goal])=>view.facilities[key]>0&&view.facilities[key]+Math.min(view.resources.parts,helpers*2)>=goal);
    if (view.phase !== 'discussion' && (imminent || progress >= C.strategy.urgentProgress || view.day === C.maxDays && C.difficulty[self.difficulty].planning > 1)) return { id: 'betray', reason: '공개 수리 진척·남은 부품으로 탈출이 임박했거나 마지막 날 · 방해 우선' };
    if (self.difficulty === 'easy' && view.phase !== 'discussion') return { id: view.phase === 'night' ? 'disrupt' : 'cooperate', reason: '단순 전략 · 낮에 협력하고 밤에 방해함' };
    if (view.phase === 'discussion' && view.discussionRound === 1 && view.day > 1 && self.memory.some(m => ['healing', 'sharing'].includes(m.kind) && m.subjectId !== self.id)) return { id: 'divide', reason: '직접 들은 공유·치료 관계에 의혹을 제기해 관심을 분산함' };
    if (pressure >= 2) return { id: 'alibi', reason: '공개 질문이 집중되어 실제 협력 이력으로 해명함' };
    if (view.phase === 'discussion' && self.actionHistory.some(a => ['hide', 'sabotage'].includes(a.kind))) return { id: 'misinform', reason: '자신의 방해 동선을 숨기는 알리바이가 필요함' };
    if (view.phase === 'discussion' && view.day > 1 && self.memory.some(m => m.kind === 'healing' || m.kind === 'sharing')) return { id: 'divide', reason: '목격한 협력 관계에 의혹을 제기하여 분열을 유도함' };
    if (view.phase === 'night') return { id: 'disrupt', reason: '낮의 협력 뒤 밤에 물자 또는 시설을 방해함' };
    return { id: 'cooperate', reason: '실제로 물자를 확보하거나 치료해 신뢰를 쌓음' };
  }
  game.social = Object.freeze({ initialize, remember, adjust, voteScores, chooseVote, strategy });
})(globalThis);

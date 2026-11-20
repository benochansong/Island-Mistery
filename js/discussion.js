(function (root) {
  'use strict';
  const game = root.IslandMystery, C = game.config;
  const place = id => id === 'camp' ? '야영지' : game.data.locations.find(p => p.id === id)?.name || '미확인 장소';
  const slot = item => `${item.day}일차 ${C.phaseNames[item.phase]}`;
  const name = id => game.data.survivors.find(p => p.id === id)?.name || '누군가';
  function actions(view) {
    const p = view.self, result = [], add = (mode, label, fields = {}) => result.push({ kind: mode, label, ...fields });
    const histories = p.actionHistory.filter(a => a.location && !['discussion', 'voting'].includes(a.phase));
    for (const a of histories.slice(-3)) {
      add('truth', `사실: ${slot(a)} ${place(a.location)}`, { historyId: a.id });
      add('explain', `내 동선 해명: ${slot(a)}`, { historyId: a.id });
      for (const location of ['camp', 'coast', 'lab', 'tower'].filter(l => l !== a.location)) add('lie', `거짓 알리바이: ${slot(a)} ${place(location)}`, { historyId: a.id, location });
    }
    p.information.filter(c => !c.shared).slice(-5).forEach(c => add('share', '단서 공개: ' + c.text, { clueId: c.id }));
    p.memory.filter(m => ['location', 'trace', 'betrayal'].includes(m.kind) && m.direct && !p.claimHistory.some(c => c.evidenceId === m.id)).slice(-5).forEach(m => add('evidence', '목격 기록 공개: ' + m.text, { memoryId: m.id }));
    p.memory.filter(m => m.kind === 'claim' && m.speakerId !== p.id && m.judgment === '직접 증거와 모순' && !p.claimHistory.some(c => c.replyTo === m.statementId && c.mode === 'rebut')).slice(-3).forEach(m => add('rebut', `${name(m.speakerId)}의 발언 반박: ${slot(m)}`, { statementId: m.statementId, memoryId: m.revisions.at(-1).evidenceId, target: m.speakerId }));
    const current = view.statements.filter(m => m.day === view.day);
    view.players.filter(o => o.isAlive && !o.isExiled && o.id !== p.id).forEach(o => {
      add('accuse', o.name + '에게 의혹 제기', { target: o.id });
      add('speculate', o.name + '에 대한 추측 밝히기', { target: o.id });
      add('question', o.name + '에게 오늘 아침 동선 질문', { target: o.id });
      add('defend', o.name + ' 변호 · 판단 유보 요청', { target: o.id });
      if (p.role === 'saboteur') add('redirect', o.name + '에게 의심 돌리기', { target: o.id });
    });
    current.filter(m => m.speakerId !== p.id && ['accuse', 'speculate'].includes(m.mode)).slice(-3).forEach(m => add('agree', `${name(m.speakerId)}의 의혹에 동의`, { statementId: m.id, target: m.target }));
    if (histories.length) add('partial', '일부 사실만 공개 (가장 최근 동선)', { historyId: histories.at(-1).id });
    add('conceal', '개인 정보 공개 보류');
    if (p.role === 'saboteur') add('feign', '협력 의사 표현 · 속내 숨기기');
    add('discuss', '물자 상황 공유 · 판단 유보');
    return result;
  }
  function speak(s, p, action, record, random) {
    const mind = s.secrets[p.id], mode = action.kind;
    const own = mind.actionHistory.find(a => a.id === action.historyId);
    const evidence = action.memoryId ? mind.memory.find(m => m.id === action.memoryId) : null;
    const clue = action.clueId ? mind.information.find(c => c.id === action.clueId) : null;
    const prior = s.statements.find(m => m.id === action.statementId);
    const question = s.statements.slice().reverse().find(m => m.mode === 'question' && m.target === p.id && own && m.aboutDay === own.day && m.aboutPhase === own.phase);
    const ranked = game.social.voteScores(game.state.viewFor(s, p.id, true)).find(r => r.id === action.target);
    const evidenceKey=clue?.id||evidence?.eventId||evidence?.id,metrics=s.progress?.players[p.id];
    if(metrics&&evidenceKey&&['share','evidence','rebut'].includes(mode)&&!metrics.evidenceIds.includes(evidenceKey)){metrics.evidenceIds.push(evidenceKey);metrics.evidence++;metrics.supports++;}
    const suspicions=Object.fromEntries(s.players.filter(o=>o.id!==p.id&&o.id!==action.target).map(o=>[o.id,s.secrets[o.id].suspicion[action.target]]));
    let intent = mode, content, claim = null, replyTo = prior?.id || null;
    const slots = { target: name(action.target), reason: ranked?.reason || '아직 검증되지 않은 개인적인 의문', food: s.resources.food, water: s.resources.water };
    if (own) {
      slots.slot = slot(own); slots.place = place(mode === 'lie' ? action.location : own.location);
      claim = { day: own.day, phase: own.phase, location: mode === 'lie' ? action.location : own.location, subjectId: p.id };
      if (mode === 'explain') { intent = 'defend'; replyTo = question?.id || null; }
      if (mode === 'partial') intent = 'truth';
    }
    if (mode === 'question') slots.slot = `${s.day}일차 ${C.phaseNames.morning}`;
    if (clue) { clue.shared = true; slots.evidence = clue.text; }
    if (evidence) { slots.evidence = evidence.text; if (mode === 'evidence') intent = 'share'; }
    if (mode === 'discuss') intent = s.discussionRound === 4 ? 'reserve' : 'survival';
    if (mode === 'defend') content = `${name(action.target)}을 아직 단정하지 맙시다. 의혹과 입증은 다릅니다.`;
    if (mode === 'redirect') { intent = 'speculate'; }
    if (mode === 'feign') content = '살아남기 위해 협력하겠습니다. 지금은 탈출 준비에 집중합시다.';
    if (mode === 'agree') content = `${name(prior.speakerId)}의 발언 #${prior.id}에 동의합니다. ${name(action.target)}의 설명을 더 듣고 싶습니다.`;
    content ||= game.dialogue.render(intent, slots, random);
    if (mode === 'partial') content += ' 이 기록만 먼저 공개하겠습니다.';
    if (replyTo) content = `발언 #${replyTo}에 답합니다. ` + content;
    const entry = record(s, `${p.name}: “${content}”`, p.id, 'public', 'discussion');
    const statement = { id: 'statement-' + entry.id, day: s.day, round: s.discussionRound, speakerId: p.id, mode: ['truth', 'lie', 'partial'].includes(mode) ? 'claim' : mode === 'feign' ? 'cooperate' : mode === 'redirect' ? 'speculate' : mode, target: action.target || null, text: content, replyTo, aboutDay: claim?.day || s.day, aboutLocation: claim?.location || null, aboutPhase: claim?.phase || 'morning' };
    s.statements.push(statement);
    mind.claimHistory.push({ statementId: statement.id, mode, intent: ['lie', 'feign'].includes(mode) ? 'lie' : evidence && !evidence.direct || clue ? 'hearsay' : ['conceal', 'partial'].includes(mode) ? 'withheld' : ['accuse', 'speculate', 'redirect', 'agree'].includes(mode) ? 'guess' : 'fact', reason: mode === 'lie' ? '자신의 실제 동선과 다른 장소를 의도적으로 주장' : mode === 'feign' ? '협력 의사로 신뢰를 얻으려 함' : '선택한 정보와 판단을 표현', evidenceId: evidence?.id || null, replyTo });
    const base = { id: statement.id, eventId: statement.id, statementId: statement.id, day: s.day, phase: 'discussion', location: null, subjectId: action.target || p.id, speakerId: p.id, text: content, source: 'public-statement', direct: false, reliability: 0.5, updatedAt: s.updatedAt, kind: 'statement' };
    for (const listener of s.players.filter(o => o.isAlive && !o.isExiled)) {
      const targetMind = s.secrets[listener.id], reliability = listener.id === p.id ? 1 : Math.max(.15, targetMind.trust[p.id] / 100);
      let event = { ...base, reliability };
      if (claim) event = { ...event, ...claim, kind: 'claim' };
      else if (['accuse', 'speculate', 'redirect', 'agree'].includes(mode)) {
        // Listeners evaluate their own evidence, never the speaker's private score.
        const supported = targetMind.memory.some(m => m.subjectId === action.target && ['trace', 'betrayal'].includes(m.kind)) || targetMind.memory.some(m => m.speakerId === action.target && m.judgment === '직접 증거와 모순');
        event = { ...event, kind: 'accusation', supported };
      }
      else if (mode === 'defend') event.kind = 'defense';
      game.social.remember(targetMind, event);
      if(mind.role==='saboteur'&&mode==='redirect'&&action.target!==p.id&&s.secrets[action.target]?.role!=='saboteur'&&!event.supported&&targetMind.suspicion[action.target]>suspicions[listener.id])game.progression?.add(s,p.id,'manipulations');
      if (evidence || clue) {
        const known = evidence || mind.memory.find(m => m.id === clue.memoryId);
        if (known && listener.id !== p.id) game.social.remember(targetMind, { ...known, id: statement.id + '-evidence', eventId: known.eventId, speakerId: p.id, source: `testimony:${p.id}`, direct: false, reliability: Math.min(known.reliability, reliability), updatedAt: s.updatedAt });
        game.social.remember(targetMind, { ...base, id: statement.id + '-sharing', kind: 'sharing', subjectId: p.id, reliability });
      }
    }
  }
  game.discussion = Object.freeze({ actions, speak, place, slot });
})(globalThis);

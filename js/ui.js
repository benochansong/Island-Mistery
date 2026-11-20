(function (root) {
  'use strict';
  const game = root.IslandMystery, C = game.config;
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const dateLabel = date => new Date(date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  let actions = [];
  function guidance(view) {
    const self = view.self, demand = view.players.filter(p => p.isAlive && !p.isExiled).length;
    const notes = [];
    if(view.challenge&&view.challenge.id!=='classic'){const mode=game.challenges.modes.find(m=>m.id===view.challenge.id);notes.push(`${mode.name}: ${mode.description}${view.challenge.id==='broken'?' 남은 통신탑 추가 손상: '+view.challenge.radioDebt:''}`);}
    if (view.pendingEvent) notes.push('사건 선택을 완료하면 다음 행동이 열립니다.');
    if (view.resources.food < demand || view.resources.water < demand) notes.push(`오늘 밤 ${demand}명분이 필요합니다. 식량 부족 ${Math.max(0, demand-view.resources.food)}, 식수 부족 ${Math.max(0, demand-view.resources.water)} — 부족하면 모두의 체력이 감소합니다.`);
    if (view.phase === 'night') notes.push(C.roles[self.role].description + ' 행동 후 정산은 하루에 한 번 적용됩니다.');
    if (['afternoon','night'].includes(view.phase)) {
      const cost = C.mechanics.repair[self.role === 'engineer' ? 'engineer' : 'other'].cost;
      if (view.resources.parts < cost) notes.push(`수리 불가: 부품 ${cost}개 필요 (현재 ${view.resources.parts}).`);
      if (view.resources.medicine < C.mechanics.medicineCost) notes.push(`치료 불가: 의약품 ${C.mechanics.medicineCost}개가 필요합니다. 휴식으로 체력을 회복할 수 있습니다.`);
    }
    if (self.information.some(c => !c.shared)) notes.push('미공개 단서가 있습니다. 토론의 「사실과 단서」에서 공유할 수 있습니다. 전달받은 주장은 직접 증거와 구분하세요.');
    if (view.closedLocations?.[view.selectedLocation] > view.day) notes.push('선택한 지역이 임시 폐쇄되었습니다. 다른 지역을 선택하거나 연구 기록 조사를 이용하세요.');
    if (view.phase === 'voting') {
      const proof = self.memory.filter(m => ['trace','betrayal'].includes(m.kind) || m.judgment === '직접 증거와 모순').slice(-5);
      notes.push(proof.length ? '투표 전 확인: ' + proof.map(m => `${m.text} (${m.direct ? '직접' : '전달'}, ${Math.round(m.reliability*100)}%)`).join(' / ') : '아직 추방을 뒷받침하는 주요 증거가 없습니다. 기권할 수 있으며, 단순한 불신은 유죄의 증거가 아닙니다.');
    }
    $('context-help').innerHTML = notes.length ? '<details open><summary>현재 상황 도움말</summary>' + notes.map(n => '<p>' + escape(n) + '</p>').join('') + '</details>' : '';
  }
  function renderResults(view) {
    const list = view.lastResults, compact = game.settings?.get().compactResults;
    $('turn-results').innerHTML = !list.length ? '<p class="muted">지도에서 첫 탐험 지역을 선택하세요.</p>' : compact && list.length > 4 ? `<ol class="result-list">${entries(list.slice(0,4))}</ol><details><summary>나머지 ${list.length-4}개 결과 펼치기</summary><ol class="result-list">${entries(list.slice(4))}</ol></details>` : `<ol class="result-list">${entries(list)}</ol>`;
  }
  function entries(list) {
    return list.map(entry => `<li class="${entry.audience === 'public' ? '' : 'private-entry'}"><span class="log-time">${entry.day}일차 · ${C.phaseNames[entry.phase]}${entry.audience === 'public' ? '' : ' · 나만의 기록'}</span><p>${escape(entry.text)}</p></li>`).join('');
  }
  function renderJournal(view) {
    const filter = $('log-filter').value;
    const list = view.log.filter(e => filter === 'all' || filter === 'public' && e.audience === 'public' || filter === 'private' && e.audience !== 'public' || filter === 'discussion' && ['discussion', 'vote', 'exile'].includes(e.kind));
    $('journal').innerHTML = entries(list.slice().reverse()) || '<li>해당 기록이 없습니다.</li>';
    $('log-count').textContent = list.length + '개 기록';
  }
  // Render accepts only a scoped view, never the authoritative state.
  function render(view) {
    const location = game.data.locations.find(item => item.id === view.selectedLocation);
    const self = view.self, playing = self.isAlive && !self.isExiled;
    $('day-display').innerHTML = `<strong>${view.day}일차 / ${C.maxDays}일</strong><span>${C.phaseNames[view.phase]}</span><small>${view.outcome ? '종료된 기록' : playing ? '단계마다 한 번 행동' : '관전 중 · 생존자들의 결말을 확인하세요'}</small>`;
    $('phase-bar').innerHTML = C.phases.map(phase => `<span class="${phase === view.phase ? 'current' : ''}" ${phase === view.phase ? 'aria-current="step"' : ''}>${C.phaseNames[phase].split(' · ')[0]}<small>${C.phaseNames[phase].split(' · ')[1]}</small></span>`).join('');
    $('role-info').innerHTML = `<div><span class="eyebrow">나의 비밀 직업</span><h2>${C.roles[self.role].name}</h2></div><p>${C.roles[self.role].description}<br><span class="muted">${escape(self.secretGoal)}</span></p>`;
    $('facilities').innerHTML = Object.entries(C.repairGoals).map(([key, goal]) => `<div><label for="progress-${key}">${key === 'radio' ? '통신탑 복구' : '탈출 보트'} <strong>${view.facilities[key]} / ${goal}</strong></label><progress id="progress-${key}" value="${view.facilities[key]}" max="${goal}"></progress></div>`).join('');
    $('resources').innerHTML = game.data.resources.map(item => `<div class="resource"><span class="resource-icon" aria-hidden="true">${item.icon}</span><span>${item.name}<small>공동 물자</small></span><strong>${view.resources[item.id]}<small>${item.unit}</small></strong></div>`).join('');
    if (!$('map-locations').children.length) $('map-locations').innerHTML = game.data.locations.map(item => `<button class="map-pin" data-location="${item.id}" style="--x:${item.x}%;--y:${item.y}%" aria-pressed="false"><span class="pin-symbol" aria-hidden="true">${item.marker}</span><span class="pin-name">${item.name}</span></button>`).join('');
    document.querySelectorAll('[data-location]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.location === view.selectedLocation)); button.disabled = Boolean(view.outcome); });
    $('location-details').innerHTML = `<div class="location-icon" aria-hidden="true">${location.marker}</div><p class="location-kicker">${location.label}</p><h2 id="location-title">${location.name}</h2><p class="location-description">${location.description}</p><dl class="location-facts"><div><dt>주요 자원</dt><dd>${location.resources}</dd></div><div><dt>위험도</dt><dd class="risk-${location.risk === '높음' ? 'high' : 'normal'}">${location.risk}</dd></div></dl>`;
    const planned = view.plannedLocation === view.selectedLocation;
    $('plan-button').textContent = planned ? '이 지역으로 계획됨' : '탐사 계획에 기록';
    $('plan-button').disabled = planned || !playing || Boolean(view.outcome);
    actions = game.state.availableActions(view);
    $('action-title').textContent = view.phase === 'discussion' ? `토론 ${view.discussionRound + 1}/5 · ${C.discussionRounds[view.discussionRound]}` : C.phaseNames[view.phase];
    $('action-hint').textContent = view.outcome ? '이 기록은 끝났습니다. 결과와 사건 기록을 확인할 수 있습니다.' : !playing ? '직접 행동할 수 없습니다. 아래 버튼으로 생존자들의 행동을 진행하세요.' : view.resolved ? '모두의 행동이 처리되었습니다. 결과를 확인하고 다음 단계로 이동하세요.' : view.phase === 'voting' ? '후보를 선택한 뒤 확인 창에서 투표를 확정하세요. 최다 득표자 1명을 추방하며 동률이면 추방하지 않습니다.' : '한 가지 행동을 선택하세요. 이후 AI가 차례로 행동합니다.';
    guidance(view);
    $('action-list').innerHTML = actions.map((action, index) => `<button class="${action.kind === 'explore' ? 'primary' : 'secondary'} action-button" data-action-index="${index}">${escape(action.label)}</button>`).join('');
    if (view.phase === 'discussion' && actions.length) {
      const groups = [ ['사실과 단서', ['truth', 'share', 'evidence', 'partial']], ['질문과 의혹', ['question', 'accuse', 'speculate', 'agree']], ['해명과 반박', ['explain', 'defend', 'rebut']], ['거짓말과 정보 통제', ['lie', 'conceal', 'redirect', 'feign']] ];
      const button = (a, i) => '<button class="secondary action-button" data-action-index="' + i + '">' + escape(a.label) + '</button>';
      $('action-list').innerHTML = actions.map((a, i) => a.kind === 'discuss' ? button(a, i) : '').join('') + groups.map(([title, kinds]) => '<details><summary>' + title + '</summary>' + actions.map((a, i) => kinds.includes(a.kind) ? button(a, i) : '').join('') + '</details>').join('');
    }
    $('skip-discussion').hidden = view.phase !== 'discussion' || Boolean(view.outcome);
    renderSocial(view);
    $('next-button').disabled = Boolean(view.outcome) || playing && !view.resolved;
    $('next-button').title = view.outcome ? '게임이 종료되었습니다.' : playing && !view.resolved ? '현재 단계의 행동을 먼저 완료하세요.' : '진행 가능 · AI 처리는 자동입니다.';
    $('next-button').textContent = !playing && !view.resolved ? '관전 · 생존자 행동 진행' : view.phase === 'discussion' && view.discussionRound < 4 ? '다음 토론 순서' : view.phase === 'night' ? `${view.day === 3 ? '마지막 밤' : '하루'} 정산` : '다음 단계';
    $('survivors').innerHTML = view.players.map((p, i) => `<article class="survivor ${!p.isAlive || p.isExiled ? 'inactive' : ''}"><div class="avatar avatar-${i}" aria-hidden="true">${escape(p.initials)}</div><div><h3>${escape(p.name)}${p.id === self.id ? '<span class="you">나</span>' : ''}</h3><p>${escape(p.personality)}</p><span class="health">${!p.isAlive ? '사망' : p.isExiled ? '추방됨' : `체력 ${p.health} / 100`}</span><progress aria-label="${escape(p.name)} 체력" value="${p.health}" max="100"></progress></div>${characterDetails(view, p)}</article>`).join('');
    $('survivor-count').textContent = view.players.filter(p => p.isAlive && !p.isExiled).length + '명 활동 중';
    renderResults(view);
    $('results-title').textContent = view.phase === 'voting' && view.resolved ? '투표 결과' : view.phase === 'discussion' ? '토론 기록' : '이번 행동의 결과';
    renderJournal(view);
    $('ending-panel').hidden = !view.outcome;
    if (view.outcome) {
      const won = view.outcome.winner === (self.role === 'saboteur' ? 'saboteur' : 'survivors');
      $('ending-panel').innerHTML = `<p class="eyebrow">${view.day}일차 · 생존 기록 종료</p><h2 id="ending-title">${escape(view.outcome.title)}</h2><p>${escape(view.outcome.description)}</p><strong>${view.outcome.winner === 'none' ? '어느 진영도 승리하지 못했습니다.' : won ? '당신의 진영이 승리했습니다.' : '당신의 진영이 패배했습니다.'}</strong><p class="small muted">나의 상태: ${!self.isAlive ? '사망' : self.isExiled ? '추방' : '생존'} · 나의 직업: ${C.roles[self.role].name}</p><button class="primary" id="ending-new-button">새 기록 시작</button>`;
    }
    game.beta?.observe(view);
  }
  function characterDetails(view, p) {
    if (p.id === view.self.id) return '<details class="character-details"><summary>나의 목표</summary><p>' + escape(view.self.personalGoal) + '</p></details>';
    const mind = view.self, known = mind.memory.filter(m => m.subjectId === p.id && m.kind !== 'claim').slice(-3), speech = view.statements.filter(m => m.speakerId === p.id).slice(-2);
    const changes = mind.relationshipHistory.filter(r => r.target === p.id).slice(-3);
    return '<details class="character-details"><summary>' + escape(p.name) + ' · 내가 아는 기록</summary><p>나의 신뢰 ' + mind.trust[p.id] + ' / 의심 ' + mind.suspicion[p.id] + '</p><ul>' + changes.map(r => '<li>' + escape(r.reason) + ' · 신뢰 ' + r.before.trust + '→' + r.after.trust + ', 의심 ' + r.before.suspicion + '→' + r.after.suspicion + '</li>').join('') + '</ul><p>' + (known.map(m => escape(m.text)).join('<br>') || '관찰 기록 없음') + '</p><p>' + (speech.map(m => escape(m.text)).join('<br>') || '공개 발언 없음') + '</p></details>';
  }
  function renderSocial(view) {
    $('discussion-panel').hidden = view.phase !== 'discussion' && !view.statements.length;
    $('discussion-stage').textContent = view.phase === 'discussion' ? view.day + '일차 · ' + (view.discussionRound + 1) + '/5 · ' + C.discussionRounds[view.discussionRound] : '최근 공개 발언';
    $('statements').innerHTML = view.statements.slice(-12).reverse().map(m => '<li><span class="log-time">' + m.day + '일차 · ' + C.discussionRounds[m.round] + ' · #' + escape(m.id) + '</span><p>' + escape(game.data.survivors.find(p => p.id === m.speakerId).name) + ': ' + escape(m.text) + '</p></li>').join('') || '<li>첫 발언을 기다립니다.</li>';
    const evidence = view.self.memory.filter(m => !['cooperation', 'healing', 'sharing', 'statement'].includes(m.kind));
    $('evidence-count').textContent = evidence.length + '개 기억 · 펼쳐서 근거 확인';
    $('evidence-list').innerHTML = evidence.slice().reverse().map(m => '<li><span class="log-time">' + m.day + '일차 · ' + C.phaseNames[m.phase] + ' · ' + (m.direct ? '직접 확인' : '전달 / 주장') + ' · 신뢰도 ' + Math.round(m.reliability * 100) + '%</span><p>' + escape(m.text) + '</p><strong>' + escape(m.judgment) + '</strong>' + m.revisions.map(r => '<p class="small">판단 수정: ' + escape(r.from) + ' → ' + escape(r.to) + '</p>').join('') + '</li>').join('') || '<li>아직 확인한 단서가 없습니다.</li>';
  }
  function screen(name) {
    $('welcome').hidden = name !== 'welcome'; $('game').hidden = name !== 'game';
    const heading = document.querySelector(name === 'game' ? '.game-heading h1' : '#welcome-title');
    heading.tabIndex = -1; heading.focus({ preventScroll: true }); window.scrollTo(0, 0);
  }
  function saveStatus(saved) { $('save-status').textContent = saved ? '자동 저장됨 · 이 브라우저에 보관' : '저장 불가 · 현재 실행은 계속할 수 있습니다. 창을 닫기 전 브라우저 저장 권한을 확인하세요.'; }
  function welcome(result, hasSession) {
    $('continue-button').disabled = !result.state && !hasSession;
    $('save-description').textContent = hasSession ? '현재 기록을 이어서 확인할 수 있습니다.' : ({
      empty: '아직 저장된 기록이 없습니다.', legacy: 'Phase 1 기록은 보존되어 있습니다. 새 규칙으로 새 기록을 시작해 주세요.',
      invalid: '저장된 기록의 형식이 올바르지 않습니다. 새 기록 시작 시 교체 여부를 확인합니다.',
      unavailable: '저장소에 접근할 수 없습니다. 이번 실행 중에는 플레이할 수 있습니다.',
      migrated: '이전 버전 기록을 이어갈 수 있습니다. 기존 원본은 보존하고, 새 기억은 이어하기 이후부터 쌓입니다.',
      loaded: result.state ? `${dateLabel(result.state.updatedAt)} · ${result.state.day}일차 · ${result.state.outcome ? '엔딩 확인' : C.phaseNames[result.state.phase]}` : ''
    })[result.status];
  }
  game.ui = Object.freeze({ $, render, renderResults, renderJournal, screen, saveStatus, welcome, actionAt: index => actions[index] });
})(globalThis);

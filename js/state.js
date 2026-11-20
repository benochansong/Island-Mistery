(function (root) {
  'use strict';
  const game = root.IslandMystery;
  const C = game.config;
  const ids = game.data.survivors.map(p => p.id);
  const places = game.data.locations.map(p => p.id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = n => Math.max(0, Math.min(100, n));
  const active = p => p.isAlive && !p.isExiled;
  const stamp = () => new Date().toISOString();
  function random(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
  function integer(s, min, max) { return min + Math.floor(random(s) * (max - min + 1)); }
  function shuffle(s, values) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) { const j = integer(s, 0, i); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function record(s, text, actorId = null, audience = 'public', kind = 'event') {
    const entry = { id: ++s.sequence, day: s.day, phase: s.phase, actorId, audience, kind, text, time: s.updatedAt };
    s.log.push(entry);
    if (s.log.length > 500) s.log.shift();
    return entry;
  }
  function create(now = stamp(), seed = Math.floor(Math.random() * 4294967296), difficulty = C.defaultDifficulty, storyEnabled = true) {
    if (!Object.hasOwn(C.difficulty, difficulty)) throw new Error("알 수 없는 난이도입니다.");
    const s = { version: 4, initialSeed: seed >>> 0, difficulty, discussionRound: 0, statements: [], facts: [], invalidDecisions: 0, day: 1, phase: 'morning', rng: seed >>> 0, sequence: 0,
      selectedLocation: 'coast', plannedLocation: null, resources: { ...C.initialResources }, facilities: { radio: 0, boat: 0 },
      players: game.data.survivors.map((p, i) => ({ ...p, isHuman: i === 0, isAlive: true, isExiled: false, health: 100, location: 'camp' })),
      secrets: {}, log: [], acted: [], resolved: false, votes: {}, outcome: null, lastResults: [], eventsSeen: [], settledDays: [], updatedAt: now };
    const loyal = ['explorer', 'doctor', 'engineer', 'investigator'];
    const roles = shuffle(s, [...loyal, loyal[integer(s, 0, 3)], 'saboteur']);
    s.players.forEach((p, i) => {
      s.secrets[p.id] = { ...game.social.initialize(p.id, difficulty), role: roles[i], inventory: [], trust: {}, suspicion: {}, secretGoal: C.roles[roles[i]].goal, actionHistory: [], information: [] };
      ids.filter(id => id !== p.id).forEach(id => { s.secrets[p.id].trust[id] = C.relationships.initialTrust; s.secrets[p.id].suspicion[id] = C.relationships.initialSuspicion; });
    });
    game.story.initialize(s, () => random(s), storyEnabled);
    record(s, '여섯 명이 해안에서 깨어났다. 3일 안에 통신탑이나 탈출 보트를 완성해야 한다.');
    return s;
  }
  function coreValid(s) {
    const int = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
    const text = (v, max = 1000) => typeof v === 'string' && v.length <= max;
    const date = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
    const obj = v => v && typeof v === 'object' && !Array.isArray(v);
    try {
      if (!obj(s) || ![2, 3, 4].includes(s.version) || !int(s.day, 1, C.maxDays) || !C.phases.includes(s.phase) || !int(s.rng, 0, 4294967295) || !int(s.sequence, 1, 100000) || !date(s.updatedAt)) return false;
      if (!places.includes(s.selectedLocation) || (s.plannedLocation !== null && !places.includes(s.plannedLocation))) return false;
      if (!obj(s.resources) || !game.data.resources.every(r => int(s.resources[r.id], 0, 10000))) return false;
      if (!obj(s.facilities) || !Object.keys(C.repairGoals).every(key => int(s.facilities[key], 0, C.repairGoals[key]))) return false;
      if (!Array.isArray(s.players) || s.players.length !== 6 || !obj(s.secrets) || Object.keys(s.secrets).length !== 6) return false;
      for (let i = 0; i < 6; i++) {
        const p = s.players[i], base = game.data.survivors[i], secret = s.secrets[base.id];
        if (!obj(p) || p.id !== base.id || p.name !== base.name || p.personality !== base.personality || p.initials !== base.initials || p.isHuman !== (i === 0) || typeof p.isAlive !== 'boolean' || typeof p.isExiled !== 'boolean' || !int(p.health, 0, 100) || p.isAlive !== (p.health > 0) || !['camp', ...places].includes(p.location)) return false;
        if (!obj(secret) || !Object.hasOwn(C.roles, secret.role) || !text(secret.secretGoal) || !obj(secret.trust) || !obj(secret.suspicion)) return false;
        if (!ids.filter(id => id !== p.id).every(id => int(secret.trust[id], 0, 100) && int(secret.suspicion[id], 0, 100))) return false;
        if (!Array.isArray(secret.inventory) || secret.inventory.length > 50 || !secret.inventory.every(item => text(item, 100))) return false;
        if (!Array.isArray(secret.information) || secret.information.length > 100 || !secret.information.every(c => obj(c) && text(c.id, 80) && text(c.text) && (c.suspectId === null || ids.includes(c.suspectId)) && int(c.weight, 0, 50) && typeof c.shared === 'boolean')) return false;
        if (!Array.isArray(secret.actionHistory) || secret.actionHistory.length > (s.version === 2 ? 15 : 40) || !secret.actionHistory.every(a => obj(a) && int(a.day, 1, 3) && C.phases.includes(a.phase) && text(a.kind, 30) && (a.target === null || ids.includes(a.target)))) return false;
      }
      const roles = ids.map(id => s.secrets[id].role);
      if (roles.filter(role => role === 'saboteur').length !== 1 || !Object.keys(C.roles).every(role => roles.includes(role))) return false;
      if (!Array.isArray(s.acted) || new Set(s.acted).size !== s.acted.length || !s.acted.every(id => ids.includes(id)) || typeof s.resolved !== 'boolean') return false;
      if (s.resolved && s.players.some(p => active(p) && !s.acted.includes(p.id))) return false;
      if (!obj(s.votes) || !Object.entries(s.votes).every(([id, target]) => ids.includes(id) && (target === null || ids.includes(target) && target !== id))) return false;
      if (!Array.isArray(s.eventsSeen) || s.eventsSeen.length > 3 || new Set(s.eventsSeen).size !== s.eventsSeen.length || !s.eventsSeen.every(id => int(id, 0, 7))) return false;
      if (!Array.isArray(s.settledDays) || new Set(s.settledDays).size !== s.settledDays.length || !s.settledDays.every(day => int(day, 1, s.day))) return false;
      const entryValid = e => obj(e) && int(e.id, 1, s.sequence) && int(e.day, 1, 3) && C.phases.includes(e.phase) && (e.actorId === null || ids.includes(e.actorId)) && ['public', ...ids].includes(e.audience) && text(e.kind, 30) && text(e.text) && date(e.time);
      if (!Array.isArray(s.log) || s.log.length < 1 || s.log.length > 500 || !s.log.every(entryValid)) return false;
      if (!Array.isArray(s.lastResults) || s.lastResults.length > 500 || !s.lastResults.every(entryValid)) return false;
      if (s.outcome !== null && (!obj(s.outcome) || !['escape', 'exposed', 'saboteur', 'extinction'].includes(s.outcome.code) || !['survivors', 'saboteur', 'none'].includes(s.outcome.winner) || !text(s.outcome.title) || !text(s.outcome.description) || !int(s.outcome.day, 1, 3))) return false;
      return true;
    } catch { return false; }
  }
  // Explicit allowlist: UI and AI never receive another character's role or private log.
  function viewFor(s, playerId = 'player') {
    if (!ids.includes(playerId)) throw new Error('알 수 없는 인물입니다.');
    const visible = e => e.audience === 'public' || e.audience === playerId;
    const publicPlayer = p => ({ id: p.id, name: p.name, personality: p.personality, initials: p.initials, isHuman: p.isHuman, isAlive: p.isAlive, isExiled: p.isExiled, health: p.health, location: p.id === playerId ? p.location : null });
    return clone({ ...game.story.view(s, playerId), day: s.day, phase: s.phase, selectedLocation: playerId === 'player' ? s.selectedLocation : 'coast', plannedLocation: playerId === 'player' ? s.plannedLocation : null, difficulty: s.difficulty, discussionRound: s.discussionRound, statements: s.statements,
      resources: s.resources, facilities: s.facilities, players: s.players.map(publicPlayer),
      self: { ...publicPlayer(s.players.find(p => p.id === playerId)), ...s.secrets[playerId] },
      acted: s.acted, resolved: s.resolved, votes: s.resolved ? s.votes : {}, outcome: s.outcome,
      log: s.log.filter(visible), lastResults: s.lastResults.filter(visible), updatedAt: s.updatedAt });
  }
  function changeResource(s, key, amount, actorId = null, audience = 'public') {
    const before = s.resources[key]; s.resources[key] = Math.max(0, before + amount);
    const delta = s.resources[key] - before;
    if (delta) record(s, `${game.data.resources.find(r => r.id === key).name} ${delta > 0 ? '+' : ''}${delta} (현재 ${s.resources[key]})`, actorId, audience, 'resource');
  }
  function health(s, p, amount) {
    const before = p.health; p.health = clamp(before + amount); p.isAlive = p.health > 0;
    record(s, `${p.name} 체력 ${p.health - before >= 0 ? '+' : ''}${p.health - before} → ${p.health}${p.isAlive ? '' : ' · 사망'}`, p.id, 'public', 'health');
  }
  function clue(s, observerId, text, suspectId = null, weight = 0) {
    const secret = s.secrets[observerId]; const entry = record(s, text, observerId, observerId, 'clue');
    const memoryId = 'clue-' + entry.id;
    secret.information.push({ id: memoryId, memoryId, text, suspectId, weight, shared: false });
    game.perception.learn(s, observerId, { id: memoryId, eventId: memoryId, kind: suspectId ? 'trace' : 'clue', subjectId: suspectId, text, reliability: .7, source: 'investigation' });
  }
  function explore(s, p, location) {
    const cfg = C.locations[location], role = s.secrets[p.id].role; p.location = location;
    record(s, `${p.name}: ${game.data.locations.find(item => item.id === location).name} 탐험.`, p.id, 'public', 'explore');
    const bonus = role === 'explorer' ? C.explorationBonus : role === 'engineer' && ['lab', 'tower'].includes(location) ? 0.1 : 0;
    if (random(s) < Math.min(0.98, cfg.success + bonus)) {
      Object.entries(cfg.loot).forEach(([key, range]) => changeResource(s, key, integer(s, range[0], range[1]), p.id));
    } else record(s, `${p.name}: 수색 경로가 막혀 물자를 얻지 못했다.`, p.id, 'public', 'failure');
    if (random(s) < Math.min(0.9, cfg.clue + (role === 'investigator' ? C.investigatorBonus : 0))) {
      const messages = { coast: '난파선의 항로가 의도적으로 지워져 있다. 누가 지웠는지는 알 수 없다.', jungle: '숲속에서 연구소로 이어지는 숨겨진 길을 발견했다.', lab: '연구 기록: 무전 간섭 장치가 섬 안에 남아 있다. 누가 사용하는지는 알 수 없다.', tower: '무전 기록에 반복되는 간섭이 있다. 고장과 고의 훼손 모두 가능하다.' };
      clue(s, p.id, messages[location]); record(s, `${p.name}: 새로운 기록을 발견했다. 내용은 아직 공유되지 않았다.`, p.id, 'public', 'discovery');
    }
    if (random(s) < cfg.injury * (role === 'explorer' && location === 'jungle' ? 0.4 : 1)) health(s, p, -integer(s, 12, 24));
    if (p.isAlive && random(s) < 0.12) { record(s, `${p.name}: 버려진 비상 보급 상자를 발견했다.`, p.id, 'public', 'special'); changeResource(s, 'water', 2, p.id); }
  }
  function availableActions(view) {
    const p = view.self, role = p.role;
    if (view.pendingEvent || view.outcome || view.resolved || !active(p) || view.acted.includes(p.id)) return [];
    const result = [], add = (kind, label, extra = {}) => result.push({ kind, label, ...extra });
    if (view.phase === 'morning' && !(view.closedLocations?.[view.selectedLocation] > view.day)) add('explore', '선택 지역 탐험', { location: view.selectedLocation });
    if (view.storyEnabled && ['morning','afternoon'].includes(view.phase)) {
      if (view.phase === 'afternoon') add('research', '연구 기록 조사 · 단서의 대체 경로');
      game.storyData.sites.filter(site => view.unlockedSites.includes(site.id) && site.parent === view.selectedLocation && !p.visitedSites.includes(site.id) && !(view.closedLocations[site.parent] > view.day)).forEach(site => add('explore_hidden', site.name + ' 탐험 · 기록과 희귀 물자', { siteId: site.id }));
    }
    if (view.phase === 'discussion') return game.discussion.actions(view);
    if (view.phase === 'voting') {
      view.players.filter(other => active(other) && other.id !== p.id).forEach(other => add('vote', other.name + '에게 투표', { target: other.id }));
      add('vote', '기권', { target: null }); return result;
    }
    if (['afternoon', 'night'].includes(view.phase)) {
      if (view.resources.medicine > 0) view.players.filter(other => active(other) && other.health < 100).forEach(other => add('heal', `${other.name} 치료 (+${role === 'doctor' ? C.doctorHeal : C.normalHeal}, 의약품 1)`, { target: other.id }));
      const cost = role === 'engineer' ? 1 : 2;
      if (view.resources.parts >= cost) Object.entries(C.repairGoals).filter(([key, goal]) => view.facilities[key] < goal).forEach(([facility]) => add('repair', `${facility === 'radio' ? '통신탑' : '보트'} 수리 (+${role === 'engineer' ? 3 : 2}, 부품 ${cost})`, { facility }));
      if (role === 'saboteur') {
        ['food', 'water'].filter(key => view.resources[key] > 0).forEach(resource => add('hide', `${resource === 'food' ? '식량' : '식수'} 3개 은닉 · 비밀`, { resource }));
        ['radio', 'boat'].filter(key => view.facilities[key] > 0).forEach(facility => add('sabotage', `${facility === 'radio' ? '통신탑' : '보트'} 파괴 (-4) · 비밀`, { facility }));
      }
      if (view.phase === 'afternoon') ['food', 'water'].forEach(resource => add('gather', `${resource === 'food' ? '식량' : '식수'} 2개 확보`, { resource }));
      if (view.phase === 'night' && role === 'investigator') view.players.filter(other => active(other) && other.id !== p.id).forEach(other => add('investigate', `${other.name}의 흔적 조사 · 비밀`, { target: other.id }));
      if (view.phase === 'night' && role === 'explorer' && !(view.closedLocations?.[view.selectedLocation] > view.day)) add('explore', '선택 지역 야간 탐험', { location: view.selectedLocation });
    }
    add('rest', `휴식 (체력 +${C.restHeal})`); return result;
  }
  const matches = (a, b) => ['kind', 'target', 'location', 'facility', 'resource', 'clueId', 'historyId', 'memoryId', 'statementId', 'siteId'].every(key => a[key] === b[key]);
  function perform(s, p, action) {
    const allowed = availableActions(viewFor(s, p.id));
    if (action.kind === 'explore' && places.includes(action.location) && !(s.story.closed[action.location] > s.day)) allowed.filter(a => a.kind === 'explore').forEach(a => { a.location = action.location; });
    if (!allowed.some(a => matches(a, action))) throw new Error('현재 단계에서 실행할 수 없는 행동입니다.');
    const secret = s.secrets[p.id], before = { medicine: s.resources.medicine, radio: s.facilities.radio }; s.acted.push(p.id);
    secret.actionHistory.push({ id: `action-${s.day}-${s.phase}-${s.discussionRound}-${p.id}`, day: s.day, phase: s.phase, round: s.phase === 'discussion' ? s.discussionRound : null, location: null, kind: action.kind, target: action.target || null });
    if (s.phase === 'discussion') {
      const item = secret.information.find(c => c.id === action.clueId);
      game.discussion.speak(s, p, action, record, () => random(s));
      if (s.story.enabled && item?.storyId) game.story.grant(s, p.id, item.storyId, record, 'public');
      game.story.updateMissions(s); return;
    }
    if (action.kind === 'explore') explore(s, p, action.location);
    if (action.kind === 'rest') { p.location = 'camp'; record(s, `${p.name}: 야영지에서 휴식했다.`, p.id); health(s, p, C.restHeal); }
    if (action.kind === 'gather') { p.location = 'camp'; record(s, `${p.name}: 야영지 주변에서 물자를 확보했다.`, p.id); changeResource(s, action.resource, 2, p.id); }
    if (action.kind === 'heal') {
      p.location = 'camp';
      const target = s.players.find(other => other.id === action.target);
      record(s, `${p.name}: ${target.name}의 상처를 치료했다.`, p.id); changeResource(s, 'medicine', -1, p.id);
      health(s, target, secret.role === 'doctor' ? C.doctorHeal : C.normalHeal);
    }
    if (action.kind === 'repair') {
      const cost = secret.role === 'engineer' ? 1 : 2, amount = secret.role === 'engineer' ? 3 : 2;
      p.location = action.facility === 'radio' ? 'tower' : 'coast'; const before = s.facilities[action.facility];
      s.facilities[action.facility] = Math.min(C.repairGoals[action.facility], before + amount);
      record(s, `${p.name}: ${action.facility === 'radio' ? '통신탑' : '보트'} 수리도 +${s.facilities[action.facility] - before}.`, p.id);
      changeResource(s, 'parts', -cost, p.id);
    }
    if (['hide', 'sabotage'].includes(action.kind)) {
      // Public cover deliberately omits the actual place and identity of the culprit.
      p.location = 'camp';
      if (action.kind === 'hide') {
        const amount = Math.min(3, s.resources[action.resource]); changeResource(s, action.resource, -amount, p.id, p.id);
        secret.inventory.push(`${action.resource}:${amount}`);
        s.pendingReports.push(`공동 창고의 ${action.resource === 'food' ? '식량' : '식수'} ${amount}개가 사라졌다. 원인은 확인되지 않았다.`);
        record(s, `${action.resource === 'food' ? '식량' : '식수'} ${amount}개를 몰래 숨겼다.`, p.id, p.id, 'secret');
      } else {
        const before = s.facilities[action.facility]; s.facilities[action.facility] = Math.max(0, before - 4);
        s.pendingReports.push(`${action.facility === 'radio' ? '통신탑' : '보트'}에 손상이 발견됐다. 수리도 -${before - s.facilities[action.facility]}.`);
        record(s, '장비를 은밀히 훼손했다.', p.id, p.id, 'secret');
      }
    }
    if (action.kind === 'investigate') {
      p.location = 'camp';
      const target = s.players.find(other => other.id === action.target);
      const suspicious = s.secrets[target.id].actionHistory.some(a => a.day === s.day && ['hide', 'sabotage'].includes(a.kind)) || s.story.causes.some(c => c.day === s.day && c.actorId === target.id);
      const trace = random(s) < (suspicious ? 0.75 : 0.20); // Engine resolves evidence; AI never reads the role.
      record(s, `${p.name}: 주변의 흔적을 살폈다.`, p.id);
      clue(s, p.id, `${target.name}의 동선 조사: ${trace ? '훼손 현장과 이어지는 흔적. 우연일 수도 있다.' : '뚜렷한 증거 없음. 결백을 보장하지는 않는다.'}`, trace ? target.id : null, trace ? 30 : 0);
    }
    if (action.kind === 'vote') { s.votes[p.id] = action.target; secret.voteReason = action.reason || (action.target ? '플레이어가 선택한 후보' : '플레이어가 기권을 선택함'); }
    game.story.afterAction(s, p, action, record, () => random(s), before);
    game.perception.action(s, p, action, () => random(s));
  }
  function ending(s, code, winner, title, description) {
    s.outcome = { code, winner, title, description, day: s.day }; record(s, title + ' — ' + description, null, 'public', 'ending');
  }
  function checkEnd(s, atDawn = false, deadline = false) {
    if (s.outcome) return;
    // Ordered priority prevents ambiguous victories when several conditions coincide.
    const remaining = s.players.filter(active), loyal = remaining.filter(p => s.secrets[p.id].role !== 'saboteur');
    const spy = s.players.find(p => s.secrets[p.id].role === 'saboteur');
    if (!remaining.length) return ending(s, 'extinction', 'none', '엔딩 D · 생존 실패', '야영지의 생존자가 모두 쓰러졌다. 더 이상 탈출을 이어갈 사람이 없다.');
    if (!loyal.length) return ending(s, 'saboteur', 'saboteur', '엔딩 C · 무너진 공동체', '섬에 남아 탈출을 이어갈 생존자 진영의 인원이 없다.');
    if (atDawn && spy.isExiled) return ending(s, 'exposed', 'survivors', '엔딩 B · 간섭이 멎은 새벽', '공작원 추방 후 비상 신호가 연결됐다. 밤을 버틴 생존자들에게 구조정이 도착했다.');
    if (Object.entries(C.repairGoals).some(([key, goal]) => s.facilities[key] >= goal)) return ending(s, 'escape', 'survivors', '엔딩 A · 바다 너머로', '통신탑 또는 탈출 보트를 완성했다. 생존자들은 공작원의 방해를 이겨내고 섬을 탈출했다.');
    if (deadline) return ending(s, 'saboteur', 'saboteur', '엔딩 C · 끊어진 마지막 신호', '3일째 밤이 지났다. 탈출 경로를 완성하지 못해 공작원 진영이 승리했다.');
  }
  function tally(s) {
    const counts = {};
    Object.entries(s.votes).forEach(([id, target]) => {
      record(s, `${s.players.find(p => p.id === id).name}: ${target ? s.players.find(p => p.id === target).name + ' 지목' : '기권'} · ${s.secrets[id].voteReason || '판단 기록 없음'}`, id, 'public', 'vote');
      if (target) counts[target] = (counts[target] || 0) + 1;
    });
    const highest = Math.max(0, ...Object.values(counts)), winners = Object.keys(counts).filter(id => counts[id] === highest);
    if (highest > 0 && winners.length === 1) {
      const person = s.players.find(p => p.id === winners[0]); person.isExiled = true;
      record(s, `${person.name}: ${highest}표로 추방되었다. 직업은 공개되지 않는다.`, person.id, 'public', 'exile');
    } else record(s, '동률 또는 전원 기권으로 추방 없이 밤을 맞는다.', null, 'public', 'vote');
  }
  function runAI(s) {
    for (const p of s.players.filter(p => !p.isHuman)) {
      if (s.outcome) break;
      if (!active(p) || s.acted.includes(p.id)) continue;
      const view = viewFor(s, p.id), options = availableActions(view);
      const plan = game.ai.plan ? game.ai.plan(view, () => random(s)) : { action: game.ai.decide(view, () => random(s)), reason: '기본 행동' };
      let action = plan.action;
      s.secrets[p.id].decisionHistory.push({ day: s.day, phase: s.phase, round: s.discussionRound, kind: action.kind, reason: plan.reason, strategy: plan.strategy || null });
      if (!options.some(a => matches(a.kind === 'explore' && places.includes(action.location) && !(s.story.closed[action.location] > s.day) ? { ...a, location: action.location } : a, action))) { s.invalidDecisions++; action = options.find(a => a.kind === 'rest' || a.kind === 'discuss' || a.kind === 'vote' && a.target === null) || options[0]; }
      perform(s, p, action); checkEnd(s);
    }
  }
  function settleTurn(s) {
    if (s.outcome) return;
    game.perception.observe(s, () => random(s));
    s.resolved = true;
    if (s.phase === 'voting') tally(s);
    checkEnd(s);
  }
  function dailyEvent(s) {
    const pool = Array.from({ length: 8 }, (_, i) => i).filter(id => !s.eventsSeen.includes(id));
    const event = pool[integer(s, 0, pool.length - 1)]; s.eventsSeen.push(event);
    const labels = ['폭풍이 통신탑을 흔들었다.', '해안에 식량 상자가 떠밀려왔다.', '빗물을 모을 수 있는 틈을 찾았다.', '야영지에 열병이 돌았다.', '난파선 잔해에서 부품을 찾았다.', '야생동물이 식량 창고를 뒤졌다.', '희미한 무전 신호로 주파수 조정을 마쳤다.', '버려진 구급 상자를 발견했다.'];
    record(s, labels[event]);
    if (event === 0) { const loss = Math.min(2, s.facilities.radio); s.facilities.radio -= loss; record(s, `통신탑 수리도 -${loss}.`); }
    if (event === 1) changeResource(s, 'food', 3);
    if (event === 2) changeResource(s, 'water', 4);
    if (event === 3) { const people = s.players.filter(active); if (people.length) health(s, people[integer(s, 0, people.length - 1)], -12); }
    if (event === 4) changeResource(s, 'parts', 2);
    if (event === 5) changeResource(s, 'food', -2);
    if (event === 6) { s.facilities.radio = Math.min(C.repairGoals.radio, s.facilities.radio + 1); record(s, '통신탑 수리도 +1.'); }
    if (event === 7) changeResource(s, 'medicine', 1);
  }
  function nightSettlement(s) {
    if (s.settledDays.includes(s.day)) throw new Error('이미 정산한 날짜입니다.');
    s.settledDays.push(s.day);
    const people = s.players.filter(active), demand = people.length; let penalty = 0;
    for (const key of ['food', 'water']) {
      const missing = Math.max(0, demand - s.resources[key]); changeResource(s, key, -demand);
      if (demand) penalty += Math.ceil(C.shortageDamage[key] * missing / demand);
    }
    record(s, `${demand}명에게 하루 식량·식수를 배급했다.${penalty ? ' 부족한 몫은 공평하게 나누며 전원 체력 -' + penalty + '.' : ''}`, null, 'public', 'settlement');
    if (penalty) people.forEach(p => health(s, p, -penalty));
    checkEnd(s);
    if (!s.outcome) { if (!s.story.enabled) dailyEvent(s); checkEnd(s, true, s.day === C.maxDays); }
    if (!s.outcome) {
      s.day++; s.phase = 'morning'; s.discussionRound = 0; s.acted = []; s.resolved = false; s.votes = {};
      s.players.filter(active).forEach(p => { p.location = 'camp'; });
      record(s, `${s.day}일차 아침. 남은 물자를 확인하고 다음 탐험을 준비한다.`);
    }
  }
  function transition(state, action, now = stamp()) {
    if (!valid(state)) throw new Error('유효하지 않은 게임 상태입니다.');
    if (state.outcome) throw new Error('게임이 종료되었습니다. 새 기록을 시작해 주세요.');
    if (state.story.pending && action.type !== 'EVENT_CHOICE') throw new Error('발생한 사건의 선택을 먼저 완료해 주세요.');
    if (action.type === 'SKIP_DISCUSSION') {
      if (state.phase !== 'discussion') throw new Error('토론에서만 건너뛸 수 있습니다.');
      let current = state;
      for (let i = 0; i < 11 && current.phase === 'discussion' && !current.outcome; i++) {
        const human = current.players[0];
        current = transition(current, !current.resolved && active(human) ? { type: 'ACT', kind: 'discuss' } : { type: 'NEXT' }, now);
      }
      return current;
    }
    const s = clone(state); s.updatedAt = now; const startSequence = s.sequence, human = s.players[0];
    if (action.type === 'SELECT_LOCATION') {
      if (!places.includes(action.location)) throw new Error('알 수 없는 지역입니다.');
      s.selectedLocation = action.location; return s;
    }
    if (action.type === 'EVENT_CHOICE') {
      if (s.story.pending?.actorId !== 'player') throw new Error('자신에게 주어진 사건만 선택할 수 있습니다.');
      game.story.resolve(s, action.instance, action.choiceId, record, () => random(s)); checkEnd(s);
    } else if (action.type === 'PLAN_EXPEDITION') {
      if (!active(human)) throw new Error('관전 중에는 계획을 기록할 수 없습니다.');
      if (s.plannedLocation === s.selectedLocation) return state;
      s.plannedLocation = s.selectedLocation;
      record(s, game.data.locations.find(p => p.id === s.selectedLocation).name + ' 탐사 계획을 개인 수첩에 기록했다.', 'player', 'player', 'plan');
    } else if (action.type === 'ACT') {
      if (s.resolved || !active(human)) throw new Error('이번 단계에서는 행동할 수 없습니다.');
      s.pendingReports = [];
      perform(s, human, action); checkEnd(s);
      if (!s.outcome) runAI(s);
      settleTurn(s);
    } else if (action.type === 'NEXT') {
      if (!s.resolved) {
        if (active(human)) throw new Error('현재 단계의 행동을 먼저 완료해 주세요.');
        s.pendingReports = [];
        runAI(s); settleTurn(s);
      } else if (s.phase === 'discussion' && s.discussionRound < 4) { s.discussionRound++; s.acted = []; s.resolved = false; record(s, C.discussionRounds[s.discussionRound] + ' 순서가 시작됐다.'); }
      else if (s.phase === 'night') nightSettlement(s);
      else { s.phase = C.phases[C.phases.indexOf(s.phase) + 1]; s.acted = []; s.resolved = false; s.votes = {}; record(s, C.phaseNames[s.phase] + ' 단계가 시작됐다.'); }
    } else throw new Error('지원하지 않는 행동입니다.');
    if (s.pendingReports) {
      // Disclose environmental changes only after everybody has acted, without an actor ID.
      for (const report of s.pendingReports) record(s, report);
      delete s.pendingReports;
    }
    game.story.maybe(s, action, record, () => random(s));
    checkEnd(s); game.story.finish(s, record, () => random(s));
    s.lastResults = s.log.filter(e => e.id > startSequence);
    if (!valid(s)) throw new Error('상태 전이 검증 실패. 이전 기록은 유지됩니다.');
    return s;
  }
  function valid(s) { return coreValid(s) && s.version === 4 && game.schema.valid(s) && game.story.valid(s); }
  function migrate(old) {
    if (!coreValid(old) || ![2,3].includes(old.version) || old.version === 3 && !game.schema.valid(old)) return null;
    const s = clone(old);
    if (old.version === 2) { s.version = 3; s.difficulty = C.defaultDifficulty; s.discussionRound = s.phase === "discussion" && s.resolved ? 4 : 0; s.statements = []; s.facts = []; s.invalidDecisions = 0;
    for (const id of ids) { Object.assign(s.secrets[id], game.social.initialize(id)); s.secrets[id].actionHistory.forEach((a, i) => Object.assign(a, { id: "legacy-" + id + "-" + i, round: a.phase === "discussion" ? 4 : null, location: null })); }
    }
    s.version = 4; game.story.initialize(s, () => random(s), true, true);
    if (s.outcome) game.story.finish(s, record, () => random(s));
    return valid(s) ? s : null;
  }
  game.state = Object.freeze({ create, valid, migrate, transition, viewFor, availableActions });
})(globalThis);

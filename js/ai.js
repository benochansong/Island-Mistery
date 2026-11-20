(function (root) {
  'use strict';
  const game = root.IslandMystery;
  // Player-scoped view only: no access to other characters' private state.
  function decide(view, random = Math.random) {
    const self = view.self;
    const alive = view.players.filter(p => p.isAlive && !p.isExiled);
    const others = alive.filter(p => p.id !== self.id);
    const C = game.config, tuning = C.strategy, difficulty = C.difficulty[self.difficulty];
    const injured = alive.filter(p => p.health < tuning.patientHealth).sort((a, b) => a.health - b.health);
    if (view.phase === 'voting') { const vote = game.social.chooseVote(view, random); return { kind: 'vote', target: vote.target, reason: vote.reason }; }
    if (view.phase === 'discussion') return discuss(view, random);
    const repair = C.mechanics.repair[self.role === 'engineer' ? 'engineer' : 'other'];
    const facilities = Object.keys(C.repairGoals).sort((a, b) => view.facilities[b] / C.repairGoals[b] - view.facilities[a] / C.repairGoals[a]);
    // Equal progress does not always send all six characters to the radio.
    if (view.facilities.radio / C.repairGoals.radio === view.facilities.boat / C.repairGoals.boat && random() < self.traits.caution) facilities.reverse();
    const facility = facilities[0], progress = view.facilities[facility] / C.repairGoals[facility];
    if (view.phase !== 'morning') {
      if (self.role === 'saboteur') {
        const strategy = game.social.strategy(view).id;
        if (['disrupt', 'betray'].includes(strategy)) {
          if (view.facilities[facility] > 0) return { kind: 'sabotage', facility };
          const resource = view.resources.water <= view.resources.food ? 'water' : 'food';
          if (view.resources[resource] > 0) return { kind: 'hide', resource };
        }
        // A convincing cover action must never complete the enemy's escape.
        if (view.phase === 'afternoon') return { kind: 'gather', resource: view.resources.water <= view.resources.food ? 'water' : 'food' };
      } else {
        if (view.resources.parts >= repair.cost && view.facilities[facility] + repair.amount >= C.repairGoals[facility]) return { kind: 'repair', facility };
        if (injured[0]?.health <= tuning.dangerHealth && view.resources.medicine >= C.mechanics.medicineCost) return { kind: 'heal', target: injured[0].id };
        if (view.phase === 'afternoon' && Math.min(view.resources.food, view.resources.water) < alive.length) return { kind: 'gather', resource: view.resources.water <= view.resources.food ? 'water' : 'food' };
        if (view.day === C.maxDays && view.resources.parts >= repair.cost && (self.role === 'engineer' || progress >= tuning.urgentProgress)) return { kind: 'repair', facility };
      }
    }
    const personal = self.role !== 'saboteur' && self.health >= tuning.dangerHealth && Math.min(view.resources.food, view.resources.water) >= alive.length ? game.missions.decide(view, random) : null;
    if (personal) return personal;
    if (view.phase === 'morning') {
      if (self.health < tuning.dangerHealth && self.traits.caution > self.traits.aggression) return { kind: 'rest' };
      let location = 'coast';
      const supplyDays = view.day === 3 && difficulty.planning > 1 ? 1 : tuning.supplyDays;
      if (view.resources.water < alive.length * supplyDays) location = 'coast';
      else if (view.resources.food < alive.length * supplyDays) location = self.role === 'explorer' ? 'jungle' : 'coast';
      else if (injured.length > 1 && view.resources.medicine < 2) location = 'lab';
      else if (self.role === 'investigator' && self.information.length < 3) location = 'lab';
      else if (view.resources.parts < tuning.partsReserve || view.day === 3 && difficulty.planning > 1) location = self.role === 'engineer' ? 'tower' : 'lab';
      else location = ['coast', 'jungle', 'lab', 'tower'][Math.floor(random() * 4)];
      if (self.traits.emotionalSensitivity > .8 && self.health < 60) location = 'coast';
      if (view.closedLocations?.[location] > view.day) location = ['coast','lab','tower','jungle'].find(l => !(view.closedLocations[l] > view.day));
      return location ? { kind: 'explore', location } : {kind:'rest'};
    }
    if (self.role === 'doctor' && injured.length && view.resources.medicine >= C.mechanics.medicineCost) return { kind: 'heal', target: injured[0].id };
    if (self.health < tuning.healHealth && view.resources.medicine >= C.mechanics.medicineCost) return { kind: 'heal', target: self.id };
    if (view.phase === 'night' && self.role === 'investigator' && others.length) {
      const scores = game.social.voteScores(view), best = scores[0];
      const candidates = scores.filter(s => s.score >= best.score - C.difficulty[self.difficulty].judgmentError);
      return { kind: 'investigate', target: candidates[Math.floor(random() * candidates.length)].id };
    }
    if (self.role !== 'saboteur' && view.resources.parts >= repair.cost && (self.role === 'engineer' || random() < tuning.repairChance)) return { kind: 'repair', facility };
    if (view.phase === 'afternoon') return { kind: 'gather', resource: view.resources.water <= view.resources.food ? 'water' : 'food' };
    if (self.role === 'explorer' && self.health > 50 && !(view.closedLocations?.[view.resources.water < alive.length ? 'coast' : 'jungle'] > view.day)) return { kind: 'explore', location: view.resources.water < alive.length ? 'coast' : 'jungle' };
    return { kind: 'rest' };
  }
  function discuss(view, random) {
    const self = view.self, traits = self.traits;
    const options = game.state.availableActions(view).filter(a => {
      if (self.role !== 'saboteur' || !['truth', 'explain', 'partial', 'evidence'].includes(a.kind)) return true;
      const known = a.memoryId ? self.memory.find(m => m.id === a.memoryId) : self.actionHistory.find(h => h.id === a.historyId);
      const aboutSelf = !a.memoryId || known?.subjectId === self.id;
      return !aboutSelf || !self.actionHistory.some(h => h.day === known?.day && h.phase === known?.phase && ['hide', 'sabotage'].includes(h.kind));
    });
    const get = kind => (kind === 'evidence' ? options.find(a => a.kind === kind && self.memory.some(m => m.id === a.memoryId && m.subjectId !== self.id)) : null) || options.find(a => a.kind === kind);
    const scores = game.social.voteScores(view), tied = scores.filter(s => s.score >= scores[0]?.score - game.config.difficulty[self.difficulty].judgmentError), suspect = tied[Math.floor(random() * tied.length)];
    const question = view.statements.slice().reverse().find(m => m.target === self.id && m.mode === 'question');
    if (question && view.discussionRound >= 2) {
      const answer = options.find(a => a.kind === 'explain' && self.actionHistory.some(h => h.id === a.historyId && h.day === question.aboutDay && h.phase === question.aboutPhase));
      if (answer && !self.claimHistory.some(c => c.replyTo === question.id)) return answer;
    }
    if (get('rebut') && traits.logicalThinking + traits.aggression > .7) return get('rebut');
    const personal = self.role !== 'saboteur' ? game.missions.decide(view, random) : null;
    if (personal) return personal;
    if (self.role === 'saboteur') {
      const strategy = game.social.strategy(view).id;
      if (strategy === 'misinform' && view.discussionRound <= 2 && random() < .55 + traits.deceptionTendency * .4) {
        const lie = options.find(a => a.kind === 'lie' && self.actionHistory.some(h => h.id === a.historyId && ['hide', 'sabotage'].includes(h.kind)));
        if (lie && !self.claimHistory.some(c => c.intent === 'lie' && view.statements.some(m => m.id === c.statementId && m.day === view.day))) return lie;
      }
      if (strategy === 'alibi' && get('truth')) return get('truth');
      if (strategy === 'divide') {
        const aid = self.memory.find(m => ['healing', 'sharing'].includes(m.kind) && m.subjectId !== self.id);
        const redirect = options.find(a => a.kind === 'redirect' && a.target === aid?.subjectId);
        if (redirect) return redirect;
      }
      if (view.discussionRound === 0) return get('feign');
    }
    if (view.discussionRound === 0) return traits.cooperation > .5 ? get('evidence') || get('share') || get('truth') || get('discuss') : get('partial') || get('conceal');
    if (view.discussionRound === 1 && suspect?.supported && suspect.score > 23 - traits.aggression * 6) return options.find(a => a.kind === 'accuse' && a.target === suspect.id);
    if (view.discussionRound === 2 && suspect) return options.find(a => a.kind === 'question' && a.target === suspect.id);
    if (view.discussionRound === 3) {
      if (traits.cooperation < .3) return get('conceal');
      const defense = traits.cooperation > .8 ? options.find(a => a.kind === 'defend' && self.trust[a.target] >= 55 && self.suspicion[a.target] < 20) : null;
      return defense || get('evidence') || get('share') || get('conceal');
    }
    if (view.discussionRound === 4 && suspect?.supported && suspect.score > 30) return options.find(a => a.kind === 'accuse' && a.target === suspect.id);
    if (traits.emotionalSensitivity > .8 && get('agree') && random() < .6) return get('agree');
    return get('discuss');
  }
  function plan(view, random = Math.random) {
    const action = decide(view, random), strategy = view.self.role === 'saboteur' ? game.social.strategy(view) : null;
    const previous = view.self.decisionHistory.at(-1);
    const context = `${view.day}일차 · 식량 ${view.resources.food}, 식수 ${view.resources.water}, 부품 ${view.resources.parts}, 체력 ${view.self.health}, 통신탑 ${view.facilities.radio}/${game.config.repairGoals.radio}, 보트 ${view.facilities.boat}/${game.config.repairGoals.boat}`;
    const change = previous && previous.kind !== action.kind ? ` · 이전 ${previous.kind}에서 ${action.kind}으로 변경` : '';
    return { action, strategy: strategy?.id || null, reason: `${action.reason || strategy?.reason || '생존 위험·탈출 준비·자신의 증거·개인 목표 순으로 판단'} (${context})${change}` };
  }
  game.ai = Object.freeze({ decide, plan });
})(globalThis);

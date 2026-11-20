(function (root) {
  'use strict';
  const game = root.IslandMystery;
  // Player-scoped view only: no access to other characters' private state.
  function decide(view, random = Math.random) {
    const self = view.self;
    const alive = view.players.filter(p => p.isAlive && !p.isExiled);
    const others = alive.filter(p => p.id !== self.id);
    const injured = alive.filter(p => p.health < 76).sort((a, b) => a.health - b.health);
    const rank = p => self.suspicion[p.id] + (50 - self.trust[p.id]) * (0.12 + self.traits.emotionalSensitivity * 0.25);
    const suspect = others.slice().sort((a, b) => rank(b) - rank(a))[0];
    if (view.phase === 'voting') { const vote = game.social.chooseVote(view, random); return { kind: 'vote', target: vote.target, reason: vote.reason }; }
    const personal = game.missions.decide(view, random);
    if (personal) return personal;
    if (view.phase === 'discussion') return discuss(view, random);
    if (view.phase === 'morning') {
      if (self.health < 30 && self.traits.caution > self.traits.aggression) return { kind: 'rest' };
      let location = 'coast';
      if (view.resources.water < alive.length * 2) location = 'coast';
      else if (view.resources.food < alive.length * 2) location = self.role === 'explorer' ? 'jungle' : 'coast';
      else if (injured.length > 1 && view.resources.medicine < 2) location = 'lab';
      else if (self.role === 'investigator' && self.information.length < 3) location = 'lab';
      else if (view.resources.parts < 6) location = self.role === 'engineer' ? 'tower' : 'lab';
      else location = ['coast', 'jungle', 'lab', 'tower'][Math.floor(random() * 4)];
      if (self.traits.emotionalSensitivity > .8 && self.health < 60) location = 'coast';
      if (view.closedLocations?.[location] > view.day) location = ['coast','lab','tower','jungle'].find(l => !(view.closedLocations[l] > view.day));
      return location ? { kind: 'explore', location } : {kind:'rest'};
    }
    if (self.role === 'doctor' && injured.length && view.resources.medicine) return { kind: 'heal', target: injured[0].id };
    if (self.role === 'saboteur' && game.social.strategy(view).id === 'disrupt') {
      const facility = view.facilities.radio >= view.facilities.boat ? 'radio' : 'boat';
      if (view.facilities[facility] > 0) return { kind: 'sabotage', facility };
      if (view.resources.water > 0) return { kind: 'hide', resource: 'water' };
    }
    if (self.health < 55 && view.resources.medicine > 0) return { kind: 'heal', target: self.id };
    if (view.phase === 'night' && self.role === 'investigator' && others.length) return { kind: 'investigate', target: suspect && rank(suspect) > 15 ? suspect.id : others[Math.floor(random() * others.length)].id };
    if (view.resources.parts >= (self.role === 'engineer' ? 1 : 2) && (self.role === 'engineer' || random() < 0.6)) return { kind: 'repair', facility: view.facilities.radio / game.config.repairGoals.radio >= view.facilities.boat / game.config.repairGoals.boat ? 'radio' : 'boat' };
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
    const scores = game.social.voteScores(view), suspect = scores[0];
    const question = view.statements.slice().reverse().find(m => m.target === self.id && m.mode === 'question');
    if (question && view.discussionRound >= 2) {
      const answer = options.find(a => a.kind === 'explain' && self.actionHistory.some(h => h.id === a.historyId && h.day === question.aboutDay && h.phase === question.aboutPhase));
      if (answer && !self.claimHistory.some(c => c.replyTo === question.id)) return answer;
    }
    if (get('rebut') && traits.logicalThinking + traits.aggression > .7) return get('rebut');
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
    if (view.discussionRound === 1 && suspect && suspect.score > 23 - traits.aggression * 6) return options.find(a => a.kind === 'accuse' && a.target === suspect.id);
    if (view.discussionRound === 2 && suspect) return options.find(a => a.kind === 'question' && a.target === suspect.id);
    if (view.discussionRound === 3) {
      if (traits.cooperation < .3) return get('conceal');
      const defense = traits.cooperation > .8 ? options.find(a => a.kind === 'defend' && self.trust[a.target] >= 55 && self.suspicion[a.target] < 20) : null;
      return defense || get('evidence') || get('share') || get('conceal');
    }
    if (view.discussionRound === 4 && suspect && suspect.score > 30) return options.find(a => a.kind === 'accuse' && a.target === suspect.id);
    if (traits.emotionalSensitivity > .8 && get('agree') && random() < .6) return get('agree');
    return get('discuss');
  }
  function plan(view, random = Math.random) {
    const action = decide(view, random), strategy = view.self.role === 'saboteur' ? game.social.strategy(view) : null;
    return { action, strategy: strategy?.id || null, reason: action.reason || strategy?.reason || (view.phase === 'discussion' ? '자신의 기억, 성격과 토론 순서에 따라 발언 선택' : '공개 물자, 체력과 자신의 직업에 따라 행동 선택') };
  }
  game.ai = Object.freeze({ decide, plan });
})(globalThis);

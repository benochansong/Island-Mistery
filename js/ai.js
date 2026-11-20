(function (root) {
  'use strict';
  const game = root.IslandMystery;
  // Player-scoped view only: no access to other characters' private state.
  function decide(view, random = Math.random) {
    const self = view.self;
    const alive = view.players.filter(p => p.isAlive && !p.isExiled);
    const others = alive.filter(p => p.id !== self.id);
    const injured = alive.filter(p => p.health < 76).sort((a, b) => a.health - b.health);
    const rank = p => self.suspicion[p.id] + (50 - self.trust[p.id]) * (self.personality.includes('공격') ? 0.65 : 0.25);
    const suspect = others.slice().sort((a, b) => rank(b) - rank(a))[0];
    if (view.phase === 'voting') {
      const threshold = self.personality.includes('공격') ? 9 : self.personality.includes('신중') ? 25 : 18;
      return { kind: 'vote', target: suspect && rank(suspect) > threshold ? suspect.id : null };
    }
    if (view.phase === 'discussion') {
      const clue = self.information.find(item => !item.shared);
      if (clue && (self.role !== 'saboteur' || !clue.suspectId)) return { kind: 'share', clueId: clue.id };
      if (suspect && rank(suspect) > 22) return { kind: 'accuse', target: suspect.id };
      return { kind: 'discuss' };
    }
    if (view.phase === 'morning') {
      if (self.health < 30 && !self.personality.includes('공격')) return { kind: 'rest' };
      let location = 'coast';
      if (view.resources.water < alive.length * 2) location = 'coast';
      else if (view.resources.food < alive.length * 2) location = self.role === 'explorer' ? 'jungle' : 'coast';
      else if (injured.length > 1 && view.resources.medicine < 2) location = 'lab';
      else if (self.role === 'investigator' && self.information.length < 3) location = 'lab';
      else if (view.resources.parts < 6) location = self.role === 'engineer' ? 'tower' : 'lab';
      else location = ['coast', 'jungle', 'lab', 'tower'][Math.floor(random() * 4)];
      if (self.personality.includes('감정') && self.health < 60) location = 'coast';
      return { kind: 'explore', location };
    }
    if (self.role === 'doctor' && injured.length && view.resources.medicine) return { kind: 'heal', target: injured[0].id };
    if (self.role === 'saboteur' && random() < (self.personality.includes('신중') ? 0.5 : 0.72)) {
      const facility = view.facilities.radio >= view.facilities.boat ? 'radio' : 'boat';
      if (view.facilities[facility] > 0) return { kind: 'sabotage', facility };
      if (view.resources.water > 0) return { kind: 'hide', resource: 'water' };
    }
    if (self.health < 55 && view.resources.medicine > 0) return { kind: 'heal', target: self.id };
    if (view.phase === 'night' && self.role === 'investigator' && others.length) return { kind: 'investigate', target: suspect && rank(suspect) > 15 ? suspect.id : others[Math.floor(random() * others.length)].id };
    if (view.resources.parts >= (self.role === 'engineer' ? 1 : 2) && (self.role === 'engineer' || random() < 0.6)) return { kind: 'repair', facility: view.facilities.radio / game.config.repairGoals.radio >= view.facilities.boat / game.config.repairGoals.boat ? 'radio' : 'boat' };
    if (view.phase === 'afternoon') return { kind: 'gather', resource: view.resources.water <= view.resources.food ? 'water' : 'food' };
    if (self.role === 'explorer' && self.health > 50) return { kind: 'explore', location: view.resources.water < alive.length ? 'coast' : 'jungle' };
    return { kind: 'rest' };
  }
  game.ai = Object.freeze({ decide });
})(globalThis);

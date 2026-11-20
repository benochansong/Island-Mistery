(function(root){
  'use strict';
  const game=root.IslandMystery;
  function decide(view,random){
    if(!view.storyEnabled||!view.self.mission||view.self.mission.complete)return null;
    const m=view.self,goal=m.mission,options=game.state.availableActions(view),target=view.players.find(p=>p.id===goal.target);
    if(['protect','escapeTogether','trust'].includes(goal.id)&&target?.isAlive&&!target.isExiled&&target.health<80){const heal=options.find(a=>a.kind==='heal'&&a.target===target.id);if(heal)return heal;}
    if(goal.id==='radio'){const repair=options.find(a=>a.kind==='repair'&&a.facility==='radio');if(repair)return repair;}
    if(view.phase==='morning'&&m.health>=40&&view.resources.food>=view.players.filter(p=>p.isAlive&&!p.isExiled).length&&view.resources.water>=6){
      const hidden=options.find(a=>a.kind==='explore_hidden');if(hidden&&['risk','archive','document','access'].includes(goal.id))return hidden;
      const location=goal.id==='risk'?'jungle':['medicine','access','document','truth','archive'].includes(goal.id)?'lab':null;
      if(location&&!(view.closedLocations[location]>view.day))return {kind:'explore',location};
    }
    if(view.phase==='afternoon'&&['document','access','truth','archive','conceal'].includes(goal.id)&&random()<.7)return options.find(a=>a.kind==='research')||null;
    if(view.phase==='discussion'){
      if(goal.id==='conceal'&&m.storyClues.some(c=>!c.shared))return options.find(a=>a.kind==='conceal');
      if(goal.id==='trust'&&view.discussionRound===3)return options.find(a=>a.kind==='defend'&&a.target===goal.target)||null;
      if(goal.id==='truth'&&view.discussionRound===0){const clue=m.information.find(c=>c.storyId&&!c.shared);if(clue)return options.find(a=>a.kind==='share'&&a.clueId===clue.id)||null;}
    }
    return null;
  }
  game.missions=Object.freeze({decide});
})(globalThis);
